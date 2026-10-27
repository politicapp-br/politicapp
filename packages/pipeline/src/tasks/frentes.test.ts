import { describe, expect, it } from "vitest"

import { montarFrentes } from "./frentes"

describe("montarFrentes", () => {
  it("monta o catálogo em ordem alfabética com o total de membros", () => {
    const { frentes } = montarFrentes([
      { id: 2, titulo: "Frente da Zootecnia", membros: [{ id: 10, titulo: "Membro" }] },
      { id: 1, titulo: "Frente do Agro", membros: [] },
    ])

    expect(frentes).toEqual([
      { id: 2, titulo: "Frente da Zootecnia", totalMembros: 1 },
      { id: 1, titulo: "Frente do Agro", totalMembros: 0 },
    ])
  })

  it("indexa as frentes de cada deputado", () => {
    const { porParlamentar } = montarFrentes([
      {
        id: 1,
        titulo: "Frente A",
        membros: [
          { id: 10, titulo: "Membro" },
          { id: 20, titulo: "Membro" },
        ],
      },
      { id: 2, titulo: "Frente B", membros: [{ id: 10, titulo: "Membro" }] },
    ])

    expect(porParlamentar["10"]?.map((participacao) => participacao.id)).toEqual([1, 2])
    expect(porParlamentar["20"]?.map((participacao) => participacao.id)).toEqual([1])
  })

  it("só grava o papel quando difere de Membro", () => {
    const { porParlamentar } = montarFrentes([
      {
        id: 1,
        titulo: "Frente A",
        membros: [
          { id: 10, titulo: "Coordenador" },
          { id: 20, titulo: "Membro" },
          { id: 30, titulo: null },
        ],
      },
    ])

    expect(porParlamentar["10"]).toEqual([{ id: 1, papel: "Coordenador" }])
    expect(porParlamentar["20"]).toEqual([{ id: 1 }])
    expect(porParlamentar["30"]).toEqual([{ id: 1 }])
  })
})
