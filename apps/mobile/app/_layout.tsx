import { BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque"
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter"
import * as Sentry from "@sentry/react-native"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { isRunningInExpoGo } from "expo"
import { useFonts } from "expo-font"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { HeroUINativeProvider } from "heroui-native"
import { useLayoutEffect } from "react"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { Uniwind } from "uniwind"

import { ErrorBoundary } from "@/components/error-boundary"
import { persistOptions, queryClient } from "@/services/query-client"
import { readStoredTheme } from "@/utils/storage"

import "../global.css"

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
})

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  integrations: [navigationIntegration],
  environment: __DEV__ ? "develop" : "production",
  enabled: !__DEV__ && Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN),
})

export default Sentry.wrap(function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    BricolageGrotesque_800ExtraBold,
  })

  useLayoutEffect(() => {
    Uniwind.setTheme(readStoredTheme() ?? "system")
  }, [])

  if (!fontsLoaded) return null

  return (
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={persistOptions}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <HeroUINativeProvider
            config={{ devInfo: { stylingPrinciples: false } }}
          >
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="parlamentar/[casa]/[id]"
                options={{ presentation: "card" }}
              />
              <Stack.Screen
                name="votacao/[casa]/[id]"
                options={{ presentation: "card" }}
              />
              <Stack.Screen
                name="proposicao/[casa]/[id]"
                options={{ presentation: "card" }}
              />
              <Stack.Screen name="candidato/[uf]/[cargo]/[id]" />
              <Stack.Screen name="comparador" />
              <Stack.Screen name="salarios" />
              <Stack.Screen name="graficos" />
              <Stack.Screen
                name="onboarding"
                options={{ presentation: "modal" }}
              />
            </Stack>
          </HeroUINativeProvider>
        </GestureHandlerRootView>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  )
})
