import { unzipSync } from "fflate"

import { log } from "../config"
import { lerCsvComCabecalho } from "../csv"
import { buscarBinario, existeNoAr } from "../http"

/** A URL fixa redireciona para o zip da extração mais recente (~32 MB). */
const EMENDAS_URL =
  "https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares/UNICO"

const ARQUIVO_PRINCIPAL = "EmendasParlamentares.csv"

export type LinhaDeEmenda = Record<string, string>

export const baixarEmendas = async (): Promise<LinhaDeEmenda[]> => {
  log(`transparência: baixando ${EMENDAS_URL}`)

  const zip = unzipSync(await buscarBinario(EMENDAS_URL))
  const arquivo = zip[ARQUIVO_PRINCIPAL]
  if (!arquivo) {
    throw new Error(`Zip de emendas não contém ${ARQUIVO_PRINCIPAL}`)
  }

  const linhas = lerCsvComCabecalho(
    new TextDecoder("iso-8859-1").decode(arquivo),
  )
  log(`transparência: ${linhas.length} linhas de emendas`)
  return linhas
}

const CEIS_URL = "https://dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/ceis"

/** Quantos dias recuar procurando o snapshot — a CGU some com os antigos. */
const DIAS_DE_RECUO_CEIS = 10

export type LinhaDeCeis = Record<string, string>

/**
 * Só o snapshot mais recente do CEIS fica no ar; os das demais datas
 * respondem 403. Do dia corrente para trás, sonda com HEAD (barato e com
 * timeout curto — dez downloads com retry completo estourariam o budget do
 * job) até achar um que exista, e só então paga o download com retry.
 */
export const baixarCeis = async (): Promise<LinhaDeCeis[]> => {
  for (let recuo = 0; recuo < DIAS_DE_RECUO_CEIS; recuo += 1) {
    const dia = new Date()
    dia.setUTCDate(dia.getUTCDate() - recuo)
    const data = dia.toISOString().slice(0, 10).replace(/-/g, "")

    const url = `${CEIS_URL}/${data}_CEIS.zip`
    const existe = await existeNoAr(url).catch(() => false)
    if (!existe) continue

    log(`ceis: baixando ${url}`)
    const zip = unzipSync(await buscarBinario(url))
    const arquivo = Object.entries(zip).find(([nome]) => nome.endsWith(".csv"))
    if (!arquivo) {
      throw new Error(`Zip do CEIS de ${data} não contém CSV`)
    }

    const linhas = lerCsvComCabecalho(
      new TextDecoder("iso-8859-1").decode(arquivo[1]),
    )
    log(`ceis: ${linhas.length} sanções no snapshot de ${data}`)
    return linhas
  }

  throw new Error(
    `Nenhum snapshot do CEIS disponível nos últimos ${DIAS_DE_RECUO_CEIS} dias`,
  )
}
