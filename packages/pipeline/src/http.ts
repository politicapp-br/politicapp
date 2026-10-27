import { config, log } from "./config"

const TENTATIVAS = 4
const ESPERA_BASE_MS = 500

/**
 * Sem timeout, um socket pendurado numa fonte segura o job inteiro até o
 * timeout do Actions matar a execução do dia. O limite maior cobre os
 * arquivos grandes (zips de cota, emendas, CEIS — dezenas de MB).
 */
export const TIMEOUT_MS = 60_000
export const TIMEOUT_ARQUIVO_GRANDE_MS = 5 * 60_000

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Meio a mais aleatório evita retries sincronizados martelando a fonte. */
const comJitter = (ms: number) => ms * (1 + Math.random())

export type OpcoesBusca = RequestInit & { timeoutMs?: number; tentativas?: number }

const buscar = async <T>(
  url: string,
  init: OpcoesBusca | undefined,
  accept: string,
  ler: (resposta: Response) => Promise<T>,
): Promise<T> => {
  const { timeoutMs = TIMEOUT_MS, tentativas = TENTATIVAS, ...resto } = init ?? {}

  for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
    try {
      const resposta = await fetch(url, {
        ...resto,
        signal: resto.signal
          ? AbortSignal.any([resto.signal, AbortSignal.timeout(timeoutMs)])
          : AbortSignal.timeout(timeoutMs),
        headers: {
          accept,
          "user-agent": "politicapp-pipeline (open source, github.com/politicapp)",
          ...resto.headers,
        },
      })

      if (resposta.status === 429 || resposta.status >= 500) {
        throw new Error(`HTTP ${resposta.status}`)
      }

      if (!resposta.ok) {
        throw new ErroPermanente(`HTTP ${resposta.status} em ${url}`)
      }

      return await ler(resposta)
    } catch (erro) {
      if (erro instanceof ErroPermanente || tentativa === tentativas) throw erro
      const espera = Math.round(comJitter(ESPERA_BASE_MS * 2 ** (tentativa - 1)))
      log(`retry ${tentativa}/${tentativas} em ${espera}ms — ${url}`)
      await esperar(espera)
    }
  }

  throw new Error(`Falha ao buscar ${url}`)
}

export const buscarJson = <T>(url: string, init?: OpcoesBusca): Promise<T> =>
  buscar(url, init, "application/json", (resposta) => resposta.json() as Promise<T>)

/**
 * Para as fontes que só existem como HTML ou CSV. `codificacao` cobre os
 * arquivos legados em Latin-1 que a Câmara e o Senado ainda publicam.
 */
export const buscarTexto = (
  url: string,
  { codificacao = "utf-8", ...init }: OpcoesBusca & { codificacao?: string } = {},
): Promise<string> =>
  buscar(url, init, "text/html,text/csv,*/*", async (resposta) =>
    new TextDecoder(codificacao).decode(await resposta.arrayBuffer()),
  )

/**
 * Sonda barata de existência (HEAD, tentativas e timeout curtos) — para
 * escolher entre URLs candidatas sem pagar o download nem o retry completo
 * em cada uma. `false` só para ausência confirmada (4xx); falha transitória
 * persistente propaga.
 */
export const existeNoAr = async (
  url: string,
  init?: OpcoesBusca,
): Promise<boolean> => {
  try {
    await buscar(
      url,
      { method: "HEAD", tentativas: 2, timeoutMs: 15_000, ...init },
      "*/*",
      async () => undefined,
    )
    return true
  } catch (erro) {
    if (erro instanceof ErroPermanente) return false
    throw erro
  }
}

/** Para os zips e demais binários — mesmo retry/backoff das outras buscas. */
export const buscarBinario = (
  url: string,
  init?: OpcoesBusca,
): Promise<Uint8Array> =>
  buscar(
    url,
    { timeoutMs: TIMEOUT_ARQUIVO_GRANDE_MS, ...init },
    "*/*",
    async (resposta) => new Uint8Array(await resposta.arrayBuffer()),
  )

export class ErroPermanente extends Error {}

/**
 * Para recursos por item (votos de uma votação, membros de uma frente): 404
 * é ausência legítima e vira o valor vazio; qualquer outra falha — que já
 * passou pelos retries — sobe e derruba a etapa, em vez de ser publicada
 * como "não há nada".
 */
export const vazioSe404 =
  <T>(vazio: T, aoAusentar?: () => void) =>
  (erro: unknown): T => {
    if (erro instanceof ErroPermanente && erro.message.includes("HTTP 404")) {
      aoAusentar?.()
      return vazio
    }
    throw erro
  }

/** Etapas opcionais seguem com o valor padrão em vez de derrubar o pipeline. */
export const tolerar = async <T>(
  etapa: string,
  promessa: Promise<T>,
  padrao: T,
): Promise<T> => {
  try {
    return await promessa
  } catch (erro) {
    log(`${etapa} falhou, seguindo sem esse dado — ${String(erro)}`)
    return padrao
  }
}

export const emLotes = async <T, R>(
  itens: T[],
  tarefa: (item: T, indice: number) => Promise<R>,
  concorrencia = config.concorrencia,
): Promise<R[]> => {
  const resultados: R[] = new Array(itens.length)
  let proximo = 0

  const trabalhador = async () => {
    while (proximo < itens.length) {
      const indice = proximo
      proximo += 1
      const item = itens[indice]
      if (item === undefined) continue
      resultados[indice] = await tarefa(item, indice)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concorrencia, itens.length) }, trabalhador),
  )

  return resultados
}
