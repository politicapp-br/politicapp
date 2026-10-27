import type { Casa, ResumoDespesas } from "@politicapp/data"

import type { LancamentoDespesa } from "../sources/camara"

const MAIORES_TIPOS = 8

export const resumirDespesas = (
  casa: Casa,
  ano: number,
  lancamentos: LancamentoDespesa[],
): ResumoDespesas[] => {
  const porParlamentar = new Map<string, LancamentoDespesa[]>()

  for (const lancamento of lancamentos) {
    // Lançamento só com glosa não é gasto — entra no detalhe de fornecedores.
    if (lancamento.valor <= 0) continue
    const atual = porParlamentar.get(lancamento.parlamentarId)
    if (atual) {
      atual.push(lancamento)
    } else {
      porParlamentar.set(lancamento.parlamentarId, [lancamento])
    }
  }

  return [...porParlamentar].map(([id, doParlamentar]) => {
    const porMes = new Map<number, number>()
    const porTipo = new Map<string, number>()
    let total = 0

    for (const { mes, tipo, valor } of doParlamentar) {
      total += valor
      porMes.set(mes, (porMes.get(mes) ?? 0) + valor)
      porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + valor)
    }

    return {
      casa,
      id,
      ano,
      total: arredondar(total),
      porMes: [...porMes]
        .sort(([a], [b]) => a - b)
        .map(([mes, valor]) => ({ ano, mes, valor: arredondar(valor) })),
      porTipo: [...porTipo]
        .sort(([, a], [, b]) => b - a)
        .slice(0, MAIORES_TIPOS)
        .map(([tipo, valor]) => ({ tipo, valor: arredondar(valor) })),
    }
  })
}

const arredondar = (valor: number) => Math.round(valor * 100) / 100
