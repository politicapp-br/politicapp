import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import {
  caminhoParlamentar,
  manifestSchema,
  parlamentarKey,
  secoesParlamentarSchemas,
  SECOES_ATEMPORAIS,
  shardParlamentarEnvelopeSchema,
  type Casa,
  type EtapaManifest,
  type Manifest,
  type NomeSecao,
  type ParlamentarRef,
  type SecoesParlamentar,
} from "@politicapp/data"
import type { z } from "zod"

import { log } from "./config"
import { etapa, type RegistroEtapa } from "./etapas"

/**
 * O diretório publicado (checkout da branch `dados`) é a fonte de verdade do
 * pipeline: o que está lá é o que está no ar. Cada execução lê o estado
 * anterior daqui e só sobrescreve o que conseguiu recalcular — etapa que
 * falhou não toca nos arquivos dela, e o dado de ontem continua publicado.
 */

const COLECOES = ["parlamentar", "votacao"] as const

/** `geradoEm` muda a cada execução; comparar sem ele evita reescrever o mesmo dado. */
const semCarimbo = (dados: unknown): string => {
  if (dados && typeof dados === "object" && !Array.isArray(dados)) {
    const { geradoEm: _ignorado, ...resto } = dados as Record<string, unknown>
    return JSON.stringify(resto)
  }
  return JSON.stringify(dados)
}

const listarJsonRecursivo = async (dir: string): Promise<string[]> => {
  const entradas = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const arquivos: string[] = []
  for (const entrada of entradas) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) arquivos.push(...(await listarJsonRecursivo(caminho)))
    else if (entrada.name.endsWith(".json")) arquivos.push(caminho)
  }
  return arquivos
}

type ShardBruto = Record<string, unknown>

const validarContrato = <T>(caminho: string, dados: T, schema: z.ZodType<T>) => {
  const analise = schema.safeParse(dados)
  if (!analise.success) {
    throw new Error(
      `${caminho}.json fora do contrato de @politicapp/data: ${analise.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    )
  }
}

export type OpcoesSecao<K extends NomeSecao> = {
  /** Restringe a seção a uma casa (a etapa só cobre uma delas). */
  casa?: Casa
} & (
  | {
      /** Valor de quem está em exercício mas não aparece no mapa. */
      vazio: SecoesParlamentar[K]
      parcial?: false
    }
  | {
      /**
       * Renovação parcial (job de perfis): só os parlamentares do mapa são
       * tocados; os demais ficam com a seção que já tinham.
       */
      parcial: true
      vazio?: never
    }
)

type DefinicaoSecao = {
  valores: Map<string, unknown>
  vazio: unknown
  casa?: Casa
  parcial: boolean
}

export class Loja {
  readonly base: string
  private escritos = 0
  private inalterados = 0
  private shards = new Map<string, ShardBruto>()
  private secoes = new Map<NomeSecao, DefinicaoSecao[]>()
  /** Escritas e seções da etapa em andamento; só valem se ela terminar bem. */
  private transacao: { escritas: (() => Promise<void>)[]; secoes: [NomeSecao, DefinicaoSecao][] } | null =
    null

  constructor(raiz: string) {
    this.base = raiz
  }

  private caminhoAbsoluto(caminho: string) {
    return join(this.base, `${caminho}.json`)
  }

  /**
   * Roda uma etapa que escreve. Tudo o que ela grava ou define fica pendente e
   * só é aplicado se ela terminar sem erro: etapa que falha no meio não deixa
   * metade dos arquivos novos e metade velhos. Não pode ser aninhada nem
   * rodar em paralelo com outra etapa que escreve.
   */
  async etapa<T>(nome: string, tarefa: () => Promise<T>): Promise<T | null> {
    if (this.transacao) throw new Error(`etapa ${nome} iniciada dentro de outra etapa que escreve`)
    const resultado = await etapa(nome, async () => {
      this.transacao = { escritas: [], secoes: [] }
      try {
        const valor = await tarefa()
        for (const escrever of this.transacao.escritas) await escrever()
        for (const [secao, definicao] of this.transacao.secoes) this.aplicarSecao(secao, definicao)
        return { valor }
      } finally {
        this.transacao = null
      }
    })
    return resultado === null ? null : resultado.valor
  }

  private adiar(escrita: () => Promise<void>) {
    if (this.transacao) this.transacao.escritas.push(escrita)
    else return escrita()
  }

  /** Arquivo anterior, ou null se não existe ou não é JSON legível. */
  async lerJson(caminho: string): Promise<unknown> {
    try {
      return JSON.parse(await readFile(this.caminhoAbsoluto(caminho), "utf-8")) as unknown
    } catch {
      return null
    }
  }

  /** Versão anterior validada; schema antigo conta como ausente (só vira aviso). */
  async lerValidado<T>(caminho: string, schema: z.ZodType<T>): Promise<T | null> {
    const bruto = await this.lerJson(caminho)
    if (bruto === null) return null
    const analise = schema.safeParse(bruto)
    if (!analise.success) {
      log(`loja: ${caminho}.json anterior fora do contrato atual, ignorado`)
      return null
    }
    return analise.data
  }

  /**
   * Valida contra o contrato do app e grava só se o conteúdo mudou. Arquivo
   * fora do contrato derruba a etapa que o produziu, nunca o pipeline.
   */
  async escreverArquivo<T>(caminho: string, dados: T, schema: z.ZodType<T>) {
    validarContrato(caminho, dados, schema)
    await this.adiar(() => this.gravar(caminho, dados))
  }

  private async gravar(caminho: string, dados: unknown) {
    const anterior = await this.lerJson(caminho)
    if (anterior !== null && semCarimbo(anterior) === semCarimbo(dados)) {
      this.inalterados += 1
      return
    }
    const absoluto = this.caminhoAbsoluto(caminho)
    await mkdir(dirname(absoluto), { recursive: true })
    await writeFile(absoluto, JSON.stringify(dados), "utf-8")
    this.escritos += 1
  }

  /**
   * Substitui uma coleção inteira (ex.: `votacao`): grava os itens novos e
   * apaga os que não vieram. Só chame com o resultado de uma etapa que deu
   * certo — coleção vazia por falha apagaria tudo.
   */
  async substituirColecao<T>(
    prefixo: string,
    itens: { caminho: string; dados: T }[],
    schema: z.ZodType<T>,
  ) {
    for (const { caminho, dados } of itens) validarContrato(caminho, dados, schema)
    await this.adiar(async () => {
      const manter = new Set<string>()
      for (const { caminho, dados } of itens) {
        await this.gravar(caminho, dados)
        manter.add(this.caminhoAbsoluto(caminho))
      }
      for (const arquivo of await listarJsonRecursivo(join(this.base, prefixo))) {
        if (!manter.has(arquivo)) await rm(arquivo)
      }
    })
  }

  // ── shards de parlamentar ──────────────────────────────────────────────

  async carregarShards() {
    for (const arquivo of await listarJsonRecursivo(join(this.base, "parlamentar"))) {
      try {
        const analise = shardParlamentarEnvelopeSchema.safeParse(
          JSON.parse(await readFile(arquivo, "utf-8")),
        )
        if (analise.success) this.shards.set(parlamentarKey(analise.data), analise.data)
      } catch {
        // Shard ilegível é recalculado do zero.
      }
    }
    log(`loja: ${this.shards.size} shards de parlamentar carregados`)
  }

  /**
   * Registra o resultado de uma etapa para uma seção, validando já — chamado
   * de dentro da etapa, um valor fora do contrato derruba só ela. O merge com
   * o que está no disco acontece em `gravarShards`, uma única vez, para
   * nenhuma etapa sobrescrever outra.
   */
  definirSecao<K extends NomeSecao>(
    nome: K,
    valores: Map<string, SecoesParlamentar[K]>,
    opcoes: OpcoesSecao<K>,
  ) {
    const { casa } = opcoes
    const parcial = opcoes.parcial === true
    const schema = secoesParlamentarSchemas[nome]
    const aValidar: [string, unknown][] = [...valores]
    if (!parcial) aValidar.push(["(vazio)", opcoes.vazio])
    for (const [chave, valor] of aValidar) {
      const analise = schema.safeParse(valor)
      if (!analise.success) {
        throw new Error(
          `seção ${nome} de ${chave} fora do contrato: ${analise.error.issues
            .slice(0, 3)
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ")}`,
        )
      }
    }
    const definicao: DefinicaoSecao = { valores, vazio: opcoes.vazio, casa, parcial }
    if (this.transacao) this.transacao.secoes.push([nome, definicao])
    else this.aplicarSecao(nome, definicao)
  }

  /**
   * Fração dos parlamentares cujo shard do ano já tem a seção. Etapa que não
   * roda todo dia usa isto para rodar fora de hora quando falta dado (primeira
   * execução, virada do ano).
   */
  coberturaDaSecao(nome: NomeSecao, parlamentares: ParlamentarRef[], ano: number) {
    if (parlamentares.length === 0) return 1
    const comSecao = parlamentares.filter((ref) => {
      const shard = this.shards.get(parlamentarKey(ref))
      return (shard?.ano === ano || SECOES_ATEMPORAIS.has(nome)) && shard !== undefined && nome in shard
    }).length
    return comSecao / parlamentares.length
  }

  /** Quando a seção deste parlamentar foi recalculada pela última vez; null se nunca. */
  renovadoEm(ref: ParlamentarRef, nome: NomeSecao): string | null {
    const shard = this.shards.get(parlamentarKey(ref))
    if (!shard || !(nome in shard)) return null
    const renovacoes = shard.renovadoEm as Record<string, string> | undefined
    return renovacoes?.[nome] ?? shard.geradoEm?.toString() ?? null
  }

  private aplicarSecao(nome: NomeSecao, definicao: DefinicaoSecao) {
    const outras = (this.secoes.get(nome) ?? []).filter((item) => item.casa !== definicao.casa)
    this.secoes.set(nome, [...outras, definicao])
  }

  /**
   * Grava um shard por parlamentar em exercício: seções recalculadas hoje
   * substituem as antigas, as demais ficam como estavam. Shard de quem saiu
   * do exercício é removido. Na virada do ano, seção não recalculada do ano
   * anterior é descartada em vez de exibida como se fosse do ano novo — menos
   * as atemporais (perfil, histórico…), que seguem até serem renovadas.
   * `renovadoEm` registra, por seção, quando o valor mudou (no job de perfis,
   * quando foi renovada — mesmo sem mudar).
   */
  async gravarShards(parlamentares: ParlamentarRef[], ano: number, geradoEm: string) {
    const ativos = new Set<string>()

    for (const ref of parlamentares) {
      const chave = parlamentarKey(ref)
      ativos.add(chave)
      const anterior = this.shards.get(chave)
      const mesmoAno = anterior?.ano === ano

      const renovacoesAnteriores = (anterior?.renovadoEm ?? {}) as Record<string, string>
      const renovadoEm: Record<string, string> = {}
      const shard: ShardBruto = { casa: ref.casa, id: ref.id, ano, geradoEm, renovadoEm }

      for (const nome of Object.keys(secoesParlamentarSchemas) as NomeSecao[]) {
        const definida = this.secoes
          .get(nome)
          ?.find((definicao) => !definicao.casa || definicao.casa === ref.casa)
        const renovar = definida && (definida.valores.has(chave) || !definida.parcial)
        if (renovar) {
          const valor = definida.valores.has(chave) ? definida.valores.get(chave) : definida.vazio
          shard[nome] = valor
          // Renovação parcial (perfis) sempre carimba: é o que faz a fila andar.
          // As demais só quando o valor muda — senão os 594 shards seriam
          // reescritos todo dia sem nenhum dado novo.
          const igual =
            anterior !== undefined &&
            nome in anterior &&
            JSON.stringify(anterior[nome]) === JSON.stringify(valor) &&
            typeof renovacoesAnteriores[nome] === "string"
          renovadoEm[nome] = !definida.parcial && igual ? renovacoesAnteriores[nome]! : geradoEm
        } else if ((mesmoAno || SECOES_ATEMPORAIS.has(nome)) && anterior && nome in anterior) {
          shard[nome] = anterior[nome]
          const quando = renovacoesAnteriores[nome] ?? anterior.geradoEm
          if (typeof quando === "string") renovadoEm[nome] = quando
        }
      }

      await this.gravar(caminhoParlamentar(ref), shard)
      this.shards.set(chave, shard)
    }

    let removidos = 0
    for (const arquivo of await listarJsonRecursivo(join(this.base, "parlamentar"))) {
      const [casa, nomeArquivo] = arquivo.split("/").slice(-2)
      if (!ativos.has(`${casa}:${nomeArquivo?.replace(/\.json$/, "")}`)) {
        await rm(arquivo)
        removidos += 1
      }
    }
    if (removidos > 0) log(`loja: ${removidos} shards de quem saiu do exercício removidos`)
  }

  // ── manifest ───────────────────────────────────────────────────────────

  async manifestAnterior(): Promise<Manifest | null> {
    return this.lerValidado("manifest", manifestSchema)
  }

  /**
   * Inventário do diretório inteiro (não só do que esta execução gravou) e
   * situação de cada etapa. Na execução completa (ETL diário) a lista de
   * etapas é a desta execução — etapa removida do código sai do manifest em
   * vez de envelhecer e reprovar o healthcheck para sempre. Nas parciais (job
   * de agenda), etapa que não rodou mantém o registro anterior.
   */
  async gravarManifest(
    geradoEm: string,
    ano: number,
    etapas: readonly RegistroEtapa[],
    { completa, manter = [] }: { completa: boolean; manter?: readonly string[] },
  ) {
    const anterior = await this.manifestAnterior()
    const situacao: Record<string, EtapaManifest> = {}
    for (const [nome, registro] of Object.entries(anterior?.etapas ?? {})) {
      // `manter`: etapas de outros jobs, que a execução completa não roda.
      if (!completa || manter.includes(nome)) situacao[nome] = registro
    }

    for (const registro of etapas) {
      situacao[registro.nome] = registro.ok
        ? { ok: true, verificadoEm: geradoEm, erro: null }
        : {
            ok: false,
            verificadoEm: anterior?.etapas[registro.nome]?.verificadoEm ?? null,
            erro: registro.erro,
          }
    }

    const arquivos: Manifest["arquivos"] = []
    for (const entrada of await readdir(this.base, { withFileTypes: true }).catch(() => [])) {
      if (!entrada.isFile() || !entrada.name.endsWith(".json") || entrada.name === "manifest.json") continue
      const { size } = await stat(join(this.base, entrada.name))
      arquivos.push({ caminho: entrada.name.replace(/\.json$/, ""), bytes: size })
    }
    arquivos.sort((a, b) => a.caminho.localeCompare(b.caminho))

    const colecoes: Manifest["colecoes"] = []
    for (const nome of COLECOES) {
      colecoes.push({ nome, itens: (await listarJsonRecursivo(join(this.base, nome))).length })
    }

    const manifest: Manifest = { geradoEm, ano, etapas: situacao, arquivos, colecoes }
    await mkdir(this.base, { recursive: true })
    await writeFile(this.caminhoAbsoluto("manifest"), JSON.stringify(manifest), "utf-8")
    log(`loja: ${this.escritos} arquivos gravados, ${this.inalterados} sem mudança`)
  }
}
