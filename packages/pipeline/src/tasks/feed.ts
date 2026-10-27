import {
  contarPlacar,
  descricaoSemPlacar,
  placarDaDescricao,
  placarVazio,
  tipoVotoDaCamara,
  tipoVotoDoSenado,
  type EventoFeed,
  type EventoNorma,
  type EventoPauta,
  type EventoTramitacao,
  type TipoVoto,
  type Votacao,
  type Voto,
} from "@politicapp/data"

import type { VotacaoCamaraApi, VotoCamaraApi } from "../sources/camara"
import type { VotacaoSenadoApi } from "../sources/senado"

/** Quantas votações o feed guarda. Serve app e histórico recente sem inchar o JSON. */
export const VOTACOES_NO_FEED = 60

/** Simbólicas são mais frequentes e menos ricas — entram em menor número. */
export const SIMBOLICAS_NO_FEED = 20

export type VotacaoComVotos = {
  votacao: VotacaoCamaraApi
  votos: VotoCamaraApi[]
}

const APROVADA = "A"

export const votoDaCamara = (voto: VotoCamaraApi): Voto => ({
  casa: "camara",
  id: String(voto.deputado_.id),
  nome: voto.deputado_.nome,
  partido: voto.deputado_.siglaPartido ?? "—",
  uf: voto.deputado_.siglaUf ?? "—",
  voto: tipoVotoDaCamara(voto.tipoVoto),
})

export const votoDoSenado = (
  voto: VotacaoSenadoApi["votos"][number],
): Voto => ({
  casa: "senado",
  id: String(voto.codigoParlamentar),
  nome: voto.nomeParlamentar,
  partido: voto.siglaPartidoParlamentar ?? "—",
  uf: voto.siglaUFParlamentar ?? "—",
  voto: tipoVotoDoSenado(voto.siglaVotoParlamentar),
})

export const votacaoDaCamara = ({
  votacao,
  votos: votosApi,
}: VotacaoComVotos): Votacao => {
  const votos = votosApi.map(votoDaCamara)

  return {
    casa: "camara",
    id: votacao.id,
    data: votacao.data,
    descricao: descricaoSemPlacar(votacao.descricao),
    resumo: null,
    proposicao: null,
    aprovada:
      votacao.aprovacao === null || votacao.aprovacao === undefined
        ? null
        : votacao.aprovacao === 1,
    placar: contarPlacar(votos),
  }
}

export const votacaoDoSenado = (votacao: VotacaoSenadoApi): Votacao => {
  const votos = votacao.votos.map(votoDoSenado)

  return {
    casa: "senado",
    id: `${votacao.codigoSessao}-${votacao.codigoSessaoVotacao}`,
    data: votacao.dataSessao,
    descricao:
      votacao.descricaoVotacao ?? votacao.identificacao ?? "Votação no Senado",
    resumo: votacao.ementa ?? null,
    proposicao: votacao.identificacao
      ? {
          id: null,
          sigla: votacao.identificacao,
          ementa: votacao.ementa ?? null,
        }
      : null,
    aprovada: votacao.resultadoVotacao
      ? votacao.resultadoVotacao.toUpperCase() === APROVADA
      : null,
    placar: contarPlacar(votos),
  }
}

/** Junta as duas casas, mais recentes primeiro, e corta no tamanho do feed. */
export const montarFeed = (
  camara: VotacaoComVotos[],
  senado: VotacaoSenadoApi[],
): Votacao[] =>
  [
    ...camara.filter(({ votos }) => votos.length > 0).map(votacaoDaCamara),
    ...senado.filter(({ votos }) => votos.length > 0).map(votacaoDoSenado),
  ]
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, VOTACOES_NO_FEED)

/**
 * Mapa id do parlamentar → voto para cada votação do feed. É o que a tela do
 * parlamentar usa para mostrar "como votou" sem uma requisição por votação.
 */
export const montarVotosDoFeed = (
  feed: Votacao[],
  camara: VotacaoComVotos[],
  senado: VotacaoSenadoApi[],
): { casa: Votacao["casa"]; id: string; votos: Record<string, TipoVoto> }[] => {
  const porChave = new Map<string, Record<string, TipoVoto>>()

  for (const { votacao, votos } of camara) {
    if (votos.length === 0) continue
    porChave.set(
      `camara:${votacao.id}`,
      Object.fromEntries(
        votos.map((voto) => [
          String(voto.deputado_.id),
          tipoVotoDaCamara(voto.tipoVoto),
        ]),
      ),
    )
  }

  for (const votacao of senado) {
    if (votacao.votos.length === 0) continue
    porChave.set(
      `senado:${votacao.codigoSessao}-${votacao.codigoSessaoVotacao}`,
      Object.fromEntries(
        votacao.votos.map((voto) => [
          String(voto.codigoParlamentar),
          tipoVotoDoSenado(voto.siglaVotoParlamentar),
        ]),
      ),
    )
  }

  return feed.flatMap((votacao) => {
    const votos = porChave.get(`${votacao.casa}:${votacao.id}`)
    return votos ? [{ casa: votacao.casa, id: votacao.id, votos }] : []
  })
}

/**
 * Votação simbólica não registra voto individual, mas "o plenário aprovou o
 * PL X" ainda é notícia. O filtro corta o processual (requerimento, destaque,
 * redação final) e deixa o que muda lei: PL, PLP, PEC, MP, PDL e variantes.
 */
const SIGLA_RELEVANTE = /^(PLS?|PLP|PLV|PEC|MPV?|PDL|PDS|PDC)\s?\d/i

/**
 * Na Câmara, `proposicaoObjeto` costuma vir nulo na votação simbólica — o que
 * foi votado só aparece na descrição: "Aprovado o Projeto de Lei nº X, de Y".
 * Exigir o tipo logo após "Aprovado o/a" já exclui redação final, subemenda
 * e destaque.
 */
const DESCRICAO_RELEVANTE =
  /^(Aprovad[oa]|Rejeitad[oa])\s+[oa]\s+(Projeto de Lei|Proposta de Emenda|Medida Provisória|Projeto de Decreto Legislativo)/i

export const simbolicaRelevante = (votacao: VotacaoCamaraApi): boolean =>
  votacao.aprovacao !== null &&
  // Nominal traz o placar escrito na descrição. Se ele está lá e os votos
  // vieram vazios, foi falha na busca — não é simbólica, é nominal quebrada.
  placarDaDescricao(votacao.descricao) === null &&
  ((votacao.proposicaoObjeto !== null &&
    SIGLA_RELEVANTE.test(votacao.proposicaoObjeto)) ||
    DESCRICAO_RELEVANTE.test(votacao.descricao))

export const simbolicasDaCamara = (
  votacoes: VotacaoComVotos[],
): VotacaoCamaraApi[] =>
  votacoes
    .filter(
      ({ votos, votacao }) => votos.length === 0 && simbolicaRelevante(votacao),
    )
    .map(({ votacao }) => votacao)
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, SIMBOLICAS_NO_FEED)

export const votacaoSimbolicaDaCamara = (
  votacao: VotacaoCamaraApi,
): Votacao => ({
  casa: "camara",
  id: votacao.id,
  data: votacao.data,
  descricao: descricaoSemPlacar(votacao.descricao),
  resumo: null,
  proposicao: votacao.proposicaoObjeto
    ? { id: null, sigla: votacao.proposicaoObjeto, ementa: null }
    : null,
  aprovada: votacao.aprovacao === null ? null : votacao.aprovacao === 1,
  placar: placarVazio,
})

export const simbolicasDoSenado = (
  votacoes: VotacaoSenadoApi[],
): Votacao[] =>
  votacoes
    .filter(
      (votacao) =>
        votacao.votos.length === 0 &&
        votacao.resultadoVotacao !== null &&
        votacao.identificacao !== null &&
        SIGLA_RELEVANTE.test(votacao.identificacao),
    )
    .map(votacaoDoSenado)
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, SIMBOLICAS_NO_FEED)

/**
 * O feed da home: agenda futura primeiro (mais próxima no topo), depois o que
 * já aconteceu — votações, marcos de tramitação e normas publicadas
 * misturados, mais recente primeiro.
 */
export const montarEventos = (
  agenda: EventoPauta[],
  nominais: Votacao[],
  simbolicas: Votacao[],
  tramitacoes: EventoTramitacao[] = [],
  normas: EventoNorma[] = [],
): EventoFeed[] => {
  const acontecimentos: EventoFeed[] = [
    ...nominais.map((votacao) => ({
      tipo: "votacao" as const,
      data: votacao.data,
      nominal: true,
      votacao,
    })),
    ...simbolicas.map((votacao) => ({
      tipo: "votacao" as const,
      data: votacao.data,
      nominal: false,
      votacao,
    })),
    ...tramitacoes,
    ...normas,
    // Votações carregam só a data; tramitações vêm com hora. Comparar os dois
    // como string poria toda tramitação acima de toda votação do mesmo dia —
    // o corte no dia deixa a ordem estável dentro dele.
  ].sort((a, b) => b.data.slice(0, 10).localeCompare(a.data.slice(0, 10)))

  return [...agenda, ...acontecimentos]
}
