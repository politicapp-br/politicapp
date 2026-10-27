import {
  CARGO_CODIGO_TSE,
  type Cargo,
  type Candidato,
  type CandidatoDetalhe,
  type SituacaoCandidatura,
} from "@politicapp/data"
import { z } from "zod"

import { fetchJson } from "./http"

const API = "https://divulgacandcontas.tse.jus.br/divulga/rest/v1"
const IMAGES_API = "https://divulgacandcontas.tse.jus.br/divulga/rest/arquivo/img"
const SOURCE = "tse/divulgacand"

export const ELECTION_2026 = { year: 2026, id: 20322002026 } as const

const partyApiSchema = z
  .object({ sigla: z.string().nullish() })
  .nullish()

const candidatoApiSchema = z.object({
  id: z.number(),
  nomeUrna: z.string(),
  nomeCompleto: z.string().nullish(),
  numero: z.number().nullish(),
  descricaoSituacao: z.string().nullish(),
  nomeColigacao: z.string().nullish(),
  ufCandidatura: z.string().nullish(),
  totalDeBens: z.number().nullish(),
  st_REELEICAO: z.boolean().nullish(),
  partido: partyApiSchema,
})

const candidatoListSchema = z.object({
  candidatos: z.array(candidatoApiSchema).nullish(),
})

const STATUS_PATTERNS: { pattern: RegExp; status: SituacaoCandidatura }[] = [
  { pattern: /deferido com recurso|^deferido/i, status: "deferido" },
  { pattern: /indeferido|cassad|inapto/i, status: "indeferido" },
  { pattern: /aguardando|pendente|análise/i, status: "pendente" },
  { pattern: /renúncia|renuncia/i, status: "renuncia" },
]

const parseCandidacyStatus = (
  description: string | null | undefined,
): SituacaoCandidatura => {
  if (!description) return "outro"
  return (
    STATUS_PATTERNS.find(({ pattern }) => pattern.test(description))?.status ??
    "outro"
  )
}

/**
 * A listagem não traz `fotoUrl` (só o detalhe traz), mas o endpoint de imagem
 * é montável: id da eleição + id do candidato + UF da candidatura ("BR" para
 * presidente). Sem foto cadastrada o TSE devolve uma silhueta genérica.
 */
const candidatePhotoUrl = (id: number, uf: string) =>
  `${IMAGES_API}/${ELECTION_2026.id}/${id}/${uf}`

const toCandidato = (
  raw: z.infer<typeof candidatoApiSchema>,
  cargo: Cargo,
  uf: string,
): Candidato => ({
  id: String(raw.id),
  nomeUrna: raw.nomeUrna,
  nomeCompleto: raw.nomeCompleto ?? raw.nomeUrna,
  numero: raw.numero ? String(raw.numero) : "—",
  cargo,
  uf: raw.ufCandidatura ?? uf,
  partido: raw.partido?.sigla ?? "—",
  coligacao: raw.nomeColigacao ?? null,
  fotoUrl: candidatePhotoUrl(raw.id, raw.ufCandidatura ?? uf),
  situacao: parseCandidacyStatus(raw.descricaoSituacao),
  totalBens: raw.totalDeBens ?? null,
  reeleicao: raw.st_REELEICAO ?? false,
})

export const fetchCandidates = async (
  uf: string,
  cargo: Cargo,
): Promise<Candidato[]> => {
  const { year, id } = ELECTION_2026
  const cargoCode = CARGO_CODIGO_TSE[cargo]

  const response = await fetchJson(
    `${API}/candidatura/listar/${year}/${uf}/${id}/${cargoCode}/candidatos`,
    candidatoListSchema,
    { source: SOURCE },
  )

  return (response.candidatos ?? [])
    .map((raw) => toCandidato(raw, cargo, uf))
    .sort((a, b) => a.nomeUrna.localeCompare(b.nomeUrna, "pt-BR"))
}

const assetApiSchema = z.object({
  descricao: z.string().nullish(),
  descricaoDeTipoDeBem: z.string().nullish(),
  valor: z.number().nullish(),
})

const previousElectionApiSchema = z.object({
  nrAno: z.number().nullish(),
  cargo: z.string().nullish(),
  local: z.string().nullish(),
  sgUe: z.string().nullish(),
  partido: z.string().nullish(),
  situacaoTotalizacao: z.string().nullish(),
})

const candidatoDetailsApiSchema = candidatoApiSchema.extend({
  dataDeNascimento: z.string().nullish(),
  ocupacao: z.string().nullish(),
  grauInstrucao: z.string().nullish(),
  bens: z.array(assetApiSchema).nullish(),
  gastoCampanha: z.number().nullish(),
  gastoCampanha1T: z.number().nullish(),
  gastoCampanha2T: z.number().nullish(),
  eleicoesAnteriores: z.array(previousElectionApiSchema).nullish(),
})

export const fetchCandidate = async (
  uf: string,
  cargo: Cargo,
  candidateId: string,
): Promise<CandidatoDetalhe> => {
  const { year, id } = ELECTION_2026

  const raw = await fetchJson(
    `${API}/candidatura/buscar/${year}/${uf}/${id}/candidato/${candidateId}`,
    candidatoDetailsApiSchema,
    { source: SOURCE },
  )

  return {
    ...toCandidato(raw, cargo, uf),
    nascimento: raw.dataDeNascimento ?? null,
    ocupacao: raw.ocupacao ?? null,
    escolaridade: raw.grauInstrucao ?? null,
    propostaUrl: null,
    bens: (raw.bens ?? []).flatMap((asset) =>
      asset.valor
        ? [
            {
              descricao: asset.descricao ?? "Bem declarado",
              tipo: asset.descricaoDeTipoDeBem ?? "Outros",
              valor: asset.valor,
            },
          ]
        : [],
    ),
    limiteGastos1T: raw.gastoCampanha1T || null,
    limiteGastos2T: raw.gastoCampanha2T || null,
    candidaturasAnteriores: (raw.eleicoesAnteriores ?? [])
      .flatMap((previous) => {
        // A lista inclui a própria candidatura atual — só o passado interessa.
        if (!previous.nrAno || previous.nrAno >= year) return []
        return [
          {
            ano: previous.nrAno,
            cargo: previous.cargo ?? "—",
            local: previous.sgUe ?? previous.local ?? "—",
            partido: previous.partido ?? null,
            resultado: previous.situacaoTotalizacao ?? null,
          },
        ]
      })
      .sort((a, b) => b.ano - a.ano),
  }
}
