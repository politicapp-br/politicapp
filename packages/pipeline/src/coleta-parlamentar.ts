import {
  parlamentarKey,
  type HistoricoEleitoral,
  type HistoricoMandato,
  type Parlamentar,
  type Presenca,
  type ProducaoLegislativa,
  type TerritorioEleitoral,
} from "@politicapp/data"

import { log } from "./config"
import { exigirVolume } from "./etapas"
import { emLotes, ErroPermanente, vazioSe404 } from "./http"
import {
  ArquivoSemLinhas,
  listarAutoriasEmLote,
  listarProposicoesEmLote,
  type AutoriaEmLote,
  type ProposicaoEmLote,
} from "./sources/camara-arquivos"
import {
  buscarFrequenciaDeputado,
  listarHistoricoDeputado,
  urlPerfilDeputado,
} from "./sources/camara-perfil"
import {
  listarFiliacoesSenador,
  listarLicencasSenador,
  listarMandatosSenador,
  listarProcessosDoSenador,
} from "./sources/senado-parlamentar"
import {
  listarCandidatosTse,
  somarBensTse,
  somarVotosPorMunicipio,
  type VotosPorMunicipio,
} from "./sources/tse-eleicoes"
import {
  calcularTerritorio,
  candidaturaDoMandato,
  montarHistoricoEleitoral,
  totaisDeVotos,
  type DadosDoAno,
} from "./tasks/eleitoral"
import { somarEmendasDesde, type EmendaNoMunicipio } from "./tasks/emendas"
import { historicoDaCamara, historicoDoSenado } from "./tasks/historico"
import { producaoDaCamara, producaoDoSenador } from "./tasks/producao"

/**
 * Ano de início da legislatura em curso numa data. Legislaturas começam em
 * 1º de fevereiro dos anos 2023, 2027, 2031…; em janeiro ainda vale a anterior.
 */
export const inicioDaLegislatura = (data: Date) => {
  const ano = data.getUTCMonth() === 0 ? data.getUTCFullYear() - 1 : data.getUTCFullYear()
  return ano - (((ano - 2023) % 4) + 4) % 4
}

/** As três últimas eleições gerais até o ano (2018, 2022, 2026…), mais recente primeiro. */
export const anosEleitorais = (ano: number) => {
  const ultima = ano - (((ano - 2022) % 4) + 4) % 4
  return [ultima, ultima - 4, ultima - 8]
}

/**
 * No começo do ano o arquivo do ano corrente pode ainda não existir ou vir
 * vazio — ali isso é "nada ainda", não fonte quebrada.
 */
const vazioNoAnoCorrente = <T>(erro: unknown): T[] => {
  if (erro instanceof ArquivoSemLinhas) return []
  if (erro instanceof ErroPermanente && erro.message.includes("HTTP 404")) return []
  throw erro
}

/** Fração mínima de parlamentares com dado para a etapa não ser tida como quebrada. */
const COBERTURA_MINIMA = 0.8

const exigirCobertura = (descricao: string, comDado: number, total: number) =>
  exigirVolume(descricao, comDado, Math.round(total * COBERTURA_MINIMA), 1)

export const levantarProducao = async (
  ano: number,
  legislatura: number,
  deputados: Parlamentar[],
  senadores: Parlamentar[],
): Promise<Map<string, ProducaoLegislativa>> => {
  // Um ano por vez: o servidor de arquivos da Câmara já derruba conexões
  // longas, e baixar os oito CSVs juntos só piora.
  let autorias: AutoriaEmLote[] = []
  let proposicoes: ProposicaoEmLote[] = []
  for (let cada = legislatura; cada <= ano; cada += 1) {
    const tolerar = cada === ano ? vazioNoAnoCorrente : (erro: unknown): never => { throw erro }
    autorias = autorias.concat(await listarAutoriasEmLote(cada).catch(tolerar<AutoriaEmLote>))
    proposicoes = proposicoes.concat(
      await listarProposicoesEmLote(cada).catch(tolerar<ProposicaoEmLote>),
    )
  }

  const producao = producaoDaCamara(
    legislatura,
    autorias,
    proposicoes,
    new Set(deputados.map((deputado) => deputado.id)),
  )
  // Logo depois da posse quase ninguém apresentou nada ainda.
  if (ano > legislatura) {
    exigirCobertura("câmara: deputados com proposições", producao.size, deputados.length)
  }

  const doSenado = await emLotes(senadores, async (senador) => {
    const processos = await listarProcessosDoSenador(senador.id).catch(vazioSe404([]))
    return [
      parlamentarKey(senador),
      producaoDoSenador(legislatura, senador.nome, processos),
    ] as const
  })
  for (const [chave, valor] of doSenado) producao.set(chave, valor)

  log(`produção: ${producao.size} parlamentares com proposições desde ${legislatura}`)
  return producao
}

/**
 * A frequência só existe no HTML do portal. Se a maioria das páginas vier
 * sem o bloco, o layout mudou — melhor falhar do que publicar "sem dado"
 * para todo mundo.
 */
export const levantarPresenca = async (
  ano: number,
  deputados: Parlamentar[],
  /** Em janeiro ainda não houve sessão no ano: página sem o bloco é normal. */
  exigir = true,
): Promise<Map<string, Presenca>> => {
  const lidas = await emLotes(deputados, async (deputado) => {
    const frequencia = await buscarFrequenciaDeputado(deputado.id, ano).catch(
      vazioSe404({ plenario: null, comissoes: null }),
    )
    return [parlamentarKey(deputado), frequencia] as const
  })

  const presenca = new Map<string, Presenca>()
  for (const [chave, { plenario, comissoes }] of lidas) {
    if (!plenario && !comissoes) continue
    const id = chave.split(":")[1] ?? ""
    presenca.set(chave, { ano, plenario, comissoes, fonteUrl: urlPerfilDeputado(id, ano) })
  }
  if (exigir) exigirCobertura("câmara: perfis com frequência", presenca.size, deputados.length)
  return presenca
}

export const levantarHistorico = async (
  deputados: Parlamentar[],
  senadores: Parlamentar[],
  hoje: string,
): Promise<Map<string, HistoricoMandato>> => {
  const daCamara = await emLotes(deputados, async (deputado) => {
    const registros = await listarHistoricoDeputado(deputado.id).catch(vazioSe404([]))
    return [parlamentarKey(deputado), historicoDaCamara(registros)] as const
  })

  const doSenado = await emLotes(senadores, async (senador) => {
    const [filiacoes, licencas, mandatos] = await Promise.all([
      listarFiliacoesSenador(senador.id).catch(vazioSe404([])),
      listarLicencasSenador(senador.id).catch(vazioSe404([])),
      listarMandatosSenador(senador.id).catch(vazioSe404([])),
    ])
    return [
      parlamentarKey(senador),
      historicoDoSenado({ filiacoes, licencas, mandatos, hoje }),
    ] as const
  })

  const historico = new Map([...daCamara, ...doSenado])
  const comFiliacao = [...historico.values()].filter((item) => item.filiacoes.length > 0).length
  exigirCobertura("histórico: parlamentares com filiação", comFiliacao, historico.size)
  return historico
}


export type Eleicoes = {
  eleicoes: Map<string, HistoricoEleitoral>
  /** Nulo quando as emendas por município não estão disponíveis hoje. */
  territorio: Map<string, TerritorioEleitoral | null> | null
}

/**
 * Histórico eleitoral nas três últimas eleições gerais (a mais recente, a que
 * elegeu a Câmara e um terço do Senado, e a dos outros dois terços) e o
 * território da eleição que deu o mandato em curso — a do ano anterior à
 * posse da legislatura.
 */
export const levantarEleicoes = async ({
  parlamentares,
  cpfs,
  ano,
  legislatura,
  emendasPorMunicipio,
}: {
  parlamentares: Parlamentar[]
  ano: number
  legislatura: number
  /** Id do deputado → CPF, da cota. Só chave de vínculo, nunca publicado. */
  cpfs: Map<string, string>
  emendasPorMunicipio: Map<string, EmendaNoMunicipio[]> | null
}): Promise<Eleicoes> => {
  const anos: DadosDoAno[] = []
  for (const eleicao of anosEleitorais(ano)) {
    anos.push({
      ano: eleicao,
      candidatos: await listarCandidatosTse(eleicao),
      bens: await somarBensTse(eleicao),
      votos: null,
    })
  }

  // Primeiro vínculo só para saber quais candidaturas ler no arquivo de votos.
  const preliminar = montarHistoricoEleitoral(parlamentares, cpfs, anos)
  const votosPorAno = new Map<number, VotosPorMunicipio>()
  for (const dados of anos) {
    const candidaturas = new Set<string>()
    for (const vinculo of preliminar.values()) {
      for (const linha of vinculo.porAno.get(dados.ano) ?? []) candidaturas.add(linha.sq)
    }
    const votos = await somarVotosPorMunicipio(dados.ano, candidaturas)
    votosPorAno.set(dados.ano, votos)
    dados.votos = totaisDeVotos(votos)
  }

  const vinculos = montarHistoricoEleitoral(parlamentares, cpfs, anos)
  const eleicoes = new Map(
    [...vinculos].map(([chave, vinculo]) => [chave, vinculo.historico] as const),
  )
  const vinculados = [...eleicoes.values()].filter((historico) => historico.length > 0).length
  log(`tse: ${vinculados} de ${parlamentares.length} parlamentares com candidatura vinculada`)
  exigirCobertura("tse: parlamentares vinculados", vinculados, parlamentares.length)

  if (!emendasPorMunicipio) return { eleicoes, territorio: null }

  const territorio = new Map<string, TerritorioEleitoral | null>()
  for (const parlamentar of parlamentares) {
    const chave = parlamentarKey(parlamentar)
    const vinculo = vinculos.get(chave)
    const candidatura = vinculo && candidaturaDoMandato(parlamentar, vinculo, legislatura - 1)
    if (!candidatura) continue
    territorio.set(
      chave,
      calcularTerritorio(
        candidatura,
        votosPorAno.get(candidatura.ano)?.get(candidatura.sq) ?? new Map(),
        // Só as emendas do mandato que essa eleição deu, que começa no ano seguinte.
        somarEmendasDesde(emendasPorMunicipio.get(chave) ?? [], candidatura.ano + 1),
      ),
    )
  }
  return { eleicoes, territorio }
}
