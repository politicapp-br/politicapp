import {
  CARGOS_NO_TETO,
  FONTE_SUBSIDIOS_ESTADUAIS,
  FONTE_TETO,
  nomeDaUf,
  SUBSIDIOS_GOVERNADORES,
  TETO_CONSTITUCIONAL,
  type Congresso,
  type SubsidioExecutivo,
} from "@politicapp/data"
import { Text, View } from "react-native"

import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/card"
import { ProgressBar } from "@/components/charts"
import { DetailRow } from "@/components/detail-row"
import { SourceLink } from "@/components/source-link"
import { Section } from "@/components/section"
import { Screen } from "@/components/screen"
import { useColors } from "@/hooks/use-colors"
import { useCompensation } from "@/hooks/use-static-data"
import { formatDate, formatMonthYearLong } from "@/utils/date-utils"
import {
  formatNumber,
  formatCurrency,
  formatCurrencyCompact,
} from "@/utils/formatters"

const sortedGovernors = [...SUBSIDIOS_GOVERNADORES].sort(
  (a, b) => b.subsidio - a.subsidio,
)

export default function SalariesScreen() {
  return (
    <Screen>
      <Screen.TopBar />

      <Screen.Scroll>
        <PageHeader
          className="p-0"
          title="Quem ganha quanto"
          subtitle="O salário de cada cargo público, e o teto que nenhum deles pode passar."
        />

        <Card title="O teto do funcionalismo federal">
          <Card.Highlight value={formatCurrency(TETO_CONSTITUCIONAL)} />

          <Text className="text-sm text-muted-foreground">
            Desde fevereiro de 2025 estes cargos estão todos fixados exatamente
            neste valor:
          </Text>

          <View className="gap-1">
            {CARGOS_NO_TETO.map((cargo) => (
              <Text key={cargo} className="text-sm text-foreground">
                · {cargo}
              </Text>
            ))}
          </View>

          <SourceLink label="Reajuste aprovado pela Câmara" url={FONTE_TETO} />
        </Card>

        <CongressCost />

        <Section
          title="Governadores"
          description={`Cada estado fixa o subsídio do seu governador por lei da assembleia, sempre abaixo do teto federal. Não existe fonte nacional que reúna os 27 — os valores abaixo vêm de um levantamento jornalístico de ${formatDate(FONTE_SUBSIDIOS_ESTADUAIS.apuradoEm)}, e o dado oficial de cada estado é a lei estadual em vigor.`}
        >
          <Card className="gap-0 overflow-hidden p-0">
            {sortedGovernors.map((governor, index) => (
              <GovernorRow
                key={governor.uf}
                governor={governor}
                isFirst={index === 0}
              />
            ))}
          </Card>

          <SourceLink
            label={`Levantamento do ${FONTE_SUBSIDIOS_ESTADUAIS.veiculo}`}
            url={FONTE_SUBSIDIOS_ESTADUAIS.url}
          />
        </Section>
      </Screen.Scroll>
    </Screen>
  )
}

/**
 * O rótulo dos grupos vem cru da folha da Câmara — a tradução é só de exibição.
 */
const GROUP_LABELS: Record<string, string> = {
  "Quadro Efetivo - RJU": "Servidores efetivos",
  "Secretário Parlamentar": "Secretários parlamentares",
  Inativos: "Servidores aposentados",
  "Cargo de Natureza Especial": "Cargos de confiança",
  "Pensão Civil": "Pensões de servidores",
  "Pensão Parlamentar": "Pensões de ex-deputados",
  Parlamentar: "Deputados (subsídio)",
  "Aposentadoria Parlamentar": "Ex-deputados aposentados",
  Estagiários: "Estagiários",
}

const CongressCost = () => {
  const { data } = useCompensation()
  const congress = data?.congresso

  if (!congress) return null

  const { orcamentoSenado: senateBudget, folhaCamara: chamberPayroll } =
    congress

  return (
    <Section
      title="Quanto custa o Congresso"
      description="Não é só salário de parlamentar: as duas casas mantêm servidores, gabinetes, aposentadorias e pensões."
    >
      {senateBudget ? <SenateBudget budget={senateBudget} /> : null}
      {chamberPayroll ? (
        <>
          <ChamberPayroll payroll={chamberPayroll} />
          <AfterTerm payroll={chamberPayroll} />
        </>
      ) : null}
    </Section>
  )
}

type SenateBudgetProps = {
  budget: NonNullable<Congresso["orcamentoSenado"]>
}

const SenateBudget = ({ budget }: SenateBudgetProps) => {
  const { brandColor, muted } = useColors()

  const series = budget.serie.slice(-10)
  const closedYears = series.slice(0, -1)
  const lastClosed = closedYears[closedYears.length - 1]
  if (!lastClosed) return null

  const max = Math.max(...series.map((item) => item.pago))
  const personnelShare = lastClosed.pessoal / lastClosed.pago

  return (
    <Card title="Senado Federal" meta="execução do orçamento">
      <Card.Highlight
        value={formatCurrencyCompact(lastClosed.pago)}
        context={`pagos em ${lastClosed.ano} — ${Math.round(personnelShare * 100)}% com pessoal e encargos`}
      />

      <View
        className="h-24 flex-row items-end gap-1"
        accessible
        accessibilityLabel={`Despesa paga por ano: ${series
          .map((item) => `${item.ano} ${formatCurrencyCompact(item.pago)}`)
          .join(", ")}`}
      >
        {series.map((item, index) => {
          const isPartial = index === series.length - 1
          return (
            <View key={item.ano} className="flex-1 items-center gap-1">
              <View
                className="w-full rounded-t"
                style={{
                  height: max === 0 ? 2 : Math.max((item.pago / max) * 72, 2),
                  backgroundColor: isPartial ? muted : brandColor,
                }}
              />
              <Text className="text-[10px] text-muted-foreground">
                {String(item.ano).slice(2)}
              </Text>
            </View>
          )
        })}
      </View>

      <Text className="text-xs text-muted-foreground">
        O último ano é parcial, pago até agora. Valores nominais, sem correção
        pela inflação.
      </Text>

      <SourceLink
        label="Execução orçamentária — dados abertos do Senado"
        url={budget.fonteUrl}
      />
    </Card>
  )
}

type PayrollProps = { payroll: NonNullable<Congresso["folhaCamara"]> }

const ChamberPayroll = ({ payroll }: PayrollProps) => {
  const totalPayroll = payroll.grupos.reduce(
    (total, group) => total + group.massaMensal,
    0,
  )

  return (
    <Card
      title="Câmara dos Deputados"
      meta={`folha de ${formatMonthYearLong(payroll.ano, payroll.mes)}`}
    >
      <Card.Highlight
        value={formatCurrencyCompact(totalPayroll)}
        context="de folha bruta no mês, entre ativos, aposentados e pensões"
      />

      <View className="gap-2">
        {payroll.grupos.map((group) => (
          <DetailRow
            key={group.grupo}
            label={`${GROUP_LABELS[group.grupo] ?? group.grupo} (${formatNumber(group.quantidade)})`}
            value={formatCurrencyCompact(group.massaMensal)}
          />
        ))}
      </View>

      <Text className="text-xs text-muted-foreground">
        Cada gabinete tem em média{" "}
        {formatNumber(Math.round(payroll.secretarios.mediaPorGabinete))}{" "}
        secretários parlamentares, com salário mediano de{" "}
        {formatCurrency(payroll.secretarios.salarioMediano)}.
      </Text>

      <SourceLink label="Folha consolidada da Câmara" url={payroll.fonteUrl} />
    </Card>
  )
}

const AfterTerm = ({ payroll }: PayrollProps) => {
  const { aposentadoriaParlamentar: retirement, pensaoParlamentar: pension } =
    payroll
  const monthlyTotal = retirement.totalMensal + pension.totalMensal

  if (monthlyTotal === 0) return null

  return (
    <Card title="Depois do mandato">
      <Card.Highlight
        value={formatCurrencyCompact(monthlyTotal)}
        context="por mês em aposentadorias e pensões de ex-deputados"
      />

      <View className="gap-2">
        <DetailRow
          label={`Ex-deputados aposentados (${formatNumber(retirement.beneficiarios)})`}
          value={formatCurrencyCompact(retirement.totalMensal)}
        />
        <DetailRow
          label="Aposentadoria mediana"
          value={formatCurrency(retirement.medianaMensal)}
        />
        <DetailRow
          label={`Pensões a dependentes (${formatNumber(pension.beneficiarios)})`}
          value={formatCurrencyCompact(pension.totalMensal)}
        />
      </View>

      <Text className="text-xs text-muted-foreground">
        O regime que aposentava deputados (IPC) foi extinto em 1997; quem já
        contribuía manteve o direito. Não existe aposentadoria parlamentar para
        mandatos novos.
      </Text>

      <SourceLink label="Folha consolidada da Câmara" url={payroll.fonteUrl} />
    </Card>
  )
}

type GovernorRowProps = { governor: SubsidioExecutivo; isFirst: boolean }

const GovernorRow = ({ governor, isFirst }: GovernorRowProps) => {
  const { brandColor } = useColors()
  const ratio = governor.subsidio / TETO_CONSTITUCIONAL
  const stateName = nomeDaUf(governor.uf)

  return (
    <View className={isFirst ? "gap-2 p-4" : "gap-2 border-t border-border p-4"}>
      <View className="flex-row items-baseline justify-between gap-3">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground">
            {stateName}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {governor.titular} · {governor.partido}
          </Text>
        </View>
        <Text className="text-sm text-foreground">
          {formatCurrency(governor.subsidio)}
        </Text>
      </View>

      <ProgressBar
        className="h-1.5"
        value={ratio * 100}
        color={brandColor}
        accessibilityLabel={`${stateName}: ${formatCurrency(governor.subsidio)}, ${Math.round(ratio * 100)}% do teto`}
        accessibilityValue={{
          min: 0,
          max: Math.round(TETO_CONSTITUCIONAL),
          now: Math.round(governor.subsidio),
        }}
      />

      {governor.observacao ? (
        <Text className="text-xs text-muted-foreground">
          {governor.observacao}
        </Text>
      ) : null}
    </View>
  )
}
