import type { Color, SkFont } from "@shopify/react-native-skia"
import type { MutableRefObject, ReactNode } from "react"
import { View } from "react-native"
import type { GestureType, LegacyComposedGesture } from "react-native-gesture-handler"
import type { SharedValue } from "react-native-reanimated"
import type {
  CartesianChartRenderArg,
  ChartBounds,
  ChartPressState,
} from "victory-native"
import { CartesianChart } from "victory-native"

import { cn } from "@/utils/cn"

import { useChartColors, useChartFont } from "./theme"

type MaybeNumber = number | null | undefined
type InputFieldType = number | string

export type InputFields<T> = {
  [K in keyof T as T[K] extends InputFieldType ? K : never]: T[K] extends InputFieldType
    ? T[K]
    : never
}

export type NumericalFields<T> = {
  [K in keyof T as T[K] extends MaybeNumber ? K : never]: T[K]
}

export type XAxisConfig<XLabel> = {
  font?: SkFont | null
  labelColor?: string
  lineColor?: Color
  lineWidth?: number
  axisSide?: "top" | "bottom"
  labelPosition?: "inset" | "outset"
  labelOffset?: number
  labelRotate?: number
  tickCount?: number
  tickValues?: number[]
  formatXLabel?: (label: XLabel) => string
}

export type YAxisConfig<YLabel> = {
  font?: SkFont | null
  labelColor?: string
  lineColor?: Color
  lineWidth?: number
  axisSide?: "left" | "right"
  labelPosition?: "inset" | "outset"
  labelOffset?: number
  tickCount?: number
  tickValues?: number[]
  formatYLabel?: (label: YLabel) => string
}

type PerSideNumber = number | { left?: number; right?: number; top?: number; bottom?: number }

/** Campos do press state que os utilitários de toque do kit precisam. */
export type PressState = {
  isActive: SharedValue<boolean>
  matchedIndex: SharedValue<number>
}

/** Ações imperativas expostas pelo CartesianChart via `actionsRef`. */
export type ChartActions = {
  handleTouch: (state: PressState, x: number, y: number) => void
}

export type CartesianRootProps<
  RawData extends Record<string, unknown>,
  XK extends keyof InputFields<RawData>,
  YK extends keyof NumericalFields<RawData>,
> = {
  data: RawData[]
  xKey: XK
  yKeys: YK[]
  children: (args: CartesianChartRenderArg<RawData, YK>) => ReactNode
  renderOutside?: (args: CartesianChartRenderArg<RawData, YK>) => ReactNode
  /** Classes do View externo — a altura vem daqui (padrão: h-48 w-full). */
  wrapperClassName?: string
  xAxis?: XAxisConfig<InputFields<RawData>[XK]>
  yAxis?: YAxisConfig<RawData[YK]>[]
  /** Oculta os dois eixos (modo sparkline). */
  hideAxes?: boolean
  domain?: { x?: [number] | [number, number]; y?: [number] | [number, number] }
  domainPadding?: PerSideNumber
  padding?: PerSideNumber
  chartPressState?:
    | ChartPressState<{ x: InputFields<RawData>[XK]; y: Record<YK, number> }>
    | ChartPressState<{ x: InputFields<RawData>[XK]; y: Record<YK, number> }>[]
  onChartBoundsChange?: (bounds: ChartBounds) => void
  /** Gestos extras compostos com o de arrastar (ex.: `useChartTap().gesture`). */
  customGestures?: LegacyComposedGesture | GestureType
  /** Recebe as ações imperativas do gráfico (ex.: `useChartTap().actionsRef`).
   * Como SharedValue, o `handleTouch` fica utilizável na thread de UI. */
  actionsRef?:
    | MutableRefObject<ChartActions | null>
    | SharedValue<ChartActions | null>
}

/**
 * Base compartilhada de LineChart, AreaChart e BarChart: envolve o
 * CartesianChart do victory-native com eixos já tematizados (fonte Inter,
 * grade horizontal discreta, sem moldura).
 */
export const CartesianRoot = <
  RawData extends Record<string, unknown>,
  XK extends keyof InputFields<RawData>,
  YK extends keyof NumericalFields<RawData>,
>({
  wrapperClassName,
  xAxis,
  yAxis,
  hideAxes = false,
  children,
  ...rest
}: CartesianRootProps<RawData, XK, YK>) => {
  const chartColors = useChartColors()
  const font = useChartFont()

  const xAxisConfig = hideAxes
    ? null
    : {
        font,
        labelColor: chartColors.label,
        lineWidth: 0,
        labelOffset: 6,
        ...xAxis,
      }

  const yAxisConfigs = hideAxes
    ? null
    : (yAxis ?? [{}]).map((config) => ({
        font,
        labelColor: chartColors.label,
        lineColor: chartColors.grid,
        lineWidth: 1,
        labelOffset: 8,
        tickCount: 4,
        ...config,
      }))

  return (
    <View className={cn("h-48 w-full", wrapperClassName)}>
      <InnerCartesianChart
        {...rest}
        {...(xAxisConfig ? { xAxis: xAxisConfig } : {})}
        {...(yAxisConfigs ? { yAxis: yAxisConfigs } : {})}
        frame={{ lineWidth: 0 }}
      >
        {children}
      </InnerCartesianChart>
    </View>
  )
}

// O CartesianChart tem genéricos que não sobrevivem a um wrapper com props
// parciais; o único cast fica isolado aqui, e a API pública segue tipada.
const InnerCartesianChart = CartesianChart as unknown as (
  props: Record<string, unknown> & { children?: unknown },
) => React.ReactElement
