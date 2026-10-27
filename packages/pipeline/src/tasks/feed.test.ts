import { describe, expect, it } from "vitest"

import type { VotacaoCamaraApi } from "../sources/camara"
import type { VotacaoSenadoApi } from "../sources/senado"
import {
  montarEventos,
  montarFeed,
  montarVotosDoFeed,
  simbolicasDaCamara,
  simbolicasDoSenado,
  votacaoDaCamara,
  votacaoSimbolicaDaCamara,
  SIMBOLICAS_NO_FEED,
  type VotacaoComVotos,
} from "./feed"

const votacaoCamara = (
  parcial: Partial<VotacaoCamaraApi> = {},
): VotacaoCamaraApi => ({
  id: "2641709-1",
  data: "2026-08-12",
  descricao: "Aprovado o requerimento de destaque.",
  siglaOrgao: "PLEN",
  aprovacao: 1,
  proposicaoObjeto: "PL 1234/2025",
  ...parcial,
})

const semVotos = (votacao: VotacaoCamaraApi): VotacaoComVotos => ({
  votacao,
  votos: [],
})

describe("simbolicasDaCamara", () => {
  it("mantém só simbólica com resultado e proposição que muda lei", () => {
    const simbolicas = simbolicasDaCamara([
      semVotos(votacaoCamara({ id: "a" })),
      semVotos(votacaoCamara({ id: "b", proposicaoObjeto: "REQ 75/2026" })),
      semVotos(votacaoCamara({ id: "c", proposicaoObjeto: null })),
      semVotos(votacaoCamara({ id: "d", aprovacao: null })),
      {
        votacao: votacaoCamara({ id: "e" }),
        votos: [
          {
            tipoVoto: "Sim",
            deputado_: { id: 1, nome: "X", siglaPartido: null, siglaUf: null },
          },
        ],
      },
    ])

    expect(simbolicas.map((votacao) => votacao.id)).toEqual(["a"])
  })

  it("reconhece pela descrição quando a proposição vem nula", () => {
    const aceitas = simbolicasDaCamara([
      semVotos(
        votacaoCamara({
          id: "pl",
          proposicaoObjeto: null,
          descricao: "Aprovado o Projeto de Lei nº 5.189, de 2019.",
        }),
      ),
      semVotos(
        votacaoCamara({
          id: "pec",
          proposicaoObjeto: null,
          descricao: "Rejeitada a Proposta de Emenda à Constituição nº 3, de 2026.",
        }),
      ),
      semVotos(
        votacaoCamara({
          id: "redacao",
          proposicaoObjeto: null,
          descricao: "Aprovada a Redação Final assinada pela relatora.",
        }),
      ),
      semVotos(
        votacaoCamara({
          id: "subemenda",
          proposicaoObjeto: null,
          descricao: "Aprovada a Subemenda Substitutiva Global.",
        }),
      ),
    ])

    expect(aceitas.map((votacao) => votacao.id)).toEqual(["pl", "pec"])
  })

  it("aceita PEC, MP e PDL; recusa destaque e emenda", () => {
    const siglas = ["PEC 5/2026", "MP 1234/2026", "MPV 1234/2026", "PDL 2/2026", "PLP 12/2026"]
    const aceitas = simbolicasDaCamara(
      siglas.map((sigla, indice) =>
        semVotos(votacaoCamara({ id: String(indice), proposicaoObjeto: sigla })),
      ),
    )
    expect(aceitas).toHaveLength(siglas.length)

    const recusadas = simbolicasDaCamara([
      semVotos(votacaoCamara({ proposicaoObjeto: "DTQ 1/2026" })),
      semVotos(votacaoCamara({ proposicaoObjeto: "EMP 3/2026" })),
    ])
    expect(recusadas).toHaveLength(0)
  })

  it("corta no teto, ficando com as mais recentes", () => {
    const simbolicas = simbolicasDaCamara(
      Array.from({ length: SIMBOLICAS_NO_FEED + 5 }, (_, indice) =>
        semVotos(
          votacaoCamara({
            id: String(indice),
            data: `2026-03-${String((indice % 28) + 1).padStart(2, "0")}`,
          }),
        ),
      ),
    )

    expect(simbolicas).toHaveLength(SIMBOLICAS_NO_FEED)
  })
})

describe("votacaoSimbolicaDaCamara", () => {
  it("monta a votação sem placar e com a proposição da listagem", () => {
    const votacao = votacaoSimbolicaDaCamara(votacaoCamara())

    expect(votacao).toMatchObject({
      casa: "camara",
      aprovada: true,
      proposicao: { id: null, sigla: "PL 1234/2025", ementa: null },
      placar: { sim: 0, nao: 0, abstencao: 0, outros: 0 },
    })
  })
})

const votacaoSenado = (
  parcial: Partial<VotacaoSenadoApi> = {},
): VotacaoSenadoApi => ({
  codigoSessao: 1,
  codigoSessaoVotacao: 2,
  dataSessao: "2026-08-10",
  descricaoVotacao: "Votação do projeto",
  ementa: "Ementa do projeto",
  identificacao: "PL 1986/2024",
  sigla: "PL",
  numero: "1986",
  ano: 2024,
  resultadoVotacao: "A",
  votacaoSecreta: null,
  votos: [],
  ...parcial,
})

describe("simbolicasDoSenado", () => {
  it("mantém só simbólica com resultado e matéria relevante", () => {
    const simbolicas = simbolicasDoSenado([
      votacaoSenado(),
      votacaoSenado({ resultadoVotacao: null }),
      votacaoSenado({ identificacao: "REQ 407/2026" }),
      votacaoSenado({
        votos: [
          {
            codigoParlamentar: 1,
            nomeParlamentar: "X",
            siglaPartidoParlamentar: null,
            siglaUFParlamentar: null,
            siglaVotoParlamentar: "Sim",
          },
        ],
      }),
    ])

    expect(simbolicas).toHaveLength(1)
    expect(simbolicas[0]?.aprovada).toBe(true)
  })
})

describe("montarVotosDoFeed", () => {
  it("mapeia id do parlamentar ao voto traduzido, só para votações do feed", () => {
    const camara: VotacaoComVotos[] = [
      {
        votacao: votacaoCamara({ id: "nominal", data: "2026-08-12" }),
        votos: [
          {
            tipoVoto: "Sim",
            deputado_: { id: 10, nome: "A", siglaPartido: null, siglaUf: null },
          },
          {
            tipoVoto: "Obstrução",
            deputado_: { id: 20, nome: "B", siglaPartido: null, siglaUf: null },
          },
        ],
      },
      semVotos(votacaoCamara({ id: "simbolica" })),
    ]
    const senado = [
      votacaoSenado({
        votos: [
          {
            codigoParlamentar: 5012,
            nomeParlamentar: "C",
            siglaPartidoParlamentar: null,
            siglaUFParlamentar: null,
            siglaVotoParlamentar: "Não",
          },
        ],
      }),
    ]

    const votos = montarVotosDoFeed(montarFeed(camara, senado), camara, senado)

    expect(votos).toEqual([
      {
        casa: "camara",
        id: "nominal",
        votos: { "10": "sim", "20": "obstrucao" },
      },
      { casa: "senado", id: "1-2", votos: { "5012": "nao" } },
    ])
  })
})

describe("montarEventos", () => {
  it("põe a agenda antes e intercala nominais e simbólicas por data", () => {
    const nominal = votacaoDaCamara({
      votacao: votacaoCamara({ id: "n", data: "2026-08-01" }),
      votos: [
        {
          tipoVoto: "Sim",
          deputado_: { id: 1, nome: "X", siglaPartido: null, siglaUf: null },
        },
      ],
    })
    const simbolica = votacaoSimbolicaDaCamara(
      votacaoCamara({ id: "s", data: "2026-08-05" }),
    )
    const pauta = {
      tipo: "pauta" as const,
      id: "camara:1",
      data: "2026-08-20T10:00",
      casa: "camara" as const,
      orgao: "PLEN",
      orgaoNome: null,
      plenario: true,
      titulo: "Sessão Deliberativa",
      itens: [],
    }

    const eventos = montarEventos([pauta], [nominal], [simbolica])

    expect(eventos.map((evento) => evento.tipo)).toEqual([
      "pauta",
      "votacao",
      "votacao",
    ])
    expect(eventos[1]).toMatchObject({ nominal: false, data: "2026-08-05" })
    expect(eventos[2]).toMatchObject({ nominal: true, data: "2026-08-01" })
  })
})
