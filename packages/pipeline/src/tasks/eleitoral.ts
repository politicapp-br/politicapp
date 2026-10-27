import {
  parlamentarKey,
  type CandidaturaTse,
  type MunicipioDeVoto,
  type Parlamentar,
  type ResultadoEleitoral,
  type TerritorioEleitoral,
} from "@politicapp/data"

import { chaveDeNome } from "../sources/senado"
import { CARGOS_TSE, type CandidatoTse, type VotosPorMunicipio } from "../sources/tse-eleicoes"
import { chaveDeMunicipio } from "./emendas"

export const MUNICIPIOS_PRINCIPAIS = 10
const FRACAO_DOS_REDUTOS = 0.5

const CARGO_DEPUTADO_FEDERAL = 6
const CARGO_SENADOR = 5
/** Suplentes de senador: votados na chapa do titular, não têm voto próprio. */
const CARGOS_SEM_VOTO = new Set([9, 10])

const dinheiro = (valor: number) => Math.round(valor * 100) / 100
const fracao = (valor: number) => Math.round(valor * 1000) / 1000

export const resultadoDoTse = (situacao: string | null): ResultadoEleitoral => {
  const texto = chaveDeNome(situacao ?? "")
  if (texto.startsWith("ELEITO")) return "eleito"
  if (texto === "SUPLENTE") return "suplente"
  if (texto.startsWith("NAO ELEITO")) return "nao-eleito"
  // "2º TURNO" — a chave de nome descarta dígitos e o "º".
  if (texto.includes("TURNO")) return "segundo-turno"
  return "pendente"
}

export type DadosDoAno = {
  ano: number
  candidatos: CandidatoTse[]
  bens: Map<string, number> | null
  /** Votos totais por candidatura; nulo quando o arquivo de votos não foi lido. */
  votos: Map<string, number> | null
}

type Indice = {
  porCpf: Map<string, string[]>
  porNome: Map<string, string[]>
  porUrna: Map<string, string[]>
  linhas: Map<string, CandidatoTse[]>
}

const adicionar = (mapa: Map<string, string[]>, chave: string, sq: string) => {
  if (!chave) return
  const lista = mapa.get(chave) ?? []
  if (!lista.includes(sq)) lista.push(sq)
  mapa.set(chave, lista)
}

const indexar = (candidatos: CandidatoTse[]): Indice => {
  const indice: Indice = {
    porCpf: new Map(),
    porNome: new Map(),
    porUrna: new Map(),
    linhas: new Map(),
  }
  for (const candidato of candidatos) {
    const linhas = indice.linhas.get(candidato.sq) ?? []
    linhas.push(candidato)
    indice.linhas.set(candidato.sq, linhas)
    if (candidato.cpf) adicionar(indice.porCpf, candidato.cpf, candidato.sq)
    adicionar(indice.porNome, `${candidato.uf}|${chaveDeNome(candidato.nome)}`, candidato.sq)
    adicionar(indice.porUrna, `${candidato.uf}|${chaveDeNome(candidato.nomeUrna)}`, candidato.sq)
  }
  return indice
}

/**
 * Candidaturas da pessoa num ano. CPF é a identidade quando conhecido: se o
 * ano tem CPFs e o dele não aparece, ele não disputou — cair para o nome
 * acharia um homônimo. Sem CPF (Senado), nome civil + UF e por fim nome de
 * urna + UF. Resultado ambíguo (duas candidaturas para o mesmo nome) não é
 * atribuído.
 */
const vincular = (
  indice: Indice,
  parlamentar: Parlamentar,
  cpf: string | null,
): string[] => {
  if (cpf && indice.porCpf.size > 0) return indice.porCpf.get(cpf) ?? []
  const porNome = parlamentar.nomeCivil
    ? indice.porNome.get(`${parlamentar.uf}|${chaveDeNome(parlamentar.nomeCivil)}`)
    : undefined
  if (porNome?.length === 1) return porNome
  // Candidatura a presidente é registrada com UF "BR".
  const paraPresidente = parlamentar.nomeCivil
    ? indice.porNome.get(`BR|${chaveDeNome(parlamentar.nomeCivil)}`)
    : undefined
  if (paraPresidente?.length === 1) return paraPresidente
  const porUrna = indice.porUrna.get(`${parlamentar.uf}|${chaveDeNome(parlamentar.nome)}`)
  if (porUrna?.length === 1) return porUrna
  return []
}

/** Uma candidatura por SQ; com 2º turno, vale o resultado do último turno. */
const candidaturaDe = (dados: DadosDoAno, linhas: CandidatoTse[]): CandidaturaTse | null => {
  const ordenadas = [...linhas].sort((a, b) => a.turno - b.turno)
  const primeira = ordenadas[0]
  const ultima = ordenadas[ordenadas.length - 1]
  if (!primeira || !ultima) return null
  const resultadoFinal = resultadoDoTse(ultima.situacaoTurno)
  // Turno 2 ainda sem apuração: o que se sabe é que foi ao 2º turno.
  const resultado =
    ultima.turno > 1 && resultadoFinal === "pendente" ? "segundo-turno" : resultadoFinal
  const patrimonio = dados.bens?.get(primeira.sq)
  return {
    ano: dados.ano,
    cargo: CARGOS_TSE.get(primeira.cargo) ?? String(primeira.cargo),
    uf: primeira.municipio ? `${primeira.municipio} (${primeira.uf})` : primeira.uf,
    partido: primeira.partido,
    numero: primeira.numero,
    resultado,
    votos: dados.votos && !CARGOS_SEM_VOTO.has(primeira.cargo) ? (dados.votos.get(primeira.sq) ?? 0) : null,
    patrimonio: patrimonio === undefined ? null : dinheiro(patrimonio),
  }
}

export type VinculoTse = {
  /** Candidaturas por ano, para o cálculo de território. */
  porAno: Map<number, CandidatoTse[]>
  historico: CandidaturaTse[]
}

/**
 * Histórico eleitoral de cada parlamentar nos anos dados. `cpfs` vem da
 * Câmara (id → CPF só com dígitos); o CPF serve só de chave e não é publicado.
 */
export const montarHistoricoEleitoral = (
  parlamentares: Parlamentar[],
  cpfs: Map<string, string>,
  anos: DadosDoAno[],
): Map<string, VinculoTse> => {
  const indices = anos.map((dados) => ({ dados, indice: indexar(dados.candidatos) }))
  const resultado = new Map<string, VinculoTse>()

  for (const parlamentar of parlamentares) {
    const cpf = parlamentar.casa === "camara" ? (cpfs.get(parlamentar.id) ?? null) : null
    const porAno = new Map<number, CandidatoTse[]>()
    const historico: CandidaturaTse[] = []

    for (const { dados, indice } of indices) {
      const sqs = vincular(indice, parlamentar, cpf)
      for (const sq of sqs) {
        const linhas = indice.linhas.get(sq) ?? []
        const candidatura = candidaturaDe(dados, linhas)
        if (!candidatura) continue
        historico.push(candidatura)
        porAno.set(dados.ano, [...(porAno.get(dados.ano) ?? []), ...linhas])
      }
    }

    historico.sort((a, b) => b.ano - a.ano || a.cargo.localeCompare(b.cargo))
    resultado.set(parlamentarKey(parlamentar), { porAno, historico })
  }

  return resultado
}

/**
 * A eleição que deu o mandato atual: para deputado, a de deputado federal
 * mais recente até 2022; para senador, a de senador em que foi eleito. Sem
 * votos próprios (suplente de senador) não há território.
 */
export const candidaturaDoMandato = (
  parlamentar: Parlamentar,
  vinculo: VinculoTse,
  anoDoMandato: number,
): CandidatoTse | null => {
  const cargo = parlamentar.casa === "camara" ? CARGO_DEPUTADO_FEDERAL : CARGO_SENADOR
  const anos = [...vinculo.porAno.keys()].filter((ano) => ano <= anoDoMandato).sort((a, b) => b - a)
  for (const ano of anos) {
    const doCargo = (vinculo.porAno.get(ano) ?? []).filter(
      (linha) => linha.cargo === cargo && linha.turno === 1,
    )
    const escolhida =
      parlamentar.casa === "senado"
        ? doCargo.find((linha) => resultadoDoTse(linha.situacaoTurno) === "eleito")
        : doCargo[0]
    if (escolhida) return escolhida
  }
  return null
}

/**
 * Onde o parlamentar foi votado e quanto das emendas dele foi para lá.
 * `votos` é o mapa "UF|MUNICÍPIO" → votos da candidatura; `emendas`, o mapa
 * "UF|MUNICÍPIO normalizado" → empenhado (`emendasPorMunicipio`).
 */
export const calcularTerritorio = (
  candidatura: CandidatoTse,
  votos: Map<string, number>,
  emendas: Map<string, number>,
): TerritorioEleitoral | null => {
  const municipios = [...votos]
    .map(([chave, quantidade]) => {
      const [uf = "", municipio = ""] = chave.split("|")
      return { uf, municipio, votos: quantidade, chave: chaveDeMunicipio(uf, municipio) }
    })
    .filter(({ votos: quantidade }) => quantidade > 0)
    .sort((a, b) => b.votos - a.votos || a.chave.localeCompare(b.chave))

  const totalVotos = municipios.reduce((soma, { votos: quantidade }) => soma + quantidade, 0)
  if (totalVotos === 0) return null

  const emendasComMunicipio = [...emendas.values()].reduce((soma, valor) => soma + valor, 0)

  const redutos: typeof municipios = []
  let acumulado = 0
  for (const municipio of municipios) {
    if (acumulado / totalVotos >= FRACAO_DOS_REDUTOS) break
    redutos.push(municipio)
    acumulado += municipio.votos
  }
  const emendasNosRedutos = redutos.reduce(
    (soma, { chave }) => soma + (emendas.get(chave) ?? 0),
    0,
  )

  const principais: MunicipioDeVoto[] = municipios
    .slice(0, MUNICIPIOS_PRINCIPAIS)
    .map(({ uf, municipio, votos: quantidade, chave }) => ({
      municipio,
      uf,
      votos: quantidade,
      fracao: fracao(quantidade / totalVotos),
      emendas: dinheiro(emendas.get(chave) ?? 0),
    }))

  return {
    eleicao: candidatura.ano,
    cargo: CARGOS_TSE.get(candidatura.cargo) ?? String(candidatura.cargo),
    totalVotos,
    municipiosComVoto: municipios.length,
    principais,
    redutos: {
      municipios: redutos.length,
      fracaoDosVotos: fracao(acumulado / totalVotos),
      emendas: dinheiro(emendasNosRedutos),
      fracaoDasEmendas:
        emendasComMunicipio > 0 ? fracao(emendasNosRedutos / emendasComMunicipio) : null,
    },
    emendasComMunicipio: dinheiro(emendasComMunicipio),
  }
}

/** Soma o mapa de votos por município em total por candidatura. */
export const totaisDeVotos = (votos: VotosPorMunicipio): Map<string, number> =>
  new Map(
    [...votos].map(([sq, porMunicipio]) => [
      sq,
      [...porMunicipio.values()].reduce((soma, quantidade) => soma + quantidade, 0),
    ]),
  )
