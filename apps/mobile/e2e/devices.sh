#!/usr/bin/env bash
# Controle da frota de emuladores/simuladores para E2E do Politicapp.
# Documentação: e2e/README.md. Uso rápido: e2e/devices.sh help
set -uo pipefail

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$E2E_DIR")"
OUT="$E2E_DIR/.out"
STATE="$OUT/state"
# shellcheck source=devices.conf
. "$E2E_DIR/devices.conf"

APP_ID="br.com.politicapp"
PREFIX="pa"
SNAPSHOT="e2e"

ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$ANDROID_HOME/platform-tools/adb"
EMULATOR="$ANDROID_HOME/emulator/emulator"
CMDLINE_BIN="$(ls -d "$ANDROID_HOME"/cmdline-tools/*/bin 2>/dev/null | head -1)"
SDKMANAGER="$CMDLINE_BIN/sdkmanager"
AVDMANAGER="$CMDLINE_BIN/avdmanager"
MAESTRO="${MAESTRO:-$HOME/.maestro/bin/maestro}"
SIMSLIM="${SIMSLIM:-$(command -v simslim || echo "$HOME/.local/bin/simslim")}"
export MAESTRO_CLI_NO_ANALYTICS=1 MAESTRO_CLI_NO_UPDATE_CHECK=1
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 # pod install / xcodebuild quebram sem isso

mkdir -p "$STATE"

log() { printf '\033[1;34m▸\033[0m %s\n' "$*" >&2; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- perfis

profile_line() { # $1=lista $2=nome
  printf '%s\n' "$1" | awk -F'|' -v n="$2" '$1==n {print; exit}'
}
profile_names() { printf '%s\n' "$1" | awk -F'|' 'NF>1 {print $1}'; }
field() { printf '%s' "$1" | cut -d'|' -f"$2"; }

# ---------------------------------------------------------------- Android

avd_name() { echo "$PREFIX-$1"; }
avd_dir() { echo "$HOME/.android/avd/$(avd_name "$1").avd"; }

android_wait_boot() { # $1=serial $2=timeout s
  local serial="$1" deadline=$(( $(date +%s) + ${2:-240} ))
  "$ADB" -s "$serial" wait-for-device >/dev/null 2>&1 &
  local waiter=$!
  while kill -0 "$waiter" 2>/dev/null; do
    [ "$(date +%s)" -gt "$deadline" ] && { kill "$waiter" 2>/dev/null; return 1; }
    sleep 1
  done
  until [ "$("$ADB" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] &&
        "$ADB" -s "$serial" shell pm path android >/dev/null 2>&1; do
    [ "$(date +%s)" -gt "$deadline" ] && return 1
    sleep 1
  done
}

android_tune() { # deixa o device determinístico para teste
  local s="$1"
  "$ADB" -s "$s" root >/dev/null 2>&1 && sleep 2 && "$ADB" -s "$s" wait-for-device
  "$ADB" -s "$s" shell '
    settings put global window_animation_scale 0
    settings put global transition_animation_scale 0
    settings put global animator_duration_scale 0
    settings put global package_verifier_enable 0
    settings put global verifier_verify_adb_installs 0
    settings put secure spell_checker_enabled 0
    settings put secure show_ime_with_hard_keyboard 0
    settings put system screen_off_timeout 2147483647
    settings put global stay_on_while_plugged_in 7
    setprop persist.sys.timezone America/Sao_Paulo
    svc power stayon true
    input keyevent 82
  ' >/dev/null 2>&1 || true
}

free_port() {
  local p
  for p in $(seq 5554 2 5680); do
    lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1 || lsof -nP -iTCP:"$((p + 1))" -sTCP:LISTEN >/dev/null 2>&1 ||
      [ -e "$STATE/android-emulator-$p" ] || { echo "$p"; return; }
  done
  return 1
}

emu_common_args() { # $1=perfil
  echo "-avd $(avd_name "$1") -no-window -no-audio -no-boot-anim -no-metrics -gpu $ANDROID_GPU -cores $ANDROID_CORES -camera-back none -camera-front none -netdelay none -netspeed full"
}

android_setup_profile() {
  local name="$1" line image device ram dir
  line="$(profile_line "$ANDROID_PROFILES" "$name")"
  [ -n "$line" ] || die "Perfil Android desconhecido: $name ($(profile_names "$ANDROID_PROFILES" | tr '\n' ' '))"
  image="$(field "$line" 2)" device="$(field "$line" 3)" ram="$(field "$line" 4)"
  dir="$(avd_dir "$name")"

  if [ -f "$dir/pa-ready" ]; then
    log "Android $name: golden já pronto"
    return 0
  fi

  if [ ! -d "$ANDROID_HOME/$(echo "$image" | tr ';' '/')" ]; then
    log "Android $name: baixando $image"
    yes | "$SDKMANAGER" "$image" >/dev/null 2>&1 || die "sdkmanager falhou para $image"
  fi

  if [ ! -f "$dir/config.ini" ]; then
    log "Android $name: criando AVD $(avd_name "$name") ($device)"
    echo no | "$AVDMANAGER" create avd -n "$(avd_name "$name")" -k "$image" -d "$device" --force >/dev/null ||
      die "avdmanager falhou"
  fi
  # Ajustes de footprint: userdata pequeno, sem câmera/áudio, teclado físico (input do Maestro)
  local cfg="$dir/config.ini" kv k
  for kv in "hw.ramSize=$ram" "disk.dataPartition.size=2G" "vm.heapSize=256" "hw.keyboard=yes" \
            "hw.audioInput=no" "hw.audioOutput=no" "hw.camera.back=none" "hw.camera.front=none" \
            "hw.gps=no" "hw.sensors.proximity=no" "fastboot.forceColdBoot=no" "fastboot.forceFastBoot=no" \
            "showDeviceFrame=no"; do
    k="${kv%%=*}"
    grep -v "^$k[ =]" "$cfg" >"$cfg.tmp"; mv "$cfg.tmp" "$cfg"
    echo "$kv" >>"$cfg"
  done

  if ! uses_snapshot "$name"; then
    touch "$dir/pa-ready"
    log "Android $name: golden pronto, sem snapshot (cold boot ~16s; ver ANDROID_SNAPSHOTS)"
    return 0
  fi
  log "Android $name: primeiro boot (cold) para gerar o snapshot '$SNAPSHOT'"
  local port serial
  port="$(free_port)" || die "sem porta livre"
  serial="emulator-$port"
  # shellcheck disable=SC2046
  "$EMULATOR" $(emu_common_args "$name") -port "$port" -no-snapshot-load -no-snapshot-save >"$OUT/setup-android-$name.log" 2>&1 &
  android_wait_boot "$serial" 600 || die "boot do golden $name não completou (ver $OUT/setup-android-$name.log)"
  android_tune "$serial"
  sleep 5 # deixa o sistema assentar antes de congelar a RAM no snapshot
  "$ADB" -s "$serial" emu avd snapshot save "$SNAPSHOT" >/dev/null || die "falha ao salvar snapshot"
  "$ADB" -s "$serial" emu kill >/dev/null 2>&1
  sleep 3
  rm -rf "$dir/snapshots/default_boot" # quick-boot automático: não usamos, custa a RAM inteira em disco
  touch "$dir/pa-ready"
  log "Android $name: golden pronto ($(du -sh "$dir" | cut -f1))"
}

uses_snapshot() { case " $ANDROID_SNAPSHOTS " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }

android_up() { # $1=perfil $2=quantidade
  local name="$1" count="$2" i port serial pids="" serials="" boot
  android_setup_profile "$name"
  if [ -f "$(avd_dir "$name")/snapshots/$SNAPSHOT/snapshot.pb" ]; then
    boot="-snapshot $SNAPSHOT -no-snapshot-save"
  else
    boot="-no-snapshot"
  fi
  for i in $(seq 1 "$count"); do
    port="$(free_port)" || die "sem porta livre"
    serial="emulator-$port"
    : >"$STATE/android-$serial" # reserva a porta antes do próximo free_port
    # -read-only: várias instâncias do mesmo AVD, nada é gravado no disco
    # shellcheck disable=SC2046
    "$EMULATOR" $(emu_common_args "$name") -port "$port" -read-only $boot \
      >"$OUT/emulator-$port.log" 2>&1 &
    printf 'platform=android\nprofile=%s\nid=%s\npid=%s\n' "$name" "$serial" "$!" >"$STATE/android-$serial"
    serials="$serials $serial"
    log "Android $name: subindo $serial"
  done
  for serial in $serials; do
    ( android_wait_boot "$serial" 300 && android_tune "$serial" && echo "ok" ) >/dev/null &
    pids="$pids $!"
  done
  local failed=0 p
  for p in $pids; do wait "$p" || failed=1; done
  [ "$failed" = 0 ] || warn "algum emulador não bootou — veja $OUT/emulator-*.log"
}

# ---------------------------------------------------------------- iOS

sim_udid_by_name() {
  xcrun simctl list devices -j | /usr/bin/python3 -c '
import json,sys
name=sys.argv[1]
for rt,devs in json.load(sys.stdin)["devices"].items():
    for d in devs:
        if d["name"]==name and d.get("isAvailable",True): print(d["udid"]); sys.exit()
' "$1"
}

sim_state() {
  xcrun simctl list devices -j | /usr/bin/python3 -c '
import json,sys
for devs in json.load(sys.stdin)["devices"].values():
    for d in devs:
        if d["udid"]==sys.argv[1]: print(d["state"]); sys.exit()
' "$1"
}

runtime_needs_reslim() { # iOS < 18.5 não persiste o slim entre boots
  case "$1" in iOS-17-*|iOS-18-[0-4]|iOS-18-[0-4]-*) return 0 ;; *) return 1 ;; esac
}

ios_tune() { # $1=udid (bootado)
  local u="$1"
  xcrun simctl spawn "$u" defaults write -g AppleLanguages -array pt-BR >/dev/null 2>&1
  xcrun simctl spawn "$u" defaults write -g AppleLocale -string pt_BR >/dev/null 2>&1
  # teclado: sem autocorreção/sugestão, que atrapalham inputText
  xcrun simctl spawn "$u" defaults write com.apple.Preferences KeyboardAutocorrection -bool NO >/dev/null 2>&1
  xcrun simctl spawn "$u" defaults write com.apple.Preferences KeyboardPrediction -bool NO >/dev/null 2>&1
  xcrun simctl spawn "$u" defaults write com.apple.Preferences KeyboardAutocapitalization -bool NO >/dev/null 2>&1
  xcrun simctl status_bar "$u" override --time "9:41" --batteryState charged --batteryLevel 100 \
    --cellularBars 4 --wifiBars 3 >/dev/null 2>&1 || true
}

ios_setup_profile() {
  local name="$1" line dtype runtime golden udid
  line="$(profile_line "$IOS_PROFILES" "$name")"
  [ -n "$line" ] || die "Perfil iOS desconhecido: $name ($(profile_names "$IOS_PROFILES" | tr '\n' ' '))"
  dtype="$(field "$line" 2)" runtime="$(field "$line" 3)"
  golden="$PREFIX-golden-$name"
  udid="$(sim_udid_by_name "$golden")"
  if [ -n "$udid" ] && [ -e "$STATE/ios-golden-$name.ready" ]; then
    log "iOS $name: golden já pronto"
    echo "$udid" >"$STATE/ios-golden-$name"; return 0
  fi
  [ -n "$udid" ] || {
    log "iOS $name: criando golden ($dtype, $runtime)"
    udid="$(xcrun simctl create "$golden" "$dtype" "com.apple.CoreSimulator.SimRuntime.$runtime")" ||
      die "simctl create falhou ($dtype / $runtime)"
  }
  xcrun simctl boot "$udid" 2>/dev/null; xcrun simctl bootstatus "$udid" -b >/dev/null
  ios_tune "$udid"
  if runtime_needs_reslim "$runtime"; then
    log "iOS $name: runtime $runtime não persiste slim — será aplicado a cada boot"
  else
    log "iOS $name: aplicando simslim (mantendo: ${SIMSLIM_EXCEPT:-nada})"
    "$SIMSLIM" on "$udid" ${SIMSLIM_EXCEPT:+--except "$SIMSLIM_EXCEPT"} >"$OUT/setup-ios-$name.log" 2>&1 ||
      die "simslim falhou (ver $OUT/setup-ios-$name.log)"
  fi
  xcrun simctl shutdown "$udid" 2>/dev/null
  echo "$udid" >"$STATE/ios-golden-$name"
  touch "$STATE/ios-golden-$name.ready"
  log "iOS $name: golden pronto ($udid)"
}

ios_up() { # $1=perfil $2=quantidade
  local name="$1" count="$2" golden runtime i n clone udids="" u
  ios_setup_profile "$name"
  golden="$(cat "$STATE/ios-golden-$name")"
  runtime="$(field "$(profile_line "$IOS_PROFILES" "$name")" 3)"
  [ "$(sim_state "$golden")" = "Shutdown" ] || xcrun simctl shutdown "$golden" 2>/dev/null
  for i in $(seq 1 "$count"); do
    n=1; while [ -n "$(sim_udid_by_name "$PREFIX-$name-$n")" ]; do n=$((n + 1)); done
    # simslim clone preserva o perfil slim (simctl clone puro perde os overrides em builds antigos)
    "$SIMSLIM" clone "$golden" "$PREFIX-$name-$n" >/dev/null 2>&1 || xcrun simctl clone "$golden" "$PREFIX-$name-$n" >/dev/null
    clone="$(sim_udid_by_name "$PREFIX-$name-$n")"
    [ -n "$clone" ] || die "clone falhou"
    printf 'platform=ios\nprofile=%s\nid=%s\nname=%s\n' "$name" "$clone" "$PREFIX-$name-$n" >"$STATE/ios-$clone"
    xcrun simctl boot "$clone"
    udids="$udids $clone"
    log "iOS $name: subindo $PREFIX-$name-$n ($clone)"
  done
  local pids="" p failed=0
  for u in $udids; do
    ( xcrun simctl bootstatus "$u" -b >/dev/null &&
      { ! runtime_needs_reslim "$runtime" || "$SIMSLIM" on "$u" --no-reboot ${SIMSLIM_EXCEPT:+--except "$SIMSLIM_EXCEPT"} >/dev/null 2>&1; } &&
      ios_tune "$u" ) &
    pids="$pids $!"
  done
  for p in $pids; do wait "$p" || failed=1; done
  [ "$failed" = 0 ] || warn "algum simulador não bootou direito"
}

# ---------------------------------------------------------------- frota

running_ids() { # $1=android|ios|all  → um id por linha
  local f plat
  for f in "$STATE"/android-emulator-* "$STATE"/ios-*-*-*-*-*; do
    [ -f "$f" ] || continue
    plat="$(sed -n 's/^platform=//p' "$f")"
    [ "$1" = all ] || [ "$1" = "$plat" ] || continue
    sed -n 's/^id=//p' "$f"
  done
}

state_of() { grep -l "^id=$1\$" "$STATE"/android-* "$STATE"/ios-* 2>/dev/null | head -1; }

is_alive() { # $1=id
  case "$1" in
    emulator-*) "$ADB" devices | grep -q "^$1[[:space:]]device" ;;
    *) [ "$(sim_state "$1")" = "Booted" ] ;;
  esac
}

cmd_list() {
  local plat="${1:-all}" id f st
  printf '%-10s %-14s %-38s %s\n' PLATAFORMA PERFIL ID ESTADO
  for id in $(running_ids "$plat"); do
    f="$(state_of "$id")"
    if is_alive "$id"; then st=ativo; else st=morto; fi
    printf '%-10s %-14s %-38s %s\n' "$(sed -n 's/^platform=//p' "$f")" "$(sed -n 's/^profile=//p' "$f")" "$id" "$st"
  done
}

cmd_up() {
  local plat="${1:-}" count=1 profile=""
  [ -n "$plat" ] || die "uso: up <android|ios> [quantidade] [--profile nome]"
  shift
  while [ $# -gt 0 ]; do
    case "$1" in
      --profile|-p) profile="$2"; shift 2 ;;
      [0-9]*) count="$1"; shift ;;
      *) die "argumento desconhecido: $1" ;;
    esac
  done
  case "$plat" in
    android) android_up "${profile:-$ANDROID_DEFAULT_PROFILE}" "$count" ;;
    ios) ios_up "${profile:-$IOS_DEFAULT_PROFILE}" "$count" ;;
    *) die "plataforma inválida: $plat" ;;
  esac
  cmd_list "$plat"
}

cmd_down() {
  local plat="${1:-all}" id f pid
  for id in $(running_ids "$plat"); do
    f="$(state_of "$id")"
    case "$id" in
      emulator-*)
        "$ADB" -s "$id" emu kill >/dev/null 2>&1
        pid="$(sed -n 's/^pid=//p' "$f")"
        local t=0
        while "$ADB" devices | grep -q "^$id[[:space:]]" && [ $t -lt 15 ]; do sleep 1; t=$((t + 1)); done
        [ -n "$pid" ] && kill "$pid" 2>/dev/null
        log "Android $id desligado" ;;
      *)
        xcrun simctl shutdown "$id" 2>/dev/null
        xcrun simctl delete "$id" 2>/dev/null
        log "iOS $(sed -n 's/^name=//p' "$f") removido" ;;
    esac
    rm -f "$f"
  done
}

cmd_setup() {
  local plat="${1:-all}"; shift || true
  local profiles="$*" p
  case "$plat" in
    android) for p in ${profiles:-$ANDROID_DEFAULT_PROFILE}; do android_setup_profile "$p"; done ;;
    ios) for p in ${profiles:-$IOS_DEFAULT_PROFILE}; do ios_setup_profile "$p"; done ;;
    all) android_setup_profile "$ANDROID_DEFAULT_PROFILE"; ios_setup_profile "$IOS_DEFAULT_PROFILE" ;;
    *) die "uso: setup <android|ios|all> [perfis...]" ;;
  esac
}

# ---------------------------------------------------------------- build / install

APK="$OUT/builds/android/politicapp.apk"
IOS_APP="$OUT/builds/ios/Politicapp.app"

cmd_build() {
  local plat="${1:-}" variant=Release
  [ "${2:-}" = "--debug" ] && variant=Debug
  [ -d "$APP_DIR/android" ] && [ -d "$APP_DIR/ios" ] || { log "rodando expo prebuild"; (cd "$APP_DIR" && npx expo prebuild) || die "prebuild falhou"; }
  export SENTRY_DISABLE_AUTO_UPLOAD=true
  case "$plat" in
    android)
      local task lower
      lower="$(echo "$variant" | tr 'A-Z' 'a-z')"
      task="assemble$variant"
      log "Android: gradle $task (arm64-v8a)"
      (cd "$APP_DIR/android" && ./gradlew ":app:$task" -PreactNativeArchitectures=arm64-v8a -q) || die "build Android falhou"
      mkdir -p "$(dirname "$APK")"
      cp "$APP_DIR/android/app/build/outputs/apk/$lower/app-$lower.apk" "$APK"
      echo "$variant" >"$OUT/builds/android/variant"
      log "APK: $APK ($(du -h "$APK" | cut -f1))" ;;
    ios)
      [ -d "$APP_DIR/ios/Pods" ] || (cd "$APP_DIR/ios" && pod install) || die "pod install falhou"
      log "iOS: xcodebuild $variant (simulador arm64)"
      # DerivedData padrão do Xcode: reaproveita o cache incremental do `expo run:ios` em vez de duplicar GBs
      local xb="xcodebuild -workspace $APP_DIR/ios/Politicapp.xcworkspace -scheme Politicapp -configuration $variant -sdk iphonesimulator -destination generic/platform=iOS\ Simulator"
      eval "$xb ARCHS=arm64 ONLY_ACTIVE_ARCH=YES COMPILER_INDEX_STORE_ENABLE=NO -quiet build" || die "build iOS falhou"
      local products
      products="$(eval "$xb -showBuildSettings" 2>/dev/null | awk -F' = ' '/ BUILT_PRODUCTS_DIR /{print $2; exit}')"
      mkdir -p "$(dirname "$IOS_APP")"
      rm -rf "$IOS_APP"
      cp -Rc "$products/Politicapp.app" "$IOS_APP" # -c: clone APFS, não ocupa espaço
      echo "$variant" >"$OUT/builds/ios/variant"
      log "App: $IOS_APP" ;;
    *) die "uso: build <android|ios> [--debug]" ;;
  esac
}

cmd_install() {
  local plat="${1:-all}" id pids="" p
  for id in $(running_ids "$plat"); do
    is_alive "$id" || continue
    case "$id" in
      emulator-*)
        [ -f "$APK" ] || die "sem APK — rode: build android"
        ( "$ADB" -s "$id" install -r -t -g "$APK" >/dev/null &&
          "$ADB" -s "$id" reverse tcp:8081 tcp:8081 >/dev/null && log "instalado em $id" ) & ;;
      *)
        [ -d "$IOS_APP" ] || die "sem .app — rode: build ios"
        ( xcrun simctl install "$id" "$IOS_APP" && log "instalado em $id" ) & ;;
    esac
    pids="$pids $!"
  done
  for p in $pids; do wait "$p"; done
}

cmd_reset_app() { # limpa dados do app (estado de primeiro uso) sem reinstalar
  local plat="${1:-all}" id
  for id in $(running_ids "$plat"); do
    case "$id" in
      emulator-*) "$ADB" -s "$id" shell pm clear "$APP_ID" >/dev/null ;;
      *) xcrun simctl terminate "$id" "$APP_ID" 2>/dev/null
         rm -rf "$(xcrun simctl get_app_container "$id" "$APP_ID" data 2>/dev/null)"/{Documents,Library} 2>/dev/null ;;
    esac
    log "dados do app limpos em $id"
  done
}

# ---------------------------------------------------------------- testes

cmd_test() { # test [flows] [android|ios|all] → Maestro em paralelo, um processo por device
  local target="${1:-$E2E_DIR/flows}" plat="${2:-all}" run id dir pids="" p failed=0
  [ -x "$MAESTRO" ] || die "Maestro não encontrado em $MAESTRO"
  run="$OUT/runs/$(date +%Y%m%d-%H%M%S)"
  for id in $(running_ids "$plat"); do
    is_alive "$id" || continue
    dir="$run/$id"; mkdir -p "$dir"
    ( "$MAESTRO" --device "$id" test "$target" --format junit --output "$dir/report.xml" \
        --test-output-dir "$dir" >"$dir/maestro.log" 2>&1 ) &
    pids="$pids $!:$id"
    log "rodando em $id"
  done
  [ -n "$pids" ] || die "nenhum dispositivo ativo — rode: up android|ios"
  for p in $pids; do
    if wait "${p%%:*}"; then log "✓ ${p#*:}"; else warn "✗ ${p#*:} (ver $run/${p#*:}/maestro.log)"; failed=1; fi
  done
  echo "$run"
  return "$failed"
}

cmd_screenshot() { # screenshot <id> [arquivo]
  local id="$1" file="${2:-$OUT/shots/$1-$(date +%H%M%S).png}"
  mkdir -p "$(dirname "$file")"
  case "$id" in
    emulator-*) "$ADB" -s "$id" exec-out screencap -p >"$file" ;;
    *) xcrun simctl io "$id" screenshot "$file" >/dev/null 2>&1 ;;
  esac
  echo "$file"
}

cmd_view() { # abre a tela de um device headless (só pra olhar)
  local id="$1"
  case "$id" in
    emulator-*) command -v scrcpy >/dev/null || die "instale scrcpy (brew install scrcpy) ou use screenshot"
                scrcpy -s "$id" >/dev/null 2>&1 & ;;
    *) open -a Simulator --args -CurrentDeviceUDID "$id" ;;
  esac
}

# ---------------------------------------------------------------- manutenção

cmd_doctor() {
  local ok=1 t
  for t in "$ADB" "$EMULATOR" "$SDKMANAGER" "$AVDMANAGER" "$MAESTRO" "$SIMSLIM"; do
    if [ -x "$t" ]; then printf '  ✓ %s\n' "$t"; else printf '  ✗ %s\n' "$t"; ok=0; fi
  done
  command -v xcrun >/dev/null && printf '  ✓ %s\n' "$(xcodebuild -version | head -1)"
  printf '  RAM: %s GB · CPUs: %s · disco livre: %s\n' "$(( $(sysctl -n hw.memsize) / 1073741824 ))" \
    "$(sysctl -n hw.ncpu)" "$(df -h / | awk 'NR==2 {print $4}')"
  echo "Golden Android:"
  for t in $(profile_names "$ANDROID_PROFILES"); do
    [ -f "$(avd_dir "$t")/pa-ready" ] && printf '  ✓ %s (%s%s)\n' "$t" "$(du -sh "$(avd_dir "$t")" | cut -f1)" \
      "$([ -f "$(avd_dir "$t")/snapshots/$SNAPSHOT/snapshot.pb" ] && echo ', snapshot')"
  done
  echo "Golden iOS:"
  for t in $(profile_names "$IOS_PROFILES"); do
    [ -e "$STATE/ios-golden-$t.ready" ] && printf '  ✓ %s (%s)\n' "$t" "$(cat "$STATE/ios-golden-$t")"
  done
  echo "Builds:"
  [ -f "$APK" ] && printf '  android: %s (%s)\n' "$(cat "$OUT/builds/android/variant")" "$(stat -f %Sm "$APK")"
  [ -d "$IOS_APP" ] && printf '  ios: %s (%s)\n' "$(cat "$OUT/builds/ios/variant")" "$(stat -f %Sm "$IOS_APP")"
  [ "$ok" = 1 ]
}

cmd_prune() { # remove estado de devices que morreram (crash, reboot do Mac)
  local id f
  for id in $(running_ids all); do
    is_alive "$id" && continue
    f="$(state_of "$id")"
    case "$id" in emulator-*) ;; *) xcrun simctl delete "$id" 2>/dev/null ;; esac
    rm -f "$f"; log "removido estado morto: $id"
  done
  # clones iOS órfãos (estado perdido)
  xcrun simctl list devices | sed -nE "s/^ +$PREFIX-[a-z0-9-]+-[0-9]+ \(([0-9A-F-]+)\).*/\1/p" | while read -r id; do
    [ -f "$STATE/ios-$id" ] || { xcrun simctl delete "$id" 2>/dev/null; log "clone órfão removido: $id"; }
  done
}

cmd_destroy() { # apaga goldens (AVDs + simuladores) de um perfil, ou todos
  local plat="${1:-}" name="${2:-}" t u
  [ -n "$plat" ] || die "uso: destroy <android|ios> [perfil]  (sem perfil = todos)"
  cmd_down "$plat"
  case "$plat" in
    android) for t in ${name:-$(profile_names "$ANDROID_PROFILES")}; do
               [ -d "$(avd_dir "$t")" ] || continue
               "$AVDMANAGER" delete avd -n "$(avd_name "$t")" >/dev/null 2>&1; log "AVD $(avd_name "$t") apagado"
             done ;;
    ios) for t in ${name:-$(profile_names "$IOS_PROFILES")}; do
           u="$(sim_udid_by_name "$PREFIX-golden-$t")"; [ -n "$u" ] || continue
           xcrun simctl delete "$u"; rm -f "$STATE/ios-golden-$t" "$STATE/ios-golden-$t.ready"; log "golden iOS $t apagado"
         done ;;
  esac
}

usage() {
  cat <<EOF
e2e/devices.sh — frota de emuladores/simuladores do Politicapp

  doctor                              ferramentas, recursos, goldens e builds
  setup <android|ios|all> [perfis]    cria os goldens (uma vez por perfil)
  up <android|ios> [N] [-p perfil]    sobe N instâncias efêmeras do perfil
  list [android|ios]                  dispositivos ativos (ids p/ Maestro/adb/simctl)
  down [android|ios|all]              desliga e descarta as instâncias
  build <android|ios> [--debug]       build do app (Release por padrão)
  install [android|ios|all]           instala o último build em todos os ativos
  reset-app [android|ios|all]         limpa dados do app (volta ao primeiro uso)
  test [flow|pasta] [android|ios|all] Maestro em paralelo, relatório por device
  screenshot <id> [arquivo]           captura de tela
  view <id>                           abre a tela de um device headless
  prune                               limpa estado de devices mortos/órfãos
  destroy <android|ios> [perfil]      apaga goldens (libera disco)

Perfis Android: $(profile_names "$ANDROID_PROFILES" | tr '\n' ' ')
Perfis iOS:     $(profile_names "$IOS_PROFILES" | tr '\n' ' ')
EOF
}

cmd="${1:-help}"; shift || true
case "$cmd" in
  doctor) cmd_doctor ;;
  setup) cmd_setup "$@" ;;
  up) cmd_up "$@" ;;
  list|ls) cmd_list "$@" ;;
  down) cmd_down "$@" ;;
  build) cmd_build "$@" ;;
  install) cmd_install "$@" ;;
  reset-app) cmd_reset_app "$@" ;;
  test) cmd_test "$@" ;;
  screenshot) cmd_screenshot "$@" ;;
  view) cmd_view "$@" ;;
  prune) cmd_prune ;;
  destroy) cmd_destroy "$@" ;;
  help|-h|--help) usage ;;
  *) usage; exit 1 ;;
esac
