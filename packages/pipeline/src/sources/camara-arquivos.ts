import { log } from "../config"
import { projetarCsv } from "../csv"
import { ErroPermanente, TIMEOUT_ARQUIVO_GRANDE_MS } from "../http"

/**
 * Arquivos em lote da Câmara (`/arquivos/{recurso}/csv/{recurso}-{ano}.csv`),
 * regerados toda madrugada. Um download por ano substitui centenas de
 * requisições paginadas — e não sofre o limite de taxa de `/votacoes/{id}/votos`.
 * Separador `;`, tudo entre aspas, UTF-8 com BOM.
 */
const ARQUIVOS = "https://dadosabertos.camara.leg.br/arquivos"

export class ArquivoSemLinhas extends Error {}

export const urlArquivoCamara = (recurso: string, ano: number) =>
  `${ARQUIVOS}/${recurso}/csv/${recurso}-${ano}.csv`

/** Tentativas seguidas sem receber nenhum byte novo antes de desistir. */
const TENTATIVAS_SEM_PROGRESSO = 5
/** Teto absoluto, para um servidor que entrega um byte por conexão não prender o job. */
const TENTATIVAS_MAXIMAS = 100

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * O servidor de arquivos da Câmara derruba a conexão por volta dos 17 s,
 * antes de terminar os CSVs de dezenas de MB — recomeçar do zero falharia
 * sempre. Ele aceita `Range`, então cada nova tentativa continua de onde a
 * anterior parou; `If-Range` com o ETag garante que as partes são do mesmo
 * arquivo (se ele for regerado no meio, a resposta vem inteira e recomeça).
 */
export const baixarRetomando = async (url: string): Promise<Uint8Array> => {
  let partes: Uint8Array[] = []
  let recebidos = 0
  let total: number | null = null
  let etag: string | null = null
  let ultimoErro: unknown = null
  let completo = false

  let semProgresso = 0
  for (let tentativa = 1; tentativa <= TENTATIVAS_MAXIMAS; tentativa += 1) {
    const antes = recebidos
    try {
      const retomando = recebidos > 0 && etag !== null
      const resposta = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_ARQUIVO_GRANDE_MS),
        headers: {
          "user-agent": "politicapp-pipeline (open source, github.com/politicapp)",
          ...(retomando ? { range: `bytes=${recebidos}-`, "if-range": etag ?? "" } : {}),
        },
      })
      if (resposta.status >= 400 && resposta.status < 500 && resposta.status !== 429) {
        throw new ErroPermanente(`HTTP ${resposta.status} em ${url}`)
      }
      if (!resposta.ok || !resposta.body) throw new Error(`HTTP ${resposta.status} em ${url}`)

      if (resposta.status !== 206) {
        partes = []
        recebidos = 0
        total = Number(resposta.headers.get("content-length")) || null
      } else {
        total = Number(resposta.headers.get("content-range")?.split("/")[1]) || total
      }
      etag = resposta.headers.get("etag")

      const leitor = resposta.body.getReader()
      for (;;) {
        const { done, value } = await leitor.read()
        if (done) break
        partes.push(value)
        recebidos += value.byteLength
      }
      if (total === null || recebidos >= total) {
        completo = true
        break
      }
      throw new Error(`conexão encerrada com ${recebidos}/${total} bytes`)
    } catch (erro) {
      if (erro instanceof ErroPermanente) throw erro
      ultimoErro = erro
      semProgresso = recebidos > antes ? 0 : semProgresso + 1
      if (semProgresso >= TENTATIVAS_SEM_PROGRESSO) break
      log(`câmara: retomando ${url} a partir de ${recebidos} bytes (${String(erro)})`)
      await esperar(500 * (semProgresso + 1))
    }
  }

  if (!completo) {
    throw new Error(`Download incompleto de ${url}: ${String(ultimoErro)}`)
  }

  const conteudo = new Uint8Array(recebidos)
  let posicao = 0
  for (const parte of partes) {
    conteudo.set(parte, posicao)
    posicao += parte.byteLength
  }
  return conteudo
}

/**
 * Baixa o CSV e guarda só o que `projetar` devolve de cada linha: com todas as
 * colunas, os arquivos de proposições passariam de 2 GB de heap.
 */
const baixarArquivo = async <T>(
  recurso: string,
  ano: number,
  projetar: (linha: Record<string, string>) => T | null,
) => {
  const url = urlArquivoCamara(recurso, ano)
  log(`câmara: baixando ${url}`)
  const linhas = projetarCsv(new TextDecoder("utf-8").decode(await baixarRetomando(url)), projetar)
  // Arquivo vazio é sinal de geração quebrada na fonte, não de ano sem dado —
  // exceto no começo do ano corrente, que quem chama trata.
  if (linhas.length === 0) throw new ArquivoSemLinhas(`${url} veio sem linhas`)
  log(`câmara: ${linhas.length} linhas em ${recurso}-${ano}`)
  return linhas
}

const textoOuNulo = (valor: string | undefined) => {
  const limpo = valor?.trim()
  return limpo ? limpo : null
}

/** "2026-06-10T14:46:15" → "2026-06-10"; vazio vira nulo. */
const dataIso = (valor: string | undefined) => textoOuNulo(valor)?.slice(0, 10) ?? null

export type AutoriaEmLote = {
  proposicaoId: string
  deputadoId: string
  /** Primeiro signatário. */
  autor: boolean
}

export const listarAutoriasEmLote = async (ano: number): Promise<AutoriaEmLote[]> =>
  baixarArquivo("proposicoesAutores", ano, (linha) => {
    const proposicaoId = textoOuNulo(linha.idProposicao)
    const deputadoId = textoOuNulo(linha.idDeputadoAutor)
    if (!proposicaoId || !deputadoId) return null
    return { proposicaoId, deputadoId, autor: linha.ordemAssinatura === "1" }
  })

export type ProposicaoEmLote = {
  id: string
  sigla: string
  numero: number
  ano: number
  ementa: string
  apresentadaEm: string | null
  situacao: string | null
}

export const listarProposicoesEmLote = async (
  ano: number,
): Promise<ProposicaoEmLote[]> =>
  baixarArquivo("proposicoes", ano, (linha) => {
    const id = textoOuNulo(linha.id)
    const sigla = textoOuNulo(linha.siglaTipo)
    if (!id || !sigla) return null
    return {
      id,
      sigla,
      numero: Number(linha.numero) || 0,
      ano: Number(linha.ano) || ano,
      ementa: linha.ementa?.trim() ?? "",
      apresentadaEm: dataIso(linha.dataApresentacao),
      situacao: textoOuNulo(linha.ultimoStatus_descricaoSituacao),
    }
  })
