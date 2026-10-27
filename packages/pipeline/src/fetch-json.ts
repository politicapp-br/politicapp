import type { FetchJson } from "@politicapp/sources"

import { buscarJson, TIMEOUT_MS } from "./http"

/** A requisição começaria depois do prazo do job: quem chama para de buscar. */
export class PrazoEsgotado extends Error {}

/** Abaixo disto, não vale a pena retentar: uma tentativa e pronto. */
const MINIMO_PARA_RETENTAR_MS = 2 * 60_000

/**
 * Transporte do pipeline para os clientes de `@politicapp/sources`: o retry,
 * timeout e jitter de `buscarJson`, mais a validação do schema. 404 sai como
 * `ErroPermanente`, para quem chama decidir com `vazioSe404`.
 *
 * Com `prazo` (epoch ms), nenhuma requisição passa dele: o timeout encolhe
 * até o que resta, os retries somem perto do fim e, esgotado, lança
 * `PrazoEsgotado` — o job termina e publica antes do timeout do Actions.
 */
export const criarFetchJson = ({ prazo }: { prazo?: number } = {}): FetchJson =>
  async (url, schema, { source, headers }) => {
    const restante = prazo === undefined ? Number.POSITIVE_INFINITY : prazo - Date.now()
    if (restante <= 0) throw new PrazoEsgotado(`${source}: prazo do job esgotado`)

    const bruto = await buscarJson<unknown>(url, {
      ...(headers ? { headers } : {}),
      timeoutMs: Math.min(TIMEOUT_MS, restante),
      ...(restante < MINIMO_PARA_RETENTAR_MS ? { tentativas: 1 } : {}),
    })
    const analise = schema.safeParse(bruto)
    if (!analise.success) {
      throw new Error(
        `${source}: resposta fora do formato esperado em ${url} — ${analise.error.issues
          .slice(0, 2)
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`,
      )
    }
    return analise.data
  }

export const fetchJsonDoPipeline = criarFetchJson()
