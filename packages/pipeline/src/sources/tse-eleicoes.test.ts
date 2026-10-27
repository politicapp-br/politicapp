import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { lerDiretorioCentral } from "./tse-eleicoes"

// Diretório central real de votacao_candidato_munzona_2022.zip (out/2026):
// 27 CSVs por UF, o `_BR`, o `_BRASIL` zip64 de vários GB e o leiame.
const diretorio = new Uint8Array(
  readFileSync(new URL("./__fixtures__/munzona-2022-diretorio.bin", import.meta.url)),
)

describe("lerDiretorioCentral", () => {
  const entradas = lerDiretorioCentral(diretorio)

  it("lista os CSVs por UF com posição e tamanho, comprimidos com deflate", () => {
    const csvs = entradas.filter(({ nome }) => nome.endsWith(".csv"))
    expect(csvs).toHaveLength(28)
    expect(csvs.every(({ compressao }) => compressao === 8)).toBe(true)
    expect(entradas.find(({ nome }) => nome.endsWith("_SP.csv"))?.tamanhoComprimido).toBe(93_614_264)
  })

  it("deixa de fora o consolidado zip64, que não cabe em 32 bits", () => {
    expect(entradas.some(({ nome }) => nome.endsWith("_BRASIL.csv"))).toBe(false)
  })
})
