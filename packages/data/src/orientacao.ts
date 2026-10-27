import { z } from "zod"

/**
 * Orientação de bancada na Câmara: antes de cada votação nominal, as
 * lideranças (partidos, blocos, federações, governo, oposição…) declaram como
 * a bancada deve votar. É o dado que mostra que o voto é combinado em bloco —
 * e permite medir quem segue o governo sem o app rotular ninguém.
 */

export const ladoOrientacaoSchema = z.enum(["sim", "nao", "liberado", "outro"])

export type LadoOrientacao = z.infer<typeof ladoOrientacaoSchema>

export const LADO_ORIENTACAO_LABEL: Record<LadoOrientacao, string> = {
  sim: "Sim",
  nao: "Não",
  liberado: "Voto liberado",
  outro: "Outra",
}

export const orientacaoSchema = z.object({
  /** Sigla da liderança como veio da API ("PT", "Governo", "PsdbCidadania"…). */
  bancada: z.string(),
  lado: ladoOrientacaoSchema,
})

export type Orientacao = z.infer<typeof orientacaoSchema>

const semAcento = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()

/**
 * `orientacaoVoto` da Câmara é texto livre: "Sim", "Não", "Liberado",
 * "Obstrução", "Abstenção"… Obstrução conta como "não" na prática política
 * (é tática para derrubar a votação), mas aqui fica em "outro" para não
 * afirmar mais do que o dado diz. Sim/não exigem igualdade exata: um futuro
 * "Não orientou" não pode virar orientação contrária em silêncio.
 */
export const ladoDaOrientacao = (texto: string | null | undefined): LadoOrientacao => {
  if (!texto) return "outro"
  const normalizado = semAcento(texto)
  if (normalizado === "sim") return "sim"
  if (normalizado === "nao") return "nao"
  if (normalizado.startsWith("liber")) return "liberado"
  return "outro"
}

/** A liderança do governo aparece como "Governo", "GOV." ou variações. */
export const ehBancadaDoGoverno = (bancada: string): boolean =>
  /^gov/.test(semAcento(bancada))

/** O lado orientado pelo governo numa votação, se houve orientação objetiva. */
export const ladoDoGoverno = (
  orientacoes: Orientacao[],
): Extract<LadoOrientacao, "sim" | "nao"> | null => {
  const governo = orientacoes.find((orientacao) =>
    ehBancadaDoGoverno(orientacao.bancada),
  )
  if (!governo) return null
  return governo.lado === "sim" || governo.lado === "nao" ? governo.lado : null
}
