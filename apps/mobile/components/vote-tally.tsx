import type { Votacao } from "@politicapp/data"
import { Text, View } from "react-native"

import { useColors } from "@/hooks/use-colors"
import { formatNumber } from "@/utils/formatters"

type Props = {
  tally: Votacao["placar"]
  compact?: boolean
}

export const VoteTally = ({ tally, compact = false }: Props) => {
  const { successColor, dangerColor, muted } = useColors()
  const total = tally.sim + tally.nao + tally.abstencao + tally.outros

  if (total === 0) {
    return (
      <Text className="text-xs text-muted-foreground">
        Votos individuais não disponíveis
      </Text>
    )
  }

  const segments = [
    { count: tally.sim, color: successColor, label: "Sim" },
    { count: tally.nao, color: dangerColor, label: "Não" },
    { count: tally.abstencao + tally.outros, color: muted, label: "Outros" },
  ].filter((segment) => segment.count > 0)

  const summary = segments
    .map((segment) => `${segment.label} ${formatNumber(segment.count)}`)
    .join(", ")

  return (
    <View className="gap-2">
      <View
        className="h-2 flex-row overflow-hidden rounded-full bg-surface"
        accessible
        accessibilityLabel={`Placar da votação: ${summary}`}
      >
        {segments.map((segment) => (
          <View
            key={segment.label}
            style={{ flex: segment.count, backgroundColor: segment.color }}
          />
        ))}
      </View>

      {compact ? null : (
        <View className="flex-row gap-4">
          {segments.map((segment) => (
            <View key={segment.label} className="flex-row items-center gap-1.5">
              <View
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <Text className="text-xs text-muted-foreground">
                {segment.label} {formatNumber(segment.count)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
