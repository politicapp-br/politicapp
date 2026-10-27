import type { Casa, IndiceParlamentar } from "@politicapp/data"
import { FlashList } from "@shopify/flash-list"
import { useRouter } from "expo-router"
import { Button, Chip, Input, TextField } from "heroui-native"
import { useDeferredValue, useMemo, useState } from "react"
import { ScrollView, View } from "react-native"

import { PageHeader } from "@/components/page-header"
import { ParlamentarCard } from "@/components/parlamentar-card"
import { Screen } from "@/components/screen"
import { LoadingState, ErrorState, EmptyState } from "@/components/states"
import { CasaCompositionCard } from "@/features/parlamentar/casa-composition"
import { useParlamentarIndex } from "@/hooks/use-static-data"
import { usePreferences } from "@/services/preferences"
import { routes } from "@/utils/routes"
import { normalizeForSearch } from "@/utils/text"

type Filter = "all" | Casa | "my-uf"

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "camara", label: "Deputados" },
  { value: "senado", label: "Senadores" },
  { value: "my-uf", label: "Meu estado" },
]

export default function ParlamentaresScreen() {
  const router = useRouter()
  const uf = usePreferences((state) => state.uf)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const deferredSearch = useDeferredValue(search)

  const { data, isPending, isError, refetch } = useParlamentarIndex()

  const results = useMemo(() => {
    if (!data) return []

    const term = normalizeForSearch(deferredSearch.trim())

    return data.parlamentares
      .filter((parlamentar) => matchesFilter(parlamentar, filter, uf))
      .filter(
        (parlamentar) =>
          term.length === 0 ||
          normalizeForSearch(parlamentar.nome).includes(term) ||
          normalizeForSearch(parlamentar.partido).includes(term),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
  }, [data, deferredSearch, filter, uf])

  if (isPending) {
    return (
      <Screen>
        <LoadingState label="Carregando parlamentares…" />
      </Screen>
    )
  }

  if (isError) {
    return (
      <Screen>
        <ErrorState onRetry={() => void refetch()} />
      </Screen>
    )
  }

  return (
    <Screen>
      <View className="flex-row items-start justify-between pr-4">
        <View className="flex-1">
          <PageHeader
            title="Parlamentares"
            subtitle={`${data.parlamentares.length} em exercício no Congresso`}
          />
        </View>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => router.push(routes.compare)}
        >
          Comparar
        </Button>
      </View>

      <View className="px-4 pb-3">
        <TextField>
          <Input
            placeholder="Buscar por nome ou partido"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </TextField>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="grow-0"
        contentContainerClassName="gap-2 px-4 pb-3"
      >
        {FILTERS.filter(({ value }) => value !== "my-uf" || uf).map(
          ({ value, label }) => (
            <Chip
              key={value}
              size="sm"
              variant={filter === value ? "primary" : "secondary"}
              onPress={() => setFilter(value)}
            >
              {value === "my-uf" && uf ? uf : label}
            </Chip>
          ),
        )}
      </ScrollView>

      <View className="flex-1">
        <FlashList
          data={results}
          keyExtractor={(parlamentar) =>
            `${parlamentar.casa}:${parlamentar.id}`
          }
          contentContainerClassName="px-4 pb-8"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            (filter === "camara" || filter === "senado") &&
            deferredSearch.trim().length === 0 ? (
              <View className="pb-3">
                <CasaCompositionCard
                  parlamentares={data.parlamentares}
                  casa={filter}
                />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View className="pb-2">
              <ParlamentarCard
                parlamentar={item}
                showRole={filter === "all" || filter === "my-uf"}
                onPress={() => router.push(routes.parlamentar(item))}
              />
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="Ninguém encontrado"
              description="Tente outro nome ou sigla de partido."
            />
          }
        />
      </View>
    </Screen>
  )
}

const matchesFilter = (
  parlamentar: IndiceParlamentar,
  filter: Filter,
  uf: string | null,
) => {
  if (filter === "all") return true
  if (filter === "my-uf") return parlamentar.uf === uf
  return parlamentar.casa === filter
}
