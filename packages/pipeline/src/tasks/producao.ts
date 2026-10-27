import {
  identificadorProposicao,
  parlamentarKey,
  SIGLAS_DE_PROJETO,
  type ProducaoLegislativa,
  type ProducaoPorTipo,
  type ProposicaoDestaque,
} from "@politicapp/data"

import type { AutoriaEmLote, ProposicaoEmLote } from "../sources/camara-arquivos"
import type { ProcessoSenadoApi } from "../sources/senado-parlamentar"
import { chaveDeNome } from "../sources/senado"

export const TIPOS_POR_PARLAMENTAR = 8
export const DESTAQUES_POR_LISTA = 10

const FICHA_CAMARA = "https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao="
const MATERIA_SENADO = "https://www25.senado.leg.br/web/atividade/materias/-/materia/"

const NORMA_CAMARA = "Transformado em Norma Jurídica"
/** Saiu aprovada da Câmara e ainda não virou norma. */
const APROVADA_NA_CAMARA =
  /^Aguardando (Apreciação pelo Senado Federal|Envio ao Senado Federal|Sanção|Promulgação)/

const NORMA_SENADO = /^TRANSFORMADA EM NORMA JUR/
const APROVADA_NO_SENADO = /^REMETIDA À CÂMARA DOS DEPUTADOS/

type Item = {
  sigla: string
  autor: boolean
  destaque: ProposicaoDestaque
  norma: boolean
  aprovada: boolean
}

const recentesPrimeiro = (a: ProposicaoDestaque, b: ProposicaoDestaque) =>
  (b.apresentadaEm ?? "").localeCompare(a.apresentadaEm ?? "") || b.id.localeCompare(a.id)

const resumir = (desde: number, itens: Item[]): ProducaoLegislativa => {
  const porSigla = new Map<string, ProducaoPorTipo>()
  let projetosAutor = 0
  let projetosCoautor = 0
  for (const { sigla, autor } of itens) {
    const atual = porSigla.get(sigla) ?? { sigla, autor: 0, coautor: 0 }
    if (autor) atual.autor += 1
    else atual.coautor += 1
    porSigla.set(sigla, atual)
    if (SIGLAS_DE_PROJETO.has(sigla)) {
      if (autor) projetosAutor += 1
      else projetosCoautor += 1
    }
  }

  const projetos = itens.filter(({ sigla }) => SIGLAS_DE_PROJETO.has(sigla))

  return {
    desde,
    porTipo: [...porSigla.values()]
      .sort(
        (a, b) =>
          b.autor + b.coautor - (a.autor + a.coautor) || a.sigla.localeCompare(b.sigla),
      )
      .slice(0, TIPOS_POR_PARLAMENTAR),
    projetos: { autor: projetosAutor, coautor: projetosCoautor },
    viraramNorma: projetos
      .filter(({ norma }) => norma)
      .map(({ destaque }) => destaque)
      .sort(recentesPrimeiro)
      .slice(0, DESTAQUES_POR_LISTA),
    aprovadasNaCasa: projetos
      .filter(({ aprovada, norma }) => aprovada && !norma)
      .map(({ destaque }) => destaque)
      .sort(recentesPrimeiro)
      .slice(0, DESTAQUES_POR_LISTA),
  }
}

/**
 * Produção de cada deputado a partir dos arquivos em lote: `autorias` e
 * `proposicoes` dos anos da legislatura. Autoria repetida (mesmo deputado,
 * mesma proposição) conta uma vez, como autor se em alguma linha ele for o
 * primeiro signatário.
 */
export const producaoDaCamara = (
  desde: number,
  autorias: AutoriaEmLote[],
  proposicoes: ProposicaoEmLote[],
  deputados: Set<string>,
): Map<string, ProducaoLegislativa> => {
  const porId = new Map(proposicoes.map((proposicao) => [proposicao.id, proposicao]))

  const porDeputado = new Map<string, Map<string, boolean>>()
  for (const { deputadoId, proposicaoId, autor } of autorias) {
    if (!deputados.has(deputadoId)) continue
    const doDeputado = porDeputado.get(deputadoId) ?? new Map<string, boolean>()
    doDeputado.set(proposicaoId, (doDeputado.get(proposicaoId) ?? false) || autor)
    porDeputado.set(deputadoId, doDeputado)
  }

  const resultado = new Map<string, ProducaoLegislativa>()
  for (const [deputadoId, assinadas] of porDeputado) {
    const itens: Item[] = []
    for (const [proposicaoId, autor] of assinadas) {
      const proposicao = porId.get(proposicaoId)
      if (!proposicao || proposicao.ano < desde) continue
      const situacao = proposicao.situacao ?? ""
      itens.push({
        sigla: proposicao.sigla,
        autor,
        norma: situacao === NORMA_CAMARA,
        aprovada: APROVADA_NA_CAMARA.test(situacao),
        destaque: {
          id: proposicao.id,
          identificacao: identificadorProposicao(proposicao),
          url: `${FICHA_CAMARA}${proposicao.id}`,
          ementa: proposicao.ementa,
          apresentadaEm: proposicao.apresentadaEm,
          autor,
        },
      })
    }
    resultado.set(parlamentarKey({ casa: "camara", id: deputadoId }), resumir(desde, itens))
  }
  return resultado
}

/**
 * A API de processos do Senado devolve tudo que o senador assinou, de
 * qualquer ano; `autoria` lista os signatários com o primeiro à frente.
 */
export const producaoDoSenador = (
  desde: number,
  nomeSenador: string,
  processos: ProcessoSenadoApi[],
): ProducaoLegislativa => {
  const nome = chaveDeNome(nomeSenador)
  const vistos = new Set<number>()
  const itens: Item[] = []

  for (const processo of processos) {
    if (vistos.has(processo.id)) continue
    vistos.add(processo.id)
    const apresentadaEm = processo.dataApresentacao?.slice(0, 10) ?? null
    if (!apresentadaEm || Number(apresentadaEm.slice(0, 4)) < desde) continue

    const sigla = processo.identificacao.split(" ")[0] ?? ""
    // "Senador Alan Rick (UNIÃO/AC), Senadora …" — o primeiro é o autor.
    const primeiro = chaveDeNome(
      (processo.autoria ?? "").split(",")[0]?.replace(/\(.*$/, "") ?? "",
    ).replace(/^SENADORA? /, "")
    const autor = nome.length > 0 && primeiro === nome
    const situacao = processo.situacaoAtual ?? ""

    itens.push({
      sigla,
      autor,
      norma: NORMA_SENADO.test(situacao),
      aprovada: APROVADA_NO_SENADO.test(situacao),
      destaque: {
        id: String(processo.id),
        identificacao: processo.identificacao,
        url: `${MATERIA_SENADO}${processo.codigoMateria}`,
        ementa: processo.ementa ?? "",
        apresentadaEm,
        autor,
      },
    })
  }

  return resumir(desde, itens)
}
