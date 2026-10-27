import { Inflate, unzipSync } from "fflate"

import { log } from "../config"
import { buscarBinario, ErroPermanente, TIMEOUT_ARQUIVO_GRANDE_MS } from "../http"
import { lerCsvDoTse, separarCampos } from "./tse"

/**
 * Repositório de dados eleitorais do TSE: um zip por ano e tema, com um CSV
 * por UF e, nos menores, um consolidado `_BRASIL`. Latin-1, `;`, aspas em
 * todos os campos de texto.
 */
const CDN = "https://cdn.tse.jus.br/estatistica/sead/odsele"

export const urlTse = (tema: string, ano: number) => `${CDN}/${tema}/${tema}_${ano}.zip`

/** Cargos que interessam: os que quem está no Congresso disputou e os da transição de 2026. */
export const CARGOS_TSE = new Map<number, string>([
  [1, "Presidente"],
  [2, "Vice-presidente"],
  [3, "Governador(a)"],
  [4, "Vice-governador(a)"],
  [5, "Senador(a)"],
  [6, "Deputado(a) Federal"],
  [7, "Deputado(a) Estadual"],
  [8, "Deputado(a) Distrital"],
  // Suplente de senador entra na chapa do titular, sem voto próprio.
  [9, "1º suplente de senador"],
  [10, "2º suplente de senador"],
  [11, "Prefeito(a)"],
  [13, "Vereador(a)"],
])

const latin1 = new TextDecoder("iso-8859-1")

const consolidado = async (tema: string, ano: number) => {
  const url = urlTse(tema, ano)
  log(`tse: baixando ${url}`)
  const nome = `${tema}_${ano}_BRASIL.csv`
  // Só o consolidado: inflar os CSVs por UF junto dobraria a memória à toa.
  const zip = unzipSync(await buscarBinario(url, { timeoutMs: TIMEOUT_ARQUIVO_GRANDE_MS }), {
    filter: (arquivo) => arquivo.name === nome,
  })
  const arquivo = zip[nome]
  if (!arquivo) throw new Error(`Zip ${url} não contém ${nome}`)
  const linhas = lerCsvDoTse(latin1.decode(arquivo))
  if (linhas.length === 0) throw new Error(`${nome} veio sem linhas`)
  log(`tse: ${linhas.length} linhas em ${nome}`)
  return linhas
}

const campo = (valor: string | undefined) => {
  const limpo = valor?.trim()
  return limpo && !limpo.startsWith("#") && limpo !== "-1" && limpo !== "-4" ? limpo : null
}

export type CandidatoTse = {
  sq: string
  ano: number
  turno: number
  cargo: number
  uf: string
  /** Município da disputa (eleição municipal); nulo na geral. */
  municipio: string | null
  cpf: string | null
  nome: string
  nomeUrna: string
  partido: string
  numero: string
  /** `DS_SIT_TOT_TURNO` como vem: "ELEITO POR QP", "SUPLENTE", "2º TURNO"… */
  situacaoTurno: string | null
}

export const lerCandidatosTse = (linhas: Record<string, string>[], ano: number): CandidatoTse[] =>
  linhas.flatMap((linha) => {
    const cargo = Number(linha.CD_CARGO)
    const sq = campo(linha.SQ_CANDIDATO)
    if (!sq || !CARGOS_TSE.has(cargo)) return []
    const abrangencia = (linha.TP_ABRANGENCIA ?? "").toUpperCase()
    return [
      {
        sq,
        ano,
        turno: Number(linha.NR_TURNO) || 1,
        cargo,
        uf: campo(linha.SG_UF) ?? "BR",
        municipio: abrangencia.startsWith("MUNICIPAL") ? campo(linha.NM_UE) : null,
        cpf: campo(linha.NR_CPF_CANDIDATO)?.replace(/\D/g, "") || null,
        nome: linha.NM_CANDIDATO?.trim() ?? "",
        nomeUrna: linha.NM_URNA_CANDIDATO?.trim() ?? "",
        partido: campo(linha.SG_PARTIDO) ?? "—",
        numero: campo(linha.NR_CANDIDATO) ?? "",
        situacaoTurno: campo(linha.DS_SIT_TOT_TURNO),
      },
    ]
  })

export const listarCandidatosTse = async (ano: number): Promise<CandidatoTse[]> =>
  lerCandidatosTse(await consolidado("consulta_cand", ano), ano)

/** Soma dos bens declarados por candidatura (`SQ_CANDIDATO`). */
export const somarBensTse = async (ano: number): Promise<Map<string, number>> => {
  const total = new Map<string, number>()
  for (const linha of await consolidado("bem_candidato", ano)) {
    const sq = campo(linha.SQ_CANDIDATO)
    if (!sq) continue
    const valor = Number((linha.VR_BEM_CANDIDATO ?? "").replace(/\./g, "").replace(",", "."))
    if (Number.isFinite(valor)) total.set(sq, (total.get(sq) ?? 0) + valor)
  }
  return total
}

export type VotosPorMunicipio = Map<string, Map<string, number>>

/** Chave de município no mapa de votos: "UF|NOME" com o nome como o TSE escreve. */
export const chaveMunicipio = (uf: string, municipio: string) => `${uf}|${municipio}`

const USER_AGENT = "politicapp-pipeline (open source, github.com/politicapp)"
const TENTATIVAS_POR_ENTRADA = 3

const buscarFaixa = async (url: string, inicio: number, fim: number) => {
  const resposta = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_ARQUIVO_GRANDE_MS),
    headers: { "user-agent": USER_AGENT, range: `bytes=${inicio}-${fim}` },
  })
  if (resposta.status !== 206 || !resposta.body) {
    const erro = `HTTP ${resposta.status} (esperado 206) em ${url}`
    throw resposta.status >= 400 && resposta.status < 500 ? new ErroPermanente(erro) : new Error(erro)
  }
  return resposta
}

export type EntradaZip = {
  nome: string
  compressao: number
  tamanhoComprimido: number
  inicioCabecalho: number
}

/**
 * Lê o diretório central do zip pelo fim do arquivo. Entradas com campos de
 * 32 bits estourados (zip64, como o `_BRASIL` de vários GB) não são lidas por
 * esta função — só as que cabem em 32 bits, que são as por UF.
 */
export const lerDiretorioCentral = (diretorio: Uint8Array): EntradaZip[] => {
  const dados = new DataView(diretorio.buffer, diretorio.byteOffset, diretorio.byteLength)
  const entradas: EntradaZip[] = []
  let posicao = 0
  while (posicao + 46 <= diretorio.byteLength && dados.getUint32(posicao, true) === 0x02014b50) {
    const compressao = dados.getUint16(posicao + 10, true)
    const tamanhoComprimido = dados.getUint32(posicao + 20, true)
    const tamanhoNome = dados.getUint16(posicao + 28, true)
    const tamanhoExtra = dados.getUint16(posicao + 30, true)
    const tamanhoComentario = dados.getUint16(posicao + 32, true)
    const inicioCabecalho = dados.getUint32(posicao + 42, true)
    const nome = latin1.decode(diretorio.subarray(posicao + 46, posicao + 46 + tamanhoNome))
    if (tamanhoComprimido !== 0xffffffff && inicioCabecalho !== 0xffffffff) {
      entradas.push({ nome, compressao, tamanhoComprimido, inicioCabecalho })
    }
    posicao += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario
  }
  return entradas
}

const listarEntradas = async (url: string): Promise<EntradaZip[]> => {
  const cabeca = await fetch(url, { method: "HEAD", headers: { "user-agent": USER_AGENT } })
  const tamanho = Number(cabeca.headers.get("content-length"))
  if (!cabeca.ok || !tamanho) throw new Error(`HEAD ${url}: HTTP ${cabeca.status}`)

  const fim = new Uint8Array(
    await (await buscarFaixa(url, Math.max(0, tamanho - 65_536), tamanho - 1)).arrayBuffer(),
  )
  const dados = new DataView(fim.buffer)
  let eocd = -1
  for (let i = fim.byteLength - 22; i >= 0; i -= 1) {
    if (dados.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error(`${url}: fim do diretório central não encontrado`)
  const tamanhoDiretorio = dados.getUint32(eocd + 12, true)
  const inicioDiretorio = dados.getUint32(eocd + 16, true)
  if (inicioDiretorio === 0xffffffff) throw new Error(`${url}: diretório central zip64 não suportado`)

  const diretorio = new Uint8Array(
    await (await buscarFaixa(url, inicioDiretorio, inicioDiretorio + tamanhoDiretorio - 1)).arrayBuffer(),
  )
  return lerDiretorioCentral(diretorio)
}

/** Descomprime uma entrada em fluxo, entregando linhas inteiras. */
const lerLinhasDaEntrada = async (
  url: string,
  entrada: EntradaZip,
  aoLer: (linha: string) => void,
) => {
  if (entrada.compressao !== 8) throw new Error(`${entrada.nome}: compressão ${entrada.compressao}`)
  const cabecalho = new DataView(
    await (await buscarFaixa(url, entrada.inicioCabecalho, entrada.inicioCabecalho + 29)).arrayBuffer(),
  )
  const inicio =
    entrada.inicioCabecalho + 30 + cabecalho.getUint16(26, true) + cabecalho.getUint16(28, true)
  const resposta = await buscarFaixa(url, inicio, inicio + entrada.tamanhoComprimido - 1)

  const decodificador = new TextDecoder("iso-8859-1")
  let resto = ""
  let terminou = false
  const inflar = new Inflate((pedaco, final) => {
    const texto = resto + decodificador.decode(pedaco, { stream: !final })
    const linhas = texto.split("\n")
    resto = final ? "" : (linhas.pop() ?? "")
    for (const linha of linhas) aoLer(linha)
    if (final) terminou = true
  })

  const leitor = resposta.body?.getReader()
  if (!leitor) throw new Error(`${entrada.nome}: resposta sem corpo`)
  let recebidos = 0
  let lido = false
  try {
    for (;;) {
      const { done, value } = await leitor.read()
      if (done) break
      recebidos += value.byteLength
      inflar.push(value, recebidos >= entrada.tamanhoComprimido)
    }
    lido = true
  } finally {
    // Erro no meio (inflate ou parser) não pode deixar o socket aberto.
    if (!lido) await leitor.cancel().catch(() => undefined)
  }
  if (!terminou) throw new Error(`${entrada.nome}: fluxo comprimido incompleto (${recebidos} bytes)`)
}

/**
 * Votos nominais válidos do 1º turno por candidatura e município, só das
 * candidaturas pedidas. O zip tem centenas de MB e um consolidado zip64 de
 * vários GB que repete as UFs: em vez de baixar tudo, lê o diretório central
 * e busca por `Range` só os CSVs por UF (e o `_BR`, de presidente).
 */
export const somarVotosPorMunicipio = async (
  ano: number,
  candidaturas: Set<string>,
): Promise<VotosPorMunicipio> => {
  const url = urlTse("votacao_candidato_munzona", ano)
  log(`tse: lendo por partes ${url}`)
  const entradas = (await listarEntradas(url)).filter(
    ({ nome }) => nome.endsWith(".csv") && !nome.endsWith("_BRASIL.csv"),
  )
  if (entradas.length === 0) throw new Error(`${url} sem CSV por UF`)

  const votos: VotosPorMunicipio = new Map()
  let linhasLidas = 0
  let linhasMalformadas = 0

  // Os campos são fatias da linha, e no V8 fatia segura a string inteira de
  // onde saiu — o pedaço descomprimido, de dezenas de KB. Guardar uma fatia
  // como chave prenderia um pedaço por município e estoura a memória. As
  // chaves guardadas são sempre cópias independentes.
  const sqCanonico = new Map([...candidaturas].map((sq) => [sq, sq]))
  const chaves = new Map<string, string>()
  const chaveIndependente = (chave: string) => {
    const existente = chaves.get(chave)
    if (existente !== undefined) return existente
    const copia = JSON.parse(JSON.stringify(chave)) as string
    chaves.set(copia, copia)
    return copia
  }

  for (const entrada of entradas) {
    // Votos parciais de uma UF que caiu no meio não podem somar com a nova tentativa.
    const daEntrada: VotosPorMunicipio = new Map()
    for (let tentativa = 1; ; tentativa += 1) {
      daEntrada.clear()
      let indices: { colunas: number; sq: number; uf: number; municipio: number; votos: number; turno: number } | null = null
      try {
        await lerLinhasDaEntrada(url, entrada, (linha) => {
          const campos = separarCampos(linha)
          if (campos.length === 0) return
          if (!indices) {
            const posicao = (nome: string) => {
              const indice = campos.indexOf(nome)
              if (indice < 0) throw new Error(`${entrada.nome} sem coluna ${nome}`)
              return indice
            }
            indices = {
              colunas: campos.length,
              sq: posicao("SQ_CANDIDATO"),
              uf: posicao("SG_UF"),
              municipio: posicao("NM_MUNICIPIO"),
              votos: posicao("QT_VOTOS_NOMINAIS_VALIDOS"),
              turno: posicao("NR_TURNO"),
            }
            return
          }
          linhasLidas += 1
          if (campos.length !== indices.colunas) {
            linhasMalformadas += 1
            return
          }
          const sq = sqCanonico.get(campos[indices.sq] ?? "")
          if (sq === undefined || campos[indices.turno] !== "1") return
          const chave = chaveIndependente(
            chaveMunicipio(campos[indices.uf] ?? "", campos[indices.municipio] ?? ""),
          )
          const doCandidato = daEntrada.get(sq) ?? new Map<string, number>()
          doCandidato.set(chave, (doCandidato.get(chave) ?? 0) + (Number(campos[indices.votos]) || 0))
          daEntrada.set(sq, doCandidato)
        })
        break
      } catch (erro) {
        if (erro instanceof ErroPermanente || tentativa >= TENTATIVAS_POR_ENTRADA) throw erro
        log(`tse: ${entrada.nome} falhou (${String(erro)}), tentando de novo`)
      }
    }
    for (const [sq, porMunicipio] of daEntrada) {
      const doCandidato = votos.get(sq) ?? new Map<string, number>()
      for (const [chave, quantidade] of porMunicipio) {
        doCandidato.set(chave, (doCandidato.get(chave) ?? 0) + quantidade)
      }
      votos.set(sq, doCandidato)
    }
  }

  // Parser fora de sincronia com o formato vira "zero votos" em silêncio;
  // melhor derrubar a etapa.
  if (linhasMalformadas > linhasLidas * 0.01) {
    throw new Error(`${url}: ${linhasMalformadas} de ${linhasLidas} linhas com colunas a mais ou a menos`)
  }
  if (candidaturas.size > 0 && votos.size === 0) {
    throw new Error(`${url}: nenhuma das ${candidaturas.size} candidaturas pedidas teve voto`)
  }

  log(`tse: votos de ${votos.size} candidaturas em ${entradas.length} arquivos de ${ano}`)
  return votos
}
