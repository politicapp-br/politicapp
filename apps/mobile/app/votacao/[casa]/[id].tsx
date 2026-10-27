import {
  casaSchema,
  VOTO_LABEL,
  type Casa,
  type TipoVoto,
  type Voto,
} from "@politicapp/data"
import { FlashList } from "@shopify/flash-list"
import { useLocalSearchParams } from "expo-router"
import { Chip } from "heroui-native"
import { useMemo, useState } from "react"
import { ScrollView, Text, View } from "react-native"

import { Card } from "@/components/card"
import { Screen } from "@/components/screen"
import { ErrorState, LoadingState } from "@/components/states"
import { VoteTally } from "@/components/vote-tally"
import { OrientacoesCard } from "@/features/votacao/orientacoes"
import { PlenaryMap } from "@/features/votacao/plenary-map"
import { VotesByGroup } from "@/features/votacao/votes-by-group"
import { useColors } from "@/hooks/use-colors"
import { useVotacao } from "@/hooks/use-votacoes"
import { formatDateLong } from "@/utils/date-utils"
import { getPartyColor } from "@/utils/party-colors"

type VoteFilter = TipoVoto | "todos"

const VOTE_FILTERS = ["todos", "sim", "nao", "abstencao", "ausente"] as const

export default function VotacaoScreen() {
  const params = useLocalSearchParams<{ casa: string; id: string }>()
  const casa = casaSchema.safeParse(params.casa)

  if (!casa.success || !params.id) {
    return (
      <Screen>
        <ErrorState title="Votação não encontrada" />
      </Screen>
    )
  }

  return (
    <Screen>
      <Screen.TopBar />
      <VotacaoContent casa={casa.data} id={params.id} />
    </Screen>
  )
}

type VotacaoContentProps = { casa: Casa; id: string }

const VotacaoContent = ({ casa, id }: VotacaoContentProps) => {
  const { data, isPending, isError, refetch } = useVotacao(casa, id)
  const [filter, setFilter] = useState<VoteFilter>("todos")

  const filteredVotes = useMemo(() => {
    if (!data) return []
    const sorted = [...data.votos].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR"),
    )
    return filter === "todos"
      ? sorted
      : sorted.filter((voto) => voto.voto === filter)
  }, [data, filter])

  if (isPending) return <LoadingState />
  if (isError || !data) {
    return <ErrorState onRetry={() => void refetch()} />
  }

  const hasVotes = data.votos.length > 0

  return (
    <FlashList
      data={filteredVotes}
      keyExtractor={(voto) => `${voto.casa}:${voto.id}`}
      contentContainerClassName="px-4 pb-10"
      ListHeaderComponent={
        <View className="gap-4 pb-4">
          <Text className="text-xs text-muted-foreground">
            {formatDateLong(data.data)}
          </Text>

          <Text className="font-title text-2xl text-foreground">
            {data.descricao}
          </Text>

          {data.resumo ? (
            <Text className="text-sm text-foreground-secondary">
              {data.resumo}
            </Text>
          ) : null}

          {data.proposicao ? (
            <Card
              title={`O que estava em votação · ${data.proposicao.sigla}`}
              className="gap-2"
            >
              {data.proposicao.ementa ? (
                <Text className="text-sm text-muted-foreground">
                  {data.proposicao.ementa}
                </Text>
              ) : null}
            </Card>
          ) : null}

          {data.aprovada === null ? null : (
            <View className="flex-row">
              <Chip size="sm" color={data.aprovada ? "success" : "danger"}>
                {data.aprovada ? "Aprovada" : "Rejeitada"}
              </Chip>
            </View>
          )}

          <Card>
            <VoteTally tally={data.placar} />
          </Card>

          {hasVotes ? <PlenaryMap votos={data.votos} /> : null}

          {hasVotes ? <VotesByGroup votos={data.votos} /> : null}

          <OrientacoesCard casa={casa} id={id} votos={data.votos} />

          {hasVotes ? (
            <VoteFilterChips selected={filter} onSelect={setFilter} />
          ) : null}
        </View>
      }
      renderItem={({ item }) => <VoteRow voto={item} />}
      ListEmptyComponent={
        <Text className="py-8 text-center text-sm text-muted-foreground">
          {hasVotes
            ? "Ninguém votou dessa forma."
            : "Esta votação não teve registro de votos individuais."}
        </Text>
      }
    />
  )
}

type VoteFilterChipsProps = {
  selected: VoteFilter
  onSelect: (filter: VoteFilter) => void
}

const VoteFilterChips = ({ selected, onSelect }: VoteFilterChipsProps) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerClassName="gap-2"
  >
    {VOTE_FILTERS.map((option) => (
      <Chip
        key={option}
        size="sm"
        variant={selected === option ? "primary" : "secondary"}
        onPress={() => onSelect(option)}
      >
        {option === "todos" ? "Todos" : VOTO_LABEL[option]}
      </Chip>
    ))}
  </ScrollView>
)

const VoteRow = ({ voto }: { voto: Voto }) => {
  const { successColor, dangerColor, muted } = useColors()

  const color =
    voto.voto === "sim"
      ? successColor
      : voto.voto === "nao"
        ? dangerColor
        : muted

  return (
    <View className="flex-row items-center gap-3 border-b border-border py-3">
      <View
        className="h-8 w-1 rounded-full"
        style={{ backgroundColor: getPartyColor(voto.partido) }}
      />
      <View className="flex-1">
        <Text className="text-sm text-foreground" numberOfLines={1}>
          {voto.nome}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {voto.partido} · {voto.uf}
        </Text>
      </View>
      <Text className="text-sm font-semibold" style={{ color }}>
        {VOTO_LABEL[voto.voto]}
      </Text>
    </View>
  )
}
