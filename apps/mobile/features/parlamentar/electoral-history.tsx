import {
  FONTE_TSE_DADOS_ABERTOS,
  RESULTADO_ELEITORAL_LABEL,
  type CandidaturaTse,
  type ParlamentarRef,
  type ResultadoEleitoral,
} from "@politicapp/data"
import { Chip } from "heroui-native"
import { Text, View } from "react-native"

import { Card } from "@/components/card"
import { SourceLink } from "@/components/source-link"
import { useParlamentarElections } from "@/hooks/use-static-data"
import { formatCurrencyCompact, formatNumber } from "@/utils/formatters"

const RESULTADO_COLOR: Record<ResultadoEleitoral, "success" | "danger" | "warning" | "default"> = {
  eleito: "success",
  "segundo-turno": "warning",
  suplente: "default",
  "nao-eleito": "danger",
  pendente: "default",
}

type Props = { parlamentar: ParlamentarRef }

/** Disputas no TSE, com votos e o patrimônio declarado em cada uma. */
export const ElectoralHistoryCard = ({ parlamentar }: Props) => {
  const { data } = useParlamentarElections(parlamentar)

  if (!data || data.length === 0) return null

  return (
    <Card title="Eleições" description="Candidaturas registradas no TSE" className="gap-2">
      {data.map((candidatura, index) => (
        <CandidaturaRow key={`${candidatura.ano}-${candidatura.cargo}-${index}`} candidatura={candidatura} />
      ))}

      <Text className="text-[11px] text-muted-foreground">
        Patrimônio é o total de bens que a própria pessoa declarou ao registrar a
        candidatura. Candidaturas são ligadas ao parlamentar por CPF na Câmara e
        por nome e UF no Senado, então alguma pode faltar.
      </Text>
      <SourceLink label="Dados abertos do TSE" url={FONTE_TSE_DADOS_ABERTOS} />
    </Card>
  )
}

const CandidaturaRow = ({ candidatura }: { candidatura: CandidaturaTse }) => (
  <View className="gap-1 border-b border-border py-3">
    <View className="flex-row items-center justify-between gap-2">
      <Text className="flex-1 text-sm font-semibold text-foreground">
        {`${candidatura.ano} · ${candidatura.cargo}`}
      </Text>
      <Chip size="sm" color={RESULTADO_COLOR[candidatura.resultado]}>
        {RESULTADO_ELEITORAL_LABEL[candidatura.resultado]}
      </Chip>
    </View>
    <Text className="text-xs text-muted-foreground">
      {[
        candidatura.uf,
        candidatura.partido,
        candidatura.votos !== null ? `${formatNumber(candidatura.votos)} votos` : null,
        candidatura.patrimonio !== null
          ? `patrimônio ${formatCurrencyCompact(candidatura.patrimonio)}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")}
    </Text>
  </View>
)
