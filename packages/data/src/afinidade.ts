import { z } from "zod"

import { casaSchema } from "./parlamentar"

/**
 * Como o parlamentar vota em relação aos colegas e ao governo, a partir das
 * votações nominais de plenário do ano. Só votos sim/não entram nas contas:
 * abstenção, obstrução e ausência não definem lado.
 */

const ladoSchema = z.enum(["sim", "nao"])

export const parlamentarParecidoSchema = z.object({
  casa: casaSchema,
  id: z.string(),
  nome: z.string(),
  partido: z.string(),
  uf: z.string(),
  /** Votações em que os dois votaram sim ou não. */
  votacoes: z.number(),
  /** Fração dessas em que votaram igual (0..1). */
  concordancia: z.number(),
})

export type ParlamentarParecido = z.infer<typeof parlamentarParecidoSchema>

export const votoContraPartidoSchema = z.object({
  votacaoId: z.string(),
  data: z.string(),
  descricao: z.string(),
  proposicao: z.string().nullable(),
  voto: ladoSchema,
  /** Lado da maioria da bancada naquela votação. */
  partido: ladoSchema,
})

export type VotoContraPartido = z.infer<typeof votoContraPartidoSchema>

export const votoApertadoSchema = z.object({
  votacaoId: z.string(),
  data: z.string(),
  descricao: z.string(),
  proposicao: z.string().nullable(),
  /** Diferença entre sim e não no placar. */
  margem: z.number(),
  aprovada: z.boolean().nullable(),
  /** Nulo quando não votou sim nem não. */
  voto: ladoSchema.nullable(),
})

export type VotoApertado = z.infer<typeof votoApertadoSchema>

export const afinidadeSchema = z.object({
  ano: z.number(),
  /** Votações nominais de plenário em que votou sim ou não. */
  votacoes: z.number(),
  /**
   * Votos no mesmo lado da orientação da liderança do governo. Nulo quando a
   * casa não publica orientação (Senado) ou não houve votação comparável.
   */
  governo: z.object({ votacoes: z.number(), comGoverno: z.number() }).nullable(),
  /** Colegas da mesma casa que mais votaram igual, de qualquer partido. */
  parecidos: z.array(parlamentarParecidoSchema),
  /** Colegas que mais votaram diferente. */
  distantes: z.array(parlamentarParecidoSchema),
  /** Total no ano e as mais recentes primeiro. */
  contraPartido: z.object({
    total: z.number(),
    recentes: z.array(votoContraPartidoSchema),
  }),
  /** Votações decididas por margem estreita, mais recentes primeiro. */
  apertadas: z.array(votoApertadoSchema),
})

export type Afinidade = z.infer<typeof afinidadeSchema>

/** Dados abertos de cada casa — fonte de votações, autorias e histórico. */
export const FONTE_DADOS_ABERTOS = {
  camara: "https://dadosabertos.camara.leg.br/",
  senado: "https://legis.senado.leg.br/dadosabertos/",
} as const
