export const normalizeForSearch = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

const CONNECTORS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "di",
  "del",
  "a",
  "o",
  "as",
  "os",
  "ao",
  "aos",
  "na",
  "no",
  "nas",
  "nos",
  "em",
  "com",
  "por",
  "para",
])
const HAS_VOWEL = /[aeiouáàâãéêíóôõúü]/

/**
 * O TSE devolve nomes e coligações em CAIXA ALTA, que gritam na lista.
 * Converte para caixa de nome próprio mantendo conectores em minúscula e
 * siglas sem vogal (JR, DR., PL/PSD) como estão. Texto que já vem em caixa
 * mista passa intacto.
 */
export const toProperCase = (text: string) => {
  if (text !== text.toLocaleUpperCase("pt-BR")) return text

  return text
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\s\-/]+/g, (word: string, offset: number) => {
      if (offset > 0 && CONNECTORS.has(word)) return word
      if (!HAS_VOWEL.test(word)) return word.toLocaleUpperCase("pt-BR")
      return word[0].toLocaleUpperCase("pt-BR") + word.slice(1)
    })
}
