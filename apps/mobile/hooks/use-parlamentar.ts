import {
  JANELA_DISCURSOS_MESES,
  type ParlamentarRef,
  type SecoesParlamentar,
} from "@politicapp/data"
import { useQuery, type QueryKey, type UseQueryResult } from "@tanstack/react-query"
import { subMonths } from "date-fns"

import { useParlamentarShard } from "@/hooks/use-static-data"
import {
  fetchDeputado,
  fetchDeputadoCareer,
  fetchDeputadoCommittees,
  fetchDeputadoProposicoes,
  fetchDeputadoSpeeches,
} from "@/services/api/camara"
import { DURATION, queryKeys } from "@/services/api/query-keys"
import {
  fetchSenador,
  fetchSenadorCommittees,
  fetchSenadorSpeeches,
} from "@/services/api/senado"

type ProfileSection = "perfil" | "proposicoes" | "orgaos" | "discursos" | "trajetoria"

/**
 * Seção do shard estático (`parlamentar/{casa}/{id}.json`, renovado pelo job
 * de perfis) com a API ao vivo como recuo: a busca ao vivo só dispara quando
 * o shard respondeu sem a seção — parlamentar recém-empossado, seção ainda
 * não renovada — ou falhou de vez. O mapeamento é o mesmo nos dois caminhos
 * (`@politicapp/sources`).
 */
const useStaticOrLive = <K extends ProfileSection>(
  parlamentar: ParlamentarRef,
  section: K,
  live: { queryKey: QueryKey; queryFn: () => Promise<SecoesParlamentar[K]>; staleTime: number },
  available = true,
): UseQueryResult<SecoesParlamentar[K]> => {
  const shard = useParlamentarShard(available ? parlamentar : null)
  const fromShard = shard.data?.[section]
  // Erro de uma atualização em segundo plano com shard em cache não conta:
  // os dados do cache continuam valendo.
  const shardUnavailable = shard.isError && shard.data === undefined
  const liveQuery = useQuery({
    ...live,
    // Shard respondeu (mesmo 404 → null) sem a seção, ou nunca respondeu.
    enabled: available && (shardUnavailable || (shard.data !== undefined && fromShard === undefined)),
  })

  if (fromShard !== undefined) {
    return { ...shard, data: fromShard } as UseQueryResult<SecoesParlamentar[K]>
  }
  // "Tentar de novo" na tela refaz os dois caminhos: o shard pode ter chegado.
  return {
    ...liveQuery,
    refetch: async (options) => {
      await shard.refetch()
      return liveQuery.refetch(options)
    },
  } as UseQueryResult<SecoesParlamentar[K]>
}

export const useParlamentarDetails = (parlamentar: ParlamentarRef) =>
  useStaticOrLive(parlamentar, "perfil", {
    queryKey: queryKeys.parlamentar.details(parlamentar),
    queryFn: () =>
      parlamentar.casa === "camara"
        ? fetchDeputado(parlamentar.id)
        : fetchSenador(parlamentar.id),
    staleTime: DURATION.day,
  })

/** O Senado não lista proposições por autor na mesma API — a seção é só da Câmara. */
export const useParlamentarProposicoes = (parlamentar: ParlamentarRef) =>
  useStaticOrLive(
    parlamentar,
    "proposicoes",
    {
      queryKey: queryKeys.parlamentar.proposicoes(parlamentar),
      queryFn: () => fetchDeputadoProposicoes(parlamentar.id),
      staleTime: DURATION.hour * 12,
    },
    parlamentar.casa === "camara",
  )

export const useParlamentarCommittees = (parlamentar: ParlamentarRef) =>
  useStaticOrLive(parlamentar, "orgaos", {
    queryKey: queryKeys.parlamentar.committees(parlamentar),
    queryFn: () =>
      parlamentar.casa === "camara"
        ? fetchDeputadoCommittees(parlamentar.id)
        : fetchSenadorCommittees(parlamentar.id),
    staleTime: DURATION.day,
  })

/** Mesma janela do shard, para os dois caminhos mostrarem o mesmo recorte. */
export const useParlamentarSpeeches = (parlamentar: ParlamentarRef) =>
  useStaticOrLive(parlamentar, "discursos", {
    queryKey: queryKeys.parlamentar.speeches(parlamentar),
    queryFn: () => {
      const end = new Date()
      const start = subMonths(end, JANELA_DISCURSOS_MESES)
      return parlamentar.casa === "camara"
        ? fetchDeputadoSpeeches(parlamentar.id, start, end)
        : fetchSenadorSpeeches(parlamentar.id, start, end)
    },
    staleTime: DURATION.hour * 12,
  })

/** O Senado não publica trajetória equivalente — a seção é só da Câmara. */
export const useParlamentarCareer = (parlamentar: ParlamentarRef) =>
  useStaticOrLive(
    parlamentar,
    "trajetoria",
    {
      queryKey: queryKeys.parlamentar.career(parlamentar),
      queryFn: () => fetchDeputadoCareer(parlamentar.id),
      staleTime: DURATION.day,
    },
    parlamentar.casa === "camara",
  )
