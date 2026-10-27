import type { EventoPauta, ItemDePauta } from "@politicapp/data"

import type { EventoCamaraApi, ItemPautaCamaraApi } from "../sources/camara"
import type {
  MateriaEmPauta,
  ReuniaoComissaoSenado,
  SessaoPlenarioSenadoApi,
} from "../sources/senado"

/** Quantos eventos de agenda o feed carrega e quantos itens cada um lista. */
export const PAUTAS_NO_FEED = 30
export const ITENS_POR_PAUTA = 10

const PLENARIO_CAMARA = "PLEN"

/**
 * A pauta da Câmara repete a mesma proposição em regimes/turnos diferentes.
 * Uma entrada por sigla basta — e a sigla vira chave estável de lista no app.
 */
const semRepetidos = (itens: ItemDePauta[]): ItemDePauta[] => {
  const vistos = new Set<string>()
  return itens.filter((item) => {
    if (vistos.has(item.sigla)) return false
    vistos.add(item.sigla)
    return true
  })
}

/**
 * Só interessa o que delibera: sessão solene, seminário e audiência não votam
 * nada. "Deliberativa" cobre "Sessão Deliberativa" e "Reunião Deliberativa" —
 * mas "Sessão Não Deliberativa" também contém a palavra, daí a negação.
 */
export const eventosDeliberativosCamara = (
  eventos: EventoCamaraApi[],
): EventoCamaraApi[] =>
  eventos.filter((evento) => {
    const tipo = evento.descricaoTipo ?? ""
    return (
      evento.situacao !== "Cancelada" &&
      tipo.includes("Deliberativa") &&
      !/N[ãa]o\s+Deliberativa/i.test(tipo)
    )
  })

export const eventoDaCamara = (
  evento: EventoCamaraApi,
  pauta: ItemPautaCamaraApi[],
): EventoPauta => {
  const orgao = evento.orgaos[0]
  const plenario = orgao?.sigla?.toUpperCase() === PLENARIO_CAMARA

  const itens = semRepetidos(
    pauta.flatMap((item) => {
      const proposicao = item.proposicao_
      if (!proposicao?.siglaTipo) return []
      const numeracao =
        proposicao.numero && proposicao.ano
          ? ` ${proposicao.numero}/${proposicao.ano}`
          : ""
      return [
        {
          sigla: `${proposicao.siglaTipo}${numeracao}`,
          ementa: proposicao.ementa ?? null,
        },
      ]
    }),
  ).slice(0, ITENS_POR_PAUTA)

  return {
    tipo: "pauta",
    id: `camara:${evento.id}`,
    data: evento.dataHoraInicio,
    casa: "camara",
    orgao: orgao?.sigla ?? "—",
    orgaoNome: plenario ? null : (orgao?.apelido ?? orgao?.nome ?? null),
    plenario,
    titulo: evento.descricaoTipo ?? "Sessão",
    itens,
  }
}

const capitalizarFrase = (texto: string) => {
  const minusculas = texto.toLowerCase()
  return minusculas.charAt(0).toUpperCase() + minusculas.slice(1)
}

/** "SESSÃO NÃO DELIBERATIVA" contém "DELIBERATIVA" — a negação vem primeiro. */
export const sessoesDeliberativasSenado = (
  sessoes: SessaoPlenarioSenadoApi[],
): SessaoPlenarioSenadoApi[] =>
  sessoes.filter((sessao) => {
    const tipo = (sessao.TipoSessao ?? "").toUpperCase()
    return (
      sessao.CodigoSessao !== undefined &&
      sessao.Data !== undefined &&
      tipo.includes("DELIBERATIVA") &&
      !/N[ÃA]O\s+DELIBERATIVA/.test(tipo) &&
      sessao.SituacaoSessao === "Agendada"
    )
  })

export const eventoDoPlenarioSenado = (
  sessao: SessaoPlenarioSenadoApi,
  pauta: MateriaEmPauta[],
): EventoPauta => ({
  tipo: "pauta",
  id: `senado-plen:${sessao.CodigoSessao ?? ""}`,
  data: sessao.Hora ? `${sessao.Data}T${sessao.Hora}` : (sessao.Data ?? ""),
  casa: sessao.Casa === "CN" ? "congresso" : "senado",
  orgao: "PLEN",
  orgaoNome: null,
  plenario: true,
  titulo: capitalizarFrase((sessao.TipoSessao ?? "Sessão deliberativa").trim()),
  itens: semRepetidos(pauta).slice(0, ITENS_POR_PAUTA),
})

/**
 * Reunião futura costuma vir sem a pauta itemizada — ela só aparece na API
 * dias antes. Exigir matéria aqui esvaziaria a agenda, então basta estar
 * agendada e ser pública; o app avisa quando a pauta ainda não saiu.
 */
export const reunioesRelevantesSenado = (
  reunioes: ReuniaoComissaoSenado[],
): ReuniaoComissaoSenado[] =>
  reunioes.filter(
    (reuniao) =>
      reuniao.exibir && !reuniao.secreta && reuniao.situacao === "Agendada",
  )

export const eventoDeComissaoSenado = (
  reuniao: ReuniaoComissaoSenado,
): EventoPauta => ({
  tipo: "pauta",
  id: `senado-com:${reuniao.codigo}`,
  data: reuniao.dataInicio,
  casa: "senado",
  orgao: reuniao.siglaColegiado,
  orgaoNome: reuniao.nomeColegiado,
  plenario: false,
  titulo: reuniao.titulo,
  itens: semRepetidos(reuniao.materias).slice(0, ITENS_POR_PAUTA),
})

/** Ordena do mais próximo para o mais distante e corta no teto do feed. */
export const montarAgenda = (eventos: EventoPauta[]): EventoPauta[] =>
  [...eventos]
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, PAUTAS_NO_FEED)
