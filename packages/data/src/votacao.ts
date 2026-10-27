import { z } from "zod"

import { casaSchema, parlamentarRefSchema } from "./parlamentar"

export const tipoVotoSchema = z.enum([
  "sim",
  "nao",
  "abstencao",
  "obstrucao",
  "ausente",
  "presidente",
])

export type TipoVoto = z.infer<typeof tipoVotoSchema>

export const VOTO_LABEL: Record<TipoVoto, string> = {
  sim: "Sim",
  nao: "Não",
  abstencao: "Abstenção",
  obstrucao: "Obstrução",
  ausente: "Não votou",
  presidente: "Presidiu a sessão",
}

export const votacaoSchema = z.object({
  casa: casaSchema,
  id: z.string(),
  data: z.string(),
  descricao: z.string(),
  resumo: z.string().nullable(),
  proposicao: z
    .object({
      id: z.string().nullable(),
      sigla: z.string(),
      ementa: z.string().nullable(),
    })
    .nullable(),
  aprovada: z.boolean().nullable(),
  placar: z.object({
    sim: z.number(),
    nao: z.number(),
    abstencao: z.number(),
    outros: z.number(),
  }),
})

export type Votacao = z.infer<typeof votacaoSchema>

export const votoSchema = parlamentarRefSchema.extend({
  nome: z.string(),
  partido: z.string(),
  uf: z.string(),
  voto: tipoVotoSchema,
})

export type Voto = z.infer<typeof votoSchema>

export const votacaoDetalheSchema = votacaoSchema.extend({
  votos: z.array(votoSchema),
})

export type VotacaoDetalhe = z.infer<typeof votacaoDetalheSchema>

export const placarVazio: Votacao["placar"] = {
  sim: 0,
  nao: 0,
  abstencao: 0,
  outros: 0,
}

const TIPO_VOTO_CAMARA: Record<string, TipoVoto> = {
  Sim: "sim",
  Não: "nao",
  Abstenção: "abstencao",
  Obstrução: "obstrucao",
  "Artigo 17": "presidente",
}

/** A Câmara passou a devolver `tipoVoto: null` em alguns votos (out/2026). */
export const tipoVotoDaCamara = (
  tipoVoto: string | null | undefined,
): TipoVoto => (tipoVoto ? (TIPO_VOTO_CAMARA[tipoVoto.trim()] ?? "ausente") : "ausente")

const TIPO_VOTO_SENADO: Record<string, TipoVoto> = {
  SIM: "sim",
  NAO: "nao",
  ABSTENCAO: "abstencao",
  VOTOU: "sim",
}

const semAcento = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim()

/**
 * `siglaVotoParlamentar` do Senado não é enum limpo: mistura Sim/Não/Abstenção
 * com AP, P-NRV, MIS, LS, LAP, LP e "Presidente (art. 51 RISF)". Em votação
 * secreta vira "Votou".
 */
export const tipoVotoDoSenado = (sigla: string | null | undefined): TipoVoto => {
  if (!sigla) return "ausente"
  const normalizada = semAcento(sigla)
  if (normalizada.startsWith("PRESIDENTE")) return "presidente"
  return TIPO_VOTO_SENADO[normalizada] ?? "ausente"
}

/**
 * A listagem de votações da Câmara não diz se a votação foi nominal, e buscar
 * os votos de cada uma custaria centenas de requisições. Só as nominais trazem
 * o placar escrito na descrição ("Sim: 134; Não: 285; Abstenção: 2; Total: 421"),
 * então essa marca é o que separa nominal de simbólica.
 */
const PLACAR_NA_DESCRICAO =
  /Sim:\s*(\d+)[;,]?\s*N[ãa]o:\s*(\d+)(?:[;,]?\s*Absten[çc][ãa]o:\s*(\d+))?[;,.]?\s*(?:Total:\s*\d+[;,.]?)?/i

export const placarDaDescricao = (
  descricao: string,
): Votacao["placar"] | null => {
  const encontrado = PLACAR_NA_DESCRICAO.exec(descricao)
  if (!encontrado?.[1] || !encontrado[2]) return null

  return {
    sim: Number(encontrado[1]),
    nao: Number(encontrado[2]),
    abstencao: Number(encontrado[3] ?? 0),
    outros: 0,
  }
}

/** Remove o placar da descrição — o app já mostra a contagem como gráfico. */
export const descricaoSemPlacar = (descricao: string) =>
  descricao.replace(PLACAR_NA_DESCRICAO, "").trim()

export type LadoMajoritario = Extract<TipoVoto, "sim" | "nao">

export type GrupoDeVotos = {
  grupo: string
  placar: Votacao["placar"]
  total: number
  /** Lado vencedor entre sim/não dentro do grupo; null em empate (ou sem votos objetivos). */
  maioria: LadoMajoritario | null
  /** Quem votou sim/não contra a maioria do próprio grupo. */
  dissidentes: Voto[]
}

/**
 * Agrega os votos de uma votação por partido ou UF, do maior grupo para o
 * menor. A maioria considera só os votos objetivos (sim/não): abstenção,
 * obstrução e ausência não definem o lado de uma bancada.
 */
export const agruparVotosPor = (
  votos: Voto[],
  chave: "partido" | "uf",
): GrupoDeVotos[] => {
  const grupos = new Map<string, Voto[]>()
  for (const voto of votos) {
    const nome = voto[chave]
    const existentes = grupos.get(nome)
    if (existentes) existentes.push(voto)
    else grupos.set(nome, [voto])
  }

  return [...grupos.entries()]
    .map(([grupo, votosDoGrupo]): GrupoDeVotos => {
      const placar = contarPlacar(votosDoGrupo)
      const maioria: LadoMajoritario | null =
        placar.sim === placar.nao
          ? null
          : placar.sim > placar.nao
            ? "sim"
            : "nao"
      const contrario = maioria === "sim" ? "nao" : "sim"
      return {
        grupo,
        placar,
        total: votosDoGrupo.length,
        maioria,
        dissidentes: maioria
          ? votosDoGrupo.filter((voto) => voto.voto === contrario)
          : [],
      }
    })
    .sort(
      (a, b) => b.total - a.total || a.grupo.localeCompare(b.grupo, "pt-BR"),
    )
}

/** Fração mínima dos votos objetivos no mesmo lado para dizer que o grupo fechou em bloco. */
export const BLOCO_MINIMO = 0.9

export const votouEmBloco = ({ placar, maioria }: GrupoDeVotos): boolean => {
  if (!maioria) return false
  return placar[maioria] / (placar.sim + placar.nao) >= BLOCO_MINIMO
}

export const contarPlacar = (votos: Voto[]): Votacao["placar"] =>
  votos.reduce<Votacao["placar"]>(
    (placar, { voto }) => ({
      ...placar,
      sim: placar.sim + (voto === "sim" ? 1 : 0),
      nao: placar.nao + (voto === "nao" ? 1 : 0),
      abstencao: placar.abstencao + (voto === "abstencao" ? 1 : 0),
      outros:
        placar.outros +
        (voto === "sim" || voto === "nao" || voto === "abstencao" ? 0 : 1),
    }),
    placarVazio,
  )
