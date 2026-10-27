import { z } from "zod"

import { casaSchema } from "./parlamentar"

/**
 * Agregados de comportamento coletivo, computados pelo pipeline sobre todas
 * as votações nominais do ano (não só as do feed). A "posição da bancada" em
 * cada votação é a maioria entre os votos sim/não do partido — abstenção,
 * obstrução e ausência não definem lado.
 */

export const coesaoDeBancadaSchema = z.object({
  partido: z.string(),
  /** Parlamentares distintos registrados pela bancada no período (inclui quem só constou como ausente). */
  parlamentares: z.number(),
  /** Votações em que a bancada teve posição (maioria sim/não definida). */
  votacoes: z.number(),
  /** Média da fração dos votos sim/não da bancada que acompanhou a própria maioria (0..1). */
  coesao: z.number().nullable(),
  /**
   * Alinhamento com a orientação da liderança do governo, quando a casa
   * publica esse dado (só a Câmara). Null quando não há votações comparáveis.
   */
  governo: z
    .object({
      /** Votações em que bancada e governo tinham posição. */
      votacoes: z.number(),
      /** Quantas vezes a bancada ficou do lado orientado pelo governo. */
      comGoverno: z.number(),
    })
    .nullable(),
})

export type CoesaoDeBancada = z.infer<typeof coesaoDeBancadaSchema>

export const concordanciaDeBancadasSchema = z.object({
  /** Par em ordem alfabética: partidoA < partidoB. */
  partidoA: z.string(),
  partidoB: z.string(),
  /** Votações em que as duas bancadas tinham posição. */
  votacoes: z.number(),
  /** Fração dessas votações em que ficaram do mesmo lado (0..1). */
  concordancia: z.number(),
})

export type ConcordanciaDeBancadas = z.infer<typeof concordanciaDeBancadasSchema>

export const alinhamentoParlamentarSchema = z.object({
  casa: casaSchema,
  id: z.string(),
  nome: z.string(),
  partido: z.string(),
  uf: z.string(),
  /** Votos sim/não dados quando a bancada tinha posição. */
  votacoes: z.number(),
  /** Quantos desses acompanharam a maioria do partido. */
  comPartido: z.number(),
  /** Votos sim/não dados quando o governo tinha lado (orientação ou voto do líder). */
  votacoesGoverno: z.number(),
  /** Quantos desses ficaram do lado do governo. */
  comGoverno: z.number(),
})

export type AlinhamentoParlamentar = z.infer<typeof alinhamentoParlamentarSchema>

export const agregadosDaCasaSchema = z.object({
  casa: casaSchema,
  votacoesConsideradas: z.number(),
  bancadas: z.array(coesaoDeBancadaSchema),
  concordancias: z.array(concordanciaDeBancadasSchema),
})

export type AgregadosDaCasa = z.infer<typeof agregadosDaCasaSchema>

export const agregadosEstaticosSchema = z.object({
  geradoEm: z.string(),
  ano: z.number(),
  casas: z.array(agregadosDaCasaSchema),
})

export type AgregadosEstaticos = z.infer<typeof agregadosEstaticosSchema>
