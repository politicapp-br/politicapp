import { describe, expect, it } from "vitest"

import { schemaDoArquivo, SCHEMAS_DE_ARQUIVOS, SCHEMAS_DE_COLECOES } from "./schemas"

describe("schemaDoArquivo", () => {
  it("arquivo sem contrato falha alto em vez de passar às cegas", () => {
    expect(() => schemaDoArquivo("arquivo-sem-schema")).toThrow(/não tem schema/)
  })

  it("os contratos rejeitam payload fora do formato", () => {
    for (const [nome, schema] of Object.entries({
      ...SCHEMAS_DE_ARQUIVOS,
      ...SCHEMAS_DE_COLECOES,
    })) {
      expect(schema.safeParse({ inesperado: true }).success, nome).toBe(false)
    }
  })
})
