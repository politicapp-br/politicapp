import type { EspecieNorma, EventoNorma } from "@politicapp/data"

import type { MateriaDouApi } from "../sources/dou"

/** Leis e MPs são raras; o teto existe para semana de decreto em lote. */
export const NORMAS_NO_FEED = 20

const PAGINA_NORMA = "https://www.in.gov.br/web/dou/-/"

/**
 * Só atos numerados do topo do Executivo. "DECRETO DE 12 DE AGOSTO" (sem
 * número) é ato de pessoal — nomeação, exoneração — e fica de fora.
 */
const ESPECIE_POR_TITULO: [RegExp, EspecieNorma][] = [
  [/^LEI (COMPLEMENTAR )?N/i, "lei"],
  [/^MEDIDA PROVIS[ÓO]RIA N/i, "mpv"],
  [/^DECRETO N/i, "decreto"],
]

/** Leis primeiro no corte: sanção é mais rara (e mais notícia) que decreto. */
const PRIORIDADE: Record<EspecieNorma, number> = { lei: 0, mpv: 1, decreto: 2 }

const especieDe = (titulo: string): EspecieNorma | null =>
  ESPECIE_POR_TITULO.find(([padrao]) => padrao.test(titulo))?.[1] ?? null

/** Ementa de verdade é uma frase; acima disso é corpo de norma que vazou. */
const EMENTA_MAXIMA = 500

/**
 * O `content` vem como título repetido + ementa + corpo do ato. A ementa
 * termina onde o corpo começa: na fórmula "O PRESIDENTE DA REPÚBLICA…" — em
 * caixa alta no DOU, e a busca é sensível a caixa de propósito: "…ao
 * Presidente da República" dentro da própria ementa não pode cortá-la.
 */
const FORMULA_DE_PROMULGACAO =
  /[AO] (PRESIDENTE|PRESIDENTA|VICE-PRESIDENTE) D[AO] (REP[ÚU]BLICA|SENADO FEDERAL)/

export const ementaDoConteudo = (
  titulo: string,
  conteudo: string | null,
): string | null => {
  if (!conteudo) return null

  let texto = conteudo.trim()
  if (texto.toUpperCase().startsWith(titulo.toUpperCase())) {
    texto = texto.slice(titulo.length)
  }

  const formula = texto.search(FORMULA_DE_PROMULGACAO)
  if (formula !== -1) texto = texto.slice(0, formula)

  let ementa = texto.replace(/\s+/g, " ").trim()
  // Lei promulgada pelo Senado (veto derrubado) não traz a fórmula esperada
  // e o content inteiro viraria "ementa" — o teto segura esse caso.
  if (ementa.length > EMENTA_MAXIMA) {
    ementa = `${ementa.slice(0, EMENTA_MAXIMA).trimEnd()}…`
  }
  return ementa.length > 0 ? ementa : null
}

const capitalizarTitulo = (titulo: string): string => {
  const minusculas = titulo.toLowerCase()
  return minusculas.charAt(0).toUpperCase() + minusculas.slice(1)
}

export const normaDaMateria = (
  materia: MateriaDouApi,
  dataIso: string,
): EventoNorma | null => {
  const titulo = materia.title.trim()
  const especie = especieDe(titulo)
  if (!especie) return null

  return {
    tipo: "norma",
    id: materia.urlTitle,
    data: dataIso,
    especie,
    titulo: capitalizarTitulo(titulo),
    ementa: ementaDoConteudo(titulo, materia.content),
    url: `${PAGINA_NORMA}${materia.urlTitle}`,
  }
}

/** Aplica o teto priorizando lei > MP > decreto, e devolve por data desc. */
export const montarNormas = (normas: EventoNorma[]): EventoNorma[] =>
  [...normas]
    .sort(
      (a, b) =>
        PRIORIDADE[a.especie] - PRIORIDADE[b.especie] ||
        b.data.localeCompare(a.data),
    )
    .slice(0, NORMAS_NO_FEED)
    .sort((a, b) => b.data.localeCompare(a.data))
