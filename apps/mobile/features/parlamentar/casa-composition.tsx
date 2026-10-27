import { type Casa, type IndiceParlamentar } from "@politicapp/data"
import { useRouter } from "expo-router"
import { Button } from "heroui-native"
import { useMemo } from "react"
import { View } from "react-native"

import { Card } from "@/components/card"
import { ChartLegend, Hemicycle, type SeatGroup } from "@/components/charts"
import { useColors } from "@/hooks/use-colors"
import { formatNumber } from "@/utils/formatters"
import { getPartyColor } from "@/utils/party-colors"
import { routes } from "@/utils/routes"

/** Partidos exibidos com cor própria; o resto vira "Outros" para não virar arco-íris. */
const MAX_PARTIES = 9

const TITLE: Record<Casa, string> = {
  camara: "Como se divide a Câmara",
  senado: "Como se divide o Senado",
}

type Props = { parlamentares: IndiceParlamentar[]; casa: Casa }

/** Hemicycle com a composição da casa: cada assento é um parlamentar em exercício. */
export const CasaCompositionCard = ({ parlamentares, casa }: Props) => {
  const router = useRouter()
  const { muted } = useColors()

  const groups = useMemo(() => {
    const counts = new Map<string, number>()
    for (const parlamentar of parlamentares) {
      if (parlamentar.casa !== casa) continue
      counts.set(parlamentar.partido, (counts.get(parlamentar.partido) ?? 0) + 1)
    }

    const bancadas = [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"),
    )

    const main: SeatGroup[] = bancadas
      .slice(0, MAX_PARTIES)
      .map(([party, count]) => ({
        key: party,
        count,
        color: getPartyColor(party),
      }))

    const rest = bancadas
      .slice(MAX_PARTIES)
      .reduce((sum, [, count]) => sum + count, 0)

    return rest > 0
      ? [...main, { key: "Outros", count: rest, color: muted }]
      : main
  }, [parlamentares, casa, muted])

  const total = groups.reduce((sum, group) => sum + group.count, 0)
  if (total === 0) return null

  const summary = groups
    .map((group) => `${group.key} ${formatNumber(group.count)}`)
    .join(", ")

  const largestBancada = Math.max(...groups.map((group) => group.count))
  const description =
    largestBancada <= total / 2
      ? `${formatNumber(total)} em exercício — nenhum partido decide sozinho`
      : `${formatNumber(total)} em exercício`

  return (
    <Card title={TITLE[casa]} description={description}>
      <Hemicycle
        groups={groups}
        accessibilityLabel={`Composição por partido: ${summary}`}
      />

      <ChartLegend
        items={groups.map((group) => ({
          label: `${group.key} (${formatNumber(group.count)})`,
          color: group.color,
        }))}
      />

      <View className="flex-row">
        <Button
          size="sm"
          variant="secondary"
          onPress={() => router.push(routes.panorama(casa))}
        >
          Como as bancadas votam juntas
        </Button>
      </View>
    </Card>
  )
}
