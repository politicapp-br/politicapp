import type { ReactNode } from "react"
import { Text, View } from "react-native"

import { cn } from "@/utils/cn"

type SectionProps = {
  title: string
  description?: string
  children?: ReactNode
  className?: string
}

export const Section = ({
  title,
  description,
  children,
  className,
}: SectionProps) => (
  <View className={cn("gap-3", className)}>
    <View className="gap-1">
      <Text className="text-lg font-semibold text-foreground">{title}</Text>
      {description ? (
        <Text className="text-xs text-muted-foreground">{description}</Text>
      ) : null}
    </View>
    {children}
  </View>
)
