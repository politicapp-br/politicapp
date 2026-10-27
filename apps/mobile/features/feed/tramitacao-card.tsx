import {
  MARCO_LABEL,
  type EventoTramitacao,
  type MarcoTramitacao,
} from "@politicapp/data"
import { useRouter } from "expo-router"
import { Chip } from "heroui-native"
import { Text } from "react-native"

import { Card } from "@/components/card"
import { formatDateShort } from "@/utils/date-utils"
import { routes } from "@/utils/routes"

import { FeedCardHeader, FeedCardPressable } from "./feed-card-header"

type Props = { event: EventoTramitacao }

/** Verde para o que avançou, vermelho para veto — mesmo código do placar. */
const MARCO_COLOR: Record<MarcoTramitacao, "success" | "danger"> = {
  aprovada_na_camara: "success",
  enviada_a_sancao: "success",
  aguardando_promulgacao: "success",
  transformada_em_lei: "success",
  vetada: "danger",
}

export const TramitacaoCard = ({ event }: Props) => {
  const router = useRouter()
  const { proposicao } = event
  const proposicaoId = proposicao.id

  return (
    <FeedCardPressable
      accessibilityLabel={`${MARCO_LABEL[event.marco]}: ${proposicao.sigla}`}
      onPress={
        proposicaoId
          ? () => router.push(routes.proposicao("camara", proposicaoId))
          : undefined
      }
    >
      <Card>
        <FeedCardHeader source="Tramitação" date={formatDateShort(event.data)}>
          <Chip size="sm" color={MARCO_COLOR[event.marco]}>
            {MARCO_LABEL[event.marco]}
          </Chip>
        </FeedCardHeader>

        <Text className="text-sm font-semibold text-foreground">
          {proposicao.sigla}
        </Text>

        {proposicao.ementa ? (
          <Text className="text-sm text-muted-foreground" numberOfLines={3}>
            {proposicao.ementa}
          </Text>
        ) : null}
      </Card>
    </FeedCardPressable>
  )
}
