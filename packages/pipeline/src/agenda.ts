import type { EventoPauta } from "@politicapp/data"

import { emLotes } from "./http"
import { aaaammdd, janelaFutura, type Janela } from "./periodo"
import { listarEventosCamara, listarPautaDoEvento } from "./sources/camara"
import {
  listarAgendaComissoesSenado,
  listarAgendaPlenarioSenado,
  listarPautaDoPlenarioSenado,
  type SessaoPlenarioSenadoApi,
} from "./sources/senado"
import {
  eventoDaCamara,
  eventoDeComissaoSenado,
  eventoDoPlenarioSenado,
  eventosDeliberativosCamara,
  montarAgenda,
  reunioesRelevantesSenado,
  sessoesDeliberativasSenado,
} from "./tasks/agenda"

export const DIAS_DE_AGENDA = 14

/**
 * O endpoint de agenda do plenário devolve da data informada até o fim do
 * mês. Quando a janela vira o mês, uma segunda chamada cobre o começo do
 * mês seguinte.
 */
const agendaPlenarioSenadoNaJanela = async (
  janela: Janela,
): Promise<SessaoPlenarioSenadoApi[]> => {
  const referencias = [aaaammdd(janela.inicio)]
  if (janela.fim.slice(0, 7) !== janela.inicio.slice(0, 7)) {
    referencias.push(`${aaaammdd(janela.fim).slice(0, 6)}01`)
  }

  const listas = await Promise.all(referencias.map(listarAgendaPlenarioSenado))
  return listas
    .flat()
    .filter((sessao) => sessao.Data !== undefined && sessao.Data <= janela.fim)
}

/**
 * Coleta a agenda deliberativa das duas casas. Vive fora do main para o job
 * leve de agenda (cron frequente) reusar sem rodar o ETL inteiro.
 */
export const levantarAgenda = async (): Promise<EventoPauta[]> => {
  const janela = janelaFutura(DIAS_DE_AGENDA)

  const [eventosCamara, sessoesSenado, reunioesSenado] = await Promise.all([
    // Qualquer uma falhando derruba a etapa: agenda pela metade seria
    // publicada como "não há sessão marcada" na casa que falhou.
    listarEventosCamara(janela.inicio, janela.fim),
    agendaPlenarioSenadoNaJanela(janela),
    listarAgendaComissoesSenado(aaaammdd(janela.inicio), aaaammdd(janela.fim)),
  ])

  const camara = await emLotes(
    eventosDeliberativosCamara(eventosCamara),
    async (evento) => {
      const pauta = await listarPautaDoEvento(evento.id).catch(() => [])
      return eventoDaCamara(evento, pauta)
    },
  )

  const plenarioSenado = await emLotes(
    sessoesDeliberativasSenado(sessoesSenado),
    async (sessao) => {
      const pauta = await listarPautaDoPlenarioSenado(
        sessao.CodigoSessao ?? "",
      ).catch(() => [])
      return eventoDoPlenarioSenado(sessao, pauta)
    },
  )

  const comissoesSenado =
    reunioesRelevantesSenado(reunioesSenado).map(eventoDeComissaoSenado)

  return montarAgenda([...camara, ...plenarioSenado, ...comissoesSenado])
}
