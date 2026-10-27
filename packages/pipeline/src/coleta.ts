import type {
  Congresso,
  CustoParlamentar,
  EventoNorma,
  EventoTramitacao,
  FinancasPartido,
  IndiceParlamentar,
  Orientacao,
  Parlamentar,
  Subsidio,
  Votacao,
} from "@politicapp/data"
import { ladoDaOrientacao, ladoDoGoverno } from "@politicapp/data"

import { log } from "./config"
import { emLotes, tolerar, vazioSe404 } from "./http"
import { janelaPassada } from "./periodo"
import {
  buscarProposicaoDaVotacao,
  buscarStatusProposicao,
  listarFrentes,
  listarLideresDoPartido,
  listarMembrosDaFrente,
  listarOrientacoesCamara,
  listarPartidos,
  listarProposicoesTramitadas,
  listarVotacoesCamara,
  listarVotosCamara,
  type FrenteApi,
  type LancamentoDespesa,
} from "./sources/camara"
import { listarMateriasDou } from "./sources/dou"
import { listarVotacoesSenado, senadorParticipou } from "./sources/senado"
import { baixarCeis, baixarEmendas } from "./sources/transparencia"
import { baixarReceitasPartidarias, urlReceitasPartidarias } from "./sources/tse"
import {
  baixarFolhaCamara,
  baixarMoradiaCamara,
  baixarOrcamentoSenado,
  baixarRecursosSenado,
  FONTE_ORCAMENTO_SENADO,
  type RecursosDoSenador,
} from "./sources/remuneracao"
import { calcularAgregados } from "./tasks/agregados"
import { emendasPorMunicipio, resumirEmendas } from "./tasks/emendas"
import {
  montarFeed,
  montarVotosDoFeed,
  simbolicasDaCamara,
  simbolicasDoSenado,
  votacaoDaCamara,
  votacaoDoSenado,
  votacaoSimbolicaDaCamara,
  votoDaCamara,
  votoDoSenado,
} from "./tasks/feed"
import { montarFrentes, type FrenteComMembros } from "./tasks/frentes"
import { nominaisDaCamara, nominaisDoSenado } from "./tasks/nominais"
import { montarNormas, normaDaMateria } from "./tasks/normas"
import {
  agregarReceitasPartidarias,
  lideresVigentes,
  montarPartidos,
} from "./tasks/partidos"
import { cruzarSancoes, sancoesVigentes } from "./tasks/sancoes"
import { calcularParticipacao, type RegistroVoto } from "./tasks/participacao"
import { tramitacoesComMarco } from "./tasks/tramitacoes"

/**
 * Coleta de cada fonte, uma função por etapa do pipeline. Aqui falha de fonte
 * vira exceção (nunca lista vazia): quem decide o que fazer com ela é a
 * etapa em `main.ts`, que mantém o dado anterior publicado.
 */

const VOTOS_PRESENTES_CAMARA = new Set(["Sim", "Não", "Abstenção", "Obstrução"])

/**
 * O CEIS só publica o snapshot do dia; o cruzamento vale para a data da
 * execução — sanção que vencer amanhã sai na próxima rodada.
 */
export const levantarSancoes = async (
  despesasCamara: LancamentoDespesa[],
  despesasSenado: LancamentoDespesa[],
) => {
  const linhas = await baixarCeis()
  const hoje = new Date().toISOString().slice(0, 10)
  const vigentes = sancoesVigentes(linhas, hoje)
  log(`ceis: ${vigentes.size} CNPJs/CPFs com sanção vigente`)

  const cruzado = cruzarSancoes(
    [
      { casa: "camara", lancamentos: despesasCamara },
      { casa: "senado", lancamentos: despesasSenado },
    ],
    vigentes,
  )
  log(
    `ceis: ${cruzado.parlamentares.length} parlamentares com gasto em fornecedor sancionado`,
  )
  return cruzado
}

export const levantarPartidos = async (
  ano: number,
  parlamentares: IndiceParlamentar[],
) => {
  const catalogo = await listarPartidos()

  const comLideres = await emLotes(catalogo, async (partido) => ({
    ...partido,
    lideres: lideresVigentes(
      await listarLideresDoPartido(partido.id).catch(vazioSe404([])),
    ),
  }))

  // Sem as finanças a etapa falha: publicar partidos sem elas apagaria as de
  // ontem do app.
  const financas: Map<string, FinancasPartido> = agregarReceitasPartidarias(
    await baixarReceitasPartidarias(ano),
    ano,
    urlReceitasPartidarias(ano),
  )

  const montados = montarPartidos(comLideres, parlamentares, financas)
  log(
    `partidos: ${montados.length} montados, ${montados.filter((partido) => partido.financas).length} com finanças do TSE`,
  )
  return montados
}

export const levantarEmendas = async (parlamentares: Parlamentar[]) => {
  const linhas = await baixarEmendas()
  const { resumos, autoresSemCorrespondencia } = resumirEmendas(linhas, parlamentares)

  if (autoresSemCorrespondencia.length > 0) {
    log(
      `transparência: ${autoresSemCorrespondencia.length} autores de emendas sem parlamentar em exercício (ex-parlamentares, bancadas e comissões)`,
    )
  }
  log(`transparência: ${resumos.length} resumos de emendas por parlamentar × ano`)

  // Sem o corte dos maiores locais do resumo: o território eleitoral cruza
  // os votos com todos os municípios que receberam emenda.
  return { resumos, porMunicipio: emendasPorMunicipio(linhas, parlamentares) }
}

/**
 * São centenas de frentes e o recurso de membros é um por frente — a etapa
 * leva minutos e por isso só roda no job diário. Frente cujos membros
 * falharem entra no catálogo vazia em vez de derrubar as demais.
 */
export const levantarFrentes = async () => {
  const frentes = await listarFrentes()

  let semMembros = 0
  const comMembros = await emLotes<FrenteApi, FrenteComMembros>(
    frentes,
    async (frente) => ({
      ...frente,
      membros: await listarMembrosDaFrente(frente.id).catch(vazioSe404([], () => (semMembros += 1))),
    }),
  )
  if (semMembros > 0) log(`câmara: ${semMembros} frentes sem recurso de membros (404)`)

  const montado = montarFrentes(comMembros)
  log(
    `câmara: ${montado.frentes.length} frentes, ${Object.keys(montado.porParlamentar).length} deputados em alguma frente`,
  )
  return montado
}

/**
 * O subsídio é o mesmo para os 594, então basta um número por casa. O que
 * varia por pessoa — moradia e tamanho do gabinete — vem de fontes distintas
 * e frágeis; se uma delas falhar, a etapa inteira falha e o dado de ontem
 * continua publicado.
 */
export const levantarRemuneracao = async (
  ano: number,
  deputados: Parlamentar[],
  senadores: Parlamentar[],
): Promise<{
  subsidio: Subsidio
  custos: CustoParlamentar[]
  congresso: Congresso
}> => {
  const folhaApurada = await baixarFolhaCamara(ano)

  // Moradia e recursos viram seção do shard: falha aqui precisa derrubar a
  // etapa, senão "fonte fora do ar" seria publicado como "sem registro". O
  // orçamento do Senado é só um campo do arquivo global e pode faltar.
  const [moradiaCamara, recursosSenado, orcamentoSenado] = await Promise.all([
    baixarMoradiaCamara(ano, deputados),
    senadores.length > 0
      ? baixarRecursosSenado(ano, senadores)
      : Promise.resolve(new Map<string, RecursosDoSenador>()),
    tolerar("senado: orçamento", baixarOrcamentoSenado(), null),
  ])

  const custos: CustoParlamentar[] = [
    ...deputados.flatMap<CustoParlamentar>((deputado) => {
      const moradia = moradiaCamara.get(deputado.id)
      if (!moradia) return []
      return [
        {
          casa: "camara",
          id: deputado.id,
          ano,
          moradia,
          assessores: null,
          diarias: null,
        },
      ]
    }),
    ...senadores.flatMap<CustoParlamentar>((senador) => {
      const recursos = recursosSenado.get(senador.id)
      if (!recursos) return []
      return [
        {
          casa: "senado",
          id: senador.id,
          ano,
          moradia: recursos.moradia,
          assessores: recursos.assessores,
          diarias: recursos.diarias,
        },
      ]
    }),
  ]

  return {
    subsidio: folhaApurada.subsidio,
    custos,
    congresso: {
      folhaCamara: folhaApurada.folha,
      orcamentoSenado: orcamentoSenado
        ? { serie: orcamentoSenado, fonteUrl: FONTE_ORCAMENTO_SENADO }
        : null,
    },
  }
}

export const medirParticipacao = async (ano: number) => {
  const votacoes = await listarVotacoesCamara(ano)

  // 404 no recurso de votos é normal (dezenas por ano); qualquer outra falha
  // derruba a etapa — votação sem votos por falha viraria "simbólica" e
  // sumiria da participação de todo mundo.
  let falhasDeVotos = 0
  const comVotos = await emLotes(votacoes, async (votacao) => ({
    votacao,
    votos: await listarVotosCamara(votacao.id).catch(vazioSe404([], () => (falhasDeVotos += 1))),
  }))

  const registrosCamara = comVotos.map(({ votos }) =>
    votos.map<RegistroVoto>((voto) => ({
      parlamentarId: String(voto.deputado_.id),
      votou: VOTOS_PRESENTES_CAMARA.has(voto.tipoVoto?.trim() ?? ""),
    })),
  )

  const nominaisCamara = registrosCamara.filter((registro) => registro.length > 0)
  log(
    `câmara: ${nominaisCamara.length} votações nominais com votos individuais (${falhasDeVotos} sem recurso de votos)`,
  )

  const votacoesSenado = await listarVotacoesSenado(ano)
  const nominaisSenado = votacoesSenado
    .map((votacao) =>
      votacao.votos.map<RegistroVoto>((voto) => ({
        parlamentarId: String(voto.codigoParlamentar),
        votou: senadorParticipou(voto.siglaVotoParlamentar),
      })),
    )
    .filter((registro) => registro.length > 0)
  log(`senado: ${nominaisSenado.length} votações com votos individuais`)

  // A orientação do governo transforma agregados em "governismo" sem o app
  // rotular ninguém. Só as nominais têm orientação que valha a requisição.
  const nominaisComVotos = comVotos.filter(({ votos }) => votos.length > 0)
  let falhasDeOrientacoes = 0
  const orientacoes = await emLotes(nominaisComVotos, async ({ votacao }) => {
    const liderancas = await listarOrientacoesCamara(votacao.id).catch(
      vazioSe404([], () => (falhasDeOrientacoes += 1)),
    )
    return [
      votacao.id,
      liderancas.flatMap<Orientacao>((orientacao) => {
        const bancada = orientacao.siglaPartidoBloco?.trim()
        if (!bancada) return []
        return [{ bancada, lado: ladoDaOrientacao(orientacao.orientacaoVoto) }]
      }),
    ] as const
  })
  if (falhasDeOrientacoes > 0) {
    log(`câmara: ${falhasDeOrientacoes} votações sem recurso de orientações (404)`)
  }
  const orientacoesPorVotacao = new Map(orientacoes)
  const governoPorVotacao = new Map(
    orientacoes.map(([id, lista]) => [id, ladoDoGoverno(lista)] as const),
  )

  const agregados = [
    calcularAgregados(
      "camara",
      comVotos.map(({ votacao, votos }) => ({
        votos: votos.map(votoDaCamara),
        governo: governoPorVotacao.get(votacao.id) ?? null,
      })),
    ),
    // Em votação secreta todo voto vem "Votou": conta como presença, mas não
    // diz o lado — entraria nos agregados como se todos tivessem votado sim.
    calcularAgregados(
      "senado",
      votacoesSenado
        .filter((votacao) => votacao.votacaoSecreta?.toUpperCase() !== "S")
        .map((votacao) => ({ votos: votacao.votos.map(votoDoSenado) })),
    ),
  ].filter((agregado) => agregado.votacoesConsideradas > 0)

  const feed = montarFeed(comVotos, votacoesSenado)

  return {
    participacaoCamara: calcularParticipacao(nominaisCamara),
    participacaoSenado: calcularParticipacao(nominaisSenado),
    nominaisCamara: nominaisCamara.length,
    nominaisSenado: nominaisSenado.length,
    feed,
    votosDoFeed: montarVotosDoFeed(feed, comVotos, votacoesSenado),
    simbolicas: [
      ...simbolicasDaCamara(comVotos).map(votacaoSimbolicaDaCamara),
      ...simbolicasDoSenado(votacoesSenado),
    ],
    agregados,
    // Base da afinidade: as mesmas nominais dos agregados e de `votacao/`.
    nominais: {
      camara: nominaisDaCamara(comVotos, governoPorVotacao),
      senado: nominaisDoSenado(votacoesSenado),
    },
    detalhes: [
      ...nominaisComVotos.map((comVoto) => ({
        ...votacaoDaCamara(comVoto),
        votos: comVoto.votos.map(votoDaCamara),
        orientacoes: orientacoesPorVotacao.get(comVoto.votacao.id) ?? [],
      })),
      ...votacoesSenado
        .filter((votacao) => votacao.votos.length > 0)
        .map((votacao) => ({
          ...votacaoDoSenado(votacao),
          votos: votacao.votos.map(votoDoSenado),
          orientacoes: [],
        })),
    ],
  }
}

const DIAS_DE_NORMAS = 5

/**
 * Leis, MPs e decretos publicados no DOU nos últimos dias. Cada dia é uma
 * página; dia sem edição (fim de semana, feriado) vem vazio e não é erro.
 */
export const levantarNormas = async (): Promise<EventoNorma[]> => {
  const janela = janelaPassada(DIAS_DE_NORMAS)

  const dias: string[] = []
  for (
    let dia = new Date(`${janela.inicio}T12:00:00Z`);
    dia.toISOString().slice(0, 10) <= janela.fim;
    dia.setUTCDate(dia.getUTCDate() + 1)
  ) {
    dias.push(dia.toISOString().slice(0, 10))
  }

  // Dia sem edição vem vazio (não é erro); falha de rede ou de formato
  // derruba a etapa e o feed fica com as normas de ontem.
  const porDia = await emLotes(dias, async (dia) =>
    (await listarMateriasDou(dia)).flatMap((materia) => {
      const norma = normaDaMateria(materia, dia)
      return norma ? [norma] : []
    }),
  )

  const normas = montarNormas(porDia.flat())
  log(`dou: ${normas.length} normas no feed`)
  return normas
}

const DIAS_DE_TRAMITACAO = 7

/** Só o que pode virar lei — requerimento e afins não entram no feed. */
const SIGLAS_DE_TRAMITACAO = ["PL", "PLP", "PEC", "MPV", "PDL"]

/**
 * A listagem devolve todo mundo que tramitou na janela (milhares por semana),
 * mas só o detalhe diz em que situação cada proposição está. É a etapa mais
 * cara do feed — minutos, não segundos — e roda apenas no job diário.
 */
export const levantarTramitacoes = async (): Promise<EventoTramitacao[]> => {
  const janela = janelaPassada(DIAS_DE_TRAMITACAO)

  const proposicoes = await listarProposicoesTramitadas(
    janela.inicio,
    janela.fim,
    SIGLAS_DE_TRAMITACAO,
  )

  const comStatus = await emLotes(proposicoes, async (proposicao) => ({
    proposicao,
    status: await buscarStatusProposicao(proposicao.id).catch(() => null),
  }))

  const eventos = tramitacoesComMarco(comStatus, janela.inicio)
  log(`câmara: ${eventos.length} marcos de tramitação na janela`)
  return eventos
}

/**
 * O feed guarda poucas dezenas de votações, então dá para buscar a proposição
 * votada de cada uma — é o que diz ao leitor o que estava em jogo.
 */
export const enriquecerComProposicoes = async (feed: Votacao[]): Promise<Votacao[]> => {
  const daCamara = feed.filter((votacao) => votacao.casa === "camara")

  const proposicoes = await emLotes(daCamara, async (votacao) => {
    const proposicao = await buscarProposicaoDaVotacao(votacao.id).catch(() => null)
    return [votacao.id, proposicao] as const
  })

  const porId = new Map(proposicoes)

  return feed.map((votacao) =>
    votacao.casa === "camara"
      ? { ...votacao, proposicao: porId.get(votacao.id) ?? votacao.proposicao }
      : votacao,
  )
}
