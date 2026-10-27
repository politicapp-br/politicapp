import {
  agregadosEstaticosSchema,
  benchmarksSchema,
  caminhoParlamentar,
  caminhoVotacao,
  feedEstaticoSchema,
  indiceSchema,
  partidosEstaticosSchema,
  remuneracaoEstaticaSchema,
  secoesValidas,
  shardParlamentarEnvelopeSchema,
  votacaoEstaticaSchema,
  votacoesEstaticasSchema,
  type AgregadosEstaticos,
  type Benchmarks,
  type Casa,
  type FeedEstatico,
  type Indice,
  type ParlamentarRef,
  type PartidosEstaticos,
  type RemuneracaoEstatica,
  type SecoesParlamentar,
  type VotacaoEstatica,
  type VotacoesEstaticas,
} from "@politicapp/data"
import * as Sentry from "@sentry/react-native"

import { ApiError, fetchJson } from "./http"

const BASE_URL =
  process.env.EXPO_PUBLIC_DADOS_URL ??
  "https://politicapp-br.github.io/politicapp"

const dataUrl = (path: string) => `${BASE_URL}/${path}.json`

/** Item de coleção que o pipeline não gerou (ainda) é 404 — não é erro. */
const nullIfNotFound = async <T>(request: Promise<T>): Promise<T | null> => {
  try {
    return await request
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export const fetchParlamentarIndex = (): Promise<Indice> =>
  fetchJson(dataUrl("parlamentares"), indiceSchema, { source: "estatico/parlamentares" })

export const fetchBenchmarks = (): Promise<Benchmarks> =>
  fetchJson(dataUrl("benchmarks"), benchmarksSchema, { source: "estatico/benchmarks" })

export const fetchStaticVotacoes = (): Promise<VotacoesEstaticas> =>
  fetchJson(dataUrl("votacoes"), votacoesEstaticasSchema, { source: "estatico/votacoes" })

export const fetchCompensation = (): Promise<RemuneracaoEstatica> =>
  fetchJson(dataUrl("remuneracao"), remuneracaoEstaticaSchema, { source: "estatico/remuneracao" })

export const fetchFeed = (): Promise<FeedEstatico> =>
  fetchJson(dataUrl("feed"), feedEstaticoSchema, { source: "estatico/feed" })

export const fetchAggregates = (): Promise<AgregadosEstaticos> =>
  fetchJson(dataUrl("agregados"), agregadosEstaticosSchema, { source: "estatico/agregados" })

export const fetchParties = (): Promise<PartidosEstaticos> =>
  fetchJson(dataUrl("partidos"), partidosEstaticosSchema, { source: "estatico/partidos" })

export type ParlamentarShard = { ano: number } & Partial<SecoesParlamentar>

/**
 * Tudo que o pipeline calcula sobre um parlamentar, num arquivo. O envelope é
 * frouxo e cada seção é validada sozinha: seção quebrada vira ausente (e vai
 * para o Sentry) em vez de derrubar a tela inteira. Parlamentar sem shard
 * (recém-empossado, antes do próximo ETL) devolve null.
 */
export const fetchParlamentarShard = async (
  ref: ParlamentarRef,
): Promise<ParlamentarShard | null> => {
  const source = "estatico/parlamentar"
  const envelope = await nullIfNotFound(
    fetchJson(dataUrl(caminhoParlamentar(ref)), shardParlamentarEnvelopeSchema, { source }),
  )
  if (!envelope) return null

  const { secoes, invalidas } = secoesValidas(envelope)
  if (invalidas.length > 0) {
    Sentry.captureMessage(`${source}: seções fora do contrato`, {
      tags: { source, contract: "broken" },
      extra: { ref, invalidas },
    })
  }
  return { ano: envelope.ano, ...secoes }
}

/** Votação nominal pré-computada; null se não está na coleção (cai para a API ao vivo). */
export const fetchStaticVotacao = (casa: Casa, id: string): Promise<VotacaoEstatica | null> =>
  nullIfNotFound(
    fetchJson(dataUrl(caminhoVotacao(casa, id)), votacaoEstaticaSchema, {
      source: "estatico/votacao",
    }),
  )
