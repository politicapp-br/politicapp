import type { Casa, ParlamentarRef } from "@politicapp/data"

export const queryKeys = {
  static: {
    index: ["static", "index"] as const,
    benchmarks: ["static", "benchmarks"] as const,
    votacoes: ["static", "votacoes"] as const,
    compensation: ["static", "compensation"] as const,
    feed: ["static", "feed"] as const,
    aggregates: ["static", "aggregates"] as const,
    parties: ["static", "parties"] as const,
    parlamentar: ({ casa, id }: ParlamentarRef) =>
      ["static", "parlamentar", casa, id] as const,
    noParlamentar: ["static", "parlamentar", "none"] as const,
    votacao: (casa: Casa, id: string) =>
      ["votacoes", casa, id, "static"] as const,
  },
  parlamentar: {
    details: ({ casa, id }: ParlamentarRef) =>
      ["parlamentar", casa, id, "details"] as const,
    proposicoes: ({ casa, id }: ParlamentarRef) =>
      ["parlamentar", casa, id, "proposicoes"] as const,
    committees: ({ casa, id }: ParlamentarRef) =>
      ["parlamentar", casa, id, "committees"] as const,
    speeches: ({ casa, id }: ParlamentarRef) =>
      ["parlamentar", casa, id, "speeches"] as const,
    career: ({ casa, id }: ParlamentarRef) =>
      ["parlamentar", casa, id, "career"] as const,
  },
  proposicoes: {
    details: (casa: Casa, id: string) => ["proposicoes", casa, id] as const,
  },
  votacoes: {
    details: (casa: Casa, id: string) => ["votacoes", casa, id] as const,
    orientacoes: (casa: Casa, id: string) =>
      ["votacoes", casa, id, "orientacoes"] as const,
  },
  elections: {
    candidates: (uf: string | null, cargo: string) =>
      ["tse", "candidates", uf, cargo] as const,
    candidate: (uf: string | null, cargo: string, id: string | null) =>
      ["tse", "candidate", uf, cargo, id] as const,
  },
} as const

export const DURATION = {
  minute: 60_000,
  hour: 60 * 60_000,
  day: 24 * 60 * 60_000,
} as const
