import { describe, expect, it } from "vitest"

import type { LancamentoDespesa } from "../sources/camara"
import { resumirDespesas } from "./despesas"

const lancamento = (
  parcial: Partial<LancamentoDespesa> & Pick<LancamentoDespesa, "parlamentarId" | "valor">,
): LancamentoDespesa => ({
  ano: 2026,
  mes: 1,
  tipo: "COMBUSTÍVEIS E LUBRIFICANTES.",
  fornecedor: "Posto",
  cnpjCpf: null,
  documentoUrl: null,
  data: null,
  glosa: 0,
  ...parcial,
})

describe("resumirDespesas", () => {
  it("agrupa por parlamentar e soma o total", () => {
    const resumos = resumirDespesas("camara", 2026, [
      lancamento({ parlamentarId: "1", valor: 100 }),
      lancamento({ parlamentarId: "1", valor: 50 }),
      lancamento({ parlamentarId: "2", valor: 70 }),
    ])

    expect(resumos).toHaveLength(2)
    expect(resumos.find((r) => r.id === "1")?.total).toBe(150)
    expect(resumos.find((r) => r.id === "2")?.total).toBe(70)
  })

  it("soma por mês em ordem cronológica", () => {
    const [resumo] = resumirDespesas("camara", 2026, [
      lancamento({ parlamentarId: "1", valor: 10, mes: 3 }),
      lancamento({ parlamentarId: "1", valor: 20, mes: 1 }),
      lancamento({ parlamentarId: "1", valor: 5, mes: 3 }),
    ])

    expect(resumo?.porMes).toEqual([
      { ano: 2026, mes: 1, valor: 20 },
      { ano: 2026, mes: 3, valor: 15 },
    ])
  })

  it("ordena tipos do maior para o menor", () => {
    const [resumo] = resumirDespesas("camara", 2026, [
      lancamento({ parlamentarId: "1", valor: 10, tipo: "A" }),
      lancamento({ parlamentarId: "1", valor: 90, tipo: "B" }),
    ])

    expect(resumo?.porTipo.map((t) => t.tipo)).toEqual(["B", "A"])
  })

  it("arredonda centavos", () => {
    const [resumo] = resumirDespesas("camara", 2026, [
      lancamento({ parlamentarId: "1", valor: 0.1 }),
      lancamento({ parlamentarId: "1", valor: 0.2 }),
    ])

    expect(resumo?.total).toBe(0.3)
  })
})
