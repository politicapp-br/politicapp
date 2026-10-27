import type { z } from "zod"

/**
 * Transporte injetado nos clientes: o app passa o dele (timeout + Sentry) e o
 * pipeline o dele (retry, backoff, jitter). Deve validar a resposta com o
 * schema e lançar erro em HTTP não-2xx.
 */
export type FetchJson = <T>(
  url: string,
  schema: z.ZodType<T>,
  options: { source: string; headers?: Record<string, string> },
) => Promise<T>

type Fetcher<A extends unknown[], R> = (fetchJson: FetchJson, ...args: A) => R

/** Amarra o transporte a um cliente, preservando a assinatura de cada função. */
export const bindFetchJson =
  <A extends unknown[], R>(fetcher: Fetcher<A, R>, fetchJson: FetchJson) =>
  (...args: A): R =>
    fetcher(fetchJson, ...args)
