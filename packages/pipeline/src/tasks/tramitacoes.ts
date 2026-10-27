import type { EventoTramitacao, MarcoTramitacao } from "@politicapp/data"

import type {
  ProposicaoResumoApi,
  StatusProposicaoApi,
} from "../sources/camara"

/** Marcos são raros — poucas dezenas bastam sem inchar o JSON. */
export const TRAMITACOES_NO_FEED = 25

/**
 * Situações da Câmara que valem notícia, mapeadas para o marco exibido.
 * Vocabulário completo em /referencias/proposicoes/codSituacao.
 */
export const MARCO_POR_SITUACAO: Record<number, MarcoTramitacao> = {
  1303: "aprovada_na_camara", // Enviada ao Senado Federal
  926: "aprovada_na_camara", // Aguardando Apreciação pelo Senado Federal
  1150: "enviada_a_sancao", // Aguardando Sanção
  1160: "enviada_a_sancao", // Aguardando Remessa à Sanção
  1294: "aguardando_promulgacao",
  1140: "transformada_em_lei", // Transformado em Norma Jurídica
  937: "vetada", // Vetado totalmente
}

export type ProposicaoComStatus = {
  proposicao: ProposicaoResumoApi
  status: StatusProposicaoApi | null
}

const siglaDe = (proposicao: ProposicaoResumoApi): string | null => {
  if (!proposicao.siglaTipo) return null
  const numeracao =
    proposicao.numero && proposicao.ano
      ? ` ${proposicao.numero}/${proposicao.ano}`
      : ""
  return `${proposicao.siglaTipo}${numeracao}`
}

/**
 * Mantém só quem chegou num marco DENTRO da janela: a listagem devolve tudo
 * que tramitou no período, mas a situação atual pode ser antiga (a proposição
 * virou lei no ano passado e tramitou agora por um despacho burocrático).
 */
export const tramitacoesComMarco = (
  proposicoes: ProposicaoComStatus[],
  inicioDaJanela: string,
): EventoTramitacao[] =>
  proposicoes
    .flatMap<EventoTramitacao>(({ proposicao, status }) => {
      if (!status?.codSituacao || !status.dataHora) return []

      const marco = MARCO_POR_SITUACAO[status.codSituacao]
      if (!marco) return []

      if (status.dataHora.slice(0, 10) < inicioDaJanela) return []

      const sigla = siglaDe(proposicao)
      if (!sigla) return []

      return [
        {
          tipo: "tramitacao",
          id: `camara:${proposicao.id}:${status.codSituacao}`,
          data: status.dataHora,
          casa: "camara",
          marco,
          proposicao: {
            id: String(proposicao.id),
            sigla,
            ementa: proposicao.ementa ?? null,
          },
          despacho: status.despacho ?? null,
        },
      ]
    })
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, TRAMITACOES_NO_FEED)
