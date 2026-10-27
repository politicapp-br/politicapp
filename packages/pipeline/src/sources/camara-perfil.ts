import type { Frequencia } from "@politicapp/data"

import { buscarJson, buscarTexto } from "../http"

const API = "https://dadosabertos.camara.leg.br/api/v2"
const PORTAL = "https://www.camara.leg.br/deputados"

export type HistoricoCamaraApi = {
  dataHora: string | null
  siglaPartido: string | null
  situacao: string | null
  descricaoStatus: string | null
  idLegislatura: number
}

/** Um registro por mudança de status: posse, troca de partido, licença, retorno. */
export const listarHistoricoDeputado = async (id: string): Promise<HistoricoCamaraApi[]> =>
  (await buscarJson<{ dados: HistoricoCamaraApi[] }>(`${API}/deputados/${id}/historico`)).dados

export const urlPerfilDeputado = (id: string, ano: number) => `${PORTAL}/${id}?ano=${ano}`

export type FrequenciaDoPerfil = {
  plenario: Frequencia | null
  comissoes: Frequencia | null
}

const ROTULOS: [keyof Frequencia, RegExp][] = [
  ["presencas", /^Presenças/],
  ["ausenciasJustificadas", /^Ausências justificadas/],
  ["ausenciasNaoJustificadas", /^Ausências não justificadas/],
]

const semTags = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const lerBloco = (bloco: string): Frequencia | null => {
  const valores: Partial<Frequencia> = {}
  const itens = bloco.matchAll(
    /presencas__label">([\s\S]*?)<\/span>\s*<span[^>]*presencas__qtd">([\s\S]*?)<\/span>/g,
  )
  for (const [, rotuloHtml = "", quantidadeHtml = ""] of itens) {
    const rotulo = semTags(rotuloHtml)
    const quantidade = Number(/\d+/.exec(semTags(quantidadeHtml))?.[0])
    const chave = ROTULOS.find(([, padrao]) => padrao.test(rotulo))?.[0]
    if (chave && Number.isFinite(quantidade)) valores[chave] = quantidade
  }
  const { presencas, ausenciasJustificadas, ausenciasNaoJustificadas } = valores
  return presencas !== undefined &&
    ausenciasJustificadas !== undefined &&
    ausenciasNaoJustificadas !== undefined
    ? { presencas, ausenciasJustificadas, ausenciasNaoJustificadas }
    : null
}

/**
 * A frequência oficial não está na API de dados abertos, só no perfil do
 * portal: um bloco por seção, identificado pelo link para
 * `presenca-plenario` e `presenca-comissoes`.
 */
export const lerFrequenciaDoPerfil = (html: string): FrequenciaDoPerfil => {
  const secoes = html.split(/<section class="presencas__section"/).slice(1)
  const bloco = (alvo: string) => secoes.find((secao) => secao.includes(alvo))
  const plenario = bloco("presenca-plenario")
  const comissoes = bloco("presenca-comissoes")
  return {
    plenario: plenario ? lerBloco(plenario) : null,
    comissoes: comissoes ? lerBloco(comissoes) : null,
  }
}

export const buscarFrequenciaDeputado = async (
  id: string,
  ano: number,
): Promise<FrequenciaDoPerfil> => lerFrequenciaDoPerfil(await buscarTexto(urlPerfilDeputado(id, ano)))
