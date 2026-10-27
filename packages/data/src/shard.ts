import { z } from "zod"

import { afinidadeSchema } from "./afinidade"
import { discursoSchema, participacaoEmOrgaoSchema, trajetoriaSchema } from "./atuacao"
import { alinhamentoParlamentarSchema } from "./agregados"
import { resumoDespesasSchema } from "./despesa"
import { historicoEleitoralSchema, territorioEleitoralSchema } from "./eleitoral"
import { resumoEmendasSchema } from "./emenda"
import { fornecedoresDoParlamentarSchema } from "./fornecedor"
import { frenteSchema } from "./frente"
import { historicoMandatoSchema } from "./historico"
import { mandatoParlamentarSchema } from "./mandato"
import { orientacaoSchema } from "./orientacao"
import { casaSchema, parlamentarDetalheSchema, type ParlamentarRef } from "./parlamentar"
import { presencaSchema } from "./presenca"
import { producaoLegislativaSchema } from "./producao"
import { proposicaoSchema } from "./proposicao"
import { custoParlamentarSchema } from "./remuneracao"
import { fornecedorSancionadoSchema } from "./sancao"
import { tipoVotoSchema, votacaoDetalheSchema } from "./votacao"

/**
 * Seções do arquivo de um parlamentar (`parlamentar/{casa}/{id}.json`). Cada
 * etapa do pipeline escreve só a sua; seção ausente quer dizer "nunca
 * calculada ou fonte fora do ar", e seção nula ou vazia quer dizer "calculada,
 * não há nada". O app valida seção por seção, então uma seção quebrada não
 * derruba a tela inteira.
 */
export const secoesParlamentarSchemas = {
  /** Cota do ano corrente; nulo = sem lançamento no ano. */
  despesas: resumoDespesasSchema.nullable(),
  /** Moradia, gabinete e diárias; nulo = fonte sem registro para ele. */
  custo: custoParlamentarSchema.nullable(),
  mandato: mandatoParlamentarSchema.nullable(),
  /** Do ano mais recente para o mais antigo. */
  emendas: z.array(resumoEmendasSchema),
  /** Frentes com título resolvido; `papel` ausente = membro comum. */
  frentes: z.array(frenteSchema.extend({ papel: z.string().nullish() })),
  /** Fornecedores da cota que estão hoje no CEIS. */
  sancoes: z.array(fornecedorSancionadoSchema),
  /** Alinhamento com o próprio partido nas nominais do ano. */
  alinhamento: alinhamentoParlamentarSchema.nullable(),
  /**
   * Voto em cada votação de `votacoes.json`. Só vale cruzar os dois quando o
   * `conjunto` bate (mesma execução): aí votação sem entrada aqui = não
   * registrou voto. Com caches de idades diferentes, não dá para afirmar isso.
   */
  votos: z.object({
    ano: z.number(),
    conjunto: z.string(),
    votacoes: z.array(z.object({ id: z.string(), voto: tipoVotoSchema })),
  }),
  /** Para quem foi a cota do ano e quanto foi glosado; nulo = sem lançamento. */
  fornecedores: fornecedoresDoParlamentarSchema.nullable(),
  /**
   * Colegas que votam igual, votos contra o partido, governo e votações
   * apertadas, sobre as mesmas nominais de `votacao/`. Nulo = nenhum voto
   * sim/não no ano.
   */
  afinidade: afinidadeSchema.nullable(),
  /** Proposições apresentadas na legislatura e as que andaram. */
  producao: producaoLegislativaSchema,
  /** Frequência oficial do portal da Câmara; nulo = página sem o bloco. */
  presenca: presencaSchema.nullable(),
  /** Partidos, licenças e afastamentos e, no Senado, suplentes. */
  historico: historicoMandatoSchema,
  /** Candidaturas no TSE, mais recente primeiro. */
  eleicoes: historicoEleitoralSchema,
  /** Onde foi votado na eleição do mandato e emendas para lá; nulo = sem votos próprios. */
  territorio: territorioEleitoralSchema.nullable(),
  // As cinco abaixo vêm do job de perfis (renovação gradual, não do diário).
  /** Ficha do parlamentar: nascimento, escolaridade, contato, gabinete. */
  perfil: parlamentarDetalheSchema,
  /** Proposições mais recentes de que é autor; só a Câmara. */
  proposicoes: z.array(proposicaoSchema),
  /** Comissões e demais órgãos de que participa. */
  orgaos: z.array(participacaoEmOrgaoSchema),
  /** Discursos da janela recente (ver JANELA_DISCURSOS_MESES). */
  discursos: z.array(discursoSchema),
  /** Mandatos anteriores e ocupações; só a Câmara publica. */
  trajetoria: trajetoriaSchema,
} as const

/**
 * Seções que não pertencem a um ano: na virada do ano ficam como estão até
 * serem renovadas, em vez de descartadas como as do ano anterior.
 */
export const SECOES_ATEMPORAIS: ReadonlySet<string> = new Set([
  "historico",
  "eleicoes",
  "territorio",
  "perfil",
  "proposicoes",
  "orgaos",
  "discursos",
  "trajetoria",
])

/** Janela dos discursos publicados no shard, em meses até a data da renovação. */
export const JANELA_DISCURSOS_MESES = 6

export type SecoesParlamentar = {
  [K in keyof typeof secoesParlamentarSchemas]: z.infer<
    (typeof secoesParlamentarSchemas)[K]
  >
}

export type NomeSecao = keyof SecoesParlamentar

export const NOMES_SECOES = Object.keys(secoesParlamentarSchemas) as NomeSecao[]

/**
 * Envelope frouxo: só identidade e ano são obrigatórios. As seções são
 * validadas uma a uma por `secoesValidas`, nunca em bloco.
 */
export const shardParlamentarEnvelopeSchema = z
  .object({
    casa: casaSchema,
    id: z.string(),
    ano: z.number(),
    geradoEm: z.string(),
    renovadoEm: z.record(z.string(), z.string()).optional(),
  })
  .catchall(z.unknown())

export type ShardParlamentar = {
  casa: ParlamentarRef["casa"]
  id: string
  ano: number
  geradoEm: string
  /** Quando cada seção foi recalculada pela última vez (ISO). */
  renovadoEm?: Record<string, string>
} & Partial<SecoesParlamentar>

/** Schema estrito, usado pelo pipeline antes de escrever. */
export const shardParlamentarSchema = z.object({
  casa: casaSchema,
  id: z.string(),
  ano: z.number(),
  geradoEm: z.string(),
  renovadoEm: z.record(z.string(), z.string()).optional(),
  ...Object.fromEntries(
    NOMES_SECOES.map((nome) => [nome, secoesParlamentarSchemas[nome].optional()]),
  ),
}) as unknown as z.ZodType<ShardParlamentar>

/**
 * Valida cada seção isoladamente. Seção fora do contrato vira ausente e entra
 * em `invalidas`, para o chamador reportar sem perder o resto do arquivo.
 */
export const secoesValidas = (
  bruto: Record<string, unknown>,
): { secoes: Partial<SecoesParlamentar>; invalidas: NomeSecao[] } => {
  const secoes: Partial<Record<NomeSecao, unknown>> = {}
  const invalidas: NomeSecao[] = []

  for (const nome of NOMES_SECOES) {
    if (!(nome in bruto)) continue
    const analise = secoesParlamentarSchemas[nome].safeParse(bruto[nome])
    if (analise.success) secoes[nome] = analise.data
    else invalidas.push(nome)
  }

  return { secoes: secoes as Partial<SecoesParlamentar>, invalidas }
}

export const caminhoParlamentar = ({ casa, id }: ParlamentarRef) =>
  `parlamentar/${casa}/${id}`

/**
 * Uma votação nominal (`votacao/{casa}/{id}.json`): detalhe, votos
 * individuais e, na Câmara, a orientação de cada bancada.
 */
export const votacaoEstaticaSchema = votacaoDetalheSchema.extend({
  geradoEm: z.string(),
  orientacoes: z.array(orientacaoSchema),
})

export type VotacaoEstatica = z.infer<typeof votacaoEstaticaSchema>

export const caminhoVotacao = (casa: ParlamentarRef["casa"], id: string) =>
  `votacao/${casa}/${id}`
