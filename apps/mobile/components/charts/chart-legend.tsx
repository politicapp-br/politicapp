import { Text, View } from "react-native"

import { cn } from "@/utils/cn"

import { resolveSeriesColor, useChartColors, type ChartColorToken } from "./theme"

export type LegendItem = {
  label: string
  color: ChartColorToken | (string & {})
}

type Props = {
  items: LegendItem[]
  className?: string
}

/** Legenda horizontal (bolinha + rótulo), no padrão visual do app. */
export const ChartLegend = ({ items, className }: Props) => {
  const chartColors = useChartColors()

  return (
    <View className={cn("flex-row flex-wrap gap-x-4 gap-y-1.5", className)}>
      {items.map((item) => (
        <View key={item.label} className="flex-row items-center gap-1.5">
          <View
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: resolveSeriesColor(chartColors, item.color) }}
          />
          <Text className="text-xs text-muted-foreground">{item.label}</Text>
        </View>
      ))}
    </View>
  )
}
