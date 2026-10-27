import { writeFile } from "node:fs/promises"

import { config, log } from "./config"

/**
 * Cada etapa do pipeline roda isolada: erro é logado e registrado, a etapa
 * não devolve nada (nem escreve), e o resto segue. É o que impede uma fonte
 * do governo com um campo nulo de derrubar o site inteiro por semanas.
 */

export type RegistroEtapa = {
  nome: string
  ok: boolean
  erro: string | null
  duracaoMs: number
}

const registros: RegistroEtapa[] = []

export const registrosDeEtapas = (): readonly RegistroEtapa[] => registros

export const etapasComFalha = () => registros.filter((registro) => !registro.ok)

export const etapa = async <T>(
  nome: string,
  tarefa: () => Promise<T>,
): Promise<T | null> => {
  const inicio = Date.now()
  try {
    const resultado = await tarefa()
    registros.push({ nome, ok: true, erro: null, duracaoMs: Date.now() - inicio })
    log(`etapa "${nome}" ok em ${((Date.now() - inicio) / 1000).toFixed(1)}s`)
    return resultado
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro)
    registros.push({ nome, ok: false, erro: mensagem, duracaoMs: Date.now() - inicio })
    log(`etapa "${nome}" FALHOU em ${((Date.now() - inicio) / 1000).toFixed(1)}s — ${mensagem}`)
    if (erro instanceof Error && erro.stack) log(erro.stack)
    return null
  }
}

/** Etapas que só o job de perfis roda; o ETL diário as mantém no manifest. */
export const ETAPAS_DO_JOB_DE_PERFIS = ["perfis"] as const

/**
 * Etapas que não rodam todo dia (ver o calendário em main.ts): o último
 * sucesso pode ter até uma semana ou um mês, mais folga para uma falha.
 */
export const FRESCOR_POR_ETAPA_HORAS: Readonly<Record<string, number>> = {
  producao: 8 * 24 + 12,
  presenca: 8 * 24 + 12,
  historico: 8 * 24 + 12,
  eleicoes: 36 * 24,
}

/** Etapa que não roda porque uma dependência falhou também conta como falha. */
export const pularEtapa = (nome: string, motivo: string) => {
  registrarFalha(nome, `não rodou: ${motivo}`)
}

/**
 * Falha registrada fora de `etapa()` — ex.: etapa que publicou o que conseguiu
 * mas teve fontes demais falhando. Vale o último registro do nome.
 */
export const registrarFalha = (nome: string, erro: string) => {
  registros.push({ nome, ok: false, erro, duracaoMs: 0 })
  log(`etapa "${nome}" registrada como falha — ${erro}`)
}

/**
 * Fonte que devolve bem menos que da última vez quase sempre está quebrada
 * (página vazia, CSV truncado), não "ficou sem dado". Melhor falhar a etapa e
 * manter o arquivo de ontem do que publicar o encolhimento.
 */
export const exigirVolume = (
  descricao: string,
  atual: number,
  anterior: number | null,
  fracaoMinima = 0.5,
) => {
  if (anterior === null || anterior === 0) return
  if (atual < anterior * fracaoMinima) {
    throw new Error(
      `${descricao}: ${atual} itens contra ${anterior} na última publicação — fonte provavelmente quebrada`,
    )
  }
}

/** Grava as falhas para o workflow decidir o resultado depois do deploy. */
export const gravarStatus = async () => {
  const falhas = etapasComFalha()
  if (falhas.length > 0) {
    log(`${falhas.length} etapa(s) falharam: ${falhas.map((falha) => falha.nome).join(", ")}`)
  }
  if (!config.status) return
  await writeFile(
    config.status,
    falhas.map((falha) => `${falha.nome}: ${falha.erro ?? ""}`).join("\n"),
    "utf-8",
  )
}
