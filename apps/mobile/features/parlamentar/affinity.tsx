import {
  FONTE_DADOS_ABERTOS,
  type ParlamentarParecido,
  type ParlamentarRef,
} from "@politicapp/data"
import { useRouter } from "expo-router"
import { Pressable, Text, View } from "react-native"

import { Card } from "@/components/card"
import { SourceLink } from "@/components/source-link"
import { ProgressBar } from "@/components/charts"
import { useColors } from "@/hooks/use-colors"
import { useParlamentarAffinity } from "@/hooks/use-static-data"
import { formatNumber, formatPercent } from "@/utils/formatters"
import { routes } from "@/utils/routes"

/** Mesmo piso do alinhamento com o partido: abaixo disso o percentual é loteria. */
const MIN_VOTACOES = 5

type Props = { parlamentar: ParlamentarRef }

/**
 * Com quem o parlamentar vota, de qualquer partido, e quanto acompanha o
 * governo. Mostra alianças que a sigla não revela.
 */
export const AffinityCard = ({ parlamentar }: Props) => {
  const { brandColor } = useColors()
  const { data } = useParlamentarAffinity(parlamentar)

  if (!data || data.votacoes < MIN_VOTACOES) return null

  const governo =
    data.governo && data.governo.votacoes >= MIN_VOTACOES
      ? Math.round((100 * data.governo.comGoverno) / data.governo.votacoes)
      : null

  return (
    <Card
      title="Com quem vota"
      description={`${formatNumber(data.votacoes)} votações nominais de ${data.ano}`}
      className="gap-4"
    >
      {governo !== null && data.governo ? (
        <View className="gap-2">
          <Card.Highlight
            value={formatPercent(governo, 0)}
            context={`votou como orientou o governo em ${formatNumber(data.governo.comGoverno)} de ${formatNumber(data.governo.votacoes)} votações`}
          />
          <ProgressBar
            value={governo}
            color={brandColor}
            accessibilityLabel={`Votou com a orientação do governo em ${formatPercent(governo, 0)} das votações`}
          />
        </View>
      ) : null}

      {data.parecidos.length > 0 ? (
        <PeerList title="Votam mais parecido" peers={data.parecidos} />
      ) : null}
      {data.distantes.length > 0 ? (
        <PeerList title="Votam mais diferente" peers={data.distantes} />
      ) : null}

      <Text className="text-[11px] text-muted-foreground">
        Conta só votos sim e não nas votações em que os dois votaram.
        {parlamentar.casa === "senado"
          ? " No Senado a maior parte das votações é secreta e fica de fora."
          : ""}
      </Text>
      <SourceLink label="Votações nos dados abertos" url={FONTE_DADOS_ABERTOS[parlamentar.casa]} />
    </Card>
  )
}

const PeerList = ({ title, peers }: { title: string; peers: ParlamentarParecido[] }) => {
  const router = useRouter()
  return (
    <View className="gap-1">
      <Text className="text-sm font-semibold text-foreground">{title}</Text>
      {peers.map((peer) => (
        <Pressable
          key={`${peer.casa}:${peer.id}`}
          accessibilityRole="link"
          onPress={() => router.push(routes.parlamentar(peer))}
          className="flex-row items-baseline justify-between gap-4 py-2"
        >
          <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
            {peer.nome}
            <Text className="text-xs text-muted-foreground">{` · ${peer.partido}-${peer.uf}`}</Text>
          </Text>
          <Text className="text-sm text-foreground">
            {formatPercent(peer.concordancia * 100, 0)}
            <Text className="text-xs text-muted-foreground">{` em ${formatNumber(peer.votacoes)}`}</Text>
          </Text>
        </Pressable>
      ))}
    </View>
  )
}
