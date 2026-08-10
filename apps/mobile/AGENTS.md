

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
| Cartão de conteúdo (gastos, participação, contato…) | `Surface variant="secondary"` com `className="gap-… p-4"` — padrão do app inteiro | `Card` (só se precisar das seções estruturadas de mídia dele), `View` com borda manual |
| Botão de ação | `Button` (`size="sm"` é o padrão do app) | `Pressable` cru para algo que parece botão |
| Botão só de ícone (voltar, fechar) | `Button size="sm" variant="ghost" isIconOnly` + `Icon` | `CloseButton` avulso (mantenha o padrão existente) |
| Cartão inteiro clicável que navega | `Pressable` envolvendo `Surface` (ver `cartao-votacao.tsx`) | `Button` esticado |
| Filtro/toggle em linha horizontal | `Chip size="sm"` com `variant={ativo ? "primary" : "secondary"}` dentro de `ScrollView horizontal` — padrão consolidado | `Tabs` (reservado para trocar seções inteiras de tela) |
| Rótulo de status (Aprovada/Rejeitada, situação de candidatura) | `Chip size="sm" color="success" / "danger"` | Texto colorido solto |
| Busca para filtrar lista | `TextField` > `Input` com `autoCorrect={false}` (padrão atual; `SearchField` só se a tela nova pedir o compound completo) | Input sem `TextField` |
| Lista longa (parlamentares, votos, candidatos) | `FlashList` com `keyExtractor` estável (`casa:id`) | `ListGroup`, `ScrollView` com `.map()` |
| Lista curta de linhas rótulo→valor | `View` com linhas `flex-row justify-between` (ver `Detalhe` em `parlamentar/[casa]/[id].tsx`) | Tabela improvisada |
| Carregando tela inteira | `<Carregando rotulo="…" />` de `components/estados.tsx` | `Spinner` solto, `ActivityIndicator` |
| Placeholder de conteúdo com layout conhecido | `Skeleton`/`SkeletonGroup` | Tela em branco |
| Erro com retry / estado vazio | `<EstadoDeErro />` / `<EstadoVazio />` de `components/estados.tsx` — sempre com descrição em linguagem simples | `Alert` do HeroUI, `alert()` |
| Confirmação destrutiva (ex.: deixar de seguir tudo) | `Dialog` | `BottomSheet` |
| Picker/ação contextual com várias opções | `BottomSheet` (@gorhom, já configurado) | `Dialog` com lista |
| Feedback transitório ("Seguindo Fulano") | `Toast` | `Dialog`, banner permanente |
| Avatar de parlamentar/candidato | `AvatarParlamentar` (fallback de iniciais embutido) | `Avatar` cru do HeroUI |
| Placar de votação | `PlacarVotacao` | Barra manual |
| Número comparado à mediana | `Comparativo` (nunca número seco — princípio do produto) | Valor isolado |
| Ícone | `Icon` de `components/icon.tsx` (Ionicons) | Importar `@expo/vector-icons` direto na tela |

## Estilo e tema

- **Texto**: `Text` do React Native com classes Tailwind (`text-foreground`, `text-muted-foreground`, `text-sm`…). Título de destaque numérico ou de página: `font-title` (Bricolage Grotesque). O `Text` do HeroUI não é usado neste app.
- **Cores**: nunca hex hardcoded em componente. Use classes semânticas do tema ou `useColors()` quando precisar de valor em `style`. Cor de partido só via `corDoPartido()`.
- **Espaçamento**: `gap-*` no container em vez de margens nos filhos; telas com `SafeAreaView className="flex-1 bg-background" edges={["top"]}`.
- **Semáforo de métricas**: verde/amarelo/vermelho sempre derivado da distribuição da casa (`nivelNaDistribuicao`, p25/mediana/p75) — nunca thresholds mágicos.

## Conteúdo e acessibilidade

- Strings de UI em pt-BR, tom direto e sem jargão burocrático; números sempre pelos `utils/formatters.ts` e datas pelos `utils/date-utils.ts`.
- Todo dado exibido deve poder linkar a fonte oficial (princípio do produto).
- Gráfico ou barra sem texto visível equivalente precisa de `accessibilityLabel` com os valores; barras de progresso usam `accessibilityRole="progressbar"` + `accessibilityValue`.
