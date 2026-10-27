import {
  FONTE_COTA,
  type FornecedorDaCota,
  type LancamentoDestaque,
  type ParlamentarRef,
} from "@politicapp/data"
import { Pressable, Text, View } from "react-native"

import { Card } from "@/components/card"
import { DetailRow } from "@/components/detail-row"
import { SourceLink } from "@/components/source-link"
import { useParlamentarCotaSuppliers } from "@/hooks/use-static-data"
import { formatDate } from "@/utils/date-utils"
import { formatCurrency, formatNumber, formatPercent } from "@/utils/formatters"
import { openUrl } from "@/utils/links"
import { toProperCase } from "@/utils/text"

import { ExpandableList } from "./expandable-list"

type Props = { parlamentar: ParlamentarRef }

/**
 * Para quem a cota foi paga. Complementa o gasto por tipo: dois parlamentares
 * com o mesmo total podem ter espalhado o dinheiro ou concentrado num só
 * fornecedor.
 */
export const CotaSuppliersCard = ({ parlamentar }: Props) => {
  const { data } = useParlamentarCotaSuppliers(parlamentar)

  if (!data || data.principais.length === 0) return null

  return (
    <Card
      title="Para quem foi a cota"
      description={`${formatNumber(data.quantidade)} fornecedores em ${data.ano}`}
      className="gap-4"
    >
      {data.quantidade > 3 ? (
        <Card.Highlight
          value={formatPercent(data.concentracaoTop3 * 100, 0)}
          context="do total foi para os três maiores fornecedores"
        />
      ) : null}

      <View className="gap-1">
        <ExpandableList
          items={data.principais}
          initialCount={5}
          keyExtractor={(supplier, index) => `${supplier.documento ?? supplier.nome}-${index}`}
          renderItem={(supplier) => <SupplierRow supplier={supplier} />}
        />
      </View>

      <View className="gap-2">
        {data.glosado !== null && data.glosado > 0 ? (
          <DetailRow label="Recusado pela Câmara (glosa)" value={formatCurrency(data.glosado)} />
        ) : null}
        {data.pessoaFisica.lancamentos > 0 ? (
          <DetailRow
            label={`Pago a pessoas físicas (${formatNumber(data.pessoaFisica.lancamentos)})`}
            value={formatCurrency(data.pessoaFisica.valor)}
          />
        ) : null}
      </View>

      {data.maioresLancamentos.length > 0 ? (
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Maiores notas do ano</Text>
          {data.maioresLancamentos.map((lancamento, index) => (
            <ReceiptRow key={index} lancamento={lancamento} />
          ))}
        </View>
      ) : null}

      <Text className="text-[11px] text-muted-foreground">
        Fornecedor exclusivo é aquele que nenhum outro parlamentar da casa pagou
        no ano — é permitido e comum (aluguel de escritório, por exemplo). Nome e
        CPF de pessoas físicas não são exibidos.
      </Text>

      <SourceLink label="Cota parlamentar — dados oficiais" url={FONTE_COTA[parlamentar.casa]} />
    </Card>
  )
}

const SupplierRow = ({ supplier }: { supplier: FornecedorDaCota }) => (
  <View className="flex-row items-baseline justify-between gap-4 py-3">
    <View className="flex-1 gap-1">
      <Text className="text-sm font-semibold text-foreground">{toProperCase(supplier.nome)}</Text>
      <Text className="text-xs text-muted-foreground">
        {formatNumber(supplier.lancamentos)} {supplier.lancamentos === 1 ? "nota" : "notas"}
        {supplier.exclusivo ? " · exclusivo" : ""}
      </Text>
    </View>
    <View className="items-end gap-1">
      <Text className="text-sm text-foreground">{formatCurrency(supplier.total)}</Text>
      <Text className="text-xs text-muted-foreground">{formatPercent(supplier.fracao * 100, 0)}</Text>
    </View>
  </View>
)

const ReceiptRow = ({ lancamento }: { lancamento: LancamentoDestaque }) => {
  const content = (
    <View className="flex-row items-baseline justify-between gap-4">
      <View className="flex-1 gap-1">
        <Text className="text-sm text-foreground" numberOfLines={1}>
          {toProperCase(lancamento.fornecedor)}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {lancamento.tipo}
          {lancamento.data ? ` · ${formatDate(lancamento.data)}` : ""}
          {lancamento.documentoUrl ? " · ver nota" : ""}
        </Text>
      </View>
      <Text className="text-sm text-foreground">{formatCurrency(lancamento.valor)}</Text>
    </View>
  )

  if (!lancamento.documentoUrl) return content
  const url = lancamento.documentoUrl
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Abrir nota de ${formatCurrency(lancamento.valor)} de ${lancamento.fornecedor}`}
      onPress={() => openUrl(url)}
    >
      {content}
    </Pressable>
  )
}
