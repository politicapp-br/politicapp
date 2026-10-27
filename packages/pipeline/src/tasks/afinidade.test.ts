import type { TipoVoto, Voto } from "@politicapp/data"
import { describe, expect, it } from "vitest"

import { calcularAfinidade, margemApertada, type VotacaoNominal } from "./afinidade"

const voto = (id: string, partido: string, tipo: TipoVoto): Voto => ({
  casa: "camara",
  id,
  nome: `Dep ${id}`,
  partido,
  uf: "SP",
  voto: tipo,
})

const votacao = (
  id: string,
  votos: Voto[],
  extra: Partial<VotacaoNominal> = {},
): VotacaoNominal => ({
  id,
  data: `2026-03-${id.padStart(2, "0")}`,
  descricao: `Votação ${id}. Sim: 1; Não: 1; Total: 2.`,
  proposicao: `PL ${id}/2026`,
  aprovada: true,
  governo: null,
  votos,
  ...extra,
})

/** 30 votações em que 1 e 2 votam sempre igual e 3 sempre contra. */
const anoInteiro = () =>
  Array.from({ length: 30 }, (_, indice) => {
    const lado: TipoVoto = indice % 2 === 0 ? "sim" : "nao"
    const contrario: TipoVoto = lado === "sim" ? "nao" : "sim"
    return votacao(String(indice + 1), [
      voto("1", "AAA", lado),
      voto("2", "AAA", lado),
      voto("4", "AAA", lado),
      voto("3", "BBB", contrario),
    ])
  })

describe("calcularAfinidade", () => {
  it("ranqueia parecidos e distantes de qualquer partido", () => {
    const afinidade = calcularAfinidade("camara", 2026, anoInteiro()).get("camara:1")
    expect(afinidade?.votacoes).toBe(30)
    expect(afinidade?.parecidos.map((par) => [par.id, par.concordancia])).toEqual([
      ["2", 1],
      ["4", 1],
      ["3", 0],
    ])
    // Quem já é parecido não se repete entre os distantes.
    expect(afinidade?.distantes).toEqual([])
  })

  it("ignora pares com poucas votações em comum", () => {
    const votacoes = anoInteiro()
    votacoes.push(votacao("31", [voto("1", "AAA", "sim"), voto("9", "CCC", "sim")]))
    const afinidade = calcularAfinidade("camara", 2026, votacoes).get("camara:1")
    expect(afinidade?.parecidos.some((par) => par.id === "9")).toBe(false)
  })

  it("conta votos contra a maioria do partido, mais recentes primeiro", () => {
    const votacoes = [
      votacao("1", [voto("1", "AAA", "sim"), voto("2", "AAA", "nao"), voto("3", "AAA", "nao")]),
      votacao("2", [voto("1", "AAA", "nao"), voto("2", "AAA", "sim"), voto("3", "AAA", "sim")]),
      votacao("3", [voto("1", "AAA", "sim"), voto("2", "AAA", "sim"), voto("3", "AAA", "sim")]),
    ]
    const afinidade = calcularAfinidade("camara", 2026, votacoes).get("camara:1")
    expect(afinidade?.contraPartido.total).toBe(2)
    expect(afinidade?.contraPartido.recentes.map((item) => item.votacaoId)).toEqual(["2", "1"])
    expect(afinidade?.contraPartido.recentes[0]).toMatchObject({ voto: "nao", partido: "sim" })
    // O placar sai da descrição exibida.
    expect(afinidade?.contraPartido.recentes[0]?.descricao).toBe("Votação 2.")
  })

  it("mede alinhamento com o governo só onde houve orientação", () => {
    const votacoes = [
      votacao("1", [voto("1", "AAA", "sim")], { governo: "sim" }),
      votacao("2", [voto("1", "AAA", "sim")], { governo: "nao" }),
      votacao("3", [voto("1", "AAA", "sim")]),
      votacao("4", [voto("1", "AAA", "abstencao")], { governo: "sim" }),
    ]
    const afinidade = calcularAfinidade("camara", 2026, votacoes).get("camara:1")
    expect(afinidade?.governo).toEqual({ votacoes: 2, comGoverno: 1 })
  })

  it("lista votações apertadas inclusive quando o parlamentar não votou", () => {
    const votos = [
      ...Array.from({ length: 50 }, (_, i) => voto(`s${i}`, "AAA", "sim")),
      ...Array.from({ length: 49 }, (_, i) => voto(`n${i}`, "BBB", "nao")),
      voto("1", "CCC", "ausente"),
      voto("2", "CCC", "sim"),
    ]
    const resultado = calcularAfinidade("camara", 2026, [votacao("1", votos)])
    expect(resultado.has("camara:1")).toBe(false)
    expect(resultado.get("camara:2")?.apertadas).toEqual([
      expect.objectContaining({ votacaoId: "1", margem: 2, voto: "sim" }),
    ])
  })

  it("usa a identidade mais recente de quem trocou de partido", () => {
    const votacoes = anoInteiro()
    votacoes.push(votacao("31", [voto("2", "ZZZ", "sim"), voto("1", "AAA", "sim")]))
    const afinidade = calcularAfinidade("camara", 2026, votacoes).get("camara:1")
    expect(afinidade?.parecidos.find((par) => par.id === "2")?.partido).toBe("ZZZ")
  })
})

describe("margemApertada", () => {
  it("usa 5% dos votos com piso de 2", () => {
    expect(margemApertada(210, 190)).toBe(true)
    expect(margemApertada(220, 180)).toBe(false)
    expect(margemApertada(36, 34)).toBe(true)
    expect(margemApertada(37, 33)).toBe(false)
  })
})
