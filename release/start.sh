#!/bin/sh
# Mana Chess játékoldal indítása (macOS / Linux): ./start.sh   (alapértelmezett backend: MANA_BACKEND=https://… ./start.sh)
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Ehhez Node.js kell: https://nodejs.org (LTS verzió)"
  exit 1
fi
exec node frontend.mjs "$@"
