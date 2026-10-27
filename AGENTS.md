# Politicapp — regras para agentes

## Fase do projeto: ainda não está em produção

Nada do Politicapp foi lançado: não há usuários, aparelhos com dados salvos, nem consumidores externos dos JSONs publicados. Por isso:

- **Não escreva migrações nem compatibilidade retroativa.** Nada de `version`/`migrate` em stores persistidos, leitura de chaves antigas do MMKV, fallback para formato antigo de JSON, aliases de nomes renomeados ou campos "deprecated".
- Pode renomear livremente chaves de armazenamento, chaves de cache do React Query, tags do Sentry, campos de JSON e caminhos de arquivo — atualize quem usa e apague o antigo.
- Quebrar o cache local de quem está desenvolvendo é aceitável (reinstale o app ou limpe os dados).

Quando o app for publicado, esta seção deve ser removida e substituída pela política de compatibilidade.

## Testes: só para dados externos

Testes automatizados existem para uma coisa: garantir que os dados das fontes oficiais (APIs da Câmara, Senado, TSE, Portal da Transparência, DOU, CSVs e arquivos baixados) são lidos, normalizados e agregados do jeito que o app espera. Em qualquer outro caso, não crie arquivo de teste.

**Pode testar:**

- `packages/pipeline/src/sources/`: parsing e normalização de cada fonte (nomes, acentos, códigos de voto, datas no formato da fonte, campos ausentes ou nulos).
- `packages/pipeline/src/tasks/`, `schemas.ts`, `validacao.ts`, `csv.ts`: transformações e agregações que geram os JSONs publicados, e o contrato desses JSONs.
- `packages/data/`: cálculos sobre esses dados que o app exibe (percentis, placar, orientação de bancada).
- `apps/mobile/services/api/`: só onde o app transforma a resposta crua de uma API (ex.: `tse.ts` mapeando candidatos, bens, situação). Wrapper de `fetch` e query keys, não.

**Não teste:** hooks, componentes, telas, navegação, stores, React Query, wrappers de `fetch`/HTTP, formatters e utils de exibição, layout de gráfico, configuração, e qualquer coisa que o TypeScript já garante. Nada de snapshot nem de teste que só repete a implementação.

**Como escrever:**

- A entrada é uma resposta real da fonte, salva em `__fixtures__/` (recortada ao mínimo), e o teste verifica a saída esperada. Não mocke a lógica que está sendo testada.
- Bug de dado (campo que mudou, valor que veio diferente, caso que a fonte passou a mandar) entra como novo caso com fixture, junto com a correção.
- Não escreva teste só para aumentar cobertura. Se não sabe dizer qual dado errado o teste impediria de chegar ao app, não escreva.
- Para validar UI ou comportamento do app, rode o app (simulador/navegador) e confira. Não escreva teste para isso.

## Mais regras

- App mobile: `apps/mobile/AGENTS.md` (componentes, estilo, convenção de nomes).
