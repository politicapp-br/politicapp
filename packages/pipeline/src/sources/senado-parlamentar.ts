import { buscarJson } from "../http"

const API = "https://legis.senado.leg.br/dadosabertos"

/** O Senado converte XML para JSON: lista de um item só vira objeto solto. */
export const comoLista = <T>(valor: T | T[] | null | undefined): T[] =>
  valor === null || valor === undefined ? [] : Array.isArray(valor) ? valor : [valor]

export type LicencaSenadoApi = {
  DataInicio?: string
  DataFim?: string
  DescricaoTipoAfastamento?: string
}

type RespostaLicencas = {
  LicencaParlamentar?: {
    Parlamentar?: { Licencas?: { Licenca?: LicencaSenadoApi | LicencaSenadoApi[] } }
  }
}

export const listarLicencasSenador = async (id: string): Promise<LicencaSenadoApi[]> => {
  const resposta = await buscarJson<RespostaLicencas>(`${API}/senador/${id}/licencas.json`)
  return comoLista(resposta.LicencaParlamentar?.Parlamentar?.Licencas?.Licenca)
}

export type FiliacaoSenadoApi = {
  Partido?: { SiglaPartido?: string }
  DataFiliacao?: string
  DataDesfiliacao?: string
}

type RespostaFiliacoes = {
  FiliacaoParlamentar?: {
    Parlamentar?: { Filiacoes?: { Filiacao?: FiliacaoSenadoApi | FiliacaoSenadoApi[] } }
  }
}

export const listarFiliacoesSenador = async (id: string): Promise<FiliacaoSenadoApi[]> => {
  const resposta = await buscarJson<RespostaFiliacoes>(`${API}/senador/${id}/filiacoes.json`)
  return comoLista(resposta.FiliacaoParlamentar?.Parlamentar?.Filiacoes?.Filiacao)
}

export type SuplenteSenadoApi = {
  DescricaoParticipacao?: string
  CodigoParlamentar?: string
  NomeParlamentar?: string
}

export type MandatoSenadoApi = {
  PrimeiraLegislaturaDoMandato?: { DataInicio?: string }
  SegundaLegislaturaDoMandato?: { DataFim?: string }
  DescricaoParticipacao?: string
  Suplentes?: { Suplente?: SuplenteSenadoApi | SuplenteSenadoApi[] }
}

type RespostaMandatos = {
  MandatoParlamentar?: {
    Parlamentar?: { Mandatos?: { Mandato?: MandatoSenadoApi | MandatoSenadoApi[] } }
  }
}

export const listarMandatosSenador = async (id: string): Promise<MandatoSenadoApi[]> => {
  const resposta = await buscarJson<RespostaMandatos>(`${API}/senador/${id}/mandatos.json`)
  return comoLista(resposta.MandatoParlamentar?.Parlamentar?.Mandatos?.Mandato)
}

export type ProcessoSenadoApi = {
  id: number
  codigoMateria: number
  identificacao: string
  ementa: string | null
  autoria: string | null
  dataApresentacao: string | null
  situacaoAtual: string | null
}

/**
 * Substituto do `/senador/{id}/autorias`, que o Senado marcou para
 * desativação. Devolve um array na raiz, de todos os anos.
 */
export const listarProcessosDoSenador = (id: string): Promise<ProcessoSenadoApi[]> =>
  buscarJson<ProcessoSenadoApi[]>(`${API}/processo?codigoParlamentarAutor=${id}`)
