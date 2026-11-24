#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK="$ROOT_DIR/android/app/build/outputs/apk/release/app-release.apk"
FIXTURE="$ROOT_DIR/tests/fixtures/lumbre-smoke.epub"
DEVICE="${ANDROID_SERIAL:-}"
ARTIFACT_DIR="${LUMBRE_E2E_ARTIFACTS:-/tmp/lumbre-e2e}"
PACKAGE="app.lumbre.reader"
TEST_BOOK_KEY="${BASHPID:-$$}-$(date +%s)"
TEST_BOOK_TITLE="lumbre e2e ${TEST_BOOK_KEY//-/ }"
TEST_BOOK_FILE="lumbre-e2e-${TEST_BOOK_KEY}.epub"

adb_cmd() {
  if [[ -n "$DEVICE" ]]; then adb -s "$DEVICE" "$@"; else adb "$@"; fi
}

fail() { echo "E2E ERROR: $*" >&2; exit 1; }

mkdir -p "$ARTIFACT_DIR"
adb_cmd get-state >/dev/null 2>&1 || fail "No hay un dispositivo Android conectado."
[[ -f "$FIXTURE" ]] || fail "Falta el EPUB de prueba: $FIXTURE"
[[ -f "$APK" ]] || fail "Construye el APK de release antes de ejecutar E2E."
adb_cmd install -r "$APK" >/dev/null

dump_xml() {
  adb_cmd shell uiautomator dump /sdcard/lumbre-window.xml >/dev/null 2>&1 || true
  adb_cmd exec-out cat /sdcard/lumbre-window.xml 2>/dev/null || true
}

has_text() {
  dump_xml | python3 -c 'import sys,xml.etree.ElementTree as E; n=sys.argv[1].casefold(); r=E.fromstring(sys.stdin.read()); sys.exit(0 if any(n in ((x.get("text") or "")+" "+(x.get("content-desc") or "")).casefold() for x in r.iter()) else 1)' "$1"
}

has_exact_text() {
  dump_xml | python3 -c 'import sys,xml.etree.ElementTree as E; n=sys.argv[1].casefold(); r=E.fromstring(sys.stdin.read()); sys.exit(0 if any((x.get("text") or "").casefold()==n for x in r.iter()) else 1)' "$1"
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

wait_absent_text() {
  local needle="$1"
  local timeout="${2:-15}"
  local end=$((SECONDS + timeout))
  until ! has_text "$needle"; do
    (( SECONDS < end )) || fail "Sigue visible después de la acción: $needle"
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

tap_file_tile() {
  local label="$1" bounds
  bounds="$(dump_xml | python3 -c 'import sys,xml.etree.ElementTree as E; label=sys.argv[1].casefold(); r=E.fromstring(sys.stdin.read()); parents={c:p for p in r.iter() for c in p}; matches=[]
for n in r.iter():
 if (n.get("text") or "").casefold()==label:
  p=parents.get(n)
  while p is not None:
   if p.get("class")=="androidx.cardview.widget.CardView" and p.get("clickable")=="true" and p.get("bounds"): matches.append(p.get("bounds")); break
   p=parents.get(p)
def area(b):
 import re
 a,c,d,e=map(int,re.findall(r"\d+",b)); return (d-a)*(e-c)
print(min(matches,key=area) if matches else "")' "$label")"
  [[ -n "$bounds" ]] || fail "No se encontró la tarjeta del archivo: $label"
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

adb_cmd push "$FIXTURE" "/sdcard/Download/$TEST_BOOK_FILE" >/dev/null
adb_cmd shell am force-stop "$PACKAGE"
adb_cmd shell monkey -p "$PACKAGE" 1 >/dev/null
wait_text "Tus libros"
capture library-before.png

# Verify that catalog discovery reports a recoverable error without connectivity.
adb_cmd shell svc wifi disable
adb_cmd shell svc data disable
tap_text "Descubrir"
tap_text "Entiendo que el estado de derechos depende de mi país"
wait_text "Intentar de nuevo" 35
has_text "No pudimos conectar" || fail "El catálogo no mostró un error de conexión comprensible."
if has_text "UnknownHostException"; then fail "La pantalla expuso un error técnico de Android."; fi
capture catalog-offline.png
adb_cmd shell svc wifi enable
adb_cmd shell svc data enable
tap_text "Biblioteca"
wait_text "Tus libros"

if ! has_text "$TEST_BOOK_TITLE"; then
  tap_text "Añadir EPUB"
  sleep 2
  if ! has_text "Downloads"; then adb_cmd shell input tap 55 95; fi
  wait_text "Downloads"
  tap_text "Downloads"
  # Downloads grows on repeated runs; scroll to the newest, uniquely named fixture.
  for _ in 1 2 3; do adb_cmd shell input swipe 360 1370 360 560 250; done
  wait_text "$TEST_BOOK_FILE"
  for _ in 1 2 3 4 5; do
    has_exact_text "$TEST_BOOK_FILE" && break
    adb_cmd shell input swipe 360 1370 360 560 250
    sleep 1
  done
  has_exact_text "$TEST_BOOK_FILE" || fail "No se pudo mostrar el archivo de prueba en Downloads."
  for _ in 1 2 3; do
    has_text "$TEST_BOOK_FILE" || break
    tap_file_tile "$TEST_BOOK_FILE"
    sleep 2
  done
  wait_text "$TEST_BOOK_TITLE"
fi

tap_text "Leer $TEST_BOOK_TITLE"
wait_text "Un libro de prueba"
sleep 4
tap_text "Abrir ajustes de lectura"
wait_text "Papel"
tap_text "Papel"
tap_text "Listo"
sleep 2
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
tap_text "Leer $TEST_BOOK_TITLE"
wait_text "Un libro de prueba"
sleep 5
capture reader-offline.png
if ! has_text "Abrir ajustes de lectura"; then fail "El lector local no se mantuvo disponible sin red."; fi

# The app-wide appearance is stored in SQLite and survives a process restart.
adb_cmd shell input keyevent 4
wait_text "Tus libros"
capture library-with-book.png
tap_text "Eliminar $TEST_BOOK_TITLE"
wait_text "Se eliminará"
tap_text "Eliminar"
wait_absent_text "$TEST_BOOK_TITLE"

initial_dark=0
if has_text "Activar modo claro"; then initial_dark=1; fi
tap_text "Ajustes"
if (( initial_dark == 0 )); then tap_text "Activar modo oscuro"; fi
wait_text "Modo oscuro"
adb_cmd shell am force-stop "$PACKAGE"
adb_cmd shell monkey -p "$PACKAGE" 1 >/dev/null
wait_text "Tus libros"
tap_text "Ajustes"
wait_text "Modo oscuro"

tap_text "Ajustes"
if (( initial_dark == 0 )); then tap_text "Activar modo claro"; fi

echo "E2E Android completado. Capturas: $ARTIFACT_DIR"
