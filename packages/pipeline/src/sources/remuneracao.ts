import {
  percentil,
  tipoDeMoradia,
  type BeneficioPosMandato,
  type FolhaCamara,
  type GrupoFolha,
  type Moradia,
  type OrcamentoAno,
  type Parlamentar,
  type Subsidio,
} from "@politicapp/data"

import { log } from "../config"
import { lerCsvComCabecalho, numeroBr } from "../csv"
import {
  buscarJson,
  buscarTexto,
  emLotes,
  TIMEOUT_ARQUIVO_GRANDE_MS,
  vazioSe404,
} from "../http"
import { chaveDeNome } from "./senado"

const RELATORIOS =
  "https://www2.camara.leg.br/transparencia/recursos-humanos/remuneracao/relatorios-consolidados-por-ano-e-mes"
const MORADIA = "https://www.camara.leg.br/moradia/detalhamento"
const ADM_SENADO = "https://adm.senado.gov.br/adm-dadosabertos/api/v1"

const MESES = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
]

export type MoradiaPorParlamentar = Map<string, Moradia>

// ---------------------------------------------------------------------------
// Subsídio — via folha consolidada da Câmara
// ---------------------------------------------------------------------------

/**
 * A Câmara publica a folha mensal em CSV, mas anonimizada: cada linha é
 * "Deputado 8158", sem nome. Isso serve justamente para o que precisamos —
 * o subsídio é idêntico para os 513, então a folha do grupo "Parlamentar" dá
 * o contracheque do cargo. O mesmo bruto vale para o Senado: é a mesma lei.
 *
 * O bruto sai da moda da coluna (linhas com valor menor são de quem entrou ou
 * saiu no meio do mês). Os descontos vêm da linha inteira mais repetida entre
 * essas, e não da mediana coluna a coluna: previdência e IR variam com o
 * regime e os dependentes de cada um, e medianas independentes montariam um
 * contracheque que não fecha na subtração.
 */
export type FolhaApurada = { subsidio: Subsidio; folha: FolhaCamara }

export const baixarFolhaCamara = async (ano: number): Promise<FolhaApurada> => {
  const candidatos = await listarFolhas(ano)

  // Do mês mais recente para trás: se o link apontar para algo que não parse
  // como folha (aconteceu com fevereiro/2026, cujo slug de CSV é o do PDF
  // com sufixo "-1"), tenta o mês anterior em vez de falhar o pipeline.
  for (const { url, mes, anoDoArquivo } of candidatos) {
    const apurada = await apurarFolha(url, mes, anoDoArquivo).catch(
      (erro: unknown) => {
        log(`câmara: folha de ${MESES[mes - 1]}/${anoDoArquivo} inválida — ${String(erro)}`)
        return null
      },
    )
    if (apurada) return apurada
  }

  throw new Error(`Nenhuma folha consolidada da Câmara legível para ${ano}`)
}

const apurarFolha = async (
  url: string,
  mes: number,
  anoDoArquivo: number,
): Promise<FolhaApurada> => {
  log(`câmara: folha de ${MESES[mes - 1]}/${anoDoArquivo} — ${url}`)

  // A folha lista a Casa inteira, não só parlamentares — é um CSV de vários MB.
  const linhas = lerCsvComCabecalho(
    await buscarTexto(url, {
      codificacao: "iso-8859-1",
      timeoutMs: TIMEOUT_ARQUIVO_GRANDE_MS,
    }),
  )
  const parlamentares = linhas.filter(
    (linha) => coluna(linha, "grupo funcional") === "Parlamentar",
  )

  if (parlamentares.length === 0) {
    throw new Error(`Folha da Câmara sem linhas de parlamentar em ${url}`)
  }

  const valorDe = (linha: Record<string, string>, trecho: string) =>
    Math.abs(numeroBr(coluna(linha, trecho)))

  const bruto = maisFrequente(
    parlamentares
      .map((linha) => valorDe(linha, "remuneração fixa"))
      .filter((valor) => valor > 0),
  )

  const mesCheio = parlamentares.filter(
    (linha) => valorDe(linha, "remuneração fixa") === bruto,
  )

  const contracheque = maisFrequente(
    mesCheio.map((linha) =>
      [
        // O cabeçalho da Câmara traz "Constribuição Previdenciária", com o typo.
        valorDe(linha, "previdenci"),
        valorDe(linha, "imposto de renda"),
        valorDe(linha, "após descontos obrigatórios"),
      ].join("|"),
    ),
  )

  const [previdencia = 0, impostoRenda = 0, liquido = 0] = contracheque
    .split("|")
    .map(Number)

  const subsidio: Subsidio = {
    bruto,
    previdencia,
    impostoRenda,
    liquido,
    parlamentaresComEsseLiquido: mesCheio.filter(
      (linha) => valorDe(linha, "após descontos obrigatórios") === liquido,
    ).length,
    parlamentaresNaFolha: mesCheio.length,
    ano: anoDoArquivo,
    mes,
    fonteUrl: url,
  }

  log(
    `câmara: subsídio ${bruto} bruto, líquido mais comum ${liquido} em ${subsidio.parlamentaresComEsseLiquido} de ${subsidio.parlamentaresNaFolha} contracheques`,
  )

  return {
    subsidio,
    folha: apurarGruposDaFolha(linhas, url, mes, anoDoArquivo),
  }
}

export type SalarioMensal = { mes: number; bruto: number }

/**
 * Bruto do subsídio mês a mês, uma folha por mês do ano. É o que permite
 * acumular o salário de anos fechados do mandato: o valor muda em degraus
 * (fev/2023, fev/2025) e cada folha registra o que foi pago naquele mês.
 * Mês com folha ilegível fica de fora — `meses` no agregado reflete isso.
 */
/** O ano ainda não tem folha consolidada (comum em janeiro e fevereiro). */
export class SemFolhaPublicada extends Error {}

export const baixarSalariosDoAno = async (
  ano: number,
): Promise<SalarioMensal[]> => {
  const pagina = await buscarTexto(`${RELATORIOS}/${ano}`)
  const folhas = extrairFolhas(pagina, ano)
  if (folhas.length === 0) {
    throw new SemFolhaPublicada(`Nenhuma folha consolidada da Câmara publicada para ${ano}`)
  }

  const mensais = await emLotes(folhas, async ({ url, mes, anoDoArquivo }) => {
    const bruto = await brutoDaFolha(url).catch((erro: unknown) => {
      log(
        `câmara: folha de ${MESES[mes - 1]}/${anoDoArquivo} ilegível — ${String(erro)}`,
      )
      return null
    })
    return bruto === null ? null : { mes, bruto }
  })

  return mensais
    .filter((salario) => salario !== null)
    .sort((a, b) => a.mes - b.mes)
}

const brutoDaFolha = async (url: string): Promise<number> => {
  const linhas = lerCsvComCabecalho(
    await buscarTexto(url, {
      codificacao: "iso-8859-1",
      timeoutMs: TIMEOUT_ARQUIVO_GRANDE_MS,
    }),
  )
  const brutos = linhas
    .filter((linha) => coluna(linha, "grupo funcional") === "Parlamentar")
    .map((linha) => Math.abs(numeroBr(coluna(linha, "remuneração fixa"))))
    .filter((valor) => valor > 0)

  if (brutos.length === 0) {
    throw new Error(`Folha da Câmara sem linhas de parlamentar em ${url}`)
  }

  return maisFrequente(brutos)
}

const DEPUTADOS = 513

/**
 * A mesma folha traz todos os grupos da casa — servidores, secretários,
 * aposentadorias. Como é anonimizada, dá para medir a máquina inteira sem
 * expor ninguém. O salário do secretário parlamentar fica na coluna de cargo
 * em comissão (a remuneração fixa dele vem zerada).
 */
export const apurarGruposDaFolha = (
  linhas: Record<string, string>[],
  fonteUrl: string,
  mes: number,
  ano: number,
): FolhaCamara => {
  const porGrupo = new Map<string, Record<string, string>[]>()
  for (const linha of linhas) {
    const grupo = coluna(linha, "grupo funcional")
    if (!grupo) continue
    const lista = porGrupo.get(grupo)
    if (lista) lista.push(linha)
    else porGrupo.set(grupo, [linha])
  }

  const massaDe = (linha: Record<string, string>) =>
    numeroBr(coluna(linha, "remuneração fixa")) +
    numeroBr(coluna(linha, "vantagens de natureza pessoal")) +
    numeroBr(coluna(linha, "cargo em comissão"))

  const grupos: GrupoFolha[] = [...porGrupo.entries()]
    .map(([grupo, doGrupo]) => ({
      grupo,
      quantidade: doGrupo.length,
      massaMensal: doGrupo.reduce((total, linha) => total + massaDe(linha), 0),
    }))
    .sort((a, b) => b.massaMensal - a.massaMensal)

  const secretarios = porGrupo.get("Secretário Parlamentar") ?? []
  const salarios = secretarios
    .map((linha) => numeroBr(coluna(linha, "cargo em comissão")))
    .filter((valor) => valor > 0)

  const beneficio = (grupo: string): BeneficioPosMandato => {
    const proventos = (porGrupo.get(grupo) ?? []).map((linha) =>
      numeroBr(coluna(linha, "remuneração fixa")),
    )
    return {
      beneficiarios: proventos.length,
      medianaMensal: percentil(proventos, 0.5),
      totalMensal: proventos.reduce((total, valor) => total + valor, 0),
    }
  }

  return {
    ano,
    mes,
    fonteUrl,
    grupos,
    secretarios: {
      quantidade: secretarios.length,
      massaMensal: salarios.reduce((total, valor) => total + valor, 0),
      salarioMediano: percentil(salarios, 0.5),
      mediaPorGabinete: secretarios.length / DEPUTADOS,
    },
    aposentadoriaParlamentar: beneficio("Aposentadoria Parlamentar"),
    pensaoParlamentar: beneficio("Pensão Parlamentar"),
  }
}

export const maisFrequente = <T>(valores: T[]): T => {
  const contagem = new Map<T, number>()
  for (const valor of valores) {
    contagem.set(valor, (contagem.get(valor) ?? 0) + 1)
  }

  const campeao = [...contagem.entries()].sort(([, a], [, b]) => b - a)[0]
  if (!campeao) throw new Error("maisFrequente de lista vazia")

  return campeao[0]
}

type FolhaListada = { url: string; mes: number; anoDoArquivo: number }

/**
 * O slug do arquivo não é confiável: julho é "julho-de-2026-csv", mas o CSV
 * de fevereiro é "fevereiro-de-2026-1" — quem diz o formato é o TEXTO do
 * link ("CSV"/"PDF"), não a URL. Por isso lemos as âncoras da listagem do
 * ano e casamos slug de mês + texto CSV. Em janeiro o ano corrente ainda
 * pode estar vazio — daí o recuo para o ano anterior.
 */
export const extrairFolhas = (html: string, ano: number): FolhaListada[] =>
  [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
    .flatMap(([, url, rotulo]) => {
      if (!url || semTags(rotulo ?? "").trim().toUpperCase() !== "CSV") return []
      const slug = /\/(\w+)-de-(\d{4})[^/]*$/.exec(url)
      const mes = MESES.indexOf(slug?.[1] ?? "") + 1
      if (mes === 0 || Number(slug?.[2]) !== ano) return []
      return [{ url, mes, anoDoArquivo: ano }]
    })
    .sort((a, b) => b.mes - a.mes)

const listarFolhas = async (ano: number): Promise<FolhaListada[]> => {
  for (const candidato of [ano, ano - 1]) {
    const pagina = await buscarTexto(`${RELATORIOS}/${candidato}`).catch(() => "")
    const folhas = extrairFolhas(pagina, candidato)
    if (folhas.length > 0) return folhas
  }

  throw new Error(`Nenhuma folha consolidada da Câmara publicada para ${ano}`)
}

const coluna = (linha: Record<string, string>, trecho: string) => {
  const alvo = trecho.toLocaleLowerCase("pt-BR")
  const chave = Object.keys(linha).find((nome) =>
    nome.toLocaleLowerCase("pt-BR").includes(alvo),
  )
  return chave ? (linha[chave] ?? "") : ""
}

// ---------------------------------------------------------------------------
// Moradia dos deputados — só existe como HTML
// ---------------------------------------------------------------------------

const POR_PAGINA = 20

/**
 * A Câmara não expõe moradia em dados abertos; a única fonte é a tabela
 * paginada do portal de gastos parlamentares. Por isso essa raspagem vive no
 * pipeline, e não no app: HTML quebra, e quando quebrar é melhor que quebre
 * aqui — o app segue servindo o JSON anterior.
 */
export const baixarMoradiaCamara = async (
  ano: number,
  deputados: Parlamentar[],
): Promise<MoradiaPorParlamentar> => {
  const primeira = await buscarTexto(urlDaMoradia(ano, 1))
  const total = totalDeResultados(primeira)

  // Contador sumiu = o layout mudou. Melhor falhar alto (o pipeline tolera e
  // mantém o JSON anterior) do que publicar só a primeira página como se
  // fosse tudo.
  if (total === 0) {
    throw new Error(
      linhasDaTabela(primeira).length > 0
        ? "Página de moradia da Câmara sem contador de resultados — layout mudou?"
        : "Página de moradia da Câmara sem tabela — layout mudou?",
    )
  }

  const paginas = Math.ceil(total / POR_PAGINA)

  log(`câmara: ${total} registros de moradia em ${ano} (${paginas} páginas)`)

  const restantes = await emLotes(
    Array.from({ length: paginas - 1 }, (_, indice) => indice + 2),
    (pagina) => buscarTexto(urlDaMoradia(ano, pagina)),
  )

  const idPorChave = new Map(
    deputados.map((deputado) => [
      `${chaveDeNome(deputado.nome)}|${deputado.uf}`,
      deputado.id,
    ]),
  )

  const moradias: MoradiaPorParlamentar = new Map()
  let semCorrespondencia = 0

  for (const html of [primeira, ...restantes]) {
    for (const linha of linhasDaTabela(html)) {
      const registro = interpretarLinhaDeMoradia(linha)
      if (!registro) continue

      const id = idPorChave.get(`${chaveDeNome(registro.nome)}|${registro.uf}`)
      if (!id) {
        semCorrespondencia += 1
        continue
      }

      moradias.set(id, registro.moradia)
    }
  }

  log(
    `câmara: moradia de ${moradias.size} deputados em exercício (${semCorrespondencia} registros de suplentes ou licenciados descartados)`,
  )

  return moradias
}

const urlDaMoradia = (ano: number, pagina: number) =>
  `${MORADIA}?deputado=Todos&situacao=todos&cargo=deputado&ordenacao=nome` +
  `&dataInicial=01/${ano}&dataFinal=12/${ano}&pagina=${pagina}`

const totalDeResultados = (html: string) => {
  const texto = semTags(html)
  const encontrado = /de\s+[\d.]+\s+a\s+[\d.]+\s+de\s+([\d.]+)/.exec(texto)
  return Number(encontrado?.[1]?.replace(/\./g, "")) || 0
}

export const linhasDaTabela = (html: string): string[][] => {
  const corpo = /<tbody[\s\S]*?<\/tbody>/.exec(html)?.[0]
  if (!corpo) return []

  return [...corpo.matchAll(/<tr[\s\S]*?<\/tr>/g)].map(([linha]) =>
    [...linha.matchAll(/<td[\s\S]*?<\/td>/g)].map(([celula]) =>
      semTags(celula).trim(),
    ),
  )
}

const semTags = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, codigo: string) =>
      String.fromCharCode(Number(codigo)),
    )
    .replace(/\s+/g, " ")

export const interpretarLinhaDeMoradia = (celulas: string[]) => {
  const [identificacao, dias, auxilio, complemento] = celulas
  if (!identificacao || celulas.length < 4) return null

  const nomeEPartido = /^(.+?)\s*\(([^)]+)-([A-Z]{2})\)$/.exec(identificacao)
  if (!nomeEPartido) return null

  const [, nome = "", , uf = ""] = nomeEPartido
  const diasEmImovelFuncional = Number(/(\d+)/.exec(dias ?? "")?.[1] ?? 0)
  const auxilioRecebido = numeroBr((auxilio ?? "").replace(/R\$\s*/, ""))
  const complementoComCota = numeroBr((complemento ?? "").replace(/R\$\s*/, ""))

  return {
    nome,
    uf,
    moradia: {
      tipo: tipoDeMoradia(diasEmImovelFuncional > 0, auxilioRecebido > 0),
      diasEmImovelFuncional,
      auxilioRecebido,
      complementoComCota,
    },
  }
}

// ---------------------------------------------------------------------------
// Senado — benefícios e pessoal de gabinete, por código do senador
// ---------------------------------------------------------------------------

type RecursosSenado = {
  data?: {
    beneficios?: { beneficio: string; utilizacao: string }[]
    pessoal?: { local: string; quantidade: number }[]
    gastosNaoInclusos?: {
      despesas?: { recurso: string; valor: number }[]
    }
  }[]
}

export type RecursosDoSenador = {
  moradia: Moradia
  assessores: number | null
  diarias: number | null
}

const UTILIZOU = "Utilizou"

export const baixarRecursosSenado = async (
  ano: number,
  senadores: Parlamentar[],
): Promise<Map<string, RecursosDoSenador>> => {
  const respostas = await emLotes(senadores, async (senador) => {
    const resposta = await buscarJson<RecursosSenado>(
      `${ADM_SENADO}/senadores/${senador.id}/recursos-utilizados?ano=${ano}`,
    ).catch(vazioSe404(null))

    const recursos = resposta?.data?.[0]
    if (!recursos) return null

    const usa = (beneficio: string) =>
      recursos.beneficios?.some(
        (item) => item.beneficio.includes(beneficio) && item.utilizacao === UTILIZOU,
      ) ?? false

    const assessores = recursos.pessoal?.reduce(
      (total, lotacao) => total + (lotacao.quantidade || 0),
      0,
    )

    const diarias = recursos.gastosNaoInclusos?.despesas
      ?.filter((despesa) => despesa.recurso.includes("Diárias"))
      .reduce((total, despesa) => total + (despesa.valor || 0), 0)

    return [
      senador.id,
      {
        moradia: {
          // O Senado só informa se o benefício foi usado no ano, sem valores.
          tipo: tipoDeMoradia(usa("Imóvel Funcional"), usa("Auxílio-Moradia")),
          diasEmImovelFuncional: null,
          auxilioRecebido: null,
          complementoComCota: null,
        },
        assessores: assessores ?? null,
        diarias: diarias ?? null,
      },
    ] as const
  })

  const encontrados = respostas.filter((item) => item !== null)
  log(`senado: recursos de ${encontrados.length} senadores em ${ano}`)

  return new Map(encontrados)
}

// ---------------------------------------------------------------------------
// Orçamento do Senado — execução por exercício, série desde 2013
// ---------------------------------------------------------------------------

const ORCAMENTO_SENADO =
  "https://www.senado.gov.br/bi-arqs/Arquimedes/Financeiro/DespesaSenadoDadosAbertos.json"

const GRUPO_PESSOAL = "PESSOAL E ENCARGOS SOCIAIS"

type LancamentoOrcamento = {
  // A chave vem com acento do próprio Senado.
  "exercício_financeiro_lan_ef"?: number
  valor_pago?: string | number
  grupo_despesa_nome?: string
}

/**
 * O BI do Senado publica a execução orçamentária completa num JSON estático,
 * embrulhado em { despesas: [...] }. Valores vêm como string com vírgula
 * decimal ("11000,00").
 */
export const baixarOrcamentoSenado = async (): Promise<OrcamentoAno[]> => {
  const { despesas: lancamentos = [] } = await buscarJson<{
    despesas?: LancamentoOrcamento[]
  }>(ORCAMENTO_SENADO)

  const porAno = new Map<number, { pago: number; pessoal: number }>()

  for (const lancamento of lancamentos) {
    const ano = lancamento["exercício_financeiro_lan_ef"]
    if (!ano) continue

    const pago = numeroBr(String(lancamento.valor_pago ?? ""))
    const acumulado = porAno.get(ano) ?? { pago: 0, pessoal: 0 }
    acumulado.pago += pago
    if (lancamento.grupo_despesa_nome === GRUPO_PESSOAL) {
      acumulado.pessoal += pago
    }
    porAno.set(ano, acumulado)
  }

  const serie = [...porAno.entries()]
    .map(([ano, valores]) => ({ ano, ...valores }))
    .sort((a, b) => a.ano - b.ano)

  log(
    `senado: orçamento de ${serie.length} exercícios (${serie[0]?.ano}–${serie[serie.length - 1]?.ano})`,
  )

  return serie
}

export const FONTE_ORCAMENTO_SENADO = ORCAMENTO_SENADO
