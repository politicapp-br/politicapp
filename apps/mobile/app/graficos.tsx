import { Button } from "heroui-native"
import { useState, type ReactNode } from "react"
import { Text, View } from "react-native"
import {
  useDerivedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"

import {
  AreaChart,
  BarChart,
  ChartCrosshair,
  ChartIndicator,
  ChartLegend,
  LineChart,
  ProgressBar,
  DonutChart,
  useChartColors,
  useChartPressState,
  useChartTap,
  type ChartBounds,
} from "@/components/charts"
import { Card } from "@/components/card"
import { Screen } from "@/components/screen"
import { useColors } from "@/hooks/use-colors"

const MONTHS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
]

const EXPENSES = MONTHS.map((month, index) => ({
  month,
  value: [42, 58, 51, 69, 63, 78, 71, 89, 82, 97, 91, 115][index] as number,
}))

const ATTENDANCE = MONTHS.slice(0, 8).map((month, index) => ({
  month,
  attendance: [84, 88, 79, 91, 86, 93, 90, 95][index] as number,
}))

const VOTES = ["1º tri", "2º tri", "3º tri", "4º tri"].map(
  (quarter, index) => ({
    quarter,
    yes: [312, 287, 341, 298][index] as number,
    no: [145, 176, 122, 168][index] as number,
    abstention: [56, 50, 50, 47][index] as number,
  }),
)

const BLOC_COMPARISON = MONTHS.slice(0, 8).map((month, index) => ({
  month,
  government: [45, 48, 44, 51, 49, 54, 52, 58][index] as number,
  opposition: [38, 36, 41, 37, 40, 35, 38, 34][index] as number,
}))

// Rótulos dos popups pré-formatados por índice (worklets não têm Intl).
const EXPENSE_LABELS = EXPENSES.map(
  (item) => `${item.month} · R$ ${item.value} mil`,
)
const BLOC_LABELS = BLOC_COMPARISON.map(
  (item) =>
    `${item.month} · Governo ${item.government}% · Oposição ${item.opposition}%`,
)
const ATTENDANCE_LABELS = ATTENDANCE.map(
  (item) => `${item.month} · ${item.attendance}% de presença`,
)
const VOTE_LABELS = VOTES.map(
  (item) =>
    `${item.quarter} · Sim ${item.yes} · Não ${item.no} · Abst. ${item.abstention}`,
)

const DOMAIN_PADDING = { left: 12, right: 12, top: 16, bottom: 12 }

/** Contador que, ao mudar, repete a animação de entrada do gráfico. */
const useReplay = () => {
  const [key, setKey] = useState(0)
  return { key, replay: () => setKey((n) => n + 1) }
}

/**
 * Estado de inspeção de um gráfico cartesiano: press state do victory-native,
 * tap para segurar a seleção, limites do gráfico (para posicionar o popup) e
 * o rótulo do ponto selecionado, lido de `labels` pelo índice.
 */
const useInspectableChart = <Y extends Record<string, number>>(
  y: Y,
  labels: readonly string[],
) => {
  const { state, isActive } = useChartPressState({ x: "" as string, y })
  const tap = useChartTap(state)
  const [bounds, setBounds] = useState<ChartBounds | null>(null)
  const label = useDerivedValue(() => labels[state.matchedIndex.get()] ?? "")

  return {
    state,
    isActive,
    bounds,
    label,
    /** Props de interação para repassar ao LineChart/AreaChart/BarChart. */
    chartProps: {
      chartPressState: state,
      customGestures: tap.gesture,
      actionsRef: tap.actionsRef,
      onChartBoundsChange: setBounds,
    },
  }
}

const ReplayButton = ({ onPress }: { onPress: () => void }) => (
  <Button size="sm" variant="secondary" onPress={onPress}>
    Repetir
  </Button>
)

type InspectableCardProps = {
  title: string
  description: string
  onReplay: () => void
  inspection: {
    state: {
      isActive: SharedValue<boolean>
      x: { position: SharedValue<number> }
    }
    bounds: ChartBounds | null
    label: SharedValue<string>
  }
  /** Conteúdo abaixo do gráfico (ex.: legenda). */
  footer?: ReactNode
  children: ReactNode
}

/** Cartão com gráfico inspecionável e popup do ponto selecionado. */
const InspectableCard = ({
  title,
  description,
  onReplay,
  inspection,
  footer,
  children,
}: InspectableCardProps) => (
  <Card
    title={title}
    description={description}
    action={<ReplayButton onPress={onReplay} />}
  >
    <ChartCrosshair.Anchor
      chartBounds={inspection.bounds ?? undefined}
      isActive={inspection.state.isActive}
      x={inspection.state.x.position}
      className="pt-8"
    >
      {children}
      <ChartCrosshair.Value value={inspection.label} />
    </ChartCrosshair.Anchor>
    {footer}
  </Card>
)

/**
 * Cartão isolado: o rótulo central é o único estado React de gráfico da
 * tela, então mantê-lo aqui faz a seleção re-renderizar só este cartão em
 * vez da tela inteira (com os outros seis gráficos Skia). O destaque das
 * fatias nem passa por aqui — fica na thread de UI, dentro da DonutChart.
 */
const ChamberCompositionCard = () => {
  const colors = useChartColors()
  const donut = useReplay()
  const [selected, setSelected] = useState<number | null>(null)

  const bancadas = [
    { party: "PL", seats: 92, color: colors.series[0] },
    { party: "PT", seats: 68, color: colors.series[1] },
    { party: "União", seats: 59, color: colors.series[2] },
    { party: "PP", seats: 50, color: colors.series[3] },
    { party: "Outros", seats: 244, color: colors.series[4] },
  ]
  const selectedBancada = selected != null ? bancadas[selected] : null

  return (
    <Card
      title="Composição da Câmara"
      description="Toque numa fatia para ver as cadeiras"
      action={<ReplayButton onPress={donut.replay} />}
    >
      <View>
        <DonutChart
          slices={bancadas.map((bancada) => ({
            value: bancada.seats,
            color: bancada.color,
          }))}
          onSelectionChange={setSelected}
          resetKey={donut.key}
        />
        {selectedBancada ? (
          <View
            pointerEvents="none"
            className="absolute inset-0 items-center justify-center"
          >
            <Text
              className="font-title text-3xl text-foreground"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {selectedBancada.seats}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {selectedBancada.party} · cadeiras
            </Text>
          </View>
        ) : null}
      </View>
      <ChartLegend
        className="mt-3 justify-center"
        items={bancadas.map((bancada) => ({
          label: `${bancada.party} (${bancada.seats})`,
          color: bancada.color,
        }))}
      />
    </Card>
  )
}

const AttendanceBarsCard = () => {
  const { successColor, warningColor, dangerColor } = useColors()
  const progress = useReplay()

  const items = [
    { label: "Acima da mediana", value: 84, color: successColor },
    { label: "Na faixa intermediária", value: 67, color: warningColor },
    { label: "Abaixo do p25", value: 45, color: dangerColor },
  ]

  return (
    <Card
      title="Participação em votações"
      description="Barras de progresso animadas"
      action={<ReplayButton onPress={progress.replay} />}
    >
      <View className="gap-4">
        {items.map((item, index) => (
          <View key={item.label} className="gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-foreground">{item.label}</Text>
              <Text
                className="text-sm font-semibold"
                style={{ color: item.color, fontVariant: ["tabular-nums"] }}
              >
                {item.value}%
              </Text>
            </View>
            <ProgressBar
              value={item.value}
              color={item.color}
              entering={{ type: "timing", duration: 600 + index * 200 }}
              resetKey={progress.key}
            />
          </View>
        ))}
      </View>
    </Card>
  )
}

export default function ChartsShowcaseScreen() {
  const { successColor, dangerColor, muted } = useColors()

  const expenseReplay = useReplay()
  const blocReplay = useReplay()
  const attendanceReplay = useReplay()
  const barsReplay = useReplay()
  const stackReplay = useReplay()

  // Gastos (linha): tap segura a seleção, arrastar faz scrub.
  const expenses = useInspectableChart({ value: 0 }, EXPENSE_LABELS)
  // Aprovação por bloco (duas linhas).
  const blocs = useInspectableChart(
    { government: 0, opposition: 0 },
    BLOC_LABELS,
  )
  // Presença em plenário (área).
  const attendance = useInspectableChart({ attendance: 0 }, ATTENDANCE_LABELS)
  // Emendas pagas (barras).
  const bars = useInspectableChart({ value: 0 }, EXPENSE_LABELS)
  // Só o shared value entra no worklet: capturar `bars` levaria junto o gesto
  // de `chartProps`, que o Worklets não consegue copiar para a UI thread.
  const barsActive = bars.state.isActive
  const barsOpacity = useDerivedValue<number>(() =>
    withTiming(barsActive.get() ? 0.35 : 1, { duration: 160 }),
  )
  // Votações por trimestre (pilha).
  const stack = useInspectableChart(
    { yes: 0, no: 0, abstention: 0 },
    VOTE_LABELS,
  )

  return (
    <Screen>
      <Screen.TopBar title="Gráficos" />

      <Screen.Scroll contentClassName="gap-4">
        <InspectableCard
          title="Gastos da cota parlamentar"
          description="Toque num ponto ou arraste para inspecionar"
          onReplay={expenseReplay.replay}
          inspection={expenses}
        >
          <LineChart
            data={EXPENSES}
            xKey="month"
            yKeys={["value"]}
            {...expenses.chartProps}
            xAxis={{ tickCount: 6 }}
            yAxis={[{ formatYLabel: (value) => `${value}` }]}
            domainPadding={DOMAIN_PADDING}
          >
            {({ points, chartBounds }) => (
              <>
                <LineChart.Line
                  points={points.value}
                  curveType="monotoneX"
                  resetKey={expenseReplay.key}
                />
                {expenses.isActive ? (
                  <>
                    <ChartCrosshair
                      x={expenses.state.x.position}
                      top={chartBounds.top}
                      bottom={chartBounds.bottom}
                    />
                    <ChartIndicator
                      x={expenses.state.x.position}
                      y={expenses.state.y.value.position}
                    />
                  </>
                ) : null}
              </>
            )}
          </LineChart>
        </InspectableCard>

        <InspectableCard
          title="Aprovação por bloco"
          description="Toque num ponto para comparar os blocos"
          onReplay={blocReplay.replay}
          inspection={blocs}
          footer={
            <ChartLegend
              className="mt-3"
              items={[
                { label: "Governo", color: "chart-1" },
                { label: "Oposição", color: "chart-2" },
              ]}
            />
          }
        >
          <LineChart
            data={BLOC_COMPARISON}
            xKey="month"
            yKeys={["government", "opposition"]}
            {...blocs.chartProps}
            domainPadding={DOMAIN_PADDING}
          >
            {({ points, chartBounds }) => (
              <>
                <LineChart.Line
                  points={points.government}
                  color="chart-1"
                  curveType="natural"
                  entering={{ type: "timing", duration: 900 }}
                  resetKey={blocReplay.key}
                />
                <LineChart.Line
                  points={points.opposition}
                  color="chart-2"
                  curveType="natural"
                  entering={{ type: "timing", duration: 1300 }}
                  resetKey={blocReplay.key}
                />
                {blocs.isActive ? (
                  <>
                    <ChartCrosshair
                      x={blocs.state.x.position}
                      top={chartBounds.top}
                      bottom={chartBounds.bottom}
                    />
                    <ChartIndicator
                      x={blocs.state.x.position}
                      y={blocs.state.y.government.position}
                      color="chart-1"
                    />
                    <ChartIndicator
                      x={blocs.state.x.position}
                      y={blocs.state.y.opposition.position}
                      color="chart-2"
                    />
                  </>
                ) : null}
              </>
            )}
          </LineChart>
        </InspectableCard>

        <InspectableCard
          title="Presença em plenário"
          description="Toque num ponto para ver o mês"
          onReplay={attendanceReplay.replay}
          inspection={attendance}
        >
          <AreaChart
            data={ATTENDANCE}
            xKey="month"
            yKeys={["attendance"]}
            {...attendance.chartProps}
            domain={{ y: [60, 100] }}
            domainPadding={{ left: 12, right: 12 }}
            yAxis={[{ formatYLabel: (value) => `${value}%` }]}
          >
            {({ points, chartBounds }) => (
              <>
                <AreaChart.Area
                  points={points.attendance}
                  y0={chartBounds.bottom}
                  curveType="monotoneX"
                  gradient
                  chartBounds={chartBounds}
                  resetKey={attendanceReplay.key}
                />
                <LineChart.Line
                  points={points.attendance}
                  curveType="monotoneX"
                  resetKey={attendanceReplay.key}
                />
                {attendance.isActive ? (
                  <>
                    <ChartCrosshair
                      x={attendance.state.x.position}
                      top={chartBounds.top}
                      bottom={chartBounds.bottom}
                    />
                    <ChartIndicator
                      x={attendance.state.x.position}
                      y={attendance.state.y.attendance.position}
                    />
                  </>
                ) : null}
              </>
            )}
          </AreaChart>
        </InspectableCard>

        <InspectableCard
          title="Emendas pagas por mês"
          description="Toque numa barra para ver o valor"
          onReplay={barsReplay.replay}
          inspection={bars}
        >
          <BarChart
            data={EXPENSES}
            xKey="month"
            yKeys={["value"]}
            {...bars.chartProps}
            xAxis={{ tickCount: 12, labelRotate: 45 }}
            domain={{ y: [0] }}
          >
            {({ points, chartBounds }) => (
              <>
                <BarChart.Bar
                  points={points.value}
                  chartBounds={chartBounds}
                  innerPadding={0.4}
                  opacity={barsOpacity}
                  resetKey={barsReplay.key}
                />
                {bars.isActive ? (
                  <BarChart.Highlight
                    x={bars.state.x.position}
                    y={bars.state.y.value.position}
                    chartBounds={chartBounds}
                    points={points.value}
                    innerPadding={0.4}
                  />
                ) : null}
              </>
            )}
          </BarChart>
        </InspectableCard>

        <InspectableCard
          title="Votações por trimestre"
          description="Toque num trimestre para ver os votos"
          onReplay={stackReplay.replay}
          inspection={stack}
          footer={
            <ChartLegend
              className="mt-3"
              items={[
                { label: "Sim", color: successColor },
                { label: "Não", color: dangerColor },
                { label: "Abstenção", color: muted },
              ]}
            />
          }
        >
          <BarChart
            data={VOTES}
            xKey="quarter"
            yKeys={["yes", "no", "abstention"]}
            {...stack.chartProps}
            domain={{ y: [0, 560] }}
          >
            {({ points, chartBounds }) => (
              <>
                <BarChart.Stacked
                  points={[points.yes, points.no, points.abstention]}
                  chartBounds={chartBounds}
                  colors={[successColor, dangerColor, muted]}
                  barWidth={36}
                  resetKey={stackReplay.key}
                />
                {stack.isActive ? (
                  <ChartCrosshair
                    x={stack.state.x.position}
                    top={chartBounds.top}
                    bottom={chartBounds.bottom}
                  />
                ) : null}
              </>
            )}
          </BarChart>
        </InspectableCard>

        <AttendanceBarsCard />

        <ChamberCompositionCard />
      </Screen.Scroll>
    </Screen>
  )
}
