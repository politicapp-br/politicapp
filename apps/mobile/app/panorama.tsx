import {
  casaSchema,
  type AgregadosDaCasa,
  type Casa,
  type CoesaoDeBancada,
} from "@politicapp/data"
import { useLocalSearchParams } from "expo-router"
import { Chip } from "heroui-native"
import { useMemo, useState } from "react"
import { Text, View } from "react-native"

import { Card } from "@/components/card"
import { ProgressBar } from "@/components/charts"
import { LoadingState, ErrorState, EmptyState } from "@/components/states"
import { Screen } from "@/components/screen"
import { useCasaAggregates } from "@/hooks/use-static-data"
import { useColors } from "@/hooks/use-colors"
import { formatNumber } from "@/utils/formatters"
import { getPartyColor } from "@/utils/party-colors"

const CASA_CHIPS: { value: Casa; label: string }[] = [
  { value: "camara", label: "Câmara" },
  { value: "senado", label: "Senado" },
]

/** Bancadas minúsculas ou quase sem votações viram ruído estatístico. */
const MIN_PARLAMENTARES = 3
const MIN_VOTACOES = 5

/** Tamanho da matriz de concordância — mais que isso não cabe na tela. */
const MATRIX_BANCADAS = 7

export default function PanoramaScreen() {
  const params = useLocalSearchParams<{ casa?: string }>()
  const initialCasa = casaSchema.safeParse(params.casa)
  const [casa, setCasa] = useState<Casa>(
    initialCasa.success ? initialCasa.data : "camara",
  )

  return (
    <Screen>
      <Screen.TopBar title="Panorama das bancadas" />

      <View className="flex-row gap-2 px-4 pb-3">
        {CASA_CHIPS.map(({ value, label }) => (
          <Chip
            key={value}
            size="sm"
            variant={casa === value ? "primary" : "secondary"}
            onPress={() => setCasa(value)}
          >
            {label}
          </Chip>
        ))}
      </View>

      <PanoramaContent casa={casa} />
    </Screen>
  )
}

const PanoramaContent = ({ casa }: { casa: Casa }) => {
  const { data, year, isPending, isError, refetch } = useCasaAggregates(casa)

  if (isPending) return <LoadingState label="Calculando o panorama…" />
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />
  }
  if (!data) {
    return (
      <EmptyState
        icon="stats-chart-outline"
        title="Sem dados para esta casa"
        description="Ainda não há votações nominais suficientes no período para montar o panorama."
      />
    )
  }

  return (
    <Screen.Scroll contentClassName="gap-4">
      <BancadaCohesion aggregates={data} />
      <AgreementMatrix aggregates={data} />
      <GovernmentAlignment aggregates={data} />
      <Text className="text-xs text-muted-foreground">
        Baseado em {formatNumber(data.votacoesConsideradas)} votações nominais
        {year ? ` de ${year}` : ""}. A posição de uma bancada em cada votação é a
        maioria entre os votos sim/não dos seus parlamentares.
      </Text>
    </Screen.Scroll>
  )
}

type AggregatesProps = { aggregates: AgregadosDaCasa }

const relevantBancadas = (aggregates: AgregadosDaCasa): CoesaoDeBancada[] =>
  aggregates.bancadas.filter(
    (bancada) =>
      bancada.parlamentares >= MIN_PARLAMENTARES &&
      bancada.votacoes >= MIN_VOTACOES &&
      bancada.coesao !== null,
  )

type PartyBarProps = {
  party: string
  percent: number
  accessibilityLabel: string
}

/** Linha "bolinha do partido · sigla · barra · %" usada nos rankings. */
const PartyBar = ({ party, percent, accessibilityLabel }: PartyBarProps) => {
  const { brandColor } = useColors()

  return (
    <View
      className="flex-row items-center gap-2"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
    >
      <View
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: getPartyColor(party) }}
      />
      <Text className="w-20 text-xs text-foreground" numberOfLines={1}>
        {party}
      </Text>
      <ProgressBar className="flex-1" value={percent} color={brandColor} />
      <Text className="w-10 text-right text-xs text-muted-foreground">
        {percent}%
      </Text>
    </View>
  )
}

const BancadaCohesion = ({ aggregates }: AggregatesProps) => {
  const bancadas = useMemo(
    () =>
      [...relevantBancadas(aggregates)].sort(
        (a, b) => (b.coesao ?? 0) - (a.coesao ?? 0),
      ),
    [aggregates],
  )

  if (bancadas.length === 0) return null

  return (
    <Card
      title="Coesão das bancadas"
      description="Quanto do partido vota junto com a própria maioria"
    >
      <View className="gap-2">
        {bancadas.map((bancada) => {
          const percent = Math.round((bancada.coesao ?? 0) * 100)
          return (
            <PartyBar
              key={bancada.partido}
              party={bancada.partido}
              percent={percent}
              accessibilityLabel={`${bancada.partido}: ${percent}% de coesão em ${formatNumber(bancada.votacoes)} votações`}
            />
          )
        })}
      </View>
      <Text className="text-xs text-muted-foreground">
        Bancadas com pelo menos {MIN_PARLAMENTARES} parlamentares e{" "}
        {MIN_VOTACOES} votações com posição definida.
      </Text>
    </Card>
  )
}

const GovernmentAlignment = ({ aggregates }: AggregatesProps) => {
  const bancadas = useMemo(
    () =>
      relevantBancadas(aggregates)
        .flatMap((bancada) =>
          bancada.governo && bancada.governo.votacoes >= MIN_VOTACOES
            ? [{ ...bancada, governo: bancada.governo }]
            : [],
        )
        .sort(
          (a, b) =>
            b.governo.comGoverno / b.governo.votacoes -
            a.governo.comGoverno / a.governo.votacoes,
        ),
    [aggregates],
  )

  if (bancadas.length === 0) return null

  return (
    <Card
      title="Alinhamento com o governo"
      description="Quantas vezes a maioria da bancada votou como a liderança do governo orientou"
    >
      <View className="gap-2">
        {bancadas.map((bancada) => {
          const percent = Math.round(
            (100 * bancada.governo.comGoverno) / bancada.governo.votacoes,
          )
          return (
            <PartyBar
              key={bancada.partido}
              party={bancada.partido}
              percent={percent}
              accessibilityLabel={`${bancada.partido}: votou com o governo em ${percent}% de ${formatNumber(bancada.governo.votacoes)} votações orientadas`}
            />
          )
        })}
      </View>
      <Text className="text-xs text-muted-foreground">
        "Governo" aqui é a liderança formal do governo na casa, que orienta a
        base antes de cada votação — não é rótulo do app.
      </Text>
    </Card>
  )
}

const AgreementMatrix = ({ aggregates }: AggregatesProps) => {
  const { brandColor, brandForeground, foreground } = useColors()

  const { parties, agreementOf } = useMemo(() => {
    const largest = relevantBancadas(aggregates)
      .slice()
      .sort((a, b) => b.parlamentares - a.parlamentares)
      .slice(0, MATRIX_BANCADAS)
      .map((bancada) => bancada.partido)

    const byPair = new Map(
      aggregates.concordancias.map((pair) => [
        `${pair.partidoA}\n${pair.partidoB}`,
        pair,
      ]),
    )
    const lookup = (a: string, b: string) =>
      byPair.get(`${a}\n${b}`) ?? byPair.get(`${b}\n${a}`)

    return { parties: largest, agreementOf: lookup }
  }, [aggregates])

  if (parties.length < 2) return null

  return (
    <Card
      title="Quem vota junto com quem"
      description="Percentual de votações em que as duas bancadas ficaram do mesmo lado"
    >
      <View className="gap-1">
        <View className="flex-row gap-1">
          <View className="w-12" />
          {parties.map((party) => (
            <Text
              key={party}
              className="flex-1 text-center text-xs text-muted-foreground"
              numberOfLines={1}
            >
              {party}
            </Text>
          ))}
        </View>

        {parties.map((row) => (
          <View key={row} className="flex-row items-center gap-1">
            <Text
              className="w-12 text-xs text-muted-foreground"
              numberOfLines={1}
            >
              {row}
            </Text>
            {parties.map((column) => {
              if (row === column) {
                return (
                  <View
                    key={column}
                    className="flex-1 items-center justify-center rounded bg-surface py-1.5"
                  >
                    <Text className="text-xs text-muted-foreground">—</Text>
                  </View>
                )
              }

              const fraction = agreementOf(row, column)?.concordancia ?? null
              if (fraction === null) {
                return <View key={column} className="flex-1 rounded py-1.5" />
              }

              const alpha = Math.round((0.12 + fraction * 0.88) * 255)
                .toString(16)
                .padStart(2, "0")
              return (
                <View
                  key={column}
                  className="flex-1 items-center justify-center rounded py-1.5"
                  style={{ backgroundColor: `${brandColor}${alpha}` }}
                  accessible
                  accessibilityLabel={`${row} e ${column}: mesmo lado em ${Math.round(fraction * 100)}% das votações`}
                >
                  <Text
                    className="text-xs"
                    style={{
                      // Acima de 0,7 o alpha (~0,73) garante contraste ≥ 4,5:1
                      // para o brandForeground nos dois temas.
                      color: fraction > 0.7 ? brandForeground : foreground,
                    }}
                  >
                    {Math.round(fraction * 100)}
                  </Text>
                </View>
              )
            })}
          </View>
        ))}
      </View>
      <Text className="text-xs text-muted-foreground">
        Azul mais forte = votam mais parecido. Os blocos aparecem sozinhos: não
        é o app quem diz quem é aliado de quem.
      </Text>
    </Card>
  )
}
