#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK="$ROOT_DIR/android/app/build/outputs/apk/release/app-release.apk"
FIXTURE="$ROOT_DIR/tests/fixtures/lumbre-smoke.epub"
DEVICE="${ANDROID_SERIAL:-}"
ARTIFACT_DIR="${LUMBRE_E2E_ARTIFACTS:-/tmp/lumbre-e2e}"
PACKAGE="app.lumbre.reader"

adb_cmd() {
  if [[ -n "$DEVICE" ]]; then adb -s "$DEVICE" "$@"; else adb "$@"; fi
}

fail() { echo "E2E ERROR: $*" >&2; exit 1; }

mkdir -p "$ARTIFACT_DIR"
adb_cmd get-state >/dev/null 2>&1 || fail "No hay un dispositivo Android conectado."
[[ -f "$FIXTURE" ]] || fail "Falta el EPUB de prueba: $FIXTURE"
[[ -f "$APK" ]] || fail "Construye el APK de release antes de ejecutar E2E."
adb_cmd install -r "$APK" >/dev/null
# Start from clean app preferences/database so visual captures are deterministic.
adb_cmd shell pm clear "$PACKAGE" >/dev/null

dump_xml() {
  adb_cmd shell uiautomator dump /sdcard/lumbre-window.xml >/dev/null 2>&1 || true
  adb_cmd exec-out cat /sdcard/lumbre-window.xml 2>/dev/null || true
}

has_text() {
  dump_xml | python3 -c 'import sys,xml.etree.ElementTree as E; n=sys.argv[1].casefold(); r=E.fromstring(sys.stdin.read()); sys.exit(0 if any(n in ((x.get("text") or "")+" "+(x.get("content-desc") or "")).casefold() for x in r.iter()) else 1)' "$1"
}

wait_text() {
  local needle="$1"
  local timeout="${2:-25}"
  local end=$((SECONDS + timeout))
  until has_text "$needle"; do
    (( SECONDS < end )) || fail "No apareció en pantalla: $needle"
    sleep 1
  done
}

tap_text() {
  local needle="$1" bounds
  bounds="$(dump_xml | python3 -c 'import sys,xml.etree.ElementTree as E; n=sys.argv[1].casefold(); r=E.fromstring(sys.stdin.read()); ns=[x for x in r.iter() if n in ((x.get("text") or "")+" "+(x.get("content-desc") or "")).casefold() and x.get("bounds")]; ns.sort(key=lambda x: (x.get("clickable")!="true", len(x.get("text") or ""))); print(ns[0].get("bounds") if ns else "")' "$needle")"
  [[ -n "$bounds" ]] || fail "No se encontró el control: $needle"
  read -r x y < <(python3 -c 'import re,sys; a,b,c,d=map(int,re.findall(r"\d+",sys.argv[1])); print((a+c)//2,(b+d)//2)' "$bounds")
  adb_cmd shell input tap "$x" "$y"
}

capture() {
  local filename="${1%.png}"
  adb_cmd exec-out screencap -p > "$ARTIFACT_DIR/$filename.png"
}

on_exit() {
  adb_cmd shell svc wifi enable >/dev/null 2>&1 || true
  adb_cmd shell svc data enable >/dev/null 2>&1 || true
}
trap on_exit EXIT

adb_cmd push "$FIXTURE" /sdcard/Download/lumbre-smoke.epub >/dev/null
adb_cmd shell am force-stop "$PACKAGE"
adb_cmd shell monkey -p "$PACKAGE" 1 >/dev/null
wait_text "Tus libros"
capture library-before.png

if ! has_text "lumbre smoke"; then
  tap_text "Añadir EPUB"
  sleep 2
  if ! has_text "Downloads"; then adb_cmd shell input tap 55 95; fi
  wait_text "Downloads"
  tap_text "Downloads"
  wait_text "lumbre-smoke.epub"
  read -r screen_width screen_height < <(adb_cmd shell wm size | sed -n 's/.*: \([0-9]*\)x\([0-9]*\).*/\1 \2/p' | tail -1)
  for _ in 1 2 3; do
    has_text "Downloads" || break
    adb_cmd shell input tap "$((screen_width * 30 / 100))" "$((screen_height * 51 / 100))"
    sleep 2
  done
  wait_text "lumbre smoke"
fi

tap_text "lumbre smoke"
wait_text "Un libro de prueba"
sleep 4
capture reader-light.png

tap_text "Abrir ajustes de lectura"
wait_text "Papel"
tap_text "Sepia"
tap_text "Listo"
sleep 2
capture reader-sepia.png

tap_text "Abrir ajustes de lectura"
wait_text "Noche"
tap_text "Noche"
tap_text "Aumentar tamaño de letra"
tap_text "Listo"
sleep 2
capture reader-dark.png

adb_cmd shell svc wifi disable
adb_cmd shell svc data disable
adb_cmd shell input keyevent 4
wait_text "Tus libros"
tap_text "lumbre smoke"
wait_text "Un libro de prueba"
sleep 5
capture reader-offline.png
if ! has_text "Abrir ajustes de lectura"; then fail "El lector local no se mantuvo disponible sin red."; fi

echo "E2E Android completado. Capturas: $ARTIFACT_DIR"
