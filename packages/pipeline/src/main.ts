import {
  agregadosEstaticosSchema,
  benchmarksSchema,
  caminhoVotacao,
  feedEstaticoSchema,
  indiceSchema,
  mandatoEstaticoSchema,
  parlamentarKey,
  partidosEstaticosSchema,
  remuneracaoEstaticaSchema,
  votacaoEstaticaSchema,
  votacoesEstaticasSchema,
  type Benchmark,
  type Casa,
  type EventoFeed,
  type Indice,
  type IndiceParlamentar,
  type Parlamentar,
  type NomeSecao,
  type ResumoDespesas,
  type SecoesParlamentar,
} from "@politicapp/data"

import {
  enriquecerComProposicoes,
  levantarEmendas,
  levantarFrentes,
  levantarNormas,
  levantarPartidos,
  levantarRemuneracao,
  levantarSancoes,
  levantarTramitacoes,
  medirParticipacao,
} from "./coleta"
import {
  inicioDaLegislatura,
  levantarEleicoes,
  levantarHistorico,
  levantarPresenca,
  levantarProducao,
} from "./coleta-parlamentar"
import { config, log } from "./config"
import {
  ETAPAS_DO_JOB_DE_PERFIS,
  etapa,
  exigirVolume,
  gravarStatus,
  pularEtapa,
  registrosDeEtapas,
} from "./etapas"
import { levantarAgenda } from "./agenda"
import { Loja } from "./loja"
import { levantarMandato } from "./mandato"
import { baixarDespesasCamara, listarDeputados } from "./sources/camara"
import { baixarDespesasSenado, listarSenadores } from "./sources/senado"
import { calcularAfinidade } from "./tasks/afinidade"
import { calcularBenchmark } from "./tasks/benchmarks"
import { resumirDespesas } from "./tasks/despesas"
import { montarEventos } from "./tasks/feed"
import { detalharFornecedores } from "./tasks/fornecedores"

/**
 * ETL diário. Lê o estado anterior do diretório publicado, roda cada etapa
 * isolada e só sobrescreve o que conseguiu recalcular. Etapa que falha deixa
 * no ar o dado da execução anterior; o workflow publica o que deu certo e
 * depois falha o job (via `PIPELINE_STATUS`) para o alerta disparar.
 */

const porChave = <T>(itens: T[], chave: (item: T) => string) =>
  new Map(itens.map((item) => [chave(item), item]))

const agruparPorChave = <T>(itens: T[], chave: (item: T) => string) => {
  const grupos = new Map<string, T[]>()
  for (const item of itens) {
    const k = chave(item)
    grupos.set(k, [...(grupos.get(k) ?? []), item])
  }
  return grupos
}

const executar = async () => {
  const { ano } = config
  const geradoEm = new Date().toISOString()
  const loja = new Loja(config.saida)
  await loja.carregarShards()

  // O índice de ontem é recuo e régua. A lista de quem está em exercício vale
  // de um ano para o outro; gasto e participação, só dentro do mesmo ano.
  const indiceAnterior = await loja.lerValidado("parlamentares", indiceSchema)
  const anterior = indiceAnterior?.ano === ano ? indiceAnterior : null
  const anterioresDa = (casa: Casa): IndiceParlamentar[] =>
    indiceAnterior?.parlamentares.filter((parlamentar) => parlamentar.casa === casa) ?? []
  const comGastoAnterior = (casa: Casa) =>
    (anterior?.parlamentares ?? []).filter(
      (parlamentar) => parlamentar.casa === casa && (parlamentar.gastoAno ?? 0) > 0,
    ).length
  const semCamposDoIndice = ({
    gastoAno: _gasto,
    participacaoPercentual: _percentual,
    votacoesParticipadas: _participadas,
    ...parlamentar
  }: IndiceParlamentar): Parlamentar => parlamentar

  // ── base: quem está em exercício ─────────────────────────────────────

  const deputados =
    (await etapa("deputados", async () => {
      const lista = await listarDeputados()
      exigirVolume("câmara: deputados", lista.length, anterioresDa("camara").length, 0.9)
      return lista
    })) ?? anterioresDa("camara").map(semCamposDoIndice)

  if (deputados.length === 0) {
    throw new Error("sem lista de deputados e sem publicação anterior — nada a fazer")
  }

  const senadores =
    (await etapa("senadores", async () => {
      const lista = await listarSenadores()
      exigirVolume("senado: senadores", lista.length, anterioresDa("senado").length, 0.9)
      return lista
    })) ?? anterioresDa("senado").map(semCamposDoIndice)

  const parlamentares = [...deputados, ...senadores]

  // ── despesas (cota) ──────────────────────────────────────────────────

  const despesas = async (casa: Casa, baixar: () => Promise<Parameters<typeof resumirDespesas>[2]>) =>
    loja.etapa(`despesas-${casa}`, async () => {
      const lancamentos = await baixar()
      const resumos = resumirDespesas(casa, ano, lancamentos)
      exigirVolume(`${casa}: parlamentares com cota`, resumos.length, comGastoAnterior(casa))
      loja.definirSecao("despesas", porChave(resumos, parlamentarKey), { vazio: null, casa })
      return { lancamentos, resumos }
    })

  const despesasCamara = await despesas("camara", () => baixarDespesasCamara(ano))
  const despesasSenado =
    senadores.length > 0
      ? await despesas("senado", () => baixarDespesasSenado(ano, senadores))
      : (pularEtapa("despesas-senado", "sem lista de senadores"), null)

  // ── remuneração e custo do mandato ───────────────────────────────────

  const remuneracao = await loja.etapa("remuneracao", async () => {
    const levantado = await levantarRemuneracao(ano, deputados, senadores)
    await loja.escreverArquivo(
      "remuneracao",
      { geradoEm, ano, subsidio: levantado.subsidio, congresso: levantado.congresso },
      remuneracaoEstaticaSchema,
    )
    loja.definirSecao("custo", porChave(levantado.custos, parlamentarKey), { vazio: null })
    return levantado
  })

  // O ano corrente do mandato soma cota e moradia desta execução: sem elas
  // o total sairia subestimado, então a etapa espera as duas.
  if (despesasCamara && (despesasSenado || senadores.length === 0) && remuneracao) {
    await loja.etapa("mandato", async () => {
      const cache = await loja.lerValidado("interno/mandato", mandatoEstaticoSchema)
      const mandato = await levantarMandato(
        ano,
        deputados,
        senadores,
        [...despesasCamara.resumos, ...(despesasSenado?.resumos ?? [])],
        remuneracao.custos,
        cache,
      )
      // O cache guarda também quem saiu do exercício: suplente ou licenciado
      // que volta reaproveita os anos fechados em vez de ficar sem eles.
      const ativos = new Set(mandato.parlamentares.map(parlamentarKey))
      await loja.escreverArquivo(
        "interno/mandato",
        {
          geradoEm,
          ...mandato,
          parlamentares: [
            ...mandato.parlamentares,
            ...(cache?.parlamentares ?? []).filter((item) => !ativos.has(parlamentarKey(item))),
          ],
        },
        mandatoEstaticoSchema,
      )
      loja.definirSecao("mandato", porChave(mandato.parlamentares, parlamentarKey), {
        vazio: null,
      })
    })
  } else {
    pularEtapa("mandato", "depende de despesas e remuneração do dia")
  }

  // ── votações: participação, feed de votações, votos, agregados ───────

  const votacoes = await loja.etapa("votacoes", async () => {
    const medido = await medirParticipacao(ano)
    const [feed, simbolicas] = await Promise.all([
      enriquecerComProposicoes(medido.feed),
      enriquecerComProposicoes(medido.simbolicas),
    ])

    // Tudo que se referencia (votacoes.json ↔ seção votos, agregados ↔
    // alinhamento) sai desta mesma etapa, para nunca publicar metade nova e
    // metade velha.
    const conjunto = conjuntoDe(feed)
    await loja.escreverArquivo(
      "votacoes",
      { geradoEm, ano, conjunto, votacoes: feed },
      votacoesEstaticasSchema,
    )
    await loja.escreverArquivo(
      "agregados",
      { geradoEm, ano, casas: medido.agregados.map(({ parlamentares: _p, ...casa }) => casa) },
      agregadosEstaticosSchema,
    )

    loja.definirSecao(
      "alinhamento",
      porChave(medido.agregados.flatMap((casa) => casa.parlamentares), parlamentarKey),
      { vazio: null },
    )

    const votos = new Map<string, SecoesParlamentar["votos"]>()
    for (const votacao of medido.votosDoFeed) {
      for (const [id, voto] of Object.entries(votacao.votos)) {
        const chave = parlamentarKey({ casa: votacao.casa, id })
        const secao = votos.get(chave) ?? { ano, conjunto, votacoes: [] }
        secao.votacoes.push({ id: votacao.id, voto })
        votos.set(chave, secao)
      }
    }
    loja.definirSecao("votos", votos, { vazio: { ano, conjunto, votacoes: [] } })

    const enriquecidas = porChave(feed, (votacao) => `${votacao.casa}:${votacao.id}`)
    await loja.substituirColecao(
      "votacao",
      medido.detalhes.map((detalhe) => {
        const doFeed = enriquecidas.get(`${detalhe.casa}:${detalhe.id}`)
        return {
          caminho: caminhoVotacao(detalhe.casa, detalhe.id),
          dados: { ...detalhe, proposicao: doFeed?.proposicao ?? detalhe.proposicao, geradoEm },
        }
      }),
      votacaoEstaticaSchema,
    )

    return { ...medido, feed, simbolicas }
  })

  // ── feed da home ─────────────────────────────────────────────────────

  const [agenda, tramitacoes, normas] = await Promise.all([
    etapa("agenda", levantarAgenda),
    etapa("tramitacoes", levantarTramitacoes),
    etapa("normas", levantarNormas),
  ])

  await loja.etapa("feed", async () => {
    // Tipo de evento cuja fonte falhou hoje fica com os eventos de ontem.
    const feedAnterior = await loja.lerValidado("feed", feedEstaticoSchema)
    const falharam = new Set<EventoFeed["tipo"]>([
      ...(agenda ? [] : (["pauta"] as const)),
      ...(votacoes ? [] : (["votacao"] as const)),
      ...(tramitacoes ? [] : (["tramitacao"] as const)),
      ...(normas ? [] : (["norma"] as const)),
    ])
    // Pauta de ontem que já passou não volta para "em pauta".
    const hoje = geradoEm.slice(0, 10)
    const deOntem = (feedAnterior?.eventos ?? []).filter(
      (evento) =>
        falharam.has(evento.tipo) && (evento.tipo !== "pauta" || evento.data.slice(0, 10) >= hoje),
    )

    const novos = montarEventos(
      agenda ?? [],
      votacoes?.feed ?? [],
      votacoes?.simbolicas ?? [],
      tramitacoes ?? [],
      normas ?? [],
    )
    const eventos = [
      ...[...novos, ...deOntem].filter((evento) => evento.tipo === "pauta"),
      ...[...novos, ...deOntem]
        .filter((evento) => evento.tipo !== "pauta")
        .sort((a, b) => b.data.slice(0, 10).localeCompare(a.data.slice(0, 10))),
    ]
    await loja.escreverArquivo("feed", { geradoEm, ano, eventos }, feedEstaticoSchema)
  })

  // ── seções avulsas ───────────────────────────────────────────────────

  const emendas = await loja.etapa("emendas", async () => {
    const { resumos, porMunicipio } = await levantarEmendas(parlamentares)
    const porParlamentar = agruparPorChave(resumos, parlamentarKey)
    for (const lista of porParlamentar.values()) lista.sort((a, b) => b.ano - a.ano)
    loja.definirSecao("emendas", porParlamentar, { vazio: [] })
    return { porMunicipio }
  })

  await loja.etapa("frentes", async () => {
    const { frentes, porParlamentar } = await levantarFrentes()
    const catalogo = porChave(frentes, (frente) => String(frente.id))
    const secoes = new Map<string, SecoesParlamentar["frentes"]>()
    for (const [id, participacoes] of Object.entries(porParlamentar)) {
      secoes.set(
        parlamentarKey({ casa: "camara", id }),
        participacoes
          .flatMap((participacao) => {
            const frente = catalogo.get(String(participacao.id))
            return frente ? [{ ...frente, papel: participacao.papel ?? null }] : []
          })
          .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR")),
      )
    }
    loja.definirSecao("frentes", secoes, { vazio: [], casa: "camara" })
  })

  if (despesasCamara && (despesasSenado || senadores.length === 0)) {
    await loja.etapa("sancoes", async () => {
      const { parlamentares: comSancao } = await levantarSancoes(
        despesasCamara.lancamentos,
        despesasSenado?.lancamentos ?? [],
      )
      loja.definirSecao(
        "sancoes",
        new Map(comSancao.map((item) => [parlamentarKey(item), item.fornecedores])),
        { vazio: [] },
      )
    })
  } else {
    pularEtapa("sancoes", "depende das despesas do dia")
  }

  // ── detalhe por parlamentar ──────────────────────────────────────────

  for (const [casa, daCasa] of [
    ["camara", despesasCamara],
    ["senado", despesasSenado],
  ] as const) {
    if (!daCasa) {
      pularEtapa(`fornecedores-${casa}`, "depende das despesas do dia")
      continue
    }
    await loja.etapa(`fornecedores-${casa}`, async () => {
      loja.definirSecao("fornecedores", detalharFornecedores(casa, ano, daCasa.lancamentos), {
        vazio: null,
        casa,
      })
    })
  }

  // Mesmas nominais de `votacao/` e dos agregados: a afinidade nunca cita
  // votação que o app não tem.
  if (votacoes) {
    await loja.etapa("afinidade", async () => {
      loja.definirSecao(
        "afinidade",
        new Map([
          ...calcularAfinidade("camara", ano, votacoes.nominais.camara),
          ...calcularAfinidade("senado", ano, votacoes.nominais.senado),
        ]),
        { vazio: null },
      )
    })
  } else {
    pularEtapa("afinidade", "depende das votações do dia")
  }

  // Etapas caras (centenas de requisições por parlamentar ou GBs do TSE) e de
  // dado que muda devagar: cada uma no seu dia, para o job diário não
  // estourar. Fora do dia, roda para recuperar seção que falta em mais de 10%
  // dos shards (primeira execução, virada do ano) — uma por execução, para a
  // primeira de todas não somar as quatro e passar do timeout.
  const hoje = new Date(geradoEm)
  const diaDaSemana = hoje.getUTCDay()
  const legislatura = inicioDaLegislatura(hoje)
  let recuperacaoUsada = false
  const naoRodaramHoje: string[] = []
  const ehDiaDe = (nome: string, secoes: NomeSecao[], dia: boolean, refs = parlamentares) => {
    if (config.completo || dia) return true
    const cobertura = Math.min(...secoes.map((secao) => loja.coberturaDaSecao(secao, refs, ano)))
    if (cobertura < 0.9 && !recuperacaoUsada) {
      recuperacaoUsada = true
      log(`etapa "${nome}" fora do dia para recuperar seção (em ${(cobertura * 100).toFixed(0)}% dos shards)`)
      return true
    }
    log(`etapa "${nome}" não é de hoje (seção em ${(cobertura * 100).toFixed(0)}% dos shards)`)
    naoRodaramHoje.push(nome)
    return false
  }

  if (ehDiaDe("producao", ["producao"], diaDaSemana === 1)) {
    await loja.etapa("producao", async () => {
      loja.definirSecao("producao", await levantarProducao(ano, legislatura, deputados, senadores), {
        vazio: {
          desde: legislatura,
          porTipo: [],
          projetos: { autor: 0, coautor: 0 },
          viraramNorma: [],
          aprovadasNaCasa: [],
        },
      })
    })
  }

  if (ehDiaDe("presenca", ["presenca"], diaDaSemana === 2, deputados)) {
    await loja.etapa("presenca", async () => {
      loja.definirSecao("presenca", await levantarPresenca(ano, deputados, hoje.getUTCMonth() > 0), {
        vazio: null,
        casa: "camara",
      })
    })
  }

  if (ehDiaDe("historico", ["historico"], diaDaSemana === 3)) {
    await loja.etapa("historico", async () => {
      loja.definirSecao(
        "historico",
        await levantarHistorico(deputados, senadores, geradoEm.slice(0, 10)),
        { vazio: { filiacoes: [], afastamentos: [], suplentes: [] } },
      )
    })
  }

  // Primeiro domingo do mês. O resultado de 2026 ainda muda até a
  // diplomação; para forçar antes, dispare o workflow com "completo".
  if (ehDiaDe("eleicoes", ["eleicoes", "territorio"], diaDaSemana === 0 && hoje.getUTCDate() <= 7)) {
    if (!despesasCamara) {
      // Sem o CPF da cota o vínculo cairia para nome + UF e trocaria o
      // histórico bom de quem tem nome de urna diferente por vazio.
      pularEtapa("eleicoes", "depende da cota do dia (CPF para o vínculo com o TSE)")
    } else {
      await loja.etapa("eleicoes", async () => {
        const cpfs = new Map<string, string>()
        for (const lancamento of despesasCamara.lancamentos) {
          if (lancamento.cpfParlamentar) cpfs.set(lancamento.parlamentarId, lancamento.cpfParlamentar)
        }
        const { eleicoes, territorio } = await levantarEleicoes({
          parlamentares,
          cpfs,
          ano,
          legislatura,
          emendasPorMunicipio: emendas?.porMunicipio ?? null,
        })
        loja.definirSecao("eleicoes", eleicoes, { vazio: [] })
        // Sem as emendas de hoje o território fica como estava, em vez de
        // publicar "nenhuma emenda nos redutos".
        if (territorio) loja.definirSecao("territorio", territorio, { vazio: null })
        else log("eleicoes: território não recalculado (emendas falharam hoje)")
      })
    }
  }

  // ── índice e benchmarks: sempre regenerados, com recuo campo a campo ──

  const indice = await loja.etapa("indice", async () => {
    const montado = montarIndice({
      parlamentares,
      anterior,
      resumos: {
        camara: despesasCamara?.resumos ?? null,
        senado: despesasSenado?.resumos ?? (senadores.length === 0 ? [] : null),
      },
      participacao: votacoes
        ? { camara: votacoes.participacaoCamara, senado: votacoes.participacaoSenado }
        : null,
    })
    await loja.escreverArquivo("parlamentares", { geradoEm, ano, parlamentares: montado }, indiceSchema)

    const benchmarksAnteriores = await loja.lerValidado("benchmarks", benchmarksSchema)
    const nominaisAnteriores = (casa: Casa) =>
      benchmarksAnteriores?.casas.find((benchmark) => benchmark.casa === casa && benchmark.ano === ano)
        ?.votacoesNominais ?? 0
    const casas: Benchmark[] = [
      calcularBenchmark("camara", ano, montado, votacoes?.nominaisCamara ?? nominaisAnteriores("camara")),
      calcularBenchmark("senado", ano, montado, votacoes?.nominaisSenado ?? nominaisAnteriores("senado")),
    ].filter((benchmark) => benchmark.gastos.geral.amostra > 0)
    await loja.escreverArquivo("benchmarks", { geradoEm, casas }, benchmarksSchema)
    return montado
  })

  if (indice) {
    await loja.etapa("partidos", async () => {
      const partidos = await levantarPartidos(ano, indice)
      await loja.escreverArquivo("partidos", { geradoEm, ano, partidos }, partidosEstaticosSchema)
    })
  } else {
    pularEtapa("partidos", "depende do índice")
  }

  await loja.gravarShards(parlamentares, ano, geradoEm)
  await loja.gravarManifest(geradoEm, ano, registrosDeEtapas(), {
    completa: true,
    // Etapas com cadência que não eram de hoje continuam com o registro do
    // último dia em que rodaram (inclusive falha), em vez de sumir do manifest.
    manter: [...ETAPAS_DO_JOB_DE_PERFIS, ...naoRodaramHoje],
  })
  await gravarStatus()

  log(
    `concluído: ${parlamentares.length} parlamentares (${deputados.length} deputados, ${senadores.length} senadores), ${votacoes?.feed.length ?? "?"} votações no feed, ${votacoes?.detalhes.length ?? "?"} votações detalhadas`,
  )
}

/**
 * Carimbo determinístico do conjunto de votações do feed: muda quando entra ou
 * sai uma votação, e não muda à toa entre execuções iguais (não reescreve os
 * 594 shards sem motivo).
 */
const conjuntoDe = (votacoes: { casa: string; id: string }[]) => {
  let hash = 5381
  for (const caracter of votacoes.map(({ casa, id }) => `${casa}:${id}`).join("|")) {
    hash = ((hash * 33) ^ caracter.charCodeAt(0)) >>> 0
  }
  return hash.toString(36)
}

type Participacao = { participadas: number; percentual: number }

/**
 * Gasto e participação vêm de etapas diferentes. Se uma delas falhou, o campo
 * dela fica com o valor de ontem (mesmo ano) em vez de virar zero — zero
 * seria publicado como "não gastou nada" ou "não votou".
 */
const montarIndice = ({
  parlamentares,
  anterior,
  resumos,
  participacao,
}: {
  parlamentares: Parlamentar[]
  anterior: Indice | null
  resumos: Record<Casa, ResumoDespesas[] | null>
  participacao: Record<Casa, Map<string, Participacao>> | null
}): IndiceParlamentar[] => {
  const deOntem = porChave(anterior?.parlamentares ?? [], parlamentarKey)
  const gastos = {
    camara: resumos.camara && porChave(resumos.camara, parlamentarKey),
    senado: resumos.senado && porChave(resumos.senado, parlamentarKey),
  }

  return parlamentares.map((parlamentar) => {
    const chave = parlamentarKey(parlamentar)
    const ontem = deOntem.get(chave)
    const gastosDaCasa = gastos[parlamentar.casa]
    const participou = participacao?.[parlamentar.casa].get(parlamentar.id)

    return {
      ...parlamentar,
      gastoAno: gastosDaCasa ? (gastosDaCasa.get(chave)?.total ?? 0) : (ontem?.gastoAno ?? null),
      participacaoPercentual: participacao
        ? (participou?.percentual ?? null)
        : (ontem?.participacaoPercentual ?? null),
      votacoesParticipadas: participacao
        ? (participou?.participadas ?? null)
        : (ontem?.votacoesParticipadas ?? null),
    }
  })
}

executar().catch((erro: unknown) => {
  log(`pipeline falhou: ${erro instanceof Error ? (erro.stack ?? erro.message) : String(erro)}`)
  process.exitCode = 1
})
