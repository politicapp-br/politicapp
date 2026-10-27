import {
  casaSchema,
  identificadorProposicao,
  tipoDaProposicao,
  type AutorProposicao,
  type Casa,
  type ProposicaoDetalhe,
  type Tramitacao,
} from "@politicapp/data"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Button, Chip } from "heroui-native"
import { useState } from "react"
import { Pressable, Text, View } from "react-native"

import { Card } from "@/components/card"
import { DetailRow } from "@/components/detail-row"
import { Icon } from "@/components/icon"
import { Screen } from "@/components/screen"
import { ErrorState, LoadingState } from "@/components/states"
import { useColors } from "@/hooks/use-colors"
import { useProposicao } from "@/hooks/use-proposicoes"
import { cn } from "@/utils/cn"
import { formatDate, formatDateLong } from "@/utils/date-utils"
import { openUrl } from "@/utils/links"
import { routes } from "@/utils/routes"

const VISIBLE_AUTHORS = 6
const VISIBLE_STEPS = 5

export default function ProposicaoScreen() {
  const params = useLocalSearchParams<{ casa: string; id: string }>()
  const casa = casaSchema.safeParse(params.casa)

  if (!casa.success || !params.id) {
    return (
      <Screen>
        <ErrorState
          title="Projeto não encontrado"
          description="O endereço acessado não corresponde a nenhuma proposição."
        />
      </Screen>
    )
  }

  return (
    <Screen>
      <Screen.TopBar />
      <ProposicaoContent casa={casa.data} id={params.id} />
    </Screen>
  )
}

type ProposicaoContentProps = { casa: Casa; id: string }

const ProposicaoContent = ({ casa, id }: ProposicaoContentProps) => {
  const { data, isPending, isError, refetch } = useProposicao(casa, id)

  if (casa === "senado") {
    return (
      <ErrorState
        title="Detalhes ainda não disponíveis"
        description="Por enquanto o app só abre o texto completo de projetos da Câmara."
      />
    )
  }

  if (isPending) return <LoadingState label="Buscando o projeto…" />
  if (isError || !data) {
    return <ErrorState onRetry={() => void refetch()} />
  }

  return (
    <Screen.Scroll contentClassName="gap-4">
      <ProposicaoHeader proposicao={data} />
      <SummaryCard proposicao={data} />
      <TopicsCard proposicao={data} />
      <CurrentStatusCard proposicao={data} />
      <AuthorsCard authors={data.autores} />
      <TramitacoesCard steps={data.tramitacoes} />
      <SourceButtons proposicao={data} />
    </Screen.Scroll>
  )
}

type ProposicaoProps = { proposicao: ProposicaoDetalhe }

const ProposicaoHeader = ({ proposicao }: ProposicaoProps) => {
  const type = proposicao.tipoPorExtenso ?? tipoDaProposicao(proposicao)

  return (
    <View className="gap-2 pb-2">
      {type ? (
        <Text className="text-xs uppercase text-muted-foreground">{type}</Text>
      ) : null}

      <Text className="font-title text-3xl text-foreground">
        {identificadorProposicao(proposicao)}
      </Text>

      {proposicao.apresentadaEm ? (
        <Text className="text-sm text-muted-foreground">
          Apresentado em {formatDateLong(proposicao.apresentadaEm)}
        </Text>
      ) : null}

      {proposicao.situacao ? (
        <View className="flex-row flex-wrap gap-2 pt-1">
          <Chip size="sm" variant="secondary">
            {proposicao.situacao}
          </Chip>
          {proposicao.orgaoAtual ? (
            <Chip size="sm" variant="secondary">
              {proposicao.orgaoAtual}
            </Chip>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const SummaryCard = ({ proposicao }: ProposicaoProps) => (
  <Card title="Do que se trata" className="gap-2">
    <Text className="text-sm leading-6 text-foreground">{proposicao.ementa}</Text>
    {proposicao.ementaDetalhada ? (
      <Text className="text-sm leading-6 text-foreground-secondary">
        {proposicao.ementaDetalhada}
      </Text>
    ) : null}
  </Card>
)

const TopicsCard = ({ proposicao }: ProposicaoProps) => {
  if (proposicao.temas.length + proposicao.palavrasChave.length === 0) {
    return null
  }

  return (
    <Card title="Assuntos">
      <View className="flex-row flex-wrap gap-2">
        {proposicao.temas.map((tema) => (
          <Chip key={`tema:${tema}`} size="sm" variant="primary">
            {tema}
          </Chip>
        ))}
        {proposicao.palavrasChave.map((keyword) => (
          <Chip key={`palavra:${keyword}`} size="sm" variant="secondary">
            {keyword}
          </Chip>
        ))}
      </View>
    </Card>
  )
}

const CurrentStatusCard = ({ proposicao }: ProposicaoProps) => {
  const hasAnything =
    proposicao.situacao ??
    proposicao.orgaoAtual ??
    proposicao.regime ??
    proposicao.apreciacao ??
    proposicao.despacho

  if (!hasAnything) return null

  return (
    <Card
      title="Como está hoje"
      meta={proposicao.atualizadaEm ? formatDate(proposicao.atualizadaEm) : undefined}
      className="gap-2"
    >
      <DetailRow label="Situação" value={proposicao.situacao} />
      <DetailRow label="Onde está" value={proposicao.orgaoAtual} />
      <DetailRow label="Quem decide" value={proposicao.apreciacao} />
      <DetailRow label="Regime" value={proposicao.regime} />

      {proposicao.despacho ? (
        <View className="gap-1 pt-1">
          <Text className="text-sm text-muted-foreground">Último andamento</Text>
          <Text className="text-sm leading-6 text-foreground">
            {proposicao.despacho}
          </Text>
        </View>
      ) : null}
    </Card>
  )
}

const AuthorsCard = ({ authors }: { authors: AutorProposicao[] }) => {
  const [expanded, setExpanded] = useState(false)

  if (authors.length === 0) return null

  const visible = expanded ? authors : authors.slice(0, VISIBLE_AUTHORS)
  const hiddenCount = authors.length - visible.length

  return (
    <Card
      title="Quem assina"
      meta={authors.length === 1 ? "1 autor" : `${authors.length} autores`}
      className="gap-1"
    >
      {visible.map((author, index) => (
        <AuthorRow
          key={`${author.parlamentar?.id ?? "sem-id"}:${author.nome}`}
          author={author}
          showDivider={index > 0}
        />
      ))}

      {hiddenCount > 0 ? (
        <Button size="sm" variant="ghost" onPress={() => setExpanded(true)}>
          {`Ver mais ${hiddenCount}`}
        </Button>
      ) : null}
    </Card>
  )
}

type AuthorRowProps = { author: AutorProposicao; showDivider: boolean }

/** Autor com cadastro de parlamentar vira link para a tela dele. */
const AuthorRow = ({ author, showDivider }: AuthorRowProps) => {
  const router = useRouter()
  const { muted } = useColors()
  const { parlamentar } = author

  const content = (
    <View
      className={cn(
        "flex-row items-center gap-3 py-2",
        showDivider && "border-t border-border",
      )}
    >
      <View className="flex-1">
        <Text className="text-sm text-foreground">{author.nome}</Text>
        <Text className="text-xs text-muted-foreground">
          {author.proponente ? `${author.tipo} · proponente` : author.tipo}
        </Text>
      </View>
      {parlamentar ? (
        <Icon name="chevron-forward" size={16} color={muted} />
      ) : null}
    </View>
  )

  if (!parlamentar) return content

  return (
    <Pressable onPress={() => router.push(routes.parlamentar(parlamentar))}>
      {content}
    </Pressable>
  )
}

const TramitacoesCard = ({ steps }: { steps: Tramitacao[] }) => {
  const [expanded, setExpanded] = useState(false)

  if (steps.length === 0) return null

  const visible = expanded ? steps : steps.slice(0, VISIBLE_STEPS)
  const hiddenCount = steps.length - visible.length

  return (
    <Card title="Por onde já passou">
      {visible.map((step, index) => (
        <TramitacaoStep
          key={`${step.data}:${index}`}
          step={step}
          isLast={index === visible.length - 1}
          expanded={expanded}
        />
      ))}

      {hiddenCount > 0 ? (
        <Button size="sm" variant="ghost" onPress={() => setExpanded(true)}>
          {`Ver as outras ${hiddenCount} etapas`}
        </Button>
      ) : null}
    </Card>
  )
}

type TramitacaoStepProps = {
  step: Tramitacao
  isLast: boolean
  expanded: boolean
}

const TramitacaoStep = ({ step, isLast, expanded }: TramitacaoStepProps) => (
  <View className="flex-row gap-3">
    <View className="items-center pt-1">
      <View className="h-2 w-2 rounded-full bg-brand" />
      {isLast ? null : <View className="mt-1 w-px flex-1 bg-border" />}
    </View>

    <View className="flex-1 gap-1 pb-2">
      <Text className="text-xs text-muted-foreground">
        {formatDate(step.data)}
        {step.orgao ? ` · ${step.orgao}` : ""}
      </Text>
      <Text className="text-sm text-foreground">{step.descricao}</Text>
      {step.despacho ? (
        <Text
          className="text-xs leading-5 text-muted-foreground"
          numberOfLines={expanded ? undefined : 3}
        >
          {step.despacho}
        </Text>
      ) : null}
    </View>
  </View>
)

const SourceButtons = ({ proposicao }: ProposicaoProps) => {
  const { urlInteiroTeor, urlFonte } = proposicao

  return (
    <View className="gap-2">
      {urlInteiroTeor ? (
        <Button size="sm" variant="secondary" onPress={() => openUrl(urlInteiroTeor)}>
          Ler o texto na íntegra
        </Button>
      ) : null}

      <Button size="sm" variant="ghost" onPress={() => openUrl(urlFonte)}>
        Ver a ficha oficial na Câmara
      </Button>
    </View>
  )
}
