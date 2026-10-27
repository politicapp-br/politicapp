import { CASA_EVENTO_LABEL, type EventoPauta } from "@politicapp/data"
import { Chip } from "heroui-native"
import { Text, View } from "react-native"

import { Card } from "@/components/card"
import { formatDateTime } from "@/utils/date-utils"

import { FeedCardHeader } from "./feed-card-header"

type Props = { event: EventoPauta }

const VISIBLE_ITEMS = 3

/** Sessão ou reunião marcada, com o que está na pauta. Sem navegação por ora. */
export const PautaCard = ({ event }: Props) => {
  const remaining = event.itens.length - VISIBLE_ITEMS

  return (
    <Card className="gap-2">
      <FeedCardHeader
        source={CASA_EVENTO_LABEL[event.casa]}
        date={formatDateTime(event.data)}
      >
        <Chip size="sm" variant="secondary">
          {event.plenario ? "Plenário" : event.orgao}
        </Chip>
      </FeedCardHeader>

      <Text className="text-sm font-medium text-foreground">
        {event.titulo}
      </Text>

      {event.orgaoNome ? (
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {event.orgaoNome}
        </Text>
      ) : null}

      {event.itens.length > 0 ? (
        <View className="gap-1">
          {event.itens.slice(0, VISIBLE_ITEMS).map((item) => (
            <Text
              key={item.sigla}
              className="text-xs text-muted-foreground"
              numberOfLines={2}
            >
              <Text className="font-medium text-foreground">{item.sigla}</Text>
              {item.ementa ? ` — ${item.ementa}` : ""}
            </Text>
          ))}
          {remaining > 0 ? (
            <Text className="text-xs text-muted-foreground">
              e mais {remaining} {remaining === 1 ? "item" : "itens"} na pauta
            </Text>
          ) : null}
        </View>
      ) : (
        <Text className="text-xs text-muted-foreground">
          Pauta ainda não publicada.
        </Text>
      )}
    </Card>
  )
}
