import { z } from "zod"

import { votacaoSchema } from "./votacao"

/**
 * Sessões do Congresso Nacional (vetos, orçamento) acontecem no plenário do
 * Senado mas não são do Senado — a agenda distingue as três origens.
 */
export const casaEventoSchema = z.enum(["camara", "senado", "congresso"])

export type CasaEvento = z.infer<typeof casaEventoSchema>

export const CASA_EVENTO_LABEL: Record<CasaEvento, string> = {
  camara: "Câmara",
  senado: "Senado",
  congresso: "Congresso Nacional",
}

export const itemDePautaSchema = z.object({
  sigla: z.string(),
  ementa: z.string().nullable(),
})

export type ItemDePauta = z.infer<typeof itemDePautaSchema>

/** Sessão ou reunião futura com o que está marcado para ser discutido/votado. */
export const eventoPautaSchema = z.object({
  tipo: z.literal("pauta"),
  id: z.string(),
  /** Início do evento em ISO (com hora quando a fonte informa). */
  data: z.string(),
  casa: casaEventoSchema,
  /** Sigla curta do órgão: "PLEN", "CCJ", "CDH"… */
  orgao: z.string(),
  /** Nome legível do órgão, quando a sigla sozinha não diz nada. */
  orgaoNome: z.string().nullable(),
  plenario: z.boolean(),
  titulo: z.string(),
  itens: z.array(itemDePautaSchema),
})

export type EventoPauta = z.infer<typeof eventoPautaSchema>

/**
 * Votação que já aconteceu. `nominal` separa as com voto individual
 * registrado (têm placar e tela de detalhe) das simbólicas, em que só o
 * resultado existe.
 */
export const eventoVotacaoSchema = z.object({
  tipo: z.literal("votacao"),
  data: z.string(),
  nominal: z.boolean(),
  votacao: votacaoSchema,
})

export type EventoVotacao = z.infer<typeof eventoVotacaoSchema>

/**
 * Só marcos raros e de alto sinal entram no feed — milhares de proposições
 * tramitam por semana, mas poucas mudam de estágio de um jeito que vira
 * notícia.
 */
export const marcoTramitacaoSchema = z.enum([
  "aprovada_na_camara",
  "enviada_a_sancao",
  "aguardando_promulgacao",
  "transformada_em_lei",
  "vetada",
])

export type MarcoTramitacao = z.infer<typeof marcoTramitacaoSchema>

export const MARCO_LABEL: Record<MarcoTramitacao, string> = {
  aprovada_na_camara: "Aprovada na Câmara, seguiu para o Senado",
  enviada_a_sancao: "Aprovada no Congresso, foi à sanção",
  aguardando_promulgacao: "Aprovada, aguarda promulgação",
  transformada_em_lei: "Virou lei",
  vetada: "Vetada totalmente",
}

export const eventoTramitacaoSchema = z.object({
  tipo: z.literal("tramitacao"),
  id: z.string(),
  data: z.string(),
  casa: casaEventoSchema,
  marco: marcoTramitacaoSchema,
  proposicao: z.object({
    id: z.string().nullable(),
    sigla: z.string(),
    ementa: z.string().nullable(),
  }),
  /** Texto original do despacho, para quem quiser a fonte crua. */
  despacho: z.string().nullable(),
})

export type EventoTramitacao = z.infer<typeof eventoTramitacaoSchema>

export const especieNormaSchema = z.enum(["lei", "mpv", "decreto"])

export type EspecieNorma = z.infer<typeof especieNormaSchema>

export const ESPECIE_NORMA_LABEL: Record<EspecieNorma, string> = {
  lei: "Lei sancionada",
  mpv: "Medida provisória",
  decreto: "Decreto",
}

/**
 * Ato do Executivo publicado no DOU (seção 1): lei sancionada, MP editada,
 * decreto numerado. É o lado "virou regra de verdade" do feed.
 */
export const eventoNormaSchema = z.object({
  tipo: z.literal("norma"),
  id: z.string(),
  /** Data de publicação no DOU (ISO, só dia). */
  data: z.string(),
  especie: especieNormaSchema,
  /** "Decreto nº 13.094, de 12 de agosto de 2026" */
  titulo: z.string(),
  ementa: z.string().nullable(),
  /** Página oficial da norma no in.gov.br. */
  url: z.string(),
})

export type EventoNorma = z.infer<typeof eventoNormaSchema>

export const eventoFeedSchema = z.discriminatedUnion("tipo", [
  eventoPautaSchema,
  eventoVotacaoSchema,
  eventoTramitacaoSchema,
  eventoNormaSchema,
])

export type EventoFeed = z.infer<typeof eventoFeedSchema>

export const chaveDoEvento = (evento: EventoFeed): string => {
  switch (evento.tipo) {
    case "pauta":
      return `pauta:${evento.id}`
    case "votacao":
      return `votacao:${evento.votacao.casa}:${evento.votacao.id}`
    case "tramitacao":
      return `tramitacao:${evento.id}`
    case "norma":
      return `norma:${evento.id}`
  }
}
