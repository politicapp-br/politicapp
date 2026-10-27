import { z } from "zod"

import { casaSchema } from "./parlamentar"

export const sancaoSchema = z.object({
  categoria: z.string(),
  orgao: z.string().nullable(),
  esfera: z.string().nullable(),
  inicio: z.string().nullable(),
  /** Nulo quando a sanção não tem prazo determinado. */
  fim: z.string().nullable(),
})

export type Sancao = z.infer<typeof sancaoSchema>

/**
 * Fornecedor da cota parlamentar que consta do CEIS com sanção vigente.
 * O dado diz que o parlamentar contratou uma empresa sancionada — não que
 * ele cometeu irregularidade.
 */
export const fornecedorSancionadoSchema = z.object({
  nome: z.string(),
  cnpjCpf: z.string(),
  totalGasto: z.number(),
  sancoes: z.array(sancaoSchema),
})

export type FornecedorSancionado = z.infer<typeof fornecedorSancionadoSchema>

export const sancoesDoParlamentarSchema = z.object({
  casa: casaSchema,
  id: z.string(),
  fornecedores: z.array(fornecedorSancionadoSchema),
})

export type SancoesDoParlamentar = z.infer<typeof sancoesDoParlamentarSchema>

export const sancoesPorCasaSchema = z.object({
  casa: casaSchema,
  parlamentares: z.number(),
  total: z.number(),
})

export type SancoesPorCasa = z.infer<typeof sancoesPorCasaSchema>

export const FONTE_CEIS = "https://portaldatransparencia.gov.br/sancoes/ceis"
