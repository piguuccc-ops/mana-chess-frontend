#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Builds the Mana Chess Android app (an APK) around the game page – no Gradle, no Android Studio:
# only the Android SDK's command-line tools and a JDK (17 or newer).
#
#   npm run build                    # first the game page: dist/mana-chess.html
#   ./android/build.sh               # → android/build/mana-chess.apk
#
# Settings (environment variables, all optional):
#   MANA_BACKEND=https://chess.example.com   the server the app offers by default (online play)
#   VERSION_CODE=7  VERSION_NAME=1.2.0        the app's version (each update needs a higher code)
#   KEYSTORE=…  KEYSTORE_PASSWORD=…  KEY_ALIAS=…  KEY_PASSWORD=…
#                                            the signing key – keep using the same one, or phones
#                                            refuse the update; without one a throwaway key is made
#   GAME_HTML=path/to/mana-chess.html        (default: dist/mana-chess.html next to this folder)
#   ANDROID_HOME=…                           the SDK (build-tools and a platform ≥ 33 are used)
#   Tools one by one instead of ANDROID_HOME: AAPT2, ANDROID_JAR, D8 (or DX_JAR), ZIPALIGN,
#   APKSIGNER (or UBER_SIGNER: uber-apk-signer.jar, which aligns and signs in one go)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
APP="$HERE/app/src/main"
OUT="$HERE/build"
GAME_HTML="${GAME_HTML:-$ROOT/dist/mana-chess.html}"
MIN_SDK=24
TARGET_SDK=34

say() { printf '\033[1;33m▶ %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

[ -f "$GAME_HTML" ] || die "Nincs meg a játékoldal: $GAME_HTML – előbb: npm run build (vagy GAME_HTML=…)"
command -v java >/dev/null || die "Kell egy JDK (java, javac) – legalább 17-es."
command -v javac >/dev/null || die "Kell a javac (JDK, nem csak JRE)."

# ── the SDK tools ──
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [ -n "$SDK" ] && [ -d "$SDK/build-tools" ]; then
  BT="$(ls -d "$SDK"/build-tools/*/ 2>/dev/null | sort -V | tail -n 1)"
  BT="${BT%/}"
  AAPT2="${AAPT2:-$BT/aapt2}"
  ZIPALIGN="${ZIPALIGN:-$BT/zipalign}"
  APKSIGNER="${APKSIGNER:-$BT/apksigner}"
  [ -z "${DX_JAR:-}" ] && D8="${D8:-$BT/d8}"
  if [ -z "${ANDROID_JAR:-}" ]; then
    for v in 34 35 33 36; do
      if [ -f "$SDK/platforms/android-$v/android.jar" ]; then ANDROID_JAR="$SDK/platforms/android-$v/android.jar"; break; fi
    done
  fi
fi
[ -n "${AAPT2:-}" ] && [ -x "$AAPT2" ] || die "Nincs aapt2 – állítsd be az ANDROID_HOME-ot (build-tools) vagy az AAPT2-t."
[ -n "${ANDROID_JAR:-}" ] && [ -f "$ANDROID_JAR" ] || die "Nincs android.jar (platforms/android-33 vagy újabb) – ANDROID_HOME vagy ANDROID_JAR."

VERSION_CODE="${VERSION_CODE:-1}"
VERSION_NAME="${VERSION_NAME:-$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$ROOT/package.json" 2>/dev/null | head -n 1)}"
VERSION_NAME="${VERSION_NAME:-1.0.0}"

rm -rf "$OUT"
mkdir -p "$OUT/assets/www" "$OUT/gen" "$OUT/classes" "$OUT/dex"

# ── 1. the game page goes into the app (with the default server, if one is given) ──
say "Játékoldal: $GAME_HTML"
if [ -n "${MANA_BACKEND:-}" ]; then
  SAFE="$(printf '%s' "$MANA_BACKEND" | tr -cd 'A-Za-z0-9:/._[]%-')"
  say "Alapértelmezett szerver: $SAFE"
  python3 - "$GAME_HTML" "$OUT/assets/www/index.html" "$SAFE" <<'PY'
import re, sys
src, dst, backend = sys.argv[1], sys.argv[2], sys.argv[3]
html = open(src, encoding='utf-8').read()
tag = '<meta name="mana-chess-backend" content="%s">' % backend
html = re.sub(r'<head[^>]*>', lambda m: m.group(0) + tag, html, count=1) if re.search(r'<head[^>]*>', html, re.I) else tag + html
open(dst, 'w', encoding='utf-8').write(html)
PY
else
  cp "$GAME_HTML" "$OUT/assets/www/index.html"
fi

# ── 2. resources and the manifest ──
say "Erőforrások (aapt2)"
"$AAPT2" compile --dir "$APP/res" -o "$OUT/res.zip"
"$AAPT2" link -o "$OUT/base.apk" -I "$ANDROID_JAR" \
  --manifest "$APP/AndroidManifest.xml" \
  --min-sdk-version "$MIN_SDK" --target-sdk-version "$TARGET_SDK" \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  -A "$OUT/assets" --java "$OUT/gen" --auto-add-overlay \
  "$OUT/res.zip"

# ── 3. the code ──
say "Java → bytecode"
find "$APP/java" "$OUT/gen" -name '*.java' > "$OUT/sources.txt"
javac --release 8 -nowarn -encoding UTF-8 -classpath "$ANDROID_JAR" -d "$OUT/classes" @"$OUT/sources.txt" 2>&1 | grep -v '^warning: \[options\]' || true
[ -n "$(find "$OUT/classes" -name '*.class' -print -quit)" ] || die "A Java-fordítás nem sikerült."

say "Bytecode → dex"
if [ -n "${D8:-}" ] && [ -x "${D8:-}" ]; then
  "$D8" --release --min-api "$MIN_SDK" --lib "$ANDROID_JAR" --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')
elif [ -n "${DX_JAR:-}" ] && [ -f "$DX_JAR" ]; then
  java -cp "$DX_JAR" com.android.dx.command.Main --dex --min-sdk-version="$MIN_SDK" --output="$OUT/dex/classes.dex" "$OUT/classes"
else
  die "Nincs d8 (build-tools) vagy DX_JAR."
fi

# ── 4. into one package, aligned and signed ──
say "Csomagolás"
cp "$OUT/base.apk" "$OUT/unsigned.apk"
(cd "$OUT/dex" && zip -q -X "$OUT/unsigned.apk" classes.dex)

if [ -z "${KEYSTORE:-}" ]; then
  KEYSTORE="$OUT/throwaway.keystore"
  KEYSTORE_PASSWORD="android"
  KEY_ALIAS="manachess"
  KEY_PASSWORD="android"
  say "FIGYELEM: nincs aláíró kulcs (KEYSTORE) – eldobható kulccsal írom alá. Az ilyen APK nem frissíthető egy másik kulccsal aláírtra."
  keytool -genkeypair -keystore "$KEYSTORE" -storepass "$KEYSTORE_PASSWORD" -keypass "$KEY_PASSWORD" -alias "$KEY_ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Mana Chess, O=Mana Chess, C=HU" >/dev/null 2>&1
fi
KEY_PASSWORD="${KEY_PASSWORD:-$KEYSTORE_PASSWORD}"

APK="$OUT/mana-chess.apk"
if [ -n "${UBER_SIGNER:-}" ]; then
  say "Igazítás és aláírás (uber-apk-signer)"
  mkdir -p "$OUT/signed"
  java -jar "$UBER_SIGNER" -a "$OUT/unsigned.apk" -o "$OUT/signed" \
    --ks "$KEYSTORE" --ksAlias "$KEY_ALIAS" --ksPass "$KEYSTORE_PASSWORD" --ksKeyPass "$KEY_PASSWORD" >/dev/null
  mv "$(ls "$OUT"/signed/*.apk | head -n 1)" "$APK"
else
  [ -n "${ZIPALIGN:-}" ] && [ -x "$ZIPALIGN" ] || die "Nincs zipalign (build-tools)."
  [ -n "${APKSIGNER:-}" ] && [ -x "$APKSIGNER" ] || die "Nincs apksigner (build-tools)."
  say "Igazítás és aláírás"
  "$ZIPALIGN" -p -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
  KS_PASS="$KEYSTORE_PASSWORD" K_PASS="$KEY_PASSWORD" "$APKSIGNER" sign --ks "$KEYSTORE" --ks-key-alias "$KEY_ALIAS" \
    --ks-pass env:KS_PASS --key-pass env:K_PASS --min-sdk-version "$MIN_SDK" --out "$APK" "$OUT/aligned.apk"
  "$APKSIGNER" verify --min-sdk-version "$MIN_SDK" "$APK"
fi

say "Kész: $APK ($(du -h "$APK" | cut -f1), verzió $VERSION_NAME / $VERSION_CODE)"
