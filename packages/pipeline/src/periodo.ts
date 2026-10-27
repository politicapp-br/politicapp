export type Janela = { inicio: string; fim: string }

const iso = (data: Date) => data.toISOString().slice(0, 10)

const DIA_MS = 24 * 60 * 60 * 1000

/** Janela de hoje até `dias` à frente — a agenda olha para frente, não para trás. */
export const janelaFutura = (dias: number, hoje = new Date()): Janela => ({
  inicio: iso(hoje),
  fim: iso(new Date(hoje.getTime() + dias * DIA_MS)),
})

/** Janela de `dias` atrás até hoje — para o que acabou de acontecer. */
export const janelaPassada = (dias: number, hoje = new Date()): Janela => ({
  inicio: iso(new Date(hoje.getTime() - dias * DIA_MS)),
  fim: iso(hoje),
})

/** A API do Senado usa datas AAAAMMDD, sem hífens. */
export const aaaammdd = (dataIso: string) => dataIso.replaceAll("-", "")

export const janelasMensais = (ano: number, hoje = new Date()): Janela[] => {
  const ultimoMes = hoje.getUTCFullYear() === ano ? hoje.getUTCMonth() : 11
  const janelas: Janela[] = []

  for (let mes = 0; mes <= ultimoMes; mes += 1) {
    const inicio = new Date(Date.UTC(ano, mes, 1))
    const fimDoMes = new Date(Date.UTC(ano, mes + 1, 0))
    const fim = fimDoMes > hoje && hoje >= inicio ? hoje : fimDoMes
    janelas.push({ inicio: iso(inicio), fim: iso(fim) })
  }

  return janelas
}
