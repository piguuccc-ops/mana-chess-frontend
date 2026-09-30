@echo off
rem Mana Chess jatekoldal (frontend): csak a jatekot adja a bongeszoknek. Dupla kattintas eleg.
title Mana Chess jatekoldal
cd /d "%~dp0"
rem Ha a jatek magatol ezt a szervert ajanlja, ird be ide a backend cimet (pl. https://sakk-api.pelda.hu):
set MANA_BACKEND=
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Ehhez Node.js kell, de nincs telepitve.
  echo   Toltsd le az LTS verziot: https://nodejs.org  - telepites utan inditsd ujra ezt a fajlt.
  echo.
  echo   Node.js is not installed. Get the LTS version from https://nodejs.org and run this file again.
  echo.
  start "" https://nodejs.org/
  pause
  exit /b 1
)
node frontend.mjs %*
echo.
pause
