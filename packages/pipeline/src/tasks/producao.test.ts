import { describe, expect, it } from "vitest"

import type { AutoriaEmLote, ProposicaoEmLote } from "../sources/camara-arquivos"
import type { ProcessoSenadoApi } from "../sources/senado-parlamentar"
import { producaoDaCamara, producaoDoSenador } from "./producao"

const proposicao = (
  id: string,
  sigla: string,
  situacao: string | null,
  ano = 2024,
): ProposicaoEmLote => ({
  id,
  sigla,
  numero: Number(id),
  ano,
  ementa: `Ementa ${id}`,
  apresentadaEm: `${ano}-05-0${id.length}`,
  situacao,
})

describe("producaoDaCamara", () => {
  const proposicoes = [
    proposicao("1", "PL", "Transformado em Norma Jurídica"),
    proposicao("2", "PL", "Aguardando Apreciação pelo Senado Federal"),
    proposicao("3", "REQ", "Arquivada"),
    proposicao("4", "PEC", "Aguardando Parecer"),
    proposicao("5", "PL", "Transformado em Norma Jurídica", 2019),
  ]

  it("separa autor e coautor e conta só projetos em `projetos`", () => {
    const autorias: AutoriaEmLote[] = [
      { proposicaoId: "1", deputadoId: "10", autor: true },
      { proposicaoId: "2", deputadoId: "10", autor: false },
      { proposicaoId: "3", deputadoId: "10", autor: true },
      { proposicaoId: "4", deputadoId: "10", autor: false },
      // Linha duplicada: vira autor se em alguma ele for o primeiro.
      { proposicaoId: "4", deputadoId: "10", autor: true },
      { proposicaoId: "5", deputadoId: "10", autor: true },
      { proposicaoId: "1", deputadoId: "99", autor: false },
    ]
    const producao = producaoDaCamara(2023, autorias, proposicoes, new Set(["10"]))
    const deputado = producao.get("camara:10")
    expect(producao.has("camara:99")).toBe(false)
    expect(deputado?.projetos).toEqual({ autor: 2, coautor: 1 })
    expect(deputado?.porTipo).toEqual([
      { sigla: "PL", autor: 1, coautor: 1 },
      { sigla: "PEC", autor: 1, coautor: 0 },
      { sigla: "REQ", autor: 1, coautor: 0 },
    ])
    expect(deputado?.viraramNorma.map((item) => item.identificacao)).toEqual(["PL 1/2024"])
    expect(deputado?.aprovadasNaCasa.map((item) => [item.identificacao, item.autor])).toEqual([
      ["PL 2/2024", false],
    ])
  })
})

describe("producaoDoSenador", () => {
  const processo = (parcial: Partial<ProcessoSenadoApi> & Pick<ProcessoSenadoApi, "id">): ProcessoSenadoApi => ({
    codigoMateria: parcial.id * 10,
    identificacao: `PL ${parcial.id}/2024`,
    ementa: "Ementa",
    autoria: "Senador Alan Rick (UNIÃO/AC)",
    dataApresentacao: "2024-03-01",
    situacaoAtual: "AGUARDANDO DESIGNAÇÃO DO RELATOR",
    ...parcial,
  })

  it("reconhece o primeiro signatário e as situações do Senado", () => {
    const producao = producaoDoSenador(2023, "Alan Rick", [
      processo({ id: 1, situacaoAtual: "TRANSFORMADA EM NORMA JURÍDICA COM VETO PARCIAL" }),
      processo({ id: 2, situacaoAtual: "REMETIDA À CÂMARA DOS DEPUTADOS" }),
      processo({ id: 3, autoria: "Senadora Outra Pessoa (PT/SP), Senador Alan Rick (UNIÃO/AC)" }),
      processo({ id: 4, identificacao: "RQS 4/2024" }),
      processo({ id: 5, dataApresentacao: "2021-01-01" }),
      processo({ id: 1 }),
    ])
    expect(producao.projetos).toEqual({ autor: 2, coautor: 1 })
    expect(producao.viraramNorma.map((item) => item.url)).toEqual([
      "https://www25.senado.leg.br/web/atividade/materias/-/materia/10",
    ])
    expect(producao.aprovadasNaCasa.map((item) => item.id)).toEqual(["2"])
    expect(producao.porTipo).toEqual([
      { sigla: "PL", autor: 2, coautor: 1 },
      { sigla: "RQS", autor: 1, coautor: 0 },
    ])
  })
})
