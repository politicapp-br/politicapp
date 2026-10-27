import { z } from "zod"

/**
 * Passado eleitoral do parlamentar segundo os dados abertos do TSE: em que
 * disputou, quantos votos teve, o resultado e o patrimônio que declarou em
 * cada eleição. O vínculo com o TSE é feito por CPF quando a casa o publica
 * (Câmara) e por nome + UF no resto — por isso pode faltar uma eleição.
 */

export const resultadoEleitoralSchema = z.enum([
  "eleito",
  "suplente",
  "nao-eleito",
  "segundo-turno",
  "pendente",
])

export type ResultadoEleitoral = z.infer<typeof resultadoEleitoralSchema>

export const RESULTADO_ELEITORAL_LABEL: Record<ResultadoEleitoral, string> = {
  eleito: "Eleito(a)",
  suplente: "Suplente",
  "nao-eleito": "Não eleito(a)",
  "segundo-turno": "Foi ao 2º turno",
  pendente: "Sem resultado",
}

export const candidaturaTseSchema = z.object({
  ano: z.number(),
  cargo: z.string(),
  uf: z.string(),
  partido: z.string(),
  numero: z.string(),
  resultado: resultadoEleitoralSchema,
  /** Votos nominais válidos no 1º turno; nulo quando o arquivo de votos não foi lido. */
  votos: z.number().nullable(),
  /** Soma dos bens declarados; nulo quando não declarou ou não foi lido. */
  patrimonio: z.number().nullable(),
})

export type CandidaturaTse = z.infer<typeof candidaturaTseSchema>

/** Mais recente primeiro. */
export const historicoEleitoralSchema = z.array(candidaturaTseSchema)

export type HistoricoEleitoral = z.infer<typeof historicoEleitoralSchema>

export const municipioDeVotoSchema = z.object({
  municipio: z.string(),
  uf: z.string(),
  votos: z.number(),
  /** Fração dos votos do parlamentar naquela eleição (0..1). */
  fracao: z.number(),
  /** Valor empenhado em emendas para o município no mandato atual. */
  emendas: z.number(),
})

export type MunicipioDeVoto = z.infer<typeof municipioDeVotoSchema>

/**
 * Onde o parlamentar foi votado e se as emendas dele vão para lá. "Redutos"
 * são os municípios que, somados do mais votado para o menos, dão metade dos
 * votos dele — se as emendas seguissem os votos, metade iria para eles.
 */
export const territorioEleitoralSchema = z.object({
  eleicao: z.number(),
  cargo: z.string(),
  totalVotos: z.number(),
  municipiosComVoto: z.number(),
  principais: z.array(municipioDeVotoSchema),
  redutos: z.object({
    municipios: z.number(),
    /** Fração dos votos que os redutos somam (≥ 0,5). */
    fracaoDosVotos: z.number(),
    emendas: z.number(),
    /** Fração das emendas com município identificado que foi para os redutos. */
    fracaoDasEmendas: z.number().nullable(),
  }),
  /** Emendas com município identificado (o resto é estadual ou "múltiplo"). */
  emendasComMunicipio: z.number(),
})

export type TerritorioEleitoral = z.infer<typeof territorioEleitoralSchema>

export const FONTE_TSE_DADOS_ABERTOS =
  "https://dadosabertos.tse.jus.br/dataset/?groups=resultados"
