import type { Parlamentar } from "@politicapp/data"
import { z } from "zod"

import { log } from "../config"
import { lerCsvComCabecalho, numeroBr } from "../csv"
import {
  buscarJson,
  buscarTexto,
  emLotes,
  TIMEOUT_ARQUIVO_GRANDE_MS,
} from "../http"
import { janelasMensais } from "../periodo"
import { validarItens } from "../validacao"
import type { LancamentoDespesa } from "./camara"

const API = "https://legis.senado.leg.br/dadosabertos"
const CEAPS = "https://www.senado.leg.br/transparencia/LAI/verba"

type IdentificacaoParlamentar = {
  CodigoParlamentar: string
  NomeParlamentar: string
  NomeCompletoParlamentar: string
  SiglaPartidoParlamentar?: string
  UfParlamentar?: string
  UrlFotoParlamentar?: string
  EmailParlamentar?: string
}

type ExercicioSenado = { DataInicio?: string }

type MandatoSenado = {
  Exercicios?: { Exercicio?: ExercicioSenado[] | ExercicioSenado }
}

type ListaSenadores = {
  ListaParlamentarEmExercicio: {
    Parlamentares: {
      Parlamentar: {
        IdentificacaoParlamentar: IdentificacaoParlamentar
        Mandato?: MandatoSenado
      }[]
    }
  }
}

export const listarSenadores = async (): Promise<Parlamentar[]> => {
  const resposta = await buscarJson<ListaSenadores>(`${API}/senador/lista/atual`)
  const lista =
    resposta.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar ?? []

  log(`senado: ${lista.length} senadores em exercício`)

  return lista.map(({ IdentificacaoParlamentar: identificacao }) => ({
    casa: "senado" as const,
    id: identificacao.CodigoParlamentar,
    nome: identificacao.NomeParlamentar,
    nomeCivil: identificacao.NomeCompletoParlamentar ?? null,
    partido: identificacao.SiglaPartidoParlamentar ?? "—",
    uf: identificacao.UfParlamentar ?? "—",
    fotoUrl: identificacao.UrlFotoParlamentar?.replace("http://", "https://") ?? null,
    email: identificacao.EmailParlamentar ?? null,
    emExercicio: true,
  }))
}

/**
 * Data de posse de cada senador em exercício, no mandato atual. Para suplente
 * vale a posse dele, não o começo do mandato do titular — é o primeiro
 * exercício registrado no mandato.
 */
export const listarPossesSenado = async (): Promise<Map<string, string>> => {
  const resposta = await buscarJson<ListaSenadores>(`${API}/senador/lista/atual`)
  const lista =
    resposta.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar ?? []

  const posses = new Map<string, string>()
  for (const { IdentificacaoParlamentar: identificacao, Mandato } of lista) {
    const exercicios = Mandato?.Exercicios?.Exercicio
    const inicio = (Array.isArray(exercicios) ? exercicios : [exercicios])
      .map((exercicio) => exercicio?.DataInicio)
      .filter((data): data is string => Boolean(data))
      .sort()[0]
    if (inicio) posses.set(identificacao.CodigoParlamentar, inicio)
  }

  log(`senado: posse conhecida de ${posses.size} senadores`)

  return posses
}

export const chaveDeNome = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, "")
    .replace(/\s+/g, " ")
    .trim()

/** "20/01/2026" → "2026-01-20". */
const dataBr = (valor: string | undefined) => {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(valor?.trim() ?? "")
  return partes ? `${partes[3]}-${partes[2]}-${partes[1]}` : null
}

export const baixarDespesasSenado = async (
  ano: number,
  senadores: Parlamentar[],
): Promise<LancamentoDespesa[]> => {
  const url = `${CEAPS}/despesa_ceaps_${ano}.csv`
  log(`senado: baixando ${url}`)

  const texto = await buscarTexto(url, {
    codificacao: "iso-8859-1",
    timeoutMs: TIMEOUT_ARQUIVO_GRANDE_MS,
  })
  const linhas = lerCsvComCabecalho(texto, { pularLinhas: 1 })
  log(`senado: ${linhas.length} lançamentos de cota em ${ano}`)

  const idPorNome = new Map(
    senadores.map((senador) => [chaveDeNome(senador.nome), senador.id]),
  )

  const semCorrespondencia = new Set<string>()

  const lancamentos = linhas.flatMap<LancamentoDespesa>((linha) => {
    const nome = linha.SENADOR ?? ""
    const id = idPorNome.get(chaveDeNome(nome))

    if (!id) {
      if (nome) semCorrespondencia.add(nome)
      return []
    }

    const valor = numeroBr(linha.VALOR_REEMBOLSADO)
    if (valor <= 0) return []

    return [
      {
        parlamentarId: id,
        ano: Number(linha.ANO) || ano,
        mes: Number(linha.MES) || 0,
        tipo: linha.TIPO_DESPESA ?? "",
        fornecedor: linha.FORNECEDOR ?? "",
        cnpjCpf: linha.CNPJ_CPF || null,
        valor,
        documentoUrl: null,
        data: dataBr(linha.DATA),
        glosa: 0,
      },
    ]
  })

  if (semCorrespondencia.size > 0) {
    log(
      `senado: ${semCorrespondencia.size} nomes do CEAPS sem senador em exercício (ex-senadores ou suplentes)`,
    )
  }

  return lancamentos
}

/** Campo que a API às vezes manda nulo e às vezes omite: vira sempre null. */
const opcional = <T extends z.ZodType>(schema: T) =>
  schema.nullish().transform((valor) => valor ?? null)

const votoSenadoApiSchema = z.object({
  codigoParlamentar: z.number(),
  nomeParlamentar: z.string(),
  siglaPartidoParlamentar: opcional(z.string()),
  siglaUFParlamentar: opcional(z.string()),
  siglaVotoParlamentar: opcional(z.string()),
})

const votacaoSenadoApiSchema = z.object({
  codigoSessao: z.number(),
  codigoSessaoVotacao: z.number(),
  dataSessao: z.string(),
  descricaoVotacao: opcional(z.string()),
  ementa: opcional(z.string()),
  identificacao: opcional(z.string()),
  sigla: opcional(z.string()),
  numero: opcional(z.string()),
  ano: z.number(),
  resultadoVotacao: opcional(z.string()),
  votacaoSecreta: opcional(z.string()),
  votos: z.array(votoSenadoApiSchema).nullish().transform((votos) => votos ?? []),
})

export type VotacaoSenadoApi = z.infer<typeof votacaoSenadoApiSchema>

/**
 * Mês que falha derruba a etapa (que mantém o dado de ontem): seguir sem ele
 * subestimaria a participação de todo mundo e publicaria isso como verdade.
 */
export const listarVotacoesSenado = async (
  ano: number,
): Promise<VotacaoSenadoApi[]> => {
  const janelas = janelasMensais(ano)
  const porJanela = await emLotes(janelas, ({ inicio, fim }) =>
    buscarJson<unknown[]>(`${API}/votacao?dataInicio=${inicio}&dataFim=${fim}`),
  )

  const votacoes = validarItens("senado: votações", porJanela.flat(), votacaoSenadoApiSchema)
  log(`senado: ${votacoes.length} votações em ${ano}`)
  return votacoes
}

const VOTOS_CONTABILIZADOS = new Set(["SIM", "NAO", "ABSTENCAO", "VOTOU"])

export const senadorParticipou = (sigla: string | null) =>
  VOTOS_CONTABILIZADOS.has(chaveDeNome(sigla ?? "").replace(/ /g, ""))

/**
 * Os endpoints de agenda do Senado são XML convertido: um campo que seria
 * lista vira objeto quando há um item só, e some quando há zero.
 */
const garantirLista = <T>(valor: T | T[] | null | undefined): T[] => {
  if (valor === null || valor === undefined) return []
  return Array.isArray(valor) ? valor : [valor]
}

export type SessaoPlenarioSenadoApi = {
  CodigoSessao?: string
  Data?: string
  Hora?: string
  TipoSessao?: string
  Casa?: string
  SituacaoSessao?: string
}

type AgendaPlenarioApi = {
  AgendaPlenario?: {
    Sessoes?: {
      Sessao?: SessaoPlenarioSenadoApi | SessaoPlenarioSenadoApi[]
    }
  }
}

/** Retorna as sessões de plenário da data informada até o fim do mês. */
export const listarAgendaPlenarioSenado = async (
  dataRef: string,
): Promise<SessaoPlenarioSenadoApi[]> => {
  const resposta = await buscarJson<AgendaPlenarioApi>(
    `${API}/plenario/agenda/mes/${dataRef}`,
  )
  const sessoes = garantirLista(resposta.AgendaPlenario?.Sessoes?.Sessao)
  log(`senado: ${sessoes.length} sessões de plenário a partir de ${dataRef}`)
  return sessoes
}

type ItemPautaPlenarioApi = {
  ementa?: string | null
  retirado?: string
  materiaLegislativa?: { identificacao?: string | null } | null
}

type PautaPlenarioApi = {
  ServicoPlenario?: {
    itensPauta?: {
      itemPauta?: ItemPautaPlenarioApi | ItemPautaPlenarioApi[]
    }
  }
}

export type MateriaEmPauta = { sigla: string; ementa: string | null }

export const listarPautaDoPlenarioSenado = async (
  codigoSessao: string,
): Promise<MateriaEmPauta[]> => {
  const resposta = await buscarJson<PautaPlenarioApi>(
    `${API}/plenario/encontro/${codigoSessao}/pauta`,
  )

  return garantirLista(resposta.ServicoPlenario?.itensPauta?.itemPauta)
    .filter((item) => item.retirado !== "S")
    .flatMap((item) => {
      const sigla = item.materiaLegislativa?.identificacao?.trim()
      return sigla ? [{ sigla, ementa: item.ementa?.trim() || null }] : []
    })
}

type ItemReuniaoApi = {
  nome?: string | null
  categoria?: string | null
  ementa?: string | null
}

type ParteReuniaoApi = {
  isDeliberativa?: string
  itens?: { item?: ItemReuniaoApi | ItemReuniaoApi[] } | null
}

type ReuniaoComissaoApi = {
  codigo?: string
  dataInicio?: string
  titulo?: string | null
  situacao?: string | null
  secreta?: string
  isExibirNoPortal?: string
  colegiadoCriador?: { sigla?: string | null; nome?: string | null } | null
  partes?: { parte?: ParteReuniaoApi | ParteReuniaoApi[] } | ParteReuniaoApi[] | null
}

type AgendaComissoesApi = {
  AgendaReuniao?: {
    reunioes?: { reuniao?: ReuniaoComissaoApi | ReuniaoComissaoApi[] }
  }
}

export type ReuniaoComissaoSenado = {
  codigo: string
  dataInicio: string
  titulo: string
  siglaColegiado: string
  nomeColegiado: string | null
  situacao: string | null
  secreta: boolean
  exibir: boolean
  materias: MateriaEmPauta[]
}

const partesDaReuniao = (reuniao: ReuniaoComissaoApi): ParteReuniaoApi[] => {
  if (Array.isArray(reuniao.partes)) return reuniao.partes
  return garantirLista(reuniao.partes?.parte)
}

const materiasDaReuniao = (reuniao: ReuniaoComissaoApi): MateriaEmPauta[] =>
  partesDaReuniao(reuniao)
    .flatMap((parte) => garantirLista(parte.itens?.item))
    .filter((item) => item.categoria === "Matéria")
    .flatMap((item) => {
      const sigla = item.nome?.trim()
      return sigla ? [{ sigla, ementa: item.ementa?.trim() || null }] : []
    })

export const listarAgendaComissoesSenado = async (
  inicio: string,
  fim: string,
): Promise<ReuniaoComissaoSenado[]> => {
  const resposta = await buscarJson<AgendaComissoesApi>(
    `${API}/comissao/agenda/${inicio}/${fim}`,
  )

  const reunioes = garantirLista(resposta.AgendaReuniao?.reunioes?.reuniao)
  log(`senado: ${reunioes.length} reuniões de comissão entre ${inicio} e ${fim}`)

  return reunioes.flatMap((reuniao) => {
    if (!reuniao.codigo || !reuniao.dataInicio || !reuniao.colegiadoCriador?.sigla) {
      return []
    }
    return [
      {
        codigo: reuniao.codigo,
        dataInicio: reuniao.dataInicio,
        titulo: reuniao.titulo?.trim() || "Reunião de comissão",
        siglaColegiado: reuniao.colegiadoCriador.sigla,
        nomeColegiado: reuniao.colegiadoCriador.nome ?? null,
        situacao: reuniao.situacao ?? null,
        secreta: reuniao.secreta === "true",
        exibir: reuniao.isExibirNoPortal !== "false",
        materias: materiasDaReuniao(reuniao),
      },
    ]
  })
}
