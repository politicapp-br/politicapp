import { CARGO_ELEICAO_LABEL, type Cargo } from "@politicapp/data"
import { FlashList } from "@shopify/flash-list"
import { useRouter } from "expo-router"
import { Button, Chip } from "heroui-native"
import { useState } from "react"
import { ScrollView, Text, View } from "react-native"

import { Card } from "@/components/card"
import { PageHeader } from "@/components/page-header"
import { Screen } from "@/components/screen"
import { LoadingState, ErrorState, EmptyState } from "@/components/states"
import { CandidateCard } from "@/features/elections/candidate-card"
import { ElectionCountdown } from "@/features/elections/election-countdown"
import { useCandidates } from "@/hooks/use-elections"
import { usePreferences } from "@/services/preferences"
import { routes } from "@/utils/routes"

const CARGOS: Cargo[] = ["senador", "deputado-federal", "governador", "presidente"]

export default function ElectionsScreen() {
  const router = useRouter()
  const uf = usePreferences((state) => state.uf)
  const [cargo, setCargo] = useState<Cargo>("senador")

  const { data, isPending, isError, refetch, isRefetching } = useCandidates(
    uf,
    cargo,
  )

  if (!uf) {
    return (
      <Screen>
        <PageHeader title="Eleições 2026" />
        <View className="px-4">
          <Card title="Defina seu estado">
            <Text className="text-sm text-muted-foreground">
              As candidaturas a senador, deputado federal e governador são por
              estado. Escolha o seu para ver quem está concorrendo.
            </Text>
            <Button size="sm" onPress={() => router.push(routes.onboarding)}>
              Escolher estado
            </Button>
          </Card>
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <FlashList
        data={data ?? []}
        keyExtractor={(candidate) => candidate.id}
        contentContainerClassName="px-4 pb-8"
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        ListHeaderComponent={
          <View className="gap-4">
            <PageHeader
              title="Eleições 2026"
              subtitle={`Candidaturas registradas em ${uf}`}
            />

            <ElectionCountdown />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2 pb-2"
            >
              {CARGOS.map((option) => (
                <Chip
                  key={option}
                  size="sm"
                  variant={cargo === option ? "primary" : "secondary"}
                  onPress={() => setCargo(option)}
                >
                  {CARGO_ELEICAO_LABEL[option]}
                </Chip>
              ))}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => (
          <View className="pb-2">
            <CandidateCard
              candidate={item}
              onPress={() =>
                router.push(routes.candidate(item.uf, item.cargo, item.id))
              }
            />
          </View>
        )}
        ListEmptyComponent={
          isPending ? (
            <LoadingState label="Consultando o TSE…" />
          ) : isError ? (
            <ErrorState
              description="A base de candidaturas do TSE é atualizada de hora em hora e às vezes fica indisponível."
              onRetry={() => void refetch()}
            />
          ) : (
            <EmptyState
              icon="hourglass-outline"
              title="Nenhuma candidatura ainda"
              description="O registro de candidaturas segue em andamento. Volte em alguns dias."
            />
          )
        }
      />
    </Screen>
  )
}
