# Politicapp

App gratuito e de código aberto que agrega dados da política brasileira e mostra de um jeito simples para o cidadão comum.

## Como funciona

Três camadas de dados, sem servidor próprio:

1. **API estática** — o pacote `packages/pipeline` roda em cron do GitHub Actions, baixa os dados em lote, calcula medianas, rankings e cruzamentos, e publica JSON no GitHub Pages: índices globais e um arquivo por parlamentar e por votação. É o que permite comparar um gasto com a mediana da casa sem fazer 594 requisições no celular. Cada etapa é isolada: fonte do governo fora do ar mantém o dado anterior em vez de derrubar tudo. Desenho completo em [`docs/arquitetura-dados.md`](docs/arquitetura-dados.md).
2. **APIs públicas consultadas direto do app** (Câmara, Senado, TSE) — só como recuo para o que a API estática ainda não tem (parlamentar recém-empossado, votação fora da coleção, detalhe de proposição, candidaturas). O mapeamento das respostas fica em `packages/sources`, compartilhado com o pipeline.
3. **Backend de verdade** — não existe ainda. Entra só quando chegarem push e contas de usuário.

O feed da home (`feed.json`) junta quatro tipos de evento: **pauta** (sessões e reuniões deliberativas marcadas nas duas casas), **votação** (nominais com placar e simbólicas relevantes de plenário), **tramitação** (marcos raros: aprovada na Câmara, enviada à sanção, aguardando promulgação, virou lei, vetada) e **norma** (leis, MPs e decretos numerados publicados no DOU). Dois workflows escrevem: `pipeline` (ETL completo, diário) e `agenda` (leve, a cada 3h em dia útil — recomputa só o "em pauta").

## Estrutura

```
apps/mobile        app Expo (React Native, expo-router)
packages/data      schemas zod e tipos compartilhados
packages/sources   clientes das APIs da Câmara e do Senado (app e pipeline)
packages/pipeline  ETL que gera os JSONs estáticos
```

## Rodando

```bash
pnpm install
```

App (precisa de Node 22):

```bash
pnpm dev:mobile
```

Pipeline de dados:

```bash
pnpm pipeline
```

Verificações:

```bash
pnpm check-types && pnpm test
```

## Fontes de dados

| Fonte | O que traz | Autenticação |
| --- | --- | --- |
| [Câmara dos Deputados](https://dadosabertos.camara.leg.br/) | Deputados, votações, proposições | Nenhuma |
| [Cota parlamentar (Câmara)](https://www.camara.leg.br/cotas/) | CSV anual com todos os lançamentos | Nenhuma |
| [Senado Federal](https://legis.senado.leg.br/dadosabertos/) | Senadores, votações com votos individuais | Nenhuma |
| [CEAPS (Senado)](https://www.senado.leg.br/transparencia/LAI/verba/) | CSV anual de despesas dos senadores | Nenhuma |
| [DivulgaCandContas (TSE)](https://divulgacandcontas.tse.jus.br/) | Candidaturas 2026, bens declarados | Nenhuma |
| [Portal da Transparência](https://portaldatransparencia.gov.br/api-de-dados) | Emendas parlamentares | Chave pessoal, só no pipeline |
| [Folha da Câmara](https://www2.camara.leg.br/transparencia/recursos-humanos/remuneracao/relatorios-consolidados-por-ano-e-mes) | CSV mensal com o contracheque dos parlamentares | Nenhuma |
| [Moradia (Câmara)](https://www.camara.leg.br/moradia) | Imóvel funcional e auxílio-moradia por deputado | Nenhuma (só HTML) |
| [Dados abertos administrativos do Senado](https://adm.senado.gov.br/adm-dadosabertos/swagger-ui/index.html) | Benefícios e pessoal de gabinete por senador | Nenhuma |
| [Eventos e pautas (Câmara)](https://dadosabertos.camara.leg.br/swagger/api.html) | Sessões e reuniões deliberativas marcadas, com pauta | Nenhuma |
| [Agenda do Senado](https://legis.senado.leg.br/dadosabertos/docs/) | Sessões de plenário e reuniões de comissão marcadas | Nenhuma |
| [Diário Oficial da União](https://www.in.gov.br/leiturajornal) | Leis sancionadas, MPs e decretos publicados | Nenhuma (JSON embutido na página) |
| [Arquivos em lote da Câmara](https://dadosabertos.camara.leg.br/swagger/api.html#staticfile) | Autorias e situação de todas as proposições por ano | Nenhuma |
| [Perfil do deputado (Câmara)](https://www.camara.leg.br/deputados/quem-sao) | Frequência oficial em plenário e comissões, com ausências justificadas | Nenhuma (só HTML) |
| [Histórico, licenças e processos (Câmara e Senado)](https://legis.senado.leg.br/dadosabertos/docs/) | Trocas de partido, afastamentos, suplentes e autorias | Nenhuma |
| [Repositório de dados eleitorais (TSE)](https://dadosabertos.tse.jus.br/) | Candidaturas, bens e votos por município de 2018, 2022 e 2026 | Nenhuma |

### Armadilhas conhecidas destas APIs

Coisas que custaram tempo para descobrir e que o código já contorna:

- **`/deputados/{id}/despesas` retorna vazio** para todos os anos testados. Use o CSV em lote de `camara.leg.br/cotas/Ano-{ano}.csv.zip`.
- **`/votacoes` da Câmara aceita no máximo 3 meses** entre `dataInicio` e `dataFim`. O pipeline fatia o ano em janelas mensais.
- **`/votacoes` não aceita `siglaOrgao`** (HTTP 400, `code: 5`) nem qualquer filtro por tipo de votação: só dá para filtrar plenário depois de baixar tudo. O teto é de **100 itens por página**, e cada página leva de 3 a 10 segundos — o app busca as páginas em paralelo.
- **A listagem não diz se a votação foi nominal**, e descobrir isso votação a votação custaria centenas de requisições. Só as nominais trazem o placar escrito na descrição (`"Sim: 134; Não: 285; Abstenção: 2; Total: 421."`) — essa marca é o que separa nominal de simbólica, e de quebra dá o placar sem requisição extra (`placarDaDescricao`, em `packages/data`).
- **Votação nominal de plenário é rara**: numa janela de 90 dias de 2026 havia 600 votações, 130 de plenário e **só 6 com voto individual**. Feed com janela curta fica vazio; sem o filtro, fica cheio de votação de comissão sem voto nominal.
- **Das 6.475 votações da Câmara em 2026, só 1.168 são de plenário.** As de comissão raramente têm voto nominal — filtrar por `siglaOrgao=PLEN` corta 82% das requisições.
- **`/votacoes/{id}/votos` rejeita o parâmetro `itens`** com HTTP 400 (`code: 5`). Chame sem nenhum parâmetro de paginação.
- **Das 1.168 votações de plenário, só 115 têm voto nominal individual.** O resto é votação simbólica, que não registra voto por parlamentar; outras 19 devolvem 404 no recurso de votos. Resposta vazia aqui é normal, não é erro.
- **A API da Câmara limita a taxa** no endpoint de votos. Concorrência 3 com backoff exponencial passa; 6 gera 429 esporádicos.
- **O CEAPS do Senado é Latin-1** e a **primeira linha é metadado**, não cabeçalho. Além disso identifica o senador por **nome**, não por código — o join é por nome normalizado (sem acento, maiúsculas).
- **O endpoint legado de votações do Senado foi desativado** em 01/02/2026. O atual é `/dadosabertos/votacao`, cuja resposta é um **array na raiz**, com os votos já embutidos em `votos[]`.
- **`siglaVotoParlamentar` do Senado não é um enum limpo**: mistura `Sim`/`Não`/`Abstenção` com `AP`, `P-NRV`, `MIS`, `LS`, `LAP`, `LP` e `Presidente (art. 51 RISF)`. Em votação secreta vira `Votou`.
- **`totalVotosSim/Nao/Abstencao` do Senado vêm `null`.** Conte a partir de `votos[]`.
- **DivulgaCandContas não é documentado** e muda a cada ciclo eleitoral. Está isolado em `services/api/tse.ts` justamente por isso.
- **`gastoCampanha1T`/`gastoCampanha2T` do DivulgaCandContas NÃO são o gasto do candidato** — são o **limite de gastos** do cargo na UF, idêntico para todos da disputa (conferido: dois candidatos da mesma disputa retornam o mesmo valor, e cargos diferentes retornam valores diferentes). O gasto real fica no endpoint de prestação de contas, que é outro recurso.
- **O JSON de execução orçamentária do Senado** (`senado.gov.br/bi-arqs/Arquimedes/Financeiro/DespesaSenadoDadosAbertos.json`) vem embrulhado em `{ despesas: [...] }`, com valores como string em vírgula decimal e a chave do ano acentuada (`exercício_financeiro_lan_ef`).
- **A folha de pagamento da Câmara é anonimizada**: cada linha é "Deputado 8158", sem nome. Não existe contracheque nominal de parlamentar em lugar nenhum — nem na Câmara, nem no Senado. O que dá para extrair é o contracheque do *cargo*, que serve porque o subsídio é idêntico para os 594.
- **O cabeçalho dessa folha traz `Constribuição Previdenciária`**, com o typo. As colunas são casadas por trecho do nome, não por igualdade.
- **Moradia dos deputados só existe como HTML paginado** em `camara.leg.br/moradia/detalhamento`, 20 por página, identificado por `Nome (PARTIDO-UF)` — sem id. É a única raspagem do projeto, e vive no pipeline justamente para o app não depender dela.
- **O filtro `cargo=ministro` dessa página está quebrado no próprio portal** (o site monta a URL e cai na página de erro dele mesmo). Consequência: deputados licenciados para ministério (6 em agosto/2026) ficam sem dado de moradia, e não há o que fazer do nosso lado.
- **O slug do CSV mensal da folha não distingue formato**: o CSV de fevereiro/2026 é `fevereiro-de-2026-1` e o PDF é `fevereiro-de-2026`. Quem diz o formato é o **texto** da âncora ("CSV"/"PDF") — o pipeline casa por texto do link e, se o arquivo não parsear, recua para o mês anterior.
- **O Senado tem uma segunda API, administrativa**, em `adm.senado.gov.br/adm-dadosabertos`, separada da legislativa. `/senadores/{cod}/recursos-utilizados?ano=` devolve cota, benefícios e pessoal de gabinete numa chamada só, indexado por código — sem join por nome.
- **`/proposicoes` da Câmara ignora `codSituacao` quando `dataInicio`/`dataFim` estão presentes** — devolve tudo que tramitou na janela, em qualquer situação. O corte por marco ("enviada à sanção", "virou lei") só dá para fazer no detalhe, proposição a proposição.
- **Na votação simbólica da Câmara, `proposicaoObjeto` costuma vir nulo.** O que foi votado só aparece na descrição ("Aprovado o Projeto de Lei nº X, de Y") — o filtro do feed casa com esse texto.
- **"SESSÃO NÃO DELIBERATIVA" contém "DELIBERATIVA".** Qualquer filtro por substring na agenda do Senado precisa negar o "NÃO" primeiro. O mesmo cuidado vale para os eventos da Câmara.
- **As datas da agenda do Senado vão em `AAAAMMDD`** (não ISO), e o endpoint mensal do plenário devolve da data informada **até o fim do mês** — janela que vira o mês exige segunda chamada. O JSON é XML convertido: qualquer lista pode vir como objeto único, e reunião futura de comissão vem sem `partes`.
- **A pauta da Câmara repete a mesma proposição** em regimes e turnos diferentes — o pipeline deduplica por sigla.
- **O DOU não tem API pública sem cadastro** (o INLABS exige conta). A página `in.gov.br/leiturajornal` embute o sumário do dia num JSON (`jsonArray`) — há mais de uma ocorrência na página e a primeira é um placeholder vazio. Dia sem edição vem vazio, não é erro. "DECRETO DE 12 DE AGOSTO" sem número é ato de pessoal (nomeações); só decreto numerado interessa.
- **O servidor de arquivos em lote da Câmara derruba a conexão por volta dos 17 s**, antes de terminar os CSVs de dezenas de MB, e às vezes entrega 300 KB/s. Ele aceita `Range` com ETag forte: o download retoma de onde parou (`baixarRetomando`) e só desiste depois de várias tentativas seguidas sem nenhum byte novo.
- **Desde 2026 o CSV da cota não traz os bilhetes emitidos pelo SIGEPA** (a maioria das passagens) — passageiro e trecho só aparecem nos reembolsos. Por isso o app não tem resumo de viagens.
- **A maioria das nominais do Senado é secreta** (38 de 46 entre março e junho de 2026), e nelas todo voto vem como `Votou`. Conta como presença, mas fica fora de coesão, alinhamento e afinidade, que precisam do lado.
- **`/senador/{id}/autorias` está marcado para desativação.** O substituto é `/dadosabertos/processo?codigoParlamentarAutor={id}`, que devolve tudo o que o senador assinou, de qualquer ano, com o primeiro signatário à frente em `autoria`.
- **Os CSVs do TSE misturam campo com e sem aspas** (`"AC";7;"DEPUTADO"`) e não escapam aspas internas (`"SANT"ANA"`). O parser fecha um campo entre aspas só na aspa seguida de `;` ou fim de linha.
- **O zip de votos por município do TSE tem 450–650 MB** e um consolidado `_BRASIL` zip64 de vários GB que repete as UFs. O pipeline lê o diretório central e baixa por `Range` só os CSVs por UF. As chaves guardadas no mapa de votos são cópias: no V8 uma fatia de string segura a string inteira de onde saiu, e cada município prenderia um pedaço descomprimido de dezenas de KB — com 500 candidaturas isso passa de 4 GB.
- **CPF dos candidatos de 2026 vem preenchido no TSE** e o da Câmara está no CSV da cota (`cpf`): é a chave de vínculo dos deputados. O Senado não publica CPF, então senadores são ligados por nome civil + UF. O CPF nunca é publicado.
- **O STF não publica pauta de julgamentos machine-readable.** O portal inteiro fica atrás de WAF que responde 403 a user-agent que não é de navegador, e o Corte Aberta é dashboard Power BI. Por isso o feed não tem STF — raspagem contra WAF quebraria a qualquer momento.

## Métricas: o que os números significam

- **Cota parlamentar** é o total reembolsado no ano, sempre comparado à mediana da casa — nunca apresentado sozinho.
- **Participação em votações** conta apenas votações **nominais de plenário**, em que o voto de cada parlamentar fica registrado. **Não é presença em sessões** — a Câmara não expõe isso de forma direta, e chamar de "presença" seria impreciso.
- **Presença oficial** é a que a Câmara publica no perfil do deputado: dias de sessão deliberativa em plenário e reuniões de comissão, com ausência justificada separada. Conta sessões sem votação nominal, por isso difere da participação. O Senado não publica equivalente.
- **Com quem vota** compara só votos sim/não nas nominais de plenário em que os dois votaram, com piso de votações em comum para não ranquear suplente que votou duas vezes.
- **Redutos** são os municípios que, do mais votado para o menos, somam metade dos votos do parlamentar na eleição do mandato. Se as emendas seguissem os votos, metade iria para eles; o app mostra quanto de fato vai.
- **Subsídio é o salário do cargo, não da pessoa**: os 513 deputados e os 81 senadores recebem exatamente o mesmo bruto, que é o teto do funcionalismo federal. O que varia por pessoa é moradia, gabinete e cota. O líquido exibido é o contracheque **mais repetido** do mês, sempre acompanhado de quantos parlamentares receberam aquele valor — os descontos mudam com dependentes e regime de previdência.
- **Subsídio de governador não tem fonte nacional.** Cada estado fixa o seu por lei da assembleia. A tabela em `packages/data/src/remuneracao.ts` é um levantamento jornalístico datado, exibido como tal no app; o dado oficial é a lei estadual.

## Licença

MIT.
