import type { Casa } from "@politicapp/data"
import { useQuery } from "@tanstack/react-query"

import { fetchProposicao } from "@/services/api/camara"
import { DURATION, queryKeys } from "@/services/api/query-keys"

// Só a Câmara expõe proposições hoje; a lista do Senado ainda vem vazia.
export const useProposicao = (casa: Casa, id: string) =>
  useQuery({
    queryKey: queryKeys.proposicoes.details(casa, id),
    queryFn: () => fetchProposicao(id),
    staleTime: DURATION.hour * 12,
    enabled: casa === "camara",
  })
