import { describe, expect, it } from "vitest"

import {
  agruparVotosPor,
  contarPlacar,
  descricaoSemPlacar,
  placarDaDescricao,
  tipoVotoDaCamara,
  votouEmBloco,
} from "./votacao"
import type { Voto } from "./votacao"

// Descrições copiadas da API da Câmara (votações de plenário de julho/2026).
const NOMINAL =
  "Rejeitada a Emenda de Plenário nº 2. Sim: 134; Não: 285; Abstenção: 2; Total: 421."
const NOMINAL_URGENCIA =
  "Aprovado o Requerimento de Urgência (Art. 155 do RICD). Sim: 276; Não: 139; Abstenção: 1; Total: 416."
const SIMBOLICA = "Aprovada a Medida Provisória nº 1.367, de 2026."
const SIMBOLICA_PARECER = "Aprovado o Parecer, contra o voto do Deputado Rafael Fera."

describe("placarDaDescricao", () => {
  it("extrai o placar de uma votação nominal", () => {
    expect(placarDaDescricao(NOMINAL)).toEqual({
      sim: 134,
      nao: 285,
      abstencao: 2,
      outros: 0,
    })
  })

  it("extrai o placar de um requerimento de urgência", () => {
    expect(placarDaDescricao(NOMINAL_URGENCIA)).toEqual({
      sim: 276,
      nao: 139,
      abstencao: 1,
      outros: 0,
    })
  })

  it("devolve null para votação simbólica", () => {
    expect(placarDaDescricao(SIMBOLICA)).toBeNull()
    expect(placarDaDescricao(SIMBOLICA_PARECER)).toBeNull()
  })

  it("não confunde número de proposição com placar", () => {
    expect(
      placarDaDescricao("Aprovado o Projeto de Lei nº 3.085, de 2026."),
    ).toBeNull()
  })

  it("aceita placar sem abstenção declarada", () => {
    expect(placarDaDescricao("Aprovado. Sim: 470; Não: 1.")).toEqual({
      sim: 470,
      nao: 1,
      abstencao: 0,
      outros: 0,
    })
  })
})

describe("descricaoSemPlacar", () => {
  it("remove a contagem, que o app já mostra como gráfico", () => {
    expect(descricaoSemPlacar(NOMINAL)).toBe("Rejeitada a Emenda de Plenário nº 2.")
  })

  it("deixa a descrição simbólica intacta", () => {
    expect(descricaoSemPlacar(SIMBOLICA)).toBe(SIMBOLICA)
  })
})

describe("contarPlacar", () => {
  const voto = (v: Voto["voto"]): Voto => ({
    casa: "camara",
    id: "1",
    nome: "Fulano",
    partido: "XX",
    uf: "SP",
    voto: v,
  })

  it("agrupa obstrução, ausência e presidência em outros", () => {
    expect(
      contarPlacar([
        voto("sim"),
        voto("sim"),
        voto("nao"),
        voto("abstencao"),
        voto("obstrucao"),
        voto("presidente"),
        voto("ausente"),
      ]),
    ).toEqual({ sim: 2, nao: 1, abstencao: 1, outros: 3 })
  })

  it("devolve placar zerado sem votos", () => {
    expect(contarPlacar([])).toEqual({ sim: 0, nao: 0, abstencao: 0, outros: 0 })
  })
})

describe("agruparVotosPor", () => {
  const voto = (
    partido: string,
    uf: string,
    v: Voto["voto"],
    nome = "Fulano",
  ): Voto => ({ casa: "camara", id: "1", nome, partido, uf, voto: v })

  it("agrupa por partido, do maior grupo para o menor", () => {
    const grupos = agruparVotosPor(
      [
        voto("PT", "SP", "sim"),
        voto("PL", "RJ", "nao"),
        voto("PL", "SP", "nao"),
        voto("PL", "MG", "ausente"),
      ],
      "partido",
    )
    expect(grupos.map((g) => g.grupo)).toEqual(["PL", "PT"])
    expect(grupos[0]?.total).toBe(3)
    expect(grupos[0]?.placar).toEqual({ sim: 0, nao: 2, abstencao: 0, outros: 1 })
  })

  it("desempata grupos do mesmo tamanho por ordem alfabética", () => {
    const grupos = agruparVotosPor(
      [voto("PT", "SP", "sim"), voto("MDB", "RJ", "sim")],
      "partido",
    )
    expect(grupos.map((g) => g.grupo)).toEqual(["MDB", "PT"])
  })

  it("agrupa por UF quando pedido", () => {
    const grupos = agruparVotosPor(
      [voto("PT", "SP", "sim"), voto("PL", "SP", "nao"), voto("PT", "BA", "sim")],
      "uf",
    )
    expect(grupos.map((g) => g.grupo)).toEqual(["SP", "BA"])
  })

  it("aponta a maioria e lista os dissidentes", () => {
    const grupos = agruparVotosPor(
      [
        voto("PT", "SP", "nao"),
        voto("PT", "BA", "nao"),
        voto("PT", "RJ", "sim", "Dissidente"),
        voto("PT", "CE", "abstencao"),
      ],
      "partido",
    )
    expect(grupos[0]?.maioria).toBe("nao")
    expect(grupos[0]?.dissidentes.map((d) => d.nome)).toEqual(["Dissidente"])
  })

  it("empate não tem maioria nem dissidentes", () => {
    const grupos = agruparVotosPor(
      [voto("PT", "SP", "sim"), voto("PT", "BA", "nao")],
      "partido",
    )
    expect(grupos[0]?.maioria).toBeNull()
    expect(grupos[0]?.dissidentes).toEqual([])
  })

  it("grupo só de ausentes não tem maioria", () => {
    const grupos = agruparVotosPor([voto("PT", "SP", "ausente")], "partido")
    expect(grupos[0]?.maioria).toBeNull()
  })
})

describe("votouEmBloco", () => {
  const grupo = (sim: number, nao: number) =>
    agruparVotosPor(
      [
        ...Array.from({ length: sim }, (_, i) =>
          ({ casa: "camara", id: String(i), nome: "A", partido: "PT", uf: "SP", voto: "sim" }) as Voto,
        ),
        ...Array.from({ length: nao }, (_, i) =>
          ({ casa: "camara", id: `n${i}`, nome: "B", partido: "PT", uf: "SP", voto: "nao" }) as Voto,
        ),
      ],
      "partido",
    )[0]!

  it("90% ou mais do mesmo lado é bloco", () => {
    expect(votouEmBloco(grupo(9, 1))).toBe(true)
    expect(votouEmBloco(grupo(8, 2))).toBe(false)
  })

  it("empate não é bloco", () => {
    expect(votouEmBloco(grupo(1, 1))).toBe(false)
  })

  it("grupo sem votos objetivos não é bloco", () => {
    const soAbstencao = agruparVotosPor(
      [
        {
          casa: "camara",
          id: "1",
          nome: "A",
          partido: "PT",
          uf: "SP",
          voto: "abstencao",
        },
      ],
      "partido",
    )[0]!
    expect(votouEmBloco(soAbstencao)).toBe(false)
  })
})

describe("tipoVotoDaCamara", () => {
  it("mapeia os votos conhecidos", () => {
    expect(tipoVotoDaCamara("Sim")).toBe("sim")
    expect(tipoVotoDaCamara(" Não ")).toBe("nao")
  })

  it("trata tipoVoto nulo como ausente em vez de quebrar", () => {
    expect(tipoVotoDaCamara(null)).toBe("ausente")
    expect(tipoVotoDaCamara(undefined)).toBe("ausente")
  })
})
