import { describe, expect, it } from "vitest"

import type { HistoricoCamaraApi } from "../sources/camara-perfil"
import { historicoDaCamara, historicoDoSenado } from "./historico"

const registro = (
  dataHora: string,
  situacao: string | null,
  siglaPartido: string,
  descricaoStatus: string,
  idLegislatura = 57,
): HistoricoCamaraApi => ({ dataHora, situacao, siglaPartido, descricaoStatus, idLegislatura })

describe("historicoDaCamara", () => {
  it("monta licenças de saída até a reassunção e trocas de partido", () => {
    const historico = historicoDaCamara([
      registro("2023-11-22T10:20", "Exercício", "PT", "Entrada - Reassunção"),
      registro("2023-02-01T00:00", null, "PT", "Nome no início da legislatura / Partido no início da legislatura"),
      registro("2023-02-01T12:05", "Exercício", "PT", "Entrada - Posse de Eleito Titular - Posse na Sessão Preparatória"),
      registro("2023-02-07T13:52", "Licença", "PT", "Saída - Afastamento sem prazo determinado - Secretário de Estado"),
      registro("2024-04-01T10:00", "Exercício", "PSB", "Alteração de partido"),
      registro("2025-07-17T16:22", "Licença", "PSB", "Saída - Afastamento sem prazo determinado - Ministro de Estado"),
      registro("2019-02-01T11:45", "Exercício", "PDT", "Entrada - Posse", 56),
      registro("2023-01-31T23:59", "FIM_MANDATO", "PDT", "Saída - Afastamento definitivo - Término da Legislatura", 56),
    ])
    expect(historico.afastamentos).toEqual([
      { inicio: "2025-07-17", fim: null, motivo: "Ministro de Estado" },
      { inicio: "2023-02-07", fim: "2023-11-22", motivo: "Secretário de Estado" },
    ])
    expect(historico.filiacoes).toEqual([
      { partido: "PSB", inicio: "2024-04-01", fim: null },
      { partido: "PT", inicio: "2023-02-01", fim: "2024-04-01" },
      { partido: "PDT", inicio: "2019-02-01", fim: "2023-02-01" },
    ])
    expect(historico.suplentes).toEqual([])
  })

  it("trata a volta do titular como afastamento do suplente", () => {
    const historico = historicoDaCamara([
      registro("2023-02-02T11:17", "Exercício", "PL", "Entrada - Posse de Suplente - Posse como Suplente"),
      registro("2024-03-12T09:50", "SUPLENCIA", "PL", "Saída - Afastamento sem prazo determinado - Afastamento de Suplente (automático)"),
      registro("2024-03-21T17:42", "CONVOCADO", "PL", "DIVERSO - Convocação Eleito ou Suplente"),
      registro("2024-03-21T17:48", "Exercício", "PL", "Entrada - Reassunção"),
    ])
    expect(historico.afastamentos).toEqual([
      { inicio: "2024-03-12", fim: "2024-03-21", motivo: "Titular reassumiu a vaga" },
    ])
  })
})

describe("historicoDoSenado", () => {
  it("normaliza filiações, licenças da legislatura e suplentes do mandato vigente", () => {
    const historico = historicoDoSenado({
      hoje: "2026-10-26",
      filiacoes: [
        { Partido: { SiglaPartido: "REPUBLICANOS" }, DataFiliacao: "2025-11-12" },
        { Partido: { SiglaPartido: "UNIÃO" }, DataFiliacao: "2022-02-24", DataDesfiliacao: "2025-11-10" },
        { Partido: { SiglaPartido: "PFL" }, DataFiliacao: "2001-01-01", DataDesfiliacao: "2007-01-01" },
      ],
      licencas: [
        { DataInicio: "2026-10-08", DataFim: "2026-10-08", DescricaoTipoAfastamento: "Missão política" },
        { DataInicio: "2020-01-01", DataFim: "2020-02-01", DescricaoTipoAfastamento: "Antiga" },
      ],
      mandatos: [
        {
          SegundaLegislaturaDoMandato: { DataFim: "2031-01-31" },
          Suplentes: {
            Suplente: [
              { DescricaoParticipacao: "1º Suplente", CodigoParlamentar: "6343", NomeParlamentar: "Gemil Junior" },
              { DescricaoParticipacao: "2º Suplente", NomeParlamentar: "Coronel" },
            ],
          },
        },
        {
          SegundaLegislaturaDoMandato: { DataFim: "2023-01-31" },
          Suplentes: { Suplente: { DescricaoParticipacao: "1º Suplente", NomeParlamentar: "Antigo" } },
        },
      ],
    })
    expect(historico.filiacoes.map((filiacao) => filiacao.partido)).toEqual(["REPUBLICANOS", "UNIÃO"])
    expect(historico.afastamentos).toEqual([
      { inicio: "2026-10-08", fim: "2026-10-08", motivo: "Missão política" },
    ])
    expect(historico.suplentes).toEqual([
      { ordem: "1º Suplente", nome: "Gemil Junior", id: "6343" },
      { ordem: "2º Suplente", nome: "Coronel", id: null },
    ])
  })
})
