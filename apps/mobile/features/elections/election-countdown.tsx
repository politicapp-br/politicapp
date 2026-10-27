import { differenceInCalendarDays } from "date-fns"
import { Surface } from "heroui-native"
import { Text, View } from "react-native"

import { formatDateLong } from "@/utils/date-utils"

const FIRST_ROUND = new Date(2026, 9, 4)

export const ElectionCountdown = () => {
  const days = differenceInCalendarDays(FIRST_ROUND, new Date())

  if (days < 0) return null

  return (
    <Surface variant="secondary" className="flex-row items-center gap-4 p-4">
      <View className="items-center">
        <Text className="font-title text-3xl text-brand">{days}</Text>
        <Text className="text-[10px] uppercase text-muted-foreground">
          {days === 1 ? "dia" : "dias"}
        </Text>
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-semibold text-foreground">
          1º turno em {formatDateLong(FIRST_ROUND)}
        </Text>
        <Text className="text-xs text-muted-foreground">
          Antes de votar, veja como quem tenta a reeleição votou nos últimos
          quatro anos.
        </Text>
      </View>
    </Surface>
  )
}
