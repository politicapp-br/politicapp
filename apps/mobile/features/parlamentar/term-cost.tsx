import type {
  CustoAnual,
  MandatoParlamentar,
  ParlamentarRef,
  Subsidio,
} from "@politicapp/data"
import type { ReactNode } from "react"
import { Text, View } from "react-native"

import { Card } from "@/components/card"
import { DetailRow } from "@/components/detail-row"
import {
  useParlamentarCost,
  useParlamentarTerm,
  useCompensation,
  useExpenseSummary,
} from "@/hooks/use-static-data"
import { formatMonthYearLong } from "@/utils/date-utils"
import {
  formatNumber,
  formatCurrency,
  formatCurrencyCompact,
} from "@/utils/formatters"

type Props = { parlamentar: ParlamentarRef }

const sumYear = (cost: CustoAnual) =>
  cost.salario.total + cost.cota + cost.moradia + cost.diarias

/**
 * Soma o que dá para rastrear por pessoa: salário acumulado, cota,
 * auxílio-moradia e diárias. Com o histórico do mandato publicado, o cartão
 * mostra o acumulado desde a posse; sem ele (ou para quem acabou de assumir),
 * recua para o ano corrente. A equipe de gabinete fica fora do total — a
 * Câmara não abre esse custo por deputado, só a média da casa.
 */
export const TermCostCard = ({ parlamentar }: Props) => {
  const { salary, year, data: cost } = useParlamentarCost(parlamentar)
  const expenseSummary = useExpenseSummary(parlamentar)
  const compensation = useCompensation()
  const term = useParlamentarTerm(parlamentar)

  if (!salary || !year) return null

  const staff = (
    <OfficeStaff
      casa={parlamentar.casa}
      senateStaffCount={cost?.assessores ?? null}
      camaraSecretaries={compensation.data?.congresso?.folhaCamara?.secretarios}
    />
  )

  const years = (term.data?.anos ?? []).filter((item) => item.ano <= year)
  const hasHistory = years.some((item) => item.ano < year && sumYear(item) > 0)

  if (term.data && hasHistory) {
    return (
      <AccumulatedTerm
        term={term.data}
        years={years}
        year={year}
        salary={salary}
        staff={staff}
      />
    )
  }

  return (
    <CurrentYear
      year={year}
      salary={salary}
      cota={expenseSummary.data?.ano === year ? expenseSummary.data.total : 0}
      housingAllowance={cost?.moradia?.auxilioRecebido ?? 0}
      perDiem={cost?.diarias ?? 0}
      staff={staff}
    />
  )
}

type AccumulatedTermProps = {
  term: MandatoParlamentar
  years: CustoAnual[]
  year: number
  salary: Subsidio
  staff: ReactNode
}

const AccumulatedTerm = ({
  term,
  years,
  year,
  salary,
  staff,
}: AccumulatedTermProps) => {
  const sumOf = (pick: (item: CustoAnual) => number) =>
    years.reduce((total, item) => total + pick(item), 0)

  const breakdown: CostBreakdownProps = {
    salary: sumOf((item) => item.salario.total),
    months: sumOf((item) => item.salario.meses),
    cota: sumOf((item) => item.cota),
    housingAllowance: sumOf((item) => item.moradia),
    perDiem: sumOf((item) => item.diarias),
  }
  const total = breakdownTotal(breakdown)

  const currentYearCost = years.find((item) => item.ano === year)
  const currentYearTotal = currentYearCost ? sumYear(currentYearCost) : 0

  const startYear = Number(term.inicioExercicio.slice(0, 4))
  const startMonth = Number(term.inicioExercicio.slice(5, 7)) || 1

  return (
    <Card
      title="Quanto custa o mandato"
      meta={`${startYear}–${year}`}
      className="gap-4"
    >
      <Card.Highlight
        value={formatCurrency(total)}
        context={`somando salário, cota, moradia e diárias desde a posse, em ${formatMonthYearLong(startYear, startMonth)}`}
      />

      <CostBreakdown {...breakdown} />

      {currentYearTotal > 0 ? (
        <DividedSection>
          <DetailRow
            emphasized
            label={
              salary.ano === year
                ? `Em ${year}, até ${formatMonthYearLong(salary.ano, salary.mes)}`
                : `Em ${year}`
            }
            value={formatCurrency(currentYearTotal)}
          />
        </DividedSection>
      ) : null}

      {staff}

      <Footnote withHistory />
    </Card>
  )
}

type CurrentYearProps = {
  year: number
  salary: Subsidio
  cota: number
  housingAllowance: number
  perDiem: number
  staff: ReactNode
}

const CurrentYear = ({
  year,
  salary,
  cota,
  housingAllowance,
  perDiem,
  staff,
}: CurrentYearProps) => {
  // Folha de um ano anterior (virada de janeiro): sem como acumular o salário.
  const months = salary.ano === year ? salary.mes : 0

  const breakdown: CostBreakdownProps = {
    salary: salary.bruto * months,
    months,
    cota,
    housingAllowance,
    perDiem,
  }
  const total = breakdownTotal(breakdown)
  if (total === 0) return null

  return (
    <Card title="Quanto custa o mandato" meta={String(year)} className="gap-4">
      <Card.Highlight
        value={formatCurrency(total)}
        context={
          months > 0
            ? `até ${formatMonthYearLong(salary.ano, salary.mes)}, somando salário, cota, moradia e diárias`
            : "somando cota, moradia e diárias registradas no ano"
        }
      />

      <CostBreakdown {...breakdown} />

      {staff}

      <Footnote />
    </Card>
  )
}

type CostBreakdownProps = {
  salary: number
  months: number
  cota: number
  housingAllowance: number
  perDiem: number
}

const breakdownTotal = ({
  salary,
  cota,
  housingAllowance,
  perDiem,
}: CostBreakdownProps) => salary + cota + housingAllowance + perDiem

/** Linhas da soma; cada parcela só aparece quando tem valor. */
const CostBreakdown = ({
  salary,
  months,
  cota,
  housingAllowance,
  perDiem,
}: CostBreakdownProps) => (
  <View className="gap-2">
    {months > 0 ? (
      <DetailRow
        label={`Salário (${months} ${months === 1 ? "mês" : "meses"})`}
        value={formatCurrency(salary)}
      />
    ) : null}
    {cota > 0 ? (
      <DetailRow label="Cota parlamentar" value={formatCurrency(cota)} />
    ) : null}
    {housingAllowance > 0 ? (
      <DetailRow
        label="Auxílio-moradia"
        value={formatCurrency(housingAllowance)}
      />
    ) : null}
    {perDiem > 0 ? (
      <DetailRow label="Diárias de viagem" value={formatCurrency(perDiem)} />
    ) : null}
  </View>
)

const DividedSection = ({ children }: { children: ReactNode }) => (
  <View className="gap-2 border-t border-border pt-3">{children}</View>
)

const Footnote = ({ withHistory }: { withHistory?: boolean }) => (
  <Text className="text-xs text-muted-foreground">
    Fora da soma: 13º e férias, verba de gabinete e a estrutura das casas. O
    salário é o mesmo para todos; o resto varia por parlamentar.
    {withHistory
      ? " Anos antigos dependem do que as casas mantêm publicado — pode haver lacunas."
      : ""}
  </Text>
)

type OfficeStaffProps = {
  casa: ParlamentarRef["casa"]
  senateStaffCount: number | null
  camaraSecretaries?: {
    quantidade: number
    massaMensal: number
    mediaPorGabinete: number
  }
}

const OfficeStaff = ({
  casa,
  senateStaffCount,
  camaraSecretaries,
}: OfficeStaffProps) => {
  if (casa === "senado" && senateStaffCount) {
    return (
      <DividedSection>
        <DetailRow
          emphasized
          label="Equipe de gabinete"
          value={`${formatNumber(senateStaffCount)} pessoas`}
        />
        <Text className="text-xs text-muted-foreground">
          Paga pelo Senado, fora da soma acima. O Senado não publica o custo da
          equipe de cada gabinete.
        </Text>
      </DividedSection>
    )
  }

  if (casa === "camara" && camaraSecretaries) {
    const averagePerOffice = formatNumber(
      Math.round(camaraSecretaries.mediaPorGabinete),
    )

    return (
      <DividedSection>
        <DetailRow
          emphasized
          label="Equipe de gabinete"
          value={`${averagePerOffice} pessoas em média`}
        />
        <Text className="text-xs text-muted-foreground">
          A Câmara não abre a equipe por deputado. Na média da casa, cada
          gabinete tem {averagePerOffice}{" "}
          secretários parlamentares, ao custo de{" "}
          {formatCurrencyCompact(camaraSecretaries.massaMensal / 513)} por mês.
        </Text>
      </DividedSection>
    )
  }

  return null
}
