import type { IndiceParlamentar } from "@politicapp/data"
import { CARGO_LABEL } from "@politicapp/data"
import { Surface } from "heroui-native"
import { Pressable, Text, View } from "react-native"

import { Icon } from "@/components/icon"
import { ParlamentarAvatar } from "@/components/parlamentar-avatar"
import { useColors } from "@/hooks/use-colors"
import { formatCurrencyCompact, formatPercent } from "@/utils/formatters"

type Props = {
  parlamentar: IndiceParlamentar
  onPress: () => void
  showRole?: boolean
}

export const ParlamentarCard = ({
  parlamentar,
  onPress,
  showRole = false,
}: Props) => {
  const { muted } = useColors()

  return (
    <Pressable onPress={onPress}>
      <Surface variant="secondary" className="flex-row items-center gap-3 p-3">
        <ParlamentarAvatar parlamentar={parlamentar} size={48} />

        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
            {parlamentar.nome}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {showRole ? `${CARGO_LABEL[parlamentar.casa]} · ` : ""}
            {parlamentar.partido} · {parlamentar.uf}
          </Text>
          <View className="mt-1 flex-row gap-3">
            {parlamentar.gastoAno !== null ? (
              <Text className="text-xs text-foreground-secondary">
                {formatCurrencyCompact(parlamentar.gastoAno)} em cota
              </Text>
            ) : null}
            {parlamentar.participacaoPercentual !== null ? (
              <Text className="text-xs text-foreground-secondary">
                {formatPercent(parlamentar.participacaoPercentual, 0)} das
                votações
              </Text>
            ) : null}
          </View>
        </View>

        <Icon name="chevron-forward" size={18} color={muted} />
      </Surface>
    </Pressable>
  )
}
