#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK="$ROOT_DIR/android/app/build/outputs/apk/release/app-release.apk"
DEVICE="${ANDROID_SERIAL:-}"
ARTIFACT_DIR="${LUMBRE_E2E_ARTIFACTS:-/tmp/lumbre-e2e}"
PACKAGE="app.lumbre.reader"

adb_cmd() {
  if [[ -n "$DEVICE" ]]; then adb -s "$DEVICE" "$@"; else adb "$@"; fi
}

fail() { echo "CATALOG E2E ERROR: $*" >&2; exit 1; }

mkdir -p "$ARTIFACT_DIR"
[[ -f "$APK" ]] || fail "Construye el APK release antes de ejecutar la prueba."
adb_cmd get-state >/dev/null 2>&1 || fail "No hay un dispositivo Android conectado."
adb_cmd install -r "$APK" >/dev/null

dump_xml() {
  adb_cmd shell uiautomator dump /sdcard/lumbre-catalog-window.xml >/dev/null 2>&1 || true
  adb_cmd exec-out cat /sdcard/lumbre-catalog-window.xml 2>/dev/null || true
}

has_text() {
  dump_xml | python3 -c 'import sys,xml.etree.ElementTree as E; n=sys.argv[1].casefold(); r=E.fromstring(sys.stdin.read()); sys.exit(0 if any(n in ((x.get("text") or "")+" "+(x.get("content-desc") or "")).casefold() for x in r.iter()) else 1)' "$1"
}

has_result_text() {
  dump_xml | python3 -c 'import sys,xml.etree.ElementTree as E,re; n=sys.argv[1].casefold(); r=E.fromstring(sys.stdin.read()); ok=False
for x in r.iter():
 if x.get("class")!="android.widget.TextView" or n not in (x.get("text") or "").casefold() or not x.get("bounds"): continue
 a,b,c,d=map(int,re.findall(r"\d+",x.get("bounds")))
 if c>a and d>b and a<720 and c>0 and b<1600 and d>0: ok=True; break
sys.exit(0 if ok else 1)' "$1"
}

has_visible_download_button() {
  dump_xml | python3 -c 'import sys,xml.etree.ElementTree as E,re; r=E.fromstring(sys.stdin.read()); ok=False
for x in r.iter():
 d=(x.get("content-desc") or "")
 if not d.startswith("Descargar ") or not x.get("bounds"): continue
 a,b,c,e=map(int,re.findall(r"\d+",x.get("bounds")))
 if c>a and e>b and a<720 and c>0 and b<1600 and e>0 and x.get("clickable")=="true": ok=True; break
sys.exit(0 if ok else 1)'
}

wait_text() {
  local needle="$1" timeout="${2:-35}" end
  end=$((SECONDS + timeout))
  echo "Catalog E2E: esperando '$needle'"
  until has_text "$needle"; do
    if (( SECONDS >= end )); then
      dump_xml > "$ARTIFACT_DIR/catalog-failure.xml"
      adb_cmd exec-out screencap -p > "$ARTIFACT_DIR/catalog-failure.png" 2>/dev/null || true
      fail "No apareció: $needle (diagnóstico en $ARTIFACT_DIR)"
    fi
    sleep 1
  done
}

wait_result() {
  local needle="$1" timeout="${2:-35}" end
  end=$((SECONDS + timeout))
  echo "Catalog E2E: esperando resultado '$needle'"
  until has_result_text "$needle"; do
    if (( SECONDS >= end )); then
      dump_xml > "$ARTIFACT_DIR/catalog-failure.xml"
      adb_cmd exec-out screencap -p > "$ARTIFACT_DIR/catalog-failure.png" 2>/dev/null || true
      fail "No apareció el resultado visible: $needle (diagnóstico en $ARTIFACT_DIR)"
    fi
    sleep 1
  done
}

tap_text() {
  local needle="$1" bounds
  bounds="$(dump_xml | python3 -c 'import sys,xml.etree.ElementTree as E,re; n=sys.argv[1].casefold(); r=E.fromstring(sys.stdin.read()); ns=[]
for x in r.iter():
 if n not in ((x.get("text") or "")+" "+(x.get("content-desc") or "")).casefold() or not x.get("bounds"): continue
 a,b,c,d=map(int,re.findall(r"\d+",x.get("bounds")))
 if c>a and d>b and a<720 and c>0 and b<1600 and d>0: ns.append(x)
ns.sort(key=lambda x: (x.get("clickable")!="true", len(x.get("content-desc") or x.get("text") or ""))); print(ns[0].get("bounds") if ns else "")' "$needle")"
  [[ -n "$bounds" ]] || fail "No se encontró el control visible: $needle"
  read -r x y < <(python3 -c 'import re,sys; a,b,c,d=map(int,re.findall(r"\d+",sys.argv[1])); print((a+c)//2,(b+d)//2)' "$bounds")
  adb_cmd shell input tap "$x" "$y"
}

capture() { adb_cmd exec-out screencap -p > "$ARTIFACT_DIR/$1.png"; }

adb_cmd shell am force-stop "$PACKAGE"
adb_cmd shell monkey -p "$PACKAGE" 1 >/dev/null
sleep 6
wait_text "Biblioteca"
tap_text "Descubrir"
wait_text "Entiendo que el estado de derechos depende de mi país"
tap_text "Entiendo que el estado de derechos depende de mi país"

# Search a known Open Library public EPUB and download it inside the app. This
# exercises Archive.org metadata validation, EPUB transfer, SQLite, and library import.
for _ in {1..4}; do adb_cmd shell input swipe 360 300 360 1350 400; done
tap_text "Buscar por título o autor"
adb_cmd shell input text 'Pride%sand%sPrejudice'
tap_text "Buscar libros"
wait_result "Pride and Prejudice" 60
wait_text "Descargar EPUB" 20
for _ in {1..5}; do
  has_visible_download_button && break
  adb_cmd shell input swipe 360 1270 360 730 450
done
has_visible_download_button || fail "No hay una acción de descarga visible en los resultados EPUB."
tap_text "Descargar EPUB"
wait_text "Descargado" 90
capture catalog-real-download.png

for _ in {1..4}; do adb_cmd shell input swipe 360 300 360 1350 400; done
tap_text "Buscar por título o autor"
adb_cmd shell input text 'Atomic%sHabits'
tap_text "Buscar libros"
wait_result "James Clear" 40
wait_text "Acceso para impresión; sin descarga EPUB" 20
capture catalog-atomic-habits.png

for _ in {1..4}; do adb_cmd shell input swipe 360 300 360 1350 400; done
tap_text "Buscar por título o autor"
adb_cmd shell input keyevent 123
adb_cmd shell input keyevent --longpress 67
adb_cmd shell input text 'ley%sde%satraccion%suniversal'
tap_text "Buscar libros"
wait_result "La Ley Universal de La Atracción" 40
capture catalog-law-of-attraction.png

echo "Catálogo Android completado. Capturas: $ARTIFACT_DIR"
