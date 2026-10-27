import type { Casa, NomeSecao, ParlamentarRef } from "@politicapp/data"
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import {
  fetchAggregates,
  fetchBenchmarks,
  fetchCompensation,
  fetchParlamentarIndex,
  fetchParlamentarShard,
  fetchParties,
} from "@/services/api/static-data"
import { DURATION, queryKeys } from "@/services/api/query-keys"

export const useParlamentarIndex = () =>
  useQuery({
    queryKey: queryKeys.static.index,
    queryFn: fetchParlamentarIndex,
    staleTime: DURATION.hour * 6,
  })

export const useBenchmarks = () =>
  useQuery({
    queryKey: queryKeys.static.benchmarks,
    queryFn: fetchBenchmarks,
    staleTime: DURATION.day,
  })

/** O subsídio muda por lei, não por dia — vale cachear por um dia inteiro. */
export const useCompensation = () =>
  useQuery({
    queryKey: queryKeys.static.compensation,
    queryFn: fetchCompensation,
    staleTime: DURATION.day,
  })

export const useAggregates = () =>
  useQuery({
    queryKey: queryKeys.static.aggregates,
    queryFn: fetchAggregates,
    staleTime: DURATION.hour * 6,
  })

export const useCasaAggregates = (casa: Casa) => {
  const { data, ...rest } = useAggregates()

  const aggregate = useMemo(
    () => data?.casas.find((item) => item.casa === casa),
    [data, casa],
  )

  return { ...rest, year: data?.ano, data: aggregate }
}

/**
 * Tudo que o pipeline calcula sobre um parlamentar vem num arquivo só
 * (`parlamentar/{casa}/{id}.json`). Os hooks de seção abaixo compartilham
 * esta query: a tela do parlamentar faz um download, não um por seção.
 */
export const useParlamentarShard = (ref: ParlamentarRef | null) =>
  useQuery({
    queryKey: ref ? queryKeys.static.parlamentar(ref) : queryKeys.static.noParlamentar,
    queryFn: () => (ref ? fetchParlamentarShard(ref) : null),
    enabled: ref !== null,
    staleTime: DURATION.hour * 6,
    // Quem navega por muitos perfis não deve acumular shards no MMKV.
    gcTime: DURATION.day * 3,
  })

/**
 * Seção ausente (não calculada ou inválida) e seção nula (calculada, sem
 * dado) chegam ambas como `undefined` — as telas já tratam "sem dado" assim.
 */
const useShardSection = <K extends NomeSecao>(ref: ParlamentarRef | null, name: K) => {
  const { data, ...rest } = useParlamentarShard(ref)
  return { ...rest, year: data?.ano, data: data?.[name] ?? undefined }
}

/** Alinhamento de um parlamentar com o próprio partido nas nominais do ano. */
export const useParlamentarAlignment = (ref: ParlamentarRef | null) =>
  useShardSection(ref, "alinhamento")

/** Custo acumulado do mandato de um parlamentar, ano a ano. */
export const useParlamentarTerm = (ref: ParlamentarRef | null) =>
  useShardSection(ref, "mandato")

export const useParlamentarCost = (ref: ParlamentarRef | null) => {
  const compensation = useCompensation()
  const { data, ...rest } = useShardSection(ref, "custo")

  return {
    ...rest,
    salary: compensation.data?.subsidio,
    year: compensation.data?.ano,
    data,
  }
}

export const useIndexedParlamentar = (ref: ParlamentarRef | null) => {
  const { data, ...rest } = useParlamentarIndex()

  const parlamentar = useMemo(() => {
    if (!ref || !data) return undefined
    return data.parlamentares.find(
      (item) => item.casa === ref.casa && item.id === ref.id,
    )
  }, [data, ref])

  return { ...rest, data: parlamentar }
}

export const useCasaBenchmark = (casa: Casa) => {
  const { data, ...rest } = useBenchmarks()

  const benchmark = useMemo(
    () => data?.casas.find((item) => item.casa === casa),
    [data, casa],
  )

  return { ...rest, data: benchmark }
}

/** Resumos de emendas de um parlamentar, do ano mais recente para o mais antigo. */
export const useParlamentarEmendas = (ref: ParlamentarRef | null) => {
  const { data, ...rest } = useShardSection(ref, "emendas")
  return { ...rest, data: data && data.length > 0 ? data : undefined }
}

/** Frentes de um deputado com título e papel resolvidos, em ordem alfabética. */
export const useParlamentarFrentes = (ref: ParlamentarRef | null) =>
  useShardSection(ref?.casa === "camara" ? ref : null, "frentes")

/** Fornecedores da cota deste parlamentar que estão hoje no CEIS. */
export const useParlamentarSanctions = (ref: ParlamentarRef | null) =>
  useShardSection(ref, "sancoes")

/** Para quem foi a cota do ano: maiores fornecedores, glosa e maiores notas. */
export const useParlamentarCotaSuppliers = (ref: ParlamentarRef | null) =>
  useShardSection(ref, "fornecedores")

/** Colegas que votam igual, votos contra o partido e votações apertadas. */
export const useParlamentarAffinity = (ref: ParlamentarRef | null) =>
  useShardSection(ref, "afinidade")

/** Proposições apresentadas na legislatura e as que viraram norma. */
export const useParlamentarLegislativeOutput = (ref: ParlamentarRef | null) =>
  useShardSection(ref, "producao")

/** Frequência oficial em plenário e comissões — só a Câmara publica. */
export const useParlamentarOfficialAttendance = (ref: ParlamentarRef | null) =>
  useShardSection(ref?.casa === "camara" ? ref : null, "presenca")

/** Partidos, licenças e, no Senado, suplentes. */
export const useParlamentarTermHistory = (ref: ParlamentarRef | null) =>
  useShardSection(ref, "historico")

/** Candidaturas no TSE, mais recente primeiro. */
export const useParlamentarElections = (ref: ParlamentarRef | null) =>
  useShardSection(ref, "eleicoes")

/** Onde foi votado na eleição do mandato e emendas para esses municípios. */
export const useParlamentarElectoralTerritory = (ref: ParlamentarRef | null) =>
  useShardSection(ref, "territorio")

export const useParties = () =>
  useQuery({
    queryKey: queryKeys.static.parties,
    queryFn: fetchParties,
    staleTime: DURATION.day,
  })

const normalizePartySigla = (sigla: string) =>
  sigla.trim().toLocaleUpperCase("pt-BR").replace(/\s+/g, "")

export const useParty = (sigla: string | null) => {
  const { data, ...rest } = useParties()

  const party = useMemo(() => {
    if (!sigla || !data) return undefined
    const key = normalizePartySigla(sigla)
    return data.partidos.find((item) => normalizePartySigla(item.sigla) === key)
  }, [data, sigla])

  return { ...rest, year: data?.ano, data: party }
}

export const usePartyMembers = (sigla: string | null) => {
  const { data, ...rest } = useParlamentarIndex()

  const members = useMemo(() => {
    if (!sigla || !data) return []
    const key = normalizePartySigla(sigla)
    return data.parlamentares
      .filter((item) => normalizePartySigla(item.partido) === key)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
  }, [data, sigla])

  return { ...rest, data: members }
}

export const useExpenseSummary = (ref: ParlamentarRef | null) =>
  useShardSection(ref, "despesas")
