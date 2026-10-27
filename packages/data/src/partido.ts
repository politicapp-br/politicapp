import { z } from "zod"

import { casaSchema } from "./parlamentar"

export const liderPartidoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  titulo: z.string(),
})

export type LiderPartido = z.infer<typeof liderPartidoSchema>

export const bancadaPartidoSchema = z.object({
  casa: casaSchema,
  membros: z.number(),
  gastoTotal: z.number(),
  gastoMediano: z.number(),
  participacaoMediana: z.number().nullable(),
})

export type BancadaPartido = z.infer<typeof bancadaPartidoSchema>

/** Documento só é publicado quando é CNPJ — CPF de pessoa física fica de fora. */
export const doadorPartidoSchema = z.object({
  nome: z.string(),
  documento: z.string().nullable(),
  valor: z.number(),
})

export type DoadorPartido = z.infer<typeof doadorPartidoSchema>

/**
 * Receitas declaradas ao TSE pelo diretório nacional do partido.
 * `fundos` é o dinheiro público (cotas do Fundo Partidário e fundo especial);
 * `demais` cobre doações e outros recursos próprios.
 */
export const financasPartidoSchema = z.object({
  ano: z.number(),
  total: z.number(),
  fundos: z.number(),
  demais: z.number(),
  topDoadores: z.array(doadorPartidoSchema),
  fonteUrl: z.string(),
})

export type FinancasPartido = z.infer<typeof financasPartidoSchema>

export const partidoResumoSchema = z.object({
  sigla: z.string(),
  nome: z.string(),
  /** Lideranças na Câmara — o Senado não publica endpoint equivalente estável. */
  lideres: z.array(liderPartidoSchema),
  bancadas: z.array(bancadaPartidoSchema),
  financas: financasPartidoSchema.nullable(),
})

export type PartidoResumo = z.infer<typeof partidoResumoSchema>

export const partidosEstaticosSchema = z.object({
  geradoEm: z.string(),
  ano: z.number(),
  partidos: z.array(partidoResumoSchema),
})

export type PartidosEstaticos = z.infer<typeof partidosEstaticosSchema>
