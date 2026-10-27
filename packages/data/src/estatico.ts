import { z } from "zod"

import { eventoFeedSchema } from "./evento"
import { casaSchema, parlamentarSchema } from "./parlamentar"
import { congressoSchema, subsidioSchema } from "./remuneracao"
import { votacaoSchema } from "./votacao"

/**
 * Situação de cada etapa do pipeline. `verificadoEm` é a última vez que a
 * etapa rodou com sucesso — o arquivo pode ter conteúdo mais antigo se o dado
 * não mudou desde então. Etapa que falhou mantém o `verificadoEm` anterior.
 */
export const etapaManifestSchema = z.object({
  ok: z.boolean(),
  verificadoEm: z.string().nullable(),
  erro: z.string().nullable(),
})

export type EtapaManifest = z.infer<typeof etapaManifestSchema>

/** Catálogo do que está publicado: arquivos únicos e coleções. */
export const manifestSchema = z.object({
  geradoEm: z.string(),
  ano: z.number(),
  etapas: z.record(z.string(), etapaManifestSchema),
  arquivos: z.array(z.object({ caminho: z.string(), bytes: z.number() })),
  colecoes: z.array(z.object({ nome: z.string(), itens: z.number() })),
})

export type Manifest = z.infer<typeof manifestSchema>

export const distribuicaoSchema = z.object({
  mediana: z.number(),
  media: z.number(),
  p25: z.number(),
  p75: z.number(),
  minimo: z.number(),
  maximo: z.number(),
  amostra: z.number(),
})

export type Distribuicao = z.infer<typeof distribuicaoSchema>

export const benchmarkSchema = z.object({
  casa: casaSchema,
  ano: z.number(),
  gastos: z.object({
    geral: distribuicaoSchema,
    porUf: z.record(z.string(), distribuicaoSchema),
    porPartido: z.record(z.string(), distribuicaoSchema),
  }),
  participacao: z.object({
    geral: distribuicaoSchema,
  }),
  votacoesNominais: z.number(),
})

export type Benchmark = z.infer<typeof benchmarkSchema>

export const benchmarksSchema = z.object({
  geradoEm: z.string(),
  casas: z.array(benchmarkSchema),
})

export type Benchmarks = z.infer<typeof benchmarksSchema>

export const indiceParlamentarSchema = parlamentarSchema.extend({
  gastoAno: z.number().nullable(),
  participacaoPercentual: z.number().nullable(),
  votacoesParticipadas: z.number().nullable(),
})

export type IndiceParlamentar = z.infer<typeof indiceParlamentarSchema>

export const indiceSchema = z.object({
  geradoEm: z.string(),
  ano: z.number(),
  parlamentares: z.array(indiceParlamentarSchema),
})

export type Indice = z.infer<typeof indiceSchema>

/**
 * Feed de votações pré-computado. Descobrir quais votações têm voto nominal
 * exige varrer centenas de páginas da API da Câmara — trabalho de pipeline,
 * não de celular.
 */
export const votacoesEstaticasSchema = z.object({
  geradoEm: z.string(),
  ano: z.number(),
  /** Identifica o conjunto de votações; a seção `votos` dos shards carrega o mesmo. */
  conjunto: z.string(),
  votacoes: z.array(votacaoSchema),
})

export type VotacoesEstaticas = z.infer<typeof votacoesEstaticasSchema>

/**
 * Feed da home: agenda do que vem aí e votações que já aconteceram, das duas
 * casas, num arquivo só. Montado no pipeline porque cruza várias fontes.
 */
export const feedEstaticoSchema = z.object({
  geradoEm: z.string(),
  ano: z.number(),
  eventos: z.array(eventoFeedSchema),
})

export type FeedEstatico = z.infer<typeof feedEstaticoSchema>

/** Subsídio e custo do Congresso; custos por parlamentar ficam no shard. */
export const remuneracaoEstaticaSchema = z.object({
  geradoEm: z.string(),
  ano: z.number(),
  subsidio: subsidioSchema,
  congresso: congressoSchema.nullish(),
})

export type RemuneracaoEstatica = z.infer<typeof remuneracaoEstaticaSchema>

export const posicaoNaDistribuicao = (
  valor: number,
  { mediana }: Distribuicao,
) => {
  if (mediana <= 0) return 0
  return (valor - mediana) / mediana
}

export type NivelNaDistribuicao = "dentro" | "acima" | "atipico"

/**
 * Classifica um valor contra a faixa típica da casa: até o p75 é "dentro",
 * até a cerca de Tukey (p75 + 1,5×IQR) é "acima", além disso é "atipico".
 */
export const nivelNaDistribuicao = (
  valor: number,
  { p25, p75, amostra }: Distribuicao,
): NivelNaDistribuicao => {
  if (amostra === 0) return "dentro"
  if (valor <= p75) return "dentro"
  return valor <= p75 + 1.5 * (p75 - p25) ? "acima" : "atipico"
}

export const percentil = (valores: number[], fracao: number) => {
  if (valores.length === 0) return 0
  const ordenados = [...valores].sort((a, b) => a - b)
  const posicao = (ordenados.length - 1) * fracao
  const inferior = Math.floor(posicao)
  const superior = Math.ceil(posicao)
  const base = ordenados[inferior] ?? 0
  if (inferior === superior) return base
  const topo = ordenados[superior] ?? base
  return base + (topo - base) * (posicao - inferior)
}

export const distribuicaoDe = (valores: number[]): Distribuicao => {
  if (valores.length === 0) {
    return { mediana: 0, media: 0, p25: 0, p75: 0, minimo: 0, maximo: 0, amostra: 0 }
  }
  const ordenados = [...valores].sort((a, b) => a - b)
  const soma = ordenados.reduce((total, valor) => total + valor, 0)
  return {
    mediana: percentil(ordenados, 0.5),
    media: soma / ordenados.length,
    p25: percentil(ordenados, 0.25),
    p75: percentil(ordenados, 0.75),
    minimo: ordenados[0] ?? 0,
    maximo: ordenados[ordenados.length - 1] ?? 0,
    amostra: ordenados.length,
  }
}
