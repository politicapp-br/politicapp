import { useFont } from "@shopify/react-native-skia"
import { useColorScheme } from "react-native"
import { useUniwind } from "uniwind"

type ResolvedTheme = "light" | "dark"

/**
 * Paleta categórica nas cores da bandeira (verde/azul/amarelo), validada:
 * CVD ΔE ≥ 8 entre vizinhas, ΔE normal ≥ 15 e contraste ≥ 3:1 nos dois modos.
 * Espelha os tokens --chart-1..5 do global.css.
 */
const PALETTE = {
  light: {
    chart1: "#029B3B",
    chart2: "#3163C4",
    chart3: "#938001",
    chart4: "#214DA1",
    chart5: "#036424",
    grid: "#E5E5E5",
    label: "#737373",
    background: "#FFFFFF",
  },
  dark: {
    chart1: "#029B3B",
    chart2: "#447BE4",
    chart3: "#938001",
    chart4: "#3163C4",
    chart5: "#017F2F",
    grid: "#262626",
    label: "#A3A3A3",
    background: "#000000",
  },
} as const

export type ChartColorToken =
  | "chart-1"
  | "chart-2"
  | "chart-3"
  | "chart-4"
  | "chart-5"

export type ChartColors = {
  series: [string, string, string, string, string]
  grid: string
  label: string
  background: string
}

export const useChartColors = (): ChartColors => {
  const { theme, hasAdaptiveThemes } = useUniwind()
  const systemScheme = useColorScheme()
  const currentTheme: ResolvedTheme = hasAdaptiveThemes
    ? systemScheme === "dark"
      ? "dark"
      : "light"
    : theme === "dark"
      ? "dark"
      : "light"
  const palette = PALETTE[currentTheme]

  return {
    series: [
      palette.chart1,
      palette.chart2,
      palette.chart3,
      palette.chart4,
      palette.chart5,
    ],
    grid: palette.grid,
    label: palette.label,
    background: palette.background,
  }
}

/** Aceita um token ("chart-1".."chart-5") ou qualquer cor literal. */
export const resolveSeriesColor = (
  colors: ChartColors,
  color: ChartColorToken | (string & {}),
): string => {
  const token = /^chart-([1-5])$/.exec(color)
  if (token) return colors.series[Number(token[1]) - 1] as string
  return color
}

const AXIS_FONT = require("@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf")

/** Fonte padrão dos rótulos de eixo (Inter Medium). */
export const useChartFont = (size = 11) => useFont(AXIS_FONT, size)
