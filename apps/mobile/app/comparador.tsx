import {
  parlamentarKey,
  posicaoNaDistribuicao,
  type IndiceParlamentar,
} from "@politicapp/data"
import { Button, Chip, Input, Surface, TextField } from "heroui-native"
import { useDeferredValue, useMemo, useState, type ReactNode } from "react"
import { Text, View } from "react-native"

import { Card } from "@/components/card"
import { Icon } from "@/components/icon"
import { ParlamentarAvatar } from "@/components/parlamentar-avatar"
import { Screen } from "@/components/screen"
import { LoadingState, ErrorState } from "@/components/states"
import { useColors } from "@/hooks/use-colors"
import { useMetricColors } from "@/hooks/use-metric-colors"
import { useCasaBenchmark, useParlamentarIndex } from "@/hooks/use-static-data"
import {
  formatPercent,
  formatCurrencyCompact,
  formatMedianDeviation,
} from "@/utils/formatters"
import { normalizeForSearch } from "@/utils/text"

const MAX_SELECTED = 3

export default function CompareScreen() {
  const [selected, setSelected] = useState<IndiceParlamentar[]>([])
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)

  const index = useParlamentarIndex()

  const suggestions = useMemo(() => {
    const term = normalizeForSearch(deferredSearch.trim())
    if (!index.data || term.length < 2) return []

    const selectedKeys = new Set(selected.map(parlamentarKey))

    return index.data.parlamentares
      .filter((parlamentar) => !selectedKeys.has(parlamentarKey(parlamentar)))
      .filter((parlamentar) => normalizeForSearch(parlamentar.nome).includes(term))
      .slice(0, 6)
  }, [index.data, deferredSearch, selected])

  const add = (parlamentar: IndiceParlamentar) => {
    if (selected.length >= MAX_SELECTED) return
    setSelected((current) => [...current, parlamentar])
    setSearch("")
  }

  const remove = (parlamentar: IndiceParlamentar) =>
    setSelected((current) =>
      current.filter(
        (item) => parlamentarKey(item) !== parlamentarKey(parlamentar),
      ),
    )

  if (index.isPending) {
    return (
      <Screen>
        <Screen.TopBar title="Comparador" />
        <LoadingState />
      </Screen>
    )
  }

  if (index.isError) {
    return (
      <Screen>
        <Screen.TopBar title="Comparador" />
        <ErrorState onRetry={() => void index.refetch()} />
      </Screen>
    )
  }

  return (
    <Screen>
      <Screen.TopBar title="Comparador" />

      <Screen.Scroll contentClassName="gap-4">
        {selected.length < MAX_SELECTED ? (
          <View className="gap-2">
            <TextField>
              <Input
                placeholder="Adicionar parlamentar"
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
              />
            </TextField>

            {suggestions.map((parlamentar) => (
              <Chip
                key={parlamentarKey(parlamentar)}
                size="sm"
                variant="secondary"
                onPress={() => add(parlamentar)}
              >
                {`${parlamentar.nome} · ${parlamentar.partido}/${parlamentar.uf}`}
              </Chip>
            ))}
          </View>
        ) : null}

        {selected.length === 0 ? (
          <Card title={`Compare até ${MAX_SELECTED} parlamentares`}>
            <Text className="text-sm text-muted-foreground">
              Busque pelo nome para ver gastos e participação lado a lado, sempre
              com a mediana da casa como referência.
            </Text>
          </Card>
        ) : (
          <View className="flex-row gap-3">
            {selected.map((parlamentar) => (
              <ComparisonColumn
                key={parlamentarKey(parlamentar)}
                parlamentar={parlamentar}
                onRemove={() => remove(parlamentar)}
              />
            ))}
          </View>
        )}
      </Screen.Scroll>
    </Screen>
  )
}

type ComparisonColumnProps = {
  parlamentar: IndiceParlamentar
  onRemove: () => void
}

const ComparisonColumn = ({ parlamentar, onRemove }: ComparisonColumnProps) => {
  const { muted } = useColors()
  const { spendingColor, attendanceColor } = useMetricColors()
  const benchmark = useCasaBenchmark(parlamentar.casa).data

  const spending = benchmark?.gastos.geral ?? null
  const attendance = benchmark?.participacao.geral ?? null
  const yearSpending = parlamentar.gastoAno
  const percent = parlamentar.participacaoPercentual

  const spendingDeviation =
    spending && yearSpending !== null
      ? posicaoNaDistribuicao(yearSpending, spending)
      : null

  // Sem benchmark da casa não há referência para o semáforo: fica neutro.
  const attendanceTextColor =
    attendance && percent !== null ? attendanceColor(percent, attendance) : muted

  return (
    <Surface variant="secondary" className="flex-1 items-center gap-2 p-3">
      <Button size="sm" variant="ghost" isIconOnly onPress={onRemove}>
        <Icon name="close" size={16} color={muted} />
      </Button>

      <ParlamentarAvatar parlamentar={parlamentar} size={44} />

      <Text
        className="text-center text-sm font-semibold text-foreground"
        numberOfLines={2}
      >
        {parlamentar.nome}
      </Text>
      <Text className="text-center text-[11px] text-muted-foreground">
        {parlamentar.partido}/{parlamentar.uf}
      </Text>

      <MetricBlock label="Cota no ano">
        <Text className="text-sm font-semibold text-foreground">
          {yearSpending === null ? "—" : formatCurrencyCompact(yearSpending)}
        </Text>
        {spending && spendingDeviation !== null && yearSpending !== null ? (
          <Text
            className="text-[11px]"
            style={{ color: spendingColor(yearSpending, spending) }}
          >
            {formatMedianDeviation(spendingDeviation)}
          </Text>
        ) : null}
        {spending ? (
          <Text className="text-[11px] text-muted-foreground">
            mediana {formatCurrencyCompact(spending.mediana)}
          </Text>
        ) : null}
      </MetricBlock>

      <MetricBlock label="Participação">
        <Text
          className="text-sm font-semibold"
          style={{ color: attendanceTextColor }}
        >
          {percent === null ? "—" : formatPercent(percent, 0)}
        </Text>
        {attendance ? (
          <Text className="text-[11px] text-muted-foreground">
            mediana {formatPercent(attendance.mediana, 0)}
          </Text>
        ) : null}
      </MetricBlock>
    </Surface>
  )
}

const MetricBlock = ({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) => (
  <View className="w-full gap-1 border-t border-border pt-2">
    <Text className="text-[11px] text-muted-foreground">{label}</Text>
    {children}
  </View>
)
