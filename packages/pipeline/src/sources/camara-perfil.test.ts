import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { lerFrequenciaDoPerfil } from "./camara-perfil"

// Trecho real do perfil de um deputado no portal (out/2026).
const perfil = readFileSync(new URL("./__fixtures__/perfil-deputado.html", import.meta.url), "utf8")

describe("lerFrequenciaDoPerfil", () => {
  it("lê plenário e comissões, ignorando o cabeçalho escondido", () => {
    expect(lerFrequenciaDoPerfil(perfil)).toEqual({
      plenario: { presencas: 60, ausenciasJustificadas: 0, ausenciasNaoJustificadas: 12 },
      comissoes: { presencas: 12, ausenciasJustificadas: 0, ausenciasNaoJustificadas: 41 },
    })
  })

  it("devolve nulo quando a página não tem o bloco", () => {
    expect(lerFrequenciaDoPerfil("<html></html>")).toEqual({ plenario: null, comissoes: null })
  })
})
