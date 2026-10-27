import type { Voto } from "@politicapp/data"
import { describe, expect, it } from "vitest"

import { calcularAgregados } from "./agregados"

const voto = (
  id: string,
  partido: string,
  v: Voto["voto"],
  nome = `Parlamentar ${id}`,
): Voto => ({ casa: "camara", id, nome, partido, uf: "SP", voto: v })

// PT fecha "não" nas duas; PL fecha "sim" na 1ª e "não" na 2ª (com dissidente).
const VOTACAO_1 = [
  voto("1", "PT", "nao"),
  voto("2", "PT", "nao"),
  voto("3", "PL", "sim"),
  voto("4", "PL", "sim"),
]
const VOTACAO_2 = [
  voto("1", "PT", "nao"),
  voto("2", "PT", "nao"),
  voto("3", "PL", "nao"),
  voto("4", "PL", "nao"),
  voto("5", "PL", "sim"),
]

describe("calcularAgregados", () => {
  const agregados = calcularAgregados("camara", [{ votos: VOTACAO_1 }, { votos: VOTACAO_2 }])

  it("conta só votações com votos", () => {
    expect(
      calcularAgregados("camara", [{ votos: [] }, { votos: VOTACAO_1 }])
        .votacoesConsideradas,
    ).toBe(1)
    expect(agregados.votacoesConsideradas).toBe(2)
  })

  it("mede a coesão média de cada bancada", () => {
    const pl = agregados.bancadas.find((b) => b.partido === "PL")
    // 1ª votação: 2/2 = 1; 2ª: 2/3. Média ≈ 0,833.
    expect(pl?.coesao).toBeCloseTo(0.833, 3)
    expect(pl?.votacoes).toBe(2)
    expect(pl?.parlamentares).toBe(3)

    const pt = agregados.bancadas.find((b) => b.partido === "PT")
    expect(pt?.coesao).toBe(1)
  })

  it("ordena bancadas por tamanho", () => {
    expect(agregados.bancadas.map((b) => b.partido)).toEqual(["PL", "PT"])
  })

  it("mede a concordância entre pares em ordem alfabética", () => {
    // Discordam na 1ª (PT não × PL sim) e concordam na 2ª (ambos não).
    expect(agregados.concordancias).toEqual([
      { partidoA: "PL", partidoB: "PT", votacoes: 2, concordancia: 0.5 },
    ])
  })

  it("mede o alinhamento de cada parlamentar com o partido", () => {
    const dissidente = agregados.parlamentares.find((p) => p.id === "5")
    expect(dissidente).toMatchObject({ votacoes: 1, comPartido: 0 })

    const fiel = agregados.parlamentares.find((p) => p.id === "3")
    expect(fiel).toMatchObject({ votacoes: 2, comPartido: 2 })
  })

  it("mede o voto com o governo só quando o governo tinha lado", () => {
    const comGoverno = calcularAgregados("camara", [
      { votos: VOTACAO_1, governo: "nao" },
      { votos: VOTACAO_2, governo: null },
    ])
    expect(comGoverno.parlamentares.find((p) => p.id === "1")).toMatchObject({
      votacoesGoverno: 1,
      comGoverno: 1,
    })
    expect(comGoverno.parlamentares.find((p) => p.id === "3")).toMatchObject({
      votacoesGoverno: 1,
      comGoverno: 0,
    })
  })

  it("conta o voto com o governo mesmo quando a bancada empatou", () => {
    const empate = calcularAgregados("camara", [
      { votos: [voto("1", "PT", "sim"), voto("2", "PT", "nao")], governo: "sim" },
    ])
    expect(empate.parlamentares.find((p) => p.id === "1")).toMatchObject({
      votacoes: 0,
      votacoesGoverno: 1,
      comGoverno: 1,
    })
  })

  it("bancada empatada não conta posição nem entra na concordância", () => {
    const empate = calcularAgregados("camara", [
      {
        votos: [
          voto("1", "PT", "sim"),
          voto("2", "PT", "nao"),
          voto("3", "PL", "sim"),
        ],
      },
    ])
    const pt = empate.bancadas.find((b) => b.partido === "PT")
    expect(pt?.votacoes).toBe(0)
    expect(pt?.coesao).toBeNull()
    expect(empate.concordancias).toEqual([])
    // Sem posição da bancada, o voto individual não conta alinhamento.
    expect(empate.parlamentares.find((p) => p.id === "1")).toBeUndefined()
  })

  it("abstenção e ausência não contam para o alinhamento individual", () => {
    const resultado = calcularAgregados("camara", [
      {
        votos: [
          voto("1", "PT", "sim"),
          voto("2", "PT", "sim"),
          voto("3", "PT", "abstencao"),
        ],
      },
    ])
    expect(resultado.parlamentares.find((p) => p.id === "3")).toBeUndefined()
  })

  it("mede o alinhamento das bancadas com o governo", () => {
    const resultado = calcularAgregados("camara", [
      { votos: VOTACAO_1, governo: "sim" },
      { votos: VOTACAO_2, governo: "sim" },
    ])
    // PT fechou "não" nas duas; PL foi "sim" e depois "não".
    expect(resultado.bancadas.find((b) => b.partido === "PT")?.governo).toEqual(
      { votacoes: 2, comGoverno: 0 },
    )
    expect(resultado.bancadas.find((b) => b.partido === "PL")?.governo).toEqual(
      { votacoes: 2, comGoverno: 1 },
    )
  })

  it("sem orientação do governo o campo fica null", () => {
    expect(
      agregados.bancadas.every((bancada) => bancada.governo === null),
    ).toBe(true)
  })

  it("ignora a pseudo-bancada de quem está sem partido", () => {
    const resultado = calcularAgregados("camara", [
      {
        votos: [
          voto("1", "—", "sim"),
          voto("2", "—", "sim"),
          voto("3", "PT", "sim"),
        ],
      },
    ])
    expect(resultado.bancadas.map((b) => b.partido)).toEqual(["PT"])
    expect(resultado.parlamentares.map((p) => p.id)).toEqual(["3"])
  })

  it("casa sem votações devolve agregado vazio", () => {
    expect(calcularAgregados("senado", [])).toEqual({
      casa: "senado",
      votacoesConsideradas: 0,
      bancadas: [],
      concordancias: [],
      parlamentares: [],
    })
  })
})
