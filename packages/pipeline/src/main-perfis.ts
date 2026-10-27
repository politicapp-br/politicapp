import {
  indiceSchema,
  JANELA_DISCURSOS_MESES,
  secoesParlamentarSchemas,
  type Casa,
  type NomeSecao,
  type ParlamentarRef,
} from "@politicapp/data"
import { createCamaraClient, createSenadoClient } from "@politicapp/sources"
import { subMonths } from "date-fns"

import { config, log } from "./config"
import { gravarStatus, registrarFalha, registrosDeEtapas } from "./etapas"
import { criarFetchJson, PrazoEsgotado } from "./fetch-json"
import { emLotes } from "./http"
import { Loja } from "./loja"
import { filaDeRenovacao } from "./tasks/perfis"

/**
 * Job de perfis: renova as seções que exigem várias requisições por
 * parlamentar (perfil, proposições, órgãos, discursos, trajetória). Roda com
 * orçamento de tempo, primeiro quem não tem a seção e depois quem foi
 * renovado há mais tempo, e grava o que conseguiu: se o tempo acabar, a
 * próxima execução continua de onde esta parou.
 */

type SecaoDePerfil = Extract<NomeSecao, "perfil" | "proposicoes" | "orgaos" | "discursos" | "trajetoria">

/** Proposições e trajetória só a Câmara publica. */
const SECOES: Record<Casa, readonly SecaoDePerfil[]> = {
  camara: ["perfil", "proposicoes", "orgaos", "discursos", "trajetoria"],
  senado: ["perfil", "orgaos", "discursos"],
}

const SECOES_SO_DA_CAMARA: ReadonlySet<SecaoDePerfil> = new Set(["proposicoes", "trajetoria"])

/**
 * Por casa e seção: acima disto a fonte está quebrada e o job acusa falha
 * (mesmo publicando o resto). Por casa porque os 81 senadores são só 14% do
 * total — um apagão do Senado nunca passaria de 20% no agregado.
 */
const FRACAO_MAXIMA_DE_FALHAS = 0.2
const MINIMO_DE_TENTATIVAS_PARA_ACUSAR = 5

/** Depois do orçamento, o que está em andamento ainda tem este tempo para terminar. */
const FOLGA_PARA_TERMINAR_MS = 5 * 60_000

const orcamentoMs = () => {
  const minutos = Number(process.env.PIPELINE_ORCAMENTO_MINUTOS?.trim() || 25)
  if (!Number.isFinite(minutos) || minutos <= 0) {
    throw new Error(`PIPELINE_ORCAMENTO_MINUTOS inválido: "${process.env.PIPELINE_ORCAMENTO_MINUTOS}"`)
  }
  return minutos * 60_000
}

type Clientes = {
  camara: ReturnType<typeof createCamaraClient>
  senado: ReturnType<typeof createSenadoClient>
}

/** Uma busca por seção; as seções são independentes e falham sozinhas. */
const buscasDe = (
  { casa, id }: ParlamentarRef,
  { camara, senado }: Clientes,
  agora: Date,
): [SecaoDePerfil, () => Promise<unknown>][] => {
  const inicio = subMonths(agora, JANELA_DISCURSOS_MESES)
  return casa === "camara"
    ? [
        ["perfil", () => camara.fetchDeputado(id)],
        ["proposicoes", () => camara.fetchDeputadoProposicoes(id)],
        ["orgaos", () => camara.fetchDeputadoCommittees(id)],
        ["discursos", () => camara.fetchDeputadoSpeeches(id, inicio, agora)],
        ["trajetoria", () => camara.fetchDeputadoCareer(id)],
      ]
    : [
        ["perfil", () => senado.fetchSenador(id)],
        ["orgaos", () => senado.fetchSenadorCommittees(id)],
        ["discursos", () => senado.fetchSenadorSpeeches(id, inicio, agora)],
      ]
}

const mensagemDe = (erro: unknown) => (erro instanceof Error ? erro.message : String(erro))

const executar = async () => {
  const agora = new Date()
  const geradoEm = agora.toISOString()
  const prazoParaComecar = Date.now() + orcamentoMs()
  const fetchJson = criarFetchJson({ prazo: prazoParaComecar + FOLGA_PARA_TERMINAR_MS })
  const clientes: Clientes = {
    camara: createCamaraClient(fetchJson),
    senado: createSenadoClient(fetchJson),
  }

  const loja = new Loja(config.saida)
  await loja.carregarShards()

  const indice = await loja.lerValidado("parlamentares", indiceSchema)
  if (!indice) throw new Error("parlamentares.json ausente — rode o pipeline diário primeiro")
  const parlamentares: ParlamentarRef[] = indice.parlamentares.map(({ casa, id }) => ({ casa, id }))

  const fila = filaDeRenovacao(parlamentares, SECOES, (ref, secao) => loja.renovadoEm(ref, secao))

  const resultado = await loja.etapa("perfis", async () => {
    const valores = new Map<SecaoDePerfil, Map<string, unknown>>()
    const sucessos = new Map<string, number>()
    const falhas = new Map<string, string[]>()
    let renovados = 0
    let interrompidos = 0

    await emLotes(fila, async (ref) => {
      if (Date.now() > prazoParaComecar) return
      let algumaSecao = false

      // Sequencial dentro do parlamentar (a concorrência fica entre eles): a
      // API da Câmara limita a taxa.
      for (const [secao, buscar] of buscasDe(ref, clientes, agora)) {
        const chave = `${ref.casa}/${secao}`
        try {
          const valor = await buscar()
          // Validado aqui, não só em definirSecao: um valor ruim perde esta
          // seção deste parlamentar, não a execução inteira.
          const analise = secoesParlamentarSchemas[secao].safeParse(valor)
          if (!analise.success) throw new Error(`fora do contrato: ${analise.error.issues[0]?.message}`)
          const mapa = valores.get(secao) ?? new Map<string, unknown>()
          mapa.set(`${ref.casa}:${ref.id}`, analise.data)
          valores.set(secao, mapa)
          sucessos.set(chave, (sucessos.get(chave) ?? 0) + 1)
          algumaSecao = true
        } catch (erro) {
          if (erro instanceof PrazoEsgotado) {
            interrompidos += 1
            break
          }
          falhas.set(chave, [...(falhas.get(chave) ?? []), `${ref.id}: ${mensagemDe(erro)}`])
        }
      }
      if (algumaSecao) renovados += 1
    })

    for (const [secao, mapa] of valores) {
      loja.definirSecao(secao, mapa as Map<string, never>, {
        parcial: true,
        ...(SECOES_SO_DA_CAMARA.has(secao) ? { casa: "camara" as const } : {}),
      })
    }

    const totalFalhas = [...falhas.values()].reduce((soma, lista) => soma + lista.length, 0)
    log(
      `perfis: ${renovados} parlamentares renovados, ${totalFalhas} seções com falha, ${interrompidos} interrompidos pelo prazo`,
    )
    for (const [chave, lista] of falhas) log(`perfis: ${chave} — ${lista.length} falhas (ex.: ${lista[0]})`)
    return { sucessos, falhas }
  })

  if (resultado) {
    const quebradas = [...resultado.sucessos].flatMap(([chave, deuCerto]) => {
      const falhas = resultado.falhas.get(chave) ?? []
      const total = deuCerto + falhas.length
      return total >= MINIMO_DE_TENTATIVAS_PARA_ACUSAR && falhas.length > total * FRACAO_MAXIMA_DE_FALHAS
        ? [`${chave}: ${falhas.length} de ${total} (ex.: ${falhas[0]})`]
        : []
    })
    // Seção que falhou para todo mundo não aparece em `sucessos`.
    for (const [chave, falhas] of resultado.falhas) {
      if (!resultado.sucessos.has(chave) && falhas.length >= MINIMO_DE_TENTATIVAS_PARA_ACUSAR) {
        quebradas.push(`${chave}: ${falhas.length} de ${falhas.length} (ex.: ${falhas[0]})`)
      }
    }
    if (quebradas.length > 0) registrarFalha("perfis", `fontes quebradas — ${quebradas.join(" | ")}`)
  }

  await loja.gravarShards(parlamentares, indice.ano, geradoEm)
  await loja.gravarManifest(geradoEm, indice.ano, registrosDeEtapas(), { completa: false })
  await gravarStatus()
}

executar().catch((erro: unknown) => {
  log(`job de perfis falhou: ${erro instanceof Error ? (erro.stack ?? erro.message) : String(erro)}`)
  process.exitCode = 1
})
