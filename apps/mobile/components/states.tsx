import { Button, Spinner } from "heroui-native"
import { Text, View } from "react-native"

import { Icon, type IconName } from "@/components/icon"
import { useColors } from "@/hooks/use-colors"

export const LoadingState = ({ label }: { label?: string }) => (
  <View className="flex-1 items-center justify-center gap-3 p-8">
    <Spinner />
    {label ? (
      <Text className="text-sm text-muted-foreground">{label}</Text>
    ) : null}
  </View>
)

type EmptyStateProps = {
  icon?: IconName
  title: string
  description?: string
  action?: { label: string; onPress: () => void }
}

export const EmptyState = ({
  icon = "document-text-outline",
  title,
  description,
  action,
}: EmptyStateProps) => {
  const { muted } = useColors()

  return (
    <View className="items-center justify-center gap-3 px-8 py-12">
      <Icon name={icon} size={32} color={muted} />
      <Text className="text-center text-base font-semibold text-foreground">
        {title}
      </Text>
      {description ? (
        <Text className="text-center text-sm text-muted-foreground">
          {description}
        </Text>
      ) : null}
      {action ? (
        <Button size="sm" variant="secondary" onPress={action.onPress}>
          {action.label}
        </Button>
      ) : null}
    </View>
  )
}

type ErrorStateProps = {
  title?: string
  description?: string
  onRetry?: () => void
}

export const ErrorState = ({
  title = "Não foi possível carregar",
  description = "Os dados vêm de APIs públicas do governo, que às vezes ficam fora do ar.",
  onRetry,
}: ErrorStateProps) => {
  const { dangerColor } = useColors()

  return (
    <View className="items-center justify-center gap-3 px-8 py-12">
      <Icon name="cloud-offline-outline" size={32} color={dangerColor} />
      <Text className="text-center text-base font-semibold text-foreground">
        {title}
      </Text>
      <Text className="text-center text-sm text-muted-foreground">
        {description}
      </Text>
      {onRetry ? (
        <Button size="sm" variant="secondary" onPress={onRetry}>
          Tentar novamente
        </Button>
      ) : null}
    </View>
  )
}
