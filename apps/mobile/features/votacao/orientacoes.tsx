import {
  agruparVotosPor,
  ehBancadaDoGoverno,
  LADO_ORIENTACAO_LABEL,
  type Casa,
  type LadoMajoritario,
  type Orientacao,
  type Voto,
} from "@politicapp/data"
import { useMemo } from "react"
import { Text, View } from "react-native"

import { Card } from "@/components/card"
import { useColors } from "@/hooks/use-colors"
import { useOrientacoes } from "@/hooks/use-votacoes"

type Props = { casa: Casa; id: string; votos: Voto[] }

type Adherence = "followed" | "did_not_follow"

const ADHERENCE_LABEL: Record<Adherence, string> = {
  followed: "seguiu",
  did_not_follow: "não seguiu",
}

/**
 * O que cada liderança orientou antes da votação — e se a bancada seguiu.
 * É o dado mais direto de que o voto no plenário é combinado em bloco.
 */
export const OrientacoesCard = ({ casa, id, votos }: Props) => {
  const { data } = useOrientacoes(casa, id)

  const majorities = useMemo(() => {
    const groups = agruparVotosPor(votos, "partido")
    return new Map(
      groups.flatMap((group) =>
        group.maioria
          ? [[group.grupo.toUpperCase(), group.maioria] as const]
          : [],
      ),
    )
  }, [votos])

  const orientacoes = useMemo(() => {
    if (!data) return []
    return [...data].sort(
      (a, b) =>
        Number(ehBancadaDoGoverno(b.bancada)) -
          Number(ehBancadaDoGoverno(a.bancada)) ||
        a.bancada.localeCompare(b.bancada, "pt-BR"),
    )
  }, [data])

  if (orientacoes.length === 0) return null

  const adherenceOf = (orientacao: Orientacao): Adherence | null => {
    if (orientacao.lado !== "sim" && orientacao.lado !== "nao") return null
    if (ehBancadaDoGoverno(orientacao.bancada)) return null
    const majority: LadoMajoritario | undefined = majorities.get(
      orientacao.bancada.toUpperCase(),
    )
    if (!majority) return null
    return majority === orientacao.lado ? "followed" : "did_not_follow"
  }

  return (
    <Card
      title="O que as lideranças orientaram"
      description="Antes da votação, cada liderança indica como a bancada deve votar — inclusive a do governo"
    >
      <View className="gap-1.5">
        {orientacoes.map((orientacao) => (
          <OrientacaoRow
            key={orientacao.bancada}
            orientacao={orientacao}
            adherence={adherenceOf(orientacao)}
          />
        ))}
      </View>
      <Text className="text-[11px] text-muted-foreground">
        Orientação não é obrigação: o painel acima mostra se cada bancada
        acompanhou a própria liderança. Dado publicado só pela Câmara.
      </Text>
    </Card>
  )
}

type RowProps = { orientacao: Orientacao; adherence: Adherence | null }

const OrientacaoRow = ({ orientacao, adherence }: RowProps) => {
  const { successColor, dangerColor, muted, warningColor } = useColors()
  const sideColor =
    orientacao.lado === "sim"
      ? successColor
      : orientacao.lado === "nao"
        ? dangerColor
        : muted
  const sideLabel = LADO_ORIENTACAO_LABEL[orientacao.lado]

  return (
    <View
      className="flex-row items-center justify-between gap-3"
      accessible
      accessibilityLabel={`${orientacao.bancada}: orientação ${sideLabel}${adherence ? `, a bancada ${ADHERENCE_LABEL[adherence]} a orientação` : ""}`}
    >
      <Text
        className={
          ehBancadaDoGoverno(orientacao.bancada)
            ? "text-sm font-semibold text-foreground"
            : "text-sm text-foreground"
        }
        numberOfLines={1}
      >
        {orientacao.bancada}
      </Text>
      <View className="flex-row items-center gap-2">
        {adherence === "did_not_follow" ? (
          <Text className="text-xs" style={{ color: warningColor }}>
            bancada não seguiu
          </Text>
        ) : null}
        <Text className="text-sm font-semibold" style={{ color: sideColor }}>
          {sideLabel}
        </Text>
      </View>
    </View>
  )
}
