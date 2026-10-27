import { z } from "zod"

/**
 * Detalhe da cota que o resumo por tipo e mês não mostra: para quem o
 * dinheiro foi e quanto a casa recusou reembolsar. Nada aqui indica
 * irregularidade por si só — fornecedor exclusivo é permitido; o dado só
 * torna visível o padrão.
 *
 * Passageiro e trecho ficaram de fora: desde 2026 os bilhetes emitidos pelo
 * SIGEPA (a maioria) não vêm mais no CSV da cota, e um resumo de viagens só
 * com os reembolsos daria um retrato falso.
 */

/** Documento só é publicado quando é CNPJ — CPF de pessoa física fica de fora. */
export const fornecedorDaCotaSchema = z.object({
  nome: z.string(),
  documento: z.string().nullable(),
  total: z.number(),
  lancamentos: z.number(),
  /** Fração do total da cota do parlamentar no ano (0..1). */
  fracao: z.number(),
  /** Nenhum outro parlamentar da mesma casa pagou este fornecedor no ano. */
  exclusivo: z.boolean(),
})

export type FornecedorDaCota = z.infer<typeof fornecedorDaCotaSchema>

export const lancamentoDestaqueSchema = z.object({
  /** Data de emissão do documento (AAAA-MM-DD), quando a fonte informa. */
  data: z.string().nullable(),
  fornecedor: z.string(),
  tipo: z.string(),
  valor: z.number(),
  documentoUrl: z.string().nullable(),
})

export type LancamentoDestaque = z.infer<typeof lancamentoDestaqueSchema>

export const fornecedoresDoParlamentarSchema = z.object({
  ano: z.number(),
  total: z.number(),
  /** Fornecedores distintos no ano. */
  quantidade: z.number(),
  principais: z.array(fornecedorDaCotaSchema),
  /** Fração do total que foi para os três maiores fornecedores (0..1). */
  concentracaoTop3: z.number(),
  /** Pagamentos a pessoa física (CPF), sem identificar quem. */
  pessoaFisica: z.object({ valor: z.number(), lancamentos: z.number() }),
  /** Valor que a Câmara recusou reembolsar. Nulo no Senado, que não publica. */
  glosado: z.number().nullable(),
  maioresLancamentos: z.array(lancamentoDestaqueSchema),
})

export type FornecedoresDoParlamentar = z.infer<typeof fornecedoresDoParlamentarSchema>

/** Página oficial com os lançamentos da cota, por casa. */
export const FONTE_COTA = {
  camara: "https://www.camara.leg.br/cota-parlamentar/",
  senado: "https://www.senado.leg.br/transparencia/LAI/verba/",
} as const
