import {
  agruparVotosPor,
  BLOCO_MINIMO,
  votouEmBloco,
  type GrupoDeVotos,
  type Voto,
} from "@politicapp/data"
import { Chip } from "heroui-native"
import { useMemo, useState } from "react"
import { Text, View } from "react-native"

import { Card } from "@/components/card"
import { useColors } from "@/hooks/use-colors"
import { formatNumber } from "@/utils/formatters"
import { getPartyColor } from "@/utils/party-colors"

/** Valores são os campos de agrupamento de `agruparVotosPor`. */
type Grouping = "partido" | "uf"

const GROUPING_LABEL: Record<Grouping, string> = {
  partido: "Por partido",
  uf: "Por estado",
}

const GROUPINGS = Object.keys(GROUPING_LABEL) as Grouping[]

const BLOC_THRESHOLD = Math.round(BLOCO_MINIMO * 100)

type Props = { votos: Voto[] }

/**
 * Mostra como cada bancada (partido ou UF) se posicionou numa votação.
 * A ideia é evidenciar que o voto no plenário é de bloco, não individual.
 */
export const VotesByGroup = ({ votos }: Props) => {
  const [grouping, setGrouping] = useState<Grouping>("partido")

  const groups = useMemo(
    () => agruparVotosPor(votos, grouping),
    [votos, grouping],
  )

  if (groups.length === 0) return null

  const byParty = grouping === "partido"
  const withDecisiveVote = groups.filter(
    (group) => group.placar.sim + group.placar.nao > 0,
  )
  const blocs = withDecisiveVote.filter(votouEmBloco)
  const withDissent = groups.filter((group) => group.dissidentes.length > 0)

  return (
    <Card
      title="Como cada bancada votou"
      description="Percentual sobre quem votou sim ou não"
    >
      <View className="flex-row gap-2">
        {GROUPINGS.map((option) => (
          <Chip
            key={option}
            size="sm"
            variant={grouping === option ? "primary" : "secondary"}
            onPress={() => setGrouping(option)}
          >
            {GROUPING_LABEL[option]}
          </Chip>
        ))}
      </View>

      <View className="gap-2">
        {groups.map((group) => (
          <GroupRow key={group.grupo} group={group} showPartyColor={byParty} />
        ))}
      </View>

      {byParty && withDecisiveVote.length > 1 ? (
        <Text className="text-xs text-muted-foreground">
          {blocs.length === 0
            ? `Nenhum partido fechou em bloco (${BLOC_THRESHOLD}% ou mais do mesmo lado).`
            : `${formatNumber(blocs.length)} de ${formatNumber(withDecisiveVote.length)} partidos fecharam em bloco (${BLOC_THRESHOLD}% ou mais do mesmo lado).`}
        </Text>
      ) : null}

      {byParty && withDissent.length > 0 ? (
        <View className="gap-1 border-t border-border pt-3">
          <Text className="text-xs font-semibold text-foreground">
            Votaram contra a maioria do próprio partido
          </Text>
          {withDissent.map((group) => (
            <Text
              key={group.grupo}
              className="text-xs text-muted-foreground"
              numberOfLines={3}
            >
              {group.grupo} ({group.dissidentes.length} de {group.total}):{" "}
              {group.dissidentes.map((voto) => voto.nome).join(", ")}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  )
}

type GroupRowProps = { group: GrupoDeVotos; showPartyColor: boolean }

const majorityLabel = ({ maioria, placar }: GrupoDeVotos) => {
  const decisive = placar.sim + placar.nao
  if (maioria) {
    const percent = Math.round((100 * placar[maioria]) / decisive)
    return `${percent}% ${maioria === "sim" ? "sim" : "não"}`
  }
  return decisive > 0 ? "dividido" : "sem posição"
}

const GroupRow = ({ group, showPartyColor }: GroupRowProps) => {
  const { successColor, dangerColor, muted } = useColors()
  const { placar } = group

  const slices = [
    { label: "Sim", value: placar.sim, color: successColor },
    { label: "Não", value: placar.nao, color: dangerColor },
    {
      label: "Abstenção ou ausência",
      value: placar.abstencao + placar.outros,
      color: muted,
    },
  ].filter((slice) => slice.value > 0)

  const summary = slices
    .map((slice) => `${slice.label} ${formatNumber(slice.value)}`)
    .join(", ")

  return (
    <View
      className="flex-row items-center gap-2"
      accessible
      accessibilityLabel={`${group.grupo}: ${summary}`}
    >
      {showPartyColor ? (
        <View
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: getPartyColor(group.grupo) }}
        />
      ) : null}
      <Text className="w-20 text-xs text-foreground" numberOfLines={1}>
        {group.grupo}
      </Text>
      <View className="h-2 flex-1 flex-row overflow-hidden rounded-full bg-surface">
        {slices.map((slice) => (
          <View
            key={slice.label}
            style={{ flex: slice.value, backgroundColor: slice.color }}
          />
        ))}
      </View>
      <Text className="w-16 text-right text-xs text-muted-foreground">
        {majorityLabel(group)}
      </Text>
    </View>
  )
}
