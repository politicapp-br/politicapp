import type { Casa, ParlamentarRef } from "@politicapp/data"

/**
 * Ordem de renovação do job de perfis: quem não tem alguma das seções vem
 * primeiro, depois quem tem a renovação mais antiga (a pior seção decide).
 * Empate mantém a ordem de entrada.
 */
export const filaDeRenovacao = <S extends string>(
  parlamentares: readonly ParlamentarRef[],
  secoesDa: Record<Casa, readonly S[]>,
  renovadoEm: (ref: ParlamentarRef, secao: S) => string | null,
): ParlamentarRef[] => {
  const antiguidade = (ref: ParlamentarRef) =>
    secoesDa[ref.casa].map((secao) => renovadoEm(ref, secao) ?? "").sort()[0] ?? ""
  return parlamentares
    .map((ref) => ({ ref, chave: antiguidade(ref) }))
    .sort((a, b) => a.chave.localeCompare(b.chave))
    .map(({ ref }) => ref)
}
