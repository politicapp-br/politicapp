import {
  MORADIA_LABEL,
  type Moradia,
  type ParlamentarRef,
  type Subsidio,
} from "@politicapp/data"
import { Text, View } from "react-native"

import { Card } from "@/components/card"
import { DetailRow } from "@/components/detail-row"
import { SourceLink } from "@/components/source-link"
import { useParlamentarCost } from "@/hooks/use-static-data"
import { formatMonthYearLong } from "@/utils/date-utils"
import { formatNumber, formatCurrency } from "@/utils/formatters"

type Props = { parlamentar: ParlamentarRef }

export const CompensationCard = ({ parlamentar }: Props) => {
  const { salary, year, data: cost } = useParlamentarCost(parlamentar)

  if (!salary) return null

  return (
    <Card title="Quanto ganha" className="gap-4">
      <Card.Highlight
        value={formatCurrency(salary.bruto)}
        context="por mês, antes dos descontos"
      />

      <Text className="text-xs text-muted-foreground">
        O subsídio é do cargo, não da pessoa: os 513 deputados e os 81 senadores
        recebem exatamente este valor, que é o teto do funcionalismo federal.
      </Text>

      <Payslip salary={salary} casa={parlamentar.casa} />

      {cost?.moradia ? <Housing housing={cost.moradia} year={year} /> : null}

      <SourceLink
        label={`Folha da Câmara de ${formatMonthYearLong(salary.ano, salary.mes)}`}
        url={salary.fonteUrl}
      />
    </Card>
  )
}

type PayslipProps = { salary: Subsidio; casa: ParlamentarRef["casa"] }

const Payslip = ({ salary, casa }: PayslipProps) => (
  <View className="gap-2">
    <DetailRow label="Bruto" value={formatCurrency(salary.bruto)} />
    <DetailRow
      label="Previdência"
      value={`− ${formatCurrency(salary.previdencia)}`}
    />
    <DetailRow
      label="Imposto de renda"
      value={`− ${formatCurrency(salary.impostoRenda)}`}
    />
    <View className="border-t border-border pt-2">
      <DetailRow
        emphasized
        label="Cai na conta"
        value={formatCurrency(salary.liquido)}
      />
    </View>
    <Text className="text-xs text-muted-foreground">
      Este foi o líquido de {formatNumber(salary.parlamentaresComEsseLiquido)}{" "}
      dos {formatNumber(salary.parlamentaresNaFolha)} contracheques de mês
      cheio — os descontos mudam conforme dependentes e regime de previdência
      de cada um.
      {casa === "senado"
        ? " O Senado não publica folha equivalente; os descontos acima vêm da folha da Câmara, e o subsídio é o mesmo por lei."
        : ""}
    </Text>
  </View>
)

type HousingProps = { housing: Moradia; year?: number }

const Housing = ({ housing, year }: HousingProps) => (
  <View className="gap-2 border-t border-border pt-4">
    <DetailRow
      emphasized
      label="Moradia em Brasília"
      value={MORADIA_LABEL[housing.tipo]}
    />

    {housing.diasEmImovelFuncional ? (
      <DetailRow
        label={year ? `Dias em imóvel funcional em ${year}` : "Dias em imóvel"}
        value={formatNumber(housing.diasEmImovelFuncional)}
      />
    ) : null}

    {housing.auxilioRecebido ? (
      <DetailRow
        label={year ? `Auxílio recebido em ${year}` : "Auxílio recebido"}
        value={formatCurrency(housing.auxilioRecebido)}
      />
    ) : null}

    {housing.complementoComCota ? (
      <DetailRow
        label="Aluguel pago com a cota"
        value={formatCurrency(housing.complementoComCota)}
      />
    ) : null}
  </View>
)
