import { z } from "zod"

export const cargoSchema = z.enum([
  "presidente",
  "governador",
  "senador",
  "deputado-federal",
  "deputado-estadual",
])

export type Cargo = z.infer<typeof cargoSchema>

export const CARGO_ELEICAO_LABEL: Record<Cargo, string> = {
  presidente: "Presidente",
  governador: "Governador(a)",
  senador: "Senador(a)",
  "deputado-federal": "Deputado(a) Federal",
  "deputado-estadual": "Deputado(a) Estadual",
}

export const CARGO_CODIGO_TSE: Record<Cargo, number> = {
  presidente: 1,
  governador: 3,
  senador: 5,
  "deputado-federal": 6,
  "deputado-estadual": 7,
}

export const situacaoCandidaturaSchema = z.enum([
  "deferido",
  "indeferido",
  "pendente",
  "renuncia",
  "outro",
])

export type SituacaoCandidatura = z.infer<typeof situacaoCandidaturaSchema>

export const candidatoSchema = z.object({
  id: z.string(),
  nomeUrna: z.string(),
  nomeCompleto: z.string(),
  numero: z.string(),
  cargo: cargoSchema,
  uf: z.string(),
  partido: z.string(),
  coligacao: z.string().nullable(),
  fotoUrl: z.string().nullable(),
  situacao: situacaoCandidaturaSchema,
  totalBens: z.number().nullable(),
  reeleicao: z.boolean(),
})

export type Candidato = z.infer<typeof candidatoSchema>

export const bemDeclaradoSchema = z.object({
  descricao: z.string(),
  tipo: z.string(),
  valor: z.number(),
})

export type BemDeclarado = z.infer<typeof bemDeclaradoSchema>

export const candidaturaAnteriorSchema = z.object({
  ano: z.number(),
  cargo: z.string(),
  local: z.string(),
  partido: z.string().nullable(),
  resultado: z.string().nullable(),
})

export type CandidaturaAnterior = z.infer<typeof candidaturaAnteriorSchema>

export const candidatoDetalheSchema = candidatoSchema.extend({
  nascimento: z.string().nullable(),
  ocupacao: z.string().nullable(),
  escolaridade: z.string().nullable(),
  bens: z.array(bemDeclaradoSchema),
  propostaUrl: z.string().nullable(),
  /** Teto de gastos da campanha fixado pelo TSE para o cargo. */
  limiteGastos1T: z.number().nullable(),
  limiteGastos2T: z.number().nullable(),
  candidaturasAnteriores: z.array(candidaturaAnteriorSchema),
})

export type CandidatoDetalhe = z.infer<typeof candidatoDetalheSchema>
