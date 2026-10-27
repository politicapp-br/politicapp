import { useThemeColor } from "heroui-native"
import { useColorScheme } from "react-native"
import { useUniwind } from "uniwind"

type ResolvedTheme = "light" | "dark"

const DEFAULT_COLORS = {
  light: {
    brandColor: "#214DA1",
    brandForeground: "#FFFFFF",
    accentColor: "#09255A",
    dangerColor: "#DC2626",
    successColor: "#029B3B",
    background: "#FFFFFF",
    foreground: "#171717",
    muted: "#737373",
    defaultColor: "#F5F5F5",
    warningColor: "#938001",
    surface: "#F5F5F5",
    border: "#E5E5E5",
  },
  dark: {
    brandColor: "#5C95FF",
    brandForeground: "#09255A",
    accentColor: "#E8F1FF",
    dangerColor: "#EF4444",
    successColor: "#27B54F",
    background: "#000000",
    foreground: "#FAFAFA",
    muted: "#A3A3A3",
    defaultColor: "#171717",
    warningColor: "#EBCE00",
    surface: "#1C1C1E",
    border: "#262626",
  },
} as const

const withFallback = (value: string, fallback: string) =>
  !value || value === "invalid" ? fallback : value

export const useColors = () => {
  const { theme, hasAdaptiveThemes } = useUniwind()
  const systemScheme = useColorScheme()
  const currentTheme: ResolvedTheme = hasAdaptiveThemes
    ? systemScheme === "dark"
      ? "dark"
      : "light"
    : theme === "dark"
      ? "dark"
      : "light"
  const defaults = DEFAULT_COLORS[currentTheme]

  return {
    brandColor: defaults.brandColor,
    brandForeground: defaults.brandForeground,
    accentColor: withFallback(useThemeColor("accent"), defaults.accentColor),
    dangerColor: withFallback(useThemeColor("danger"), defaults.dangerColor),
    successColor: withFallback(useThemeColor("success"), defaults.successColor),
    warningColor: withFallback(useThemeColor("warning"), defaults.warningColor),
    background: withFallback(useThemeColor("background"), defaults.background),
    foreground: withFallback(useThemeColor("foreground"), defaults.foreground),
    muted: withFallback(useThemeColor("muted"), defaults.muted),
    defaultColor: withFallback(useThemeColor("default"), defaults.defaultColor),
    surface: withFallback(useThemeColor("surface"), defaults.surface),
    border: withFallback(useThemeColor("border"), defaults.border),
  }
}
