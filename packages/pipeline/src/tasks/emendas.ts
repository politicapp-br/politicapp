import type { Parlamentar, ResumoEmendas } from "@politicapp/data"
import { UFS } from "@politicapp/data"

import { numeroBr } from "../csv"
import { chaveDeNome } from "../sources/senado"
import type { LinhaDeEmenda } from "../sources/transparencia"

const MAIORES_AREAS = 5
const MAIORES_LOCAIS = 5

/**
 * O arquivo do Portal volta até 2014, mas só interessa o que os parlamentares
 * em exercício assinaram — e o mandato em curso mais antigo (senador eleito
 * em 2018) começou em 2019.
 */
export const ANO_MINIMO_EMENDAS = 2019

const SEM_INFORMACAO = new Set(["", "Sem informação", "Múltiplo", "MÚLTIPLO"])

// O CSV traz a UF por extenso e em caixa alta ("BAHIA"), não a sigla.
const SIGLA_POR_NOME_DE_UF = new Map(
  UFS.map((uf) => [chaveDeNome(uf.nome), uf.sigla]),
)

type Acumulado = {
  casa: Parlamentar["casa"]
  id: string
  ano: number
  empenhado: number
  pago: number
  porArea: Map<string, number>
  porLocal: Map<string, { municipio: string | null; uf: string | null; valor: number }>
}

// O autor vem por nome em caixa alta; nome ambíguo entre duas pessoas não
// permite atribuição confiável e fica de fora junto com os sem cadastro.
const indicePorNome = (parlamentares: Parlamentar[]) => {
  const refPorChave = new Map<string, Parlamentar | null>()
  for (const parlamentar of parlamentares) {
    const chave = chaveDeNome(parlamentar.nome)
    refPorChave.set(chave, refPorChave.has(chave) ? null : parlamentar)
  }
  return refPorChave
}

export const resumirEmendas = (
  linhas: LinhaDeEmenda[],
  parlamentares: Parlamentar[],
): { resumos: ResumoEmendas[]; autoresSemCorrespondencia: string[] } => {
  const refPorChave = indicePorNome(parlamentares)

  const acumulados = new Map<string, Acumulado>()
  const semCorrespondencia = new Set<string>()

  for (const linha of linhas) {
    const ano = Number(linha["Ano da Emenda"])
    if (!Number.isInteger(ano) || ano < ANO_MINIMO_EMENDAS) continue

    const nome = linha["Nome do Autor da Emenda"] ?? ""
    if (SEM_INFORMACAO.has(nome)) continue

    const parlamentar = refPorChave.get(chaveDeNome(nome))
    if (!parlamentar) {
      semCorrespondencia.add(nome)
      continue
    }

    const chave = `${parlamentar.casa}:${parlamentar.id}:${ano}`
    let acumulado = acumulados.get(chave)
    if (!acumulado) {
      acumulado = {
        casa: parlamentar.casa,
        id: parlamentar.id,
        ano,
        empenhado: 0,
        pago: 0,
        porArea: new Map(),
        porLocal: new Map(),
      }
      acumulados.set(chave, acumulado)
    }

    const empenhado = numeroBr(linha["Valor Empenhado"])
    acumulado.empenhado += empenhado
    acumulado.pago += numeroBr(linha["Valor Pago"])

    const area = linha["Nome Função"] ?? ""
    if (!SEM_INFORMACAO.has(area)) {
      acumulado.porArea.set(area, (acumulado.porArea.get(area) ?? 0) + empenhado)
    }

    const local = localDaLinha(linha)
    if (local) {
      const chaveLocal = `${local.municipio ?? ""}|${local.uf ?? ""}`
      const atual = acumulado.porLocal.get(chaveLocal)
      if (atual) {
        atual.valor += empenhado
      } else {
        acumulado.porLocal.set(chaveLocal, { ...local, valor: empenhado })
      }
    }
  }

  const resumos = [...acumulados.values()]
    .map<ResumoEmendas>((acumulado) => ({
      casa: acumulado.casa,
      id: acumulado.id,
      ano: acumulado.ano,
      empenhado: arredondar(acumulado.empenhado),
      pago: arredondar(acumulado.pago),
      porArea: [...acumulado.porArea]
        .sort(([, a], [, b]) => b - a)
        .slice(0, MAIORES_AREAS)
        .map(([area, valor]) => ({ area, valor: arredondar(valor) })),
      porLocal: [...acumulado.porLocal.values()]
        .sort((a, b) => b.valor - a.valor)
        .slice(0, MAIORES_LOCAIS)
        .map((local) => ({ ...local, valor: arredondar(local.valor) })),
    }))
    .sort(
      (a, b) =>
        a.casa.localeCompare(b.casa) ||
        a.id.localeCompare(b.id) ||
        a.ano - b.ano,
    )

  return { resumos, autoresSemCorrespondencia: [...semCorrespondencia] }
}

const localDaLinha = (
  linha: LinhaDeEmenda,
): { municipio: string | null; uf: string | null } | null => {
  const uf = SIGLA_POR_NOME_DE_UF.get(chaveDeNome(linha.UF ?? "")) ?? null

  const municipio = linha["Município"] ?? ""
  if (!SEM_INFORMACAO.has(municipio)) return { municipio, uf }

  return uf ? { municipio: null, uf } : null
}

const arredondar = (valor: number) => Math.round(valor * 100) / 100

/** Chave de município comum ao Portal e ao TSE: "UF|NOME" sem acento. */
export const chaveDeMunicipio = (uf: string, municipio: string) =>
  `${uf}|${chaveDeNome(municipio)}`

export type EmendaNoMunicipio = { ano: number; municipio: string; valor: number }

/**
 * Empenhado por ano e município de cada parlamentar, sem o corte dos maiores
 * locais do resumo — o cruzamento com o mapa de votos precisa de todos e
 * escolhe de que ano em diante contar. Mesma regra de autoria e de ano mínimo
 * de `resumirEmendas`. Chave externa: "casa:id"; `municipio` em
 * `chaveDeMunicipio`.
 */
export const emendasPorMunicipio = (
  linhas: LinhaDeEmenda[],
  parlamentares: Parlamentar[],
  desde = ANO_MINIMO_EMENDAS,
): Map<string, EmendaNoMunicipio[]> => {
  const refPorChave = indicePorNome(parlamentares)
  const acumulado = new Map<string, Map<string, EmendaNoMunicipio>>()

  for (const linha of linhas) {
    const ano = Number(linha["Ano da Emenda"])
    if (!Number.isInteger(ano) || ano < desde) continue
    const parlamentar = refPorChave.get(chaveDeNome(linha["Nome do Autor da Emenda"] ?? ""))
    const local = localDaLinha(linha)
    if (!parlamentar || !local?.municipio || !local.uf) continue

    const chave = `${parlamentar.casa}:${parlamentar.id}`
    const doParlamentar = acumulado.get(chave) ?? new Map<string, EmendaNoMunicipio>()
    const municipio = chaveDeMunicipio(local.uf, local.municipio)
    const item = doParlamentar.get(`${ano}|${municipio}`) ?? { ano, municipio, valor: 0 }
    item.valor += numeroBr(linha["Valor Empenhado"])
    doParlamentar.set(`${ano}|${municipio}`, item)
    acumulado.set(chave, doParlamentar)
  }

  return new Map([...acumulado].map(([chave, itens]) => [chave, [...itens.values()]]))
}

/** Soma por município das emendas a partir de um ano. */
export const somarEmendasDesde = (itens: EmendaNoMunicipio[], desde: number) => {
  const soma = new Map<string, number>()
  for (const { ano, municipio, valor } of itens) {
    if (ano >= desde) soma.set(municipio, (soma.get(municipio) ?? 0) + valor)
  }
  return soma
}
