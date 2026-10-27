import { z } from "zod"

import { casaSchema } from "./parlamentar"

export const proposicaoSchema = z.object({
  casa: casaSchema,
  id: z.string(),
  sigla: z.string(),
  numero: z.number(),
  ano: z.number(),
  ementa: z.string(),
  resumo: z.string().nullable(),
  apresentadaEm: z.string().nullable(),
  situacao: z.string().nullable(),
  temas: z.array(z.string()),
})

export type Proposicao = z.infer<typeof proposicaoSchema>

export const autorProposicaoSchema = z.object({
  nome: z.string(),
  tipo: z.string(),
  /** Preenchido quando o autor é um parlamentar com página no app. */
  parlamentar: z
    .object({ casa: casaSchema, id: z.string() })
    .nullable(),
  proponente: z.boolean(),
})

export type AutorProposicao = z.infer<typeof autorProposicaoSchema>

export const tramitacaoSchema = z.object({
  data: z.string(),
  orgao: z.string().nullable(),
  descricao: z.string(),
  situacao: z.string().nullable(),
  despacho: z.string().nullable(),
})

export type Tramitacao = z.infer<typeof tramitacaoSchema>

export const proposicaoDetalheSchema = proposicaoSchema.extend({
  tipoPorExtenso: z.string().nullable(),
  ementaDetalhada: z.string().nullable(),
  palavrasChave: z.array(z.string()),
  orgaoAtual: z.string().nullable(),
  regime: z.string().nullable(),
  apreciacao: z.string().nullable(),
  despacho: z.string().nullable(),
  atualizadaEm: z.string().nullable(),
  urlInteiroTeor: z.string().nullable(),
  urlFonte: z.string(),
  autores: z.array(autorProposicaoSchema),
  tramitacoes: z.array(tramitacaoSchema),
})

export type ProposicaoDetalhe = z.infer<typeof proposicaoDetalheSchema>

/**
 * Proposições internas (pareceres, minutas) às vezes vêm sem ano na API da
 * Câmara — nesses casos o "/0" só confunde quem lê.
 */
export const identificadorProposicao = ({
  sigla,
  numero,
  ano,
}: Pick<Proposicao, "sigla" | "numero" | "ano">) =>
  ano > 0 ? `${sigla} ${numero}/${ano}` : `${sigla} ${numero}`

const TIPO_PROPOSICAO: Record<string, string> = {
  PL: "Projeto de lei",
  PLP: "Projeto de lei complementar",
  PLV: "Projeto de lei de conversão",
  PEC: "Proposta de emenda à Constituição",
  PDL: "Projeto de decreto legislativo",
  PDC: "Projeto de decreto legislativo",
  PRC: "Projeto de resolução",
  MPV: "Medida provisória",
  MSC: "Mensagem",
  REQ: "Requerimento",
  RIC: "Pedido de informação",
  RCP: "Requerimento de CPI",
  INC: "Indicação",
  PFC: "Proposta de fiscalização e controle",
  EMC: "Emenda",
  EMP: "Emenda de plenário",
  EMR: "Emenda de relator",
  SBT: "Substitutivo",
  PRL: "Parecer do relator",
  VTS: "Voto em separado",
  SIT: "Sugestão",
}

/** Nome legível do tipo da proposição, ou `null` quando a sigla é incomum. */
export const tipoDaProposicao = ({ sigla }: Pick<Proposicao, "sigla">) =>
  TIPO_PROPOSICAO[sigla.toUpperCase()] ?? null
