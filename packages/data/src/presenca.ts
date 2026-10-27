import { z } from "zod"

/**
 * Frequência oficial publicada pela Câmara no perfil do deputado: plenário
 * conta dias de sessão deliberativa, comissões contam reuniões. Diferente da
 * participação em votações nominais, inclui sessões sem votação nominal.
 */
export const frequenciaSchema = z.object({
  presencas: z.number(),
  ausenciasJustificadas: z.number(),
  ausenciasNaoJustificadas: z.number(),
})

export type Frequencia = z.infer<typeof frequenciaSchema>

export const presencaSchema = z.object({
  ano: z.number(),
  plenario: frequenciaSchema.nullable(),
  comissoes: frequenciaSchema.nullable(),
  fonteUrl: z.string(),
})

export type Presenca = z.infer<typeof presencaSchema>

export const totalDeRegistros = ({
  presencas,
  ausenciasJustificadas,
  ausenciasNaoJustificadas,
}: Frequencia) => presencas + ausenciasJustificadas + ausenciasNaoJustificadas
