# Mana Chess – egyensúly-teszt

> Generált fájl (`npm run balance`, 2026-09-27). A beépített AI játszik saját maga ellen, a játék szabályai szerint, véletlen (szabályos) paklikkal – ugyanazzal a generátorral, mint a menü „Véletlen pakli” gombja. Minden paklipár kétszer játszik, egyszer-egyszer mindkét színnel.

**Minta:** 1000 mana-játszma (500 paklipár) · 200 tiszta sakk kontrolljátszma (üres paklik, ugyanaz az AI) · seed 1, gépidő 77 perc (2 szálon ~38 perc).

Megismétlés: `npm run balance -- --games 1000 --control 200 --seed 1` (ugyanazok a játszmák; más seed független mintát ad).

**AI:** a játékbeli ellenfél keresője (2 lépés mélyen), bátrabb spellhasználattal: kijátssza a lapot, ha az azonnali értékelés szerint megéri (1 mana = 0.15 gyalog, a plafonon túlcsorduló kristály semmit sem ér, a kéz továbbforgatása 0.3 gyalogot ér; küszöb 0.05); lapkombinációnként 24 célpont-próba, az egész táblán szétszórva. A játékbeli ellenfél óvatosabb (1 mana = 0.28 gyalog, küszöb 0.45): ez a profil 40 játszmás párbajban 73.8% ± 13.1 pontot szerzett ellene, játszmánként 12 spellel az ő 2.5-ével szemben.


**Összehasonlítás:** az „előtte” számok a módosítások előtti szabályok futásából valók (1000 mana-játszma). Azonos seed mellett ugyanazok a paklipárok játszanak, így a különbség a szabályváltozásokból jön (és a játszmák véletlenéből).

## Röviden

- **Kezdés előnye:** Világos pontszáma 46.5% (± 3.1) (előtte 48.5%); ugyanez az AI tiszta sakkban: 46.5% (± 6.7).
- **Hossz:** átlag 42 lépés (medián 37) (előtte 39, medián 32); tiszta sakkban 52 (medián 41).
- **Vége:** 55% matt; döntetlen 2%; a szimuláció anyagi szabálya döntött 43%-ban.
- **Spellhasználat:** játszmánként átlag 29.5 kijátszás (73 mana) (előtte 26.2); oldalanként 16.0 mana veszett el a 6-os plafon miatt.
- **Szórás a lapok között** (a Δ-k négyzetes átlaga, a kiegyensúlyozottság mércéje): 6.6 százalékpont (előtte 10.1; tökéletes egyensúlynál is kb. 4.0 maradna a véletlen miatt). Kiugró lap 99%-on: 4 (előtte 14).
- **Legnagyobb változások:** Meteor (6) +34.6 → +10.7, Végzet (6) +27.6 → +6.1, Valóságtörés (6) +28.1 → +9.2, Sárkánytűz (6) +30.0 → +13.8, Tükör (3) +8.8 → −6.9, Futóáldás (2) +8.3 → −5.7, Mana-letét (2) −7.8 → +4.3, Mana mágus (2) +12.7 → +1.0, Akna (4) −4.1 → +6.1, Taszítás (3) +9.2 → −0.0.
- **Kiugróan erős (95%):** Sárkánytűz (6) +13.8, Csere (3) +12.3, Provokáció (3) +10.7, Meteor (6) +10.7, Klón (3) +9.6, Valóságtörés (6) +9.2, Francia sajt (3) +9.0.
- **Kiugróan gyenge (95%):** Brigád (3) −29.1, Dupla lépés (4) −14.9, Áldozat (1) −8.4, Gyalogugrás (2) −7.5.
- **Leggyakrabban kijátszva:** Gambit (1) 6.3/játszma, Mana mágus (2) 5.5/játszma, Mana-letét (2) 5.0/játszma, Fal (1) 4.9/játszma, Arcane Surge (1) 4.9/játszma, Gyalogfagyasztás (1) 4.6/játszma.
- **Az AI ritkán használja** (a paklik kevesebb mint 25%-ában kerül sorra): Dupla lépés (4) 1%, Mana-szomj (3) 7%, Megerősítés (4) 13%, Utolsó esély (3) 15%.

## Kezdés előnye

Pontszám: győzelem 1, döntetlen ½. A ± a 95%-os konfidenciaintervallum fele (százalékpont).

| | Játszma | Világos nyer | Döntetlen | Sötét nyer | Világos pontszáma |
|---|---:|---:|---:|---:|---:|
| Mana sakk | 1000 | 45.5% | 2.0% | 52.5% | **46.5%** ± 3.1 |
| Mana sakk, csak a szabályok szerint¹ | 1000 | 26.2% | 44.6% | 29.2% | **48.5%** ± 2.3 |
| Tiszta sakk (kontroll) | 200 | 43.0% | 7.0% | 50.0% | **46.5%** ± 6.7 |
| Tiszta sakk, csak a szabályok szerint¹ | 200 | 25.0% | 46.0% | 29.0% | **48.0%** ± 5.1 |

¹ A szimuláció anyagi döntései nélkül: ami ott megítélt győzelem, itt döntetlen.

## A játszmák hossza

| | Átlag | Medián | 10–90% |
|---|---:|---:|---:|
| Mana sakk | 42.4 | 37 | 21–72 |
| Tiszta sakk | 52.4 | 41 | 25–101 |

| Lépés | Mana sakk | Tiszta sakk |
|---|---|---|
| 1–10 | █ 2% |  0% |
| 11–20 | ████ 7% | ████ 6% |
| 21–30 | ███████████████ 24% | ████████████ 20% |
| 31–40 | ████████████████ 27% | ██████████████ 23% |
| 41–50 | ███████████ 18% | ████████ 14% |
| 51–60 | ████ 7% | ██████ 10% |
| 61–80 | ████ 7% | █████ 8% |
| 81–100 | ██ 3% | ██████ 10% |
| 101–120 | █ 2% | ██ 4% |
| 120+ | ██ 3% | ████ 7% |

## Hogyan értek véget

| | Mana sakk | Tiszta sakk |
|---|---:|---:|
| Matt | 554 (55%) | 108 (54%) |
| Feladás: 10+ anyagelőny 10 teljes lépésen át | 393 (39%) | 61 (31%) |
| 50 lépéses szabály – anyagelőny (3+) döntött | 13 (1%) | 8 (4%) |
| 50 lépéses szabály – döntetlen | 8 (1%) | 9 (5%) |
| Patt | 0 (0%) | 0 (0%) |
| Csak a királyok maradtak | 1 (0%) | 0 (0%) |
| Lépéslimit (120 lépés) – anyagelőny (3+) döntött | 20 (2%) | 9 (5%) |
| Lépéslimit (120 lépés) – döntetlen | 11 (1%) | 5 (3%) |

A beépített AI lassan mattol, ezért a szimuláció két helyen dönt a szabályok helyett: aki 10+ anyagelőnyt (≈ egy vezér) 10 teljes lépésen át megtart, az nyer („feladás”); az 50 lépéses szabálynál és a lépéslimitnél pedig 3+ anyagelőny (≈ egy könnyűtiszt) győzelmet ér. Anyag: gyalog 1, huszár/futó 3, bástya 5, vezér 9; a rabszolga (nem üt) és a klón (egy ütés után eltűnik) fél értékkel.

## Spellek

Rendezés: Δ szerint, a legerősebbtől. Minden sor azokat a játszmákat nézi, ahol a lap pontosan az egyik pakliban volt.

- **Pontszám:** a lapot tartó fél átlagos pontszáma. **Δ:** eltérés attól, amit az adott szín egyébként átlagosan elér (százalékpont) ± 95%-os intervallum. ▲/▼: 95%-os, ▲▲/▼▼: 99%-os eltérés. 71 lap mellett 95%-on 3–4 téves riasztás várható, ezért a szimpla jelzés csak gyanú.
- **Sorra került:** a paklik hány százalékában játszotta ki legalább egyszer. **/játszma:** kijátszások száma játszmánként.
- **Kijátszható:** a kézben töltött körök hány százalékában volt a kör valamely pontján elég mana és érvényes célpont; **ebből kijátszva:** ezekből hányszor élt vele az AI.
- **Anyag:** átlagos anyagváltozás a varázsló szemszögéből a kijátszástól a következő saját köréig, az ellenfél válaszával együtt (értékek, mint lent a játszmák végénél).

| Spell | Mana | Játszma | Pontszám | Δ | | Δ előtte | Sorra került | /játszma | Kijátszható | ebből kijátszva | Első (lépés) | Anyag |
|---|---:|---:|---:|---:|:-:|---:|---:|---:|---:|---:|---:|---:|
| 🐉 Sárkánytűz | 6 | 120 | 63.7% | +13.8 ± 8.5 | ▲▲ | +30.0 | 95% | 2.66 | 20% | 82% | 7 | +2.6 |
| 🔄 Csere | 3 | 150 | 62.3% | +12.3 ± 7.6 | ▲▲ | +6.3 | 97% | 2.72 | 69% | 21% | 11 | +0.7 |
| 📣 Provokáció | 3 | 136 | 60.7% | +10.7 ± 8.2 | ▲ | +7.7 | 98% | 2.93 | 68% | 19% | 11 | +0.8 |
| ☄️ Meteor | 6 | 122 | 60.7% | +10.7 ± 8.5 | ▲ | +34.6 | 99% | 2.50 | 19% | 82% | 8 | +3.4 |
| 🧬 Klón | 3–5 | 162 | 59.6% | +9.6 ± 7.4 | ▲ | +15.8 | 98% | 2.54 | 14% | 96% | 5 | +1.3 |
| 🔮 Valóságtörés | 6 | 158 | 59.2% | +9.2 ± 7.6 | ▲ | +28.1 | 90% | 1.66 | 46% | 13% | 13 | +1.9 |
| 🧀 Francia sajt | 3 | 172 | 59.0% | +9.0 ± 7.4 | ▲ | +14.8 | 72% | 1.08 | 5% | 63% | 16 | +2.0 |
| 🪝 Mágnes | 3 | 118 | 57.6% | +7.6 ± 8.8 |  | −1.1 | 93% | 2.25 | 76% | 11% | 15 | +1.3 |
| 🔨 Pajzsromboló | 3 | 158 | 56.6% | +6.6 ± 7.6 |  | −0.4 | 96% | 2.80 | 74% | 16% | 12 | +0.9 |
| 🌑 Végzet | 6 | 122 | 56.1% | +6.1 ± 8.7 |  | +27.6 | 98% | 2.77 (77 felébredt) | 18% | 94% | 7 | +2.4 |
| 💣 Akna | 4 | 172 | 56.1% | +6.1 ± 7.4 |  | −4.1 | 99% | 3.84 | 41% | 86% | 5 | +0.7 |
| 🕳️ Gravitációs kút | 4 | 148 | 56.1% | +6.1 ± 8.0 |  | +2.3 | 95% | 2.97 | 62% | 26% | 9 | +1.0 |
| 🌌 Dimenzióváltás | 5 | 156 | 55.8% | +5.8 ± 7.8 |  | −2.4 | 77% | 1.43 | 51% | 11% | 19 | +1.0 |
| ⚡ Arcane Surge | 1 | 198 | 55.1% | +5.1 ± 6.9 |  | −1.9 | 100% | 4.88 | 64% | 89% | 4 | +0.2 |
| 🧭 Cserkész | 1 | 170 | 55.0% | +5.0 ± 7.5 |  | −4.0 | 98% | 2.68 | 71% | 16% | 11 | −0.3 |
| ⏪ Visszatekerés | 5 | 122 | 54.9% | +4.9 ± 8.7 |  | +11.1 | 95% | 2.60 | 50% | 23% | 12 | +1.7 |
| 🌀 Teleport | 5 | 102 | 54.9% | +4.9 ± 9.6 |  | −3.4 | 91% | 1.92 | 51% | 14% | 17 | +0.5 |
| 🧟 Nekromancia | 2 | 190 | 54.5% | +4.5 ± 7.0 |  | +4.2 | 96% | 3.86 | 26% | 88% | 11 | +1.2 |
| 🚫 Hatástalanítás | 2 | 162 | 54.3% | +4.3 ± 7.7 |  | +1.9 | 99% | 4.28 | 79% | 34% | 7 | +0.2 |
| 🏦 Mana-letét | 2 | 164 | 54.3% | +4.3 ± 7.6 |  | −7.8 | 98% | 5.01 | 69% | 88% | 5 | −0.2 |
| 🔋 Túltöltés | 2 | 200 | 54.0% | +4.0 ± 6.8 |  | −1.3 | 94% | 3.21 | 86% | 16% | 10 | +0.3 |
| ⚔️ Kivégzés | 5 | 98 | 53.6% | +3.6 ± 9.7 |  | +12.5 | 100% | 2.91 | 22% | 96% | 7 | +2.4 |
| ⏸️ Időmegállítás | 5 | 144 | 53.5% | +3.5 ± 8.0 |  | +9.0 | 91% | 2.21 | 50% | 17% | 15 | +0.9 |
| 🏰 Bástyatöltés | 2 | 190 | 53.4% | +3.4 ± 7.0 |  | −3.3 | 98% | 3.18 | 62% | 25% | 9 | +0.4 |
| ☢️ Mana-armageddon | 4 | 130 | 52.3% | +2.3 ± 8.5 |  | +3.6 | 99% | 3.16 | 47% | 48% | 6 | +0.1 |
| 🎓 Átképzés | 2 | 196 | 52.0% | +2.0 ± 6.9 |  | +0.5 | 99% | 2.59 | 55% | 23% | 4 | +0.6 |
| 🐎 Huszárugrás | 2 | 198 | 52.0% | +2.0 ± 6.9 |  | −2.8 | 98% | 2.44 | 26% | 43% | 5 | +0.9 |
| 🥾 Erőltetett menet | 2 | 140 | 51.8% | +1.8 ± 8.2 |  | −0.4 | 98% | 3.25 | 72% | 26% | 8 | +0.7 |
| 🙈 Vakfolt | 2 | 172 | 51.2% | +1.2 ± 7.4 |  | −2.9 | 99% | 3.96 | 80% | 32% | 7 | +0.2 |
| 🧙 Mana mágus | 2 | 156 | 51.0% | +1.0 ± 7.7 |  | +12.7 | 98% | 5.52 | 66% | 90% | 4 | −0.1 |
| ❄️ Gyalogfagyasztás | 1 | 156 | 51.0% | +1.0 ± 7.8 |  | +5.9 | 99% | 4.56 | 75% | 83% | 4 | +0.1 |
| 🃏 Gambit | 1 | 160 | 50.6% | +0.6 ± 7.7 |  | +2.4 | 97% | 6.30 | 92% | 31% | 8 | −0.1 |
| 🏃 Gyalogroham | 2 | 182 | 50.5% | +0.5 ± 7.2 |  | −1.1 | 48% | 0.70 | 51% | 4% | 20 | −0.0 |
| 🧛 Manaelszívás | 3 | 148 | 50.3% | +0.3 ± 7.9 |  | −2.0 | 99% | 3.99 | 63% | 43% | 6 | +0.1 |
| 👑 Vezér kegyelme | 3 | 160 | 50.0% | −0.0 ± 7.7 |  | −4.7 | 29% | 0.39 | 65% | 2% | 27 | +0.5 |
| 🤐 Némaság | 2 | 194 | 50.0% | −0.0 ± 6.9 |  | −5.7 | 92% | 2.70 | 86% | 15% | 9 | +0.2 |
| 🌬️ Taszítás | 3 | 138 | 50.0% | −0.0 ± 8.3 |  | +9.2 | 99% | 3.07 | 66% | 20% | 10 | +0.8 |
| 👻 Láthatatlanság | 2 | 164 | 49.7% | −0.3 ± 7.6 |  | +4.6 | 94% | 2.81 | 83% | 15% | 11 | −0.1 |
| 🌋 Földrengés | 3 | 158 | 49.1% | −0.9 ± 7.7 |  | −8.2 | 79% | 1.22 | 80% | 5% | 18 | +1.1 |
| 🧪 Mana-szomj ◌ | 3 | 136 | 48.9% | −1.1 ± 8.3 |  | −1.3 | 7% | 0.14 | 86% | 0% | 19 | −0.6 |
| 🌿 Gyökér | 2 | 178 | 48.9% | −1.1 ± 7.3 |  | +2.0 | 94% | 2.70 | 84% | 15% | 10 | +0.1 |
| 🚨 Vészcsere | 4 | 138 | 48.6% | −1.4 ± 8.2 |  | −6.5 | 76% | 1.11 | 59% | 6% | 20 | +0.8 |
| 🛡️ Gyalogpajzs | 1 | 200 | 48.3% | −1.8 ± 6.8 |  | −3.5 | 100% | 4.46 | 66% | 88% | 4 | +0.0 |
| 🩸 Vérár | 2 | 170 | 48.2% | −1.8 ± 7.5 |  | −4.8 | 74% | 1.21 | 90% | 4% | 19 | −1.0 |
| ⚜️ Királyvédelem | 3 | 166 | 48.2% | −1.8 ± 7.5 |  | −6.8 | 71% | 1.33 | 84% | 5% | 21 | +0.1 |
| 🌟 Azonnali átváltozás | 5 | 108 | 48.1% | −1.9 ± 9.2 |  | −2.4 | 30% | 0.34 | 1% | 93% | 31 | +7.3 |
| 🧱 Fal | 1 | 170 | 47.9% | −2.1 ± 7.4 |  | −9.9 | 100% | 4.89 | 86% | 79% | 4 | +0.2 |
| 🌪️ Vihar | 4 | 144 | 47.6% | −2.4 ± 8.1 |  | −5.8 | 55% | 0.76 | 58% | 4% | 20 | +0.1 |
| 🕊️ Utolsó esély ◌ | 3 | 170 | 47.4% | −2.6 ± 7.4 |  | −11.7 | 15% | 0.19 | 43% | 1% | 20 | +1.5 |
| 🔰 Huszárpajzs | 2 | 160 | 47.2% | −2.8 ± 7.6 |  | −4.6 | 92% | 2.13 | 45% | 19% | 9 | +0.1 |
| 💀 Halálbélyeg | 2 | 168 | 47.0% | −3.0 ± 7.4 |  | +0.3 | 97% | 2.82 | 87% | 15% | 10 | −0.0 |
| 👋 El az útból! | 2 | 164 | 47.0% | −3.0 ± 7.6 |  | −0.6 | 92% | 2.83 | 86% | 15% | 11 | −0.0 |
| ↩️ Visszalépés | 3 | 160 | 46.9% | −3.1 ± 7.7 |  | −2.4 | 96% | 2.68 | 76% | 17% | 12 | +0.4 |
| 💠 Üvegátok | 2–3 | 172 | 46.8% | −3.2 ± 7.4 |  | −7.8 | 94% | 3.02 | 86% | 16% | 10 | +0.1 |
| 🧲 Gravitáció | 2 | 168 | 46.1% | −3.9 ± 7.5 |  | −11.8 | 91% | 2.31 | 59% | 14% | 9 | −0.1 |
| 🏯 Újrasáncolás | 1 | 154 | 46.1% | −3.9 ± 7.7 |  | −10.6 | 33% | 0.51 | 2% | 92% | 18 | −0.1 |
| 🏁 Gyorssánc | 2 | 176 | 45.2% | −4.8 ± 7.3 |  | −7.3 | 41% | 0.41 | 4% | 26% | 11 | +0.4 |
| ☠️ Végítélet | 4 | 144 | 44.8% | −5.2 ± 8.0 |  | −9.3 | 78% | 1.26 | 5% | 83% | 15 | +0.9 |
| ✨ Futóáldás | 2 | 158 | 44.3% | −5.7 ± 7.7 |  | +8.3 | 88% | 1.96 | 56% | 14% | 10 | +0.1 |
| 🚧 Barikád | 3 | 160 | 44.1% | −5.9 ± 7.7 |  | −2.3 | 83% | 1.71 | 83% | 7% | 20 | +0.3 |
| 🎲 Káosz | 4 | 124 | 44.0% | −6.0 ± 8.7 |  | +1.9 | 82% | 1.45 | 71% | 7% | 17 | +0.9 |
| 💪 Megerősítés ◌ | 4 | 140 | 43.9% | −6.1 ± 8.3 |  | −9.3 | 13% | 0.23 | 76% | 1% | 14 | +0.5 |
| 🥀 Gyengítés | 3 | 138 | 43.5% | −6.5 ± 8.3 |  | −2.1 | 98% | 2.59 | 75% | 17% | 11 | +0.3 |
| 👣 Királylépés | 1 | 178 | 43.3% | −6.7 ± 7.2 |  | −10.6 | 73% | 1.66 | 48% | 12% | 21 | −0.1 |
| 🪞 Tükör | 3 | 108 | 43.1% | −6.9 ± 9.4 |  | +8.8 | 97% | 2.44 | 74% | 13% | 13 | +0.6 |
| 🎯 Futólövész | 4 | 152 | 42.8% | −7.2 ± 7.7 |  | −4.7 | 64% | 0.90 | 10% | 29% | 14 | +0.8 |
| 💨 Sakkmegszakító | 2 | 154 | 42.5% | −7.5 ± 7.7 |  | −2.5 | 75% | 1.61 | 7% | 75% | 21 | +0.5 |
| 🦘 Gyalogugrás | 2 | 166 | 42.5% | −7.5 ± 7.4 | ▼ | −0.6 | 64% | 0.99 | 38% | 8% | 13 | −0.2 |
| 🕯️ Áldozat | 1 | 178 | 41.6% | −8.4 ± 7.1 | ▼ | −8.0 | 83% | 1.56 | 89% | 6% | 17 | −0.7 |
| ⏩ Dupla lépés ◌ | 4 | 134 | 35.1% | −14.9 ± 8.0 | ▼▼ | −16.2 | 1% | 0.02 | 80% | 0% | 24 | −0.3 |
| 👥 Brigád | 3 | 146 | 20.9% | −29.1 ± 6.5 | ▼▼ | −21.8 | 99% | 3.52 | 40% | 95% | 4 | +2.1 |

◌ = az AI a paklik kevesebb mint negyedében játssza ki: az eredménye főleg azt méri, mennyit árt egy „halott” lap a kézben (a 3 kézhelyből egyet elfoglal, amíg ki nem játsszák).

## Mana szerint

| Mana | Spellek | Átlagos Δ | Sorra került | /játszma | Kijátszható |
|---:|---:|---:|---:|---:|---:|
| 1 | 9 | −1.2 | 88% | 3.55 | 60% |
| 2 | 24 | −0.5 | 88% | 2.70 | 59% |
| 3 | 18 | −0.0 | 79% | 2.06 | 64% |
| 4 | 10 | −2.6 | 66% | 1.58 | 51% |
| 5 | 6 | +3.6 | 81% | 1.89 | 39% |
| 6 | 4 | +9.9 | 95% | 2.35 | 30% |

## Mire jó és mire nem

- Az eredmény **ennek az AI-nak** a játékát méri. A spelleket az azonnali (1 lépéses) értékelés alapján választja: amit rögtön anyagban vagy fenyegetésben lát, azt jól használja; a hosszabb távú, helyzeti vagy csapda-jellegű lapokat alulértékeli. Ember kezében ezek erősebbek lehetnek.
- A paklik véletlenek, így egy lap eredménye a többi lappal való átlagos együttélését mutatja; a célzott kombók ereje ebből nem látszik.
- A Δ a pakliban lévő lap hatása, nem a kijátszásé: a ritkán kijátszott lapok negatív Δ-ja főleg a kéz eltömítését jelzi.
- Egy lap kb. 156 játszmában szerepelt, ez ±8 százalékpontos bizonytalanság: csak a nagy eltérések megbízhatók. Több játszma: `npm run balance -- --games 2000 --jobs 4`.
