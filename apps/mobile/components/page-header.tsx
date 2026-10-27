import { Text, View } from "react-native"

import { cn } from "@/utils/cn"

type Props = {
  title: string
  subtitle?: string
  className?: string
}

export const PageHeader = ({ title, subtitle, className }: Props) => (
  <View className={cn("gap-1 px-4 pb-4 pt-2", className)}>
    <Text className="font-title text-3xl text-foreground">{title}</Text>
    {subtitle ? (
      <Text className="text-sm text-muted-foreground">{subtitle}</Text>
    ) : null}
  </View>
)
