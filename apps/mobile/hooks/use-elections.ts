import type { Cargo } from "@politicapp/data"
import { useQuery } from "@tanstack/react-query"

import { DURATION, queryKeys } from "@/services/api/query-keys"
import { fetchCandidate, fetchCandidates } from "@/services/api/tse"

export const useCandidates = (uf: string | null, cargo: Cargo) =>
  useQuery({
    queryKey: queryKeys.elections.candidates(uf, cargo),
    queryFn: () => fetchCandidates(uf as string, cargo),
    enabled: Boolean(uf),
    staleTime: DURATION.hour * 3,
  })

export const useCandidate = (
  uf: string | null,
  cargo: Cargo,
  id: string | null,
) =>
  useQuery({
    queryKey: queryKeys.elections.candidate(uf, cargo, id),
    queryFn: () => fetchCandidate(uf as string, cargo, id as string),
    enabled: Boolean(uf && id),
    staleTime: DURATION.hour * 6,
  })
