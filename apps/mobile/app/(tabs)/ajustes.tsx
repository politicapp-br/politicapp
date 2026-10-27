import { UFS } from "@politicapp/data"
import { useRouter } from "expo-router"
import { Chip, Surface } from "heroui-native"
import { useState } from "react"
import { Pressable, Text, View } from "react-native"
import { Uniwind } from "uniwind"

import { Icon, type IconName } from "@/components/icon"
import { PageHeader } from "@/components/page-header"
import { Screen } from "@/components/screen"
import { Section } from "@/components/section"
import { useColors } from "@/hooks/use-colors"
import { usePreferences } from "@/services/preferences"
import { openUrl } from "@/utils/links"
import { routes } from "@/utils/routes"
import { saveTheme, readStoredTheme, type StoredTheme } from "@/utils/storage"
import { cn } from "@/utils/cn"

const THEMES: { value: StoredTheme; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
]

const DATA_SOURCES = [
  {
    name: "Câmara dos Deputados",
    url: "https://dadosabertos.camara.leg.br/",
  },
  {
    name: "Senado Federal",
    url: "https://www12.senado.leg.br/dados-abertos",
  },
  {
    name: "Tribunal Superior Eleitoral",
    url: "https://dadosabertos.tse.jus.br/",
  },
]

export default function SettingsScreen() {
  const router = useRouter()
  const uf = usePreferences((state) => state.uf)
  const setUf = usePreferences((state) => state.setUf)
  const followed = usePreferences((state) => state.followed)
  const [theme, setTheme] = useState<StoredTheme>(readStoredTheme() ?? "system")

  const changeTheme = (next: StoredTheme) => {
    setTheme(next)
    saveTheme(next)
    Uniwind.setTheme(next)
  }

  return (
    <Screen>
      <Screen.Scroll contentClassName="gap-0 px-0">
        <PageHeader title="Ajustes" />

        <View className="gap-6 px-4">
          <Section title="Aparência">
            <View className="flex-row gap-2">
              {THEMES.map(({ value, label }) => (
                <Chip
                  key={value}
                  size="sm"
                  variant={theme === value ? "primary" : "secondary"}
                  onPress={() => changeTheme(value)}
                >
                  {label}
                </Chip>
              ))}
            </View>
          </Section>

          <Section
            title="Meu estado"
            description="Define quais parlamentares aparecem em destaque no início."
          >
            <View className="flex-row flex-wrap gap-2">
              {UFS.map(({ sigla }) => (
                <Chip
                  key={sigla}
                  size="sm"
                  variant={uf === sigla ? "primary" : "secondary"}
                  onPress={() => setUf(sigla)}
                >
                  {sigla}
                </Chip>
              ))}
            </View>
          </Section>

          <Section
            title="Salários públicos"
            description="Quanto ganha cada cargo e qual é o teto que nenhum deles pode passar."
          >
            <Surface variant="secondary" className="overflow-hidden">
              <LinkRow
                label="Quem ganha quanto"
                onPress={() => router.push(routes.salaries)}
              />
            </Surface>
          </Section>

          <Section title="Acompanhamento">
            <Surface variant="secondary" className="p-4">
              <Text className="text-sm text-foreground">
                {followed.length === 0
                  ? "Você ainda não segue ninguém."
                  : `Você segue ${followed.length} ${followed.length === 1 ? "parlamentar" : "parlamentares"}.`}
              </Text>
            </Surface>
          </Section>

          <Section
            title="De onde vêm os dados"
            description="Tudo vem de APIs públicas e oficiais. Nenhum dado é editorializado."
          >
            <Surface variant="secondary" className="overflow-hidden">
              {DATA_SOURCES.map((source, index) => (
                <LinkRow
                  key={source.url}
                  label={source.name}
                  icon="open-outline"
                  separated={index > 0}
                  onPress={() => openUrl(source.url)}
                />
              ))}
            </Surface>
          </Section>

          <Section title="Desenvolvimento">
            <Surface variant="secondary" className="overflow-hidden">
              <LinkRow
                label="Vitrine de gráficos"
                onPress={() => router.push(routes.chartsShowcase)}
              />
            </Surface>
          </Section>

          <Text className="text-center text-xs text-muted-foreground">
            Politicapp é gratuito, sem anúncios e de código aberto.
          </Text>
        </View>
      </Screen.Scroll>
    </Screen>
  )
}

type LinkRowProps = {
  label: string
  onPress: () => void
  icon?: IconName
  /** Linha divisória acima, para itens empilhados no mesmo `Surface`. */
  separated?: boolean
}

const LinkRow = ({
  label,
  onPress,
  icon = "chevron-forward",
  separated = false,
}: LinkRowProps) => {
  const { muted } = useColors()

  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "flex-row items-center justify-between p-4",
        separated && "border-t border-border",
      )}
    >
      <Text className="text-sm text-foreground">{label}</Text>
      <Icon name={icon} size={16} color={muted} />
    </Pressable>
  )
}
