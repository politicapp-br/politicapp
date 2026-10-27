

<!-- HEROUI-NATIVE-AGENTS-MD-START -->
[HeroUI Native Docs Index]|root: ./.heroui-docs/native|STOP. What you remember about HeroUI Native is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: heroui agents-md --native --output AGENTS.md|components/(buttons):{button.mdx,close-button.mdx,link-button.mdx}|components/(collections):{menu.mdx,tag-group.mdx}|components/(controls):{slider.mdx,switch.mdx}|components/(data-display):{chip.mdx}|components/(feedback):{alert.mdx,skeleton-group.mdx,skeleton.mdx,spinner.mdx}|components/(forms):{checkbox.mdx,control-field.mdx,description.mdx,field-error.mdx,input-group.mdx,input-otp.mdx,input.mdx,label.mdx,radio-group.mdx,search-field.mdx,select.mdx,text-area.mdx,text-field.mdx}|components/(layout):{card.mdx,separator.mdx,surface.mdx}|components/(media):{avatar.mdx}|components/(navigation):{accordion.mdx,list-group.mdx,tabs.mdx}|components/(overlays):{bottom-sheet.mdx,dialog.mdx,popover.mdx,toast.mdx}|components/(typography):{text.mdx}|components/(utilities):{pressable-feedback.mdx,scroll-shadow.mdx}|getting-started/(handbook):{animation.mdx,colors.mdx,composition.mdx,portal.mdx,provider.mdx,styling.mdx,theming.mdx}|getting-started/(overview):{design-principles.mdx,quick-start.mdx}|getting-started/(ui-for-agents):{agent-skills.mdx,agents-md.mdx,llms-txt.mdx,mcp-server.mdx}|releases:{beta-10.mdx,beta-11.mdx,beta-12.mdx,beta-13.mdx,cli-v1-0-0.mdx,rc-1.mdx,rc-2.mdx,rc-3.mdx,rc-4.mdx,v1-0-0.mdx,v1-0-1.mdx,v1-0-2.mdx,v1-0-3.mdx,v1-0-4.mdx,v1-0-5.mdx,v1-0-6.mdx,v1-0-7.mdx,v1-0-8.mdx}
<!-- HEROUI-NATIVE-AGENTS-MD-END -->

# Diretrizes de estilo — qual componente usar e quando

Regras para agentes trabalhando na UI do Politicapp. Complementam o índice HeroUI Native acima: antes de usar um componente da biblioteca, leia o doc correspondente em `.heroui-docs/native/`. Em conflito entre estas regras e o doc genérico, estas regras vencem.

## Princípio geral

Siga a hierarquia semântica do HeroUI (intenção, não aparência): `primary` para a ação principal da tela (no máximo uma), `secondary` para ações de apoio, `ghost`/`tertiary` para ações discretas (ex.: botão de voltar com ícone). Nunca escolha variante "porque fica bonito".

## Tabela de decisão

| Preciso de… | Use | Não use |
| --- | --- | --- |
| Container de tela | `Screen` de `components/screen.tsx` (SafeAreaView + `bg-background` embutidos) | `SafeAreaView className="flex-1 bg-background"` manual |
| Barra de topo com voltar (telas fora das tabs) | `Screen.TopBar` — `title` opcional, `trailing` para ação (ex.: botão Seguir), `showBack={false}` para esconder | Linha manual com `Button isIconOnly` + chevron |
| Conteúdo rolável de tela | `Screen.Scroll` (gap-6 px-4 + padding inferior por inset); `contentClassName` para ajustar | `ScrollView` com `contentContainerClassName` manual |
| Cartão de conteúdo (gastos, participação, contato…) | `Card` de `components/card.tsx` — `title`, `description`, `meta` (texto discreto à direita do título) | `Surface` manual com header repetido, `Card` (só se precisar das seções de mídia dele) |
| Número grande de destaque num cartão (R$, %) | `Card.Highlight` — `value`, `context`, `color` para semáforo | `Text font-title text-3xl` solto |
| Cabeçalho de seção fora de cartão | `Section` de `components/section.tsx` (`title` + `description` + children) | Par de `Text` repetido em cada tela |
| Linha rótulo→valor | `DetailRow` de `components/detail-row.tsx` (retorna `null` sem valor; `emphasized` para negrito) | `View flex-row justify-between` copiada localmente |
| Link para a fonte oficial do dado | `SourceLink` de `components/source-link.tsx` (ou `openUrl` de `utils/links.ts`) | `Pressable` + `WebBrowser.openBrowserAsync` inline |
| Botão de ação | `Button` (`size="sm"` é o padrão do app) | `Pressable` cru para algo que parece botão |
| Botão só de ícone (fechar etc.) | `Button size="sm" variant="ghost" isIconOnly` + `Icon` | `CloseButton` avulso (mantenha o padrão existente) |
| Cartão inteiro clicável que navega | `Pressable` envolvendo `Surface` (ver `features/feed/votacao-card.tsx`) | `Button` esticado |
| Filtro/toggle em linha horizontal | `Chip size="sm"` com `variant={ativo ? "primary" : "secondary"}` dentro de `ScrollView horizontal` — padrão consolidado | `Tabs` (reservado para trocar seções inteiras de tela) |
| Rótulo de status (Aprovada/Rejeitada, situação de candidatura) | `Chip size="sm" color="success" / "danger"` | Texto colorido solto |
| Busca para filtrar lista | `TextField` > `Input` com `autoCorrect={false}` (padrão atual; `SearchField` só se a tela nova pedir o compound completo) | Input sem `TextField` |
| Lista longa (parlamentares, votos, candidatos) | `FlashList` com `keyExtractor` estável (`casa:id`) | `ListGroup`, `ScrollView` com `.map()` |
| Lista curta de linhas rótulo→valor | `DetailRow` empilhadas num `Card` (ver `features/parlamentar/compensation.tsx`) | Tabela improvisada |
| Carregando tela inteira | `<LoadingState label="…" />` de `components/states.tsx` | `Spinner` solto, `ActivityIndicator` |
| Placeholder de conteúdo com layout conhecido | `Skeleton`/`SkeletonGroup` | Tela em branco |
| Erro com retry / estado vazio | `<ErrorState />` / `<EmptyState />` de `components/states.tsx` — sempre com descrição em linguagem simples | `Alert` do HeroUI, `alert()` |
| Confirmação destrutiva (ex.: deixar de seguir tudo) | `Dialog` | `BottomSheet` |
| Picker/ação contextual com várias opções | `BottomSheet` (@gorhom, já configurado) | `Dialog` com lista |
| Feedback transitório ("Seguindo Fulano") | `Toast` | `Dialog`, banner permanente |
| Avatar de parlamentar/candidato | `ParlamentarAvatar` (fallback de iniciais embutido) | `Avatar` cru do HeroUI |
| Placar de votação | `VoteTally` | Barra manual |
| Número comparado à mediana | `MedianComparison` (nunca número seco — princípio do produto) | Valor isolado |
| Ícone | `Icon` de `components/icon.tsx` (Ionicons) | Importar `@expo/vector-icons` direto na tela |
| Ícone da tab bar | `NativeTabs.Trigger.Icon` com `sf` (SF Symbols) + `md` (Material Symbols) em `app/(tabs)/_layout.tsx` — única exceção ao Ionicons, porque a barra é nativa | `Icon` do app dentro da `NativeTabs` |

## Estilo e tema

- **Texto**: `Text` do React Native com classes Tailwind (`text-foreground`, `text-muted-foreground`, `text-sm`…). Título de destaque numérico ou de página: `font-title` (Bricolage Grotesque). O `Text` do HeroUI não é usado neste app.
- **Cores**: nunca hex hardcoded em componente. Use classes semânticas do tema ou `useColors()` quando precisar de valor em `style`. Cor de partido só via `getPartyColor()`.
- **Espaçamento**: `gap-*` no container em vez de margens nos filhos, sempre na grade 4pt (`gap-1/2/3/4/6`): `gap-1` título→subtítulo, `gap-2` linhas relacionadas, `gap-3` padrão interno de cartão, `gap-4` blocos dentro de cartão, `gap-6` entre seções da tela. Telas começam com `Screen` (nunca `SafeAreaView` manual); a referência de aplicação completa é `app/parlamentar/[casa]/[id].tsx` + `features/parlamentar/` e `app/salarios.tsx`. Navegação via `routes` de `utils/routes.ts`, nunca caminho interpolado à mão.
- **Tipografia**: hierarquia fixa — título de página `font-title text-3xl` (`PageHeader`), título de topo compacto `font-title text-xl` (`Screen.TopBar`), seção `text-lg font-semibold`, título de cartão `text-base font-semibold` (`Card`), corpo `text-sm`, apoio `text-xs text-muted-foreground`. Não invente tamanhos intermediários.
- **Semáforo de métricas**: verde/amarelo/vermelho sempre derivado da distribuição da casa (`useMetricColors` de `hooks/use-metric-colors.ts`, sobre p25/mediana/p75) — nunca thresholds mágicos.

## Conteúdo e acessibilidade

- Strings de UI em pt-BR, tom direto e sem jargão burocrático; números sempre pelos `utils/formatters.ts` e datas pelos `utils/date-utils.ts`.
- Todo dado exibido deve poder linkar a fonte oficial (princípio do produto).
- Gráfico ou barra sem texto visível equivalente precisa de `accessibilityLabel` com os valores; barras de progresso usam `accessibilityRole="progressbar"` + `accessibilityValue`.

## Nomes no código

Identificadores em inglês (variáveis, funções, componentes, props, arquivos). Ficam em português só os termos do domínio político sem tradução clara — `Parlamentar`, `Deputado`, `Senador`, `Casa`, `Votacao`, `Proposicao`, `Tramitacao`, `Pauta`, `Emenda`, `Frente`, `Bancada`, `Orientacao`, `Cota`, `UF` — e o que espelha fonte externa: campos dos tipos de `@politicapp/data` e schemas das APIs oficiais. Caminhos de rota em `app/` são URLs em pt-BR do produto. Textos de interface e comentários seguem em pt-BR.

## Testes

No app, a única coisa que pode ter teste é a transformação de resposta crua de API em `services/api/` (ex.: `tse.ts`), feita com fixture real. Nada de teste para hooks, componentes, telas, formatters, utils ou layout de gráfico. A regra completa está no `AGENTS.md` da raiz. Para verificar a UI, rode o app.

## Fase do projeto: sem usuários em produção

O app ainda não foi publicado. Não escreva migração, versão de store, fallback de formato antigo nem shim de compatibilidade: renomeie chaves do MMKV, campos persistidos do zustand, chaves de query, tags do Sentry ou formatos de JSON à vontade e apague o código antigo. Ver `AGENTS.md` na raiz.

## Testes E2E e dispositivos

Emuladores/simuladores para teste (vários em paralelo, Maestro): sempre via `e2e/devices.sh` — ver `e2e/README.md`. Nunca suba device de teste com `expo run:*`/`emulator` direto.
