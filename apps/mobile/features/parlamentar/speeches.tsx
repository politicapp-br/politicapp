import type { Discurso, ParlamentarRef } from "@politicapp/data"
import { Pressable, Text, View } from "react-native"

import { Card } from "@/components/card"
import { Icon } from "@/components/icon"
import { useColors } from "@/hooks/use-colors"
import { useParlamentarSpeeches } from "@/hooks/use-parlamentar"
import { formatDate } from "@/utils/date-utils"
import { openUrl } from "@/utils/links"
import { toProperCase } from "@/utils/text"

import { ExpandableList } from "./expandable-list"

const INITIAL_COUNT = 3

type Props = { parlamentar: ParlamentarRef }

export const SpeechesCard = ({ parlamentar }: Props) => {
  const { data } = useParlamentarSpeeches(parlamentar)

  if (!data || data.length === 0) return null

  return (
    <Card title="Discursos recentes" meta="últimos 6 meses" className="gap-1">
      <ExpandableList
        items={data}
        initialCount={INITIAL_COUNT}
        keyExtractor={(speech, index) => `${speech.data}:${index}`}
        renderItem={(speech) => <SpeechRow speech={speech} />}
      />
    </Card>
  )
}

type SpeechRowProps = { speech: Discurso }

const SpeechRow = ({ speech }: SpeechRowProps) => {
  const { muted } = useColors()

  const content = (
    <View className="flex-row items-center gap-3 py-3">
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-xs font-semibold text-brand">
            {formatDate(speech.data)}
          </Text>
          {speech.tipo ? (
            <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
              {toProperCase(speech.tipo)}
            </Text>
          ) : null}
        </View>

        {speech.resumo ? (
          <Text className="text-sm leading-5 text-foreground" numberOfLines={5}>
            {speech.resumo}
          </Text>
        ) : null}
      </View>

      {speech.urlTexto ? (
        <Icon name="open-outline" size={16} color={muted} />
      ) : null}
    </View>
  )

  if (!speech.urlTexto) return content
  const url = speech.urlTexto

  return (
    <Pressable accessibilityRole="link" onPress={() => openUrl(url)}>
      {content}
    </Pressable>
  )
}
