import {
  FONTE_CEIS,
  type FornecedorSancionado,
  type ParlamentarRef,
} from "@politicapp/data"
import { Text, View } from "react-native"

import { Card } from "@/components/card"
import { SourceLink } from "@/components/source-link"
import { useParlamentarSanctions } from "@/hooks/use-static-data"
import { formatDate } from "@/utils/date-utils"
import { formatCurrency } from "@/utils/formatters"
import { toProperCase } from "@/utils/text"

import { ExpandableList } from "./expandable-list"

type Props = { parlamentar: ParlamentarRef }

export const SanctionedSuppliersCard = ({ parlamentar }: Props) => {
  const { year, data } = useParlamentarSanctions(parlamentar)

  if (!data || data.length === 0) return null

  return (
    <Card
      title="Fornecedores com sanção ativa"
      description={
        year
          ? `Pagos com a cota em ${year} e hoje impedidos de contratar`
          : "Pagos com a cota e hoje impedidos de contratar"
      }
      className="gap-4"
    >
      <View className="gap-1">
        <ExpandableList
          items={data}
          // CPF mascarado pode repetir entre duas pessoas.
          keyExtractor={(supplier, index) => `${supplier.cnpjCpf}-${index}`}
          renderItem={(supplier) => <SupplierRow supplier={supplier} />}
        />
      </View>

      <Text className="text-xs text-muted-foreground">
        O CEIS é o cadastro federal de empresas e pessoas sancionadas — a
        sanção é do fornecedor, não do parlamentar, e pode ter começado depois
        da contratação. O registro mostra que a cota pagou alguém que está
        hoje impedido de contratar com o poder público.
      </Text>

      <SourceLink label="CEIS no Portal da Transparência" url={FONTE_CEIS} />
    </Card>
  )
}

type SupplierRowProps = { supplier: FornecedorSancionado }

const SupplierRow = ({ supplier }: SupplierRowProps) => (
  <View className="gap-1 py-3">
    <View className="flex-row items-baseline justify-between gap-4">
      <Text className="flex-1 text-sm font-semibold text-foreground">
        {toProperCase(supplier.nome)}
      </Text>
      <Text className="text-sm text-foreground">
        {formatCurrency(supplier.totalGasto)}
      </Text>
    </View>

    {supplier.sancoes.map((sanction, index) => (
      <Text key={index} className="text-xs text-muted-foreground">
        {sanction.categoria}
        {sanction.orgao ? ` — ${sanction.orgao}` : ""}
        {sanction.inicio ? ` · desde ${formatDate(sanction.inicio)}` : ""}
        {sanction.fim ? ` · até ${formatDate(sanction.fim)}` : ""}
      </Text>
    ))}
  </View>
)
