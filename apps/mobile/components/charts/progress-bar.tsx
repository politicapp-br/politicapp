import type { ReactNode } from "react"
import { View, type AccessibilityValue } from "react-native"
import Animated, { useAnimatedStyle } from "react-native-reanimated"

import { cn } from "@/utils/cn"

import { useEntryProgress, type EntryAnimation } from "./entry-animation"
import {
  resolveSeriesColor,
  useChartColors,
  type ChartColorToken,
} from "./theme"

type Props = {
  /** Percentual preenchido (0–100; valores fora da faixa são grampeados). */
  value: number
  /** Token da paleta ("chart-1".."chart-5") ou cor literal. */
  color?: ChartColorToken | (string & {})
  /** Classe do trilho (padrão: h-2 bg-surface arredondado). */
  className?: string
  /** Preenchimento progressivo ao montar (padrão ligado; `false` desliga). */
  entering?: EntryAnimation | false
  /** Mude o valor para repetir a animação de entrada. */
  resetKey?: number | string | boolean | null
  accessibilityLabel?: string
  /** Sobrepõe o padrão (min 0, max 100, now = value) quando a escala real não é percentual. */
  accessibilityValue?: AccessibilityValue
  /** Camadas extras dentro do trilho (ex.: marcador de mediana). */
  children?: ReactNode
}

/** Barra de progresso com preenchimento animado, no padrão do kit. */
export const ProgressBar = ({
  value,
  color = "chart-1",
  className,
  entering = { type: "timing", duration: 700 },
  resetKey,
  accessibilityLabel,
  accessibilityValue,
  children,
}: Props) => {
  const chartColors = useChartColors()
  const fillColor = resolveSeriesColor(chartColors, color)
  const progress = useEntryProgress(entering, resetKey)
  const target = Math.min(Math.max(value, 0), 100)

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${target * progress.get()}%`,
  }))

  return (
    <View
      className={cn("h-2 overflow-hidden rounded-full bg-surface", className)}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={
        accessibilityValue ?? { min: 0, max: 100, now: Math.round(target) }
      }
    >
      <Animated.View
        style={[
          { height: "100%", borderRadius: 999, backgroundColor: fillColor },
          animatedStyle,
        ]}
      />
      {children}
    </View>
  )
}
