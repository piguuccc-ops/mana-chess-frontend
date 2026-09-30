MANA CHESS JÁTÉKOLDAL (FRONTEND)
===============================

Ez a program csak a játékot adja a böngészőknek (mana-chess.html) – semmi mást. A fiókok,
paklik, barátok és szobák a backendben vannak; a játék az Online résznél kapcsolódik hozzá.


INDÍTÁS
-------
  Windows:        Start.bat (dupla kattintás)
  macOS / Linux:  ./start.sh
  Kézzel:         node frontend.mjs

  Kapcsolók:
    --port 8081                   másik port (alapból 8080)
    --backend https://…           alapértelmezett backend a játékban (lásd lent)
    --game valami\mana-chess.html egy másik játékfájl
    --no-open                     ne nyissa meg a böngészőt

Az ablak kiírja a címeit; a többiek a „helyi hálózaton” címet nyitják meg a böngészőjükben
(pl. http://192.168.1.23:8080). Telefonon is: ugyanazon a Wi-Fi-n ugyanez a cím.


MELYIK BACKENDHEZ KAPCSOLÓDIK A JÁTÉK?
--------------------------------------
  1) Ha be van állítva, az alapértelmezetthez: a Start.bat-ban írd be a backend címét
         set MANA_BACKEND=https://sakk-api.pelda.hu
     (vagy: node frontend.mjs --backend https://sakk-api.pelda.hu)
  2) Ha nincs beállítva, és a játékoldalt http-n nyitották meg, a játék megpróbálja
     ugyanezen a gépen a 8787-es portot – ha a backend is itt fut, magától megtalálja.
  3) Különben a játékos írja be a címet (Online → „Kapcsolódás a szerverhez”).
  A játék megjegyzi a legutóbbi szervert és – ha kéred – a bejelentkezést is.


INTERNETEN (NGINX PROXY MANAGER)
--------------------------------
  Hosts → Proxy Hosts → Add Proxy Host:
     Domain Names: sakk.pelda.hu, Scheme: http, Forward: ennek a gépnek a címe, port 8080,
     SSL: Request a new SSL Certificate + Force SSL.
  Mivel ez az oldal https-en fut, a backendet is https-sel kell elérni (a böngésző https
  oldalról nem enged http-s címre kapcsolódni): állítsd be MANA_BACKEND-nek a backend
  https-es címét (lásd a backend README-jét).

  Egy domainnel is megoldható: az NPM Proxy Host „Custom locations” fülén a /api és az
  /admin útvonalat irányítsd a backendre (port 8787), a többit a játékoldalra (port 8080),
  és legyen MANA_BACKEND=https://sakk.pelda.hu.


FRISSÍTÉS
---------
A mana-chess.html fájlt lecserélheted újra (a program minden kérésnél ellenőrzi, és az
újat adja). Ügyelj rá, hogy a backend és a játék ugyanabból a kiadásból legyen.
