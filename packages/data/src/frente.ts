import { z } from "zod"

export const frenteSchema = z.object({
  id: z.number(),
  titulo: z.string(),
  totalMembros: z.number(),
})

export type Frente = z.infer<typeof frenteSchema>

/** `papel` ausente significa membro comum — só coordenações são gravadas. */
export const participacaoEmFrenteSchema = z.object({
  id: z.number(),
  papel: z.string().nullish(),
})

export type ParticipacaoEmFrente = z.infer<typeof participacaoEmFrenteSchema>
