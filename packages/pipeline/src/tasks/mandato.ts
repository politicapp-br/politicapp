import {
  parlamentarKey,
  type Casa,
  type CustoAnual,
  type MandatoParlamentar,
} from "@politicapp/data"

import type { SalarioMensal } from "../sources/remuneracao"

/**
 * Posse da legislatura da Câmara que contém o ano — 1º de fevereiro do ano
 * seguinte à eleição. A API da Câmara não expõe posse individual, então essa
 * data vale para todos os deputados (suplentes ficam com a aproximação).
 */
export const inicioDaLegislatura = (ano: number): string => {
  const inicio = ano - ((((ano - 2023) % 4) + 4) % 4)
  return `${inicio}-02-01`
}

/**
 * Legislatura em curso numa data (ISO). Em janeiro do ano de posse a anterior
 * ainda está em exercício — usar só o ano daria posse futura a todo mundo.
 */
export const legislaturaEmCurso = (data: string): string => {
  const doAno = inicioDaLegislatura(Number(data.slice(0, 4)))
  return data < doAno ? inicioDaLegislatura(Number(data.slice(0, 4)) - 1) : doAno
}

/** Fontes de um ano, já reduzidas a totais por `casa:id`. */
export type FontesDoAno = {
  ano: number
  salarios: SalarioMensal[]
  cotas: Map<string, number>
  moradias: Map<string, number>
  diarias: Map<string, number>
}

export type ParlamentarComPosse = {
  casa: Casa
  id: string
  inicioExercicio: string
}

export const anoDaPosse = (inicioExercicio: string) =>
  Number(inicioExercicio.slice(0, 4))

const mesDaPosse = (inicioExercicio: string) =>
  Number(inicioExercicio.slice(5, 7)) || 1

/**
 * Cruza as fontes ano a ano com a posse de cada parlamentar. Anos fechados já
 * apurados em execuções anteriores entram por `cacheados` e não são
 * recalculados; um mesmo ano nunca deve aparecer nas duas origens.
 */
export const montarMandato = (
  parlamentares: ParlamentarComPosse[],
  fontesPorAno: FontesDoAno[],
  cacheados: Map<string, CustoAnual[]>,
): MandatoParlamentar[] =>
  parlamentares.map((parlamentar) => {
    const chave = parlamentarKey(parlamentar)
    const posse = anoDaPosse(parlamentar.inicioExercicio)

    const frescos = fontesPorAno
      .filter((fontes) => fontes.ano >= posse)
      .map((fontes) => custoDoAno(parlamentar, chave, fontes))

    const doCache = (cacheados.get(chave) ?? []).filter(
      (custo) => custo.ano >= posse,
    )

    return {
      casa: parlamentar.casa,
      id: parlamentar.id,
      inicioExercicio: parlamentar.inicioExercicio,
      anos: [...doCache, ...frescos].sort((a, b) => a.ano - b.ano),
    }
  })

const custoDoAno = (
  parlamentar: ParlamentarComPosse,
  chave: string,
  fontes: FontesDoAno,
): CustoAnual => {
  // No ano da posse o salário conta a partir dela — quem assumiu em fevereiro
  // não recebeu o subsídio de janeiro.
  const noExercicio =
    fontes.ano > anoDaPosse(parlamentar.inicioExercicio)
      ? fontes.salarios
      : fontes.salarios.filter(
          (salario) => salario.mes >= mesDaPosse(parlamentar.inicioExercicio),
        )

  const bruto = noExercicio.reduce((total, salario) => total + salario.bruto, 0)

  return {
    ano: fontes.ano,
    salario: {
      meses: noExercicio.length,
      total: Math.round(bruto * 100) / 100,
    },
    cota: fontes.cotas.get(chave) ?? 0,
    moradia: fontes.moradias.get(chave) ?? 0,
    diarias: fontes.diarias.get(chave) ?? 0,
  }
}
