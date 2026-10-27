import type { ParlamentarRef } from "@politicapp/data"
import { Text, View } from "react-native"

import { Card } from "@/components/card"
import { useParlamentarFrentes } from "@/hooks/use-static-data"
import { formatNumber } from "@/utils/formatters"

import { ExpandableList } from "./expandable-list"

const INITIAL_COUNT = 5

type Props = { parlamentar: ParlamentarRef }

export const FrentesCard = ({ parlamentar }: Props) => {
  const { data } = useParlamentarFrentes(parlamentar)

  if (!data || data.length === 0) return null

  return (
    <Card
      title="Frentes parlamentares"
      description="Grupos suprapartidários em torno de uma causa"
      meta={formatNumber(data.length)}
      className="gap-1"
    >
      <ExpandableList
        items={data}
        initialCount={INITIAL_COUNT}
        keyExtractor={(frente) => String(frente.id)}
        renderItem={(frente) => (
          <View className="gap-1 py-3">
            <Text className="text-sm leading-5 text-foreground">
              {frente.titulo}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {frente.papel ? `${frente.papel} · ` : ""}
              {formatNumber(frente.totalMembros)} membros
            </Text>
          </View>
        )}
      />
    </Card>
  )
}
