// No GitHub Actions o input opcional vira string vazia — e Number("") é 0.
const anoInformado = Number(process.env.PIPELINE_ANO?.trim() || NaN)

export const config = {
  ano: Number.isInteger(anoInformado) ? anoInformado : new Date().getFullYear(),
  saida: process.env.PIPELINE_SAIDA ?? "dist",
  concorrencia: Number(process.env.PIPELINE_CONCORRENCIA ?? 3),
  chaveTransparencia: process.env.PORTAL_TRANSPARENCIA_API_KEY ?? "",
} as const

export const log = (mensagem: string) => {
  process.stdout.write(`${new Date().toISOString()} ${mensagem}\n`)
}
