import {
  agruparVotosPor,
  type AgregadosDaCasa,
  type AlinhamentoParlamentar,
  type Casa,
  type LadoMajoritario,
  type Voto,
} from "@politicapp/data"

/** Três casas decimais bastam e evitam inchar o JSON com dízimas. */
/**
 * O arquivo global leva só o agregado da casa; o alinhamento de cada
 * parlamentar vira seção do shard dele.
 */
export type AgregadosCalculados = AgregadosDaCasa & {
  parlamentares: AlinhamentoParlamentar[]
}

const arredondar = (valor: number) => Math.round(valor * 1000) / 1000

/** Sigla que o feed usa quando a API não informa o partido do parlamentar. */
const SEM_PARTIDO = "—"

type AcumuladorDeBancada = {
  ids: Set<string>
  votacoes: number
  somaCoesao: number
  governoVotacoes: number
  governoIguais: number
}

export type VotacaoParaAgregar = {
  votos: Voto[]
  /** Lado orientado pela liderança do governo, quando a casa publica isso. */
  governo?: LadoMajoritario | null
}

type AcumuladorDePar = { votacoes: number; iguais: number }

type AcumuladorDeParlamentar = Omit<AlinhamentoParlamentar, "casa">

/**
 * Resume o comportamento coletivo de uma casa a partir das votações nominais
 * do ano: coesão de cada bancada, concordância entre pares de bancadas e
 * alinhamento de cada parlamentar com o próprio partido. A posição da bancada
 * numa votação é a maioria entre seus votos sim/não.
 */
export const calcularAgregados = (
  casa: Casa,
  votacoes: VotacaoParaAgregar[],
): AgregadosCalculados => {
  const bancadas = new Map<string, AcumuladorDeBancada>()
  const pares = new Map<string, AcumuladorDePar>()
  const parlamentares = new Map<string, AcumuladorDeParlamentar>()

  const consideradas = votacoes.filter(({ votos }) => votos.length > 0)

  for (const { votos, governo } of consideradas) {
    // Parlamentar sem sigla vira partido "—" no feed; isso não é uma bancada.
    const grupos = agruparVotosPor(votos, "partido").filter(
      (grupo) => grupo.grupo !== SEM_PARTIDO,
    )
    const maiorias = new Map<string, LadoMajoritario>()

    for (const grupo of grupos) {
      const acumulador = acumular(bancadas, grupo.grupo, () => ({
        ids: new Set<string>(),
        votacoes: 0,
        somaCoesao: 0,
        governoVotacoes: 0,
        governoIguais: 0,
      }))
      if (!grupo.maioria) continue

      maiorias.set(grupo.grupo, grupo.maioria)
      acumulador.votacoes += 1
      acumulador.somaCoesao +=
        grupo.placar[grupo.maioria] / (grupo.placar.sim + grupo.placar.nao)

      if (governo) {
        acumulador.governoVotacoes += 1
        if (grupo.maioria === governo) acumulador.governoIguais += 1
      }
    }

    const partidosComPosicao = [...maiorias.keys()].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    )
    for (let i = 0; i < partidosComPosicao.length; i++) {
      for (let j = i + 1; j < partidosComPosicao.length; j++) {
        const partidoA = partidosComPosicao[i]!
        const partidoB = partidosComPosicao[j]!
        const par = acumular(pares, `${partidoA}\n${partidoB}`, () => ({
          votacoes: 0,
          iguais: 0,
        }))
        par.votacoes += 1
        if (maiorias.get(partidoA) === maiorias.get(partidoB)) par.iguais += 1
      }
    }

    for (const voto of votos) {
      bancadas.get(voto.partido)?.ids.add(voto.id)

      if (voto.voto !== "sim" && voto.voto !== "nao") continue
      const maioriaDaBancada = maiorias.get(voto.partido)
      if (!maioriaDaBancada && !governo) continue

      const acumulador = acumular(parlamentares, voto.id, () => ({
        id: voto.id,
        nome: voto.nome,
        partido: voto.partido,
        uf: voto.uf,
        votacoes: 0,
        comPartido: 0,
        votacoesGoverno: 0,
        comGoverno: 0,
      }))
      if (maioriaDaBancada) {
        acumulador.votacoes += 1
        if (voto.voto === maioriaDaBancada) acumulador.comPartido += 1
      }
      if (governo) {
        acumulador.votacoesGoverno += 1
        if (voto.voto === governo) acumulador.comGoverno += 1
      }
      // Quem troca de partido no meio do ano fica com o último visto.
      acumulador.nome = voto.nome
      acumulador.partido = voto.partido
      acumulador.uf = voto.uf
    }
  }

  return {
    casa,
    votacoesConsideradas: consideradas.length,
    bancadas: [...bancadas.entries()]
      .map(([partido, acumulador]) => ({
        partido,
        parlamentares: acumulador.ids.size,
        votacoes: acumulador.votacoes,
        coesao:
          acumulador.votacoes === 0
            ? null
            : arredondar(acumulador.somaCoesao / acumulador.votacoes),
        governo:
          acumulador.governoVotacoes === 0
            ? null
            : {
                votacoes: acumulador.governoVotacoes,
                comGoverno: acumulador.governoIguais,
              },
      }))
      .sort(
        (a, b) =>
          b.parlamentares - a.parlamentares ||
          a.partido.localeCompare(b.partido, "pt-BR"),
      ),
    concordancias: [...pares.entries()]
      .map(([chave, acumulador]) => {
        const [partidoA = "", partidoB = ""] = chave.split("\n")
        return {
          partidoA,
          partidoB,
          votacoes: acumulador.votacoes,
          concordancia: arredondar(acumulador.iguais / acumulador.votacoes),
        }
      })
      .sort(
        (a, b) =>
          a.partidoA.localeCompare(b.partidoA, "pt-BR") ||
          a.partidoB.localeCompare(b.partidoB, "pt-BR"),
      ),
    parlamentares: [...parlamentares.values()]
      .map((acumulador) => ({ casa, ...acumulador }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  }
}

const acumular = <T>(mapa: Map<string, T>, chave: string, vazio: () => T): T => {
  const existente = mapa.get(chave)
  if (existente) return existente
  const novo = vazio()
  mapa.set(chave, novo)
  return novo
}
