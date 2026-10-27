import { createMMKV } from "react-native-mmkv"

export const storage = createMMKV()

const THEME_KEY = "theme"
const ONBOARDING_KEY = "onboarding_done"

export type StoredTheme = "light" | "dark" | "system"

export const readStoredTheme = (): StoredTheme | null => {
  const theme = storage.getString(THEME_KEY)
  return theme === "light" || theme === "dark" || theme === "system" ? theme : null
}

export const saveTheme = (theme: StoredTheme) => storage.set(THEME_KEY, theme)

export const isOnboardingDone = () => storage.getString(ONBOARDING_KEY) === "true"

export const markOnboardingDone = () => storage.set(ONBOARDING_KEY, "true")
