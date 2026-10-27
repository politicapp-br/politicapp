import {
  FONTE_DADOS_ABERTOS,
  type ParlamentarRef,
  type VotoApertado,
  type VotoContraPartido,
} from "@politicapp/data"
import { useRouter } from "expo-router"
import { Pressable, Text, View } from "react-native"

import { Card } from "@/components/card"
import { SourceLink } from "@/components/source-link"
import { useParlamentarAffinity } from "@/hooks/use-static-data"
import { formatDate } from "@/utils/date-utils"
import { formatNumber } from "@/utils/formatters"
import { routes } from "@/utils/routes"

const LADO = { sim: "Sim", nao: "Não" } as const

type Props = { parlamentar: ParlamentarRef }

/**
 * As votações em que o parlamentar contrariou a maioria do partido e as que
 * foram decididas por poucos votos — onde o voto individual mais pesou.
 */
export const PartyDissentCard = ({ parlamentar }: Props) => {
  const { data } = useParlamentarAffinity(parlamentar)

  if (!data || (data.contraPartido.total === 0 && data.apertadas.length === 0)) return null

  return (
    <Card title="Votos que se destacam" className="gap-4">
      {data.contraPartido.total > 0 ? (
        <View className="gap-1">
          <Text className="text-sm font-semibold text-foreground">
            {`Contra a maioria do partido: ${formatNumber(data.contraPartido.total)} ${data.contraPartido.total === 1 ? "vez" : "vezes"} em ${data.ano}`}
          </Text>
          {data.contraPartido.recentes.map((voto) => (
            <VotacaoRow
              key={voto.votacaoId}
              parlamentar={parlamentar}
              votacao={voto}
              detail={`Votou ${LADO[voto.voto]}; o partido, ${LADO[voto.partido]}`}
            />
          ))}
        </View>
      ) : null}

      {data.apertadas.length > 0 ? (
        <View className="gap-1">
          <Text className="text-sm font-semibold text-foreground">Votações apertadas</Text>
          {data.apertadas.map((votacao) => (
            <VotacaoRow
              key={votacao.votacaoId}
              parlamentar={parlamentar}
              votacao={votacao}
              detail={closeVoteDetail(votacao)}
            />
          ))}
        </View>
      ) : null}

      <Text className="text-[11px] text-muted-foreground">
        Votar diferente do partido não é bom nem ruim por si só. Apertada é a
        votação decidida por até 5% dos votos sim e não.
      </Text>
      <SourceLink label="Votações nos dados abertos" url={FONTE_DADOS_ABERTOS[parlamentar.casa]} />
    </Card>
  )
}

const closeVoteDetail = (votacao: VotoApertado) => {
  const votos = `${formatNumber(votacao.margem)} ${votacao.margem === 1 ? "voto" : "votos"}`
  // "Rejeitada por N votos" seria falso numa PEC que teve mais sim que não
  // mas não alcançou o quórum — o resultado e a diferença vão separados.
  const resultado =
    votacao.aprovada === null
      ? `Diferença de ${votos}`
      : `${votacao.aprovada ? "Aprovada" : "Rejeitada"} · diferença de ${votos}`
  const voto = votacao.voto ? `votou ${LADO[votacao.voto]}` : "não votou sim nem não"
  return `${resultado} · ${voto}`
}

type RowProps = {
  parlamentar: ParlamentarRef
  votacao: Pick<VotoContraPartido, "votacaoId" | "data" | "descricao" | "proposicao">
  detail: string
}

const VotacaoRow = ({ parlamentar, votacao, detail }: RowProps) => {
  const router = useRouter()
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(routes.votacao(parlamentar.casa, votacao.votacaoId))}
      className="gap-1 py-2"
    >
      <View className="flex-row items-center gap-2">
        {votacao.proposicao ? (
          <Text className="text-xs font-semibold text-brand">{votacao.proposicao}</Text>
        ) : null}
        <Text className="text-xs text-muted-foreground">{formatDate(votacao.data)}</Text>
      </View>
      <Text className="text-sm leading-5 text-foreground" numberOfLines={2}>
        {votacao.descricao}
      </Text>
      <Text className="text-xs text-muted-foreground">{detail}</Text>
    </Pressable>
  )
}
