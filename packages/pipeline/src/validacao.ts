import type { z } from "zod"

import { log } from "./config"

/**
 * Os tipos das respostas das APIs do governo não garantem nada: em out/2026 a
 * Câmara passou a mandar `tipoVoto: null` e derrubou o pipeline por semanas.
 * Aqui cada item é validado sozinho — item fora do formato é descartado e
 * contado. Se a fração descartada passar do limite, o formato mudou de vez e
 * a etapa falha (mantendo o dado anterior) em vez de publicar meia lista.
 */
export const validarItens = <T>(
  fonte: string,
  itens: readonly unknown[],
  schema: z.ZodType<T>,
  fracaoMaximaDescartada = 0.2,
): T[] => {
  const validos: T[] = []
  let primeiroErro: string | null = null

  for (const item of itens) {
    const analise = schema.safeParse(item)
    if (analise.success) {
      validos.push(analise.data)
    } else {
      primeiroErro ??= analise.error.issues
        .slice(0, 2)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")
    }
  }

  const descartados = itens.length - validos.length
  if (descartados > 0) {
    log(`${fonte}: ${descartados} de ${itens.length} itens fora do formato esperado (${primeiroErro})`)
    if (descartados > itens.length * fracaoMaximaDescartada) {
      throw new Error(
        `${fonte}: ${descartados} de ${itens.length} itens fora do formato — o contrato da API mudou? (${primeiroErro})`,
      )
    }
  }
  return validos
}
