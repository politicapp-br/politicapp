import { describe, expect, it } from "vitest"

import type { Parlamentar } from "@politicapp/data"

import type { LinhaDeEmenda } from "../sources/transparencia"
import { ANO_MINIMO_EMENDAS, emendasPorMunicipio, resumirEmendas, somarEmendasDesde } from "./emendas"

const parlamentar = (parcial: Partial<Parlamentar> & Pick<Parlamentar, "id" | "nome">): Parlamentar => ({
  casa: "camara",
  nomeCivil: null,
  partido: "PP",
  uf: "RJ",
  fotoUrl: null,
  email: null,
  emExercicio: true,
  ...parcial,
})

const linha = (parcial: Partial<LinhaDeEmenda>): LinhaDeEmenda => ({
  "Ano da Emenda": "2024",
  "Nome do Autor da Emenda": "HELIO LOPES",
  "Nome Função": "Saúde",
  "Município": "Sem informação",
  "UF": "RIO DE JANEIRO",
  "Valor Empenhado": "1000,50",
  "Valor Pago": "500,25",
  ...parcial,
})

const HELIO = parlamentar({ id: "1", nome: "Hélio Lopes" })

describe("resumirEmendas", () => {
  it("casa o autor por nome sem acento e em caixa alta", () => {
    const { resumos } = resumirEmendas([linha({})], [HELIO])

    expect(resumos).toEqual([
      {
        casa: "camara",
        id: "1",
        ano: 2024,
        empenhado: 1000.5,
        pago: 500.25,
        porArea: [{ area: "Saúde", valor: 1000.5 }],
        porLocal: [{ municipio: null, uf: "RJ", valor: 1000.5 }],
      },
    ])
  })

  it("deixa de fora autores sem correspondência e devolve os nomes", () => {
    const { resumos, autoresSemCorrespondencia } = resumirEmendas(
      [linha({ "Nome do Autor da Emenda": "FULANO QUE SAIU" })],
      [HELIO],
    )

    expect(resumos).toEqual([])
    expect(autoresSemCorrespondencia).toEqual(["FULANO QUE SAIU"])
  })

  it("ignora autor 'Sem informação' sem contar como falta de correspondência", () => {
    const { resumos, autoresSemCorrespondencia } = resumirEmendas(
      [linha({ "Nome do Autor da Emenda": "Sem informação" })],
      [HELIO],
    )

    expect(resumos).toEqual([])
    expect(autoresSemCorrespondencia).toEqual([])
  })

  it("não atribui emendas de nome ambíguo entre duas pessoas", () => {
    const { resumos } = resumirEmendas(
      [linha({})],
      [HELIO, parlamentar({ casa: "senado", id: "2", nome: "Helio Lopes" })],
    )

    expect(resumos).toEqual([])
  })

  it("separa a agregação por ano", () => {
    const { resumos } = resumirEmendas(
      [
        linha({ "Ano da Emenda": "2023", "Valor Empenhado": "100,00" }),
        linha({ "Ano da Emenda": "2024", "Valor Empenhado": "200,00" }),
      ],
      [HELIO],
    )

    expect(resumos.map((resumo) => [resumo.ano, resumo.empenhado])).toEqual([
      [2023, 100],
      [2024, 200],
    ])
  })

  it("descarta anos anteriores ao mandato em curso mais antigo", () => {
    const { resumos } = resumirEmendas(
      [linha({ "Ano da Emenda": String(ANO_MINIMO_EMENDAS - 1) })],
      [HELIO],
    )

    expect(resumos).toEqual([])
  })

  it("ordena áreas e locais por valor empenhado", () => {
    const { resumos } = resumirEmendas(
      [
        linha({ "Nome Função": "Saúde", "Município": "MACEIÓ", "UF": "ALAGOAS", "Valor Empenhado": "10,00" }),
        linha({ "Nome Função": "Educação", "Município": "ARAPIRACA", "UF": "ALAGOAS", "Valor Empenhado": "90,00" }),
      ],
      [HELIO],
    )

    expect(resumos[0]?.porArea.map((item) => item.area)).toEqual(["Educação", "Saúde"])
    expect(resumos[0]?.porLocal).toEqual([
      { municipio: "ARAPIRACA", uf: "AL", valor: 90 },
      { municipio: "MACEIÓ", uf: "AL", valor: 10 },
    ])
  })

  it("não inventa local quando município e UF vêm sem informação", () => {
    const { resumos } = resumirEmendas(
      [linha({ "Município": "Sem informação", "UF": "Múltiplo" })],
      [HELIO],
    )

    expect(resumos[0]?.porLocal).toEqual([])
  })
})

describe("emendasPorMunicipio", () => {
  it("soma o empenhado por ano e município, sem corte, com chave sem acento", () => {
    const porMunicipio = emendasPorMunicipio(
      [
        linha({ "Município": "SÃO GONÇALO", "Valor Empenhado": "100,00" }),
        linha({ "Município": "SAO GONCALO", "Valor Empenhado": "50,00" }),
        linha({ "Município": "NITERÓI", "Valor Empenhado": "10,00", "Ano da Emenda": "2023" }),
        linha({ "Município": "Sem informação", "Valor Empenhado": "999,00" }),
        linha({ "Ano da Emenda": String(ANO_MINIMO_EMENDAS - 1), "Município": "NITERÓI" }),
      ],
      [HELIO],
    )
    const itens = porMunicipio.get("camara:1") ?? []
    expect(itens).toEqual([
      { ano: 2024, municipio: "RJ|SAO GONCALO", valor: 150 },
      { ano: 2023, municipio: "RJ|NITEROI", valor: 10 },
    ])
    expect(somarEmendasDesde(itens, 2024)).toEqual(new Map([["RJ|SAO GONCALO", 150]]))
  })
})
