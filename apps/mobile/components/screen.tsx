import { useRouter } from "expo-router"
import { Button } from "heroui-native"
import type { ReactNode } from "react"
import { ScrollView, Text, View, type ScrollViewProps } from "react-native"
import { useSafeAreaInsets, type Edge } from "react-native-safe-area-context"

import { Icon } from "@/components/icon"
import { SafeAreaView } from "@/components/safe-area-view"
import { useColors } from "@/hooks/use-colors"
import { cn } from "@/utils/cn"

type ScreenProps = {
  children: ReactNode
  edges?: Edge[]
  className?: string
}

const ScreenRoot = ({ children, edges = ["top"], className }: ScreenProps) => (
  <SafeAreaView className={cn("flex-1 bg-background", className)} edges={edges}>
    {children}
  </SafeAreaView>
)

type TopBarProps = {
  title?: string
  showBack?: boolean
  trailing?: ReactNode
}

const TopBar = ({ title, showBack = true, trailing }: TopBarProps) => {
  const router = useRouter()
  const { foreground } = useColors()

  return (
    <View className="flex-row items-center gap-2 px-4 py-2">
      {showBack ? (
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
        >
          <Icon name="chevron-back" size={22} color={foreground} />
        </Button>
      ) : null}
      <View className="flex-1">
        {title ? (
          <Text
            className="font-title text-xl text-foreground"
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  )
}

type ScrollProps = ScrollViewProps & {
  contentClassName?: string
}

const Scroll = ({ children, contentClassName, ...props }: ScrollProps) => {
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      contentContainerClassName={cn("gap-6 px-4", contentClassName)}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      {...props}
    >
      {children}
    </ScrollView>
  )
}

export const Screen = Object.assign(ScreenRoot, { TopBar, Scroll })
