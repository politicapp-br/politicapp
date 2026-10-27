import type { CustoAnual } from "@politicapp/data"
import { describe, expect, it } from "vitest"

import {
  anoDaPosse,
  inicioDaLegislatura,
  legislaturaEmCurso,
  montarMandato,
  type FontesDoAno,
} from "./mandato"

const fontes = (parcial: Partial<FontesDoAno> & Pick<FontesDoAno, "ano">): FontesDoAno => ({
  salarios: [],
  cotas: new Map(),
  moradias: new Map(),
  diarias: new Map(),
  ...parcial,
})

describe("inicioDaLegislatura", () => {
  it("aponta o 1º de fevereiro seguinte à eleição", () => {
    expect(inicioDaLegislatura(2023)).toBe("2023-02-01")
    expect(inicioDaLegislatura(2026)).toBe("2023-02-01")
    expect(inicioDaLegislatura(2027)).toBe("2027-02-01")
    expect(inicioDaLegislatura(2022)).toBe("2019-02-01")
  })

  it("em janeiro do ano de posse a legislatura anterior segue em curso", () => {
    expect(legislaturaEmCurso("2027-01-15")).toBe("2023-02-01")
    expect(legislaturaEmCurso("2027-02-01")).toBe("2027-02-01")
    expect(legislaturaEmCurso("2026-10-27")).toBe("2023-02-01")
  })
})

describe("montarMandato", () => {
  const deputado = {
    casa: "camara" as const,
    id: "1",
    inicioExercicio: "2023-02-01",
  }

  it("desconta os meses anteriores à posse no primeiro ano", () => {
    const [mandato] = montarMandato(
      [deputado],
      [
        fontes({
          ano: 2023,
          salarios: [
            { mes: 1, bruto: 100 },
            { mes: 2, bruto: 200 },
            { mes: 3, bruto: 200 },
          ],
        }),
      ],
      new Map(),
    )

    expect(mandato?.anos).toEqual([
      {
        ano: 2023,
        salario: { meses: 2, total: 400 },
        cota: 0,
        moradia: 0,
        diarias: 0,
      },
    ])
  })

  it("ignora anos anteriores à posse do parlamentar", () => {
    const suplente = { ...deputado, id: "2", inicioExercicio: "2025-04-15" }
    const [mandato] = montarMandato(
      [suplente],
      [
        fontes({ ano: 2024, salarios: [{ mes: 1, bruto: 100 }] }),
        fontes({
          ano: 2025,
          salarios: [
            { mes: 3, bruto: 100 },
            { mes: 4, bruto: 100 },
          ],
        }),
      ],
      new Map(),
    )

    expect(mandato?.anos.map(({ ano }) => ano)).toEqual([2025])
    expect(mandato?.anos[0]?.salario).toEqual({ meses: 1, total: 100 })
  })

  it("cruza cota, moradia e diárias pela chave casa:id", () => {
    const senador = {
      casa: "senado" as const,
      id: "9",
      inicioExercicio: "2019-02-01",
    }
    const [doDeputado, doSenador] = montarMandato(
      [deputado, senador],
      [
        fontes({
          ano: 2024,
          cotas: new Map([
            ["camara:1", 1000],
            ["senado:9", 2000],
          ]),
          moradias: new Map([["camara:1", 300]]),
          diarias: new Map([["senado:9", 50]]),
        }),
      ],
      new Map(),
    )

    expect(doDeputado?.anos[0]).toMatchObject({ cota: 1000, moradia: 300, diarias: 0 })
    expect(doSenador?.anos[0]).toMatchObject({ cota: 2000, moradia: 0, diarias: 50 })
  })

  it("mescla anos do cache com os recém-apurados, em ordem", () => {
    const cacheado: CustoAnual = {
      ano: 2023,
      salario: { meses: 11, total: 1100 },
      cota: 500,
      moradia: 0,
      diarias: 0,
    }
    const [mandato] = montarMandato(
      [deputado],
      [fontes({ ano: 2024, salarios: [{ mes: 1, bruto: 120 }] })],
      new Map([["camara:1", [cacheado]]]),
    )

    expect(mandato?.anos.map(({ ano }) => ano)).toEqual([2023, 2024])
    expect(mandato?.anos[0]).toEqual(cacheado)
  })

  it("descarta cache de anos anteriores à posse atual", () => {
    const cacheado: CustoAnual = {
      ano: 2023,
      salario: { meses: 11, total: 1100 },
      cota: 500,
      moradia: 0,
      diarias: 0,
    }
    const reeleito = { ...deputado, inicioExercicio: "2024-02-01" }
    const [mandato] = montarMandato(
      [reeleito],
      [],
      new Map([["camara:1", [cacheado]]]),
    )

    expect(mandato?.anos).toEqual([])
  })
})

describe("anoDaPosse", () => {
  it("extrai o ano da data ISO", () => {
    expect(anoDaPosse("2019-02-01")).toBe(2019)
  })
})
