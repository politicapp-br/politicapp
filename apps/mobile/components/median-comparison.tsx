import type { Distribuicao } from "@politicapp/data"
import { posicaoNaDistribuicao } from "@politicapp/data"
import { Text, View } from "react-native"

import { ProgressBar } from "@/components/charts"
import { useColors } from "@/hooks/use-colors"
import { useMetricColors } from "@/hooks/use-metric-colors"
import { formatCurrencyCompact, formatMedianDeviation } from "@/utils/formatters"

type Props = {
  value: number
  distribution: Distribuicao
  label: string
}

export const MedianComparison = ({ value, distribution, label }: Props) => {
  const { border } = useColors()
  const { spendingColor } = useMetricColors()
  const deviation = posicaoNaDistribuicao(value, distribution)
  const color = spendingColor(value, distribution)

  const max = Math.max(value, distribution.p75, distribution.mediana) * 1.1
  const valueWidth = max === 0 ? 0 : (value / max) * 100
  const medianPosition = max === 0 ? 0 : (distribution.mediana / max) * 100

  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-sm text-muted-foreground">{label}</Text>
        <Text className="text-sm font-semibold" style={{ color }}>
          {formatMedianDeviation(deviation)}
        </Text>
      </View>

      <ProgressBar
        className="h-3"
        value={valueWidth}
        color={color}
        accessibilityLabel={`${label}: ${formatMedianDeviation(deviation)} da mediana de ${formatCurrencyCompact(distribution.mediana)}`}
        accessibilityValue={{ min: 0, max: Math.round(max), now: Math.round(value) }}
      >
        <View
          className="absolute h-full"
          style={{
            left: `${Math.min(medianPosition, 100)}%`,
            width: 2,
            backgroundColor: border,
          }}
        />
      </ProgressBar>

      <Text className="text-xs text-muted-foreground">
        Mediana da casa: {formatCurrencyCompact(distribution.mediana)} · faixa
        típica {formatCurrencyCompact(distribution.p25)} a{" "}
        {formatCurrencyCompact(distribution.p75)}
      </Text>
    </View>
  )
}
