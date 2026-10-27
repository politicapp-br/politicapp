# Gráficos

Recriação local dos componentes de gráfico do HeroUI Native Pro, construída
sobre os mesmos blocos que eles usam: `victory-native` (dados/gestos) +
`@shopify/react-native-skia` (renderização). API espelha a deles, com tema
integrado ao uniwind do app.

Uma vitrine completa está em [app/graficos.tsx](../../app/graficos.tsx)
(Ajustes → Desenvolvimento → Vitrine de gráficos).

## Componentes

| Componente | Subcomponentes | Uso |
| --- | --- | --- |
| `LineChart` | `.Line`, `.AnimatedLine` (alias) | Séries temporais; traçado progressivo na entrada |
| `AreaChart` | `.Area` (com `gradient`), `.StackedArea` | Tendências com preenchimento |
| `BarChart` | `.Bar`, `.Group` + `.GroupItem`, `.Stacked`, `.Highlight` | Comparação categórica; `Highlight` destaca a barra tocada |
| `DonutChart` | — | Composição em anel (Skia próprio); toque com destaque, haptic e expiração embutidos |
| `ProgressBar` | — | Percentual único (0–100) com preenchimento animado |
| `ChartIndicator` | — | Ponto que segue o toque (dentro do canvas) |
| `ChartCrosshair` | `.Anchor`, `.Value` | Régua vertical + rótulo flutuante fora do canvas |
| `ChartLegend` | — | Legenda bolinha + rótulo |

## Animação de entrada

Todos os gráficos entram animados por padrão, respeitando a preferência de
movimento reduzido do sistema:

- `LineChart.Line`: traçado progressivo (timing 700 ms).
- `AreaChart.Area`: revelação esquerda→direita quando recebe `chartBounds`
  (sincroniza com a linha); sem eles, fade. `StackedArea` faz fade.
- `BarChart.*`: barras crescem a partir da base (timing 600 ms, sem quique).
- `DonutChart`: varredura progressiva a partir das 12h (timing 800 ms).
- `Hemicycle`: fade + leve subida do conjunto.
- `ProgressBar`: preenchimento até o valor (timing 700 ms).

Nas séries cartesianas e na `DonutChart` a prop `entering` aceita uma config
(`{ type: "timing" | "spring", ... }`) ou `false` para desligar, e `resetKey`
repete a animação quando muda. A vitrine tem um botão "Repetir" em cada cartão
para conferir as entradas uma a uma.

## Cores

Paleta categórica de 5 cores (`useChartColors().series`), validada para
daltonismo e contraste nos dois temas. Componentes aceitam tokens
(`color="chart-1"`..`"chart-5"`) ou qualquer cor literal. As classes
`bg-chart-1` etc. também existem no CSS.

No tema claro, as cores 3–5 têm contraste < 3:1 sobre fundo branco — use
`ChartLegend` ou rótulos diretos nesses casos (regra geral do kit: gráfico com
2+ séries sempre leva legenda).

## Interação (toque)

```tsx
const { state, isActive } = useChartPressState({ x: "", y: { value: 0 } })
const label = useDerivedValue(() => `${state.y.value.value.get()}`)

<ChartCrosshair.Anchor x={state.x.position} isActive={state.isActive} chartBounds={bounds} className="pt-8">
  <LineChart data={data} xKey="month" yKeys={["value"]} chartPressState={state} onChartBoundsChange={setBounds}>
    {({ points, chartBounds }) => (
      <>
        <LineChart.Line points={points.value} curveType="monotoneX" />
        {isActive ? (
          <>
            <ChartCrosshair x={state.x.position} top={chartBounds.top} bottom={chartBounds.bottom} />
            <ChartIndicator x={state.x.position} y={state.y.value.position} />
          </>
        ) : null}
      </>
    )}
  </LineChart>
  <ChartCrosshair.Value value={label} />
</ChartCrosshair.Anchor>
```

## Barras com toque (destaque + popup)

Padrão para inspecionar valores barra a barra: um tap seleciona a barra mais
próxima e mantém a seleção visível por ~2,5 s (arrastar também funciona, como
scrub). Com a seleção ativa a série esmaece, a barra escolhida ganha um
`BarChart.Highlight` em cor cheia e o valor aparece num `ChartCrosshair.Value`.

O tap vem do `useChartTap` — o gesto de arrastar do victory-native só ativa
com o dedo pousado ~100 ms, então taps rápidos não fazem nada sem ele. O hook
também dispara o haptic de seleção. Textos exibidos no popup devem ser
pré-formatados por índice (worklets não têm `Intl`) e lidos via
`state.matchedIndex`. Exemplo completo em
[features/parlamentar/expenses.tsx](../../features/parlamentar/expenses.tsx).

```tsx
const { state, isActive } = useChartPressState({ x: "", y: { value: 0 } })
const tap = useChartTap(state)
const captions = data.map((d) => `${d.label} · ${format(d.value)}`)
const label = useDerivedValue(() => captions[state.matchedIndex.get()] ?? "")
const dimmed = useDerivedValue(() =>
  withTiming(state.isActive.get() ? 0.35 : 1, { duration: 160 }),
)

<ChartCrosshair.Anchor x={state.x.position} isActive={state.isActive} chartBounds={bounds} className="pt-8">
  <BarChart
    data={data}
    xKey="label"
    yKeys={["value"]}
    chartPressState={state}
    customGestures={tap.gesture}
    actionsRef={tap.actionsRef}
    onChartBoundsChange={setBounds}
    domain={{ y: [0] }}
  >
    {({ points, chartBounds }) => (
      <>
        <BarChart.Bar points={points.value} chartBounds={chartBounds} opacity={dimmed} />
        {isActive ? (
          <BarChart.Highlight
            x={state.x.position}
            y={state.y.value.position}
            chartBounds={chartBounds}
            points={points.value}
          />
        ) : null}
      </>
    )}
  </BarChart>
  <ChartCrosshair.Value value={label} />
</ChartCrosshair.Anchor>
```

`Highlight` precisa dos mesmos `innerPadding`/`barWidth`/`barCount` da série
base para casar a largura da barra.

## DonutChart com toque

A `DonutChart` é Skia puro (sem victory-native): cada fatia é um arco traçado no
raio médio, com vão angular entre elas (o fundo do cartão aparece no vão). O
toque inteiro roda na thread de UI — a seleção acontece já no
toque-para-baixo, com haptic e expiração automática (2,5 s), e tocar fora do
anel desfaz; o esmaecimento das outras fatias é um shared value ligado direto
à opacidade dos Paths, sem re-render. O único salto para o JS é o
`onSelectionChange`, chamado uma vez por mudança — use-o para o rótulo central
numa View absoluta.

```tsx
const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
const selected = selectedIndex != null ? data[selectedIndex] : null

<View>
  <DonutChart
    slices={data.map((d) => ({ value: d.value, color: d.color }))}
    onSelectionChange={setSelectedIndex}
  />
  {selected ? (
    <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
      <Text>{selected.value}</Text>
    </View>
  ) : null}
</View>
```

## Composição livre

Os subcomponentes são primitivas Skia dentro do mesmo canvas: misture
`LineChart.Line`, `AreaChart.Area` e `BarChart.Bar` dentro de qualquer raiz
para obter o equivalente ao ComposedChart deles. Efeitos Skia
(`DashPathEffect`, `LinearGradient`) podem ser aninhados como children das
séries.
