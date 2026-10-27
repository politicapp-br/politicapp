import { z } from "zod"

import { casaSchema } from "./parlamentar"

export const emendaPorAreaSchema = z.object({
  area: z.string(),
  valor: z.number(),
})

export type EmendaPorArea = z.infer<typeof emendaPorAreaSchema>

/** Município em CAIXA ALTA como vem do Portal; sem município, vale a UF. */
export const emendaPorLocalSchema = z.object({
  municipio: z.string().nullable(),
  uf: z.string().nullable(),
  valor: z.number(),
})

export type EmendaPorLocal = z.infer<typeof emendaPorLocalSchema>

export const resumoEmendasSchema = z.object({
  casa: casaSchema,
  id: z.string(),
  ano: z.number(),
  empenhado: z.number(),
  pago: z.number(),
  porArea: z.array(emendaPorAreaSchema),
  porLocal: z.array(emendaPorLocalSchema),
})

export type ResumoEmendas = z.infer<typeof resumoEmendasSchema>

export const FONTE_EMENDAS = "https://portaldatransparencia.gov.br/emendas"
