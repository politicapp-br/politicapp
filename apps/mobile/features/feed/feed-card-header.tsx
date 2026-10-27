import type { ReactNode } from "react"
import { Pressable, Text, View } from "react-native"

type HeaderProps = {
  /** Origem do evento (casa, "Tramitação", "Diário Oficial"…). */
  source: string
  /** Data já formatada. */
  date: string
  /** Selo à direita, normalmente um `Chip`. */
  children?: ReactNode
}

/** Cabeçalho comum dos cartões do feed: "<origem> · <data>" + selo à direita. */
export const FeedCardHeader = ({ source, date, children }: HeaderProps) => (
  <View className="flex-row items-center justify-between gap-2">
    <Text className="shrink text-xs text-muted-foreground">
      {source} · {date}
    </Text>
    {children}
  </View>
)

type PressableProps = {
  /** Sem `onPress` o cartão não tem para onde levar e é renderizado sem toque. */
  onPress?: () => void
  accessibilityLabel?: string
  children: ReactNode
}

/** Envolve o cartão num `Pressable` só quando há destino para o toque. */
export const FeedCardPressable = ({
  onPress,
  accessibilityLabel,
  children,
}: PressableProps) =>
  onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
    >
      {children}
    </Pressable>
  ) : (
    children
  )
