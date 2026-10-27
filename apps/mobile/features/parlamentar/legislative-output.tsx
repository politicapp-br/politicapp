import {
  FONTE_DADOS_ABERTOS,
  tipoDaProposicao,
  type ParlamentarRef,
  type ProposicaoDestaque,
} from "@politicapp/data"
import { useRouter } from "expo-router"
import { Pressable, Text, View } from "react-native"

import { Card } from "@/components/card"
import { DetailRow } from "@/components/detail-row"
import { SourceLink } from "@/components/source-link"
import { useParlamentarLegislativeOutput } from "@/hooks/use-static-data"
import { formatDate } from "@/utils/date-utils"
import { formatNumber } from "@/utils/formatters"
import { openUrl } from "@/utils/links"
import { routes } from "@/utils/routes"

type Props = { parlamentar: ParlamentarRef }

/**
 * Quanto o parlamentar propôs na legislatura e o que andou. Requerimentos e
 * indicações aparecem no total por tipo, mas o destaque são os projetos —
 * o que pode virar lei.
 */
export const LegislativeOutputCard = ({ parlamentar }: Props) => {
  const { data } = useParlamentarLegislativeOutput(parlamentar)

  if (!data || data.porTipo.length === 0) return null

  const { autor, coautor } = data.projetos

  return (
    <Card
      title="Produção legislativa"
      description={`Desde ${data.desde}, nesta legislatura`}
      className="gap-4"
    >
      <Card.Highlight
        value={formatNumber(autor)}
        context={`${autor === 1 ? "projeto apresentado" : "projetos apresentados"} como autor principal${coautor > 0 ? `, e ${formatNumber(coautor)} como coautor` : ""}`}
      />

      <View className="gap-2">
        {data.porTipo.map((tipo) => (
          <DetailRow
            key={tipo.sigla}
            label={tipoDaProposicao(tipo) ?? tipo.sigla}
            value={`${formatNumber(tipo.autor)} autor · ${formatNumber(tipo.coautor)} coautor`}
          />
        ))}
      </View>

      {data.viraramNorma.length > 0 ? (
        <ProposicaoList
          title="Viraram lei ou emenda constitucional"
          items={data.viraramNorma}
          parlamentar={parlamentar}
        />
      ) : null}
      {data.aprovadasNaCasa.length > 0 ? (
        <ProposicaoList
          title={
            parlamentar.casa === "camara"
              ? "Aprovadas na Câmara, ainda sem lei"
              : "Aprovadas no Senado, ainda sem lei"
          }
          items={data.aprovadasNaCasa}
          parlamentar={parlamentar}
        />
      ) : null}

      <Text className="text-[11px] text-muted-foreground">
        Autor é quem assina primeiro; coautor, quem assina junto. Muitos
        projetos aprovados tramitam apensados a outros e aparecem só no
        principal.
      </Text>
      <SourceLink label="Proposições nos dados abertos" url={FONTE_DADOS_ABERTOS[parlamentar.casa]} />
    </Card>
  )
}

type ListProps = {
  title: string
  items: ProposicaoDestaque[]
  parlamentar: ParlamentarRef
}

const ProposicaoList = ({ title, items, parlamentar }: ListProps) => {
  const router = useRouter()
  return (
    <View className="gap-1">
      <Text className="text-sm font-semibold text-foreground">{title}</Text>
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="link"
          onPress={() =>
            parlamentar.casa === "camara"
              ? router.push(routes.proposicao("camara", item.id))
              : openUrl(item.url)
          }
          className="gap-1 py-2"
        >
          <View className="flex-row items-center gap-2">
            <Text className="text-xs font-semibold text-brand">{item.identificacao}</Text>
            {item.apresentadaEm ? (
              <Text className="text-xs text-muted-foreground">{formatDate(item.apresentadaEm)}</Text>
            ) : null}
            {item.autor ? null : <Text className="text-xs text-muted-foreground">coautor</Text>}
          </View>
          <Text className="text-sm leading-5 text-foreground" numberOfLines={3}>
            {item.ementa}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}
