import { describe, expect, it } from "vitest"
import { z } from "zod"

import { validarItens } from "./validacao"

const schema = z.object({ id: z.number() })

describe("validarItens", () => {
  it("descarta item fora do formato e mantém o resto", () => {
    const itens = [...Array.from({ length: 9 }, (_, id) => ({ id })), { id: "x" }]
    expect(validarItens("teste", itens, schema)).toHaveLength(9)
  })

  it("falha quando o descarte passa do limite (contrato mudou)", () => {
    expect(() => validarItens("teste", [{ id: 1 }, { id: null }], schema)).toThrow(/contrato/)
  })
})
