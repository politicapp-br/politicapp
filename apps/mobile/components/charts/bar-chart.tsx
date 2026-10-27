import { Group, Path, Skia, vec } from "@shopify/react-native-skia"
import type { ReactNode } from "react"
import { Children, isValidElement } from "react"
import { useDerivedValue, type SharedValue } from "react-native-reanimated"
import type {
  ChartBounds,
  PointsArray,
  RoundedCorners,
} from "victory-native"
import {
  Bar,
  BarGroup,
  StackedBar,
  createRoundedRectPath,
  useBarWidth,
  useCartesianChartContext,
} from "victory-native"

import {
  CartesianRoot,
  type CartesianRootProps,
  type InputFields,
  type NumericalFields,
} from "./cartesian-root"
import { useEntryProgress, type EntryAnimation } from "./entry-animation"
import { resolveSeriesColor, useChartColors, type ChartColorToken } from "./theme"

type TransitionAnimation = Parameters<typeof Bar>[0]["animate"]

const DEFAULT_CORNERS: RoundedCorners = { topLeft: 4, topRight: 4 }

const DEFAULT_ENTERING: EntryAnimation = { type: "timing", duration: 600 }

type EntryProps = {
  /** Crescimento a partir da base ao montar (padrão ligado; `false` desliga). */
  entering?: EntryAnimation | false
  /** Mude o valor para repetir a animação de entrada. */
  resetKey?: number | string | boolean | null
}

type GrowFromBaseProps = EntryProps & {
  /** Y da base do gráfico (`chartBounds.bottom`), pivô do crescimento. */
  base: number
  opacity?: number | SharedValue<number>
  children: ReactNode
}

/** Escala as barras verticalmente a partir da base do gráfico ao montar. */
const GrowFromBase = ({
  entering = DEFAULT_ENTERING,
  resetKey,
  base,
  opacity,
  children,
}: GrowFromBaseProps) => {
  const progress = useEntryProgress(entering, resetKey)
  const scaleTransform = useDerivedValue(() => [{ scaleY: progress.get() }])

  return (
    <Group transform={scaleTransform} origin={vec(0, base)} opacity={opacity}>
      {children}
    </Group>
  )
}

type BarProps = EntryProps & {
  points: PointsArray
  chartBounds: ChartBounds
  color?: ChartColorToken | (string & {})
  /** Fração (0–1) do espaço entre barras. */
  innerPadding?: number
  barWidth?: number
  barCount?: number
  roundedCorners?: RoundedCorners
  animate?: TransitionAnimation
  /** Aceita SharedValue — útil para esmaecer a série durante o toque. */
  opacity?: number | SharedValue<number>
  children?: ReactNode
}

const BarChartBar = ({
  color = "chart-1",
  roundedCorners = DEFAULT_CORNERS,
  entering,
  resetKey,
  opacity,
  ...rest
}: BarProps) => {
  const chartColors = useChartColors()
  return (
    <GrowFromBase
      entering={entering}
      resetKey={resetKey}
      base={rest.chartBounds.bottom}
      opacity={opacity}
    >
      <Bar
        color={resolveSeriesColor(chartColors, color)}
        roundedCorners={roundedCorners}
        {...rest}
      />
    </GrowFromBase>
  )
}

type GroupItemProps = {
  points: PointsArray
  color?: ChartColorToken | (string & {})
  animate?: TransitionAnimation
  children?: ReactNode
}

/** Marcador: convertido em BarGroup.Bar dentro de BarChart.Group. */
const BarChartGroupItem = (_props: GroupItemProps) => null

type GroupProps = EntryProps & {
  chartBounds: ChartBounds
  children: ReactNode
  betweenGroupPadding?: number
  withinGroupPadding?: number
  roundedCorners?: RoundedCorners
  barWidth?: number
  opacity?: number | SharedValue<number>
  onBarSizeChange?: (values: {
    barWidth: number
    groupWidth: number
    gapWidth: number
  }) => void
}

const BarChartGroup = ({
  children,
  roundedCorners = DEFAULT_CORNERS,
  betweenGroupPadding = 0.25,
  withinGroupPadding = 0.25,
  entering,
  resetKey,
  opacity,
  ...rest
}: GroupProps) => {
  const chartColors = useChartColors()

  const bars = Children.toArray(children)
    .filter(isValidElement)
    .map((child, index) => {
      const props = child.props as GroupItemProps
      return (
        <BarGroup.Bar
          key={index}
          points={props.points}
          color={resolveSeriesColor(chartColors, props.color ?? `chart-${Math.min(index + 1, 5)}`)}
          animate={props.animate}
        >
          {props.children}
        </BarGroup.Bar>
      )
    })

  return (
    <GrowFromBase
      entering={entering}
      resetKey={resetKey}
      base={rest.chartBounds.bottom}
      opacity={opacity}
    >
      <BarGroup
        roundedCorners={roundedCorners}
        betweenGroupPadding={betweenGroupPadding}
        withinGroupPadding={withinGroupPadding}
        {...rest}
      >
        {bars}
      </BarGroup>
    </GrowFromBase>
  )
}

type StackedProps = EntryProps & {
  /** Séries em ordem de empilhamento (índice 0 fica na base). */
  points: PointsArray[]
  chartBounds: ChartBounds
  colors?: (ChartColorToken | (string & {}))[]
  innerPadding?: number
  barWidth?: number
  barCount?: number
  animate?: TransitionAnimation
  opacity?: number | SharedValue<number>
  /** Raio dos cantos do topo da pilha (padrão 4). */
  topRadius?: number
}

const BarChartStacked = ({
  colors,
  topRadius = 4,
  entering,
  resetKey,
  opacity,
  ...rest
}: StackedProps) => {
  const chartColors = useChartColors()
  const resolvedColors = (colors ?? chartColors.series).map((color) =>
    resolveSeriesColor(chartColors, color),
  )
  return (
    <GrowFromBase
      entering={entering}
      resetKey={resetKey}
      base={rest.chartBounds.bottom}
      opacity={opacity}
    >
      <StackedBar
        colors={resolvedColors}
        barOptions={({ isTop }) => ({
          roundedCorners: isTop
            ? { topLeft: topRadius, topRight: topRadius }
            : undefined,
        })}
        {...rest}
      />
    </GrowFromBase>
  )
}

type HighlightProps = {
  /** Centro da barra tocada: `state.x.position`. */
  x: SharedValue<number>
  /** Topo da barra tocada: `state.y.<chave>.position`. */
  y: SharedValue<number>
  chartBounds: ChartBounds
  /** Mesmos pontos da série base, para casar a largura da barra. */
  points: PointsArray
  color?: ChartColorToken | (string & {})
  /** Use os mesmos valores passados a `BarChart.Bar`. */
  innerPadding?: number
  barWidth?: number
  barCount?: number
  roundedCorners?: RoundedCorners
}

/**
 * Barra de destaque que segue o toque. Desenhe por cima de `BarChart.Bar`
 * enquanto `isActive`, esmaecendo a série base via `opacity`, e mostre o
 * valor com `ChartCrosshair.Value` — o padrão completo está no README.
 */
const BarChartHighlight = ({
  x,
  y,
  chartBounds,
  points,
  color = "chart-1",
  innerPadding = 0.25,
  barWidth,
  barCount,
  roundedCorners = DEFAULT_CORNERS,
}: HighlightProps) => {
  const chartColors = useChartColors()
  const fillColor = resolveSeriesColor(chartColors, color)
  const { yScale } = useCartesianChartContext()
  const base = yScale(0)
  const width = useBarWidth({
    points,
    chartBounds,
    innerPadding,
    customBarWidth: barWidth,
    barCount,
  })

  const highlightPath = useDerivedValue(() =>
    Skia.PathBuilder.Make()
      .addRRect(
        createRoundedRectPath(
          x.get() - width / 2,
          y.get(),
          width,
          base - y.get(),
          roundedCorners,
          1,
        ),
      )
      .detach(),
  )

  return <Path path={highlightPath} style="fill" color={fillColor} />
}

export const BarChart = <
  RawData extends Record<string, unknown>,
  XK extends keyof InputFields<RawData>,
  YK extends keyof NumericalFields<RawData>,
>({
  domainPadding,
  ...props
}: CartesianRootProps<RawData, XK, YK>) => (
  <CartesianRoot
    domainPadding={domainPadding ?? { left: 24, right: 24, top: 12 }}
    {...props}
  />
)

BarChart.Bar = BarChartBar
BarChart.Group = BarChartGroup
BarChart.GroupItem = BarChartGroupItem
BarChart.Stacked = BarChartStacked
BarChart.Highlight = BarChartHighlight
