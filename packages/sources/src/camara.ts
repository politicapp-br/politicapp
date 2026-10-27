import {
  contarPlacar,
  descricaoSemPlacar,
  ladoDaOrientacao,
  placarDaDescricao,
  placarVazio,
  tipoVotoDaCamara,
  type AutorProposicao,
  type Discurso,
  type MandatoExterno,
  type Ocupacao,
  type Orientacao,
  type ParlamentarDetalhe,
  type ParticipacaoEmOrgao,
  type Proposicao,
  type ProposicaoDetalhe,
  type Trajetoria,
  type Tramitacao,
  type Votacao,
  type VotacaoDetalhe,
  type Voto,
} from "@politicapp/data"
import { format } from "date-fns"
import { z } from "zod"

import { bindFetchJson, type FetchJson } from "./fetch-json"
import { truncateSummary } from "./text"

const API = "https://dadosabertos.camara.leg.br/api/v2"
const SOURCE = "camara"

const listOf = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ dados: z.array(item) })

const deputadoDetailsSchema = z.object({
  dados: z.object({
    id: z.number(),
    nomeCivil: z.string().nullish(),
    ultimoStatus: z.object({
      nome: z.string(),
      siglaPartido: z.string().nullish(),
      siglaUf: z.string().nullish(),
      urlFoto: z.string().nullish(),
      email: z.string().nullish(),
      gabinete: z
        .object({ telefone: z.string().nullish(), sala: z.string().nullish() })
        .nullish(),
    }),
    dataNascimento: z.string().nullish(),
    municipioNascimento: z.string().nullish(),
    ufNascimento: z.string().nullish(),
    escolaridade: z.string().nullish(),
    urlWebsite: z.string().nullish(),
  }),
})

const fetchDeputado = async (
  fetchJson: FetchJson,
  id: string,
): Promise<ParlamentarDetalhe> => {
  const { dados } = await fetchJson(
    `${API}/deputados/${id}`,
    deputadoDetailsSchema,
    { source: SOURCE },
  )

  return {
    casa: "camara",
    id: String(dados.id),
    nome: dados.ultimoStatus.nome,
    nomeCivil: dados.nomeCivil ?? null,
    partido: dados.ultimoStatus.siglaPartido ?? "—",
    uf: dados.ultimoStatus.siglaUf ?? "—",
    fotoUrl: dados.ultimoStatus.urlFoto ?? null,
    email: dados.ultimoStatus.email ?? null,
    emExercicio: true,
    nascimento: dados.dataNascimento ?? null,
    municipioNascimento: dados.municipioNascimento ?? null,
    ufNascimento: dados.ufNascimento ?? null,
    escolaridade: dados.escolaridade ?? null,
    telefone: dados.ultimoStatus.gabinete?.telefone ?? null,
    site: dados.urlWebsite ?? null,
    gabinete: dados.ultimoStatus.gabinete?.sala ?? null,
  }
}

const proposicaoApiSchema = z.object({
  id: z.number(),
  siglaTipo: z.string(),
  numero: z.number(),
  ano: z.number(),
  ementa: z.string().nullish(),
  dataApresentacao: z.string().nullish(),
})

const NO_EMENTA = "Sem ementa disponível"

// A Câmara devolve campos "preenchidos" com pontuação solta (".", "-").
const HAS_CONTENT = /[0-9A-Za-zÀ-ÿ]/

const textOrNull = (value: string | null | undefined) => {
  const text = value?.trim() ?? ""
  return HAS_CONTENT.test(text) ? text : null
}

const PLACEHOLDER_VALUES = new Set([
  "indefinida",
  "indefinido",
  "não informado",
  "nao informado",
  "não informada",
])

/** Como `textOrNull`, mas também descarta rótulos que não dizem nada ao leitor. */
const meaningfulText = (value: string | null | undefined) => {
  const text = textOrNull(value)
  return text && !PLACEHOLDER_VALUES.has(text.toLowerCase()) ? text : null
}

export const camaraProposicaoUrl = (id: string) =>
  `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${id}`

const fetchDeputadoProposicoes = async (
  fetchJson: FetchJson,
  id: string,
): Promise<Proposicao[]> => {
  const { dados } = await fetchJson(
    `${API}/proposicoes?idDeputadoAutor=${id}&ordem=DESC&ordenarPor=id&itens=20`,
    listOf(proposicaoApiSchema),
    { source: SOURCE },
  )

  return dados.map((proposicao) => ({
    casa: "camara" as const,
    id: String(proposicao.id),
    sigla: proposicao.siglaTipo,
    numero: proposicao.numero,
    ano: proposicao.ano,
    ementa: textOrNull(proposicao.ementa) ?? NO_EMENTA,
    resumo: null,
    apresentadaEm: proposicao.dataApresentacao ?? null,
    situacao: null,
    temas: [],
  }))
}

const statusApiSchema = z.object({
  dataHora: z.string().nullish(),
  siglaOrgao: z.string().nullish(),
  descricaoSituacao: z.string().nullish(),
  descricaoTramitacao: z.string().nullish(),
  despacho: z.string().nullish(),
  regime: z.string().nullish(),
  apreciacao: z.string().nullish(),
})

const proposicaoDetailsApiSchema = z.object({
  dados: proposicaoApiSchema.extend({
    descricaoTipo: z.string().nullish(),
    ementaDetalhada: z.string().nullish(),
    keywords: z.string().nullish(),
    urlInteiroTeor: z.string().nullish(),
    statusProposicao: statusApiSchema.nullish(),
  }),
})

const authorApiSchema = z.object({
  uri: z.string().nullish(),
  nome: z.string(),
  tipo: z.string().nullish(),
  proponente: z.number().nullish(),
  ordemAssinatura: z.number().nullish(),
})

const tramitacaoApiSchema = statusApiSchema.extend({
  sequencia: z.number().nullish(),
})

const themeApiSchema = z.object({ tema: z.string() })

const DEPUTADO_ID_PATTERN = /\/deputados\/(\d+)/

/**
 * Palavras-chave vêm num único campo separado por vírgula ou ponto e vírgula,
 * às vezes com o ponto final da frase grudado no último termo.
 */
const splitKeywords = (keywords: string | null | undefined) =>
  (keywords ?? "")
    .split(/[;,]/)
    .map((keyword) => keyword.trim().replace(/\.$/, ""))
    .filter((keyword) => keyword.length > 0)

const fetchProposicao = async (
  fetchJson: FetchJson,
  id: string,
): Promise<ProposicaoDetalhe> => {
  const [{ dados }, apiAuthors, apiTramitacoes, apiThemes] = await Promise.all([
    fetchJson(`${API}/proposicoes/${id}`, proposicaoDetailsApiSchema, {
      source: SOURCE,
    }),
    fetchJson(`${API}/proposicoes/${id}/autores`, listOf(authorApiSchema), {
      source: SOURCE,
    }).then(({ dados }) => dados),
    fetchJson(
      `${API}/proposicoes/${id}/tramitacoes`,
      listOf(tramitacaoApiSchema),
      { source: SOURCE },
    ).then(({ dados }) => dados),
    fetchJson(`${API}/proposicoes/${id}/temas`, listOf(themeApiSchema), {
      source: SOURCE,
    }).then(({ dados }) => dados),
  ])

  const status = dados.statusProposicao

  const authors: AutorProposicao[] = [...apiAuthors]
    .sort(
      (a, b) =>
        (b.proponente ?? 0) - (a.proponente ?? 0) ||
        (a.ordemAssinatura ?? 0) - (b.ordemAssinatura ?? 0),
    )
    .map((author) => {
      const deputadoId = author.uri?.match(DEPUTADO_ID_PATTERN)?.[1] ?? null

      return {
        nome: author.nome,
        tipo: textOrNull(author.tipo) ?? "Autor(a)",
        parlamentar: deputadoId ? { casa: "camara" as const, id: deputadoId } : null,
        proponente: (author.proponente ?? 0) === 1,
      }
    })

  const tramitacoes: Tramitacao[] = apiTramitacoes
    .filter((step): step is typeof step & { dataHora: string } =>
      Boolean(step.dataHora),
    )
    .map((step) => ({
      data: step.dataHora,
      orgao: textOrNull(step.siglaOrgao),
      descricao: textOrNull(step.descricaoTramitacao) ?? "Tramitação",
      situacao: meaningfulText(step.descricaoSituacao),
      despacho: textOrNull(step.despacho),
    }))
    .reverse()

  return {
    casa: "camara",
    id: String(dados.id),
    sigla: dados.siglaTipo,
    numero: dados.numero,
    ano: dados.ano,
    ementa: textOrNull(dados.ementa) ?? NO_EMENTA,
    resumo: null,
    apresentadaEm: dados.dataApresentacao ?? null,
    situacao: meaningfulText(status?.descricaoSituacao),
    temas: apiThemes.map(({ tema }) => tema),
    tipoPorExtenso: textOrNull(dados.descricaoTipo),
    ementaDetalhada: textOrNull(dados.ementaDetalhada),
    palavrasChave: splitKeywords(dados.keywords),
    orgaoAtual: textOrNull(status?.siglaOrgao),
    regime: meaningfulText(status?.regime),
    apreciacao: meaningfulText(status?.apreciacao),
    despacho: textOrNull(status?.despacho),
    atualizadaEm: status?.dataHora ?? null,
    urlInteiroTeor: textOrNull(dados.urlInteiroTeor),
    urlFonte: camaraProposicaoUrl(String(dados.id)),
    autores: authors,
    tramitacoes,
  }
}

const committeeApiSchema = z.object({
  siglaOrgao: z.string().nullish(),
  nomeOrgao: z.string().nullish(),
  titulo: z.string().nullish(),
  dataInicio: z.string().nullish(),
  dataFim: z.string().nullish(),
})

const fetchDeputadoCommittees = async (
  fetchJson: FetchJson,
  id: string,
): Promise<ParticipacaoEmOrgao[]> => {
  const { dados } = await fetchJson(
    `${API}/deputados/${id}/orgaos?ordem=DESC&ordenarPor=dataInicio&itens=100`,
    listOf(committeeApiSchema),
    { source: SOURCE },
  )

  // Só participação vigente: o histórico encerrado não aparece no app.
  return dados.flatMap<ParticipacaoEmOrgao>((committee) => {
    if (!committee.siglaOrgao || !committee.nomeOrgao || committee.dataFim) return []
    return [
      {
        sigla: committee.siglaOrgao,
        nome: committee.nomeOrgao,
        papel: textOrNull(committee.titulo) ?? "Membro",
        inicio: committee.dataInicio ?? null,
        fim: committee.dataFim ?? null,
      },
    ]
  })
}

const speechApiSchema = z.object({
  dataHoraInicio: z.string().nullish(),
  tipoDiscurso: z.string().nullish(),
  sumario: z.string().nullish(),
  transcricao: z.string().nullish(),
  urlTexto: z.string().nullish(),
})

const fetchDeputadoSpeeches = async (
  fetchJson: FetchJson,
  id: string,
  start: Date,
  end: Date,
): Promise<Discurso[]> => {
  const dateRange = `dataInicio=${format(start, "yyyy-MM-dd")}&dataFim=${format(end, "yyyy-MM-dd")}`
  const { dados } = await fetchJson(
    `${API}/deputados/${id}/discursos?${dateRange}&ordenarPor=dataHoraInicio&ordem=DESC&itens=50`,
    listOf(speechApiSchema),
    { source: SOURCE },
  )

  return dados.flatMap<Discurso>((speech) => {
    if (!speech.dataHoraInicio) return []
    return [
      {
        data: speech.dataHoraInicio,
        tipo: textOrNull(speech.tipoDiscurso),
        resumo: truncateSummary(
          textOrNull(speech.sumario) ?? textOrNull(speech.transcricao),
        ),
        urlTexto: textOrNull(speech.urlTexto),
      },
    ]
  })
}

// A Câmara devolve os anos dos mandatos externos como texto ("1993").
const apiYear = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((value) => {
    const year = Number(value)
    return Number.isInteger(year) && year > 0 ? year : null
  })

const externalTermApiSchema = z.object({
  cargo: z.string().nullish(),
  siglaUf: z.string().nullish(),
  municipio: z.string().nullish(),
  anoInicio: apiYear,
  anoFim: apiYear,
  siglaPartidoEleicao: z.string().nullish(),
})

const occupationApiSchema = z.object({
  titulo: z.string().nullish(),
  entidade: z.string().nullish(),
  anoInicio: apiYear,
  anoFim: apiYear,
})

const fetchDeputadoCareer = async (
  fetchJson: FetchJson,
  id: string,
): Promise<Trajetoria> => {
  const [apiTerms, apiOccupations] = await Promise.all([
    fetchJson(
      `${API}/deputados/${id}/mandatosExternos`,
      listOf(externalTermApiSchema),
      { source: SOURCE },
    ).then(({ dados }) => dados),
    fetchJson(`${API}/deputados/${id}/ocupacoes`, listOf(occupationApiSchema), {
      source: SOURCE,
    }).then(({ dados }) => dados),
  ])

  const externalTerms = apiTerms
    .flatMap<MandatoExterno>((term) => {
      const cargo = textOrNull(term.cargo)
      if (!cargo) return []
      return [
        {
          cargo,
          uf: textOrNull(term.siglaUf),
          municipio: textOrNull(term.municipio),
          anoInicio: term.anoInicio,
          anoFim: term.anoFim,
          partido: textOrNull(term.siglaPartidoEleicao),
        },
      ]
    })
    .sort((a, b) => (b.anoInicio ?? 0) - (a.anoInicio ?? 0))

  // A API preenche ocupações vazias com uma linha toda nula.
  const occupations = apiOccupations
    .flatMap<Ocupacao>((occupation) => {
      const title = textOrNull(occupation.titulo)
      if (!title) return []
      return [
        {
          titulo: title,
          entidade: textOrNull(occupation.entidade),
          anoInicio: occupation.anoInicio,
          anoFim: occupation.anoFim,
        },
      ]
    })
    .sort((a, b) => (b.anoInicio ?? 0) - (a.anoInicio ?? 0))

  return { mandatosExternos: externalTerms, ocupacoes: occupations }
}

const votacaoApiSchema = z.object({
  id: z.string(),
  data: z.string(),
  descricao: z.string(),
  aprovacao: z.number().nullish(),
  siglaOrgao: z.string().nullish(),
})

const approvalFrom = (aprovacao: number | null | undefined) =>
  aprovacao === null || aprovacao === undefined ? null : aprovacao === 1

const votoApiSchema = z.object({
  tipoVoto: z.string().nullish(),
  deputado_: z.object({
    id: z.number(),
    nome: z.string(),
    siglaPartido: z.string().nullish(),
    siglaUf: z.string().nullish(),
  }),
})

const affectedProposicaoSchema = z.object({
  id: z.number().nullish(),
  siglaTipo: z.string().nullish(),
  numero: z.number().nullish(),
  ano: z.number().nullish(),
  ementa: z.string().nullish(),
})

const votacaoDetailsApiSchema = votacaoApiSchema.extend({
  proposicoesAfetadas: z.array(affectedProposicaoSchema).nullish(),
})

const affectedProposicaoFrom = (
  affected: z.infer<typeof affectedProposicaoSchema>[] | null | undefined,
): Votacao["proposicao"] => {
  const first = affected?.[0]
  if (!first?.siglaTipo) return null

  const numbering =
    first.numero && first.ano ? ` ${first.numero}/${first.ano}` : ""

  return {
    id: first.id === null || first.id === undefined ? null : String(first.id),
    sigla: `${first.siglaTipo}${numbering}`,
    ementa: first.ementa ?? null,
  }
}

const orientacaoApiSchema = z.object({
  orientacaoVoto: z.string().nullish(),
  siglaPartidoBloco: z.string().nullish(),
})

/** Orientações das lideranças (partidos, blocos, governo) para uma votação. */
const fetchOrientacoes = async (
  fetchJson: FetchJson,
  id: string,
): Promise<Orientacao[]> => {
  const { dados } = await fetchJson(
    `${API}/votacoes/${id}/orientacoes`,
    listOf(orientacaoApiSchema),
    { source: SOURCE },
  )

  return dados.flatMap((orientacao) => {
    const bancada = orientacao.siglaPartidoBloco?.trim()
    if (!bancada) return []
    return [{ bancada, lado: ladoDaOrientacao(orientacao.orientacaoVoto) }]
  })
}

const fetchCamaraVotacao = async (
  fetchJson: FetchJson,
  id: string,
): Promise<VotacaoDetalhe> => {
  const [{ dados: details }, { dados: apiVotos }] = await Promise.all([
    fetchJson(
      `${API}/votacoes/${id}`,
      z.object({ dados: votacaoDetailsApiSchema }),
      { source: SOURCE },
    ),
    fetchJson(`${API}/votacoes/${id}/votos`, listOf(votoApiSchema), {
      source: SOURCE,
    }),
  ])

  const votos: Voto[] = apiVotos.map((voto) => ({
    casa: "camara" as const,
    id: String(voto.deputado_.id),
    nome: voto.deputado_.nome,
    partido: voto.deputado_.siglaPartido ?? "—",
    uf: voto.deputado_.siglaUf ?? "—",
    voto: tipoVotoDaCamara(voto.tipoVoto),
  }))

  // Quando a votação é simbólica não há votos individuais; nesse caso o placar
  // escrito na descrição é a única contagem que existe.
  const tally =
    votos.length > 0
      ? contarPlacar(votos)
      : (placarDaDescricao(details.descricao) ?? placarVazio)

  return {
    casa: "camara",
    id: details.id,
    data: details.data,
    descricao: descricaoSemPlacar(details.descricao),
    resumo: null,
    proposicao: affectedProposicaoFrom(details.proposicoesAfetadas),
    aprovada: approvalFrom(details.aprovacao),
    placar: tally,
    votos,
  }
}

/** Cliente com o transporte amarrado; ver `FetchJson`. */
export const createCamaraClient = (fetchJson: FetchJson) => ({
  fetchDeputado: bindFetchJson(fetchDeputado, fetchJson),
  fetchDeputadoProposicoes: bindFetchJson(fetchDeputadoProposicoes, fetchJson),
  fetchProposicao: bindFetchJson(fetchProposicao, fetchJson),
  fetchDeputadoCommittees: bindFetchJson(fetchDeputadoCommittees, fetchJson),
  fetchDeputadoSpeeches: bindFetchJson(fetchDeputadoSpeeches, fetchJson),
  fetchDeputadoCareer: bindFetchJson(fetchDeputadoCareer, fetchJson),
  fetchOrientacoes: bindFetchJson(fetchOrientacoes, fetchJson),
  fetchCamaraVotacao: bindFetchJson(fetchCamaraVotacao, fetchJson),
})
