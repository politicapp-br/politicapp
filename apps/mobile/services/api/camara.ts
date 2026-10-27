import { createCamaraClient } from "@politicapp/sources"

import { fetchJson } from "./http"

/** Cliente da Câmara (mapeamento em `@politicapp/sources`, o mesmo do pipeline). */
export const {
  fetchDeputado,
  fetchDeputadoProposicoes,
  fetchProposicao,
  fetchDeputadoCommittees,
  fetchDeputadoSpeeches,
  fetchDeputadoCareer,
  fetchOrientacoes,
  fetchCamaraVotacao,
} = createCamaraClient(fetchJson)
