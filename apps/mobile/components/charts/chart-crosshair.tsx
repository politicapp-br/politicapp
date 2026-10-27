import {
  DashPathEffect,
  Line as SkiaLine,
  vec,
} from "@shopify/react-native-skia"
import { createContext, useContext, useState, type ReactNode } from "react"
import {
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native"
import Animated, {
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"
import type { ChartBounds } from "victory-native"

import { useColors } from "@/hooks/use-colors"
import { cn } from "@/utils/cn"

import { useChartColors } from "./theme"

type Props = {
  x: SharedValue<number>
  top: number
  bottom: number
  variant?: "dashed" | "solid"
  color?: string
}

/** Régua vertical que acompanha o toque (dentro do canvas Skia). */
export const ChartCrosshair = ({
  x,
  top,
  bottom,
  variant = "dashed",
  color,
}: Props) => {
  const chartColors = useChartColors()
  const p1 = useDerivedValue(() => vec(x.get(), top))
  const p2 = useDerivedValue(() => vec(x.get(), bottom))

  return (
    <SkiaLine
      p1={p1}
      p2={p2}
      color={color ?? chartColors.label}
      strokeWidth={1}
      style="stroke"
    >
      {variant === "dashed" ? <DashPathEffect intervals={[4, 4]} /> : null}
    </SkiaLine>
  )
}

type AnchorContextValue = {
  x: SharedValue<number>
  isActive: SharedValue<boolean>
  chartBounds: ChartBounds | null
}

const AnchorContext = createContext<AnchorContextValue | null>(null)

type AnchorProps = {
  x: SharedValue<number>
  isActive: SharedValue<boolean>
  chartBounds?: ChartBounds
  className?: string
  children: ReactNode
}

/**
 * Área de referência para o rótulo flutuante: envolva o gráfico e um
 * ChartCrosshair.Value e reserve espaço acima (ex.: className="pt-8");
 * o rótulo segue o eixo X do toque.
 */
const ChartCrosshairAnchor = ({
  x,
  isActive,
  chartBounds,
  className,
  children,
}: AnchorProps) => (
  <AnchorContext.Provider value={{ x, isActive, chartBounds: chartBounds ?? null }}>
    <View className={cn("relative", className)}>{children}</View>
  </AnchorContext.Provider>
)

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

type ValueProps = {
  /** Texto do rótulo, derivado do estado de toque (useDerivedValue). */
  value: SharedValue<string>
  className?: string
  textStyle?: StyleProp<TextStyle>
}

const LABEL_FONT = {
  fontFamily: "Inter_600SemiBold",
  fontSize: 12,
} as const

/** Rótulo flutuante acima do gráfico, preso ao Anchor mais próximo. */
const ChartCrosshairValue = ({ value, className, textStyle }: ValueProps) => {
  const context = useContext(AnchorContext)
  const { background } = useColors()
  const [width, setWidth] = useState(0)
  // O TextInput animado troca o texto direto na view nativa, sem passar pelo
  // layout — o balão ficaria com a largura antiga e cortaria o fim do rótulo.
  // Este espelho em estado React é quem dimensiona o balão.
  const [measureText, setMeasureText] = useState("")

  useAnimatedReaction(
    () => value.get(),
    (current, previous) => {
      if (current !== previous) scheduleOnRN(setMeasureText, current)
    },
  )

  const props = useAnimatedProps(() => ({
    text: value.get(),
    defaultValue: value.get(),
  }))

  const animatedStyle = useAnimatedStyle(() => {
    if (!context) return { opacity: 0 }
    const { x, isActive, chartBounds } = context
    const centered = x.get() - width / 2
    const left = chartBounds
      ? Math.min(Math.max(centered, chartBounds.left), chartBounds.right - width)
      : centered
    return {
      opacity: isActive.get() && width > 0 ? 1 : 0,
      transform: [{ translateX: left }],
    }
  })

  return (
    <Animated.View
      style={[{ position: "absolute", top: 0, left: 0 }, animatedStyle]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      pointerEvents="none"
    >
      <View className={cn("items-center rounded-lg bg-accent px-2 py-1", className)}>
        <Text
          numberOfLines={1}
          style={[LABEL_FONT, { opacity: 0 }, textStyle]}
        >
          {measureText || " "}
        </Text>
        <AnimatedTextInput
          animatedProps={props}
          editable={false}
          underlineColorAndroid="transparent"
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              color: background,
              ...LABEL_FONT,
              padding: 0,
              textAlign: "center",
              textAlignVertical: "center",
            },
            textStyle,
          ]}
        />
      </View>
    </Animated.View>
  )
}

ChartCrosshair.Anchor = ChartCrosshairAnchor
ChartCrosshair.Value = ChartCrosshairValue
