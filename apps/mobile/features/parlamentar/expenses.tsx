import {
  tipoDespesaCurto,
  type DespesaPorMes,
  type ParlamentarRef,
} from "@politicapp/data"
import { useMemo, useState } from "react"
import { Text, View } from "react-native"
import { useDerivedValue, withTiming } from "react-native-reanimated"

import { Card } from "@/components/card"
import {
  BarChart,
  ChartCrosshair,
  useChartPressState,
  useChartTap,
  type ChartBounds,
} from "@/components/charts"
import { DetailRow } from "@/components/detail-row"
import { MedianComparison } from "@/components/median-comparison"
import {
  useCasaBenchmark,
  useExpenseSummary,
} from "@/hooks/use-static-data"
import { formatMonthShort } from "@/utils/date-utils"
import { formatCurrency, formatCurrencyCompact } from "@/utils/formatters"

type Props = { parlamentar: ParlamentarRef }

export const ExpensesCard = ({ parlamentar }: Props) => {
  const summary = useExpenseSummary(parlamentar)
  const benchmark = useCasaBenchmark(parlamentar.casa)

  if (!summary.data) {
    return (
      <Card title="Cota parlamentar" className="gap-2">
        <Text className="text-sm text-muted-foreground">
          Nenhum gasto registrado neste ano até agora.
        </Text>
      </Card>
    )
  }

  const { total, porMes: byMonth, porTipo: byType, ano: year } = summary.data

  return (
    <Card title={`Cota parlamentar em ${year}`} className="gap-4">
      <Card.Highlight value={formatCurrency(total)} />

      {benchmark.data ? (
        <MedianComparison
          value={total}
          distribution={benchmark.data.gastos.geral}
          label="Comparado à mediana da casa"
        />
      ) : null}

      <MonthlyChart byMonth={byMonth} />

      <View className="gap-2">
        <Text className="text-sm font-semibold text-foreground">
          Onde foi gasto
        </Text>
        {byType.slice(0, 5).map((item) => (
          <DetailRow
            key={item.tipo}
            label={tipoDespesaCurto(item.tipo)}
            value={formatCurrencyCompact(item.valor)}
          />
        ))}
      </View>
    </Card>
  )
}

type MonthlyChartProps = {
  byMonth: DespesaPorMes[]
}

const BAR_PADDING = 0.35

const MonthlyChart = ({ byMonth }: MonthlyChartProps) => {
  const data = useMemo(
    () =>
      byMonth.map((item) => ({
        label: formatMonthShort(item.ano, item.mes).slice(0, 3),
        value: item.valor,
      })),
    [byMonth],
  )

  const { state, isActive } = useChartPressState({ x: "", y: { value: 0 } })
  const tap = useChartTap(state)
  const [bounds, setBounds] = useState<ChartBounds | null>(null)

  // Textos prontos por índice: worklets não têm acesso ao Intl.
  const captions = useMemo(
    () => data.map((item) => `${item.label} · ${formatCurrencyCompact(item.value)}`),
    [data],
  )
  const caption = useDerivedValue(() => captions[state.matchedIndex.get()] ?? "")

  // Enquanto há seleção, a série esmaece e só o destaque fica em cor cheia.
  const seriesOpacity = useDerivedValue<number>(() =>
    withTiming(state.isActive.get() ? 0.35 : 1, { duration: 160 }),
  )

  if (byMonth.length === 0) return null

  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-foreground">Mês a mês</Text>
      <View
        accessible
        accessibilityLabel={`Gastos mês a mês: ${byMonth
          .map(
            (item) =>
              `${formatMonthShort(item.ano, item.mes)} ${formatCurrencyCompact(item.valor)}`,
          )
          .join(", ")}`}
      >
        <ChartCrosshair.Anchor
          chartBounds={bounds ?? undefined}
          isActive={state.isActive}
          x={state.x.position}
          className="pt-8"
        >
          <BarChart
            data={data}
            xKey="label"
            yKeys={["value"]}
            wrapperClassName="h-32"
            chartPressState={state}
            customGestures={tap.gesture}
            actionsRef={tap.actionsRef}
            onChartBoundsChange={setBounds}
            xAxis={{ tickCount: data.length }}
            yAxis={[{ lineWidth: 0, font: null }]}
            domain={{ y: [0] }}
            domainPadding={{ left: 18, right: 18, top: 8 }}
          >
            {({ points, chartBounds }) => (
              <>
                <BarChart.Bar
                  points={points.value}
                  chartBounds={chartBounds}
                  innerPadding={BAR_PADDING}
                  opacity={seriesOpacity}
                />
                {isActive ? (
                  <BarChart.Highlight
                    x={state.x.position}
                    y={state.y.value.position}
                    chartBounds={chartBounds}
                    points={points.value}
                    innerPadding={BAR_PADDING}
                  />
                ) : null}
              </>
            )}
          </BarChart>
          <ChartCrosshair.Value value={caption} />
        </ChartCrosshair.Anchor>
      </View>
    </View>
  )
}
