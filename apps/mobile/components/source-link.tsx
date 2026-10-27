import { Pressable, Text } from "react-native"

import { Icon } from "@/components/icon"
import { useColors } from "@/hooks/use-colors"
import { cn } from "@/utils/cn"
import { openUrl } from "@/utils/links"

type Props = {
  label: string
  url: string
  className?: string
}

export const SourceLink = ({ label, url, className }: Props) => {
  const { muted } = useColors()

  return (
    <Pressable
      className={cn("flex-row items-center gap-1.5 self-start", className)}
      accessibilityRole="link"
      hitSlop={8}
      onPress={() => openUrl(url)}
    >
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Icon name="open-outline" size={12} color={muted} />
    </Pressable>
  )
}
