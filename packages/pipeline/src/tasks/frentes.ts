import type { Frente, ParticipacaoEmFrente } from "@politicapp/data"

import type { FrenteApi, MembroFrenteApi } from "../sources/camara"

export type FrenteComMembros = FrenteApi & { membros: MembroFrenteApi[] }

const PAPEL_COMUM = "Membro"

/**
 * Catálogo de frentes + índice deputado → frentes. O papel só é gravado
 * quando difere de "Membro" — coordenações e presidências são exceção e o
 * arquivo tem dezenas de milhares de participações.
 */
export const montarFrentes = (
  frentes: FrenteComMembros[],
): { frentes: Frente[]; porParlamentar: Record<string, ParticipacaoEmFrente[]> } => {
  const porParlamentar: Record<string, ParticipacaoEmFrente[]> = {}

  for (const frente of frentes) {
    for (const membro of frente.membros) {
      const chave = String(membro.id)
      const participacao: ParticipacaoEmFrente = { id: frente.id }
      if (membro.titulo && membro.titulo !== PAPEL_COMUM) {
        participacao.papel = membro.titulo
      }
      ;(porParlamentar[chave] ??= []).push(participacao)
    }
  }

  return {
    frentes: frentes
      .map(({ id, titulo, membros }) => ({
        id,
        titulo,
        totalMembros: membros.length,
      }))
      .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR")),
    porParlamentar,
  }
}
