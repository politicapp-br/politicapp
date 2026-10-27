import { z } from "zod"

/**
 * Linha do tempo do mandato: por quais partidos passou e quando esteve fora
 * (licença, missão, cargo no Executivo). Explica participação baixa e a
 * entrada de suplentes.
 */

export const filiacaoSchema = z.object({
  partido: z.string(),
  /** AAAA-MM-DD. Na Câmara é a data em que a troca foi registrada na casa. */
  inicio: z.string().nullable(),
  fim: z.string().nullable(),
})

export type Filiacao = z.infer<typeof filiacaoSchema>

export const afastamentoSchema = z.object({
  inicio: z.string(),
  /** Nulo enquanto o afastamento estiver em curso. */
  fim: z.string().nullable(),
  motivo: z.string(),
})

export type Afastamento = z.infer<typeof afastamentoSchema>

export const suplenteSchema = z.object({
  ordem: z.string(),
  nome: z.string(),
  /** Código do suplente no Senado, para ligar com a página dele quando assumir. */
  id: z.string().nullable(),
})

export type Suplente = z.infer<typeof suplenteSchema>

export const historicoMandatoSchema = z.object({
  /** Mais recente primeiro; só a partir de 2015 para não inchar o arquivo. */
  filiacoes: z.array(filiacaoSchema),
  /** Mais recente primeiro, da legislatura atual. */
  afastamentos: z.array(afastamentoSchema),
  /** Só no Senado, onde cada titular tem suplentes nominais. */
  suplentes: z.array(suplenteSchema),
})

export type HistoricoMandato = z.infer<typeof historicoMandatoSchema>
