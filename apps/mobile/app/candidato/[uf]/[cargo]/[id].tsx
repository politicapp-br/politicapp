import {
  cargoSchema,
  CARGO_ELEICAO_LABEL,
  subsidioDoGovernador,
  TETO_CONSTITUCIONAL,
  type BemDeclarado,
  type Cargo,
  type CandidatoDetalhe,
} from "@politicapp/data"
import { useLocalSearchParams } from "expo-router"
import { Chip } from "heroui-native"
import { Text, View } from "react-native"

import { Card } from "@/components/card"
import { DetailRow } from "@/components/detail-row"
import { ParlamentarAvatar } from "@/components/parlamentar-avatar"
import { Screen } from "@/components/screen"
import { ErrorState, LoadingState } from "@/components/states"
import { useCandidate } from "@/hooks/use-elections"
import { formatDate } from "@/utils/date-utils"
import { formatCurrency } from "@/utils/formatters"
import { toProperCase } from "@/utils/text"

export default function CandidateScreen() {
  const params = useLocalSearchParams<{
    uf: string
    cargo: string
    id: string
  }>()

  const cargo = cargoSchema.safeParse(params.cargo)

  const { data, isPending, isError, refetch } = useCandidate(
    params.uf ?? null,
    cargo.success ? cargo.data : "deputado-federal",
    params.id ?? null,
  )

  return (
    <Screen>
      <Screen.TopBar />

      {!cargo.success ? (
        <ErrorState title="Candidatura não encontrada" />
      ) : isPending ? (
        <LoadingState />
      ) : isError || !data ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <CandidateContent candidate={data} />
      )}
    </Screen>
  )
}

const CandidateContent = ({ candidate }: { candidate: CandidatoDetalhe }) => (
  <Screen.Scroll>
    <View className="items-center gap-2">
      <ParlamentarAvatar
        parlamentar={{
          nome: candidate.nomeUrna,
          fotoUrl: candidate.fotoUrl,
          partido: candidate.partido,
        }}
        size={112}
      />

      <Text className="text-center font-title text-2xl text-foreground">
        {toProperCase(candidate.nomeUrna)}
      </Text>
      <Text className="text-sm text-muted-foreground">
        {CARGO_ELEICAO_LABEL[candidate.cargo]} · {candidate.partido} ·{" "}
        {candidate.uf}
      </Text>
      {candidate.reeleicao ? <Chip size="sm">Tenta a reeleição</Chip> : null}
    </View>

    <Card title="Quem é" className="gap-2">
      <DetailRow
        label="Nome completo"
        value={toProperCase(candidate.nomeCompleto)}
      />
      <DetailRow
        label="Nascimento"
        value={candidate.nascimento ? formatDate(candidate.nascimento) : null}
      />
      <DetailRow label="Ocupação" value={candidate.ocupacao} />
      <DetailRow label="Escolaridade" value={candidate.escolaridade} />
      <DetailRow label="Coligação" value={candidate.coligacao} />
    </Card>

    <CargoSalaryCard cargo={candidate.cargo} uf={candidate.uf} />

    {candidate.limiteGastos1T ? (
      <Card title="Quanto a campanha pode gastar">
        <Card.Highlight value={formatCurrency(candidate.limiteGastos1T)} />
        <Text className="text-xs text-muted-foreground">
          Teto fixado pela Justiça Eleitoral para todos que disputam este cargo
          {candidate.limiteGastos2T
            ? `, mais ${formatCurrency(candidate.limiteGastos2T)} em eventual segundo turno`
            : ""}
          . Estourar o limite cassa o registro.
        </Text>
      </Card>
    ) : null}

    {candidate.candidaturasAnteriores.length > 0 ? (
      <Card title="Já disputou antes" className="gap-2">
        {candidate.candidaturasAnteriores.map((previous) => (
          <DetailRow
            key={`${previous.ano}-${previous.cargo}`}
            label={`${previous.ano} · ${previous.cargo}${previous.partido ? ` · ${previous.partido}` : ""}`}
            value={previous.resultado ?? "—"}
          />
        ))}
      </Card>
    ) : null}

    {candidate.bens.length > 0 ? (
      <Card title="Bens declarados">
        <Card.Highlight value={formatCurrency(candidate.totalBens ?? 0)} />
        {candidate.bens.map((asset, index) => (
          <AssetRow key={`${asset.descricao}-${index}`} asset={asset} />
        ))}
      </Card>
    ) : null}

    <Text className="text-center text-xs text-muted-foreground">
      Dados do DivulgaCandContas (TSE), atualizados ao longo do registro de
      candidaturas.
    </Text>
  </Screen.Scroll>
)

const AssetRow = ({ asset }: { asset: BemDeclarado }) => (
  <View className="flex-row justify-between gap-4 border-t border-border pt-2">
    <View className="flex-1">
      <Text className="text-sm text-foreground" numberOfLines={2}>
        {asset.descricao}
      </Text>
      <Text className="text-xs text-muted-foreground">{asset.tipo}</Text>
    </View>
    <Text className="text-sm text-foreground">
      {formatCurrency(asset.valor)}
    </Text>
  </View>
)

/**
 * Presidente, senador e deputado federal ganham o teto, fixado em lei federal.
 * Governador varia por estado (tabela curada, com a ressalva na tela de
 * salários). Deputado estadual fica de fora: são 27 leis sem fonte unificada.
 */
const CargoSalaryCard = ({ cargo, uf }: { cargo: Cargo; uf: string }) => {
  const salary =
    cargo === "governador"
      ? subsidioDoGovernador(uf)?.subsidio
      : cargo === "deputado-estadual"
        ? null
        : TETO_CONSTITUCIONAL

  if (!salary) return null

  return (
    <Card title="Quanto paga o cargo">
      <Card.Highlight value={formatCurrency(salary)} />
      <Text className="text-xs text-muted-foreground">
        {cargo === "governador"
          ? `Subsídio mensal bruto de quem governa ${uf} hoje, fixado por lei estadual.`
          : "Subsídio mensal bruto atual do cargo — o teto do funcionalismo federal."}
      </Text>
    </Card>
  )
}
