import { describe, expect, it } from "vitest"

import type { IndiceParlamentar } from "@politicapp/data"

import type { LinhaDeReceita } from "../sources/tse"
import {
  agregarReceitasPartidarias,
  chaveDeSigla,
  lideresVigentes,
  montarPartidos,
} from "./partidos"

const parlamentar = (
  parcial: Partial<IndiceParlamentar> & Pick<IndiceParlamentar, "id" | "partido">,
): IndiceParlamentar => ({
  casa: "camara",
  nome: "Parlamentar",
  nomeCivil: null,
  uf: "SP",
  fotoUrl: null,
  email: null,
  emExercicio: true,
  gastoAno: 0,
  participacaoPercentual: null,
  votacoesParticipadas: null,
  ...parcial,
})

describe("chaveDeSigla", () => {
  it("normaliza caixa e espaços", () => {
    expect(chaveDeSigla("PC do B")).toBe(chaveDeSigla("PCdoB"))
  })

  it("traduz apelidos do TSE", () => {
    expect(chaveDeSigla("SDD")).toBe(chaveDeSigla("SOLIDARIEDADE"))
  })
})

describe("lideresVigentes", () => {
  it("mantém só títulos de liderança ainda em vigor, com o líder na frente", () => {
    const lideres = lideresVigentes([
      { id: 2, nome: "Vice", titulo: "Vice-Líder", dataInicio: "2025-01-01", dataFim: null },
      { id: 1, nome: "Líder Atual", titulo: "Líder", dataInicio: "2025-01-01", dataFim: null },
      { id: 3, nome: "Antigo", titulo: "Líder", dataInicio: "2023-01-01", dataFim: "2024-12-31" },
      { id: 4, nome: "Presidente", titulo: "Presidente", dataInicio: "2025-01-01", dataFim: null },
    ])

    expect(lideres).toEqual([
      { id: "1", nome: "Líder Atual", titulo: "Líder" },
      { id: "2", nome: "Vice", titulo: "Vice-Líder" },
    ])
  })
})

describe("montarPartidos", () => {
  const catalogo = [
    { id: 10, sigla: "PT", nome: "Partido dos Trabalhadores", lideres: [] },
  ]

  it("apura bancada, gasto e participação por casa", () => {
    const partidos = montarPartidos(
      catalogo,
      [
        parlamentar({ id: "1", partido: "PT", gastoAno: 100, participacaoPercentual: 90 }),
        parlamentar({ id: "2", partido: "PT", gastoAno: 300, participacaoPercentual: 70 }),
        parlamentar({ id: "3", partido: "PT", casa: "senado", gastoAno: 50 }),
      ],
      new Map(),
    )

    expect(partidos[0]?.bancadas).toEqual([
      {
        casa: "camara",
        membros: 2,
        gastoTotal: 400,
        gastoMediano: 200,
        participacaoMediana: 80,
      },
      {
        casa: "senado",
        membros: 1,
        gastoTotal: 50,
        gastoMediano: 50,
        participacaoMediana: null,
      },
    ])
  })

  it("cria entrada para sigla que só aparece no índice", () => {
    const partidos = montarPartidos(
      catalogo,
      [parlamentar({ id: "1", partido: "NOVO" })],
      new Map(),
    )

    expect(partidos.map((partido) => partido.sigla)).toEqual(["NOVO", "PT"])
    expect(partidos[0]?.nome).toBe("NOVO")
  })

  it("liga as finanças pela sigla normalizada", () => {
    const financas = {
      ano: 2026,
      total: 10,
      fundos: 8,
      demais: 2,
      topDoadores: [],
      fonteUrl: "https://exemplo",
    }
    const partidos = montarPartidos(
      [{ id: 11, sigla: "PCdoB", nome: "Partido Comunista do Brasil", lideres: [] }],
      [],
      new Map([[chaveDeSigla("PC do B"), financas]]),
    )

    expect(partidos[0]?.financas).toEqual(financas)
  })
})

describe("agregarReceitasPartidarias", () => {
  const receita = (parcial: Partial<LinhaDeReceita>): LinhaDeReceita => ({
    SG_PARTIDO: "PT",
    DS_TP_ORIGEM_DOACAO: "Recursos de Pessoas Físicas",
    DS_TP_FONTE_RECURSO: "Outros Recursos",
    NR_CPF_CNPJ_DOADOR: "02966341157",
    NM_DOADOR: "Doadora Pessoa Física",
    VR_RECEITA: "1000",
    ...parcial,
  })

  it("separa dinheiro público (cotas dos fundos) das demais receitas", () => {
    const financas = agregarReceitasPartidarias(
      [
        receita({
          DS_TP_ORIGEM_DOACAO: "Cotas do Fundo Partidário",
          DS_TP_FONTE_RECURSO: "Fundo Partidário",
          NM_DOADOR: "TRIBUNAL SUPERIOR ELEITORAL",
          VR_RECEITA: "9000",
        }),
        receita({ VR_RECEITA: "1234,56" }),
      ],
      2026,
      "https://fonte",
    ).get(chaveDeSigla("PT"))

    expect(financas?.total).toBe(10234.56)
    expect(financas?.fundos).toBe(9000)
    expect(financas?.demais).toBe(1234.56)
    // O repasse do TSE não entra na lista de doadores.
    expect(financas?.topDoadores.map((doador) => doador.nome)).toEqual([
      "Doadora Pessoa Física",
    ])
  })

  it("soma o mesmo doador e publica documento só quando é CNPJ", () => {
    const financas = agregarReceitasPartidarias(
      [
        receita({}),
        receita({ VR_RECEITA: "500" }),
        receita({
          NM_DOADOR: "Instituto Empresa",
          NR_CPF_CNPJ_DOADOR: "12345678000199",
          VR_RECEITA: "2000",
        }),
      ],
      2026,
      "https://fonte",
    ).get(chaveDeSigla("PT"))

    expect(financas?.topDoadores).toEqual([
      { nome: "Instituto Empresa", documento: "12345678000199", valor: 2000 },
      { nome: "Doadora Pessoa Física", documento: null, valor: 1500 },
    ])
  })

  it("ignora doador #NULO# na lista de doadores sem perder o valor do total", () => {
    const financas = agregarReceitasPartidarias(
      [receita({ NM_DOADOR: "#NULO#", NR_CPF_CNPJ_DOADOR: "#NULO#" })],
      2026,
      "https://fonte",
    ).get(chaveDeSigla("PT"))

    expect(financas?.total).toBe(1000)
    expect(financas?.topDoadores).toEqual([])
  })
})
