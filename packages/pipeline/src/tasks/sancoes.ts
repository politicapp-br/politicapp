import type {
  Casa,
  FornecedorSancionado,
  Sancao,
  SancoesDoParlamentar,
  SancoesPorCasa,
} from "@politicapp/data"

import type { LancamentoDespesa } from "../sources/camara"
import type { LinhaDeCeis } from "../sources/transparencia"
import { semCpfNoNome } from "./fornecedores"

export const apenasDigitos = (valor: string) => valor.replace(/\D/g, "")

const DATA_BR = /^(\d{2})\/(\d{2})\/(\d{4})$/

/** "21/11/2017" → "2017-11-21"; qualquer outra coisa vira nulo. */
export const dataIso = (valor: string | undefined): string | null => {
  const partes = valor?.trim().match(DATA_BR)
  if (!partes) return null
  return `${partes[3]}-${partes[2]}-${partes[1]}`
}

export type SancionadoVigente = {
  nome: string
  sancoes: Sancao[]
}

/**
 * CNPJs/CPFs com sanção vigente em `hoje`: início conhecido e já passado,
 * final vazia (sem prazo) ou ainda por vir.
 */
export const sancoesVigentes = (
  linhas: LinhaDeCeis[],
  hoje: string,
): Map<string, SancionadoVigente> => {
  const vigentes = new Map<string, SancionadoVigente>()

  for (const linha of linhas) {
    const documento = apenasDigitos(linha["CPF OU CNPJ DO SANCIONADO"] ?? "")
    if (!documento) continue

    const inicio = dataIso(linha["DATA INÍCIO SANÇÃO"])
    if (!inicio || inicio > hoje) continue

    const fim = dataIso(linha["DATA FINAL SANÇÃO"])
    if (fim && fim < hoje) continue

    const sancao: Sancao = {
      categoria: linha["CATEGORIA DA SANÇÃO"] ?? "",
      orgao: linha["ÓRGÃO SANCIONADOR"] || null,
      esfera: linha["ESFERA ÓRGÃO SANCIONADOR"] || null,
      inicio,
      fim,
    }

    const atual = vigentes.get(documento)
    if (atual) {
      atual.sancoes.push(sancao)
    } else {
      vigentes.set(documento, {
        nome: linha["NOME DO SANCIONADO"] ?? "",
        sancoes: [sancao],
      })
    }
  }

  return vigentes
}

type LancamentosDaCasa = { casa: Casa; lancamentos: LancamentoDespesa[] }

/**
 * CPF de pessoa sancionada sai mascarado como no próprio Portal da
 * Transparência (***.456.789-**); CNPJ é público e fica inteiro.
 */
export const documentoPublicavel = (documento: string) =>
  documento.length === 11
    ? `***.${documento.slice(3, 6)}.${documento.slice(6, 9)}-**`
    : documento

const arredondar = (valor: number) => Math.round(valor * 100) / 100

/**
 * Cruza a cota parlamentar com o CEIS: para cada parlamentar, os fornecedores
 * pagos no ano que estão hoje com sanção vigente. O nome exibido é o do
 * recibo da cota — é como o leitor encontra o gasto na prestação de contas.
 */
export const cruzarSancoes = (
  porCasa: LancamentosDaCasa[],
  vigentes: Map<string, SancionadoVigente>,
): { parlamentares: SancoesDoParlamentar[]; porCasa: SancoesPorCasa[] } => {
  const parlamentares: SancoesDoParlamentar[] = []
  const agregados: SancoesPorCasa[] = []

  for (const { casa, lancamentos } of porCasa) {
    const fornecedoresPorParlamentar = new Map<
      string,
      Map<string, FornecedorSancionado>
    >()

    for (const lancamento of lancamentos) {
      // Lançamento só com glosa não foi pago — não é gasto com o sancionado.
      if (lancamento.valor <= 0) continue
      const documento = apenasDigitos(lancamento.cnpjCpf ?? "")
      if (!documento) continue

      const sancionado = vigentes.get(documento)
      if (!sancionado) continue

      const fornecedores =
        fornecedoresPorParlamentar.get(lancamento.parlamentarId) ?? new Map()
      fornecedoresPorParlamentar.set(lancamento.parlamentarId, fornecedores)

      const atual = fornecedores.get(documento)
      if (atual) {
        atual.totalGasto += lancamento.valor
      } else {
        fornecedores.set(documento, {
          nome: semCpfNoNome(lancamento.fornecedor || sancionado.nome),
          cnpjCpf: documentoPublicavel(documento),
          totalGasto: lancamento.valor,
          sancoes: sancionado.sancoes,
        })
      }
    }

    let totalDaCasa = 0
    for (const [id, fornecedores] of fornecedoresPorParlamentar) {
      const lista = [...fornecedores.values()]
        .map((fornecedor) => ({
          ...fornecedor,
          totalGasto: arredondar(fornecedor.totalGasto),
        }))
        .sort((a, b) => b.totalGasto - a.totalGasto)

      totalDaCasa += lista.reduce((soma, item) => soma + item.totalGasto, 0)
      parlamentares.push({ casa, id, fornecedores: lista })
    }

    if (fornecedoresPorParlamentar.size > 0) {
      agregados.push({
        casa,
        parlamentares: fornecedoresPorParlamentar.size,
        total: arredondar(totalDaCasa),
      })
    }
  }

  parlamentares.sort(
    (a, b) => a.casa.localeCompare(b.casa) || a.id.localeCompare(b.id),
  )

  return { parlamentares, porCasa: agregados }
}
