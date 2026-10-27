import * as Sentry from "@sentry/react-native"
import type { z } from "zod"

const TIMEOUT_MS = 15_000

export class ApiError extends Error {
  constructor(
    readonly source: string,
    readonly status: number,
    url: string,
  ) {
    super(`${source}: HTTP ${status} em ${url}`)
  }
}

type Options = {
  /** Identifica a fonte nos erros e no Sentry (ex.: "camara", "estatico/feed"). */
  source: string
  headers?: Record<string, string>
}

export const fetchJson = async <T>(
  url: string,
  schema: z.ZodType<T>,
  { source, headers }: Options,
): Promise<T> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json", ...headers },
    })

    if (!response.ok) {
      throw new ApiError(source, response.status, url)
    }

    const parsed = schema.safeParse(await response.json())

    if (!parsed.success) {
      Sentry.captureException(parsed.error, {
        tags: { source, contract: "broken" },
        extra: { url },
      })
      throw new Error(`${source}: resposta fora do formato esperado`)
    }

    return parsed.data
  } finally {
    clearTimeout(timeout)
  }
}
