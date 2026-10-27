import { unzipSync } from "fflate"

import { log } from "../config"
import { buscarBinario } from "../http"

const BASE =
  "https://cdn.tse.jus.br/estatistica/sead/odsele/prestacao_contas_anual_partidaria"

export const urlReceitasPartidarias = (ano: number) =>
  `${BASE}/prestacao_contas_anual_partidaria_${ano}.zip`

export type LinhaDeReceita = Record<string, string>

/**
 * O TSE põe todos os campos entre aspas mas não escapa aspas dentro deles
 * (a prestação de 2026 tem um doador `"GUILHERME SANT"ANA"`), o que
 * desalinha um parser CSV padrão dali em diante. Como cada registro ocupa
 * uma linha física e o separador é sempre `";"`, o parse é por linha.
 */
export const lerCsvDoTse = (conteudo: string): LinhaDeReceita[] => {
  const [primeira, ...linhas] = conteudo.split("\n")
  if (!primeira) return []

  const cabecalho = separarCampos(primeira)

  return linhas
    .map(separarCampos)
    .filter((campos) => campos.length === cabecalho.length)
    .map((campos) =>
      Object.fromEntries(
        cabecalho.map((coluna, indice) => [coluna, campos[indice] ?? ""]),
      ),
    )
}

/**
 * Campo a campo: texto vem entre aspas, número às vezes sem (`;7;"DEPUTADO"`).
 * Dentro de um campo entre aspas, a aspa só fecha se vier antes de `;` ou do
 * fim da linha — assim `"GUILHERME SANT"ANA"` continua um campo só.
 */
export const separarCampos = (linha: string): string[] => {
  const limpa = linha.replace(/\r$/, "")
  if (limpa.length === 0) return []

  const campos: string[] = []
  let inicio = 0
  for (;;) {
    let fim: number
    if (limpa[inicio] === '"') {
      let aspa = limpa.indexOf('"', inicio + 1)
      while (aspa >= 0 && aspa < limpa.length - 1 && limpa[aspa + 1] !== ";") {
        aspa = limpa.indexOf('"', aspa + 1)
      }
      if (aspa < 0) {
        campos.push(limpa.slice(inicio + 1))
        return campos
      }
      campos.push(limpa.slice(inicio + 1, aspa))
      fim = aspa + 1
    } else {
      const separador = limpa.indexOf(";", inicio)
      fim = separador < 0 ? limpa.length : separador
      campos.push(limpa.slice(inicio, fim))
    }
    if (fim >= limpa.length) return campos
    inicio = fim + 1
  }
}

/**
 * Receitas declaradas ao TSE pelos diretórios nacionais. O zip traz dois
 * consolidados: `_BR` (só a esfera nacional) e `_BRASIL` (todas as esferas).
 * Fica o `_BR`: no `_BRASIL` os repasses internos entre diretórios do mesmo
 * partido aparecem como receita duas vezes, e é na esfera nacional que
 * entram o Fundo Partidário e as grandes doações.
 */
export const baixarReceitasPartidarias = async (
  ano: number,
): Promise<LinhaDeReceita[]> => {
  const url = urlReceitasPartidarias(ano)
  log(`tse: baixando ${url}`)

  const zip = unzipSync(await buscarBinario(url))
  const nome = `receita_anual_${ano}_BR.csv`
  const arquivo = zip[nome]
  if (!arquivo) {
    throw new Error(`Zip do TSE não contém ${nome}`)
  }

  const linhas = lerCsvDoTse(new TextDecoder("iso-8859-1").decode(arquivo))
  log(`tse: ${linhas.length} receitas da esfera nacional em ${ano}`)
  return linhas
}
