import { describe, expect, it } from "vitest"

import type { VotacaoCamaraApi } from "../sources/camara"
import type { VotacaoSenadoApi } from "../sources/senado"
import { nominaisDaCamara, nominaisDoSenado } from "./nominais"

describe("nominaisDaCamara", () => {
  const voto = (id: number, tipoVoto: string) => ({
    tipoVoto,
    deputado_: { id, nome: `Dep ${id}`, siglaPartido: "PT", siglaUf: "SP" },
  })
  const votacao = (id: string, proposicaoObjeto: string | null): VotacaoCamaraApi => ({
    id,
    data: "2026-05-01T00:00:00",
    descricao: "Aprovado. Sim: 1; Não: 0; Total: 1.",
    siglaOrgao: "PLEN",
    aprovacao: 1,
    proposicaoObjeto,
  })

  it("fica com as que têm voto individual, com proposição e orientação do governo", () => {
    const nominais = nominaisDaCamara(
      [
        { votacao: votacao("1-1", " PL 1/2026 "), votos: [voto(10, "Sim")] },
        { votacao: votacao("1-2", null), votos: [] },
        { votacao: votacao("1-3", null), votos: [voto(10, "Não")] },
      ],
      new Map([["1-1", "nao"]]),
    )
    expect(nominais).toEqual([
      expect.objectContaining({
        id: "1-1",
        data: "2026-05-01",
        governo: "nao",
        proposicao: "PL 1/2026",
        aprovada: true,
        votos: [expect.objectContaining({ casa: "camara", id: "10", voto: "sim" })],
      }),
      expect.objectContaining({ id: "1-3", governo: null, proposicao: null }),
    ])
  })
})

describe("nominaisDoSenado", () => {
  const votacao = (parcial: Partial<VotacaoSenadoApi>): VotacaoSenadoApi => ({
    codigoSessao: 1,
    codigoSessaoVotacao: 2,
    dataSessao: "2026-03-24",
    descricaoVotacao: "PL 1/2026",
    ementa: null,
    identificacao: "PL 1/2026",
    sigla: "PL",
    numero: "1",
    ano: 2026,
    resultadoVotacao: "A",
    votacaoSecreta: "N",
    votos: [
      { codigoParlamentar: 5, nomeParlamentar: "S", siglaPartidoParlamentar: "PT", siglaUFParlamentar: "AC", siglaVotoParlamentar: "Sim" },
    ],
    ...parcial,
  })

  it("descarta votação secreta, em que o voto não tem lado", () => {
    expect(nominaisDoSenado([votacao({ votacaoSecreta: "S" })])).toEqual([])
    expect(nominaisDoSenado([votacao({})])).toEqual([
      expect.objectContaining({ id: "1-2", aprovada: true, governo: null }),
    ])
  })
})
