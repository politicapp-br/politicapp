import { describe, expect, it } from "vitest"

import { lerCsvDoTse, separarCampos } from "./tse"

describe("lerCsvDoTse", () => {
  it("lê campos entre aspas separados por ponto e vírgula", () => {
    const linhas = lerCsvDoTse('"SG_PARTIDO";"VR_RECEITA"\r\n"PT";"10,50"\r\n')

    expect(linhas).toEqual([{ SG_PARTIDO: "PT", VR_RECEITA: "10,50" }])
  })

  it("tolera aspas sem escape dentro de um campo", () => {
    const linhas = lerCsvDoTse(
      '"SG_PARTIDO";"NM_DOADOR";"VR_RECEITA"\n"MISSÃO";"GUILHERME SANT"ANA";"326,55"\n"PT";"FULANA";"1,00"',
    )

    expect(linhas).toEqual([
      { SG_PARTIDO: "MISSÃO", NM_DOADOR: 'GUILHERME SANT"ANA', VR_RECEITA: "326,55" },
      { SG_PARTIDO: "PT", NM_DOADOR: "FULANA", VR_RECEITA: "1,00" },
    ])
  })

  it("descarta linha com número de campos diferente do cabeçalho", () => {
    const linhas = lerCsvDoTse('"A";"B"\n"1"\n"2";"3"')

    expect(linhas).toEqual([{ A: "2", B: "3" }])
  })
})

describe("separarCampos", () => {
  it("aceita número sem aspas entre campos de texto, como nos arquivos de 2026", () => {
    expect(separarCampos('"02/10/2022";"AC";7;"DEPUTADO ESTADUAL";10001655357;"#NULO"\r')).toEqual([
      "02/10/2022",
      "AC",
      "7",
      "DEPUTADO ESTADUAL",
      "10001655357",
      "#NULO",
    ])
  })

  it("mantém campos vazios, inclusive no fim", () => {
    expect(separarCampos('"A";;"";3;')).toEqual(["A", "", "", "3", ""])
  })

  it("aspa solta no meio de campo sem aspas não abre campo", () => {
    expect(separarCampos('1;SANT"ANA;"x"')).toEqual(["1", 'SANT"ANA', "x"])
  })
})
