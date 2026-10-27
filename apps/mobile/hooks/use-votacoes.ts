import type {
  Casa,
  ParlamentarRef,
  TipoVoto,
  Votacao,
} from "@politicapp/data"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef } from "react"

import { useParlamentarShard } from "@/hooks/use-static-data"
import { fetchCamaraVotacao, fetchOrientacoes } from "@/services/api/camara"
import { DURATION, queryKeys } from "@/services/api/query-keys"
import { fetchSenadoVotacao } from "@/services/api/senado"
import {
  fetchStaticVotacao,
  fetchStaticVotacoes,
} from "@/services/api/static-data"

export type VotacaoVote = { votacao: Votacao; voto: TipoVoto }

/**
 * Como o parlamentar votou em cada votação nominal do feed: cruza
 * `votacoes.json` com a seção `votos` do shard dele. Os dois são cacheados
 * separadamente, então só são cruzados quando vêm da mesma execução
 * (`conjunto` igual) — aí votação sem entrada vira "ausente", porque a API só
 * lista quem registrou voto. Se os caches divergem, refaz os dois downloads
 * uma vez.
 */
export const useParlamentarVotes = (parlamentar: ParlamentarRef) => {
  const votacoes = useQuery({
    queryKey: queryKeys.static.votacoes,
    queryFn: fetchStaticVotacoes,
    staleTime: DURATION.hour * 6,
  })
  const shard = useParlamentarShard(parlamentar)

  const section = shard.data?.votos
  const mismatch =
    votacoes.data && section && section.conjunto !== votacoes.data.conjunto
      ? `${section.conjunto}|${votacoes.data.conjunto}`
      : null
  const lastRetry = useRef<string | null>(null)
  useEffect(() => {
    if (!mismatch || lastRetry.current === mismatch) return
    lastRetry.current = mismatch
    void votacoes.refetch()
    void shard.refetch()
  }, [mismatch, votacoes, shard])

  const data = useMemo(() => {
    if (!votacoes.data || !section || section.conjunto !== votacoes.data.conjunto) return undefined

    const voteByVotacao = new Map(section.votacoes.map((item) => [item.id, item.voto]))
    return votacoes.data.votacoes
      .filter((votacao) => votacao.casa === parlamentar.casa)
      .map<VotacaoVote>((votacao) => ({
        votacao,
        voto: voteByVotacao.get(votacao.id) ?? "ausente",
      }))
  }, [votacoes.data, section, parlamentar.casa])

  return {
    data,
    isPending: votacoes.isPending || shard.isPending,
    isError: votacoes.isError || shard.isError,
  }
}

/**
 * Votações nominais do ano vêm prontas do pipeline (com votos e
 * orientações); as demais — simbólicas, anos anteriores — caem para a API ao
 * vivo. As duas hooks abaixo compartilham o mesmo cache estático.
 */
const useStaticVotacao = (casa: Casa, id: string) =>
  useQuery({
    queryKey: queryKeys.static.votacao(casa, id),
    queryFn: () => fetchStaticVotacao(casa, id),
    staleTime: DURATION.hour * 6,
  })

/** Só cai para a API ao vivo quando o estático respondeu "não tenho" — ou falhou de vez. */
const needsLiveFallback = (query: ReturnType<typeof useStaticVotacao>) =>
  query.data === null || query.isError

export const useVotacao = (casa: Casa, id: string) => {
  const staticVotacao = useStaticVotacao(casa, id)
  const live = useQuery({
    queryKey: queryKeys.votacoes.details(casa, id),
    queryFn: () => (casa === "camara" ? fetchCamaraVotacao(id) : fetchSenadoVotacao(id)),
    staleTime: DURATION.hour * 6,
    enabled: needsLiveFallback(staticVotacao),
  })
  return staticVotacao.data ? staticVotacao : live
}

/** Só a Câmara publica orientações de bancada; no Senado a query nem dispara. */
export const useOrientacoes = (casa: Casa, id: string) => {
  const staticVotacao = useStaticVotacao(casa, id)
  const live = useQuery({
    queryKey: queryKeys.votacoes.orientacoes(casa, id),
    queryFn: () => fetchOrientacoes(id),
    enabled: casa === "camara" && needsLiveFallback(staticVotacao),
    staleTime: DURATION.hour * 6,
  })
  return staticVotacao.data
    ? { ...staticVotacao, data: staticVotacao.data.orientacoes }
    : live
}
