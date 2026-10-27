import { Canvas, Circle } from "@shopify/react-native-skia"
import { useMemo, useState } from "react"
import { View } from "react-native"
import Animated, {
  Easing,
  ReduceMotion,
  withTiming,
} from "react-native-reanimated"

import { buildHemicycle } from "./hemicycle-layout"

/** Entrada padrão: fade + leve subida do conjunto de assentos. */
const hemicycleEntering = () => {
  "worklet"
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 8 }] },
    animations: {
      opacity: withTiming(1, {
        duration: 500,
        reduceMotion: ReduceMotion.System,
      }),
      transform: [
        {
          translateY: withTiming(0, {
            duration: 500,
            easing: Easing.out(Easing.cubic),
            reduceMotion: ReduceMotion.System,
          }),
        },
      ],
    },
  }
}

export type SeatGroup = {
  key: string
  count: number
  color: string
}

type Props = {
  /** Grupos em ordem: o primeiro ocupa a ponta esquerda do arco. */
  groups: SeatGroup[]
  /** Obrigatório: o desenho não tem texto, o leitor de tela depende disso. */
  accessibilityLabel: string
}

/** Hemiciclo de parlamento: cada assento é um ponto, grupos formam fatias contíguas. */
export const Hemicycle = ({ groups, accessibilityLabel }: Props) => {
  const [width, setWidth] = useState(0)

  const total = groups.reduce((sum, group) => sum + group.count, 0)

  const { seats, seatRadius, height } = useMemo(
    () => buildHemicycle(total, width),
    [total, width],
  )

  const seatColors = useMemo(
    () =>
      groups.flatMap((group) =>
        Array.from({ length: group.count }, () => group.color),
      ),
    [groups],
  )

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {seats.length > 0 ? (
        <Animated.View entering={hemicycleEntering}>
          <Canvas style={{ width, height }}>
            {seats.map((seat, index) => (
              <Circle
                key={index}
                cx={seat.x}
                cy={seat.y}
                r={seatRadius}
                color={seatColors[index] ?? "transparent"}
              />
            ))}
          </Canvas>
        </Animated.View>
      ) : null}
    </View>
  )
}
