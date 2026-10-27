import type { ParlamentarRef } from "@politicapp/data"
import { describe, expect, it } from "vitest"

import { filaDeRenovacao } from "./perfis"

const secoes = { camara: ["perfil", "discursos"], senado: ["perfil"] } as const

describe("filaDeRenovacao", () => {
  it("põe quem não tem seção primeiro e depois a renovação mais antiga", () => {
    const renovacoes: Record<string, Record<string, string>> = {
      "camara:1": { perfil: "2026-10-03", discursos: "2026-10-03" },
      "camara:2": { perfil: "2026-10-01", discursos: "2026-10-05" },
      "camara:3": { perfil: "2026-10-04" },
      "senado:9": { perfil: "2026-10-02" },
    }
    const fila = filaDeRenovacao(
      [
        ...["1", "2", "3"].map((id): ParlamentarRef => ({ casa: "camara", id })),
        { casa: "senado", id: "9" },
      ],
      secoes,
      (ref, secao) => renovacoes[`${ref.casa}:${ref.id}`]?.[secao] ?? null,
    )
    expect(fila.map((ref) => `${ref.casa}:${ref.id}`)).toEqual([
      "camara:3", // sem discursos
      "camara:2", // perfil de 01/10
      "senado:9",
      "camara:1",
    ])
  })
})
