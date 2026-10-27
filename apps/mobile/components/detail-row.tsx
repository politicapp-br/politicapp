import { Text, View } from "react-native"

import { cn } from "@/utils/cn"

type Props = {
  label: string
  value: string | null | undefined
  emphasized?: boolean
}

export const DetailRow = ({ label, value, emphasized }: Props) => {
  if (!value) return null

  return (
    <View className="flex-row items-baseline justify-between gap-4">
      <Text className="shrink-0 text-sm text-muted-foreground">{label}</Text>
      <Text
        className={cn(
          "flex-1 text-right text-sm text-foreground",
          emphasized && "font-semibold",
        )}
      >
        {value}
      </Text>
    </View>
  )
}
