import type { Parlamentar } from "@politicapp/data"
import { Image } from "expo-image"
import { Text, View } from "react-native"

import { cn } from "@/utils/cn"
import { getInitials } from "@/utils/formatters"
import { getPartyColor } from "@/utils/party-colors"

type Props = {
  parlamentar: Pick<Parlamentar, "nome" | "fotoUrl" | "partido">
  size?: number
  className?: string
}

export const ParlamentarAvatar = ({
  parlamentar,
  size = 48,
  className,
}: Props) => (
  <View
    className={cn("items-center justify-center overflow-hidden bg-surface", className)}
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 2,
      borderColor: getPartyColor(parlamentar.partido),
    }}
  >
    {parlamentar.fotoUrl ? (
      <Image
        source={{ uri: parlamentar.fotoUrl }}
        style={{ width: size, height: size }}
        contentFit="cover"
        transition={150}
      />
    ) : (
      <Text
        className="font-semibold text-muted-foreground"
        style={{ fontSize: size / 3 }}
      >
        {getInitials(parlamentar.nome)}
      </Text>
    )}
  </View>
)
