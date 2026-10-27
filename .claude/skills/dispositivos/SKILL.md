---
name: dispositivos
description: Sobe, controla e derruba emuladores Android e simuladores iOS do Politicapp para testes E2E (vários ao mesmo tempo, Maestro, agentes). Use quando o usuário pedir para bootar/subir simulador ou emulador, rodar o app em vários dispositivos, testar em outra versão de Android/iOS, rodar os testes E2E/Maestro, tirar print de um device, ou liberar recursos dos simuladores.
---

# Frota de dispositivos do Politicapp

Tudo passa por `apps/mobile/e2e/devices.sh`. Leia `apps/mobile/e2e/README.md` se precisar de detalhes. Não chame `emulator`, `simctl boot` ou `expo run:*` direto pra testes: o script já aplica os modos que economizam RAM e disco (Android `-read-only` com imagem ATD, iOS slim com simslim e clones efêmeros).

```bash
cd apps/mobile
D=e2e/devices.sh
$D doctor                          # SEMPRE primeiro: ferramentas, RAM, disco, goldens, builds
$D up android 2 [-p a30]           # perfis: a36 a36-small a36-tablet a30 a24 a36-full
$D up ios 2 [-p iphone-se]         # perfis: iphone iphone-se iphone-max ipad iphone-ios18
$D list                            # ids: emulator-55xx / UDID
$D build android|ios [--debug]     # Release por padrão; só rebuild se o código nativo/JS mudou
$D install                         # último build em todos os ativos
$D test [flow|pasta] [android|ios] # Maestro em paralelo → e2e/.out/runs/<ts>/<id>/
$D reset-app                       # volta ao primeiro uso sem reinstalar
$D screenshot <id> [arquivo]       # depois leia o PNG com Read pra ver a tela
$D down                            # SEMPRE ao terminar: libera RAM e apaga clones
```

## Regras

- **Recursos:** o Mac tem 18 GB de RAM e pouco disco livre. Somando tudo, não passe de ~4 Android + ~3 iOS ativos. Antes de qualquer build ou de criar um golden novo, veja o disco no `doctor`. Com menos de ~8 GB livres, avise o usuário em vez de compilar. Não apague AVDs, simuladores ou imagens que não começam com `pa-` (são de outros projetos, como o Catto).
- **Builds:** com `--debug`, rode o Metro (`pnpm start` em background) antes do `install`. Use Release pra E2E.
- **Variedade:** um bug de layout pede `a36-small`, `iphone-se` e `ipad`. Um bug de compatibilidade pede `a24` (minSdk) e `iphone-ios18`. Abrir links de fonte oficial no Android exige `a36-full`, porque a imagem ATD não tem navegador.
- **Agentes em paralelo:** dê a cada agente o id de um device (`--device <id>` no Maestro, `adb -s <id>`, `xcrun simctl … <udid>`). Dois agentes nunca no mesmo device.
- **Exploração interativa:** o MCP `maestro` (`.mcp.json`) expõe tap, input, hierarquia e screenshot por device id. Use isso pra investigar. Pra regressão, escreva um flow em `e2e/flows/`.
- **Falhas:** quando um flow falhar, leia `maestro.log` e os screenshots da pasta do run antes de concluir qualquer coisa. Se algum device estiver "morto" no `list`, rode `$D prune` e suba de novo.
