import { ESPECIE_NORMA_LABEL, type EventoNorma } from "@politicapp/data"
import { Chip } from "heroui-native"
import { Text } from "react-native"

import { Card } from "@/components/card"
import { formatDateShort } from "@/utils/date-utils"
import { openUrl } from "@/utils/links"

import { FeedCardHeader, FeedCardPressable } from "./feed-card-header"

type Props = { event: EventoNorma }

/** Ato do Executivo publicado no DOU — o toque abre a norma no in.gov.br. */
export const NormaCard = ({ event }: Props) => {
  const especie = ESPECIE_NORMA_LABEL[event.especie]

  return (
    <FeedCardPressable
      accessibilityLabel={`${especie}: ${event.titulo}. Abre o texto no Diário Oficial.`}
      onPress={() => openUrl(event.url)}
    >
      <Card>
        <FeedCardHeader
          source="Diário Oficial"
          date={formatDateShort(event.data)}
        >
          <Chip size="sm" color="accent">
            {especie}
          </Chip>
        </FeedCardHeader>

        <Text className="text-sm font-semibold text-foreground">
          {event.titulo}
        </Text>

        {event.ementa ? (
          <Text className="text-sm text-muted-foreground" numberOfLines={3}>
            {event.ementa}
          </Text>
        ) : null}
      </Card>
    </FeedCardPressable>
  )
}
