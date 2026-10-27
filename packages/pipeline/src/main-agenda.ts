import { feedEstaticoSchema } from "@politicapp/data"

import { levantarAgenda } from "./agenda"
import { config, log } from "./config"
import { gravarStatus, registrosDeEtapas } from "./etapas"
import { Loja } from "./loja"

/**
 * Job leve de agenda: recomputa só o "em pauta" do feed, várias vezes por dia
 * útil. Parte do feed que está no diretório publicado e não toca em mais
 * nada — o resto do site continua exatamente como o ETL diário deixou.
 */
const executar = async () => {
  const geradoEm = new Date().toISOString()
  const loja = new Loja(config.saida)

  const feedAnterior = await loja.lerValidado("feed", feedEstaticoSchema)
  if (!feedAnterior) {
    // Sem feed válido, não há acontecimentos para preservar: melhor esperar
    // o ETL diário do que publicar um feed só com agenda.
    throw new Error("feed.json ausente ou fora do contrato — rode o pipeline diário primeiro")
  }

  await loja.etapa("agenda", async () => {
    const agenda = await levantarAgenda()
    const acontecimentos = feedAnterior.eventos.filter((evento) => evento.tipo !== "pauta")
    await loja.escreverArquivo(
      "feed",
      { geradoEm, ano: feedAnterior.ano, eventos: [...agenda, ...acontecimentos] },
      feedEstaticoSchema,
    )
    log(`agenda: ${agenda.length} eventos, ${acontecimentos.length} acontecimentos preservados`)
  })

  await loja.gravarManifest(geradoEm, feedAnterior.ano, registrosDeEtapas(), { completa: false })
  await gravarStatus()
}

executar().catch((erro: unknown) => {
  log(`job de agenda falhou: ${erro instanceof Error ? (erro.stack ?? erro.message) : String(erro)}`)
  process.exitCode = 1
})
