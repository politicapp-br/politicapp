import { totalDeRegistros, type Frequencia, type ParlamentarRef } from "@politicapp/data"
import { Text, View } from "react-native"

import { Card } from "@/components/card"
import { ProgressBar } from "@/components/charts"
import { SourceLink } from "@/components/source-link"
import { useColors } from "@/hooks/use-colors"
import { useParlamentarOfficialAttendance } from "@/hooks/use-static-data"
import { formatNumber, formatPercent } from "@/utils/formatters"

type Props = { parlamentar: ParlamentarRef }

/**
 * A frequência que a própria Câmara publica — conta sessões e reuniões, com
 * ou sem votação nominal, e separa a ausência justificada (licença médica,
 * missão oficial) da não justificada.
 */
export const OfficialAttendanceCard = ({ parlamentar }: Props) => {
  const { data } = useParlamentarOfficialAttendance(parlamentar)

  if (!data || (!data.plenario && !data.comissoes)) return null

  return (
    <Card title="Presença oficial" description={`Registro da Câmara em ${data.ano}`} className="gap-4">
      {data.plenario ? <FrequencyBlock title="Plenário" unit="dias" frequency={data.plenario} /> : null}
      {data.comissoes ? (
        <FrequencyBlock title="Comissões" unit="reuniões" frequency={data.comissoes} />
      ) : null}
      <SourceLink label="Perfil no portal da Câmara" url={data.fonteUrl} />
    </Card>
  )
}

type BlockProps = { title: string; unit: string; frequency: Frequencia }

const FrequencyBlock = ({ title, unit, frequency }: BlockProps) => {
  const { brandColor } = useColors()
  const total = totalDeRegistros(frequency)
  if (total === 0) return null
  const percent = (100 * frequency.presencas) / total

  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-sm font-semibold text-foreground">{title}</Text>
        <Text className="text-sm text-foreground">{formatPercent(percent, 0)}</Text>
      </View>
      <ProgressBar
        value={percent}
        color={brandColor}
        accessibilityLabel={`${title}: presente em ${formatPercent(percent, 0)} dos ${unit}`}
      />
      <Text className="text-xs text-muted-foreground">
        {`Presente em ${formatNumber(frequency.presencas)} de ${formatNumber(total)} ${unit}`}
        {frequency.ausenciasJustificadas > 0
          ? ` · ${formatNumber(frequency.ausenciasJustificadas)} ausências justificadas`
          : ""}
        {frequency.ausenciasNaoJustificadas > 0
          ? ` · ${formatNumber(frequency.ausenciasNaoJustificadas)} sem justificativa`
          : ""}
      </Text>
    </View>
  )
}
