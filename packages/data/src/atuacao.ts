import { z } from "zod"

/**
 * Assento num órgão colegiado — comissão, conselho, grupo parlamentar.
 * `fim` nulo indica participação vigente.
 */
export const participacaoEmOrgaoSchema = z.object({
  sigla: z.string(),
  nome: z.string(),
  papel: z.string(),
  inicio: z.string().nullable(),
  fim: z.string().nullable(),
})

export type ParticipacaoEmOrgao = z.infer<typeof participacaoEmOrgaoSchema>

export const discursoSchema = z.object({
  data: z.string(),
  tipo: z.string().nullable(),
  resumo: z.string().nullable(),
  urlTexto: z.string().nullable(),
})

export type Discurso = z.infer<typeof discursoSchema>

/** Mandato eletivo anterior ao atual (vereador, prefeito, deputado estadual…). */
export const mandatoExternoSchema = z.object({
  cargo: z.string(),
  uf: z.string().nullable(),
  municipio: z.string().nullable(),
  anoInicio: z.number().nullable(),
  anoFim: z.number().nullable(),
  partido: z.string().nullable(),
})

export type MandatoExterno = z.infer<typeof mandatoExternoSchema>

export const ocupacaoSchema = z.object({
  titulo: z.string(),
  entidade: z.string().nullable(),
  anoInicio: z.number().nullable(),
  anoFim: z.number().nullable(),
})

export type Ocupacao = z.infer<typeof ocupacaoSchema>

export const trajetoriaSchema = z.object({
  mandatosExternos: z.array(mandatoExternoSchema),
  ocupacoes: z.array(ocupacaoSchema),
})

export type Trajetoria = z.infer<typeof trajetoriaSchema>
