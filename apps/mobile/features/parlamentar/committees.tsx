import type { ParlamentarRef, ParticipacaoEmOrgao } from "@politicapp/data"
import { useMemo } from "react"
import { Text, View } from "react-native"

import { Card } from "@/components/card"
import { useParlamentarCommittees } from "@/hooks/use-parlamentar"
import { formatDate } from "@/utils/date-utils"

import { ExpandableList } from "./expandable-list"

const INITIAL_COUNT = 6

/** Papéis de assento, que ficam depois de cargos como presidente ou relator. */
const SEAT_ROLES = new Set(["Titular", "Suplente"])

/**
 * A Câmara repete o órgão para cada papel da pessoa nele (ex.: "1º
 * Vice-Presidente" e "Titular" na mesma comissão); vira uma linha só.
 */
const mergeRoles = (
  memberships: ParticipacaoEmOrgao[],
): ParticipacaoEmOrgao[] => {
  const bySigla = new Map<string, ParticipacaoEmOrgao[]>()
  for (const membership of memberships) {
    bySigla.set(membership.sigla, [
      ...(bySigla.get(membership.sigla) ?? []),
      membership,
    ])
  }

  return [...bySigla.values()].map((group) => {
    const roles = [...new Set(group.map((membership) => membership.papel))]
    roles.sort((a, b) => Number(SEAT_ROLES.has(a)) - Number(SEAT_ROLES.has(b)))
    const earliest = group
      .map((membership) => membership.inicio)
      .filter((inicio) => inicio !== null)
      .sort()[0]

    return { ...group[0], papel: roles.join(" · "), inicio: earliest ?? null }
  })
}

type Props = { parlamentar: ParlamentarRef }

export const CommitteesCard = ({ parlamentar }: Props) => {
  const { data } = useParlamentarCommittees(parlamentar)

  const current = useMemo(
    () =>
      mergeRoles((data ?? []).filter((membership) => !membership.fim)).sort(
        (a, b) => (b.inicio ?? "").localeCompare(a.inicio ?? ""),
      ),
    [data],
  )

  if (current.length === 0) return null

  return (
    <Card
      title="Comissões e cargos"
      description="Onde atua hoje dentro do Congresso"
      className="gap-1"
    >
      <ExpandableList
        items={current}
        initialCount={INITIAL_COUNT}
        keyExtractor={(membership) => membership.sigla}
        renderItem={(membership) => <CommitteeRow membership={membership} />}
      />
    </Card>
  )
}

type CommitteeRowProps = { membership: ParticipacaoEmOrgao }

const CommitteeRow = ({ membership }: CommitteeRowProps) => (
  <View className="gap-1 py-3">
    <Text className="text-sm leading-5 text-foreground" numberOfLines={3}>
      {membership.nome}
    </Text>
    <Text className="text-xs text-muted-foreground">
      {membership.sigla} · {membership.papel}
      {membership.inicio ? ` · desde ${formatDate(membership.inicio)}` : ""}
    </Text>
  </View>
)
