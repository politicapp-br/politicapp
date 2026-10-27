import { FONTE_DADOS_ABERTOS, type ParlamentarRef } from "@politicapp/data"
import { useRouter } from "expo-router"
import { Pressable, Text, View } from "react-native"

import { Card } from "@/components/card"
import { DetailRow } from "@/components/detail-row"
import { SourceLink } from "@/components/source-link"
import { useParlamentarTermHistory } from "@/hooks/use-static-data"
import { formatDate } from "@/utils/date-utils"
import { routes } from "@/utils/routes"

import { ExpandableList } from "./expandable-list"

type Props = { parlamentar: ParlamentarRef }

const periodo = (inicio: string | null, fim: string | null) => {
  if (!inicio) return fim ? `até ${formatDate(fim)}` : ""
  return fim ? `${formatDate(inicio)} a ${formatDate(fim)}` : `desde ${formatDate(inicio)}`
}

/**
 * Por quais partidos passou, quando esteve fora do mandato e, no Senado,
 * quem assume no lugar. Explica participação baixa e trocas de sigla.
 */
export const TermHistoryCard = ({ parlamentar }: Props) => {
  const router = useRouter()
  const { data } = useParlamentarTermHistory(parlamentar)

  if (!data) return null
  const trocouDePartido = data.filiacoes.length > 1
  if (!trocouDePartido && data.afastamentos.length === 0 && data.suplentes.length === 0) {
    return null
  }

  return (
    <Card title="Histórico do mandato" className="gap-4">
      {trocouDePartido ? (
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Partidos</Text>
          {data.filiacoes.map((filiacao, index) => (
            <DetailRow
              key={`${filiacao.partido}-${index}`}
              label={filiacao.partido}
              value={periodo(filiacao.inicio, filiacao.fim)}
            />
          ))}
        </View>
      ) : null}

      {data.afastamentos.length > 0 ? (
        <View className="gap-1">
          <Text className="text-sm font-semibold text-foreground">Afastamentos e licenças</Text>
          <ExpandableList
            items={data.afastamentos}
            initialCount={4}
            keyExtractor={(afastamento, index) => `${afastamento.inicio}-${index}`}
            renderItem={(afastamento) => (
              <View className="gap-1 py-2">
                <Text className="text-sm text-foreground">{afastamento.motivo}</Text>
                <Text className="text-xs text-muted-foreground">
                  {afastamento.fim === afastamento.inicio
                    ? formatDate(afastamento.inicio)
                    : afastamento.fim
                      ? periodo(afastamento.inicio, afastamento.fim)
                      : `desde ${formatDate(afastamento.inicio)}, ainda afastado`}
                </Text>
              </View>
            )}
          />
        </View>
      ) : null}

      {data.suplentes.length > 0 ? (
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Suplentes</Text>
          {data.suplentes.map((suplente) =>
            suplente.id ? (
              <Pressable
                key={suplente.ordem}
                accessibilityRole="link"
                onPress={() =>
                  suplente.id && router.push(routes.parlamentar({ casa: "senado", id: suplente.id }))
                }
              >
                <DetailRow label={suplente.ordem} value={suplente.nome} />
              </Pressable>
            ) : (
              <DetailRow key={suplente.ordem} label={suplente.ordem} value={suplente.nome} />
            ),
          )}
        </View>
      ) : null}

      <SourceLink label="Histórico nos dados abertos" url={FONTE_DADOS_ABERTOS[parlamentar.casa]} />
    </Card>
  )
}
