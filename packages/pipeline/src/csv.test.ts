import { describe, expect, it } from "vitest"

import { lerCsv, lerCsvComCabecalho, numeroBr, projetarCsv } from "./csv"

describe("lerCsv", () => {
  it("remove o BOM do início", () => {
    expect(lerCsv('﻿"a";"b"')).toEqual([["a", "b"]])
  })

  it("separa campos entre aspas contendo o separador", () => {
    expect(lerCsv('"a;b";"c"')).toEqual([["a;b", "c"]])
  })

  it("interpreta aspas duplicadas como aspa literal", () => {
    expect(lerCsv('"diz ""oi""";"x"')).toEqual([['diz "oi"', "x"]])
  })

  it("quebra linhas e descarta o retorno de carro", () => {
    expect(lerCsv('"a";"b"\r\n"c";"d"')).toEqual([
      ["a", "b"],
      ["c", "d"],
    ])
  })

  it("preserva quebras de linha dentro de aspas", () => {
    expect(lerCsv('"a\nb";"c"')).toEqual([["a\nb", "c"]])
  })

  it("aceita campos vazios", () => {
    expect(lerCsv('"a";;"c"')).toEqual([["a", "", "c"]])
  })
})

describe("lerCsvComCabecalho", () => {
  it("mapeia colunas por nome", () => {
    expect(lerCsvComCabecalho('"nome";"uf"\n"Ana";"SP"')).toEqual([
      { nome: "Ana", uf: "SP" },
    ])
  })

  it("descarta linhas com número de colunas diferente", () => {
    expect(lerCsvComCabecalho('"nome";"uf"\n"Ana"\n"Bia";"RJ"')).toEqual([
      { nome: "Bia", uf: "RJ" },
    ])
  })

  it("pula linhas de metadados antes do cabeçalho", () => {
    const csv = '"ULTIMA ATUALIZACAO";"09/08/2026"\n"nome";"uf"\n"Ana";"SP"'
    expect(lerCsvComCabecalho(csv, { pularLinhas: 1 })).toEqual([
      { nome: "Ana", uf: "SP" },
    ])
  })

  it("devolve vazio quando não há cabeçalho", () => {
    expect(lerCsvComCabecalho("")).toEqual([])
  })
})

describe("numeroBr", () => {
  it("interpreta decimal com ponto", () => {
    expect(numeroBr("1467.35")).toBe(1467.35)
  })

  it("interpreta decimal com vírgula e milhar", () => {
    expect(numeroBr("1.467,35")).toBe(1467.35)
  })

  it("devolve zero para vazio ou inválido", () => {
    expect(numeroBr("")).toBe(0)
    expect(numeroBr(undefined)).toBe(0)
    expect(numeroBr("abc")).toBe(0)
  })
})

describe("projetarCsv", () => {
  it("guarda só o que a projeção devolve e pula linha com colunas a menos", () => {
    const csv = '\uFEFF"id";"nome";"extra"\n"1";"Ana";"x"\n"2";"Bia"\n"3";"Caio";"y"\n'
    expect(projetarCsv(csv, (linha) => (linha.id === "3" ? null : linha.nome))).toEqual(["Ana"])
  })
})
