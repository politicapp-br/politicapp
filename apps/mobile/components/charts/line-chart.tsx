import type { PathProps, SkiaDefaultProps } from "@shopify/react-native-skia"
import type { ReactNode } from "react"
import type { CurveType, PointsArray } from "victory-native"
import { Line } from "victory-native"

import {
  CartesianRoot,
  type CartesianRootProps,
  type InputFields,
  type NumericalFields,
} from "./cartesian-root"
import { useEntryProgress, type EntryAnimation } from "./entry-animation"
import { resolveSeriesColor, useChartColors, type ChartColorToken } from "./theme"

type TransitionAnimation = Parameters<typeof Line>[0]["animate"]

type LineProps = {
  points: PointsArray
  /** Token da paleta ("chart-1".."chart-5") ou cor literal. */
  color?: ChartColorToken | (string & {})
  strokeWidth?: number
  curveType?: CurveType
  connectMissingData?: boolean
  /** Interpola o caminho quando os dados mudam (mesmo nº de pontos). */
  animate?: TransitionAnimation
  /** Traçado progressivo ao montar (padrão ligado; `false` desliga). */
  entering?: EntryAnimation | false
  /** Mude o valor para repetir a animação de entrada. */
  resetKey?: number | string | boolean | null
  opacity?: number
  children?: ReactNode
} & Pick<SkiaDefaultProps<PathProps, "start" | "end">, "start" | "end">

const LineChartLine = ({
  color = "chart-1",
  strokeWidth = 2,
  curveType = "linear",
  entering = { type: "timing", duration: 700 },
  resetKey,
  end,
  ...rest
}: LineProps) => {
  const chartColors = useChartColors()
  // Um `end` explícito do consumidor tem prioridade sobre a entrada padrão.
  const progress = useEntryProgress(end === undefined ? entering : false, resetKey)

  return (
    <Line
      color={resolveSeriesColor(chartColors, color)}
      strokeWidth={strokeWidth}
      curveType={curveType}
      strokeCap="round"
      strokeJoin="round"
      end={end ?? progress}
      {...rest}
    />
  )
}

type AnimatedLineProps = Omit<LineProps, "start" | "end" | "animate" | "entering"> & {
  /** Animação de traçado progressivo ao montar. */
  animation?: EntryAnimation
}

/** Igual a `LineChart.Line` (que já anima a entrada); mantido por compatibilidade. */
const LineChartAnimatedLine = ({
  animation = { type: "timing", duration: 700 },
  ...rest
}: AnimatedLineProps) => <LineChartLine entering={animation} {...rest} />

export const LineChart = <
  RawData extends Record<string, unknown>,
  XK extends keyof InputFields<RawData>,
  YK extends keyof NumericalFields<RawData>,
>(
  props: CartesianRootProps<RawData, XK, YK>,
) => <CartesianRoot {...props} />

LineChart.Line = LineChartLine
LineChart.AnimatedLine = LineChartAnimatedLine
