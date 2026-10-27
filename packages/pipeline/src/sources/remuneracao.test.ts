import { describe, expect, it } from "vitest"

import {
  apurarGruposDaFolha,
  extrairFolhas,
  interpretarLinhaDeMoradia,
  linhasDaTabela,
  maisFrequente,
} from "./remuneracao"

describe("maisFrequente", () => {
  it("devolve o valor mais repetido", () => {
    expect(maisFrequente([1, 2, 2, 3, 2])).toBe(2)
  })

  it("não confunde frequência com magnitude", () => {
    expect(maisFrequente([100, 1, 1])).toBe(1)
  })

  it("reclama de lista vazia em vez de devolver lixo", () => {
    expect(() => maisFrequente([])).toThrow()
  })
})

describe("apurarGruposDaFolha", () => {
  const linha = (
    grupo: string,
    fixa: string,
    comissao = "0,00",
    vantagens = "0,00",
  ) => ({
    "Grupo Funcional": grupo,
    "Remuneração Fixa": fixa,
    "Vantagens de Natureza Pessoal": vantagens,
    "Função ou Cargo em Comissão": comissao,
  })

  const folha = apurarGruposDaFolha(
    [
      linha("Parlamentar", "46366,19"),
      linha("Parlamentar", "46366,19"),
      // Secretário recebe pelo cargo em comissão, com a fixa zerada.
      linha("Secretário Parlamentar", "0,00", "5.226,24"),
      linha("Secretário Parlamentar", "0,00", "3.000,00"),
      // Linha sem salário no mês não entra na mediana, mas conta gente.
      linha("Secretário Parlamentar", "0,00", "0,00"),
      linha("Aposentadoria Parlamentar", "12.055,21"),
      linha("Pensão Parlamentar", "6.027,60"),
      linha("", "999,99"),
    ],
    "https://exemplo/folha",
    7,
    2026,
  )

  it("agrega quantidade e massa por grupo, ignorando linhas sem grupo", () => {
    const parlamentar = folha.grupos.find((g) => g.grupo === "Parlamentar")
    expect(parlamentar).toEqual({
      grupo: "Parlamentar",
      quantidade: 2,
      massaMensal: 92732.38,
    })
    expect(folha.grupos.some((g) => g.grupo === "")).toBe(false)
  })

  it("ordena os grupos da maior massa para a menor", () => {
    const massas = folha.grupos.map((g) => g.massaMensal)
    expect(massas).toEqual([...massas].sort((a, b) => b - a))
  })

  it("lê o salário do secretário na coluna de cargo em comissão", () => {
    expect(folha.secretarios.quantidade).toBe(3)
    expect(folha.secretarios.massaMensal).toBeCloseTo(8226.24)
    expect(folha.secretarios.salarioMediano).toBeCloseTo(4113.12)
  })

  it("apura aposentadoria e pensão de ex-parlamentares", () => {
    expect(folha.aposentadoriaParlamentar).toEqual({
      beneficiarios: 1,
      medianaMensal: 12055.21,
      totalMensal: 12055.21,
    })
    expect(folha.pensaoParlamentar.totalMensal).toBeCloseTo(6027.6)
  })
})

describe("extrairFolhas", () => {
  const BASE =
    "https://www2.camara.leg.br/transparencia/recursos-humanos/remuneracao/relatorios-consolidados-por-ano-e-mes/2026"

  it("encontra os CSVs pelo texto do link e ordena do mês mais recente", () => {
    const html = `
      <a href="${BASE}/janeiro-de-2026-csv">CSV</a>
      <a href="${BASE}/janeiro-de-2026-pdf">PDF</a>
      <a href="${BASE}/julho-de-2026-csv">CSV</a>
      <a href="${BASE}/julho-de-2026-pdf">PDF</a>`

    const folhas = extrairFolhas(html, 2026)

    expect(folhas.map((folha) => folha.mes)).toEqual([7, 1])
    expect(folhas[0]?.url).toBe(`${BASE}/julho-de-2026-csv`)
  })

  it("acha o CSV de fevereiro, cujo slug não segue o padrão", () => {
    // Caso real de 2026: o PDF ficou com o slug limpo e o CSV com "-1".
    const html = `
      <a href="${BASE}/fevereiro-de-2026">PDF</a>
      <a href="${BASE}/fevereiro-de-2026-1">CSV</a>`

    const folhas = extrairFolhas(html, 2026)

    expect(folhas).toEqual([
      { url: `${BASE}/fevereiro-de-2026-1`, mes: 2, anoDoArquivo: 2026 },
    ])
  })

  it("tolera marcação em volta do texto do link", () => {
    const html = `<a href="${BASE}/maio-de-2026-csv"><span> csv </span></a>`

    expect(extrairFolhas(html, 2026)).toHaveLength(1)
  })

  it("ignora links de outros anos e de outras seções", () => {
    const html = `
      <a href="${BASE}/../2025/dezembro-de-2025-csv">CSV</a>
      <a href="${BASE}/julho-de-2026-csv">Relatório completo</a>
      <a href="https://www.camara.leg.br/deputados/quem-sao">Quem são</a>`

    expect(extrairFolhas(html, 2026)).toEqual([])
  })
})

describe("linhasDaTabela", () => {
  it("lê só o corpo da tabela, ignorando o cabeçalho", () => {
    const html = `
      <table>
        <thead><tr><th>Nome</th><th>Dias</th></tr></thead>
        <tbody>
          <tr><td>Abilio Brunini (PL-MT)</td><td>0 dia</td></tr>
          <tr><td>Acácio Favacho (MDB-AP)</td><td>222 dias</td></tr>
        </tbody>
      </table>`

    expect(linhasDaTabela(html)).toEqual([
      ["Abilio Brunini (PL-MT)", "0 dia"],
      ["Acácio Favacho (MDB-AP)", "222 dias"],
    ])
  })

  it("desfaz as entidades e colapsa o espaçamento do HTML", () => {
    const html =
      "<tbody><tr><td>\n  Jos&#233;   Silva&nbsp;(PT-BA)\n</td><td>R$ 0,00</td></tr></tbody>"

    expect(linhasDaTabela(html)).toEqual([["José Silva (PT-BA)", "R$ 0,00"]])
  })

  it("devolve vazio quando a página muda e não há mais tabela", () => {
    expect(linhasDaTabela("<div>portal em manutenção</div>")).toEqual([])
  })
})

describe("interpretarLinhaDeMoradia", () => {
  const linha = (celulas: string[]) => interpretarLinhaDeMoradia(celulas)

  it("separa nome e UF do rótulo com partido", () => {
    const registro = linha([
      "Adilson Barroso (PL-SP)",
      "0 dia",
      "R$ 7.938,93",
      "R$ 0,00",
    ])

    expect(registro?.nome).toBe("Adilson Barroso")
    expect(registro?.uf).toBe("SP")
  })

  it("lê os valores em formato brasileiro", () => {
    const registro = linha([
      "Abilio Brunini (PL-MT)",
      "0 dia",
      "R$ 20.715,30",
      "R$ 4.854,15",
    ])

    expect(registro?.moradia.auxilioRecebido).toBe(20715.3)
    expect(registro?.moradia.complementoComCota).toBe(4854.15)
  })

  it("classifica quem ocupa imóvel funcional", () => {
    const registro = linha([
      "Acácio Favacho (MDB-AP)",
      "222 dias",
      "R$ 0,00",
      "R$ 0,00",
    ])

    expect(registro?.moradia.tipo).toBe("imovel-funcional")
    expect(registro?.moradia.diasEmImovelFuncional).toBe(222)
  })

  it("classifica quem só recebe auxílio", () => {
    const registro = linha([
      "Afonso Florence (PT-BA)",
      "0 dia",
      "R$ 9.787,03",
      "R$ 0,00",
    ])

    expect(registro?.moradia.tipo).toBe("auxilio-moradia")
  })

  it("marca como 'ambos' quem trocou de situação no meio do ano", () => {
    const registro = linha([
      "Fulano de Tal (PP-GO)",
      "120 dias",
      "R$ 8.506,00",
      "R$ 0,00",
    ])

    expect(registro?.moradia.tipo).toBe("ambos")
  })

  it("classifica quem não usa nenhum dos dois", () => {
    const registro = linha([
      "Adriana Ventura (NOVO-SP)",
      "0 dia",
      "R$ 0,00",
      "R$ 0,00",
    ])

    expect(registro?.moradia.tipo).toBe("nenhum")
  })

  it("descarta linha que não seja de parlamentar", () => {
    expect(linha(["Total", "—", "R$ 0,00", "R$ 0,00"])).toBeNull()
    expect(linha(["Abilio Brunini (PL-MT)", "0 dia"])).toBeNull()
    expect(linha([])).toBeNull()
  })
})
