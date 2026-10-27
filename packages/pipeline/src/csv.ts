const BOM = "﻿"

/**
 * Linha a linha, para quem processa arquivos de dezenas de MB sem guardar
 * todas as linhas de uma vez.
 */
export function* linhasCsv(conteudo: string, separador = ";"): Generator<string[]> {
  const texto = conteudo.startsWith(BOM) ? conteudo.slice(1) : conteudo
  let campo = ""
  let linha: string[] = []
  let dentroDeAspas = false

  for (let i = 0; i < texto.length; i += 1) {
    const caractere = texto[i]

    if (dentroDeAspas) {
      if (caractere === '"') {
        if (texto[i + 1] === '"') {
          campo += '"'
          i += 1
        } else {
          dentroDeAspas = false
        }
      } else {
        campo += caractere
      }
      continue
    }

    if (caractere === '"') {
      dentroDeAspas = true
      continue
    }

    if (caractere === separador) {
      linha.push(campo)
      campo = ""
      continue
    }

    if (caractere === "\n") {
      linha.push(campo.replace(/\r$/, ""))
      yield linha
      linha = []
      campo = ""
      continue
    }

    campo += caractere
  }

  if (campo.length > 0 || linha.length > 0) {
    linha.push(campo.replace(/\r$/, ""))
    yield linha
  }
}

export const lerCsv = (conteudo: string, separador = ";"): string[][] => [
  ...linhasCsv(conteudo, separador),
]

/**
 * Como `lerCsvComCabecalho`, mas entrega cada linha a `projetar` e guarda só
 * o que ela devolve — a linha inteira, com todas as colunas, nunca fica
 * acumulada.
 */
export const projetarCsv = <T>(
  conteudo: string,
  projetar: (linha: Record<string, string>) => T | null,
  separador = ";",
): T[] => {
  const linhas = linhasCsv(conteudo, separador)
  const cabecalho = linhas.next().value
  if (!cabecalho) return []
  const resultado: T[] = []
  for (const linha of linhas) {
    if (linha.length !== cabecalho.length) continue
    const registro: Record<string, string> = {}
    for (let indice = 0; indice < cabecalho.length; indice += 1) {
      registro[cabecalho[indice] ?? ""] = linha[indice] ?? ""
    }
    const projetado = projetar(registro)
    if (projetado !== null) resultado.push(projetado)
  }
  return resultado
}

type OpcoesCsv = { separador?: string; pularLinhas?: number }

export const lerCsvComCabecalho = (
  conteudo: string,
  { separador = ";", pularLinhas = 0 }: OpcoesCsv = {},
): Record<string, string>[] => {
  const [cabecalho, ...linhas] = lerCsv(conteudo, separador).slice(pularLinhas)
  if (!cabecalho) return []

  return linhas
    .filter((linha) => linha.length === cabecalho.length)
    .map((linha) =>
      Object.fromEntries(
        cabecalho.map((coluna, indice) => [coluna, linha[indice] ?? ""]),
      ),
    )
}

export const numeroBr = (valor: string | undefined): number => {
  if (!valor) return 0
  const normalizado = valor.includes(",")
    ? valor.replace(/\./g, "").replace(",", ".")
    : valor
  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : 0
}
