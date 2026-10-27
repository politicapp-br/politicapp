import { CARGO_LABEL, casaSchema, type ParlamentarRef } from "@politicapp/data"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Button } from "heroui-native"
import { Pressable, Text, View } from "react-native"

import { Card } from "@/components/card"
import { DetailRow } from "@/components/detail-row"
import { ParlamentarAvatar } from "@/components/parlamentar-avatar"
import { Screen } from "@/components/screen"
import { Section } from "@/components/section"
import { ErrorState, LoadingState } from "@/components/states"
import { AffinityCard } from "@/features/parlamentar/affinity"
import { AttendanceCard } from "@/features/parlamentar/attendance"
import { CareerCard } from "@/features/parlamentar/career"
import { CommitteesCard } from "@/features/parlamentar/committees"
import { CompensationCard } from "@/features/parlamentar/compensation"
import { CotaSuppliersCard } from "@/features/parlamentar/cota-suppliers"
import { ElectoralHistoryCard } from "@/features/parlamentar/electoral-history"
import { ElectoralTerritoryCard } from "@/features/parlamentar/electoral-territory"
import { EmendasCard } from "@/features/parlamentar/emendas"
import { ExpensesCard } from "@/features/parlamentar/expenses"
import { FrentesCard } from "@/features/parlamentar/frentes"
import { LegislativeOutputCard } from "@/features/parlamentar/legislative-output"
import { OfficialAttendanceCard } from "@/features/parlamentar/official-attendance"
import { PartyAlignmentCard } from "@/features/parlamentar/party-alignment"
import { PartyDissentCard } from "@/features/parlamentar/party-dissent"
import { ProposicoesCard } from "@/features/parlamentar/proposicoes"
import { RecentVotesCard } from "@/features/parlamentar/recent-votes"
import { SanctionedSuppliersCard } from "@/features/parlamentar/sanctioned-suppliers"
import { SpeechesCard } from "@/features/parlamentar/speeches"
import { TermCostCard } from "@/features/parlamentar/term-cost"
import { TermHistoryCard } from "@/features/parlamentar/term-history"
import { useParlamentarDetails } from "@/hooks/use-parlamentar"
import { useIsFollowing, usePreferences } from "@/services/preferences"
import { routes } from "@/utils/routes"

export default function ParlamentarScreen() {
  const params = useLocalSearchParams<{ casa: string; id: string }>()

  const casa = casaSchema.safeParse(params.casa)

  if (!casa.success || !params.id) {
    return (
      <Screen>
        <ErrorState
          title="Parlamentar não encontrado"
          description="O endereço acessado não corresponde a nenhum parlamentar."
        />
      </Screen>
    )
  }

  const ref: ParlamentarRef = { casa: casa.data, id: params.id }

  return (
    <Screen>
      <Screen.TopBar trailing={<FollowButton parlamentar={ref} />} />
      <ParlamentarContent parlamentar={ref} />
    </Screen>
  )
}

/** Sigla clicável leva à tela do partido; "—" (sem partido) fica texto puro. */
const PartyLink = ({ sigla }: { sigla: string }) => {
  const router = useRouter()

  if (sigla === "—") {
    return <Text className="text-sm text-muted-foreground">{sigla}</Text>
  }

  return (
    <Pressable
      hitSlop={8}
      accessibilityRole="link"
      accessibilityLabel={`Ver o partido ${sigla}`}
      onPress={() => router.push(routes.party(sigla))}
    >
      <Text className="text-sm font-semibold text-brand">{sigla}</Text>
    </Pressable>
  )
}

const FollowButton = ({ parlamentar }: { parlamentar: ParlamentarRef }) => {
  const isFollowing = useIsFollowing(parlamentar)
  const toggleFollow = usePreferences((state) => state.toggleFollow)

  return (
    <Button
      size="sm"
      variant={isFollowing ? "secondary" : "primary"}
      onPress={() => toggleFollow(parlamentar)}
    >
      {isFollowing ? "Seguindo" : "Seguir"}
    </Button>
  )
}

const ParlamentarContent = ({ parlamentar }: { parlamentar: ParlamentarRef }) => {
  const { data, isPending, isError, refetch } = useParlamentarDetails(parlamentar)

  if (isPending) return <LoadingState />
  if (isError || !data) {
    return <ErrorState onRetry={() => void refetch()} />
  }

  const birthplace = data.municipioNascimento
    ? `${data.municipioNascimento}${data.ufNascimento ? `/${data.ufNascimento}` : ""}`
    : null

  return (
    <Screen.Scroll contentClassName="gap-6">
      <View className="items-center gap-2 pb-2">
        <ParlamentarAvatar parlamentar={data} size={96} />
        <Text className="text-center font-title text-2xl text-foreground">
          {data.nome}
        </Text>
        <View className="flex-row items-center">
          <Text className="text-sm text-muted-foreground">
            {`${CARGO_LABEL[data.casa]} · `}
          </Text>
          <PartyLink sigla={data.partido} />
          <Text className="text-sm text-muted-foreground">{` · ${data.uf}`}</Text>
        </View>
        {data.nomeCivil && data.nomeCivil !== data.nome ? (
          <Text className="text-xs text-muted-foreground">{data.nomeCivil}</Text>
        ) : null}
      </View>

      <SanctionedSuppliersCard parlamentar={parlamentar} />

      <Section title="O que fez" className="gap-4">
        <LegislativeOutputCard parlamentar={parlamentar} />
        <ProposicoesCard parlamentar={parlamentar} />
        <EmendasCard parlamentar={parlamentar} />
      </Section>

      <Section title="Como vota" className="gap-4">
        <RecentVotesCard parlamentar={parlamentar} />
        <PartyDissentCard parlamentar={parlamentar} />
        <PartyAlignmentCard parlamentar={parlamentar} />
        <AffinityCard parlamentar={parlamentar} />
        <AttendanceCard parlamentar={parlamentar} />
        <OfficialAttendanceCard parlamentar={parlamentar} />
      </Section>

      <Section title="Onde atua" className="gap-4">
        <CommitteesCard parlamentar={parlamentar} />
        <FrentesCard parlamentar={parlamentar} />
        <SpeechesCard parlamentar={parlamentar} />
      </Section>

      <Section title="Carreira e eleições" className="gap-4">
        <TermHistoryCard parlamentar={parlamentar} />
        <CareerCard parlamentar={parlamentar} />
        <ElectoralHistoryCard parlamentar={parlamentar} />
        <ElectoralTerritoryCard parlamentar={parlamentar} />
      </Section>

      <Section
        title="Salário e gastos"
        description="Quanto recebe, quanto custa o mandato e como usa a cota"
        className="gap-4"
      >
        <CompensationCard parlamentar={parlamentar} />
        <TermCostCard parlamentar={parlamentar} />
        <ExpensesCard parlamentar={parlamentar} />
        <CotaSuppliersCard parlamentar={parlamentar} />
      </Section>

      <Card title="Contato e gabinete" className="gap-2">
        <DetailRow label="E-mail" value={data.email} />
        <DetailRow label="Telefone" value={data.telefone} />
        <DetailRow label="Gabinete" value={data.gabinete} />
        <DetailRow label="Naturalidade" value={birthplace} />
      </Card>
    </Screen.Scroll>
  )
}
