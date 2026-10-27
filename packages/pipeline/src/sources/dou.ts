import { log } from "../config"
import { buscarTexto } from "../http"

const LEITURA = "https://www.in.gov.br/leiturajornal"

export type MateriaDouApi = {
  urlTitle: string
  title: string
  content: string | null
  pubDate: string | null
}

/**
 * O DOU não tem API pública sem cadastro (o INLABS exige conta), mas a página
 * "leitura do jornal" embute o sumário do dia num JSON. É a mesma fonte que
 * projetos como o Ro-DOU usam. A página traz mais de um `"jsonArray"` (um
 * placeholder vazio de portlet e o de dados) — vale o primeiro não vazio.
 */
export const extrairMaterias = (html: string): MateriaDouApi[] => {
  const marcador = '"jsonArray"'
  let posicao = html.indexOf(marcador)

  while (posicao !== -1) {
    const inicio = html.indexOf("[", posicao)
    if (inicio === -1) return []

    const fim = fimDoArray(html, inicio)
    if (fim !== -1) {
      try {
        const bruto = JSON.parse(html.slice(inicio, fim)) as unknown[]
        // O shape é validado aqui porque a fonte é raspagem: um array de
        // outra coisa (ou item sem título) não pode passar adiante.
        const materias = bruto.filter(
          (item): item is MateriaDouApi =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as MateriaDouApi).urlTitle === "string" &&
            typeof (item as MateriaDouApi).title === "string",
        )
        if (materias.length > 0) return materias
      } catch {
        // JSON malformado neste trecho — tenta a próxima ocorrência.
      }
    }

    posicao = html.indexOf(marcador, posicao + marcador.length)
  }

  return []
}

/** Fim do array balanceando colchetes, ignorando os que estão dentro de strings. */
const fimDoArray = (html: string, inicio: number): number => {
  let profundidade = 0
  let emString = false

  for (let i = inicio; i < html.length; i += 1) {
    const caractere = html[i]
    if (emString) {
      if (caractere === "\\") i += 1
      else if (caractere === '"') emString = false
      continue
    }
    if (caractere === '"') emString = true
    else if (caractere === "[") profundidade += 1
    else if (caractere === "]") {
      profundidade -= 1
      if (profundidade === 0) return i + 1
    }
  }

  return -1
}

/** Sumário da seção 1 do DOU do dia (ISO `aaaa-mm-dd`). Dia sem edição vem vazio. */
export const listarMateriasDou = async (
  dataIso: string,
): Promise<MateriaDouApi[]> => {
  const [ano, mes, dia] = dataIso.split("-")
  const html = await buscarTexto(
    `${LEITURA}?data=${dia}-${mes}-${ano}&secao=do1`,
  )

  const materias = extrairMaterias(html)
  log(`dou: ${materias.length} matérias na seção 1 de ${dataIso}`)
  return materias
}
