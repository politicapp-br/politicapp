import {
  identificadorProposicao,
  tipoDaProposicao,
  type ParlamentarRef,
  type Proposicao,
} from "@politicapp/data"
import { useRouter } from "expo-router"
import { Pressable, Text, View } from "react-native"

import { Card } from "@/components/card"
import { Icon } from "@/components/icon"
import { useColors } from "@/hooks/use-colors"
import { useParlamentarProposicoes } from "@/hooks/use-parlamentar"
import { formatDate } from "@/utils/date-utils"
import { routes } from "@/utils/routes"

import { ExpandableList } from "./expandable-list"

const INITIAL_COUNT = 5

type Props = { parlamentar: ParlamentarRef }

export const ProposicoesCard = ({ parlamentar }: Props) => {
  const { data } = useParlamentarProposicoes(parlamentar)

  if (!data || data.length === 0) return null

  return (
    <Card
      title="Projetos apresentados"
      meta={`${data.length} mais recentes`}
      className="gap-1"
    >
      <ExpandableList
        items={data}
        initialCount={INITIAL_COUNT}
        keyExtractor={(proposicao) => proposicao.id}
        renderItem={(proposicao) => <ProposicaoRow proposicao={proposicao} />}
      />
    </Card>
  )
}

type ProposicaoRowProps = { proposicao: Proposicao }

const ProposicaoRow = ({ proposicao }: ProposicaoRowProps) => {
  const router = useRouter()
  const { muted } = useColors()
  const tipo = tipoDaProposicao(proposicao)

  return (
    <Pressable
      onPress={() => router.push(routes.proposicao(proposicao.casa, proposicao.id))}
    >
      <View className="flex-row items-center gap-3 py-3">
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-xs font-semibold text-brand">
              {identificadorProposicao(proposicao)}
            </Text>
            {proposicao.apresentadaEm ? (
              <Text className="text-xs text-muted-foreground">
                {formatDate(proposicao.apresentadaEm)}
              </Text>
            ) : null}
          </View>

          {tipo ? (
            <Text className="text-xs text-muted-foreground">{tipo}</Text>
          ) : null}

          <Text className="text-sm leading-5 text-foreground" numberOfLines={4}>
            {proposicao.ementa}
          </Text>
        </View>

        <Icon name="chevron-forward" size={16} color={muted} />
      </View>
    </Pressable>
  )
}
