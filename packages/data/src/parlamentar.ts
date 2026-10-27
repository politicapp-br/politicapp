import { z } from "zod"

export const casaSchema = z.enum(["camara", "senado"])

export type Casa = z.infer<typeof casaSchema>

export const CARGO_LABEL: Record<Casa, string> = {
  camara: "Deputado(a) Federal",
  senado: "Senador(a)",
}

export const CASA_LABEL: Record<Casa, string> = {
  camara: "Câmara",
  senado: "Senado",
}

export const parlamentarSchema = z.object({
  casa: casaSchema,
  id: z.string(),
  nome: z.string(),
  nomeCivil: z.string().nullable(),
  partido: z.string(),
  uf: z.string(),
  fotoUrl: z.string().nullable(),
  email: z.string().nullable(),
  emExercicio: z.boolean(),
})

export type Parlamentar = z.infer<typeof parlamentarSchema>

export const parlamentarDetalheSchema = parlamentarSchema.extend({
  nascimento: z.string().nullable(),
  municipioNascimento: z.string().nullable(),
  ufNascimento: z.string().nullable(),
  escolaridade: z.string().nullable(),
  telefone: z.string().nullable(),
  site: z.string().nullable(),
  gabinete: z.string().nullable(),
})

export type ParlamentarDetalhe = z.infer<typeof parlamentarDetalheSchema>

export const parlamentarRefSchema = parlamentarSchema.pick({
  casa: true,
  id: true,
})

export type ParlamentarRef = z.infer<typeof parlamentarRefSchema>

export const parlamentarKey = ({ casa, id }: ParlamentarRef) => `${casa}:${id}`

export const parseParlamentarKey = (key: string): ParlamentarRef | null => {
  const [casa, id] = key.split(":")
  const parsed = casaSchema.safeParse(casa)
  if (!parsed.success || !id) return null
  return { casa: parsed.data, id }
}
