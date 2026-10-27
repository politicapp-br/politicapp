import type { Afastamento, Filiacao, HistoricoMandato, Suplente } from "@politicapp/data"

import type { HistoricoCamaraApi } from "../sources/camara-perfil"
import {
  comoLista,
  type FiliacaoSenadoApi,
  type LicencaSenadoApi,
  type MandatoSenadoApi,
} from "../sources/senado-parlamentar"

/** Filiações antes disso só incham o arquivo; a 55ª legislatura começou em 2015. */
const FILIACOES_DESDE = "2015-01-01"
const LEGISLATURA_ATUAL = 57
const INICIO_LEGISLATURA_ATUAL = "2023-02-01"
export const AFASTAMENTOS_MAXIMOS = 30

const dia = (valor: string | null | undefined) => valor?.trim().slice(0, 10) || null

const maisRecentePrimeiro = <T extends { inicio: string | null }>(a: T, b: T) =>
  (b.inicio ?? "").localeCompare(a.inicio ?? "")

/** "Saída - Afastamento sem prazo determinado - Secretário de Estado" → "Secretário de Estado". */
const motivoDaSaida = ({ situacao, descricaoStatus }: HistoricoCamaraApi) => {
  if (situacao === "SUPLENCIA") return "Titular reassumiu a vaga"
  const partes = (descricaoStatus ?? "").split(" - ").map((parte) => parte.trim())
  return partes[partes.length - 1] || situacao || "Afastamento"
}

const ehSaida = ({ descricaoStatus, situacao }: HistoricoCamaraApi) =>
  situacao !== "FIM_MANDATO" && /^Saída\b/.test(descricaoStatus ?? "")

/**
 * O histórico da Câmara é uma sequência de mudanças de status. Afastamento
 * é toda "Saída" (licença, cargo no Executivo, volta do titular) até a
 * próxima entrada em exercício. Filiação muda quando a sigla muda entre
 * registros consecutivos.
 */
export const historicoDaCamara = (registros: HistoricoCamaraApi[]): HistoricoMandato => {
  const ordenados = registros
    .filter((registro) => registro.dataHora)
    .sort((a, b) => (a.dataHora ?? "").localeCompare(b.dataHora ?? ""))

  const filiacoes: Filiacao[] = []
  for (const registro of ordenados) {
    const partido = registro.siglaPartido?.trim()
    const data = dia(registro.dataHora)
    if (!partido || !data) continue
    const atual = filiacoes[filiacoes.length - 1]
    if (atual?.partido === partido) continue
    if (atual) atual.fim = data
    filiacoes.push({ partido, inicio: data, fim: null })
  }

  const afastamentos: Afastamento[] = []
  let aberto: Afastamento | null = null
  for (const registro of ordenados) {
    if (registro.idLegislatura !== LEGISLATURA_ATUAL) continue
    const data = dia(registro.dataHora)
    if (!data) continue
    if (ehSaida(registro)) {
      if (!aberto) {
        aberto = { inicio: data, fim: null, motivo: motivoDaSaida(registro) }
        afastamentos.push(aberto)
      }
    } else if (registro.situacao === "Exercício" && aberto) {
      aberto.fim = data
      aberto = null
    }
  }

  return {
    filiacoes: filiacoes
      .filter(({ fim }) => fim === null || fim >= FILIACOES_DESDE)
      .sort(maisRecentePrimeiro),
    afastamentos: afastamentos.sort(maisRecentePrimeiro).slice(0, AFASTAMENTOS_MAXIMOS),
    suplentes: [],
  }
}

/** Mandato vigente: o que ainda não terminou; sem data, o último da lista. */
const mandatoVigente = (mandatos: MandatoSenadoApi[], hoje: string) =>
  mandatos.find(
    (mandato) => (dia(mandato.SegundaLegislaturaDoMandato?.DataFim) ?? "") >= hoje,
  ) ?? mandatos[0]

export const historicoDoSenado = ({
  filiacoes,
  licencas,
  mandatos,
  hoje,
}: {
  filiacoes: FiliacaoSenadoApi[]
  licencas: LicencaSenadoApi[]
  mandatos: MandatoSenadoApi[]
  /** AAAA-MM-DD, injetado para o teste não depender do relógio. */
  hoje: string
}): HistoricoMandato => {
  const suplentes: Suplente[] = comoLista(mandatoVigente(mandatos, hoje)?.Suplentes?.Suplente)
    .filter((suplente) => suplente.NomeParlamentar)
    .map((suplente) => ({
      ordem: suplente.DescricaoParticipacao?.trim() || "Suplente",
      nome: suplente.NomeParlamentar?.trim() ?? "",
      id: suplente.CodigoParlamentar?.trim() || null,
    }))

  return {
    filiacoes: filiacoes
      .flatMap((filiacao): Filiacao[] => {
        const partido = filiacao.Partido?.SiglaPartido?.trim()
        if (!partido) return []
        return [{ partido, inicio: dia(filiacao.DataFiliacao), fim: dia(filiacao.DataDesfiliacao) }]
      })
      .filter(({ fim }) => fim === null || fim >= FILIACOES_DESDE)
      .sort(maisRecentePrimeiro),
    afastamentos: licencas
      .flatMap((licenca): Afastamento[] => {
        const inicio = dia(licenca.DataInicio)
        if (!inicio || inicio < INICIO_LEGISLATURA_ATUAL) return []
        return [
          {
            inicio,
            fim: dia(licenca.DataFim),
            motivo: licenca.DescricaoTipoAfastamento?.trim() || "Licença",
          },
        ]
      })
      .sort(maisRecentePrimeiro)
      .slice(0, AFASTAMENTOS_MAXIMOS),
    suplentes,
  }
}
