import { z } from "zod"

import { casaSchema } from "./parlamentar"

export const despesaPorTipoSchema = z.object({
  tipo: z.string(),
  valor: z.number(),
})

export type DespesaPorTipo = z.infer<typeof despesaPorTipoSchema>

export const despesaPorMesSchema = z.object({
  ano: z.number(),
  mes: z.number(),
  valor: z.number(),
})

export type DespesaPorMes = z.infer<typeof despesaPorMesSchema>

export const resumoDespesasSchema = z.object({
  casa: casaSchema,
  id: z.string(),
  ano: z.number(),
  total: z.number(),
  porMes: z.array(despesaPorMesSchema),
  porTipo: z.array(despesaPorTipoSchema),
})

export type ResumoDespesas = z.infer<typeof resumoDespesasSchema>

export const TIPO_DESPESA_CURTO: Record<string, string> = {
  // Câmara (cota parlamentar)
  "MANUTENÇÃO DE ESCRITÓRIO DE APOIO À ATIVIDADE PARLAMENTAR": "Escritório",
  "DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR": "Divulgação",
  "COMBUSTÍVEIS E LUBRIFICANTES.": "Combustível",
  "PASSAGEM AÉREA - SIGEPA": "Passagem aérea",
  "PASSAGEM AÉREA - RPA": "Passagem aérea",
  "PASSAGEM AÉREA - REEMBOLSO": "Passagem aérea",
  "SERVIÇOS POSTAIS": "Correios",
  "TELEFONIA": "Telefonia",
  "CONSULTORIAS, PESQUISAS E TRABALHOS TÉCNICOS.": "Consultoria",
  "FORNECIMENTO DE ALIMENTAÇÃO DO PARLAMENTAR": "Alimentação",
  "HOSPEDAGEM ,EXCETO DO PARLAMENTAR NO DISTRITO FEDERAL.": "Hospedagem",
  "LOCAÇÃO OU FRETAMENTO DE VEÍCULOS AUTOMOTORES": "Locação de veículo",
  "LOCAÇÃO OU FRETAMENTO DE AERONAVES": "Locação de aeronave",
  "SERVIÇO DE TÁXI, PEDÁGIO E ESTACIONAMENTO": "Táxi e pedágio",
  "SERVIÇO DE SEGURANÇA PRESTADO POR EMPRESA ESPECIALIZADA.": "Segurança",
  "ASSINATURA DE PUBLICAÇÕES": "Assinaturas",
  "AQUISIÇÃO DE MATERIAL DE ESCRITÓRIO.": "Material de escritório",
  // Senado (CEAPS)
  "Aluguel de imóveis para escritório político, compreendendo despesas concernentes a eles":
    "Aluguel de escritório",
  "Aquisição de material de consumo para uso no escritório político, inclusive aquisição ou locação de software, despesas postais, aquisição de publicações, locação de móveis e de equipamentos":
    "Material de escritório",
  "Contratação de consultorias, assessorias, pesquisas, trabalhos técnicos e outros serviços de apoio ao exercício do mandato parlamentar":
    "Consultoria",
  "Locomoção, hospedagem, alimentação, combustíveis e lubrificantes":
    "Locomoção e hospedagem",
  "Passagens aéreas, aquáticas e terrestres nacionais": "Passagens",
  "Serviços de Segurança Privada": "Segurança",
}

// O CEAPS traz tipos com espaço e ponto final sobrando, e a caixa difere da
// usada pela Câmara — a busca é feita sobre a forma normalizada.
const normalizar = (tipo: string) =>
  tipo.trim().replace(/\.$/, "").toLocaleUpperCase("pt-BR")

const CURTO_POR_TIPO_NORMALIZADO = new Map(
  Object.entries(TIPO_DESPESA_CURTO).map(([tipo, curto]) => [
    normalizar(tipo),
    curto,
  ]),
)

export const tipoDespesaCurto = (tipo: string) =>
  CURTO_POR_TIPO_NORMALIZADO.get(normalizar(tipo)) ?? capitalizar(tipo)

const capitalizar = (texto: string) => {
  const limpo = texto.trim().toLocaleLowerCase("pt-BR").replace(/\.$/, "")
  return limpo.charAt(0).toLocaleUpperCase("pt-BR") + limpo.slice(1)
}
