import type { ParlamentarRef } from "@politicapp/data"
import { Text } from "react-native"

import { Card } from "@/components/card"
import { ProgressBar } from "@/components/charts"
import { useColors } from "@/hooks/use-colors"
import { useParlamentarAlignment } from "@/hooks/use-static-data"
import { formatNumber, formatPercent } from "@/utils/formatters"

/** Com menos votações que isso o percentual vira loteria, melhor não afirmar nada. */
const MIN_VOTACOES = 5

type Props = { parlamentar: ParlamentarRef }

/**
 * Quanto o parlamentar vota com a maioria do próprio partido — a ponte entre
 * o indivíduo e o comportamento coletivo da bancada.
 */
export const PartyAlignmentCard = ({ parlamentar }: Props) => {
  const { brandColor } = useColors()
  const { data, year } = useParlamentarAlignment(parlamentar)

  if (!data || data.votacoes < MIN_VOTACOES) return null

  const percent = Math.round((100 * data.comPartido) / data.votacoes)

  return (
    <Card title="Alinhamento com o partido">
      <Card.Highlight
        value={formatPercent(percent, 0)}
        context={`votou com a maioria do ${data.partido} em ${formatNumber(data.comPartido)} de ${formatNumber(data.votacoes)} votações${year ? ` de ${year}` : ""}`}
      />

      <ProgressBar
        value={percent}
        color={brandColor}
        accessibilityLabel={`Alinhamento com o partido: ${formatPercent(percent, 0)}`}
      />

      <Text className="text-[11px] text-muted-foreground">
        Considera só os votos sim/não em votações nominais em que a bancada
        tinha posição definida. Votar diferente do partido não é, por si só,
        bom nem ruim — é informação.
      </Text>
    </Card>
  )
}
