import { describe, expect, it } from "vitest"

import { createCamaraClient } from "./camara"
import type { FetchJson } from "./fetch-json"

/** Transporte falso: devolve a resposta crua por trecho de URL, validada pelo schema real. */
const transporteCom = (respostas: Record<string, unknown>): FetchJson =>
  (async (url, schema) => {
    const chave = Object.keys(respostas).find((trecho) => url.includes(trecho))
    if (!chave) throw new Error(`sem resposta para ${url}`)
    return schema.parse(respostas[chave])
  }) as FetchJson

describe("createCamaraClient", () => {
  it("mapeia o deputado para o tipo de domínio com o transporte injetado", async () => {
    const camara = createCamaraClient(
      transporteCom({
        "/deputados/204379": {
          dados: {
            id: 204379,
            nomeCivil: "Fulano de Tal",
            ultimoStatus: {
              nome: "Fulano",
              siglaPartido: "MDB",
              siglaUf: "AP",
              urlFoto: null,
              email: null,
              gabinete: { telefone: "3215-0000", sala: "101" },
            },
            dataNascimento: "1980-01-01",
            municipioNascimento: null,
            ufNascimento: null,
            escolaridade: null,
            urlWebsite: null,
          },
        },
      }),
    )

    await expect(camara.fetchDeputado("204379")).resolves.toMatchObject({
      casa: "camara",
      id: "204379",
      nome: "Fulano",
      partido: "MDB",
      telefone: "3215-0000",
      gabinete: "101",
    })
  })

  it("propaga erro do transporte (o chamador decide o que fazer com ele)", async () => {
    const camara = createCamaraClient(transporteCom({}))
    await expect(camara.fetchDeputado("1")).rejects.toThrow(/sem resposta/)
  })
})
