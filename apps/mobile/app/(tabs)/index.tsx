import {
  chaveDoEvento,
  parseParlamentarKey,
  type EventoPauta,
  type IndiceParlamentar,
} from "@politicapp/data"
import { FlashList } from "@shopify/flash-list"
import { useRouter } from "expo-router"
import { Button } from "heroui-native"
import { useMemo } from "react"
import { RefreshControl, Text, View } from "react-native"

import { Card } from "@/components/card"
import { PageHeader } from "@/components/page-header"
import { ParlamentarCard } from "@/components/parlamentar-card"
import { Screen } from "@/components/screen"
import { Section } from "@/components/section"
import { LoadingState, ErrorState, EmptyState } from "@/components/states"
import { NormaCard } from "@/features/feed/norma-card"
import { PautaCard } from "@/features/feed/pauta-card"
import { TramitacaoCard } from "@/features/feed/tramitacao-card"
import { VotacaoCard } from "@/features/feed/votacao-card"
import { useFeed } from "@/hooks/use-feed"
import { useParlamentarIndex } from "@/hooks/use-static-data"
import { usePreferences } from "@/services/preferences"
import { routes } from "@/utils/routes"

export default function HomeScreen() {
  const router = useRouter()
  const uf = usePreferences((state) => state.uf)
  const followed = usePreferences((state) => state.followed)

  const index = useParlamentarIndex()
  const feed = useFeed()

  const myParlamentares = useMemo(() => {
    if (!index.data) return []

    const refs = followed
      .map(parseParlamentarKey)
      .filter((ref): ref is NonNullable<typeof ref> => ref !== null)

    const followedInIndex = refs.flatMap((ref) => {
      const found = index.data.parlamentares.find(
        (parlamentar) =>
          parlamentar.casa === ref.casa && parlamentar.id === ref.id,
      )
      return found ? [found] : []
    })

    if (followedInIndex.length > 0) return followedInIndex

    return uf
      ? index.data.parlamentares
          .filter(
            (parlamentar) =>
              parlamentar.uf === uf && parlamentar.casa === "senado",
          )
          .slice(0, 3)
      : []
  }, [index.data, followed, uf])

  if (index.isPending) {
    return (
      <Screen>
        <LoadingState label="Carregando o Congresso…" />
      </Screen>
    )
  }

  if (index.isError) {
    return (
      <Screen>
        <ErrorState onRetry={() => void index.refetch()} />
      </Screen>
    )
  }

  return (
    <Screen>
      <FlashList
        data={feed.data?.events ?? []}
        keyExtractor={chaveDoEvento}
        contentContainerClassName="pb-8"
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching}
            onRefresh={() => void feed.refetch()}
          />
        }
        ListHeaderComponent={
          <View className="gap-4">
            <PageHeader
              title="Início"
              subtitle={
                uf
                  ? `O que anda acontecendo — e o que os seus de ${uf} fizeram`
                  : "O que anda acontecendo no Congresso"
              }
            />

            <MyParlamentaresSection
              parlamentares={myParlamentares}
              hasFollowed={followed.length > 0}
              onChooseUf={() => router.push(routes.onboarding)}
            />

            <AgendaSection agenda={feed.data?.agenda ?? []} />

            <Section
              title="Aconteceu em Brasília"
              description="Votações de plenário, projetos que mudaram de estágio e o que virou lei, MP ou decreto no Diário Oficial."
              className="px-4 pt-2"
            />
          </View>
        }
        renderItem={({ item }) => (
          <View className="px-4 pb-3">
            {item.tipo === "votacao" ? (
              <VotacaoCard votacao={item.votacao} nominal={item.nominal} />
            ) : item.tipo === "tramitacao" ? (
              <TramitacaoCard event={item} />
            ) : (
              <NormaCard event={item} />
            )}
          </View>
        )}
        ListEmptyComponent={
          feed.isPending ? (
            <LoadingState />
          ) : feed.isError ? (
            <ErrorState onRetry={() => void feed.refetch()} />
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="Nada recente por aqui"
              description="O plenário não votou nada nos últimos meses. Em ano eleitoral o Congresso costuma desacelerar."
            />
          )
        }
      />
    </Screen>
  )
}

/** O header do FlashList não é virtualizado — a agenda entra com teto curto. */
const VISIBLE_AGENDA = 5

const AgendaSection = ({ agenda }: { agenda: EventoPauta[] }) => {
  if (agenda.length === 0) return null

  const remaining = agenda.length - VISIBLE_AGENDA

  return (
    <Section
      title="Em pauta"
      description="Sessões e reuniões deliberativas marcadas nas próximas duas semanas."
      className="px-4 pt-2"
    >
      {agenda.slice(0, VISIBLE_AGENDA).map((event) => (
        <PautaCard key={chaveDoEvento(event)} event={event} />
      ))}
      {remaining > 0 ? (
        <Text className="text-xs text-muted-foreground">
          E mais {remaining}{" "}
          {remaining === 1 ? "sessão ou reunião marcada" : "sessões e reuniões marcadas"}{" "}
          nas próximas duas semanas.
        </Text>
      ) : null}
    </Section>
  )
}

type MyParlamentaresSectionProps = {
  parlamentares: IndiceParlamentar[]
  hasFollowed: boolean
  onChooseUf: () => void
}

const MyParlamentaresSection = ({
  parlamentares,
  hasFollowed,
  onChooseUf,
}: MyParlamentaresSectionProps) => {
  const router = useRouter()

  if (parlamentares.length === 0) {
    return (
      <View className="px-4">
        <Card title="Escolha os seus políticos">
          <Text className="text-sm text-muted-foreground">
            Diga o seu estado e siga quem você quer acompanhar. O app passa a
            mostrar o que eles votam e quanto gastam.
          </Text>
          <Button size="sm" onPress={onChooseUf}>
            Definir meu estado
          </Button>
        </Card>
      </View>
    )
  }

  return (
    <Section
      title={hasFollowed ? "Quem você segue" : "Do seu estado"}
      className="px-4"
    >
      <View className="gap-2">
        {parlamentares.map((parlamentar) => (
          <ParlamentarCard
            key={`${parlamentar.casa}:${parlamentar.id}`}
            parlamentar={parlamentar}
            showRole
            onPress={() => router.push(routes.parlamentar(parlamentar))}
          />
        ))}
      </View>
    </Section>
  )
}
