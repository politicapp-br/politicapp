import { createSenadoClient } from "@politicapp/sources"

import { fetchJson } from "./http"

/** Cliente do Senado (mapeamento em `@politicapp/sources`, o mesmo do pipeline). */
export const { fetchSenador, fetchSenadorCommittees, fetchSenadorSpeeches, fetchSenadoVotacao } =
  createSenadoClient(fetchJson)
