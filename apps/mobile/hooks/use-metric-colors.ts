import { nivelNaDistribuicao, type Distribuicao } from "@politicapp/data"

import { useColors } from "@/hooks/use-colors"

/**
 * Semáforo das métricas do app, sempre derivado da distribuição da casa
 * (p25/mediana/p75) — nunca de limites fixos escolhidos a dedo.
 */
export const useMetricColors = () => {
  const { successColor, warningColor, dangerColor } = useColors()

  /** Gasto: dentro da faixa típica é verde, acima amarelo, atípico vermelho. */
  const spendingColor = (value: number, distribution: Distribuicao) => {
    const level = nivelNaDistribuicao(value, distribution)
    if (level === "atipico") return dangerColor
    if (level === "acima") return warningColor
    return successColor
  }

  /**
   * Participação: da mediana para cima é verde, entre p25 e mediana amarelo.
   * Sem distribuição (benchmark ainda carregando) recua para faixas fixas.
   */
  const attendanceColor = (percent: number, distribution: Distribuicao | null) => {
    const [good, fair] = distribution
      ? [distribution.mediana, distribution.p25]
      : [80, 60]
    if (percent >= good) return successColor
    if (percent >= fair) return warningColor
    return dangerColor
  }

  return { spendingColor, attendanceColor }
}
