import { CASA_LABEL, type Votacao } from "@politicapp/data"
import { useRouter } from "expo-router"
import { Chip } from "heroui-native"
import { Text } from "react-native"

import { Card } from "@/components/card"
import { VoteTally } from "@/components/vote-tally"
import { formatDateShort } from "@/utils/date-utils"
import { routes } from "@/utils/routes"

import { FeedCardHeader, FeedCardPressable } from "./feed-card-header"

type Props = {
  votacao: Votacao
  /**
   * Simbólica não tem voto individual: sem placar e sem tela de detalhe
   * (a tela lista os votos, que não existem).
   */
  nominal?: boolean
}

export const VotacaoCard = ({ votacao, nominal = true }: Props) => {
  const router = useRouter()

  return (
    <FeedCardPressable
      onPress={
        nominal
          ? () => router.push(routes.votacao(votacao.casa, votacao.id))
          : undefined
      }
    >
      <Card>
        <FeedCardHeader
          source={CASA_LABEL[votacao.casa]}
          date={formatDateShort(votacao.data)}
        >
          {votacao.aprovada === null ? null : (
            <Chip size="sm" color={votacao.aprovada ? "success" : "danger"}>
              {votacao.aprovada ? "Aprovada" : "Rejeitada"}
            </Chip>
          )}
        </FeedCardHeader>

        {votacao.proposicao ? (
          <Text className="text-xs font-medium text-foreground">
            {votacao.proposicao.sigla}
          </Text>
        ) : null}

        <Text className="text-sm text-foreground" numberOfLines={3}>
          {votacao.descricao}
        </Text>

        {nominal ? (
          <VoteTally tally={votacao.placar} compact />
        ) : (
          <Text className="text-xs text-muted-foreground">
            Votação simbólica — sem registro de voto individual.
          </Text>
        )}
      </Card>
    </FeedCardPressable>
  )
}
