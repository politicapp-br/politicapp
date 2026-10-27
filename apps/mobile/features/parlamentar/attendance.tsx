import type { ParlamentarRef } from "@politicapp/data"
import { Text } from "react-native"

import { Card } from "@/components/card"
import { ProgressBar } from "@/components/charts"
import { useMetricColors } from "@/hooks/use-metric-colors"
import {
  useCasaBenchmark,
  useIndexedParlamentar,
} from "@/hooks/use-static-data"
import { formatNumber, formatPercent } from "@/utils/formatters"

type Props = { parlamentar: ParlamentarRef }

export const AttendanceCard = ({ parlamentar }: Props) => {
  const { attendanceColor } = useMetricColors()
  const indexed = useIndexedParlamentar(parlamentar)
  const benchmark = useCasaBenchmark(parlamentar.casa)

  const percent = indexed.data?.participacaoPercentual
  const votesCast = indexed.data?.votacoesParticipadas

  if (percent === null || percent === undefined) return null

  const distribution = benchmark.data?.participacao.geral ?? null
  const median = distribution?.mediana ?? null

  // Posição na distribuição da casa; sem benchmark, faixas fixas de fallback.
  const color = attendanceColor(percent, distribution)

  return (
    <Card title="Participação em votações">
      <Card.Highlight
        value={formatPercent(percent, 0)}
        color={color}
        context={
          benchmark.data
            ? `de ${formatNumber(benchmark.data.votacoesNominais)} votações nominais`
            : undefined
        }
      />

      <ProgressBar
        value={percent}
        color={color}
        accessibilityLabel={`Participação em votações: ${formatPercent(percent, 0)}${median !== null ? `, mediana da casa ${formatPercent(median, 0)}` : ""}`}
      />

      <Text className="text-xs text-muted-foreground">
        {votesCast !== null && votesCast !== undefined
          ? `Registrou voto em ${formatNumber(votesCast)} votações. `
          : ""}
        {median !== null
          ? `A mediana da casa é ${formatPercent(median, 0)}.`
          : ""}
      </Text>

      <Text className="text-[11px] text-muted-foreground">
        Conta apenas votações nominais, em que o voto de cada parlamentar fica
        registrado. Não é a mesma coisa que presença em sessões.
      </Text>
    </Card>
  )
}
