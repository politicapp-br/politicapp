import { Circle } from "@shopify/react-native-skia"
import type { SharedValue } from "react-native-reanimated"

import { resolveSeriesColor, useChartColors, type ChartColorToken } from "./theme"

type Props = {
  x: SharedValue<number>
  y: SharedValue<number>
  color?: ChartColorToken | (string & {})
  /** Raio do ponto central (padrão 5). */
  radius?: number
  /** Halo suave ao redor do ponto (padrão true). */
  halo?: boolean
}

/** Ponto de destaque que segue o toque no gráfico (dentro do canvas Skia). */
export const ChartIndicator = ({
  x,
  y,
  color = "chart-1",
  radius = 5,
  halo = true,
}: Props) => {
  const chartColors = useChartColors()
  const fillColor = resolveSeriesColor(chartColors, color)

  return (
    <>
      {halo ? <Circle cx={x} cy={y} r={radius + 8} color={fillColor} opacity={0.15} /> : null}
      <Circle cx={x} cy={y} r={radius + 2} color={chartColors.background} />
      <Circle cx={x} cy={y} r={radius} color={fillColor} />
    </>
  )
}
