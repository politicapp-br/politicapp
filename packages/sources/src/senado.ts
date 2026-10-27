import {
  contarPlacar,
  type Discurso,
  type ParlamentarDetalhe,
  type ParticipacaoEmOrgao,
  type TipoVoto,
  type Votacao,
  type VotacaoDetalhe,
  type Voto,
} from "@politicapp/data"
import { format } from "date-fns"
import { z } from "zod"

import { normalizeForSearch, truncateSummary } from "./text"
import { bindFetchJson, type FetchJson } from "./fetch-json"

const API = "https://legis.senado.leg.br/dadosabertos"
const SOURCE = "senado"

const textOrNumber = z.union([z.string(), z.number()]).transform(String)

const senadorDetailsSchema = z.object({
  DetalheParlamentar: z.object({
    Parlamentar: z.object({
      IdentificacaoParlamentar: z.object({
        CodigoParlamentar: textOrNumber,
        NomeParlamentar: z.string(),
        NomeCompletoParlamentar: z.string().nullish(),
        SiglaPartidoParlamentar: z.string().nullish(),
        UfParlamentar: z.string().nullish(),
        UrlFotoParlamentar: z.string().nullish(),
        EmailParlamentar: z.string().nullish(),
        UrlPaginaParlamentar: z.string().nullish(),
      }),
      DadosBasicosParlamentar: z
        .object({
          DataNascimento: z.string().nullish(),
          Naturalidade: z.string().nullish(),
          UfNaturalidade: z.string().nullish(),
          EnderecoParlamentar: z.string().nullish(),
        })
        .nullish(),
    }),
  }),
})

const fetchSenador = async (
  fetchJson: FetchJson,
  id: string,
): Promise<ParlamentarDetalhe> => {
  const response = await fetchJson(
    `${API}/senador/${id}`,
    senadorDetailsSchema,
    { source: SOURCE },
  )

  const { IdentificacaoParlamentar: identification, DadosBasicosParlamentar: basicData } =
    response.DetalheParlamentar.Parlamentar

  return {
    casa: "senado",
    id: identification.CodigoParlamentar,
    nome: identification.NomeParlamentar,
    nomeCivil: identification.NomeCompletoParlamentar ?? null,
    partido: identification.SiglaPartidoParlamentar ?? "—",
    uf: identification.UfParlamentar ?? "—",
    fotoUrl: toHttps(identification.UrlFotoParlamentar),
    email: identification.EmailParlamentar ?? null,
    emExercicio: true,
    nascimento: basicData?.DataNascimento ?? null,
    municipioNascimento: basicData?.Naturalidade ?? null,
    ufNascimento: basicData?.UfNaturalidade ?? null,
    escolaridade: null,
    telefone: null,
    site: toHttps(identification.UrlPaginaParlamentar),
    gabinete: basicData?.EnderecoParlamentar?.replace(/\s+/g, " ").trim() ?? null,
  }
}

/**
 * Os JSONs do Senado são XML convertido: um campo que seria lista vira objeto
 * quando há um item só, e some quando há zero.
 */
const ensureArray = <T>(value: T | T[] | null | undefined): T[] => {
  if (value === null || value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

const oneOrMany = <T extends z.ZodTypeAny>(item: T) =>
  z.union([item, z.array(item)]).nullish()

const committeeApiSchema = z.object({
  IdentificacaoComissao: z
    .object({
      SiglaComissao: z.string().nullish(),
      NomeComissao: z.string().nullish(),
    })
    .nullish(),
  DescricaoParticipacao: z.string().nullish(),
  DataInicio: z.string().nullish(),
  DataFim: z.string().nullish(),
})

const committeesSchema = z.object({
  MembroComissaoParlamentar: z.object({
    Parlamentar: z
      .object({
        MembroComissoes: z
          .object({ Comissao: oneOrMany(committeeApiSchema) })
          .nullish(),
      })
      .nullish(),
  }),
})

const fetchSenadorCommittees = async (
  fetchJson: FetchJson,
  id: string,
): Promise<ParticipacaoEmOrgao[]> => {
  const response = await fetchJson(
    `${API}/senador/${id}/comissoes`,
    committeesSchema,
    { source: SOURCE },
  )

  return ensureArray(
    response.MembroComissaoParlamentar.Parlamentar?.MembroComissoes?.Comissao,
  ).flatMap<ParticipacaoEmOrgao>((committee) => {
    const identification = committee.IdentificacaoComissao
    // Só participação vigente: o Senado devolve todo o histórico (centenas).
    if (!identification?.SiglaComissao || !identification.NomeComissao || committee.DataFim) {
      return []
    }
    return [
      {
        sigla: identification.SiglaComissao,
        nome: identification.NomeComissao,
        papel: committee.DescricaoParticipacao ?? "Membro",
        inicio: committee.DataInicio ?? null,
        fim: committee.DataFim ?? null,
      },
    ]
  })
}

const pronunciamentoApiSchema = z.object({
  DataPronunciamento: z.string().nullish(),
  TipoUsoPalavra: z.object({ Descricao: z.string().nullish() }).nullish(),
  TextoResumo: z.string().nullish(),
  UrlTexto: z.string().nullish(),
})

const speechesSchema = z.object({
  DiscursosParlamentar: z.object({
    Parlamentar: z
      .object({
        Pronunciamentos: z
          .object({ Pronunciamento: oneOrMany(pronunciamentoApiSchema) })
          .nullish(),
      })
      .nullish(),
  }),
})

const fetchSenadorSpeeches = async (
  fetchJson: FetchJson,
  id: string,
  start: Date,
  end: Date,
): Promise<Discurso[]> => {
  // Aqui as datas vão sem hífen (AAAAMMDD), diferente do resto da API.
  const dateRange = `dataInicio=${format(start, "yyyyMMdd")}&dataFim=${format(end, "yyyyMMdd")}`
  const response = await fetchJson(
    `${API}/senador/${id}/discursos?${dateRange}`,
    speechesSchema,
    { source: SOURCE },
  )

  return ensureArray(
    response.DiscursosParlamentar.Parlamentar?.Pronunciamentos?.Pronunciamento,
  )
    .flatMap<Discurso>((speech) => {
      if (!speech.DataPronunciamento) return []
      return [
        {
          data: speech.DataPronunciamento,
          tipo: speech.TipoUsoPalavra?.Descricao ?? null,
          resumo: truncateSummary(speech.TextoResumo ?? null),
          urlTexto: speech.UrlTexto ?? null,
        },
      ]
    })
    .sort((a, b) => b.data.localeCompare(a.data))
}

const SENADO_VOTE_TYPES: Record<string, TipoVoto> = {
  SIM: "sim",
  NAO: "nao",
  ABSTENCAO: "abstencao",
  VOTOU: "sim",
}

const parseSenadoVote = (sigla: string | null | undefined): TipoVoto => {
  if (!sigla) return "ausente"
  const normalized = normalizeForSearch(sigla).toUpperCase().trim()
  if (normalized.startsWith("PRESIDENTE")) return "presidente"
  return SENADO_VOTE_TYPES[normalized] ?? "ausente"
}

const votacaoApiSchema = z.object({
  codigoSessao: z.number(),
  codigoSessaoVotacao: z.number(),
  dataSessao: z.string(),
  descricaoVotacao: z.string().nullish(),
  ementa: z.string().nullish(),
  identificacao: z.string().nullish(),
  sigla: z.string().nullish(),
  resultadoVotacao: z.string().nullish(),
  votacaoSecreta: z.string().nullish(),
  votos: z
    .array(
      z.object({
        codigoParlamentar: z.number(),
        nomeParlamentar: z.string(),
        siglaPartidoParlamentar: z.string().nullish(),
        siglaUFParlamentar: z.string().nullish(),
        siglaVotoParlamentar: z.string().nullish(),
      }),
    )
    .default([]),
})

const votacaoListSchema = z.array(votacaoApiSchema)

const toVotos = (votacao: z.infer<typeof votacaoApiSchema>): Voto[] =>
  votacao.votos.map((voto) => ({
    casa: "senado" as const,
    id: String(voto.codigoParlamentar),
    nome: voto.nomeParlamentar,
    partido: voto.siglaPartidoParlamentar ?? "—",
    uf: voto.siglaUFParlamentar ?? "—",
    voto: parseSenadoVote(voto.siglaVotoParlamentar),
  }))

const toVotacao = (votacao: z.infer<typeof votacaoApiSchema>): Votacao => {
  const votos = toVotos(votacao)

  return {
    casa: "senado",
    id: votacaoId(votacao),
    data: votacao.dataSessao,
    descricao: votacao.descricaoVotacao ?? votacao.identificacao ?? "Votação",
    resumo: votacao.ementa ?? null,
    proposicao: votacao.identificacao
      ? {
          id: null,
          sigla: votacao.identificacao,
          ementa: votacao.ementa ?? null,
        }
      : null,
    aprovada: votacao.resultadoVotacao
      ? votacao.resultadoVotacao.toUpperCase() === "A"
      : null,
    placar: contarPlacar(votos),
  }
}

const votacaoId = ({
  codigoSessao,
  codigoSessaoVotacao,
}: Pick<
  z.infer<typeof votacaoApiSchema>,
  "codigoSessao" | "codigoSessaoVotacao"
>) => `${codigoSessao}-${codigoSessaoVotacao}`

const fetchSenadoVotacao = async (
  fetchJson: FetchJson,
  id: string,
): Promise<VotacaoDetalhe | null> => {
  const [codigoSessao] = id.split("-")
  if (!codigoSessao) return null

  const votacoes = await fetchJson(
    `${API}/votacao?codigoSessao=${codigoSessao}`,
    votacaoListSchema,
    { source: SOURCE },
  )

  const found = votacoes.find((votacao) => votacaoId(votacao) === id)
  if (!found) return null

  return { ...toVotacao(found), votos: toVotos(found) }
}

const toHttps = (url: string | null | undefined) =>
  url ? url.replace("http://", "https://") : null

/** Cliente com o transporte amarrado; ver `FetchJson`. */
export const createSenadoClient = (fetchJson: FetchJson) => ({
  fetchSenador: bindFetchJson(fetchSenador, fetchJson),
  fetchSenadorCommittees: bindFetchJson(fetchSenadorCommittees, fetchJson),
  fetchSenadorSpeeches: bindFetchJson(fetchSenadorSpeeches, fetchJson),
  fetchSenadoVotacao: bindFetchJson(fetchSenadoVotacao, fetchJson),
})
