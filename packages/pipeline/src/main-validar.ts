import {
  caminhoParlamentar,
  caminhoVotacao,
  indiceSchema,
  manifestSchema,
  votacoesEstaticasSchema,
} from "@politicapp/data"
import type { z } from "zod"

import { config, log } from "./config"
import { buscarTexto, ErroPermanente } from "./http"
import { schemaDoArquivo, SCHEMAS_DE_ARQUIVOS, SCHEMAS_DE_COLECOES } from "./schemas"
import { FRESCOR_POR_ETAPA_HORAS } from "./etapas"

/**
 * Auditoria do site publicado: situação de cada etapa no manifest, contrato
 * de cada arquivo único e de uma amostra de cada coleção, e tamanhos. Roda
 * contra o GitHub Pages (healthcheck em CI) ou contra um servidor local:
 * `pnpm -C packages/pipeline validar [urlBase]`.
 */

const HORAS_DE_FRESCOR = Number(process.env.PIPELINE_FRESCOR_HORAS?.trim() || 48)
if (!Number.isFinite(HORAS_DE_FRESCOR) || HORAS_DE_FRESCOR <= 0) {
  throw new Error(`PIPELINE_FRESCOR_HORAS inválido: "${process.env.PIPELINE_FRESCOR_HORAS}"`)
}

const AVISO_TAMANHO_BYTES = 2 * 1024 * 1024
const AMOSTRA_POR_COLECAO = 5

const base = (process.argv[2] ?? config.dadosUrl).replace(/\/+$/, "")
const urlDe = (caminho: string) => `${base}/${caminho}.json?validar=${Date.now()}`

const problemas: string[] = []
const avisos: string[] = []

/** O CDN do Pages solta 404 espúrio perto de deploys — só vira veredito rechecado. */
const RECHECAGENS_DE_404 = 3

const baixar = async (caminho: string): Promise<{ dados: unknown; bytes: number }> => {
  for (let tentativa = 1; ; tentativa += 1) {
    try {
      const texto = await buscarTexto(urlDe(caminho), { headers: { accept: "application/json" } })
      return { dados: JSON.parse(texto) as unknown, bytes: Buffer.byteLength(texto) }
    } catch (erro) {
      const eh404 = erro instanceof ErroPermanente && erro.message.includes("HTTP 404")
      if (!eh404 || tentativa === RECHECAGENS_DE_404) throw erro
      await new Promise((resolve) => setTimeout(resolve, 2_000))
    }
  }
}

const validar = async <T>(caminho: string, schema: z.ZodType<T>): Promise<T | null> => {
  let baixado: { dados: unknown; bytes: number }
  try {
    baixado = await baixar(caminho)
  } catch (erro) {
    problemas.push(`${caminho}.json: falha ao baixar — ${String(erro)}`)
    return null
  }

  const analise = schema.safeParse(baixado.dados)
  if (!analise.success) {
    problemas.push(
      `${caminho}.json: fora do contrato — ${analise.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    )
    return null
  }

  if (baixado.bytes > AVISO_TAMANHO_BYTES) {
    avisos.push(`${caminho}.json: ${(baixado.bytes / 1024 / 1024).toFixed(1)} MB — pesado para celular`)
  }
  log(`validar: ${caminho}.json ok (${(baixado.bytes / 1024).toFixed(0)} kB)`)
  return analise.data
}

const idadeEmHoras = (iso: string) => (Date.now() - new Date(iso).getTime()) / 3_600_000

const executar = async () => {
  log(`validar: auditando ${base}`)

  const manifest = await validar("manifest", manifestSchema)
  if (!manifest) return

  for (const [nome, situacao] of Object.entries(manifest.etapas)) {
    if (!situacao.ok) problemas.push(`etapa ${nome} falhou na última execução: ${situacao.erro}`)
    if (!situacao.verificadoEm) {
      problemas.push(`etapa ${nome} nunca rodou com sucesso`)
    } else if (idadeEmHoras(situacao.verificadoEm) > (FRESCOR_POR_ETAPA_HORAS[nome] ?? HORAS_DE_FRESCOR)) {
      const limite = FRESCOR_POR_ETAPA_HORAS[nome] ?? HORAS_DE_FRESCOR
      problemas.push(
        `etapa ${nome}: último sucesso há ${idadeEmHoras(situacao.verificadoEm).toFixed(0)}h (limite ${limite}h)`,
      )
    }
  }

  const publicados = new Set(manifest.arquivos.map((arquivo) => arquivo.caminho))
  for (const caminho of Object.keys(SCHEMAS_DE_ARQUIVOS)) {
    // interno/ fica fora do inventário de arquivos de topo, mas é publicado.
    if (caminho !== "manifest" && !caminho.includes("/") && !publicados.has(caminho)) {
      problemas.push(`${caminho}.json não está no manifest (nunca publicado ou removido)`)
    }
  }
  for (const caminho of Object.keys(SCHEMAS_DE_ARQUIVOS)) {
    if (caminho === "manifest") continue
    await validar(caminho, schemaDoArquivo(caminho))
  }

  for (const colecao of manifest.colecoes) {
    // No recesso de janeiro não há votação nominal no ano novo: vazio é aviso.
    if (colecao.itens === 0) avisos.push(`coleção ${colecao.nome} vazia`)
  }

  // Amostra das coleções a partir dos índices que apontam para elas.
  const indice = await validar("parlamentares", indiceSchema)
  for (const parlamentar of (indice?.parlamentares ?? []).slice(0, AMOSTRA_POR_COLECAO)) {
    await validar(caminhoParlamentar(parlamentar), SCHEMAS_DE_COLECOES.parlamentar!)
  }
  const votacoes = await validar("votacoes", votacoesEstaticasSchema)
  for (const votacao of (votacoes?.votacoes ?? []).slice(0, AMOSTRA_POR_COLECAO)) {
    await validar(caminhoVotacao(votacao.casa, votacao.id), SCHEMAS_DE_COLECOES.votacao!)
  }

  for (const aviso of avisos) log(`validar: aviso — ${aviso}`)

  if (problemas.length > 0) {
    for (const problema of problemas) log(`validar: PROBLEMA — ${problema}`)
    log(`validar: ${problemas.length} problema(s) encontrado(s)`)
    process.exitCode = 1
    return
  }
  log("validar: site publicado íntegro")
}

executar().catch((erro: unknown) => {
  log(`validação falhou: ${String(erro)}`)
  process.exitCode = 1
})
