import type { Parlamentar } from "@politicapp/data"
import { describe, expect, it } from "vitest"

import type { CandidatoTse } from "../sources/tse-eleicoes"
import {
  calcularTerritorio,
  candidaturaDoMandato,
  montarHistoricoEleitoral,
  resultadoDoTse,
} from "./eleitoral"

const parlamentar = (parcial: Partial<Parlamentar> & Pick<Parlamentar, "casa" | "id" | "nome">): Parlamentar => ({
  nomeCivil: null,
  partido: "PT",
  uf: "SP",
  fotoUrl: null,
  email: null,
  emExercicio: true,
  ...parcial,
})

const candidato = (parcial: Partial<CandidatoTse> & Pick<CandidatoTse, "sq" | "ano">): CandidatoTse => ({
  turno: 1,
  cargo: 6,
  uf: "SP",
  municipio: null,
  cpf: null,
  nome: "MARIA DA SILVA",
  nomeUrna: "MARIA",
  partido: "PT",
  numero: "1300",
  situacaoTurno: "ELEITO POR QP",
  ...parcial,
})

describe("resultadoDoTse", () => {
  it("normaliza as situações do TSE", () => {
    expect(resultadoDoTse("ELEITO POR MÉDIA")).toBe("eleito")
    expect(resultadoDoTse("SUPLENTE")).toBe("suplente")
    expect(resultadoDoTse("NÃO ELEITO")).toBe("nao-eleito")
    expect(resultadoDoTse("2º TURNO")).toBe("segundo-turno")
    expect(resultadoDoTse(null)).toBe("pendente")
  })
})

describe("montarHistoricoEleitoral", () => {
  const maria = parlamentar({ casa: "camara", id: "1", nome: "Maria" })

  it("vincula por CPF e junta turnos da mesma candidatura", () => {
    const vinculos = montarHistoricoEleitoral(maria ? [maria] : [], new Map([["1", "12345678901"]]), [
      {
        ano: 2026,
        candidatos: [
          candidato({ sq: "A", ano: 2026, cargo: 3, cpf: "12345678901", situacaoTurno: "2º TURNO" }),
          candidato({ sq: "A", ano: 2026, cargo: 3, cpf: "12345678901", turno: 2, situacaoTurno: null }),
        ],
        bens: new Map([["A", 1000.5]]),
        votos: new Map([["A", 900]]),
      },
      {
        ano: 2022,
        candidatos: [candidato({ sq: "B", ano: 2022, cpf: "12345678901" })],
        bens: null,
        votos: null,
      },
    ])
    expect(vinculos.get("camara:1")?.historico).toEqual([
      expect.objectContaining({ ano: 2026, cargo: "Governador(a)", resultado: "segundo-turno", votos: 900, patrimonio: 1000.5 }),
      expect.objectContaining({ ano: 2022, cargo: "Deputado(a) Federal", resultado: "eleito", votos: null, patrimonio: null }),
    ])
  })

  it("sem CPF usa nome de urna + UF e recusa nome ambíguo", () => {
    const anos = [
      {
        ano: 2022,
        candidatos: [
          candidato({ sq: "C", ano: 2022 }),
          candidato({ sq: "D", ano: 2022, uf: "RJ" }),
          candidato({ sq: "E", ano: 2022, nomeUrna: "JOSÉ", nome: "JOSE UM" }),
          candidato({ sq: "F", ano: 2022, nomeUrna: "JOSÉ", nome: "JOSE DOIS" }),
        ],
        bens: null,
        votos: null,
      },
    ]
    const jose = parlamentar({ casa: "camara", id: "2", nome: "José" })
    const vinculos = montarHistoricoEleitoral([maria, jose], new Map(), anos)
    expect(vinculos.get("camara:1")?.historico.map((item) => item.uf)).toEqual(["SP"])
    expect(vinculos.get("camara:2")?.historico).toEqual([])
  })
})

describe("vínculo por CPF", () => {
  it("com CPF conhecido não cai para homônimo quando ele não disputou", () => {
    const maria = parlamentar({ casa: "camara", id: "1", nome: "Maria" })
    const vinculos = montarHistoricoEleitoral([maria], new Map([["1", "11111111111"]]), [
      {
        ano: 2022,
        candidatos: [candidato({ sq: "H", ano: 2022, cpf: "99999999999" })],
        bens: null,
        votos: null,
      },
    ])
    expect(vinculos.get("camara:1")?.historico).toEqual([])
  })
})

describe("candidatura a presidente", () => {
  it("senador com nome civil liga a candidatura registrada com UF BR", () => {
    const senadora = parlamentar({ casa: "senado", id: "7", nome: "Soraya", nomeCivil: "Soraya Vieira Thronicke", uf: "MS" })
    const vinculos = montarHistoricoEleitoral([senadora], new Map(), [
      {
        ano: 2022,
        candidatos: [candidato({ sq: "P", ano: 2022, cargo: 1, uf: "BR", nome: "SORAYA VIEIRA THRONICKE", situacaoTurno: "NÃO ELEITO" })],
        bens: null,
        votos: null,
      },
    ])
    expect(vinculos.get("senado:7")?.historico).toEqual([
      expect.objectContaining({ cargo: "Presidente", uf: "BR", resultado: "nao-eleito" }),
    ])
  })
})

describe("suplente de senador", () => {
  it("entra no histórico sem votos próprios", () => {
    const suplente = parlamentar({ casa: "senado", id: "8", nome: "Renzo", nomeCivil: "Renzo Braz", uf: "MG" })
    const vinculos = montarHistoricoEleitoral([suplente], new Map(), [
      {
        ano: 2018,
        candidatos: [candidato({ sq: "S", ano: 2018, cargo: 9, uf: "MG", nome: "RENZO BRAZ", situacaoTurno: "ELEITO" })],
        bens: null,
        votos: new Map(),
      },
    ])
    expect(vinculos.get("senado:8")?.historico).toEqual([
      expect.objectContaining({ cargo: "1º suplente de senador", votos: null, resultado: "eleito" }),
    ])
  })
})

describe("candidaturaDoMandato", () => {
  it("senador usa a eleição em que foi eleito senador", () => {
    const senador = parlamentar({ casa: "senado", id: "9", nome: "Maria" })
    const vinculo = {
      historico: [],
      porAno: new Map([
        [2026, [candidato({ sq: "X", ano: 2026, cargo: 5 })]],
        [2022, [candidato({ sq: "Y", ano: 2022, cargo: 3, situacaoTurno: "NÃO ELEITO" })]],
        [2018, [candidato({ sq: "Z", ano: 2018, cargo: 5 })]],
      ]),
    }
    expect(candidaturaDoMandato(senador, vinculo, 2022)?.sq).toBe("Z")
  })
})

describe("calcularTerritorio", () => {
  it("define redutos pela metade dos votos e mede as emendas que foram para lá", () => {
    const territorio = calcularTerritorio(
      candidato({ sq: "A", ano: 2022 }),
      new Map([
        ["SP|SÃO PAULO", 600],
        ["SP|CAMPINAS", 300],
        ["SP|SANTOS", 100],
        ["SP|NENHUM", 0],
      ]),
      new Map([
        ["SP|SAO PAULO", 1000],
        ["SP|SANTOS", 3000],
      ]),
    )
    expect(territorio).toMatchObject({
      eleicao: 2022,
      totalVotos: 1000,
      municipiosComVoto: 3,
      redutos: { municipios: 1, fracaoDosVotos: 0.6, emendas: 1000, fracaoDasEmendas: 0.25 },
      emendasComMunicipio: 4000,
    })
    expect(territorio?.principais[0]).toEqual({
      municipio: "SÃO PAULO",
      uf: "SP",
      votos: 600,
      fracao: 0.6,
      emendas: 1000,
    })
  })

  it("sem voto não há território", () => {
    expect(calcularTerritorio(candidato({ sq: "A", ano: 2022 }), new Map(), new Map())).toBeNull()
  })
})
