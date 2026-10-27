import { Surface } from "heroui-native"
import type { ReactNode } from "react"
import { Text, View } from "react-native"

import { cn } from "@/utils/cn"

type CardProps = {
  title?: string
  description?: string
  meta?: string
  /** Controle no canto do cabeçalho (ex.: botão de repetir animação). */
  action?: ReactNode
  children?: ReactNode
  className?: string
}

const CardRoot = ({
  title,
  description,
  meta,
  action,
  children,
  className,
}: CardProps) => (
  <Surface variant="secondary" className={cn("gap-3 p-4", className)}>
    {title ? (
      <View className="gap-0.5">
        <View
          className={cn(
            "flex-row justify-between gap-4",
            action ? "items-center" : "items-baseline",
          )}
        >
          <Text className="flex-1 text-base font-semibold text-foreground">
            {title}
          </Text>
          {meta ? (
            <Text className="text-xs text-muted-foreground">{meta}</Text>
          ) : null}
          {action}
        </View>
        {description ? (
          <Text className="text-xs text-muted-foreground">{description}</Text>
        ) : null}
      </View>
    ) : null}
    {children}
  </Surface>
)

type HighlightProps = {
  value: string
  context?: string
  color?: string
}

const Highlight = ({ value, context, color }: HighlightProps) => (
  <View className="gap-0.5">
    <Text
      className="font-title text-3xl text-foreground"
      style={[{ fontVariant: ["tabular-nums"] }, color ? { color } : null]}
      maxFontSizeMultiplier={1.5}
    >
      {value}
    </Text>
    {context ? (
      <Text className="text-sm text-muted-foreground">{context}</Text>
    ) : null}
  </View>
)

export const Card = Object.assign(CardRoot, { Highlight })
