import type { Cargo, Casa, ParlamentarRef } from "@politicapp/data"
import type { Href } from "expo-router"

/**
 * Montagem dos caminhos de navegação num lugar só: as rotas carregam
 * parâmetros (casa, id, sigla) que antes eram interpolados à mão em cada tela.
 */
export const routes = {
  parlamentar: ({ casa, id }: ParlamentarRef): Href => `/parlamentar/${casa}/${id}`,
  votacao: (casa: Casa, id: string): Href => `/votacao/${casa}/${id}`,
  proposicao: (casa: Casa, id: string): Href => `/proposicao/${casa}/${id}`,
  party: (sigla: string): Href => `/partido/${encodeURIComponent(sigla)}`,
  candidate: (uf: string, cargo: Cargo, id: string): Href =>
    `/candidato/${uf}/${cargo}/${id}`,
  panorama: (casa: Casa): Href => `/panorama?casa=${casa}`,
  compare: "/comparador",
  salaries: "/salarios",
  chartsShowcase: "/graficos",
  onboarding: "/onboarding",
} as const satisfies Record<string, Href | ((...args: never[]) => Href)>
