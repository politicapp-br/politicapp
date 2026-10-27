import { describe, expect, it } from "vitest"

import {
  ehBancadaDoGoverno,
  ladoDaOrientacao,
  ladoDoGoverno,
} from "./orientacao"

describe("ladoDaOrientacao", () => {
  it("normaliza os textos da API da Câmara", () => {
    expect(ladoDaOrientacao("Sim")).toBe("sim")
    expect(ladoDaOrientacao("Não")).toBe("nao")
    expect(ladoDaOrientacao("Nao")).toBe("nao")
    expect(ladoDaOrientacao("Liberado")).toBe("liberado")
  })

  it("obstrução e abstenção ficam em outro", () => {
    expect(ladoDaOrientacao("Obstrução")).toBe("outro")
    expect(ladoDaOrientacao("Abstenção")).toBe("outro")
    expect(ladoDaOrientacao(null)).toBe("outro")
  })
})

describe("ehBancadaDoGoverno", () => {
  it("reconhece as variações da liderança do governo", () => {
    expect(ehBancadaDoGoverno("Governo")).toBe(true)
    expect(ehBancadaDoGoverno("GOV.")).toBe(true)
  })

  it("não confunde partido com governo", () => {
    expect(ehBancadaDoGoverno("PT")).toBe(false)
    expect(ehBancadaDoGoverno("Oposição")).toBe(false)
  })
})

describe("ladoDoGoverno", () => {
  it("devolve o lado orientado pelo governo", () => {
    expect(
      ladoDoGoverno([
        { bancada: "PT", lado: "sim" },
        { bancada: "Governo", lado: "nao" },
      ]),
    ).toBe("nao")
  })

  it("voto liberado ou sem orientação do governo devolve null", () => {
    expect(ladoDoGoverno([{ bancada: "Governo", lado: "liberado" }])).toBeNull()
    expect(ladoDoGoverno([{ bancada: "PT", lado: "sim" }])).toBeNull()
  })
})
