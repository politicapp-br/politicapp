import type {
  BancadaPartido,
  Casa,
  FinancasPartido,
  IndiceParlamentar,
  LiderPartido,
  PartidoResumo,
} from "@politicapp/data"
import { percentil } from "@politicapp/data"

import type { LiderPartidoApi, PartidoApi } from "../sources/camara"
import type { LinhaDeReceita } from "../sources/tse"
import { numeroBr } from "../csv"

/** TSE e Câmara grafam siglas de forma diferente ("PC do B" × "PCdoB"). */
export const chaveDeSigla = (sigla: string) => {
  const chave = sigla.toLocaleUpperCase("pt-BR").replace(/\s+/g, "")
  return APELIDOS_DE_SIGLA[chave] ?? chave
}

const APELIDOS_DE_SIGLA: Record<string, string> = {
  SDD: "SOLIDARIEDADE",
  // O Senado grafa por extenso a sigla que a Câmara abrevia.
  PODEMOS: "PODE",
}

const TITULO_DE_LIDER = /líder/i

/** Só as lideranças vigentes — o recurso devolve também as encerradas. */
export const lideresVigentes = (lideres: LiderPartidoApi[]): LiderPartido[] =>
  lideres
    .filter((lider) => !lider.dataFim && TITULO_DE_LIDER.test(lider.titulo ?? ""))
    .map((lider) => ({
      id: String(lider.id),
      nome: lider.nome,
      titulo: lider.titulo ?? "Líder",
    }))
    .sort(
      (a, b) =>
        Number(a.titulo !== "Líder") - Number(b.titulo !== "Líder") ||
        a.titulo.localeCompare(b.titulo, "pt-BR") ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    )

export type PartidoComLideres = PartidoApi & { lideres: LiderPartido[] }

const CASAS: Casa[] = ["camara", "senado"]

/**
 * Junta catálogo da Câmara, bancadas apuradas do índice e finanças do TSE.
 * Sigla que só existe no índice (caso de partido sem registro na API da
 * Câmara) ganha entrada própria para a tela do app nunca ficar sem dado.
 */
export const montarPartidos = (
  catalogo: PartidoComLideres[],
  parlamentares: IndiceParlamentar[],
  financasPorSigla: Map<string, FinancasPartido>,
): PartidoResumo[] => {
  const porSigla = new Map<string, PartidoResumo>()

  for (const partido of catalogo) {
    porSigla.set(chaveDeSigla(partido.sigla), {
      sigla: partido.sigla,
      nome: partido.nome,
      lideres: partido.lideres,
      bancadas: [],
      financas: null,
    })
  }

  for (const parlamentar of parlamentares) {
    if (parlamentar.partido === "—") continue
    const chave = chaveDeSigla(parlamentar.partido)
    if (!porSigla.has(chave)) {
      porSigla.set(chave, {
        sigla: parlamentar.partido,
        nome: parlamentar.partido,
        lideres: [],
        bancadas: [],
        financas: null,
      })
    }
  }

  for (const [chave, partido] of porSigla) {
    partido.bancadas = CASAS.flatMap((casa) => {
      const bancada = parlamentares.filter(
        (parlamentar) =>
          parlamentar.casa === casa && chaveDeSigla(parlamentar.partido) === chave,
      )
      if (bancada.length === 0) return []

      const gastos = bancada.map((parlamentar) => parlamentar.gastoAno ?? 0)
      const participacoes = bancada
        .map((parlamentar) => parlamentar.participacaoPercentual)
        .filter((valor): valor is number => valor !== null)

      return [
        {
          casa,
          membros: bancada.length,
          gastoTotal: arredondar(gastos.reduce((soma, valor) => soma + valor, 0)),
          gastoMediano: arredondar(percentil(gastos, 0.5)),
          participacaoMediana:
            participacoes.length > 0
              ? arredondar(percentil(participacoes, 0.5))
              : null,
        } satisfies BancadaPartido,
      ]
    })

    partido.financas = financasPorSigla.get(chave) ?? null
  }

  return [...porSigla.values()].sort((a, b) =>
    a.sigla.localeCompare(b.sigla, "pt-BR"),
  )
}

const MAIORES_DOADORES = 10
const NULO_TSE = "#NULO#"
const CNPJ_DIGITOS = 14

// É dinheiro público o que entra como cota do Fundo Partidário (o repasse do
// TSE) ou pelo fundo especial de campanha. O campo "fonte" não serve de
// critério: doações privadas depositadas na conta do fundo também vêm
// marcadas como "Fundo Partidário".
const eDinheiroPublico = (linha: LinhaDeReceita) =>
  /FUNDO/i.test(linha.DS_TP_ORIGEM_DOACAO ?? "") ||
  /FUNDO ESPECIAL/i.test(linha.DS_TP_FONTE_RECURSO ?? "")

/**
 * Agrega as receitas da esfera nacional por partido: total, dinheiro público
 * × demais, e os maiores doadores fora dos fundos. CPF de pessoa física não
 * vai para o JSON publicado — só CNPJ inteiro (14 dígitos) é mantido.
 */
export const agregarReceitasPartidarias = (
  linhas: LinhaDeReceita[],
  ano: number,
  fonteUrl: string,
): Map<string, FinancasPartido> => {
  type Acumulado = {
    total: number
    fundos: number
    doadores: Map<string, { nome: string; documento: string | null; valor: number }>
  }
  const porPartido = new Map<string, Acumulado>()

  for (const linha of linhas) {
    const sigla = linha.SG_PARTIDO
    if (!sigla || sigla === NULO_TSE) continue

    const chave = chaveDeSigla(sigla)
    let acumulado = porPartido.get(chave)
    if (!acumulado) {
      acumulado = { total: 0, fundos: 0, doadores: new Map() }
      porPartido.set(chave, acumulado)
    }

    const valor = numeroBr(linha.VR_RECEITA)
    acumulado.total += valor

    if (eDinheiroPublico(linha)) {
      acumulado.fundos += valor
      continue
    }

    const nome = linha.NM_DOADOR
    if (!nome || nome === NULO_TSE) continue

    const documento = (linha.NR_CPF_CNPJ_DOADOR ?? "").replace(/\D/g, "")
    const chaveDoador = documento || nome.toLocaleUpperCase("pt-BR")
    const doador = acumulado.doadores.get(chaveDoador)
    if (doador) {
      doador.valor += valor
    } else {
      acumulado.doadores.set(chaveDoador, {
        nome,
        documento: documento.length === CNPJ_DIGITOS ? documento : null,
        valor,
      })
    }
  }

  return new Map(
    [...porPartido].map(([chave, acumulado]) => [
      chave,
      {
        ano,
        total: arredondar(acumulado.total),
        fundos: arredondar(acumulado.fundos),
        demais: arredondar(acumulado.total - acumulado.fundos),
        topDoadores: [...acumulado.doadores.values()]
          .sort((a, b) => b.valor - a.valor)
          .slice(0, MAIORES_DOADORES)
          .map((doador) => ({ ...doador, valor: arredondar(doador.valor) })),
        fonteUrl,
      },
    ]),
  )
}

const arredondar = (valor: number) => Math.round(valor * 100) / 100
