import { z } from "zod"

/**
 * O que o parlamentar apresentou na legislatura atual e o que andou.
 * "Autor" é o primeiro signatário; "coautor", quem assinou junto.
 */

export const producaoPorTipoSchema = z.object({
  sigla: z.string(),
  autor: z.number(),
  coautor: z.number(),
})

export type ProducaoPorTipo = z.infer<typeof producaoPorTipoSchema>

export const proposicaoDestaqueSchema = z.object({
  /** Id na casa de origem — na Câmara, leva para a tela da proposição no app. */
  id: z.string(),
  identificacao: z.string(),
  /** Página oficial da matéria. */
  url: z.string(),
  ementa: z.string(),
  apresentadaEm: z.string().nullable(),
  /** Foi o primeiro signatário. */
  autor: z.boolean(),
})

export type ProposicaoDestaque = z.infer<typeof proposicaoDestaqueSchema>

export const producaoLegislativaSchema = z.object({
  /** Ano de início da legislatura considerada. */
  desde: z.number(),
  porTipo: z.array(producaoPorTipoSchema),
  /** Projetos de lei, PECs e afins — exclui requerimentos e indicações. */
  projetos: z.object({ autor: z.number(), coautor: z.number() }),
  /** Viraram lei ou emenda constitucional, mais recentes primeiro. */
  viraramNorma: z.array(proposicaoDestaqueSchema),
  /** Aprovadas na casa e enviadas à outra (ou à sanção), ainda sem norma. */
  aprovadasNaCasa: z.array(proposicaoDestaqueSchema),
})

export type ProducaoLegislativa = z.infer<typeof producaoLegislativaSchema>

/** Siglas que propõem norma — o resto (REQ, INC, RIC…) é instrumento de trabalho. */
export const SIGLAS_DE_PROJETO = new Set([
  "PL",
  "PLP",
  "PEC",
  "PDL",
  "PDC",
  "PRC",
  "PLS",
  "PRS",
  "PDS",
])
