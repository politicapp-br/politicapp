import { unzipSync } from "fflate"

import type { Parlamentar } from "@politicapp/data"
import { z } from "zod"

import { log } from "../config"
import { lerCsvComCabecalho, numeroBr } from "../csv"
import { buscarBinario, buscarJson, emLotes } from "../http"
import { janelasMensais } from "../periodo"
import { validarItens } from "../validacao"

const API = "https://dadosabertos.camara.leg.br/api/v2"
const COTAS = "https://www.camara.leg.br/cotas"
const ITENS_POR_PAGINA = 100

type RespostaLista<T> = {
  dados: T[]
  links: { rel: string; href: string }[]
}

/** Campo que a API às vezes manda nulo e às vezes omite: vira sempre null. */
const opcional = <T extends z.ZodType>(schema: T) =>
  schema.nullish().transform((valor) => valor ?? null)

const deputadoApiSchema = z.object({
  id: z.number(),
  nome: z.string(),
  siglaPartido: z.string().nullish(),
  siglaUf: z.string().nullish(),
  urlFoto: z.string().nullish(),
  email: z.string().nullish(),
})

const paginar = async <T>(urlInicial: string): Promise<T[]> => {
  const acumulado: T[] = []
  let url: string | undefined = urlInicial

  while (url) {
    const resposta: RespostaLista<T> = await buscarJson<RespostaLista<T>>(url)
    acumulado.push(...resposta.dados)
    url = resposta.links.find((link) => link.rel === "next")?.href
  }

  return acumulado
}

export const listarDeputados = async (): Promise<Parlamentar[]> => {
  const deputados = validarItens(
    "câmara: deputados",
    await paginar<unknown>(`${API}/deputados?ordem=ASC&ordenarPor=nome&itens=${ITENS_POR_PAGINA}`),
    deputadoApiSchema,
  )

  log(`câmara: ${deputados.length} deputados em exercício`)

  return deputados.map((deputado) => ({
    casa: "camara" as const,
    id: String(deputado.id),
    nome: deputado.nome,
    nomeCivil: null,
    partido: deputado.siglaPartido ?? "—",
    uf: deputado.siglaUf ?? "—",
    fotoUrl: deputado.urlFoto ?? null,
    email: deputado.email ?? null,
    emExercicio: true,
  }))
}

export type LancamentoDespesa = {
  parlamentarId: string
  ano: number
  mes: number
  tipo: string
  fornecedor: string
  cnpjCpf: string | null
  valor: number
  documentoUrl: string | null
  /** Emissão do documento (AAAA-MM-DD), quando a fonte informa. */
  data: string | null
  /** Valor recusado pela casa no reembolso — só a Câmara publica. */
  glosa: number
  /** CPF do deputado (só dígitos) — chave para o TSE, nunca publicado. */
  cpfParlamentar?: string
}

export const baixarDespesasCamara = async (
  ano: number,
): Promise<LancamentoDespesa[]> => {
  const url = `${COTAS}/Ano-${ano}.csv.zip`
  log(`câmara: baixando ${url}`)

  const zip = unzipSync(await buscarBinario(url))
  const arquivo = Object.entries(zip).find(([nome]) => nome.endsWith(".csv"))
  if (!arquivo) {
    throw new Error("Zip de cotas da Câmara não contém CSV")
  }

  const linhas = lerCsvComCabecalho(
    new TextDecoder("utf-8").decode(arquivo[1]),
  )
  log(`câmara: ${linhas.length} lançamentos de cota em ${ano}`)

  return linhas
    .filter((linha) => linha.ideCadastro)
    .map((linha) => ({
      parlamentarId: String(linha.ideCadastro),
      ano: Number(linha.numAno) || ano,
      mes: Number(linha.numMes) || 0,
      tipo: linha.txtDescricao ?? "",
      fornecedor: linha.txtFornecedor ?? "",
      cnpjCpf: linha.txtCNPJCPF || null,
      valor: numeroBr(linha.vlrLiquido),
      documentoUrl: linha.urlDocumento || null,
      data: linha.datEmissao?.slice(0, 10) || null,
      glosa: numeroBr(linha.vlrGlosa),
      cpfParlamentar: linha.cpf?.replace(/\D/g, "") || undefined,
    }))
    // Lançamento glosado por inteiro tem valor líquido zero, mas a glosa conta.
    .filter((despesa) => despesa.valor > 0 || despesa.glosa > 0)
}

export type PartidoApi = {
  id: number
  sigla: string
  nome: string
}

export const listarPartidos = async (): Promise<PartidoApi[]> => {
  const partidos = await paginar<PartidoApi>(
    `${API}/partidos?itens=${ITENS_POR_PAGINA}&ordem=ASC&ordenarPor=sigla`,
  )
  log(`câmara: ${partidos.length} partidos com representação`)
  return partidos
}

export type LiderPartidoApi = {
  id: number
  nome: string
  titulo: string | null
  dataInicio: string | null
  dataFim: string | null
}

export const listarLideresDoPartido = (
  partidoId: number,
): Promise<LiderPartidoApi[]> => paginar<LiderPartidoApi>(`${API}/partidos/${partidoId}/lideres`)

const LEGISLATURA_ATUAL = 57

export type FrenteApi = {
  id: number
  titulo: string
}

export const listarFrentes = async (): Promise<FrenteApi[]> => {
  const frentes = await paginar<FrenteApi>(
    `${API}/frentes?idLegislatura=${LEGISLATURA_ATUAL}&itens=${ITENS_POR_PAGINA}`,
  )
  log(`câmara: ${frentes.length} frentes na legislatura ${LEGISLATURA_ATUAL}`)
  return frentes
}

export type MembroFrenteApi = {
  id: number
  titulo: string | null
}

/** O recurso de membros rejeita o parâmetro `itens` com HTTP 400. */
export const listarMembrosDaFrente = (frenteId: number): Promise<MembroFrenteApi[]> =>
  paginar<MembroFrenteApi>(`${API}/frentes/${frenteId}/membros`)

const votacaoCamaraApiSchema = z.object({
  id: z.string(),
  data: z.string(),
  descricao: z.string(),
  siglaOrgao: opcional(z.string()),
  aprovacao: opcional(z.number()),
  proposicaoObjeto: opcional(z.string()),
})

export type VotacaoCamaraApi = z.infer<typeof votacaoCamaraApiSchema>

type ProposicaoAfetadaApi = {
  id: number | null
  siglaTipo: string | null
  numero: number | null
  ano: number | null
  ementa: string | null
}

type VotacaoDetalheApi = VotacaoCamaraApi & {
  proposicoesAfetadas: ProposicaoAfetadaApi[] | null
}

const PLENARIO = "PLEN"

export const listarVotacoesCamara = async (
  ano: number,
): Promise<VotacaoCamaraApi[]> => {
  const janelas = janelasMensais(ano)
  const porJanela = await emLotes(janelas, ({ inicio, fim }) =>
    paginar<unknown>(
      `${API}/votacoes?dataInicio=${inicio}&dataFim=${fim}&ordem=DESC&ordenarPor=dataHoraRegistro&itens=${ITENS_POR_PAGINA}`,
    ),
  )

  const todas = validarItens("câmara: votações", porJanela.flat(), votacaoCamaraApiSchema)
  const doPlenario = todas.filter(
    (votacao) => votacao.siglaOrgao?.toUpperCase() === PLENARIO,
  )

  log(
    `câmara: ${todas.length} votações no ano, ${doPlenario.length} no plenário`,
  )

  return doPlenario
}

export type EventoCamaraApi = {
  id: number
  dataHoraInicio: string
  situacao: string | null
  descricaoTipo: string | null
  orgaos: { sigla: string | null; nome: string | null; apelido: string | null }[]
}

export const listarEventosCamara = async (
  inicio: string,
  fim: string,
): Promise<EventoCamaraApi[]> => {
  const eventos = await paginar<EventoCamaraApi>(
    `${API}/eventos?dataInicio=${inicio}&dataFim=${fim}&ordem=ASC&ordenarPor=dataHoraInicio&itens=${ITENS_POR_PAGINA}`,
  )
  log(`câmara: ${eventos.length} eventos entre ${inicio} e ${fim}`)
  return eventos
}

export type ItemPautaCamaraApi = {
  ordem: number | null
  proposicao_: {
    siglaTipo: string | null
    numero: number | null
    ano: number | null
    ementa: string | null
  } | null
}

export const listarPautaDoEvento = async (
  eventoId: number,
): Promise<ItemPautaCamaraApi[]> => {
  const resposta = await buscarJson<RespostaLista<ItemPautaCamaraApi>>(
    `${API}/eventos/${eventoId}/pauta`,
  )
  return resposta.dados
}

const votoCamaraApiSchema = z.object({
  tipoVoto: z.string().nullish(),
  deputado_: z.object({
    id: z.number(),
    nome: z.string(),
    siglaPartido: z.string().nullish(),
    siglaUf: z.string().nullish(),
  }),
})

export type VotoCamaraApi = z.infer<typeof votoCamaraApiSchema>

export const listarVotosCamara = async (votacaoId: string) => {
  const resposta = await buscarJson<RespostaLista<unknown>>(`${API}/votacoes/${votacaoId}/votos`)
  return validarItens(`câmara: votos de ${votacaoId}`, resposta.dados, votoCamaraApiSchema)
}

const orientacaoCamaraApiSchema = z.object({
  orientacaoVoto: z.string().nullish(),
  siglaPartidoBloco: z.string().nullish(),
})

export type OrientacaoCamaraApi = z.infer<typeof orientacaoCamaraApiSchema>

/** Orientações das lideranças (partidos, blocos, governo) numa votação. */
export const listarOrientacoesCamara = async (
  votacaoId: string,
): Promise<OrientacaoCamaraApi[]> => {
  const resposta = await buscarJson<RespostaLista<unknown>>(
    `${API}/votacoes/${votacaoId}/orientacoes`,
  )
  return validarItens(`câmara: orientações de ${votacaoId}`, resposta.dados, orientacaoCamaraApiSchema)
}

export type ProposicaoResumoApi = {
  id: number
  siglaTipo: string | null
  numero: number | null
  ano: number | null
  ementa: string | null
}

/**
 * Proposições que tiveram alguma tramitação na janela. O filtro fino por
 * situação não dá para fazer aqui: quando `dataInicio`/`dataFim` estão
 * presentes a API ignora `codSituacao` — o corte por marco acontece depois,
 * proposição a proposição, no detalhe.
 */
export const listarProposicoesTramitadas = async (
  inicio: string,
  fim: string,
  siglas: string[],
): Promise<ProposicaoResumoApi[]> => {
  const filtroSiglas = siglas
    .map((sigla) => `siglaTipo=${encodeURIComponent(sigla)}`)
    .join("&")

  const proposicoes = await paginar<ProposicaoResumoApi>(
    `${API}/proposicoes?dataInicio=${inicio}&dataFim=${fim}&${filtroSiglas}&itens=${ITENS_POR_PAGINA}`,
  )

  log(
    `câmara: ${proposicoes.length} proposições tramitaram entre ${inicio} e ${fim}`,
  )
  return proposicoes
}

export type StatusProposicaoApi = {
  dataHora: string | null
  codSituacao: number | null
  descricaoSituacao: string | null
  despacho: string | null
}

export const buscarStatusProposicao = async (
  proposicaoId: number,
): Promise<StatusProposicaoApi | null> => {
  const { dados } = await buscarJson<{
    dados: { statusProposicao: StatusProposicaoApi | null }
  }>(`${API}/proposicoes/${proposicaoId}`)

  return dados.statusProposicao ?? null
}

/** A proposição votada (com ementa) só existe no recurso de detalhe da votação. */
export const buscarProposicaoDaVotacao = async (votacaoId: string) => {
  const { dados } = await buscarJson<{ dados: VotacaoDetalheApi }>(
    `${API}/votacoes/${votacaoId}`,
  )

  const afetada = dados.proposicoesAfetadas?.[0]
  if (!afetada?.siglaTipo) return null

  const numeracao =
    afetada.numero && afetada.ano ? ` ${afetada.numero}/${afetada.ano}` : ""

  return {
    id: afetada.id === null || afetada.id === undefined ? null : String(afetada.id),
    sigla: `${afetada.siglaTipo}${numeracao}`,
    ementa: afetada.ementa ?? null,
  }
}
