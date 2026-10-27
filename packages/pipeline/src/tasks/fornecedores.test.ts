import { describe, expect, it } from "vitest"

import type { LancamentoDespesa } from "../sources/camara"
import { detalharFornecedores, semCpfNoNome } from "./fornecedores"

const lancamento = (
  parcial: Partial<LancamentoDespesa> & Pick<LancamentoDespesa, "parlamentarId">,
): LancamentoDespesa => ({
  ano: 2026,
  mes: 1,
  tipo: "DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR",
  fornecedor: "Gráfica Alfa",
  cnpjCpf: "11.111.111/0001-11",
  valor: 100,
  documentoUrl: null,
  data: "2026-01-10",
  glosa: 0,
  ...parcial,
})


describe("detalharFornecedores", () => {
  it("agrupa por documento, calcula fração e marca exclusivos", () => {
    const resultado = detalharFornecedores(
      "camara",
      2026,
      [
        lancamento({ parlamentarId: "1", valor: 300 }),
        lancamento({ parlamentarId: "1", valor: 100, fornecedor: "GRAFICA ALFA LTDA" }),
        lancamento({ parlamentarId: "1", valor: 100, cnpjCpf: "22.222.222/0001-22", fornecedor: "Posto" }),
        lancamento({ parlamentarId: "2", valor: 50, cnpjCpf: "22.222.222/0001-22", fornecedor: "Posto" }),
      ]
    )
    const maria = resultado.get("camara:1")
    expect(maria?.total).toBe(500)
    expect(maria?.quantidade).toBe(2)
    expect(maria?.principais).toEqual([
      expect.objectContaining({ nome: "Gráfica Alfa", total: 400, lancamentos: 2, fracao: 0.8, exclusivo: true }),
      expect.objectContaining({ nome: "Posto", total: 100, exclusivo: false }),
    ])
    expect(maria?.concentracaoTop3).toBe(1)
  })

  it("esconde nome e CPF de pessoa física", () => {
    const maria = detalharFornecedores(
      "camara",
      2026,
      [lancamento({ parlamentarId: "1", fornecedor: "Fulano de Tal", cnpjCpf: "123.456.789-01" })]
    ).get("camara:1")
    expect(maria?.principais[0]).toMatchObject({ nome: "Pessoa física", documento: null })
    expect(maria?.maioresLancamentos[0]?.fornecedor).toBe("Pessoa física")
    expect(maria?.pessoaFisica).toEqual({ valor: 100, lancamentos: 1 })
  })

  it("soma a glosa inclusive de lançamento glosado por inteiro", () => {
    const maria = detalharFornecedores(
      "camara",
      2026,
      [
        lancamento({ parlamentarId: "1", valor: 80, glosa: 20 }),
        lancamento({ parlamentarId: "1", valor: 0, glosa: 150 }),
      ]
    ).get("camara:1")
    expect(maria?.glosado).toBe(170)
    expect(maria?.total).toBe(80)
    expect(maria?.principais[0]?.lancamentos).toBe(1)
  })

  it("no Senado não há glosa", () => {
    const senador = detalharFornecedores("senado", 2026, [lancamento({ parlamentarId: "9" })])
    expect(senador.get("senado:9")).toMatchObject({ glosado: null })
  })

  it("descarta lançamentos de outro ano", () => {
    const resultado = detalharFornecedores("camara", 2026, [lancamento({ parlamentarId: "1", ano: 2025 })])
    expect(resultado.size).toBe(0)
  })
})

describe("semCpfNoNome", () => {
  it("tira o CPF do fim da razão social de MEI", () => {
    expect(semCpfNoNome("FULANO DE TAL 12345678901")).toBe("FULANO DE TAL")
    expect(semCpfNoNome("FULANO DE TAL - 123.456.789-01")).toBe("FULANO DE TAL")
    expect(semCpfNoNome("GRAFICA 2000 LTDA")).toBe("GRAFICA 2000 LTDA")
  })
})
