import { describe, expect, it } from "vitest"

import type { LancamentoDespesa } from "../sources/camara"
import type { LinhaDeCeis } from "../sources/transparencia"
import { cruzarSancoes, dataIso, documentoPublicavel, sancoesVigentes } from "./sancoes"

const HOJE = "2026-08-16"

const linha = (parcial: Partial<LinhaDeCeis>): LinhaDeCeis => ({
  "CPF OU CNPJ DO SANCIONADO": "12345678000199",
  "NOME DO SANCIONADO": "EMPRESA SANCIONADA LTDA",
  "CATEGORIA DA SANÇÃO": "Suspensão",
  "DATA INÍCIO SANÇÃO": "01/01/2026",
  "DATA FINAL SANÇÃO": "31/12/2026",
  "ÓRGÃO SANCIONADOR": "Controladoria-Geral da União",
  "UF ÓRGÃO SANCIONADOR": "DF",
  "ESFERA ÓRGÃO SANCIONADOR": "FEDERAL",
  ...parcial,
})

const lancamento = (
  parcial: Partial<LancamentoDespesa> & Pick<LancamentoDespesa, "parlamentarId">,
): LancamentoDespesa => ({
  ano: 2026,
  mes: 1,
  tipo: "DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR",
  fornecedor: "Empresa Sancionada",
  cnpjCpf: "12.345.678/0001-99",
  valor: 100,
  documentoUrl: null,
  data: null,
  glosa: 0,
  ...parcial,
})

describe("dataIso", () => {
  it("converte dd/mm/aaaa para ISO", () => {
    expect(dataIso("21/11/2017")).toBe("2017-11-21")
  })

  it("devolve nulo para vazio ou formato inesperado", () => {
    expect(dataIso("")).toBeNull()
    expect(dataIso(undefined)).toBeNull()
    expect(dataIso("2017-11-21")).toBeNull()
  })
})

describe("sancoesVigentes", () => {
  it("mantém sanção dentro do prazo e agrupa por documento", () => {
    const vigentes = sancoesVigentes(
      [linha({}), linha({ "CATEGORIA DA SANÇÃO": "Inidoneidade" })],
      HOJE,
    )

    expect(vigentes.get("12345678000199")?.sancoes).toHaveLength(2)
  })

  it("descarta sanção já encerrada ou ainda não iniciada", () => {
    const vigentes = sancoesVigentes(
      [
        linha({ "DATA FINAL SANÇÃO": "01/08/2026" }),
        linha({ "DATA INÍCIO SANÇÃO": "01/09/2026" }),
      ],
      HOJE,
    )

    expect(vigentes.size).toBe(0)
  })

  it("sanção sem data final vale como sem prazo", () => {
    const vigentes = sancoesVigentes([linha({ "DATA FINAL SANÇÃO": "" })], HOJE)

    expect(vigentes.get("12345678000199")?.sancoes[0]?.fim).toBeNull()
  })
})

describe("cruzarSancoes", () => {
  const vigentes = sancoesVigentes([linha({})], HOJE)

  it("cruza por documento normalizado e soma o gasto do ano", () => {
    const { parlamentares, porCasa } = cruzarSancoes(
      [
        {
          casa: "camara",
          lancamentos: [
            lancamento({ parlamentarId: "1", valor: 100 }),
            lancamento({ parlamentarId: "1", valor: 50 }),
            lancamento({ parlamentarId: "2", cnpjCpf: "99999999000199" }),
          ],
        },
      ],
      vigentes,
    )

    expect(parlamentares).toHaveLength(1)
    expect(parlamentares[0]?.fornecedores).toEqual([
      {
        nome: "Empresa Sancionada",
        cnpjCpf: "12345678000199",
        totalGasto: 150,
        sancoes: [
          {
            categoria: "Suspensão",
            orgao: "Controladoria-Geral da União",
            esfera: "FEDERAL",
            inicio: "2026-01-01",
            fim: "2026-12-31",
          },
        ],
      },
    ])
    expect(porCasa).toEqual([{ casa: "camara", parlamentares: 1, total: 150 }])
  })

  it("agrega por casa separadamente", () => {
    const { porCasa } = cruzarSancoes(
      [
        { casa: "camara", lancamentos: [lancamento({ parlamentarId: "1" })] },
        { casa: "senado", lancamentos: [lancamento({ parlamentarId: "9", valor: 30 })] },
      ],
      vigentes,
    )

    expect(porCasa).toEqual([
      { casa: "camara", parlamentares: 1, total: 100 },
      { casa: "senado", parlamentares: 1, total: 30 },
    ])
  })

  it("ignora lançamento sem CNPJ/CPF", () => {
    const { parlamentares } = cruzarSancoes(
      [{ casa: "camara", lancamentos: [lancamento({ parlamentarId: "1", cnpjCpf: null })] }],
      vigentes,
    )

    expect(parlamentares).toEqual([])
  })
})

describe("documentoPublicavel", () => {
  it("mascara CPF como o Portal e mantém CNPJ", () => {
    expect(documentoPublicavel("12345678901")).toBe("***.456.789-**")
    expect(documentoPublicavel("12345678000199")).toBe("12345678000199")
  })
})
