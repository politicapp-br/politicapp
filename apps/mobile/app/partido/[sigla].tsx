import {
  CASA_LABEL,
  type BancadaPartido,
  type FinancasPartido,
  type IndiceParlamentar,
  type LiderPartido,
  type PartidoResumo,
} from "@politicapp/data"
import { FlashList } from "@shopify/flash-list"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Button } from "heroui-native"
import { useState } from "react"
import { Text, View } from "react-native"

import { Card } from "@/components/card"
import { DetailRow } from "@/components/detail-row"
import { ParlamentarCard } from "@/components/parlamentar-card"
import { Screen } from "@/components/screen"
import { Section } from "@/components/section"
import { SourceLink } from "@/components/source-link"
import { ErrorState, LoadingState } from "@/components/states"
import { useParty, usePartyMembers } from "@/hooks/use-static-data"
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  formatPercent,
} from "@/utils/formatters"
import { getContrastTextColor, getPartyColor } from "@/utils/party-colors"
import { routes } from "@/utils/routes"
import { toProperCase } from "@/utils/text"

export default function PartyScreen() {
  const params = useLocalSearchParams<{ sigla: string }>()
  const sigla = params.sigla ?? null

  const party = useParty(sigla)
  const members = usePartyMembers(sigla)

  if (party.isPending || members.isPending) {
    return (
      <Screen>
        <Screen.TopBar />
        <LoadingState label="Carregando partido…" />
      </Screen>
    )
  }

  // Sem entrada no catálogo e sem parlamentar: sigla desconhecida.
  if (!sigla || (!party.data && members.data.length === 0)) {
    return (
      <Screen>
        <Screen.TopBar />
        <ErrorState
          title="Partido não encontrado"
          description="O endereço acessado não corresponde a nenhum partido com representação no Congresso."
          onRetry={() => void party.refetch()}
        />
      </Screen>
    )
  }

  return (
    <Screen>
      <Screen.TopBar />
      <PartyContent
        sigla={party.data?.sigla ?? sigla}
        party={party.data}
        year={party.year}
        members={members.data}
      />
    </Screen>
  )
}

type PartyContentProps = {
  sigla: string
  party: PartidoResumo | undefined
  year: number | undefined
  members: IndiceParlamentar[]
}

const PartyContent = ({ sigla, party, year, members }: PartyContentProps) => {
  const router = useRouter()

  return (
    <FlashList
      data={members}
      keyExtractor={(item) => `${item.casa}:${item.id}`}
      contentContainerClassName="px-4 pb-8"
      ListHeaderComponent={
        <View className="gap-6 pb-4">
          <PartyHeader sigla={sigla} party={party} />

          {party && party.bancadas.length > 0 ? (
            <Card title="Bancada no Congresso" className="gap-4">
              {party.bancadas.map((bancada) => (
                <BancadaRows key={bancada.casa} bancada={bancada} year={year} />
              ))}
            </Card>
          ) : null}

          {party && party.lideres.length > 0 ? (
            <LeadershipCard leaders={party.lideres} />
          ) : null}

          {party?.financas ? <FinancesCard finances={party.financas} /> : null}

          {members.length > 0 ? (
            <Section
              title={`Parlamentares em exercício (${formatNumber(members.length)})`}
            />
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <View className="pb-2">
          <ParlamentarCard
            parlamentar={item}
            showRole
            onPress={() => router.push(routes.parlamentar(item))}
          />
        </View>
      )}
    />
  )
}

type PartyHeaderProps = { sigla: string; party: PartidoResumo | undefined }

const PartyHeader = ({ sigla, party }: PartyHeaderProps) => {
  const color = getPartyColor(sigla)

  return (
    <View className="items-center gap-2">
      <View
        className="rounded-xl px-4 py-2"
        style={{ backgroundColor: color }}
        accessibilityLabel={`Partido ${sigla}`}
      >
        <Text
          className="font-title text-2xl"
          style={{ color: getContrastTextColor(color) }}
        >
          {sigla}
        </Text>
      </View>
      {party && party.nome !== party.sigla ? (
        <Text className="text-center text-sm text-muted-foreground">
          {party.nome}
        </Text>
      ) : null}
    </View>
  )
}

const VISIBLE_LEADERS = 5

/** O líder vem primeiro; a fila de vice-líderes fica atrás do "Ver mais". */
const LeadershipCard = ({ leaders }: { leaders: LiderPartido[] }) => {
  const [expanded, setExpanded] = useState(false)

  const visible = expanded ? leaders : leaders.slice(0, VISIBLE_LEADERS)
  const hiddenCount = leaders.length - visible.length

  return (
    <Card
      title="Liderança na Câmara"
      description="O Senado não publica a lista equivalente em dados abertos"
      className="gap-2"
    >
      {visible.map((leader) => (
        <DetailRow key={leader.id} label={leader.titulo} value={leader.nome} />
      ))}

      {hiddenCount > 0 ? (
        <Button size="sm" variant="ghost" onPress={() => setExpanded(true)}>
          {`Ver mais ${hiddenCount}`}
        </Button>
      ) : null}
    </Card>
  )
}

type BancadaRowsProps = { bancada: BancadaPartido; year: number | undefined }

const BancadaRows = ({ bancada, year }: BancadaRowsProps) => (
  <View className="gap-2">
    <Text className="text-sm font-semibold text-foreground">
      {CASA_LABEL[bancada.casa]}
    </Text>
    <DetailRow label="Membros" value={formatNumber(bancada.membros)} />
    <DetailRow
      label={year ? `Gasto da bancada em ${year}` : "Gasto da bancada"}
      value={formatCurrencyCompact(bancada.gastoTotal)}
    />
    <DetailRow
      label="Gasto mediano por parlamentar"
      value={formatCurrencyCompact(bancada.gastoMediano)}
    />
    <DetailRow
      label="Participação mediana nas votações"
      value={
        bancada.participacaoMediana !== null
          ? formatPercent(bancada.participacaoMediana, 0)
          : null
      }
    />
  </View>
)

type FinancesCardProps = { finances: FinancasPartido }

const FinancesCard = ({ finances }: FinancesCardProps) => (
  <Card
    title={`Receitas em ${finances.ano}`}
    description="Declaradas ao TSE pelo diretório nacional"
    className="gap-4"
  >
    <Card.Highlight
      value={formatCurrency(finances.total)}
      context="recebido no ano"
    />

    <View className="gap-2">
      <DetailRow
        label="Dinheiro público (fundos)"
        value={formatCurrency(finances.fundos)}
      />
      <DetailRow
        label="Doações e outros recursos"
        value={formatCurrency(finances.demais)}
      />
    </View>

    {finances.topDoadores.length > 0 ? (
      <View className="gap-2">
        <Text className="text-sm font-semibold text-foreground">
          Maiores doadores
        </Text>
        {finances.topDoadores.map((donor) => (
          <DetailRow
            key={donor.documento ?? donor.nome}
            label={toProperCase(donor.nome)}
            value={formatCurrencyCompact(donor.valor)}
          />
        ))}
      </View>
    ) : null}

    <Text className="text-xs text-muted-foreground">
      O dinheiro público vem das cotas do Fundo Partidário repassadas pelo
      TSE. A lista de doadores cobre só as receitas fora dos fundos, na
      esfera nacional do partido.
    </Text>

    <SourceLink label="Prestação de contas no TSE" url={finances.fonteUrl} />
  </Card>
)
