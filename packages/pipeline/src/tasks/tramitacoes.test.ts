import { describe, expect, it } from "vitest"

import type { ProposicaoResumoApi, StatusProposicaoApi } from "../sources/camara"
import {
  tramitacoesComMarco,
  TRAMITACOES_NO_FEED,
  type ProposicaoComStatus,
} from "./tramitacoes"

const proposicao = (
  parcial: Partial<ProposicaoResumoApi> = {},
): ProposicaoResumoApi => ({
  id: 100,
  siglaTipo: "PL",
  numero: 1234,
  ano: 2025,
  ementa: "Dispõe sobre algo importante.",
  ...parcial,
})

const status = (
  parcial: Partial<StatusProposicaoApi> = {},
): StatusProposicaoApi => ({
  dataHora: "2026-08-13T00:00",
  codSituacao: 1140,
  descricaoSituacao: "Transformado em Norma Jurídica",
  despacho: "Transformado na Lei nº 15.000 de 2026.",
  ...parcial,
})

const item = (
  proposicaoParcial: Partial<ProposicaoResumoApi> = {},
  statusParcial: Partial<StatusProposicaoApi> | null = {},
): ProposicaoComStatus => ({
  proposicao: proposicao(proposicaoParcial),
  status: statusParcial === null ? null : status(statusParcial),
})

describe("tramitacoesComMarco", () => {
  it("gera evento com marco, sigla montada e despacho", () => {
    const eventos = tramitacoesComMarco([item()], "2026-08-07")

    expect(eventos).toEqual([
      {
        tipo: "tramitacao",
        id: "camara:100:1140",
        data: "2026-08-13T00:00",
        casa: "camara",
        marco: "transformada_em_lei",
        proposicao: {
          id: "100",
          sigla: "PL 1234/2025",
          ementa: "Dispõe sobre algo importante.",
        },
        despacho: "Transformado na Lei nº 15.000 de 2026.",
      },
    ])
  })

  it("descarta situação sem marco, status ausente e marco antigo", () => {
    const eventos = tramitacoesComMarco(
      [
        item({ id: 1 }, { codSituacao: 924 }), // Pronta para Pauta: comum demais
        item({ id: 2 }, null),
        item({ id: 3 }, { codSituacao: null }),
        // virou lei antes da janela; a tramitação recente foi só burocrática
        item({ id: 4 }, { dataHora: "2026-07-01T10:00" }),
        item({ id: 5 }, { dataHora: null }),
        item({ id: 6, siglaTipo: null }),
      ],
      "2026-08-07",
    )

    expect(eventos).toEqual([])
  })

  it("mapeia os pares de situação para o mesmo marco", () => {
    const eventos = tramitacoesComMarco(
      [
        item({ id: 1 }, { codSituacao: 1150 }),
        item({ id: 2 }, { codSituacao: 1160 }),
        item({ id: 3 }, { codSituacao: 1303 }),
        item({ id: 4 }, { codSituacao: 926 }),
        item({ id: 5 }, { codSituacao: 937 }),
        item({ id: 6 }, { codSituacao: 1294 }),
      ],
      "2026-08-07",
    )

    expect(eventos.map((evento) => evento.marco)).toEqual([
      "enviada_a_sancao",
      "enviada_a_sancao",
      "aprovada_na_camara",
      "aprovada_na_camara",
      "vetada",
      "aguardando_promulgacao",
    ])
  })

  it("ordena por data decrescente e corta no teto", () => {
    const muitos = Array.from({ length: TRAMITACOES_NO_FEED + 5 }, (_, i) =>
      item(
        { id: i },
        { dataHora: `2026-08-${String(8 + (i % 6)).padStart(2, "0")}T00:00` },
      ),
    )

    const eventos = tramitacoesComMarco(muitos, "2026-08-07")

    expect(eventos).toHaveLength(TRAMITACOES_NO_FEED)
    const datas = eventos.map((evento) => evento.data)
    expect(datas).toEqual([...datas].sort((a, b) => b.localeCompare(a)))
  })

  it("monta sigla sem numeração quando número ou ano faltam", () => {
    const eventos = tramitacoesComMarco([item({ numero: null })], "2026-08-07")
    expect(eventos[0]?.proposicao.sigla).toBe("PL")
  })
})
