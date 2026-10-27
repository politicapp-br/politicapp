// No GitHub Actions o input opcional vira string vazia — e Number("") é 0.
const anoInformado = Number(process.env.PIPELINE_ANO?.trim() || NaN)

export const config = {
  ano: Number.isInteger(anoInformado) ? anoInformado : new Date().getFullYear(),
  /** Diretório publicado — no CI, o checkout da branch `dados`. */
  saida: process.env.PIPELINE_SAIDA ?? "dist",
  /**
   * Onde gravar a lista de etapas que falharam. O workflow publica o que deu
   * certo e só depois falha o job se este arquivo não estiver vazio.
   */
  status: process.env.PIPELINE_STATUS?.trim() || null,
  concorrencia: Number(process.env.PIPELINE_CONCORRENCIA ?? 3),
  /**
   * Força as etapas semanais e mensais (produção, presença, histórico,
   * eleições) a rodarem hoje, fora do dia delas.
   */
  completo: process.env.PIPELINE_COMPLETO?.trim() === "1",
  /** Site publicado — só o validador lê daqui; os jobs leem o diretório local. */
  dadosUrl:
    process.env.PIPELINE_DADOS_URL ??
    "https://politicapp-br.github.io/politicapp",
} as const

export const log = (mensagem: string) => {
  process.stdout.write(`${new Date().toISOString()} ${mensagem}\n`)
}

/**
 * Loga quanto a etapa demorou, mesmo quando falha — otimização de ETL sem
 * medição é chute, e o log do Actions é o único perfil que temos do job.
 */
export const cronometrar = async <T>(
  etapa: string,
  promessa: Promise<T>,
): Promise<T> => {
  const inicio = Date.now()
  try {
    return await promessa
  } finally {
    log(`etapa "${etapa}" levou ${((Date.now() - inicio) / 1000).toFixed(1)}s`)
  }
}
