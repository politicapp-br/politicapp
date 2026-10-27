import { z } from "zod"

import { casaSchema } from "./parlamentar"

/**
 * Subsídio acumulado num ano do mandato. `meses` diz quantas folhas mensais
 * entraram na soma — o valor muda em degraus (fev/2023, fev/2025), então a
 * conta certa é somar folha a folha, não multiplicar um valor só.
 */
export const salarioAnualSchema = z.object({
  meses: z.number(),
  total: z.number(),
})

export type SalarioAnual = z.infer<typeof salarioAnualSchema>

/** O que dá para rastrear por pessoa num ano do mandato. */
export const custoAnualSchema = z.object({
  ano: z.number(),
  salario: salarioAnualSchema,
  /** Cota parlamentar (CEAP/CEAPS) reembolsada no ano. */
  cota: z.number(),
  /** Auxílio-moradia recebido — só a Câmara publica valores. */
  moradia: z.number(),
  /** Diárias de viagens oficiais — só o Senado publica. */
  diarias: z.number(),
})

export type CustoAnual = z.infer<typeof custoAnualSchema>

export const mandatoParlamentarSchema = z.object({
  casa: casaSchema,
  id: z.string(),
  /**
   * Quando o exercício atual começou (ISO). No Senado é a posse de cada um —
   * para suplente, a dele. Na Câmara a API não expõe posse individual, então
   * vale o início da legislatura para todos.
   */
  inicioExercicio: z.string(),
  anos: z.array(custoAnualSchema),
})

export type MandatoParlamentar = z.infer<typeof mandatoParlamentarSchema>

/**
 * Custo acumulado do mandato, ano a ano. Anos fechados não mudam: o pipeline
 * os apura uma vez e depois reaproveita do próprio arquivo publicado —
 * `anosApurados` diz quais já estão completos nas fontes principais.
 */
export const mandatoEstaticoSchema = z.object({
  geradoEm: z.string(),
  ano: z.number(),
  anosApurados: z.array(z.number()),
  parlamentares: z.array(mandatoParlamentarSchema),
})

export type MandatoEstatico = z.infer<typeof mandatoEstaticoSchema>
