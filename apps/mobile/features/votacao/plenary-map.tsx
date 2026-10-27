import {
  agruparVotosPor,
  type GrupoDeVotos,
  type Voto,
} from "@politicapp/data"
import { useMemo } from "react"

import { Card } from "@/components/card"
import { ChartLegend, Hemicycle, type SeatGroup } from "@/components/charts"
import { useColors } from "@/hooks/use-colors"
import { formatNumber } from "@/utils/formatters"

type Props = { votos: Voto[] }

const yesShare = ({ placar }: GrupoDeVotos) => {
  const decisive = placar.sim + placar.nao
  return decisive === 0 ? 0.5 : placar.sim / decisive
}

/**
 * Hemicycle da votação: cada assento é o voto de um parlamentar, bancadas
 * ficam contíguas e os partidos mais favoráveis ocupam a ponta esquerda.
 * Dentro de cada bancada os votos se agrupam por cor (sim → outros → não).
 */
export const PlenaryMap = ({ votos }: Props) => {
  const { successColor, dangerColor, muted } = useColors()

  const seatGroups = useMemo(() => {
    const bancadas = agruparVotosPor(votos, "partido").sort(
      (a, b) =>
        yesShare(b) - yesShare(a) || a.grupo.localeCompare(b.grupo, "pt-BR"),
    )

    return bancadas.flatMap((bancada): SeatGroup[] => {
      const { sim, nao } = bancada.placar
      const others = bancada.total - sim - nao
      return [
        { key: `${bancada.grupo}:sim`, count: sim, color: successColor },
        { key: `${bancada.grupo}:resto`, count: others, color: muted },
        { key: `${bancada.grupo}:nao`, count: nao, color: dangerColor },
      ].filter((group) => group.count > 0)
    })
  }, [votos, successColor, dangerColor, muted])

  const total = votos.length
  if (total === 0) return null

  return (
    <Card
      title="Mapa do plenário"
      description="Cada ponto é um parlamentar; bancadas do mesmo partido ficam juntas"
    >
      <Hemicycle
        groups={seatGroups}
        accessibilityLabel={`Mapa do plenário com ${formatNumber(total)} parlamentares, agrupados por partido e coloridos pelo voto`}
      />

      <ChartLegend
        items={[
          { label: "Sim", color: successColor },
          { label: "Não", color: dangerColor },
          { label: "Abstenção ou ausência", color: muted },
        ]}
      />
    </Card>
  )
}
