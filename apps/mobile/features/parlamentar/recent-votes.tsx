import { VOTO_LABEL, type ParlamentarRef, type TipoVoto } from "@politicapp/data"
import { useRouter } from "expo-router"
import { Pressable, Text, View } from "react-native"

import { Card } from "@/components/card"
import { Icon } from "@/components/icon"
import { useColors } from "@/hooks/use-colors"
import { useParlamentarVotes, type VotacaoVote } from "@/hooks/use-votacoes"
import { formatDate } from "@/utils/date-utils"
import { routes } from "@/utils/routes"

import { ExpandableList } from "./expandable-list"

const INITIAL_COUNT = 5

type Props = { parlamentar: ParlamentarRef }

export const RecentVotesCard = ({ parlamentar }: Props) => {
  const { data } = useParlamentarVotes(parlamentar)

  if (!data || data.length === 0) return null

  return (
    <Card
      title="Como votou"
      meta={`${data.length} votações recentes`}
      description="Toque numa votação para ver o placar, os votos de todos e as orientações das bancadas."
      className="gap-1"
    >
      <ExpandableList
        items={data}
        initialCount={INITIAL_COUNT}
        keyExtractor={(item) => `${item.votacao.casa}:${item.votacao.id}`}
        renderItem={(item) => <VotacaoRow item={item} />}
      />
    </Card>
  )
}

type VotacaoRowProps = { item: VotacaoVote }

const VotacaoRow = ({ item }: VotacaoRowProps) => {
  const router = useRouter()
  const { successColor, dangerColor, muted } = useColors()
  const { votacao, voto } = item

  const votoColors: Partial<Record<TipoVoto, string>> = {
    sim: successColor,
    nao: dangerColor,
  }

  return (
    <Pressable onPress={() => router.push(routes.votacao(votacao.casa, votacao.id))}>
      <View className="flex-row items-center gap-3 py-3">
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            {votacao.proposicao ? (
              <Text className="text-xs font-semibold text-brand">
                {votacao.proposicao.sigla}
              </Text>
            ) : null}
            <Text className="text-xs text-muted-foreground">
              {formatDate(votacao.data)}
            </Text>
            {votacao.aprovada === null ? null : (
              <Text
                className="text-xs"
                style={{ color: votacao.aprovada ? successColor : dangerColor }}
              >
                {votacao.aprovada ? "Aprovada" : "Rejeitada"}
              </Text>
            )}
          </View>

          <Text className="text-sm leading-5 text-foreground" numberOfLines={2}>
            {votacao.descricao}
          </Text>
        </View>

        <Text
          className="text-sm font-semibold"
          style={{ color: votoColors[voto] ?? muted }}
        >
          {VOTO_LABEL[voto]}
        </Text>

        <Icon name="chevron-forward" size={16} color={muted} />
      </View>
    </Pressable>
  )
}
