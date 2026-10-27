import { describe, expect, it } from "vitest"

import type { MateriaDouApi } from "../sources/dou"
import {
  ementaDoConteudo,
  montarNormas,
  normaDaMateria,
  NORMAS_NO_FEED,
} from "./normas"
import type { EventoNorma } from "@politicapp/data"

const materia = (parcial: Partial<MateriaDouApi> = {}): MateriaDouApi => ({
  urlTitle: "decreto-n-13.094-de-12-de-agosto-de-2026-725008671",
  title: "DECRETO Nº 13.094, DE 12 DE AGOSTO DE 2026",
  content:
    "DECRETO Nº 13.094, DE 12 DE AGOSTO DE 2026 Regulamenta o Programa Nacional de Combustível Sustentável. O PRESIDENTE DA REPÚBLICA, no uso da atribuição...",
  pubDate: "13/08/2026",
  ...parcial,
})

describe("normaDaMateria", () => {
  it("mapeia decreto numerado com ementa extraída e URL oficial", () => {
    const norma = normaDaMateria(materia(), "2026-08-13")

    expect(norma).toEqual({
      tipo: "norma",
      id: "decreto-n-13.094-de-12-de-agosto-de-2026-725008671",
      data: "2026-08-13",
      especie: "decreto",
      titulo: "Decreto nº 13.094, de 12 de agosto de 2026",
      ementa: "Regulamenta o Programa Nacional de Combustível Sustentável.",
      url: "https://www.in.gov.br/web/dou/-/decreto-n-13.094-de-12-de-agosto-de-2026-725008671",
    })
  })

  it("reconhece lei, lei complementar e medida provisória", () => {
    const especies = [
      "LEI Nº 15.000, DE 13 DE AGOSTO DE 2026",
      "LEI COMPLEMENTAR Nº 215, DE 13 DE AGOSTO DE 2026",
      "MEDIDA PROVISÓRIA Nº 1.385, DE 12 DE AGOSTO DE 2026",
    ].map(
      (title) => normaDaMateria(materia({ title }), "2026-08-13")?.especie,
    )

    expect(especies).toEqual(["lei", "lei", "mpv"])
  })

  it("ignora ato de pessoal, portaria e afins", () => {
    const ignorados = [
      "DECRETO DE 12 DE AGOSTO DE 2026", // sem número: nomeação
      "PORTARIA MCOM Nº 10.000",
      "ACÓRDÃO",
      "DESPACHO DO PRESIDENTE DA REPÚBLICA",
    ].map((title) => normaDaMateria(materia({ title }), "2026-08-13"))

    expect(ignorados).toEqual([null, null, null, null])
  })
})

describe("ementaDoConteudo", () => {
  it("corta o título repetido e a fórmula de promulgação", () => {
    expect(
      ementaDoConteudo(
        "LEI Nº 15.000, DE 13 DE AGOSTO DE 2026",
        "LEI Nº 15.000, DE 13 DE AGOSTO DE 2026  Institui política pública.  O PRESIDENTE DA REPÚBLICA Faço saber...",
      ),
    ).toBe("Institui política pública.")
  })

  it("devolve null para conteúdo vazio ou só título", () => {
    expect(ementaDoConteudo("LEI Nº 1", null)).toBeNull()
    expect(ementaDoConteudo("LEI Nº 1", "LEI Nº 1")).toBeNull()
  })

  it("não corta ementa que menciona o Presidente da República em minúsculas", () => {
    expect(
      ementaDoConteudo(
        "DECRETO Nº 2",
        "DECRETO Nº 2 Delega competência ao Presidente da República em exercício. O PRESIDENTE DA REPÚBLICA decreta...",
      ),
    ).toBe("Delega competência ao Presidente da República em exercício.")
  })

  it("aplica teto quando a fórmula não existe (lei promulgada pelo Senado)", () => {
    const corpo = `LEI Nº 3 ${"Texto integral da lei sem fórmula esperada. ".repeat(30)}`
    const ementa = ementaDoConteudo("LEI Nº 3", corpo)

    expect(ementa?.length).toBeLessThanOrEqual(501)
    expect(ementa?.endsWith("…")).toBe(true)
  })
})

describe("montarNormas", () => {
  const norma = (
    especie: EventoNorma["especie"],
    data: string,
    id: string,
  ): EventoNorma => ({
    tipo: "norma",
    id,
    data,
    especie,
    titulo: id,
    ementa: null,
    url: `https://example.com/${id}`,
  })

  it("prioriza lei e MP no corte, mas devolve por data", () => {
    const decretos = Array.from({ length: NORMAS_NO_FEED }, (_, i) =>
      norma("decreto", "2026-08-13", `decreto-${i}`),
    )
    const lei = norma("lei", "2026-08-10", "lei-antiga")

    const resultado = montarNormas([...decretos, lei])

    expect(resultado).toHaveLength(NORMAS_NO_FEED)
    expect(resultado.at(-1)?.id).toBe("lei-antiga")
    expect(resultado[0]?.data).toBe("2026-08-13")
  })
})
