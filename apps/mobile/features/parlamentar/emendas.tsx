import {
  nomeDaUf,
  FONTE_EMENDAS,
  type EmendaPorLocal,
  type ParlamentarRef,
} from "@politicapp/data"
import { Chip } from "heroui-native"
import { useState, type ReactNode } from "react"
import { ScrollView, Text, View } from "react-native"

import { Card } from "@/components/card"
import { DetailRow } from "@/components/detail-row"
import { SourceLink } from "@/components/source-link"
import { useParlamentarEmendas } from "@/hooks/use-static-data"
import { formatCurrency, formatCurrencyCompact } from "@/utils/formatters"
import { toProperCase } from "@/utils/text"

type Props = { parlamentar: ParlamentarRef }

export const EmendasCard = ({ parlamentar }: Props) => {
  const { data } = useParlamentarEmendas(parlamentar)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  if (!data || data.length === 0) return null

  const summary = data.find((item) => item.ano === selectedYear) ?? data[0]
  if (!summary) return null

  return (
    <Card
      title="Emendas ao Orçamento"
      description="Recursos federais que o parlamentar destinou por emenda"
      className="gap-4"
    >
      {data.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2"
        >
          {data.map((item) => (
            <Chip
              key={item.ano}
              size="sm"
              variant={item.ano === summary.ano ? "primary" : "secondary"}
              onPress={() => setSelectedYear(item.ano)}
            >
              {String(item.ano)}
            </Chip>
          ))}
        </ScrollView>
      ) : null}

      <Card.Highlight
        value={formatCurrency(summary.empenhado)}
        context={`empenhado em emendas de ${summary.ano}`}
      />

      <View className="gap-2">
        <DetailRow
          label="Efetivamente pago"
          value={formatCurrency(summary.pago)}
        />
      </View>

      {summary.porArea.length > 0 ? (
        <BreakdownGroup title="Para quais áreas">
          {summary.porArea.map((item) => (
            <DetailRow
              key={item.area}
              label={item.area}
              value={formatCurrencyCompact(item.valor)}
            />
          ))}
        </BreakdownGroup>
      ) : null}

      {summary.porLocal.length > 0 ? (
        <BreakdownGroup title="Para onde foi o dinheiro">
          {summary.porLocal.map((item) => (
            <DetailRow
              key={`${item.municipio ?? ""}|${item.uf ?? ""}`}
              label={formatPlace(item)}
              value={formatCurrencyCompact(item.valor)}
            />
          ))}
        </BreakdownGroup>
      ) : null}

      <Text className="text-xs text-muted-foreground">
        Empenho é a reserva do dinheiro no Orçamento; o pagamento pode
        acontecer em anos seguintes.
      </Text>

      <SourceLink label="Portal da Transparência" url={FONTE_EMENDAS} />
    </Card>
  )
}

type BreakdownGroupProps = { title: string; children: ReactNode }

const BreakdownGroup = ({ title, children }: BreakdownGroupProps) => (
  <View className="gap-2">
    <Text className="text-sm font-semibold text-foreground">{title}</Text>
    {children}
  </View>
)

const formatPlace = (place: Pick<EmendaPorLocal, "municipio" | "uf">) => {
  if (!place.municipio) return place.uf ? nomeDaUf(place.uf) : "—"
  const city = toProperCase(place.municipio)
  return place.uf ? `${city} (${place.uf})` : city
}
