export const normalizeForSearch = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

/**
 * Resumo de discurso: a Câmara manda a transcrição inteira quando falta o
 * sumário (dezenas de kB). A tela mostra poucas linhas; guardar mais só
 * incha o shard e o cache.
 */
export const MAX_SPEECH_SUMMARY = 600

export const truncateSummary = (text: string | null): string | null =>
  text && text.length > MAX_SPEECH_SUMMARY
    ? `${text.slice(0, MAX_SPEECH_SUMMARY).trimEnd()}…`
    : text
