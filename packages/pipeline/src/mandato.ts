import {
  parlamentarKey,
  type CustoAnual,
  type CustoParlamentar,
  type MandatoEstatico,
  type Parlamentar,
  type ResumoDespesas,
} from "@politicapp/data"

import { log } from "./config"
import { tolerar, vazioSe404, ErroPermanente } from "./http"
import { baixarDespesasCamara } from "./sources/camara"
import {
  baixarMoradiaCamara,
  baixarRecursosSenado,
  baixarSalariosDoAno,
  SemFolhaPublicada,
} from "./sources/remuneracao"
import { baixarDespesasSenado, listarPossesSenado } from "./sources/senado"
import { resumirDespesas } from "./tasks/despesas"
import {
  anoDaPosse,
  legislaturaEmCurso,
  montarMandato,
  type FontesDoAno,
  type ParlamentarComPosse,
} from "./tasks/mandato"

/** Hoje, para o ano corrente; o último dia do ano, para um ano passado. */
const dataDeReferencia = (ano: number) => {
  const hoje = new Date().toISOString().slice(0, 10)
  return hoje.startsWith(String(ano)) ? hoje : `${ano}-12-31`
}

/**
 * Custo acumulado do mandato, ano a ano. Só o ano corrente muda; anos
 * fechados são apurados uma vez e depois reaproveitados da execução anterior
 * (`interno/mandato.json`) — a primeira execução é pesada (baixa cota, folha
 * e diárias de cada ano desde a posse mais antiga), as seguintes só refazem
 * o ano atual.
 */
export const levantarMandato = async (
  ano: number,
  deputados: Parlamentar[],
  senadores: Parlamentar[],
  resumos: ResumoDespesas[],
  custos: CustoParlamentar[],
  publicado: MandatoEstatico | null,
): Promise<Omit<MandatoEstatico, "geradoEm">> => {
  // Sem as posses o primeiro ano recuaria e anos fechados sumiriam do cache:
  // melhor a etapa falhar e o mandato de ontem continuar publicado.
  const posses = await listarPossesSenado()

  const posseCamara = legislaturaEmCurso(dataDeReferencia(ano))
  const parlamentares: ParlamentarComPosse[] = [
    ...deputados.map(({ id }) => ({
      casa: "camara" as const,
      id,
      inicioExercicio: posseCamara,
    })),
    ...senadores.map(({ id }) => ({
      casa: "senado" as const,
      id,
      // Sem a posse real, o início da legislatura é o recuo conservador:
      // nunca atribui anos que o senador pode não ter cumprido.
      inicioExercicio: posses.get(id) ?? posseCamara,
    })),
  ]

  const primeiroAno = Math.min(
    ...parlamentares.map(({ inicioExercicio }) => anoDaPosse(inicioExercicio)),
  )

  const anosFechados: number[] = []
  for (let alvo = primeiroAno; alvo < ano; alvo += 1) anosFechados.push(alvo)

  const reutilizaveis = new Set(
    (publicado?.anosApurados ?? []).filter(
      (apurado) => apurado >= primeiroAno && apurado < ano,
    ),
  )
  const paraApurar = anosFechados.filter((alvo) => !reutilizaveis.has(alvo))

  log(
    `mandato: anos ${primeiroAno}–${ano}, ${reutilizaveis.size} reaproveitados da execução anterior, ${paraApurar.length} a apurar`,
  )

  const fontesPorAno: FontesDoAno[] = []
  const apurados: number[] = [...reutilizaveis]

  // Sequencial de propósito: cada ano fechado baixa arquivos grandes (zip de
  // cota, folhas mensais) e não vale a pena empilhá-los na memória.
  for (const alvo of paraApurar) {
    const { fontes, completo } = await apurarAnoFechado(
      alvo,
      ano,
      deputados,
      senadores,
      posses,
    )
    fontesPorAno.push(fontes)
    if (completo) apurados.push(alvo)
  }

  // Começo de ano sem folha consolidada ainda é normal: o ano corrente fica
  // sem salário até a primeira sair. Qualquer outra falha derruba a etapa.
  const salariosDoAno = await baixarSalariosDoAno(ano).catch((erro: unknown) => {
    if (erro instanceof SemFolhaPublicada) {
      log(`mandato: ${erro.message}, ano corrente sem salário por enquanto`)
      return []
    }
    return vazioSe404([])(erro)
  })
  fontesPorAno.push(fontesDoAnoCorrente(ano, resumos, custos, salariosDoAno))

  const cacheados = new Map<string, CustoAnual[]>()
  for (const parlamentar of publicado?.parlamentares ?? []) {
    cacheados.set(
      parlamentarKey(parlamentar),
      parlamentar.anos.filter((custo) => reutilizaveis.has(custo.ano)),
    )
  }

  return {
    ano,
    anosApurados: apurados.sort((a, b) => a - b),
    parlamentares: montarMandato(parlamentares, fontesPorAno, cacheados),
  }
}

/**
 * Um ano fechado é dado por apurado quando salário e cotas — o grosso do
 * dinheiro — vieram. Moradia e diárias são melhor esforço: a Câmara já tirou
 * do ar a moradia de 2023, e insistir nela todo dia refaria o ano inteiro
 * para sempre.
 */
const apurarAnoFechado = async (
  alvo: number,
  anoCorrente: number,
  deputados: Parlamentar[],
  senadores: Parlamentar[],
  posses: Map<string, string>,
): Promise<{ fontes: FontesDoAno; completo: boolean }> => {
  const precisaCamara =
    deputados.length > 0 && alvo >= anoDaPosse(legislaturaEmCurso(dataDeReferencia(anoCorrente)))
  // Mesmo recuo do montarMandato para quem está sem posse conhecida — as
  // fontes buscadas têm de cobrir exatamente os anos que entram na conta.
  const senadoresNoAno = senadores.filter(
    ({ id }) =>
      anoDaPosse(posses.get(id) ?? legislaturaEmCurso(dataDeReferencia(anoCorrente))) <= alvo,
  )

  // A Câmara nunca publicou a folha consolidada de alguns anos (2015, 2022).
  // Um 404 é definitivo: o ano fica sem salário — com a lacuna dita no app —
  // mas ainda pode ser dado por apurado, senão seria rebaixado todo dia à toa.
  let salarios: Awaited<ReturnType<typeof baixarSalariosDoAno>> | null = null
  let salariosDefinitivos = false
  try {
    salarios = await baixarSalariosDoAno(alvo)
    salariosDefinitivos = true
  } catch (erro) {
    log(`câmara: folhas de ${alvo} falharam, seguindo sem salário — ${String(erro)}`)
    salariosDefinitivos = erro instanceof ErroPermanente
  }

  const cotas = new Map<string, number>()
  let cotasCompletas = true

  const somarCotas = (resumos: ResumoDespesas[]) => {
    for (const resumo of resumos) cotas.set(parlamentarKey(resumo), resumo.total)
  }

  if (precisaCamara) {
    const lancamentos = await tolerar(
      `câmara: cotas de ${alvo}`,
      baixarDespesasCamara(alvo),
      null,
    )
    if (lancamentos) somarCotas(resumirDespesas("camara", alvo, lancamentos))
    else cotasCompletas = false
  }

  if (senadoresNoAno.length > 0) {
    const lancamentos = await tolerar(
      `senado: ceaps de ${alvo}`,
      baixarDespesasSenado(alvo, senadoresNoAno),
      null,
    )
    if (lancamentos) somarCotas(resumirDespesas("senado", alvo, lancamentos))
    else cotasCompletas = false
  }

  const moradias = new Map<string, number>()
  if (precisaCamara) {
    const porDeputado = await tolerar(
      `câmara: moradia de ${alvo}`,
      baixarMoradiaCamara(alvo, deputados),
      new Map(),
    )
    for (const [id, moradia] of porDeputado) {
      if (moradia.auxilioRecebido) {
        moradias.set(parlamentarKey({ casa: "camara", id }), moradia.auxilioRecebido)
      }
    }
  }

  const diarias = new Map<string, number>()
  if (senadoresNoAno.length > 0) {
    const recursos = await tolerar(
      `senado: recursos de ${alvo}`,
      baixarRecursosSenado(alvo, senadoresNoAno),
      new Map(),
    )
    for (const [id, recurso] of recursos) {
      if (recurso.diarias) {
        diarias.set(parlamentarKey({ casa: "senado", id }), recurso.diarias)
      }
    }
  }

  return {
    fontes: { ano: alvo, salarios: salarios ?? [], cotas, moradias, diarias },
    completo: salariosDefinitivos && cotasCompletas,
  }
}

/** O ano corrente reaproveita o que o pipeline já baixou nesta execução. */
const fontesDoAnoCorrente = (
  ano: number,
  resumos: ResumoDespesas[],
  custos: CustoParlamentar[],
  salarios: FontesDoAno["salarios"],
): FontesDoAno => {
  const cotas = new Map<string, number>()
  for (const resumo of resumos) cotas.set(parlamentarKey(resumo), resumo.total)

  const moradias = new Map<string, number>()
  const diarias = new Map<string, number>()
  for (const custo of custos) {
    const auxilio = custo.moradia?.auxilioRecebido
    if (custo.casa === "camara" && auxilio) {
      moradias.set(parlamentarKey(custo), auxilio)
    }
    if (custo.casa === "senado" && custo.diarias) {
      diarias.set(parlamentarKey(custo), custo.diarias)
    }
  }

  return { ano, salarios, cotas, moradias, diarias }
}
