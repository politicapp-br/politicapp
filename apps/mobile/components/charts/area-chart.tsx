import { Group, LinearGradient, rect, vec } from "@shopify/react-native-skia"
import type { ReactNode } from "react"
import { useDerivedValue } from "react-native-reanimated"
import type { ChartBounds, CurveType, PointsArray } from "victory-native"
import { Area, StackedArea } from "victory-native"

import {
  CartesianRoot,
  type CartesianRootProps,
  type InputFields,
  type NumericalFields,
} from "./cartesian-root"
import { useEntryProgress, type EntryAnimation } from "./entry-animation"
import { resolveSeriesColor, useChartColors, type ChartColorToken } from "./theme"

type TransitionAnimation = Parameters<typeof Area>[0]["animate"]

/** Folga do clipRect de revelação para não cortar traços nas bordas. */
const CLIP_PADDING = 12

type AreaProps = {
  points: PointsArray
  /** Linha de base da área — normalmente `chartBounds.bottom`. */
  y0: number
  color?: ChartColorToken | (string & {})
  opacity?: number
  curveType?: CurveType
  connectMissingData?: boolean
  animate?: TransitionAnimation
  /**
   * Entrada ao montar: revelação esquerda→direita quando `chartBounds` está
   * presente (sincronizada com o traçado da linha), fade caso contrário.
   * `false` desliga.
   */
  entering?: EntryAnimation | false
  /** Mude o valor para repetir a animação de entrada. */
  resetKey?: number | string | boolean | null
  /**
   * Preenchimento degradê (cor → transparente, de cima para baixo).
   * Requer `chartBounds` para orientar o vetor do degradê.
   */
  gradient?: boolean
  chartBounds?: ChartBounds
  children?: ReactNode
}

const AreaChartArea = ({
  color = "chart-1",
  opacity = 0.2,
  curveType = "linear",
  gradient = false,
  chartBounds,
  children,
  entering = { type: "timing", duration: 700 },
  resetKey,
  ...rest
}: AreaProps) => {
  const chartColors = useChartColors()
  const fillColor = resolveSeriesColor(chartColors, color)
  const progress = useEntryProgress(entering, resetKey)

  const clipRect = useDerivedValue(() => {
    if (!chartBounds) return rect(0, 0, 0, 0)
    return rect(
      chartBounds.left - CLIP_PADDING,
      chartBounds.top - CLIP_PADDING,
      (chartBounds.right - chartBounds.left + CLIP_PADDING * 2) * progress.get(),
      chartBounds.bottom - chartBounds.top + CLIP_PADDING * 2,
    )
  })

  const area =
    gradient && chartBounds ? (
      <Area color={fillColor} curveType={curveType} {...rest}>
        <LinearGradient
          start={vec(0, chartBounds.top)}
          end={vec(0, chartBounds.bottom)}
          colors={[`${fillColor}66`, `${fillColor}00`]}
        />
        {children}
      </Area>
    ) : (
      <Area color={fillColor} opacity={opacity} curveType={curveType} {...rest}>
        {children}
      </Area>
    )

  if (entering === false) return area
  if (chartBounds) return <Group clip={clipRect}>{area}</Group>
  return <Group opacity={progress}>{area}</Group>
}

type StackedAreaProps = {
  /** Séries em ordem de empilhamento (índice 0 fica na base). */
  points: PointsArray[]
  y0: number
  colors?: (ChartColorToken | (string & {}))[]
  opacity?: number
  curveType?: CurveType
  animate?: TransitionAnimation
  /** Fade ao montar (padrão ligado; `false` desliga). */
  entering?: EntryAnimation | false
  /** Mude o valor para repetir a animação de entrada. */
  resetKey?: number | string | boolean | null
}

const AreaChartStackedArea = ({
  colors,
  opacity = 0.85,
  curveType = "linear",
  entering = { type: "timing", duration: 600 },
  resetKey,
  ...rest
}: StackedAreaProps) => {
  const chartColors = useChartColors()
  const progress = useEntryProgress(entering, resetKey)
  const resolvedColors = (colors ?? chartColors.series).map((color) =>
    resolveSeriesColor(chartColors, color),
  )

  const stack = (
    <StackedArea
      colors={resolvedColors}
      curveType={curveType}
      areaOptions={() => ({ opacity })}
      {...rest}
    />
  )

  if (entering === false) return stack
  return <Group opacity={progress}>{stack}</Group>
}

export const AreaChart = <
  RawData extends Record<string, unknown>,
  XK extends keyof InputFields<RawData>,
  YK extends keyof NumericalFields<RawData>,
>(
  props: CartesianRootProps<RawData, XK, YK>,
) => <CartesianRoot {...props} />

AreaChart.Area = AreaChartArea
AreaChart.StackedArea = AreaChartStackedArea
