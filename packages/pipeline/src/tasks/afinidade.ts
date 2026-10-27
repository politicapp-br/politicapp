import {
  agruparVotosPor,
  descricaoSemPlacar,
  parlamentarKey,
  type Afinidade,
  type Casa,
  type LadoMajoritario,
  type ParlamentarParecido,
  type Voto,
  type VotoApertado,
  type VotoContraPartido,
} from "@politicapp/data"

/** Votação nominal de plenário já normalizada, de qualquer das casas. */
export type VotacaoNominal = {
  id: string
  /** AAAA-MM-DD. */
  data: string
  descricao: string
  proposicao: string | null
  aprovada: boolean | null
  votos: Voto[]
  /** Lado orientado pela liderança do governo; só a Câmara publica. */
  governo: LadoMajoritario | null
}

export const PARECIDOS_POR_PARLAMENTAR = 5
export const RECENTES_POR_LISTA = 10

/**
 * Concordância com poucas votações em comum é ruído (suplente que votou duas
 * vezes "concorda 100%" com metade da casa). O par só entra no ranking com
 * pelo menos este piso de votações em comum (ou metade das votações da casa,
 * se forem poucas) e 30% das votações do parlamentar.
 */
export const MINIMO_EM_COMUM = 20
const FRACAO_MINIMA_EM_COMUM = 0.3

/** Margem de até 5% dos votos sim/não (mínimo 2) conta como votação apertada. */
const FRACAO_APERTADA = 0.05
const MARGEM_APERTADA_MINIMA = 2

/** Sigla que o feed usa quando a fonte não informa partido — não é bancada. */
const SEM_PARTIDO = "—"

const DESCRICAO_MAXIMA = 220

const arredondar = (valor: number) => Math.round(valor * 1000) / 1000

const ladoDoVoto = (voto: Voto): LadoMajoritario | null =>
  voto.voto === "sim" || voto.voto === "nao" ? voto.voto : null

const resumirDescricao = (descricao: string) => {
  const limpa = descricaoSemPlacar(descricao).replace(/\s+/g, " ").trim()
  return limpa.length > DESCRICAO_MAXIMA
    ? `${limpa.slice(0, DESCRICAO_MAXIMA - 1).trimEnd()}…`
    : limpa
}

export const margemApertada = (sim: number, nao: number) =>
  sim + nao > 0 &&
  Math.abs(sim - nao) <=
  Math.max(MARGEM_APERTADA_MINIMA, Math.floor((sim + nao) * FRACAO_APERTADA))

type Identidade = { nome: string; partido: string; uf: string }

type Acumulador = {
  votacoes: number
  governoVotacoes: number
  comGoverno: number
  contraPartido: VotoContraPartido[]
  apertadas: VotoApertado[]
}

/**
 * Afinidade de cada parlamentar da casa nas votações nominais do ano. A
 * chave do mapa é `parlamentarKey` ("casa:id"); quem não deu nenhum voto
 * sim/não fica de fora.
 */
export const calcularAfinidade = (
  casa: Casa,
  ano: number,
  votacoes: VotacaoNominal[],
): Map<string, Afinidade> => {
  const ordenadas = [...votacoes]
    .filter((votacao) => votacao.votos.length > 0)
    .sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id))

  const indices = new Map<string, number>()
  const identidades: Identidade[] = []
  const ids: string[] = []
  for (const votacao of ordenadas) {
    for (const voto of votacao.votos) {
      if (voto.casa !== casa) continue
      let indice = indices.get(voto.id)
      if (indice === undefined) {
        indice = ids.length
        indices.set(voto.id, indice)
        ids.push(voto.id)
        identidades.push({ nome: voto.nome, partido: voto.partido, uf: voto.uf })
      } else {
        // Votações em ordem cronológica: fica a identidade mais recente,
        // que reflete troca de partido no meio do ano.
        identidades[indice] = { nome: voto.nome, partido: voto.partido, uf: voto.uf }
      }
    }
  }

  const total = ids.length
  const emComum = new Uint16Array(total * total)
  const iguais = new Uint16Array(total * total)
  const acumuladores: Acumulador[] = ids.map(() => ({
    votacoes: 0,
    governoVotacoes: 0,
    comGoverno: 0,
    contraPartido: [],
    apertadas: [],
  }))

  for (const votacao of ordenadas) {
    const lados: { indice: number; lado: LadoMajoritario }[] = []
    let sim = 0
    let nao = 0
    for (const voto of votacao.votos) {
      const indice = indices.get(voto.id)
      const lado = ladoDoVoto(voto)
      if (indice === undefined || voto.casa !== casa || !lado) continue
      lados.push({ indice, lado })
      if (lado === "sim") sim += 1
      else nao += 1
    }

    const maioriaPorPartido = new Map(
      agruparVotosPor(votacao.votos, "partido")
        .filter((grupo) => grupo.grupo !== SEM_PARTIDO && grupo.maioria)
        .map((grupo) => [grupo.grupo, grupo.maioria as LadoMajoritario]),
    )

    const descricao = resumirDescricao(votacao.descricao)
    const apertada = margemApertada(sim, nao)
    const ladoPorIndice = new Map(lados.map(({ indice, lado }) => [indice, lado]))

    for (const voto of votacao.votos) {
      const indice = indices.get(voto.id)
      if (indice === undefined || voto.casa !== casa) continue
      const acumulador = acumuladores[indice]
      if (!acumulador) continue
      const lado = ladoPorIndice.get(indice) ?? null

      if (apertada) {
        acumulador.apertadas.push({
          votacaoId: votacao.id,
          data: votacao.data,
          descricao,
          proposicao: votacao.proposicao,
          margem: Math.abs(sim - nao),
          aprovada: votacao.aprovada,
          voto: lado,
        })
      }

      if (!lado) continue
      acumulador.votacoes += 1

      if (votacao.governo) {
        acumulador.governoVotacoes += 1
        if (lado === votacao.governo) acumulador.comGoverno += 1
      }

      const doPartido = maioriaPorPartido.get(voto.partido)
      if (doPartido && doPartido !== lado) {
        acumulador.contraPartido.push({
          votacaoId: votacao.id,
          data: votacao.data,
          descricao,
          proposicao: votacao.proposicao,
          voto: lado,
          partido: doPartido,
        })
      }
    }

    for (let a = 0; a < lados.length; a += 1) {
      const primeiro = lados[a]
      if (!primeiro) continue
      for (let b = a + 1; b < lados.length; b += 1) {
        const segundo = lados[b]
        if (!segundo) continue
        const ab = primeiro.indice * total + segundo.indice
        const ba = segundo.indice * total + primeiro.indice
        emComum[ab] = (emComum[ab] ?? 0) + 1
        emComum[ba] = (emComum[ba] ?? 0) + 1
        if (primeiro.lado === segundo.lado) {
          iguais[ab] = (iguais[ab] ?? 0) + 1
          iguais[ba] = (iguais[ba] ?? 0) + 1
        }
      }
    }
  }

  const resultado = new Map<string, Afinidade>()
  // O Senado vota quase tudo em sessão secreta: com 20 nominais abertas no
  // ano, o piso fixo esvaziaria o ranking. Lá vale metade das votações.
  const pisoDaCasa = Math.min(MINIMO_EM_COMUM, Math.ceil(ordenadas.length / 2))

  acumuladores.forEach((acumulador, indice) => {
    const id = ids[indice]
    if (!id || acumulador.votacoes === 0) return

    const piso = Math.max(pisoDaCasa, Math.ceil(acumulador.votacoes * FRACAO_MINIMA_EM_COMUM))
    const pares: ParlamentarParecido[] = []
    for (let outro = 0; outro < total; outro += 1) {
      if (outro === indice) continue
      const comuns = emComum[indice * total + outro] ?? 0
      const outroId = ids[outro]
      const identidade = identidades[outro]
      if (comuns < piso || !outroId || !identidade) continue
      pares.push({
        casa,
        id: outroId,
        ...identidade,
        votacoes: comuns,
        concordancia: arredondar((iguais[indice * total + outro] ?? 0) / comuns),
      })
    }

    // Desempate pela amostra maior e depois pelo id, para a saída ser estável.
    const porConcordancia = (a: ParlamentarParecido, b: ParlamentarParecido) =>
      b.concordancia - a.concordancia || b.votacoes - a.votacoes || a.id.localeCompare(b.id)

    const parecidos = [...pares].sort(porConcordancia).slice(0, PARECIDOS_POR_PARLAMENTAR)
    const jaParecidos = new Set(parecidos.map((par) => par.id))
    const distantes = [...pares]
      .sort((a, b) => porConcordancia(b, a))
      .filter((par) => !jaParecidos.has(par.id))
      .slice(0, PARECIDOS_POR_PARLAMENTAR)

    resultado.set(parlamentarKey({ casa, id }), {
      ano,
      votacoes: acumulador.votacoes,
      governo:
        acumulador.governoVotacoes > 0
          ? { votacoes: acumulador.governoVotacoes, comGoverno: acumulador.comGoverno }
          : null,
      parecidos,
      distantes,
      contraPartido: {
        total: acumulador.contraPartido.length,
        recentes: acumulador.contraPartido.slice(-RECENTES_POR_LISTA).reverse(),
      },
      apertadas: acumulador.apertadas.slice(-RECENTES_POR_LISTA).reverse(),
    })
  })

  return resultado
}
