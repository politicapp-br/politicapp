import type {
  EventoNorma,
  EventoPauta,
  EventoTramitacao,
  EventoVotacao,
} from "@politicapp/data"
import { useQuery } from "@tanstack/react-query"

import { DURATION, queryKeys } from "@/services/api/query-keys"
import { fetchFeed } from "@/services/api/static-data"

export type FeedEvent = EventoVotacao | EventoTramitacao | EventoNorma

export type HomeFeed = {
  /** Sessões e reuniões marcadas, da mais próxima para a mais distante. */
  agenda: EventoPauta[]
  /** Votações, marcos de tramitação e normas, do mais recente para o mais antigo. */
  events: FeedEvent[]
}

/**
 * O feed vem pronto do pipeline: agenda das duas casas, votações (nominais e
 * simbólicas), marcos de tramitação e normas do DOU num JSON só. O `select`
 * separa os dois blocos que a home exibe.
 */
export const useFeed = () =>
  useQuery({
    queryKey: queryKeys.static.feed,
    queryFn: fetchFeed,
    select: ({ eventos }): HomeFeed => ({
      agenda: eventos.filter((evento) => evento.tipo === "pauta"),
      events: eventos.filter((evento) => evento.tipo !== "pauta"),
    }),
    staleTime: DURATION.hour,
  })
