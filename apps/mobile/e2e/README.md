# E2E: frota de emuladores e simuladores

Infra pra rodar o Politicapp em vários Androids e iPhones ao mesmo tempo, com Maestro, por agentes ou à mão. Tudo passa por um script:

```bash
cd apps/mobile
pnpm devices help          # = bash e2e/devices.sh help
```

## Como funciona

Cada **perfil** (em `devices.conf`) vira um dispositivo *golden*, criado uma única vez. O `up` sobe **cópias efêmeras** dele, e o `down` descarta tudo. Toda rodada começa limpa, e o disco só paga pelo golden.

| | Golden | Instância | Custo de disco | Boot |
| --- | --- | --- | --- | --- |
| Android | AVD `pa-<perfil>` com imagem **ATD** (Automated Test Device: sem apps de sistema) | `emulator -read-only`: N instâncias do mesmo AVD, nada gravado em disco | ~125 MB por perfil; +2,2 GB se tiver snapshot | ~4 s com snapshot, ~16 s cold |
| iOS | simulador `pa-golden-<perfil>` com **simslim** (desliga ~160 daemons inúteis) | `simslim clone`, um clone APFS que herda o slim | ~0,5 GB por clone, apagado no `down` | ~30–50 s |

Medido neste Mac (M-series, 18 GB): um iPhone slim usa ~1 GB de RAM, contra ~4 GB stock. Um Android ATD usa ~2 GB (`hw.ramSize`).

Ajustes aplicados em todo device: animações desligadas, tela sempre ligada, fuso `America/Sao_Paulo` no Android, idioma pt-BR e teclado sem autocorreção no iOS, e status bar fixa (9:41) no iOS, pra screenshots estáveis.

## Fluxo típico

```bash
pnpm devices up android 3            # 3× perfil padrão (a36)
pnpm devices up android -p a24       # + 1 Android 7 (minSdk)
pnpm devices up ios 2                # 2× iPhone 17 Pro slim
pnpm devices list                    # ids → emulator-5556, UDIDs…

pnpm devices build android           # Release arm64 → e2e/.out/builds
pnpm devices build ios
pnpm devices install                 # instala em todos os ativos, em paralelo

pnpm e2e                             # todos os flows de e2e/flows em todos os devices
pnpm e2e e2e/flows/onboarding.yaml ios   # um flow, só iOS

pnpm devices down                    # desliga e apaga as instâncias
```

Os relatórios ficam em `e2e/.out/runs/<timestamp>/<device>/`: `report.xml` (JUnit), `maestro.log` e screenshots.

### Build Debug (com Metro)

`build <plat> --debug` gera um build que carrega o JS do Metro. Rode `pnpm start` e depois `install` (que já faz `adb reverse tcp:8081`). Serve pra iterar código e testar sem rebuild nativo. Release é o padrão, porque não tem dev menu nem overlay e é mais estável pra E2E.

## Perfis

Estão definidos em `devices.conf`. Pra adicionar um, basta acrescentar uma linha.

| Android | Imagem | Hardware | Para quê |
| --- | --- | --- | --- |
| `a36` (padrão) | API 36 ATD | Pixel 8 | dia a dia; único com snapshot |
| `a36-small` | API 36 ATD | small_phone | layout apertado |
| `a36-tablet` | API 36 ATD | Pixel Tablet | tablet |
| `a30` | API 30 ATD | Pixel 5 | Android 11 |
| `a24` | API 24 (default) | Pixel 4 | Android 7, igual ao `minSdkVersion` |
| `a36-full` | API 36 google_apis | Pixel 9 | quando precisar de GMS/navegador |

| iOS | Device | Runtime |
| --- | --- | --- |
| `iphone` (padrão) | iPhone 17 Pro | 26.2 |
| `iphone-se` | iPhone SE 3 | 26.2 |
| `iphone-max` | iPhone 17 Pro Max | 26.2 |
| `ipad` | iPad (A16) | 26.2 |
| `iphone-ios18` | iPhone 16e | 18.3 (slim reaplicado a cada boot, porque <18.5 não persiste) |

O golden é criado sob demanda no primeiro `up` do perfil, ou antes com `setup android a30 a24`. As imagens Android que faltarem são baixadas nesse momento.

## Limitações

- **ATD não tem navegador nem o app Configurações.** Fluxos que tocam em `SourceLink` (abre site oficial) precisam do perfil `a36-full`.
- **simslim desliga push, StoreKit, iCloud e Spotlight.** O app não usa nenhum desses hoje. Se passar a usar, ajuste `SIMSLIM_EXCEPT` em `devices.conf` (`simslim profiles` lista as categorias) e recrie o golden com `destroy ios <perfil>`.
- **Capacidade:** com 18 GB de RAM, cabem ~4 Android + ~3 iOS antes de começar a fazer swap. Com mais que isso, a CPU vira gargalo e os testes ficam flaky.
- **Snapshot Android** depende da versão do emulador e do `ANDROID_GPU`. Se o boot via snapshot falhar depois de atualizar o emulador, recrie o golden com `destroy android a36`.

## Manutenção

```bash
pnpm devices doctor                  # ferramentas, RAM/disco, goldens, builds
pnpm devices prune                   # limpa estado de devices que morreram (crash, reboot)
pnpm devices destroy android a30     # apaga golden (libera disco)
pnpm devices destroy ios             # apaga todos os goldens iOS
```

Para ver um device headless: `pnpm devices view <id>`. No iOS, abre o Simulator.app. No Android, precisa de `scrcpy`. Também dá pra tirar print com `pnpm devices screenshot <id>`.

## Ferramentas

| Ferramenta | Onde | Versão |
| --- | --- | --- |
| simslim | `~/.local/bin/simslim` (binário da release no GitHub, `mobai-app/simslim`) | 0.12.2 |
| Maestro | `~/.maestro/bin/maestro` (release `mobile-dev-inc/maestro`) | 2.11.0 |
| Android SDK | `~/Library/Android/sdk` (`sdkmanager`/`avdmanager` em `cmdline-tools/*/bin`) | emulador 37.2 |

O Maestro também roda como servidor MCP (`.mcp.json` na raiz do repo). Assim, um agente consegue tocar, digitar, inspecionar a hierarquia de views e tirar print em qualquer device pelo id, o que serve pra testes exploratórios além dos flows YAML.

## Escrevendo flows

Os flows ficam em `e2e/flows/*.yaml`. Os que estão em `_subflows/` são reaproveitados com `runFlow` e não rodam sozinhos. Use os textos visíveis em pt-BR (`tapOn: "Continuar"`). Quando o texto for ambíguo ou mudar com os dados, coloque `testID` no componente e use `tapOn: { id: "…" }`. Comece todo flow com `launchApp: { clearState: true }`, pra que ele não dependa de outro.
