import type { Candidato, SituacaoCandidatura } from "@politicapp/data"
import { Surface } from "heroui-native"
import { Pressable, Text, View } from "react-native"

import { Icon } from "@/components/icon"
import { ParlamentarAvatar } from "@/components/parlamentar-avatar"
import { useColors } from "@/hooks/use-colors"
import { formatCurrencyCompact } from "@/utils/formatters"
import { getContrastTextColor, getPartyColor } from "@/utils/party-colors"
import { toProperCase } from "@/utils/text"

type Props = {
  candidate: Candidato
  onPress: () => void
}

type Tone = "neutral" | "success" | "danger"

/**
 * A situação é informação de apoio: quase toda candidatura fica meses "em
 * análise", então ela aparece como um ponto discreto, não como selo.
 */
const STATUS: Record<SituacaoCandidatura, { label: string; tone: Tone } | null> =
  {
    deferido: { label: "Deferido", tone: "success" },
    indeferido: { label: "Indeferido", tone: "danger" },
    pendente: { label: "Em análise", tone: "neutral" },
    renuncia: { label: "Renunciou", tone: "neutral" },
    outro: null,
  }

export const CandidateCard = ({ candidate, onPress }: Props) => {
  const { muted, successColor, dangerColor, surface } = useColors()
  const status = STATUS[candidate.situacao]
  const partyColor = getPartyColor(candidate.partido)
  // Candidatura de partido isolado tem coligação com o nome do próprio
  // partido ("UP · UP") — só o nome de chapa coletiva acrescenta algo.
  const coalition =
    candidate.coligacao && candidate.coligacao !== candidate.partido
      ? toProperCase(candidate.coligacao)
      : null
  const toneColor: Record<Tone, string> = {
    neutral: muted,
    success: successColor,
    danger: dangerColor,
  }

  return (
    <Pressable onPress={onPress}>
      <Surface variant="secondary" className="flex-row items-center gap-3 p-3">
        <View className="items-center">
          <ParlamentarAvatar
            parlamentar={{
              nome: candidate.nomeUrna,
              fotoUrl: candidate.fotoUrl,
              partido: candidate.partido,
            }}
            size={52}
          />
          <View
            className="-mt-2.5 rounded-full border-2 px-1.5"
            style={{ backgroundColor: partyColor, borderColor: surface }}
          >
            <Text
              className="font-title text-xs"
              style={{
                color: getContrastTextColor(partyColor),
                fontVariant: ["tabular-nums"],
              }}
              maxFontSizeMultiplier={1.2}
            >
              {candidate.numero}
            </Text>
          </View>
        </View>

        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-2">
            <Text
              className="flex-1 text-base font-semibold text-foreground"
              numberOfLines={1}
            >
              {toProperCase(candidate.nomeUrna)}
            </Text>
            {status ? (
              <View className="flex-row items-center gap-1.5">
                <View
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: toneColor[status.tone] }}
                />
                <Text className="text-xs text-muted-foreground">
                  {status.label}
                </Text>
              </View>
            ) : null}
          </View>

          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {candidate.partido}
            {coalition ? ` · ${coalition}` : ""}
            {candidate.reeleicao ? " · Tenta a reeleição" : ""}
            {candidate.totalBens
              ? ` · ${formatCurrencyCompact(candidate.totalBens)} em bens`
              : ""}
          </Text>
        </View>

        <Icon name="chevron-forward" size={18} color={muted} />
      </Surface>
    </Pressable>
  )
}
