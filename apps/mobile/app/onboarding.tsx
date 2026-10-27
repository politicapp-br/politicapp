import { UFS } from "@politicapp/data"
import { useRouter } from "expo-router"
import { Button, Chip } from "heroui-native"
import { useState } from "react"
import { ScrollView, Text, View } from "react-native"

import { Screen } from "@/components/screen"
import { usePreferences } from "@/services/preferences"
import { markOnboardingDone } from "@/utils/storage"

export default function OnboardingScreen() {
  const router = useRouter()
  const currentUf = usePreferences((state) => state.uf)
  const setUf = usePreferences((state) => state.setUf)
  const [selectedUf, setSelectedUf] = useState(currentUf)

  const confirm = () => {
    if (selectedUf) setUf(selectedUf)
    markOnboardingDone()
    router.back()
  }

  return (
    <Screen edges={["top", "right", "bottom", "left"]}>
      <View className="gap-2 px-6 pb-4 pt-8">
        <Text className="font-title text-3xl text-foreground">
          Qual é o seu estado?
        </Text>
        <Text className="text-sm text-muted-foreground">
          Você elege 3 senadores e uma bancada de deputados federais. O app usa
          isso para mostrar primeiro quem representa você.
        </Text>
      </View>

      <ScrollView contentContainerClassName="flex-row flex-wrap gap-2 px-6 pb-6">
        {UFS.map(({ sigla, nome }) => (
          <Chip
            key={sigla}
            variant={selectedUf === sigla ? "primary" : "secondary"}
            onPress={() => setSelectedUf(sigla)}
          >
            {`${sigla} · ${nome}`}
          </Chip>
        ))}
      </ScrollView>

      <View className="gap-3 border-t border-border px-6 py-4">
        <Button isDisabled={!selectedUf} onPress={confirm}>
          Continuar
        </Button>
        <Button variant="ghost" onPress={() => router.back()}>
          Agora não
        </Button>
      </View>
    </Screen>
  )
}
