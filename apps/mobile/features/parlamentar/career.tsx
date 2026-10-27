import type { MandatoExterno, Ocupacao, ParlamentarRef } from "@politicapp/data"
import type { ReactNode } from "react"
import { Text, View } from "react-native"

import { Card } from "@/components/card"
import { useParlamentarCareer } from "@/hooks/use-parlamentar"
import { toProperCase } from "@/utils/text"

type Props = { parlamentar: ParlamentarRef }

export const CareerCard = ({ parlamentar }: Props) => {
  const { data } = useParlamentarCareer(parlamentar)

  if (!data) return null

  const { mandatosExternos: pastTerms, ocupacoes: occupations } = data
  if (pastTerms.length === 0 && occupations.length === 0) return null

  return (
    <Card
      title="Trajetória"
      description="Cargos eletivos e ocupações antes do mandato atual"
      className="gap-4"
    >
      {pastTerms.length > 0 ? (
        <CareerGroup title="Mandatos anteriores">
          {pastTerms.map((term, index) => (
            <PastTermRow key={index} term={term} />
          ))}
        </CareerGroup>
      ) : null}

      {occupations.length > 0 ? (
        <CareerGroup title="Ocupações">
          {occupations.map((occupation, index) => (
            <CareerRow
              key={index}
              title={toProperCase(occupation.titulo)}
              details={
                occupation.entidade ? toProperCase(occupation.entidade) : null
              }
              period={formatPeriod(occupation)}
            />
          ))}
        </CareerGroup>
      ) : null}
    </Card>
  )
}

const formatPeriod = ({
  anoInicio: startYear,
  anoFim: endYear,
}: Pick<Ocupacao, "anoInicio" | "anoFim">) => {
  if (!startYear && !endYear) return null
  return `${startYear ?? "?"}–${endYear ?? "hoje"}`
}

type CareerGroupProps = { title: string; children: ReactNode }

const CareerGroup = ({ title, children }: CareerGroupProps) => (
  <View className="gap-2">
    <Text className="text-sm font-semibold text-foreground">{title}</Text>
    {children}
  </View>
)

type PastTermRowProps = { term: MandatoExterno }

const PastTermRow = ({ term }: PastTermRowProps) => {
  const place = [term.municipio ? toProperCase(term.municipio) : null, term.uf]
    .filter(Boolean)
    .join("/")

  const details = [place || null, term.partido].filter(Boolean).join(" · ")

  return (
    <CareerRow
      title={term.cargo}
      details={details || null}
      period={formatPeriod(term)}
    />
  )
}

type CareerRowProps = {
  title: string
  details: string | null
  period: string | null
}

const CareerRow = ({ title, details, period }: CareerRowProps) => (
  <View className="flex-row items-baseline justify-between gap-4">
    <View className="flex-1 gap-0.5">
      <Text className="text-sm text-foreground">{title}</Text>
      {details ? (
        <Text className="text-xs text-muted-foreground">{details}</Text>
      ) : null}
    </View>
    <Text className="text-xs text-muted-foreground">{period}</Text>
  </View>
)
