import { describe, expect, it } from "vitest"

import type { EventoCamaraApi } from "../sources/camara"
import type {
  ReuniaoComissaoSenado,
  SessaoPlenarioSenadoApi,
} from "../sources/senado"
import {
  eventoDaCamara,
  eventoDeComissaoSenado,
  eventoDoPlenarioSenado,
  eventosDeliberativosCamara,
  montarAgenda,
  reunioesRelevantesSenado,
  sessoesDeliberativasSenado,
  ITENS_POR_PAUTA,
  PAUTAS_NO_FEED,
} from "./agenda"

const eventoCamara = (
  parcial: Partial<EventoCamaraApi> = {},
): EventoCamaraApi => ({
  id: 1,
  dataHoraInicio: "2026-08-18T10:00",
  situacao: "Agendada",
  descricaoTipo: "Reunião Deliberativa",
  orgaos: [{ sigla: "CCJC", nome: "Comissão de Constituição e Justiça", apelido: "Constituição e Justiça" }],
  ...parcial,
})

describe("eventosDeliberativosCamara", () => {
  it("mantém só o que delibera e não foi cancelado", () => {
    const eventos = eventosDeliberativosCamara([
      eventoCamara({ id: 1, descricaoTipo: "Reunião Deliberativa" }),
      eventoCamara({ id: 2, descricaoTipo: "Sessão Deliberativa Extraordinária" }),
      eventoCamara({ id: 3, descricaoTipo: "Sessão Não Deliberativa Solene" }),
      eventoCamara({ id: 4, descricaoTipo: "Audiência Pública" }),
      eventoCamara({ id: 5, situacao: "Cancelada" }),
    ])

    expect(eventos.map((evento) => evento.id)).toEqual([1, 2])
  })

  it("ignora sessão solene mesmo sem tipo informado", () => {
    expect(eventosDeliberativosCamara([eventoCamara({ descricaoTipo: null })])).toEqual([])
  })
})

describe("eventoDaCamara", () => {
  it("monta o evento com itens da pauta e órgão legível", () => {
    const evento = eventoDaCamara(eventoCamara(), [
      {
        ordem: 1,
        proposicao_: { siglaTipo: "PL", numero: 1986, ano: 2024, ementa: "Altera a lei X." },
      },
      { ordem: 2, proposicao_: null },
    ])

    expect(evento).toMatchObject({
      tipo: "pauta",
      id: "camara:1",
      casa: "camara",
      orgao: "CCJC",
      orgaoNome: "Constituição e Justiça",
      plenario: false,
      itens: [{ sigla: "PL 1986/2024", ementa: "Altera a lei X." }],
    })
  })

  it("marca plenário e omite o nome redundante do órgão", () => {
    const evento = eventoDaCamara(
      eventoCamara({ orgaos: [{ sigla: "PLEN", nome: "Plenário", apelido: null }] }),
      [],
    )

    expect(evento.plenario).toBe(true)
    expect(evento.orgaoNome).toBeNull()
  })

  it("corta a pauta no teto de itens", () => {
    const pauta = Array.from({ length: ITENS_POR_PAUTA + 5 }, (_, indice) => ({
      ordem: indice,
      proposicao_: { siglaTipo: "PL", numero: indice + 1, ano: 2026, ementa: null },
    }))

    expect(eventoDaCamara(eventoCamara(), pauta).itens).toHaveLength(ITENS_POR_PAUTA)
  })
})

const sessaoSenado = (
  parcial: Partial<SessaoPlenarioSenadoApi> = {},
): SessaoPlenarioSenadoApi => ({
  CodigoSessao: "581817",
  Data: "2026-08-18",
  Hora: "14:00",
  TipoSessao: "SESSÃO DELIBERATIVA ORDINÁRIA ",
  Casa: "SF",
  SituacaoSessao: "Agendada",
  ...parcial,
})

describe("sessoesDeliberativasSenado", () => {
  it("exclui não deliberativa, cancelada e sessão sem código", () => {
    const sessoes = sessoesDeliberativasSenado([
      sessaoSenado(),
      sessaoSenado({ TipoSessao: "SESSÃO NÃO DELIBERATIVA " }),
      sessaoSenado({ TipoSessao: "SESSÃO SOLENE " }),
      sessaoSenado({ SituacaoSessao: "Encerrada" }),
      sessaoSenado({ CodigoSessao: undefined }),
    ])

    expect(sessoes).toHaveLength(1)
  })
})

describe("eventoDoPlenarioSenado", () => {
  it("junta data e hora e atribui sessão do CN ao Congresso", () => {
    const evento = eventoDoPlenarioSenado(sessaoSenado({ Casa: "CN" }), [
      { sigla: "PL 1986/2024", ementa: "Campanhas de conscientização." },
    ])

    expect(evento).toMatchObject({
      id: "senado-plen:581817",
      data: "2026-08-18T14:00",
      casa: "congresso",
      plenario: true,
      titulo: "Sessão deliberativa ordinária",
      itens: [{ sigla: "PL 1986/2024", ementa: "Campanhas de conscientização." }],
    })
  })
})

const reuniaoSenado = (
  parcial: Partial<ReuniaoComissaoSenado> = {},
): ReuniaoComissaoSenado => ({
  codigo: "14895",
  dataInicio: "2026-08-18T14:30:00.000",
  titulo: "60ª Reunião Extraordinária",
  siglaColegiado: "CDH",
  nomeColegiado: "Comissão de Direitos Humanos e Legislação Participativa",
  situacao: "Agendada",
  secreta: false,
  exibir: true,
  materias: [{ sigla: "SUG 19/2020", ementa: null }],
  ...parcial,
})

describe("reunioesRelevantesSenado", () => {
  it("exclui secreta, oculta e não agendada; sem matéria ainda entra", () => {
    const reunioes = reunioesRelevantesSenado([
      reuniaoSenado(),
      reuniaoSenado({ secreta: true }),
      reuniaoSenado({ exibir: false }),
      reuniaoSenado({ situacao: "Cancelada" }),
      reuniaoSenado({ codigo: "99", materias: [] }),
    ])

    expect(reunioes.map((reuniao) => reuniao.codigo)).toEqual(["14895", "99"])
  })
})

describe("eventoDeComissaoSenado", () => {
  it("monta o evento da reunião com sigla e nome do colegiado", () => {
    expect(eventoDeComissaoSenado(reuniaoSenado())).toMatchObject({
      id: "senado-com:14895",
      casa: "senado",
      orgao: "CDH",
      plenario: false,
      itens: [{ sigla: "SUG 19/2020", ementa: null }],
    })
  })
})

describe("montarAgenda", () => {
  it("ordena do mais próximo para o mais distante e corta no teto", () => {
    const eventos = Array.from({ length: PAUTAS_NO_FEED + 10 }, (_, indice) =>
      eventoDeComissaoSenado(
        reuniaoSenado({
          codigo: String(indice),
          dataInicio: `2026-09-${String((indice % 28) + 1).padStart(2, "0")}T10:00`,
        }),
      ),
    )

    const agenda = montarAgenda(eventos)

    expect(agenda).toHaveLength(PAUTAS_NO_FEED)
    expect((agenda[0]?.data ?? "") <= (agenda[1]?.data ?? "")).toBe(true)
  })
})
