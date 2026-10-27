import { FONTE_EMENDAS, type MunicipioDeVoto, type ParlamentarRef } from "@politicapp/data"
import { Text, View } from "react-native"

import { Card } from "@/components/card"
import { ProgressBar } from "@/components/charts"
import { SourceLink } from "@/components/source-link"
import { useColors } from "@/hooks/use-colors"
import { useParlamentarElectoralTerritory } from "@/hooks/use-static-data"
import { formatCurrencyCompact, formatNumber, formatPercent } from "@/utils/formatters"
import { toProperCase } from "@/utils/text"

import { ExpandableList } from "./expandable-list"

type Props = { parlamentar: ParlamentarRef }

/**
 * Onde o parlamentar foi votado e se as emendas dele vão para lá. A conta de
 * referência: os redutos deram metade dos votos; se as emendas seguissem os
 * votos, receberiam por volta de metade delas.
 */
export const ElectoralTerritoryCard = ({ parlamentar }: Props) => {
  const { brandColor } = useColors()
  const { data } = useParlamentarElectoralTerritory(parlamentar)

  if (!data || data.principais.length === 0) return null

  const { redutos } = data
  const emendasNosRedutos =
    redutos.fracaoDasEmendas === null ? null : Math.round(redutos.fracaoDasEmendas * 100)

  return (
    <Card
      title="Onde foi votado"
      description={`${formatNumber(data.totalVotos)} votos para ${data.cargo.toLowerCase()} em ${data.eleicao}, em ${formatNumber(data.municipiosComVoto)} municípios`}
      className="gap-4"
    >
      {emendasNosRedutos !== null ? (
        <View className="gap-2">
          <Card.Highlight
            value={formatPercent(emendasNosRedutos, 0)}
            context={`das emendas com município foi para os ${formatNumber(redutos.municipios)} ${redutos.municipios === 1 ? "município" : "municípios"} que lhe deram ${formatPercent(redutos.fracaoDosVotos * 100, 0)} dos votos`}
          />
          <ProgressBar
            value={emendasNosRedutos}
            color={brandColor}
            accessibilityLabel={`${formatPercent(emendasNosRedutos, 0)} das emendas foram para os municípios onde teve mais votos`}
          />
        </View>
      ) : null}

      <View className="gap-1">
        <ExpandableList
          items={data.principais}
          initialCount={5}
          keyExtractor={(municipio) => `${municipio.uf}-${municipio.municipio}`}
          renderItem={(municipio) => <MunicipioRow municipio={municipio} />}
        />
      </View>

      <Text className="text-[11px] text-muted-foreground">
        Votos do 1º turno, do TSE. Emendas empenhadas no mandato, do Portal da
        Transparência — só as que indicam o município; as estaduais e de
        destino múltiplo ficam de fora. Levar emenda a quem votou em você não é
        ilegal: o dado mostra para onde o dinheiro vai.
      </Text>
      <SourceLink label="Emendas no Portal da Transparência" url={FONTE_EMENDAS} />
    </Card>
  )
}

const MunicipioRow = ({ municipio }: { municipio: MunicipioDeVoto }) => (
  <View className="flex-row items-baseline justify-between gap-4 py-3">
    <View className="flex-1 gap-1">
      <Text className="text-sm text-foreground">
        {`${toProperCase(municipio.municipio)} (${municipio.uf})`}
      </Text>
      <Text className="text-xs text-muted-foreground">
        {`${formatNumber(municipio.votos)} votos · ${formatPercent(municipio.fracao * 100, 0)} do total`}
      </Text>
    </View>
    <Text className="text-sm text-foreground">
      {municipio.emendas > 0 ? formatCurrencyCompact(municipio.emendas) : "sem emenda"}
    </Text>
  </View>
)
