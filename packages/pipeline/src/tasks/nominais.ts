import type { LadoMajoritario } from "@politicapp/data"

import type { VotacaoSenadoApi } from "../sources/senado"
import type { VotacaoNominal } from "./afinidade"
import { votacaoDaCamara, votoDaCamara, votoDoSenado, type VotacaoComVotos } from "./feed"

/**
 * Votações nominais de plenário da Câmara com voto individual — as mesmas
 * de `votacao/camara/*`, para a afinidade nunca citar uma votação que o app
 * não tem.
 */
export const nominaisDaCamara = (
  comVotos: VotacaoComVotos[],
  governo: Map<string, LadoMajoritario | null>,
): VotacaoNominal[] =>
  comVotos.flatMap((comVoto) => {
    if (comVoto.votos.length === 0) return []
    const votacao = votacaoDaCamara(comVoto)
    return [
      {
        id: votacao.id,
        data: votacao.data.slice(0, 10),
        descricao: comVoto.votacao.descricao,
        proposicao: comVoto.votacao.proposicaoObjeto?.trim() || null,
        aprovada: votacao.aprovada,
        governo: governo.get(votacao.id) ?? null,
        votos: comVoto.votos.map(votoDaCamara),
      },
    ]
  })

const APROVADA = "A"

/**
 * Votações nominais do Senado. Votação secreta fica de fora: o voto vem como
 * "Votou", sem lado, e contá-lo como sim inventaria concordância.
 */
export const nominaisDoSenado = (votacoes: VotacaoSenadoApi[]): VotacaoNominal[] =>
  votacoes.flatMap((votacao) => {
    if (votacao.votacaoSecreta?.toUpperCase() === "S") return []
    if (votacao.votos.length === 0) return []
    return [
      {
        id: `${votacao.codigoSessao}-${votacao.codigoSessaoVotacao}`,
        data: votacao.dataSessao.slice(0, 10),
        descricao:
          votacao.descricaoVotacao ?? votacao.identificacao ?? "Votação no Senado",
        proposicao: votacao.identificacao ?? null,
        aprovada: votacao.resultadoVotacao
          ? votacao.resultadoVotacao.toUpperCase() === APROVADA
          : null,
        governo: null,
        votos: votacao.votos.map(votoDoSenado),
      },
    ]
  })
