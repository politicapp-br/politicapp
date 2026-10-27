import { z } from "zod"

import { casaSchema } from "./parlamentar"

/**
 * Subsídio é o salário do cargo, não da pessoa: todo deputado federal e todo
 * senador recebe exatamente o mesmo valor. O que varia de parlamentar para
 * parlamentar é o entorno — moradia, pessoal de gabinete, cota.
 */
export const subsidioSchema = z.object({
  bruto: z.number(),
  /** Contribuição previdenciária descontada, em valor positivo. */
  previdencia: z.number(),
  /** Imposto de renda retido na fonte, em valor positivo. */
  impostoRenda: z.number(),
  liquido: z.number(),
  /**
   * O bruto é igual para todos, mas os descontos variam com dependentes e com
   * o regime previdenciário de cada um. Estes dois números dizem quantos
   * parlamentares receberam exatamente este líquido, para o app não apresentar
   * um "contracheque típico" sem dizer o quanto ele é típico.
   */
  parlamentaresComEsseLiquido: z.number(),
  parlamentaresNaFolha: z.number(),
  ano: z.number(),
  mes: z.number(),
  fonteUrl: z.string(),
})

export type Subsidio = z.infer<typeof subsidioSchema>

export const tipoMoradiaSchema = z.enum([
  "imovel-funcional",
  "auxilio-moradia",
  // Quem trocou de situação no meio do ano aparece nas duas colunas.
  "ambos",
  "nenhum",
])

export type TipoMoradia = z.infer<typeof tipoMoradiaSchema>

export const tipoDeMoradia = (
  usouImovel: boolean,
  recebeuAuxilio: boolean,
): TipoMoradia =>
  usouImovel && recebeuAuxilio
    ? "ambos"
    : usouImovel
      ? "imovel-funcional"
      : recebeuAuxilio
        ? "auxilio-moradia"
        : "nenhum"

export const MORADIA_LABEL: Record<TipoMoradia, string> = {
  "imovel-funcional": "Mora em imóvel funcional",
  "auxilio-moradia": "Recebe auxílio-moradia",
  ambos: "Usou imóvel funcional e auxílio",
  nenhum: "Não usa imóvel nem auxílio",
}

/**
 * A Câmara detalha dias de imóvel e valores; o Senado só informa se o
 * benefício é usado ou não. Por isso os valores são opcionais.
 */
export const moradiaSchema = z.object({
  tipo: tipoMoradiaSchema,
  diasEmImovelFuncional: z.number().nullable(),
  auxilioRecebido: z.number().nullable(),
  complementoComCota: z.number().nullable(),
})

export type Moradia = z.infer<typeof moradiaSchema>

export const custoParlamentarSchema = z.object({
  casa: casaSchema,
  id: z.string(),
  ano: z.number(),
  moradia: moradiaSchema.nullable(),
  /** Pessoas lotadas no gabinete e nos escritórios de apoio. */
  assessores: z.number().nullable(),
  /** Diárias de viagens oficiais recebidas no ano. Só o Senado publica. */
  diarias: z.number().nullable(),
})

export type CustoParlamentar = z.infer<typeof custoParlamentarSchema>

// ---------------------------------------------------------------------------
// Agregados das casas — o custo do Congresso
// ---------------------------------------------------------------------------

export const grupoFolhaSchema = z.object({
  grupo: z.string(),
  quantidade: z.number(),
  /** Remuneração fixa + vantagens pessoais + cargo em comissão, no mês. */
  massaMensal: z.number(),
})

export type GrupoFolha = z.infer<typeof grupoFolhaSchema>

export const beneficioPosMandatoSchema = z.object({
  beneficiarios: z.number(),
  medianaMensal: z.number(),
  totalMensal: z.number(),
})

export type BeneficioPosMandato = z.infer<typeof beneficioPosMandatoSchema>

/**
 * A folha da Câmara é anonimizada mas cobre todos os grupos da casa — dá para
 * medir o custo da máquina inteira sem expor pessoa nenhuma.
 */
export const folhaCamaraSchema = z.object({
  ano: z.number(),
  mes: z.number(),
  fonteUrl: z.string(),
  grupos: z.array(grupoFolhaSchema),
  secretarios: z.object({
    quantidade: z.number(),
    massaMensal: z.number(),
    salarioMediano: z.number(),
    mediaPorGabinete: z.number(),
  }),
  /** Ex-deputados aposentados pelo IPC (extinto em 1997, direito adquirido). */
  aposentadoriaParlamentar: beneficioPosMandatoSchema,
  /** Dependentes de ex-deputados falecidos. */
  pensaoParlamentar: beneficioPosMandatoSchema,
})

export type FolhaCamara = z.infer<typeof folhaCamaraSchema>

export const orcamentoAnoSchema = z.object({
  ano: z.number(),
  pago: z.number(),
  pessoal: z.number(),
})

export type OrcamentoAno = z.infer<typeof orcamentoAnoSchema>

export const congressoSchema = z.object({
  folhaCamara: folhaCamaraSchema.nullable(),
  orcamentoSenado: z
    .object({
      serie: z.array(orcamentoAnoSchema),
      fonteUrl: z.string(),
    })
    .nullable(),
})

export type Congresso = z.infer<typeof congressoSchema>

// ---------------------------------------------------------------------------
// Subsídios do Executivo — tabela curada
// ---------------------------------------------------------------------------

export type SubsidioExecutivo = {
  uf: string
  titular: string
  partido: string
  subsidio: number
  observacao?: string
}

/**
 * Teto do funcionalismo público federal, igual ao subsídio de ministro do STF.
 * Desde 01/02/2025 presidente da República, ministros de Estado, ministros do
 * STF e parlamentares federais estão todos fixados neste mesmo valor.
 */
export const TETO_CONSTITUCIONAL = 46366.19

export const TETO_VIGENTE_DESDE = "2025-02-01"

export const FONTE_TETO =
  "https://www.camara.leg.br/noticias/930619-camara-aprova-reajuste-de-subsidios-do-presidente-da-republica-de-parlamentares-e-ministros-de-estado/"

/** Cargos federais cujo subsídio é exatamente o teto — todos o mesmo número. */
export const CARGOS_NO_TETO = [
  "Presidente da República",
  "Vice-presidente da República",
  "Ministro do STF",
  "Ministro de Estado",
  "Deputado federal",
  "Senador",
]

/**
 * Não existe fonte nacional unificada para salário do Executivo estadual: cada
 * subsídio é fixado por lei da assembleia local e publicado no portal de
 * transparência do estado, cada um num formato. Esta tabela é um levantamento
 * jornalístico usado como ponto de partida — o valor definitivo de cada estado
 * é a lei estadual em vigor. Conferido por amostragem contra a Lei paulista
 * 18.152/2025, que fixa exatamente os R$ 36.301,53 registrados aqui.
 */
export const FONTE_SUBSIDIOS_ESTADUAIS = {
  veiculo: "Portal A TARDE",
  url: "https://atarde.com.br/politica/quanto-ganha-cada-governador-veja-o-ranking-dos-salarios-1366934",
  apuradoEm: "2025-11-03",
} as const

export const SUBSIDIOS_GOVERNADORES: SubsidioExecutivo[] = [
  { uf: "SE", titular: "Fábio Mitidieri", partido: "PSD", subsidio: 46366.19 },
  { uf: "AC", titular: "Gladson Cameli", partido: "PP", subsidio: 42265.49 },
  { uf: "MG", titular: "Romeu Zema", partido: "NOVO", subsidio: 41845.49 },
  { uf: "BA", titular: "Jerônimo Rodrigues", partido: "PT", subsidio: 36894.89 },
  { uf: "SP", titular: "Tarcísio de Freitas", partido: "REPUBLICANOS", subsidio: 36301.53 },
  { uf: "PI", titular: "Rafael Fonteles", partido: "PT", subsidio: 35574.64 },
  { uf: "MS", titular: "Eduardo Riedel", partido: "PSDB", subsidio: 35462.27 },
  { uf: "RS", titular: "Eduardo Leite", partido: "PSD", subsidio: 35462.22 },
  { uf: "RO", titular: "Marcos Rocha", partido: "UNIÃO", subsidio: 35462.22 },
  { uf: "PA", titular: "Helder Barbalho", partido: "MDB", subsidio: 35363.55 },
  { uf: "ES", titular: "Renato Casagrande", partido: "PSB", subsidio: 34774.64 },
  { uf: "AP", titular: "Clécio Vieira", partido: "SOLIDARIEDADE", subsidio: 34774.64 },
  { uf: "RR", titular: "Antonio Denarium", partido: "PP", subsidio: 34299.0 },
  { uf: "AM", titular: "Wilson Lima", partido: "UNIÃO", subsidio: 34070.0 },
  { uf: "PR", titular: "Ratinho Júnior", partido: "PSD", subsidio: 33763.0 },
  { uf: "PB", titular: "João Azevêdo", partido: "PSB", subsidio: 33696.58 },
  { uf: "MA", titular: "Carlos Brandão", partido: "PSB", subsidio: 33006.39 },
  { uf: "MT", titular: "Mauro Mendes", partido: "UNIÃO", subsidio: 32353.46 },
  { uf: "TO", titular: "Wanderlei Barbosa", partido: "REPUBLICANOS", subsidio: 31216.71 },
  { uf: "AL", titular: "Paulo Dantas", partido: "MDB", subsidio: 30833.91 },
  { uf: "GO", titular: "Ronaldo Caiado", partido: "UNIÃO", subsidio: 30585.01 },
  { uf: "DF", titular: "Ibaneis Rocha", partido: "MDB", subsidio: 29951.94 },
  { uf: "SC", titular: "Jorginho Mello", partido: "PL", subsidio: 25322.25 },
  { uf: "CE", titular: "Elmano de Freitas", partido: "PT", subsidio: 23893.79 },
  {
    uf: "PE",
    titular: "Raquel Lyra",
    partido: "PSD",
    subsidio: 22000.0,
    observacao:
      "Abriu mão do subsídio de governadora e segue recebendo como procuradora do estado.",
  },
  { uf: "RN", titular: "Fátima Bezerra", partido: "PT", subsidio: 21914.76 },
  { uf: "RJ", titular: "Cláudio Castro", partido: "PL", subsidio: 21868.14 },
]

export const subsidioDoGovernador = (uf: string) =>
  SUBSIDIOS_GOVERNADORES.find((estado) => estado.uf === uf)
