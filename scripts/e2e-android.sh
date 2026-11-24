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
TEST_COLLECTION_NAME="Lumbre E2E ${TEST_BOOK_KEY//-/ }"

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
  echo "E2E: esperando '$needle'"
  until has_text "$needle"; do
    if (( SECONDS >= end )); then
      dump_xml > "$ARTIFACT_DIR/failure-screen.xml"
      adb_cmd exec-out screencap -p > "$ARTIFACT_DIR/failure-screen.png" 2>/dev/null || true
      fail "No apareció en pantalla: $needle (capturas de diagnóstico en $ARTIFACT_DIR)"
    fi
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

file_tile_bounds() {
  local label="$1"
  dump_xml | python3 -c 'import sys,xml.etree.ElementTree as E; label=sys.argv[1].casefold(); r=E.fromstring(sys.stdin.read()); parents={c:p for p in r.iter() for c in p}; matches=[]
for n in r.iter():
 if (n.get("text") or "").casefold()==label:
  p=parents.get(n)
  while p is not None:
   if p.get("class")=="androidx.cardview.widget.CardView" and p.get("clickable")=="true" and p.get("bounds"): matches.append(p.get("bounds")); break
   p=parents.get(p)
def area(b):
 import re
 a,c,d,e=map(int,re.findall(r"\d+",b)); return (d-a)*(e-c)
print(min(matches,key=area) if matches else "")' "$label"
}

has_file_tile() { [[ -n "$(file_tile_bounds "$1")" ]]; }

tap_file_tile() {
  local label="$1" bounds
  bounds="$(file_tile_bounds "$label")"
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
wait_text "Biblioteca"
tap_text "Biblioteca"
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
  tap_text "Search"
  adb_cmd shell input tap 350 95
  adb_cmd shell input text "$TEST_BOOK_FILE"
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    has_file_tile "$TEST_BOOK_FILE" && break
    sleep 1
  done
  has_file_tile "$TEST_BOOK_FILE" || fail "La búsqueda del archivo de prueba no devolvió una tarjeta en Downloads."
  wait_text "$TEST_BOOK_FILE"
  tap_file_tile "$TEST_BOOK_FILE"
  wait_text "$TEST_BOOK_TITLE"
fi

tap_text "＋ Crear"
tap_text "Nombre de la colección"
adb_cmd shell input text "${TEST_COLLECTION_NAME// /%s}"
tap_text "Guardar colección"
wait_text "$TEST_COLLECTION_NAME"
tap_text "Organizar $TEST_BOOK_TITLE"
tap_text "$TEST_COLLECTION_NAME"
wait_text "$TEST_BOOK_TITLE"
tap_text "$TEST_COLLECTION_NAME"
wait_text "$TEST_BOOK_TITLE"
capture library-collection.png
tap_text "Todos"

tap_text "Leer $TEST_BOOK_TITLE"
wait_text "Un libro de prueba"
sleep 4
tap_text "Abrir índice de contenidos"
wait_text "Capítulo 1"
capture reader-contents.png
tap_text "Ir a Capítulo 1"
tap_text "Añadir marcador"
wait_text "Marcador guardado"
tap_text "Cerrar marcadores"
adb_cmd shell input swipe 220 820 220 820 1100
sleep 1
# Readium attaches these actions to Android's native selection toolbar, which
# is visible in the screenshot but intentionally absent from UIAutomator's tree.
adb_cmd shell input tap 286 722
wait_text "Nota personal"
tap_text "Nota personal"
adb_cmd shell input text "Nota%se2e%spersistente"
tap_text "Guardar nota"
wait_text "Nota guardada"
has_text "Nota e2e persistente" || fail "La nota nueva no aparece en la lista de anotaciones."
capture reader-annotations.png
tap_text "Cerrar marcadores"
adb_cmd shell input keyevent 4
wait_text "Tus libros"
tap_text "Leer $TEST_BOOK_TITLE"
wait_text "Un libro de prueba"
tap_text "Abrir marcadores guardados"
wait_text "Marcadores (1)"
capture reader-bookmarks.png
tap_text "Notas y resaltados (1)"
wait_text "Nota e2e persistente"
capture reader-annotations-reopened.png
tap_text "Marcadores (1)"
tap_text "Cerrar marcadores"

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
