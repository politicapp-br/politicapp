import type { z } from "zod"

import {
  agregadosEstaticosSchema,
  benchmarksSchema,
  feedEstaticoSchema,
  indiceSchema,
  mandatoEstaticoSchema,
  manifestSchema,
  partidosEstaticosSchema,
  remuneracaoEstaticaSchema,
  shardParlamentarSchema,
  votacaoEstaticaSchema,
  votacoesEstaticasSchema,
} from "@politicapp/data"

/**
 * Contrato de cada arquivo publicado, o mesmo schema que o app usa.
 * O validador do site publicado audita por esta tabela; arquivo novo no
 * pipeline precisa de uma linha aqui.
 */
export const SCHEMAS_DE_ARQUIVOS: Record<string, z.ZodType> = {
  manifest: manifestSchema,
  parlamentares: indiceSchema,
  benchmarks: benchmarksSchema,
  agregados: agregadosEstaticosSchema,
  votacoes: votacoesEstaticasSchema,
  feed: feedEstaticoSchema,
  remuneracao: remuneracaoEstaticaSchema,
  partidos: partidosEstaticosSchema,
  "interno/mandato": mandatoEstaticoSchema,
}

/** Coleções: um arquivo por entidade, em `{nome}/…`. */
export const SCHEMAS_DE_COLECOES: Record<string, z.ZodType> = {
  parlamentar: shardParlamentarSchema,
  votacao: votacaoEstaticaSchema,
}

export const schemaDoArquivo = (caminho: string): z.ZodType => {
  const schema = SCHEMAS_DE_ARQUIVOS[caminho]
  if (!schema) {
    throw new Error(
      `arquivo "${caminho}" não tem schema em SCHEMAS_DE_ARQUIVOS — todo arquivo publicado precisa de um contrato em @politicapp/data`,
    )
  }
  return schema
}
