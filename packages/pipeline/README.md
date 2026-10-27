# @politicapp/pipeline

ETL que gera os JSONs estáticos servidos pelo GitHub Pages
(`https://politicapp-br.github.io/politicapp/…`). O "backend" do app é esse
conjunto de arquivos, sem servidor. O desenho completo está em
[`docs/arquitetura-dados.md`](../../docs/arquitetura-dados.md).

## Como o dado chega ao ar

Os arquivos vivem na branch órfã `dados`. Cada workflow faz checkout dela,
roda sobre o diretório, faz force-push de um commit único e publica no Pages.
O diário sempre publica; a agenda publica com lease e desiste (sem deploy nem
alerta) se o diário escreveu durante a execução dela.

| Workflow          | Cron (UTC)                  | O que faz                                                                |
| ----------------- | --------------------------- | ------------------------------------------------------------------------ |
| `pipeline.yml`    | `0 9 * * *` (diário)        | ETL completo (`src/main.ts`).                                            |
| `agenda.yml`      | `30 11,14,17,20,23 * * 1-5` | Recomputa só a agenda do `feed.json` (`src/main-agenda.ts`).             |
| `perfis.yml`      | `0 6 * * *` (diário)        | Renova perfil, proposições, órgãos, discursos e trajetória dos shards, com orçamento de tempo (`src/main-perfis.ts`). |
| `healthcheck.yml` | `0 12 * * *` (diário)       | Audita o site publicado (`src/main-validar.ts`): etapas, contrato, amostras. |

O que mantém isso de pé:

- **Etapas isoladas** (`src/etapas.ts`). Etapa que falha não escreve nada e o
  dado anterior dela continua publicado. O resto segue normalmente.
- **Falha de fonte é exceção.** Lista vazia publicada quer dizer "não há
  nada", nunca "a fonte caiu". `exigirVolume` falha a etapa quando a fonte
  devolve bem menos itens que da última vez.
- **Contrato na escrita.** Todo arquivo e toda seção são validados com o
  mesmo zod do app. Valor fora do contrato derruba só a etapa que o produziu.
- **Publicação parcial com alerta.** As etapas que falharam vão para
  `PIPELINE_STATUS`. O workflow publica o que deu certo e depois falha o job,
  abrindo ou atualizando a issue `dados-quebrados`.
- **Cron sempre ativo.** `pipeline` e `healthcheck` reativam os três workflows
  pela API, para o GitHub não desligá-los após 60 dias sem commit.
- **HTTP com retry, timeout e jitter** (`src/http.ts`).
- **Etapas caras em dias fixos.** Dentro do job diário, as etapas que custam
  centenas de requisições ou GBs e mudam devagar têm dia próprio (UTC):
  `producao` na segunda, `presenca` na terça, `historico` na quarta e
  `eleicoes` no primeiro domingo do mês. Fora do dia, só rodam para
  recuperar seção que falta em mais de 10% dos shards (primeira execução,
  virada do ano), e no máximo uma por execução. Nos dias em que não rodam,
  o registro delas no manifest é mantido, e o validador usa o limite de
  frescor de cada uma (`FRESCOR_POR_ETAPA_HORAS`). Disparar o `pipeline`
  com `completo` roda todas.

## Rodar localmente

```bash
# ETL completo sobre um diretório (vazio na primeira vez; a segunda rodada é incremental)
PIPELINE_SAIDA=/tmp/site pnpm -C packages/pipeline start

# Só a agenda (precisa de um feed.json gerado antes)
PIPELINE_SAIDA=/tmp/site pnpm -C packages/pipeline start:agenda

# Renovar perfis (precisa do parlamentares.json; orçamento curto para testar)
PIPELINE_SAIDA=/tmp/site PIPELINE_ORCAMENTO_MINUTOS=2 pnpm -C packages/pipeline start:perfis

# Auditar o site publicado, ou uma base alternativa
pnpm -C packages/pipeline validar
npx serve /tmp/site -l 8080 && pnpm -C packages/pipeline validar http://localhost:8080
```

| Variável                 | Padrão                                       | Uso                                                |
| ------------------------ | -------------------------------------------- | -------------------------------------------------- |
| `PIPELINE_SAIDA`         | `dist`                                       | Diretório publicado (no CI, o checkout de `dados`). |
| `PIPELINE_STATUS`        | —                                            | Arquivo onde gravar as etapas que falharam.        |
| `PIPELINE_ANO`           | ano corrente                                 | Ano de referência do ETL.                          |
| `PIPELINE_CONCORRENCIA`  | `3`                                          | Requisições simultâneas por lote.                  |
| `PIPELINE_DADOS_URL`     | `https://politicapp-br.github.io/politicapp` | Site que o validador audita.                       |
| `PIPELINE_FRESCOR_HORAS` | `48`                                         | Idade máxima do último sucesso de cada etapa.      |
| `PIPELINE_COMPLETO`      | —                                            | `1` roda também as etapas semanais e mensais.      |
| `PIPELINE_ORCAMENTO_MINUTOS` | `25`                                     | Tempo que o job de perfis gasta renovando shards.  |

## Quando algo quebra

1. **Issue `dados-quebrados` abriu.** O job `conferir` lista as etapas que
   falharam, e o log de cada uma tem o erro e o stack. O resto do site foi
   publicado normalmente.
2. **Fonte fora do ar** (site do governo instável): normalmente não há nada a
   fazer. O dado de ontem fica no ar e o ciclo seguinte se recupera sozinho.
   Se a mesma etapa falhar vários dias, o healthcheck acusa pelo
   `verificadoEm` velho no manifest.
3. **Republicar um dia perdido:** rode o workflow `pipeline` manualmente
   (Actions → pipeline → *Run workflow*). Reprocessar um ano passado só
   localmente, com `PIPELINE_ANO` e um `PIPELINE_SAIDA` descartável: no CI ele
   gravaria esse ano na branch publicada.
4. **Contrato quebrado** (`fora do contrato de @politicapp/data`): o formato
   de uma fonte mudou ou um schema mudou sem o pipeline acompanhar. Só a etapa
   afetada para de atualizar.
5. **Recomeçar do zero:** apague a branch `dados`. A próxima execução refaz
   tudo, incluindo o custo do mandato de todos os anos (alguns minutos a mais).

## Anatomia

```
src/
  main.ts          ETL completo: orquestra as etapas (entry do pipeline.yml)
  main-agenda.ts   agenda do feed (entry do agenda.yml)
  main-perfis.ts   renovação gradual das seções de perfil (entry do perfis.yml)
  main-validar.ts  auditoria do site publicado (entry do healthcheck.yml)
  fetch-json.ts    transporte do pipeline para os clientes de @politicapp/sources
  loja.ts          leitura/escrita do diretório publicado, shards, manifest
  etapas.ts        isolamento de etapas, guarda de volume, arquivo de status
  coleta.ts        uma função de coleta por fonte (falha = exceção)
  coleta-parlamentar.ts  produção, presença, histórico e eleições por parlamentar
  mandato.ts       custo do mandato com cache dos anos fechados
  schemas.ts       mapa arquivo/coleção publicada → schema zod
  http.ts          fetch com retry/timeout/jitter e lotes
  sources/         uma fonte externa por módulo (camara, senado, dou, …)
  tasks/           transformações puras e testáveis
```
