import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { feedEstaticoSchema, type ResumoDespesas } from "@politicapp/data"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { Loja } from "./loja"

const resumo = (id: string, total: number): ResumoDespesas => ({
  casa: "camara",
  id,
  ano: 2026,
  total,
  porMes: [],
  porTipo: [],
})

const ref = (id: string) => ({ casa: "camara" as const, id })

let raiz: string

beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), "loja-"))
})

afterEach(async () => {
  await rm(raiz, { recursive: true, force: true })
})

const lerShard = async (id: string) =>
  JSON.parse(await readFile(join(raiz, "parlamentar", "camara", `${id}.json`), "utf-8")) as Record<
    string,
    unknown
  >

describe("Loja", () => {
  it("não reescreve arquivo cujo conteúdo só mudou no geradoEm", async () => {
    const loja = new Loja(raiz)
    await loja.escreverArquivo("feed", { geradoEm: "a", ano: 2026, eventos: [] }, feedEstaticoSchema)
    await loja.escreverArquivo("feed", { geradoEm: "b", ano: 2026, eventos: [] }, feedEstaticoSchema)

    expect(await loja.lerJson("feed")).toMatchObject({ geradoEm: "a" })
  })

  it("recusa arquivo fora do contrato", async () => {
    const loja = new Loja(raiz)
    await expect(
      loja.escreverArquivo("feed", { geradoEm: "a" } as never, feedEstaticoSchema),
    ).rejects.toThrow(/fora do contrato/)
  })

  it("seção não recalculada hoje fica como estava; recalculada é substituída", async () => {
    const ontem = new Loja(raiz)
    ontem.definirSecao("despesas", new Map([["camara:1", resumo("1", 10)]]), { vazio: null })
    ontem.definirSecao("emendas", new Map(), { vazio: [] })
    await ontem.gravarShards([ref("1")], 2026, "ontem")

    // Hoje só a etapa de despesas rodou.
    const hoje = new Loja(raiz)
    await hoje.carregarShards()
    hoje.definirSecao("despesas", new Map([["camara:1", resumo("1", 20)]]), { vazio: null })
    await hoje.gravarShards([ref("1")], 2026, "hoje")

    const shard = await lerShard("1")
    expect(shard.despesas).toMatchObject({ total: 20 })
    expect(shard.emendas).toEqual([])
  })

  it("parlamentar fora do mapa recebe o valor vazio, não a seção de ontem", async () => {
    const ontem = new Loja(raiz)
    ontem.definirSecao("despesas", new Map([["camara:1", resumo("1", 10)]]), { vazio: null })
    await ontem.gravarShards([ref("1")], 2026, "ontem")

    const hoje = new Loja(raiz)
    await hoje.carregarShards()
    hoje.definirSecao("despesas", new Map(), { vazio: null })
    await hoje.gravarShards([ref("1")], 2026, "hoje")

    expect((await lerShard("1")).despesas).toBeNull()
  })

  it("seção restrita a uma casa não toca parlamentares da outra", async () => {
    const loja = new Loja(raiz)
    loja.definirSecao("frentes", new Map(), { vazio: [], casa: "camara" })
    await loja.gravarShards([ref("1"), { casa: "senado", id: "9" }], 2026, "hoje")

    const senador = JSON.parse(
      await readFile(join(raiz, "parlamentar", "senado", "9.json"), "utf-8"),
    ) as Record<string, unknown>
    expect(senador).not.toHaveProperty("frentes")
    expect(await lerShard("1")).toHaveProperty("frentes", [])
  })

  it("na virada do ano descarta seção antiga não recalculada", async () => {
    const ontem = new Loja(raiz)
    ontem.definirSecao("emendas", new Map(), { vazio: [] })
    await ontem.gravarShards([ref("1")], 2025, "ontem")

    const hoje = new Loja(raiz)
    await hoje.carregarShards()
    await hoje.gravarShards([ref("1")], 2026, "hoje")

    expect(await lerShard("1")).not.toHaveProperty("emendas")
  })

  it("remove o shard de quem saiu do exercício", async () => {
    const ontem = new Loja(raiz)
    await ontem.gravarShards([ref("1"), ref("2")], 2026, "ontem")

    const hoje = new Loja(raiz)
    await hoje.carregarShards()
    await hoje.gravarShards([ref("1")], 2026, "hoje")

    expect(await readdir(join(raiz, "parlamentar", "camara"))).toEqual(["1.json"])
  })

  it("valida a seção já em definirSecao, para a falha cair na etapa", () => {
    const loja = new Loja(raiz)
    expect(() =>
      loja.definirSecao("despesas", new Map([["camara:1", { total: "x" } as never]]), {
        vazio: null,
      }),
    ).toThrow(/fora do contrato/)
  })

  it("substituirColecao apaga itens que não vieram", async () => {
    const loja = new Loja(raiz)
    const feed = (geradoEm: string) => ({ geradoEm, ano: 2026, eventos: [] })
    await loja.substituirColecao(
      "colecao",
      [
        { caminho: "colecao/a", dados: feed("1") },
        { caminho: "colecao/b", dados: feed("1") },
      ],
      feedEstaticoSchema,
    )
    await loja.substituirColecao("colecao", [{ caminho: "colecao/b", dados: feed("2") }], feedEstaticoSchema)

    expect(await readdir(join(raiz, "colecao"))).toEqual(["b.json"])
  })

  it("manifest mantém o último sucesso de etapa que falhou ou não rodou", async () => {
    const loja = new Loja(raiz)
    await loja.gravarManifest(
      "t1",
      2026,
      [
        { nome: "emendas", ok: true, erro: null, duracaoMs: 1 },
        { nome: "frentes", ok: true, erro: null, duracaoMs: 1 },
      ],
      { completa: true },
    )
    await loja.gravarManifest(
      "t2",
      2026,
      [{ nome: "emendas", ok: false, erro: "fora do ar", duracaoMs: 1 }],
      { completa: false },
    )

    const manifest = await loja.manifestAnterior()
    expect(manifest?.etapas.emendas).toEqual({ ok: false, verificadoEm: "t1", erro: "fora do ar" })
    expect(manifest?.etapas.frentes).toEqual({ ok: true, verificadoEm: "t1", erro: null })
  })

  it("execução completa tira do manifest a etapa que deixou de existir", async () => {
    const loja = new Loja(raiz)
    await loja.gravarManifest("t1", 2026, [{ nome: "velha", ok: true, erro: null, duracaoMs: 1 }], {
      completa: true,
    })
    await loja.gravarManifest("t2", 2026, [{ nome: "nova", ok: true, erro: null, duracaoMs: 1 }], {
      completa: true,
    })

    expect(Object.keys((await loja.manifestAnterior())?.etapas ?? {})).toEqual(["nova"])
  })

  it("etapa que falha no meio não deixa escrita nem seção pela metade", async () => {
    const loja = new Loja(raiz)
    const resultado = await loja.etapa("quebra", async () => {
      await loja.escreverArquivo("feed", { geradoEm: "a", ano: 2026, eventos: [] }, feedEstaticoSchema)
      loja.definirSecao("emendas", new Map(), { vazio: [] })
      throw new Error("fonte caiu")
    })
    await loja.gravarShards([ref("1")], 2026, "hoje")

    expect(resultado).toBeNull()
    expect(await loja.lerJson("feed")).toBeNull()
    expect(await lerShard("1")).not.toHaveProperty("emendas")
  })

  it("seção parcial só toca quem está no mapa e registra quando renovou", async () => {
    const ontem = new Loja(raiz)
    ontem.definirSecao("discursos", new Map([["camara:1", []], ["camara:2", []]]), { vazio: [] })
    await ontem.gravarShards([ref("1"), ref("2")], 2026, "ontem")

    const hoje = new Loja(raiz)
    await hoje.carregarShards()
    const discurso = { data: "2026-10-01", tipo: null, resumo: "x", urlTexto: null }
    hoje.definirSecao("discursos", new Map([["camara:1", [discurso]]]), { parcial: true })
    await hoje.gravarShards([ref("1"), ref("2")], 2026, "hoje")

    expect((await lerShard("1")).renovadoEm).toMatchObject({ discursos: "hoje" })
    expect((await lerShard("2")).renovadoEm).toMatchObject({ discursos: "ontem" })
    expect((await lerShard("2")).discursos).toEqual([])
    expect(hoje.renovadoEm(ref("2"), "discursos")).toBe("ontem")
  })

  it("seção atemporal atravessa a virada do ano", async () => {
    const ontem = new Loja(raiz)
    ontem.definirSecao("orgaos", new Map(), { vazio: [] })
    ontem.definirSecao("emendas", new Map(), { vazio: [] })
    await ontem.gravarShards([ref("1")], 2025, "ontem")

    const hoje = new Loja(raiz)
    await hoje.carregarShards()
    await hoje.gravarShards([ref("1")], 2026, "hoje")

    const shard = await lerShard("1")
    expect(shard).toHaveProperty("orgaos", [])
    expect(shard).not.toHaveProperty("emendas")
    expect(hoje.coberturaDaSecao("orgaos", [ref("1")], 2026)).toBe(1)
  })

  it("seção do diário que não mudou mantém o carimbo e não reescreve o shard", async () => {
    const ontem = new Loja(raiz)
    ontem.definirSecao("emendas", new Map(), { vazio: [] })
    await ontem.gravarShards([ref("1")], 2026, "ontem")

    const hoje = new Loja(raiz)
    await hoje.carregarShards()
    hoje.definirSecao("emendas", new Map(), { vazio: [] })
    await hoje.gravarShards([ref("1")], 2026, "hoje")

    const shard = await lerShard("1")
    expect(shard.renovadoEm).toEqual({ emendas: "ontem" })
    expect(shard.geradoEm).toBe("ontem")
  })
})
