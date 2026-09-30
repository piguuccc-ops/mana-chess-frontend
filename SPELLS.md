# Mana Chess – spellek

> Ez a fájl generált (`npm run docs:spells`), a forrása a `src/engine/spells/definitions.ts`.

Időtartamok: „e kör végéig” = a varázsló saját körének végéig; „az ellenfél következő körének végéig” = a varázsló következő körének kezdetéig.

## Mind a(z) 71 spell

| # | Spell | Mana | Kategória | Célpont | Hatás (megvalósítva) |
|---|-------|------|-----------|---------|----------------------|
| 1 | 🏃 **Gyalogroham** | 2 | Mozgás | Válassz egy saját gyalogot, amely két mezőt rohamozhat. | Válassz egy saját gyalogot: ebben a körben a normál lépéseként két mezőt léphet előre akkor is, ha már mozgott – ha az út szabad. |
| 2 | 🐎 **Huszárugrás** | 2 | Mozgás | Válassz egy saját huszárt. → Hová ugorjon a huszár? | Egy saját huszár azonnal végrehajt egy szabályos huszárlépést (üthet is). Ez nem számít a normál lépésednek. |
| 3 | ✨ **Futóáldás** | 2 | Mozgás | Válassz egy saját futót. | Egy saját futó a következő saját köröd végéig egyszer átugorhat egy saját bábut (lépésnél és ütésnél is). |
| 4 | 🏰 **Bástyatöltés** | 2 | Mozgás | Válassz egy saját bástyát. → Hová töltsön a bástya (max. 3 mező)? | Egy saját bástya azonnal legfeljebb 3 mezőt mozog vízszintesen vagy függőlegesen (üthet is). Nem számít a normál lépésednek. |
| 5 | 👑 **Vezér kegyelme** ✱ | 3 | Mozgás | Válassz egy saját vezért. | A vezéred a következő saját köröd kezdetéig huszárként is léphet és üthet (+1 mozgásminta). |
| 6 | 👣 **Királylépés** ✱ | 1 (eredetileg 2) | Mozgás | — | Ebben a körben a király a normál lépésénél egy további mezőt léphet egyenes vonalban (összesen 2 mezőt). A köztes mező legyen üres és ne legyen támadott. |
| 7 | 🛡️ **Gyalogpajzs** | 1 | Védelem | Válassz egy saját gyalogot. | Egy saját gyalogot nem lehet leütni (lépéssel és spellel sem) az ellenfél következő körének végéig. |
| 8 | 🔰 **Huszárpajzs** | 2 | Védelem | Válassz egy saját huszárt. | Egy saját huszárt nem lehet leütni (lépéssel és spellel sem) az ellenfél következő körének végéig. |
| 9 | 💪 **Megerősítés** ✱ | 4 (eredetileg 2) | Védelem | Melyik bábut erősíted meg? | Egy saját (nem király) bábu túléli az első következő leütési kísérletet és a helyén marad; a támadó bábu visszapattan a kiinduló mezőjére, a lépése elvész. Addig marad érvényben, amíg el nem használódik. |
| 10 | 🕯️ **Áldozat** ✱ | 1 | Mana | Melyik gyalogot áldozod fel? | Egy saját gyalog megsemmisül, cserébe azonnal +3 manát kapsz (vonalnyitásra, ciklusgyorsításra és egy nagy spell előrehozására jó). |
| 11 | 🥾 **Erőltetett menet** | 2 | Mozgás | Melyik gyalog meneteljen? | Egy saját gyalog egy mezőt előrelép (nem üt) anélkül, hogy a normál lépésedet felhasználnád. |
| 12 | 🌀 **Teleport** ✱ | 5 (eredetileg 4) | Mozgás | Melyik bábut teleportálod? → Válaszd ki a célmezőt. | Egy saját bábut áthelyezel egy üres mezőre, ahová a saját mozgásmintájával egy lépésben eljuthatna – a köztes bábuk nem akadályozzák (teleportál). Nem üt, és nem számít normál lépésnek. |
| 13 | 🔄 **Csere** | 3 | Taktika | Válaszd ki az első bábut. → Válaszd ki a második bábut. | Felcseréled két saját, különböző típusú, nem király bábu helyét. Gyalog nem kerülhet az 1. vagy 8. sorra. |
| 14 | 🚨 **Vészcsere** | 4 | Védelem | Melyik bástyával cseréljen a király? | A királyod helyet cserél egy saját bástyáddal, ha a csere után a király nincs sakkban. (A sáncolási jog elvész.) |
| 15 | ↩️ **Visszalépés** | 3 | Idő | Melyik bábu lépjen vissza? | Egy saját bábu visszaáll arra a mezőre, ahol a legutóbbi mozgása előtt állt (ha az most üres). Nem számít normál lépésnek. |
| 16 | ⏩ **Dupla lépés** ✱ | 4 | Mozgás | — | A normál lépésed után egy MÁSIK saját bábuval még egy szabályos lépést tehetsz. Ha az első lépés sakkot ad, a bónuszlépés elvész. |
| 17 | 🌟 **Azonnali átváltozás** ✱ | 5 | Taktika | Melyik gyalog változzon át? | Egy saját gyalog, amely már a 6. vagy 7. soron áll (a saját szemszögedből), azonnal átváltozik vezérré, bástyává, futóvá vagy huszárrá – helyben. |
| 18 | ⚜️ **Királyvédelem** ✱ | 3 | Védelem | — | Az ellenfél következő körében nem adhat sakkot a királyodnak – sem lépéssel, sem spellel. A király továbbra sem léphet sakkba. |
| 19 | 💨 **Sakkmegszakító** | 2 | Védelem | Hová meneküljön a király? | Csak sakkban: a királyod azonnal átugrik egy szomszédos, üres, nem támadott mezőre. Nem számít normál lépésnek. |
| 20 | 🏯 **Újrasáncolás** ✱ | 1 (eredetileg 3) | Taktika | — | Ha a király és egy bástya a kiinduló mezőjén áll, újra engedélyezi a sáncolást – akkor is, ha a jog korábban (lépés vagy spell miatt) elveszett. |
| 21 | 💀 **Halálbélyeg** | 2 | Pusztítás | Kit bélyegzel meg? | Megjelölsz egy ellenséges bábut (a következő saját köröd végéig). A következő szabályos támadásod ellene garantáltan leüti: figyelmen kívül hagyja a pajzsokat és a megerősítést. |
| 22 | 🥀 **Gyengítés** ✱ | 3 (eredetileg 2) | Irányítás | Gyengítés: válassz egy ellenséges bábut. | Egy ellenséges (nem király) bábu a következő körében egyáltalán nem mozoghat (és nem üthet). |
| 24 | 🌿 **Gyökér** | 2 | Irányítás | Gyökér: válassz egy ellenséges bábut. | Egy ellenséges (nem király) bábu a következő körében nem léphet üres mezőre, de ütni továbbra is tud. |
| 25 | 🙈 **Vakfolt** | 2 | Irányítás | Vakfolt: válassz egy ellenséges bábut. | Egy ellenséges (nem király) bábu a következő körében nem üthet le egyetlen bábudat sem (de továbbra is sakkot adhat és mezőket tarthat). |
| 26 | 🤐 **Némaság** ✱ | 2 (eredetileg 1) | Irányítás | — | Az ellenfél a következő körében nem használhat spellt. |
| 27 | 🧛 **Manaelszívás** | 3 | Mana | — | Az ellenfél legfeljebb 2 manát veszít. |
| 29 | 🚫 **Hatástalanítás** ✱ | 2 (eredetileg 3) | Irányítás | Hatástalanítás: válassz egy ellenséges bábut. | Egy ellenséges (nem király) bábu a következő saját köre végéig nem üthet, és a támadásai sem számítanak: nem ad sakkot, a királyod mellé/elé léphet. |
| 30 | ❄️ **Gyalogfagyasztás** | 1 | Irányítás | Gyalogfagyasztás: válassz egy ellenséges bábut. | Egy ellenséges gyalog a következő körében nem mozoghat (és nem üthet). |
| 31 | 🧱 **Fal** ✱ | 1 (eredetileg 2) | Terep | Hová emeled a falat? | Egy üres mezőre falat emelsz az ellenfél következő körének végéig: sem bábu nem léphet rá, sem nem haladhat át rajta (a huszár átugorhatja, de nem érkezhet rá). |
| 32 | 🚧 **Barikád** | 3 | Terep | Válaszd ki az első mezőt. → Válassz egy szomszédos üres mezőt. | Két egymás melletti (vízszintesen vagy függőlegesen szomszédos) üres mezőt blokkolsz az ellenfél következő körének végéig. |
| 34 | 🧲 **Gravitáció** ✱ | 2 (eredetileg 3) | Terep | — | Az ellenfél következő körének végéig egyik huszár sem ugorhat át bábukat: a huszár csak akkor léphet, ha a hosszabbik irányban mellette lévő mező üres (mint a kínai sakk lova). |
| 35 | 🎲 **Káosz** | 4 | Taktika | — | Két véletlenszerű, nem király bábu (bármelyik színből) helyet cserél. A csere sosem hozhatja a királyodat sakkba, és gyalog nem kerülhet az 1./8. sorra. |
| 36 | 🪞 **Tükör** ✱ | 3 | Mozgás | Melyik bábut tükrözöd? | Egy saját (nem király) bábu átkerül a tükörképmezőjére (a tábla függőleges középvonalára tükrözve, pl. c3 → f3), ha az üres. Az eredeti helyéről eltűnik – nem jön létre másolat. |
| 37 | ⏸️ **Időmegállítás** ✱ | 5 | Idő | — | Az ellenfél a következő körében nem tehet normál sakk-lépést, legfeljebb egy spellt használhat. Kivétel: ha a királya sakkban van, léphet, hogy elhárítsa. |
| 38 | ⏪ **Visszatekerés** | 5 | Idő | — | A teljes sakkállás visszaáll az utolsó normál sakk-lépés előtti állapotra (a leütött bábuk visszatérnek). A mana, a spell-ciklus és az aktív hatások változatlanok. A normál lépésed előtt használható. |
| 39 | 🌋 **Földrengés** ✱ | 3 (eredetileg 4) | Terep | — | Minden gyalog (mindkét színből) egyszerre egy mezőt előrelép a saját menetirányában, ha előtte üres a mező. Átváltozó sorra nem lép, és ha két gyalog ugyanarra a mezőre lépne, egyik sem mozdul. |
| 40 | 🌌 **Dimenzióváltás** ✱ | 5 | Terep | Válaszd ki a 3×3-as terület közepét. | Kijelölsz egy 3×3-as területet: az ellenfél következő körének végéig az ott álló összes nem király bábu (mindkét színből) kizárólag huszárként léphet és üthet. |
| 41 | 🩸 **Vérár** | 2 | Mana | Melyik bábut áldozod fel? | Feláldozol egy saját (nem király) bábut, és azonnal 3 manát kapsz. |
| 42 | 🔋 **Túltöltés** ✱ | 2 (eredetileg 3) | Mana | — | A következő spelled 2 manával olcsóbb (minimum 1 mana). A kedvezmény megmarad, amíg fel nem használod. |
| 43 | ⚡ **Arcane Surge** ✱ | 1 (eredetileg 4) | Mana | — | Azonnal kapsz 3 manát, de a következő saját köröd végéig a maximális manád 4. |
| 44 | 🃏 **Gambit** | 1 | Mana | — | Az ellenfél kap 2 manát, te pedig azonnal eggyel előrébb lépsz a spell-ciklusban (a kezed első lapja a pakli végére kerül, új lapot húzol). |
| 46 | 🕊️ **Utolsó esély** ✱ | 3 (eredetileg 5) | Védelem | — | Csak ha kevesebb bábud van, mint az ellenfélnek: minden saját bábud túléli a következő leütési kísérletet az ellenfél következő körének végéig. |
| 47 | ⚔️ **Kivégzés** ✱ | 5 (eredetileg 6) | Pusztítás | Kit végzel ki? | Azonnal leütsz egy legfeljebb 3 pont értékű ellenséges bábut (gyalog, rabszolga, huszár, futó), bárhol is áll. Királyt nem célozhat; a pajzs véd, a megerősítés elnyeli (kivéve Halálbélyeg esetén). |
| 48 | ☄️ **Meteor** ✱ | 6 | Pusztítás | Hová csapódjon a meteor? | Elpusztítasz egy legfeljebb 4 pontos bábut (gyalog, rabszolga, huszár, futó – bástyát, vezért nem) és a vele szomszédos gyalogokat/rabszolgákat (bármelyik színből) – összesen legfeljebb 4 pontnyi anyagot (gyalog/rabszolga 1, huszár/futó 3). A becsapódás után először az ellenséges, aztán a saját szomszédokat éri. A pajzs véd, a megerősítés elnyeli. |
| 49 | 🧟 **Nekromancia** ✱ | 2 (eredetileg 5) | Taktika | Hová támadjon fel a gyalog? | Egy korábban levett saját gyalogod visszatér a kezdősorodra egy általad választott üres mezőre. |
| 50 | 🔮 **Valóságtörés** ✱ | 6 | Taktika | — | Ebben a körben a nem király bábuid átsiklanak a köztes SAJÁT bábuidon (az ellenségeseken nem) – a gyalog kettőslépése is. A király nem léphet sakkba, királyt ütni nem lehet, a falak továbbra is akadályoznak. |
| 51 | 👥 **Brigád** 🆕 ✱ | 3 (eredetileg 5) | Taktika | 1/5. rabszolga: válassz egy üres mezőt a saját 1–3. sorodban. → 2/5. rabszolga: válassz egy üres mezőt a saját 1–3. sorodban. → 3/5. rabszolga: válassz egy üres mezőt a saját 1–3. sorodban. → 4/5. rabszolga: válassz egy üres mezőt a saját 1–3. sorodban. → 5/5. rabszolga: válassz egy üres mezőt a saját 1–3. sorodban. | Leidézel 5 rabszolgát a saját 1–3. sorodba, az általad választott üres mezőkre. A rabszolga gyalogszerű bábu: mindig csak egy mezőt léphet előre (kezdő kettőslépés sincs), nem üthet, ezért nem támad és sakkot sem ad, és nem változik át. Leütni lehet (1 pont), de mana nem jár érte. |
| 52 | 🧬 **Klón** 🆕 ✱ | 3–5 | Taktika | Melyik bábudat klónozod? → Hová kerüljön a klón (szomszédos szabad mező)? | Leklónozod egy saját (nem király, nem vezér) bábudat, és a klónt lerakod a bábu melletti (1 mezőnyire lévő) bármelyik szabad mezőre – kivéve, ha onnan sakkot adna. A klón félig átlátszó, ugyanúgy mozog, mint az eredeti, de amint leüt valamit, szertefoszlik. Egyszerre csak egy klónod lehet. Ára: a bábu értékének fele + 2, felfelé kerekítve (gyalog/rabszolga 3, huszár/futó 4, bástya 5). |
| 53 | 🧀 **Francia sajt** 🆕 ✱ | 3 (eredetileg 2) | Taktika | Melyik gyalogod üssön francia módra (en passant)? | Válassz egy saját gyalogot: ebben a körben a normál lépéseként en passant üthet BÁRMILYEN mellette (ugyanabban a sorban, közvetlenül balra/jobbra) álló ellenséges bábut: átlósan előre lép az üres mezőre a bábu mögé, a mellette álló bábu pedig megsemmisül. Királyt és vezért nem üthet, a pajzs véd, a megerősítés elnyeli. |
| 54 | 🎯 **Futólövész** 🆕 | 4 | Pusztítás | Melyik futód lőjön? | Válassz egy saját futót: ebben a körben a normál lépéseként lelőhetsz vele egy ellenséges bábut, amelyet a szabályos mozgása alapján amúgy is leüthetne – a futó viszont nem mozdul el a helyéről, a célpont megsemmisül. A lövés ütésnek számít (+1 mana), a pajzs véd, a megerősítés elnyeli. |
| 55 | 🧙 **Mana mágus** 🆕 ✱ | 2 (eredetileg 3) | Mana | Melyik bábudból legyen mana mágus (max. 3 pont)? | Egy legfeljebb 3 pont értékű saját bábudat (gyalog, rabszolga, huszár, futó) mana mágussá teszed a következő 3 saját körödre. Amíg él: minden körödben +1 extra manát kapsz (összesen +2/kör), és ha üt vele, +1 extra manát kapsz a szokásos +1 mellé. Aki spellel öli meg, azonnal 1 manát veszít. Egyszerre csak egy mana mágusod dolgozik: ha újat teszel, a régi elveszíti az erejét. |
| 56 | 💣 **Akna** 🆕 | 4 | Terep | Hová rejted az aknát? | Aknát rejtesz a tábla egy mezőjére (üres mezőre vagy egy bábu alá – a királyok mezője kivétel). Az ellenfél következő körének végén felrobban, és elpusztítja az éppen rajta álló nem király bábut, bármelyik színű is. A pajzs vagy a megerősítés megvédi a bábut, de a robbanásban megsemmisül. A mellette (1 mezőre) álló király a lépéseként hatástalaníthatja – helyben maradva, vagy rálépve. Az akna mindkét játékos számára látható. |
| 57 | 👋 **El az útból!** 🆕 | 2 | Mozgás | Melyik bábudat állítod félre? → Hová álljon félre (szomszédos üres mező)? | Egy saját (nem király) bábudat félreállítod egy szomszédos üres mezőre – ez nem számít normál lépésnek. Ebben a körben semmi nem léphet a bábu eredeti mezőjére (áthaladni rajta szabad), a félreállított bábu nem léphet tovább, és a köröd végén automatikusan visszatér a helyére. |
| 58 | 🏁 **Gyorssánc** 🆕 | 2 (javaslat: 1) | Mozgás | Melyik bástyával sáncolsz? | Azonnal elvégzed a sáncolást spellként – ez nem számít a normál lépésednek. A szokásos feltételek érvényesek: a király és a bástya még nem lépett, az út üres, a király nincs sakkban, és nem halad át / nem érkezik támadott mezőre. |
| 59 | 🦘 **Gyalogugrás** 🆕 | 2 (javaslat: 1) | Mozgás | Melyik gyalogod ugorjon? | Válassz egy saját gyalogot: ebben a körben a normál lépéseként átugorhatja a közvetlenül előtte álló bábut (bármelyik színűt) a mögötte lévő üres mezőre. Nem üt, falat nem ugorhat át; ha az átváltozó sorra érkezik, átváltozik. |
| 60 | 📣 **Provokáció** 🆕 ✱ | 3 (eredetileg 2) | Irányítás | Melyik ellenséges gyalogot provokálod? | Kijelölsz egy ellenséges gyalogot vagy rabszolgát: az ellenfél következő körében a normál lépését ezzel a bábuval kell megtennie, ha az tud szabályosan lépni (spelleket ettől még használhat). |
| 61 | 👻 **Láthatatlanság** 🆕 | 2 | Védelem | Melyik bábudat rejted el a spellek elől? | Egy saját (nem király) bábudat az ellenfél következő körének végéig nem célozhatják az ellenfél spelljei. A területre ható, nem célzott spellek (pl. a Meteor szórása, Földrengés, Végítélet) továbbra is érik, a Pajzsromboló pedig eltávolítja. |
| 62 | 🪝 **Mágnes** 🆕 | 3 (javaslat: 2) | Taktika | Melyik ellenséges bábut húzod? → Melyik saját bábud felé húzod? | Válassz egy ellenséges (nem király) bábut, majd egy vele egy vonalban (sor, oszlop vagy átló) álló saját bábudat, ha köztük üres az út: az ellenséges bábu egy mezőt közelebb csúszik hozzá. Gyalog nem kerülhet az 1./8. sorra. |
| 63 | 🌬️ **Taszítás** 🆕 | 3 (javaslat: 2) | Taktika | Melyik ellenséges bábut taszítod el? → Melyik saját bábudtól taszítod el? | Válassz egy ellenséges (nem király) bábut, majd egy vele egy vonalban (sor, oszlop vagy átló) álló saját bábudat, ha köztük üres az út: az ellenséges bábu egy mezőt hátrébb csúszik tőle ugyanabban az irányban, ha ott üres a mező. Gyalog nem kerülhet az 1./8. sorra. |
| 64 | 🏦 **Mana-letét** 🆕 | 2 | Mana | — | Most 2 manát fizetsz, a következő saját köröd elején pedig +3 manát kapsz vissza (a szokásos +1 mellé; a maximum feletti rész elvész). |
| 65 | 🧭 **Cserkész** 🆕 | 1 (javaslat: 2) | Mozgás | Melyik gyalogod lépjen oldalra? | Válassz egy saját gyalogot: ebben a körben a normál lépéseként oldalra is léphet egy szomszédos üres mezőre (balra vagy jobbra, ugyanabban a sorban). Nem üt. |
| 66 | 🧪 **Mana-szomj** 🆕 | 3 | Mana | — | Ha ebben a körben leütsz egy ellenséges bábut (lépéssel, lövéssel vagy spell-lépéssel), a leütött bábu értékének megfelelő extra manát kapsz (gyalog/rabszolga 1, huszár/futó 3, bástya 5, vezér 9 – a maximum feletti rész elvész). Csak az első ütésre érvényes. |
| 67 | 🎓 **Átképzés** 🆕 | 2 (javaslat: 3) | Taktika | Melyik huszárt vagy futót képzed át? | Egy saját huszárod futóvá, vagy egy saját futód huszárrá változik ugyanazon a mezőn. A típushoz kötött hatások (Futóáldás, Futólövész) elvesznek. |
| 68 | 🌪️ **Vihar** 🆕 | 4 | Irányítás | — | Az összes ellenséges gyalog és rabszolga egy mezőt hátrál a saját oldala felé, ha mögötte üres a mező (egymás mögötti gyalogok közül a hátsó lép előbb). Gyalog nem kerülhet az alapsorra; a kezdősorra visszatolt gyalog újra kettőt léphet. |
| 69 | 🔨 **Pajzsromboló** 🆕 | 3 (javaslat: 4) | Pusztítás | Kinek a védelmét rombolod le? | Egy ellenséges (nem király) báburól eltávolítod az összes védelmet (Gyalog-/Huszárpajzs, Megerősítés, Utolsó esély, Láthatatlanság), majd egy mezővel hátrébb löködöd a saját oldala felé, ha ott üres a mező. Láthatatlan bábut is célozhat. |
| 70 | 🕳️ **Gravitációs kút** 🆕 | 4 (javaslat: 5) | Terep | Hová nyitod a gravitációs kutat? | Kijelölsz egy mezőt: minden tőle pontosan 2 mezőnyire álló nem király bábu (mindkét színből) egy mezőt csúszik a kút felé, ha a célmező üres. Ha két bábu ugyanoda érkezne, egyik sem mozdul; gyalog nem kerülhet az 1./8. sorra. |
| 71 | ☢️ **Mana-armageddon** 🆕 | 4 (javaslat: 5) | Mana | — | Mindkét játékos manája azonnal 0-ra csökken (a tiéd a spell ára után), és a következő körben egyikőtök sem kap alap manát (az ellenfél a következő, te a rákövetkező körödben). A Mana mágus és a Mana-letét ettől még fizet. |
| 72 | 🐉 **Sárkánytűz** 🆕 ✱ | 6 | Pusztítás | Honnan induljon a tűz? → Merre söpörjön végig? (válassz egy mezőt az átlón) | Tűzcsóvát indítasz egy általad választott mezőről egy átlós irányban a tábla széléig: az útjába eső nem király bábuk (mindkét színből) elpusztulnak, összesen legfeljebb 4 pontnyi anyag, az út sorrendjében – ami már nem fér bele (bástya, vezér soha), azt a tűz átugorja. A pajzs véd, a megerősítés elnyeli. |
| 73 | ☠️ **Végítélet** 🆕 ✱ | 4 (eredetileg 6) | Pusztítás | — | Minden ellenséges gyalog és rabszolga elpusztul, amely a te térfeleden (a saját szemszögedből az 1–4. sorban) áll – a Kaszás egyenként végez velük. A pajzs véd, a megerősítés elnyeli. |
| 74 | 💠 **Üvegátok** 🆕 | 2–3 | Irányítás | Üvegátok: melyik ellenséges bábut átkozod meg? | Egy ellenséges (nem király) bábut üveggé átkozol az ellenfél következő körének végéig: ha ezalatt leüt valamit (akár spell segítségével is), az ütés után maga is darabokra törik – ezt pajzs vagy megerősítés sem akadályozza meg. Ára 2 mana, vezérre 3. |
| 75 | 🌑 **Végzet** 🆕 ✱ | 6 | Pusztítás | Végzet: melyik ellenséges bábura sújtson le? | Egy ellenséges gyalog vagy rabszolga elpusztul – semmi sem védi meg (sem pajzs, sem megerősítés, sem Láthatatlanság vagy más védőspell). A lökéshullám a körülötte álló 8 mezőn minden nem király bábut (mindkét színből) egy mezővel egyenesen kifelé lök, ha a célmező üres (gyalog nem kerülhet az 1./8. sorra). Az ellenfél +1 manát kap. Körforgás: minden sima kijátszás tölt egyet a lapon; a második után, amikor legközelebb a kezedbe kerül, FELÉBREDVE játszhatod ki – akkor bármelyik nem király bábut sújthatja (bástyát, vezért is), és a bábu kitörlődik a létezésből: semmi sem hozza vissza, és ha tiszt volt, az ellenfél többé nem kaphat ilyen bábut. Utána a lap újra töltődik. **Felébredt Végzet:** Egy ellenséges (nem király) bábu – akár bástya vagy vezér – kitörlődik a létezésből. Semmi sem védi meg, és semmi sem hozza vissza: sem Nekromancia, sem Visszatekerés. Ha tiszt volt (vezér, bástya, futó, huszár), az ellenfél többé nem kaphat ilyen bábut: gyalogja nem változhat ilyenné, és Klónnal vagy Átképzéssel sem hozhat létre újat. Nem számít leütésnek. A lökéshullám szétveti a szomszédait, az ellenfél +1 manát kap. Kijátszás után a lap újra töltődni kezd (két sima kijátszással). |

🆕 = új spell, ✱ = módosítva (a specifikációhoz vagy a bevezetéséhez képest – lásd lent az indoklással).

## Új és kivett spellek

- 🆕 **👥 Brigád** (3 mana): Leidézel 5 rabszolgát a saját 1–3. sorodba, az általad választott üres mezőkre. A rabszolga gyalogszerű bábu: mindig csak egy mezőt léphet előre (kezdő kettőslépés sincs), nem üthet, ezért nem támad és sakkot sem ad, és nem változik át. Leütni lehet (1 pont), de mana nem jár érte. *Új spell (kérésre), a kivett Tűzés helyére: 5 lassú, ütni nem tudó gyalogszerű bábu – élő fal, blokkolás és tempónyerés.*
- 🆕 **🧬 Klón** (3–5 mana): Leklónozod egy saját (nem király, nem vezér) bábudat, és a klónt lerakod a bábu melletti (1 mezőnyire lévő) bármelyik szabad mezőre – kivéve, ha onnan sakkot adna. A klón félig átlátszó, ugyanúgy mozog, mint az eredeti, de amint leüt valamit, szertefoszlik. Egyszerre csak egy klónod lehet. Ára: a bábu értékének fele + 2, felfelé kerekítve (gyalog/rabszolga 3, huszár/futó 4, bástya 5). *Új spell (kérésre): változó ár (a bábu értékétől függ), egyszer használható „kamikaze” másolat.*
- 🆕 **🧀 Francia sajt** (3 mana): Válassz egy saját gyalogot: ebben a körben a normál lépéseként en passant üthet BÁRMILYEN mellette (ugyanabban a sorban, közvetlenül balra/jobbra) álló ellenséges bábut: átlósan előre lép az üres mezőre a bábu mögé, a mellette álló bábu pedig megsemmisül. Királyt és vezért nem üthet, a pajzs véd, a megerősítés elnyeli. *Új spell (kérésre): az en passant szabály kiterjesztése bármilyen szomszédos ellenséges bábura, egy körre.*
- 🆕 **🎯 Futólövész** (4 mana): Válassz egy saját futót: ebben a körben a normál lépéseként lelőhetsz vele egy ellenséges bábut, amelyet a szabályos mozgása alapján amúgy is leüthetne – a futó viszont nem mozdul el a helyéről, a célpont megsemmisül. A lövés ütésnek számít (+1 mana), a pajzs véd, a megerősítés elnyeli. *Új spell (kérésre): távolsági ütés – a futó a helyén marad, így nem kerül veszélybe és nem nyit vonalat.*
- 🆕 **🧙 Mana mágus** (2 mana): Egy legfeljebb 3 pont értékű saját bábudat (gyalog, rabszolga, huszár, futó) mana mágussá teszed a következő 3 saját körödre. Amíg él: minden körödben +1 extra manát kapsz (összesen +2/kör), és ha üt vele, +1 extra manát kapsz a szokásos +1 mellé. Aki spellel öli meg, azonnal 1 manát veszít. Egyszerre csak egy mana mágusod dolgozik: ha újat teszel, a régi elveszíti az erejét. *Új spell (kérésre): befektetés – legfeljebb +3 mana a következő 3 körben (+ütésenként +1); aki spellel öli meg, 1 manával fizet érte.*
- 🆕 **💣 Akna** (4 mana): Aknát rejtesz a tábla egy mezőjére (üres mezőre vagy egy bábu alá – a királyok mezője kivétel). Az ellenfél következő körének végén felrobban, és elpusztítja az éppen rajta álló nem király bábut, bármelyik színű is. A pajzs vagy a megerősítés megvédi a bábut, de a robbanásban megsemmisül. A mellette (1 mezőre) álló király a lépéseként hatástalaníthatja – helyben maradva, vagy rálépve. Az akna mindkét játékos számára látható. *Új spell (kérésre). Pontosítva: az akna látható (helyi játékban úgysem lehetne titkos), a hatástalanítás a király normál lépése, és ha a király rálép, az is hatástalanítja.*
- 🆕 **👋 El az útból!** (2 mana): Egy saját (nem király) bábudat félreállítod egy szomszédos üres mezőre – ez nem számít normál lépésnek. Ebben a körben semmi nem léphet a bábu eredeti mezőjére (áthaladni rajta szabad), a félreállított bábu nem léphet tovább, és a köröd végén automatikusan visszatér a helyére. *Új spell (kérésre). Kiegészítve: a félreállított bábu ebben a körben nem léphet tovább (különben „kiütni és hazafutni” trükkre lehetne használni), és a király nem állítható félre.*
- 🆕 **🏁 Gyorssánc** (2 mana): Azonnal elvégzed a sáncolást spellként – ez nem számít a normál lépésednek. A szokásos feltételek érvényesek: a király és a bástya még nem lépett, az út üres, a király nincs sakkban, és nem halad át / nem érkezik támadott mezőre. *Új spell (javaslatból). Balansz: 1 → 2 mana – egy teljes plusz lépés, mint a Huszárugrás.* Javaslat: „Ha a király és a bástya között szabad az út, azonnal elvégezheted a sáncolást spellként (nem számít normál lépésnek).” (1 mana).
- 🆕 **🦘 Gyalogugrás** (2 mana): Válassz egy saját gyalogot: ebben a körben a normál lépéseként átugorhatja a közvetlenül előtte álló bábut (bármelyik színűt) a mögötte lévő üres mezőre. Nem üt, falat nem ugorhat át; ha az átváltozó sorra érkezik, átváltozik. *Új spell (javaslatból). Balansz: 1 → 2 mana – egy blokkolt gyalog így szabad gyaloggá válhat; a Gyalogroham is 2 mana. A normál lépésedet használja.* Javaslat: „Egy saját gyalogod átugorhat egy közvetlenül előtte álló bábut egy üres mezőre (nem üt).” (1 mana).
- 🆕 **📣 Provokáció** (3 mana): Kijelölsz egy ellenséges gyalogot vagy rabszolgát: az ellenfél következő körében a normál lépését ezzel a bábuval kell megtennie, ha az tud szabályosan lépni (spelleket ettől még használhat). *Új spell (javaslatból). Balansz: 1 → 2 mana – egy kényszerlépés akár egy fontos gyalogláncot is szétszedhet.* Javaslat: „Kijelölsz egy ellenséges gyalogot: a következő körben kötelező lépnie, ha tud.” (1 mana).
- 🆕 **👻 Láthatatlanság** (2 mana): Egy saját (nem király) bábudat az ellenfél következő körének végéig nem célozhatják az ellenfél spelljei. A területre ható, nem célzott spellek (pl. a Meteor szórása, Földrengés, Végítélet) továbbra is érik, a Pajzsromboló pedig eltávolítja. *Új spell (javaslatból): célzott spellek elleni védelem – ütés ellen nem véd, a pajzsokkal ellentétben.*
- 🆕 **🪝 Mágnes** (3 mana): Válassz egy ellenséges (nem király) bábut, majd egy vele egy vonalban (sor, oszlop vagy átló) álló saját bábudat, ha köztük üres az út: az ellenséges bábu egy mezőt közelebb csúszik hozzá. Gyalog nem kerülhet az 1./8. sorra. *Új spell (javaslatból). Pontosítva: te választod ki, melyik (vele egy vonalban álló, szabad rálátású) bábud felé húzod. Balansz: 2 → 3 mana, mert egy bábut egy lépéssel ütésbe húzni akár vezért is nyerhet.* Javaslat: „Egy ellenséges bábut 1 mezővel közelebb húzol a legközelebbi saját bábudhoz (ha üres a mező).” (2 mana).
- 🆕 **🌬️ Taszítás** (3 mana): Válassz egy ellenséges (nem király) bábut, majd egy vele egy vonalban (sor, oszlop vagy átló) álló saját bábudat, ha köztük üres az út: az ellenséges bábu egy mezőt hátrébb csúszik tőle ugyanabban az irányban, ha ott üres a mező. Gyalog nem kerülhet az 1./8. sorra. *Új spell (javaslatból), a Mágnes párja. Balansz: 2 → 3 mana (ugyanazért, mint a Mágnes).* Javaslat: „Egy ellenséges bábut 1 mezővel eltolsz a saját bábudtól egyenes vonalban.” (2 mana).
- 🆕 **🏦 Mana-letét** (2 mana): Most 2 manát fizetsz, a következő saját köröd elején pedig +3 manát kapsz vissza (a szokásos +1 mellé; a maximum feletti rész elvész). *Új spell (javaslatból): kis befektetés (+1 mana egy kör késéssel) és olcsó ciklusgyorsítás.*
- 🆕 **🧭 Cserkész** (1 mana): Válassz egy saját gyalogot: ebben a körben a normál lépéseként oldalra is léphet egy szomszédos üres mezőre (balra vagy jobbra, ugyanabban a sorban). Nem üt. *Új spell (javaslatból). Balansz: 2 → 1 mana – csak a normál lépésedet teszi rugalmasabbá.* Javaslat: „Egy gyalogod oldalirányba is léphet egy üres mezőre (nem üt).” (2 mana).
- 🆕 **🧪 Mana-szomj** (3 mana): Ha ebben a körben leütsz egy ellenséges bábut (lépéssel, lövéssel vagy spell-lépéssel), a leütött bábu értékének megfelelő extra manát kapsz (gyalog/rabszolga 1, huszár/futó 3, bástya 5, vezér 9 – a maximum feletti rész elvész). Csak az első ütésre érvényes. *Új spell (javaslatból): cserék és nagy ütések előtt éri meg.*
- 🆕 **🎓 Átképzés** (2 mana): Egy saját huszárod futóvá, vagy egy saját futód huszárrá változik ugyanazon a mezőn. A típushoz kötött hatások (Futóáldás, Futólövész) elvesznek. *Új spell (javaslatból). Balansz: 3 → 2 mana – a huszár és a futó nagyjából egyenértékű, ez csak helyzeti előny.* Javaslat: „Egy saját huszárodat átváltoztathatod futóvá (vagy fordítva) a meglévő mezőjén.” (3 mana).
- 🆕 **🌪️ Vihar** (4 mana): Az összes ellenséges gyalog és rabszolga egy mezőt hátrál a saját oldala felé, ha mögötte üres a mező (egymás mögötti gyalogok közül a hátsó lép előbb). Gyalog nem kerülhet az alapsorra; a kezdősorra visszatolt gyalog újra kettőt léphet. *Új spell (javaslatból): a Földrengés egyoldalú, visszafelé ható párja – tempót nyer és szétszedi az előretolt gyalogokat.*
- 🆕 **🔨 Pajzsromboló** (3 mana): Egy ellenséges (nem király) báburól eltávolítod az összes védelmet (Gyalog-/Huszárpajzs, Megerősítés, Utolsó esély, Láthatatlanság), majd egy mezővel hátrébb löködöd a saját oldala felé, ha ott üres a mező. Láthatatlan bábut is célozhat. *Új spell (javaslatból). Balansz: 4 → 3 mana; a Láthatatlanság ellenszere is.* Javaslat: „Megsemmisíted a célzott ellenséges bábu összes aktív pajzsát és megerősítését, majd 1 mezővel hátrébb lököd.” (4 mana).
- 🆕 **🕳️ Gravitációs kút** (4 mana): Kijelölsz egy mezőt: minden tőle pontosan 2 mezőnyire álló nem király bábu (mindkét színből) egy mezőt csúszik a kút felé, ha a célmező üres. Ha két bábu ugyanoda érkezne, egyik sem mozdul; gyalog nem kerülhet az 1./8. sorra. *Új spell (javaslatból). Pontosítva: „2 mezőnyire” = pontosan 2 királylépésnyi távolságra. Balansz: 5 → 4 mana, mert mindkét fél bábuit mozgatja.* Javaslat: „Kijelölsz egy mezőt: a tőle 2 mezőnyire lévő összes bábu (mindkét oldalon) 1 mezővel a kút közepe felé húzódik.” (5 mana).
- 🆕 **☢️ Mana-armageddon** (4 mana): Mindkét játékos manája azonnal 0-ra csökken (a tiéd a spell ára után), és a következő körben egyikőtök sem kap alap manát (az ellenfél a következő, te a rákövetkező körödben). A Mana mágus és a Mana-letét ettől még fizet. *Új spell (javaslatból). Balansz: 5 → 4 mana, hogy ne csak teli manával lehessen kijátszani – a nagy „ultik” (Meteor, Valóságtörés) ellenszere.* Javaslat: „Mindkét játékos manája 0-ra csökken, és a következő körben senki sem kap alap manát.” (5 mana).
- 🆕 **🐉 Sárkánytűz** (6 mana): Tűzcsóvát indítasz egy általad választott mezőről egy átlós irányban a tábla széléig: az útjába eső nem király bábuk (mindkét színből) elpusztulnak, összesen legfeljebb 4 pontnyi anyag, az út sorrendjében – ami már nem fér bele (bástya, vezér soha), azt a tűz átugorja. A pajzs véd, a megerősítés elnyeli. *Új spell (javaslatból). Pontosítva és gyengítve: a tűz egy választott mezőtől egy átlós irányban söpör végig, és a Meteorhoz hasonlóan legfeljebb 4 pontnyi anyagot pusztít (különben egy lövéssel fél sereg eltűnhetne).* Javaslat: „Kijelölsz egy teljes átlót: az azon álló összes nem-király bábu (mindkét színből) elpusztul.”.
- 🆕 **☠️ Végítélet** (4 mana): Minden ellenséges gyalog és rabszolga elpusztul, amely a te térfeleden (a saját szemszögedből az 1–4. sorban) áll – a Kaszás egyenként végez velük. A pajzs véd, a megerősítés elnyeli. *Új spell (javaslatból): a térfeledre betört gyalogok – gyalogroham, előretolt szabad gyalogok – ellenszere.*
- 🆕 **💠 Üvegátok** (2–3 mana): Egy ellenséges (nem király) bábut üveggé átkozol az ellenfél következő körének végéig: ha ezalatt leüt valamit (akár spell segítségével is), az ütés után maga is darabokra törik – ezt pajzs vagy megerősítés sem akadályozza meg. Ára 2 mana, vezérre 3. *Új spell (kérésre): elrettentés – amíg az átok tart, az átkozott bábu minden ütése csere. Vezérre 3 mana, mert ott a legnagyobb a tét.*
- 🆕 **🌑 Végzet** (6 mana): Egy ellenséges gyalog vagy rabszolga elpusztul – semmi sem védi meg (sem pajzs, sem megerősítés, sem Láthatatlanság vagy más védőspell). A lökéshullám a körülötte álló 8 mezőn minden nem király bábut (mindkét színből) egy mezővel egyenesen kifelé lök, ha a célmező üres (gyalog nem kerülhet az 1./8. sorra). Az ellenfél +1 manát kap. Körforgás: minden sima kijátszás tölt egyet a lapon; a második után, amikor legközelebb a kezedbe kerül, FELÉBREDVE játszhatod ki – akkor bármelyik nem király bábut sújthatja (bástyát, vezért is), és a bábu kitörlődik a létezésből: semmi sem hozza vissza, és ha tiszt volt, az ellenfél többé nem kaphat ilyen bábut. Utána a lap újra töltődik. **Felébredt Végzet:** Egy ellenséges (nem király) bábu – akár bástya vagy vezér – kitörlődik a létezésből. Semmi sem védi meg, és semmi sem hozza vissza: sem Nekromancia, sem Visszatekerés. Ha tiszt volt (vezér, bástya, futó, huszár), az ellenfél többé nem kaphat ilyen bábut: gyalogja nem változhat ilyenné, és Klónnal vagy Átképzéssel sem hozhat létre újat. Nem számít leütésnek. A lökéshullám szétveti a szomszédait, az ellenfél +1 manát kap. Kijátszás után a lap újra töltődni kezd (két sima kijátszással). *Új spell (kérésre): a végső csapás – felébredve a bábu nem leütve, hanem kitörölve a játék történetéből, és ha tiszt volt, a fajtája is (nem lehet belőle új); a lökéshullám szétveti a szomszédait. Balansz (kérésre): az ellenfél +1 manát kap, és a kitörléshez (a mozis animációval együtt) a lapot egyszer körbe kell forgatni – az első kijátszás „csak” elpusztítja a bábut.*
- ✖ **23. Tűzés**: Kivéve a játékból (kérésre). Mentett paklikban automatikusan erre cserélődik: Gyengítés.
- ✖ **28. Manalopás**: Kivéve a játékból (kérésre). Mentett paklikban automatikusan erre cserélődik: Manaelszívás.
- ✖ **45. Dupla vagy semmi**: Kivéve a játékból (kérésre): a szerencsén alapuló spellek nem illenek a játékba. Mentett paklikban automatikusan erre cserélődik: Arcane Surge.
- ✖ **33. Ködfátyol**: Kivéve a játékból (kérésre): egy gépen játszva a rejtés semmit sem ér, mert mindkét játékos ugyanazt a képernyőt látja. Mentett paklikban automatikusan erre cserélődik: Láthatatlanság.

## Kihagyott javaslatok

Az 50 spellből álló javaslatlistából ezek nem kerültek be (a többi – módosított áron vagy pontosítva – a fenti táblázatban van):

- 2. **Kőfallépés** (1 mana): Túl hasonló a Gyalogpajzshoz.
- 3. **Kémlelés** (1 mana): A kezek mindkét játékos számára láthatók, nincs rejtett információ.
- 4. **Mini Túltöltés** (1 mana): Ugyanaz a szerep, mint a Mana-letété (az bekerült).
- 6. **Sötétben tapogatózás** (1 mana): A felület nem jelöli a támadott mezőket, így nincs mit elrejteni.
- 7. **Lendület** (1 mana): A sakkbábuknak nincs irányuk – a spellnek nem lenne hatása.
- 9. **Bástyaugrás** (2 mana): Túl hasonló a Futóáldáshoz (ugyanez bástyával).
- 11. **Súlyosbítás** (2 mana): Túl hasonló a Halálbélyeghez, és 2 manáért +1 mana veszteséges.
- 15. **Huszárugratás** (2 mana): Túl hasonló a Dupla lépéshez és a Huszárugráshoz.
- 16. **Földbefagyasztás** (2 mana): Nincs „bónusz mozgás”; területi fagyasztásként a Gyengítés/Gyalogfagyasztás ismétlése lenne.
- 18. **Tűzfal** (3 mana): Túl hasonló a Falhoz és a Barikádhoz.
- 19. **Gyorsítás** (3 mana): Túl hasonló a Dupla lépéshez.
- 20. **Tükörpajzs** (3 mana): A Láthatatlanság (bekerült) ugyanezt a szerepet tölti be, egyértelműbben.
- 21. **Gyengítő Átok** (3 mana): Túl hasonló a Dimenzióváltáshoz (csak huszárként léphet) és a Gyengítéshez.
- 24. **Szentjánosbogár** (3 mana): Túl hasonló a Láthatatlansághoz.
- 25. **Vonalzár** (3 mana): Nagyon szűk hatás, a Fal/Barikád jobban lefedi.
- 26. **Kettős fenyegetés** (3 mana): Kétszeres Erőltetett menet.
- 27. **Tértranszfer** (4 mana): Ugyanaz, mint a Csere.
- 29. **Kővé dermesztés** (4 mana): Túl hasonló a Gyengítéshez.
- 30. **Sötét Alku** (4 mana): Túl hasonló a Vérárhoz.
- 32. **Főnix** (4 mana): Túl hasonló a Megerősítéshez és a Nekromanciához.
- 33. **Illúziófal** (4 mana): Túl hasonló a Barikádhoz.
- 34. **Időhúzás** (4 mana): A játékban nincs sakkóra.
- 35. **Árnyéklépés** (4 mana): Túl hasonló a Dupla lépéshez.
- 36. **Metamorfózis** (5 mana): Túl hasonló az Azonnali átváltozáshoz.
- 37. **Láncvillám** (5 mana): Túl hasonló a Meteorhoz.
- 38. **Belső Lázadás** (5 mana): Túl hasonló a Gyengítéshez.
- 39. **Szentély** (5 mana): A Láthatatlanság és az Utolsó esély együtt lefedi.
- 42. **Kettős Idézés** (5 mana): Túl hasonló a Túltöltéshez, és két ingyen spell egy körben túl erős.
- 43. **Képlékeny Tábla** (5 mana): Két üres terület cseréje nem változtat semmit.
- 45. **Feltámadás** (6 mana): Túl hasonló a Nekromanciához.
- 46. **Mindentudás** (6 mana): Túl hasonló a Valóságtöréshez.
- 47. **Térhajlítás** (6 mana): Túl hasonló a Cseréhez és a Teleporthoz.
- 48. **Abszolút Zárás** (6 mana): Túl hasonló az Időmegállításhoz.
- 49. **Kereszttűz** (6 mana): Nem egyértelmű leírás; a Futólövész hasonló szerepet tölt be.

## Módosított spellek és indoklás

A feladat kérése szerint: ha egy spell eredeti formájában technikailag vagy játékmenet szempontjából problémás volt, minimálisan átalakítottam, hogy a játék stabil és játszható maradjon. Ide kerültek a kérésre végzett balansz-módosítások és az egyensúly-teszt ([BALANCE.md](BALANCE.md)) alapján hangolt lapok is.

### 5. 👑 Vezér kegyelme

- **Eredeti:** A vezér a következő saját kör kezdetéig +1 mezőnyi maximális mozgástávolságot kap.
- **Most:** A vezéred a következő saját köröd kezdetéig huszárként is léphet és üthet (+1 mozgásminta).
- **Miért:** A vezér 8×8-as táblán már most is bármilyen távolságra elér egy vonalban, így a „+1 mező” semmit sem változtatna. A +1 helyett +1 mozgásmintát kap (huszárlépés), a költség és az időtartam változatlan.

### 6. 👣 Királylépés (2 → 1 mana)

- **Eredeti:** Ebben a körben a király két mezőt léphet. (2 mana)
- **Most:** Ebben a körben a király a normál lépésénél egy további mezőt léphet egyenes vonalban (összesen 2 mezőt). A köztes mező legyen üres és ne legyen támadott.
- **Miért:** Egyensúly-teszt (1000 AI-játszma, véletlen paklik): a pakli a játszmák 39%-át nyerte – a ritkán hasznos királylépés 2 manáért drága volt. Most 1 mana.

### 9. 💪 Megerősítés (2 → 4 mana)

- **Eredeti:** Egy saját bábu túléli az első következő leütési kísérletet, és a helyén marad. (2 mana)
- **Most:** Egy saját (nem király) bábu túléli az első következő leütési kísérletet és a helyén marad; a támadó bábu visszapattan a kiinduló mezőjére, a lépése elvész. Addig marad érvényben, amíg el nem használódik.
- **Miért:** Balansz-módosítás (kérésre): a korlátlan ideig tartó, bármelyik bábura – akár a vezérre – rakható védelem 2 manáért túl olcsó volt; most 4 mana.

### 10. 🕯️ Áldozat

- **Eredeti:** Egy saját gyalog megsemmisül, cserébe azonnal +1 manát kapsz.
- **Most:** Egy saját gyalog megsemmisül, cserébe azonnal +3 manát kapsz (vonalnyitásra, ciklusgyorsításra és egy nagy spell előrehozására jó).
- **Miért:** Egyensúly-teszt (1000 AI-játszma, véletlen paklik): a pakli a játszmák 42%-át nyerte – 1 manáért +1 mana nettó semmi volt, egy gyalogért. Most +3 mana (nettó +2).

### 12. 🌀 Teleport (4 → 5 mana)

- **Eredeti:** Egy saját bábut áthelyezhetsz bármely üres mezőre, amelyre az adott bábu normál esetben egyetlen lépéssel eljuthatna.
- **Most:** Egy saját bábut áthelyezel egy üres mezőre, ahová a saját mozgásmintájával egy lépésben eljuthatna – a köztes bábuk nem akadályozzák (teleportál). Nem üt, és nem számít normál lépésnek.
- **Miért:** Szó szerint értelmezve ez egy sima, ütés nélküli lépés lett volna (a 2 manás Huszárugrásnál is gyengébb). A „teleport” jelleg miatt a köztes bábukat figyelmen kívül hagyja. Ára kérésre 4-ről 5 manára emelkedett.

### 16. ⏩ Dupla lépés

- **Eredeti:** A normál sakk-lépésed után egy másik saját bábuval is végrehajthatsz egy szabályos lépést.
- **Most:** A normál lépésed után egy MÁSIK saját bábuval még egy szabályos lépést tehetsz. Ha az első lépés sakkot ad, a bónuszlépés elvész.
- **Miért:** Két egymást követő lépés sakkadással kombinálva védhetetlen matthoz vezethetne (az ellenfél nem reagálhat a sakkra). A marseille-i sakk szabálya szerint: ha az első lépés sakkot ad, a bónuszlépés elvész. A spellt a normál lépés előtt kell kijátszani (a normál lépés automatikusan befejezi a kört).

### 17. 🌟 Azonnali átváltozás

- **Eredeti:** Egy utolsó sorra érkezett gyalog azonnal átváltoztatható.
- **Most:** Egy saját gyalog, amely már a 6. vagy 7. soron áll (a saját szemszögedből), azonnal átváltozik vezérré, bástyává, futóvá vagy huszárrá – helyben.
- **Miért:** Az utolsó sorra érkező gyalog a sakkszabályok szerint amúgy is azonnal átváltozik, így a spellnek nem lenne hatása. Most a már „utolsó sorokba” (6–7. sor) ért gyalogot változtatja át helyben.

### 18. ⚜️ Királyvédelem

- **Eredeti:** A királyod a következő ellenfélkörben védett a leütéstől, de továbbra sem állhat szabályosan sakkban.
- **Most:** Az ellenfél következő körében nem adhat sakkot a királyodnak – sem lépéssel, sem spellel. A király továbbra sem léphet sakkba.
- **Miért:** A sakkban a királyt soha nem lehet leütni, így a „leütés elleni védelem” hatástalan lenne. A legközelebbi értelmes változat: a védett királyt a következő ellenfélkörben nem lehet sakkba hozni.

### 20. 🏯 Újrasáncolás (3 → 1 mana)

- **Eredeti:** Újra engedélyezi a sáncolást. (3 mana)
- **Most:** Ha a király és egy bástya a kiinduló mezőjén áll, újra engedélyezi a sáncolást – akkor is, ha a jog korábban (lépés vagy spell miatt) elveszett.
- **Miért:** Egyensúly-teszt (1000 AI-játszma, véletlen paklik): a pakli a játszmák 39%-át nyerte, a lap ritkán kijátszható és kis hatású. Most 1 mana, így legalább olcsón továbbforgatható.

### 22. 🥀 Gyengítés (2 → 3 mana)

- **Eredeti:** Egy ellenséges (nem király) bábu a következő körében egyáltalán nem mozoghat (és nem üthet). (2 mana)
- **Most:** Egy ellenséges (nem király) bábu a következő körében egyáltalán nem mozoghat (és nem üthet).
- **Miért:** Balansz-módosítás (kérésre): egy bábu – akár a vezér – teljes megbénítása 2 manáért túl olcsó volt (a Gyökér és a Vakfolt ennyiért csak félig köt meg); most 3 mana.

### 26. 🤐 Némaság (1 → 2 mana)

- **Eredeti:** Az ellenfél a következő körében nem használhat spellt. (1 mana)
- **Most:** Az ellenfél a következő körében nem használhat spellt.
- **Miért:** Balansz-módosítás (kérésre): egy teljes kör spell-tiltás 1 manáért túl olcsó volt; most 2 mana.

### 29. 🚫 Hatástalanítás (3 → 2 mana)

- **Eredeti:** Egy ellenfél-bábu a következő saját köréig nem üthet.
- **Most:** Egy ellenséges (nem király) bábu a következő saját köre végéig nem üthet, és a támadásai sem számítanak: nem ad sakkot, a királyod mellé/elé léphet.
- **Miért:** Szó szerint azonos lett volna a Vakfolttal (25). A megkülönböztetés: a Vakfolt csak az ütést tiltja, a Hatástalanítás a bábu fenyegetését (sakkadás, mezőtartás) is kikapcsolja. Ára kérésre 3-ról 2 manára csökkent.

### 31. 🧱 Fal (2 → 1 mana)

- **Eredeti:** Egy üres mezőre falat emelsz az ellenfél következő körének végéig. (2 mana)
- **Most:** Egy üres mezőre falat emelsz az ellenfél következő körének végéig: sem bábu nem léphet rá, sem nem haladhat át rajta (a huszár átugorhatja, de nem érkezhet rá).
- **Miért:** Egyensúly-teszt (1000 AI-játszma, véletlen paklik): a pakli a játszmák 40%-át nyerte – egy körig álló, a saját bábuidat is akadályozó fal 2 manáért drága volt. Most 1 mana.

### 34. 🧲 Gravitáció (3 → 2 mana)

- **Eredeti:** Az ellenfél következő körének végéig egyik huszár sem ugorhat át bábukat. (3 mana)
- **Most:** Az ellenfél következő körének végéig egyik huszár sem ugorhat át bábukat: a huszár csak akkor léphet, ha a hosszabbik irányban mellette lévő mező üres (mint a kínai sakk lova).
- **Miért:** Egyensúly-teszt (1000 AI-játszma, véletlen paklik): a pakli a játszmák 38%-át nyerte – a mindkét félre ható, rövid huszárzár 3 manáért drága volt. Most 2 mana.

### 36. 🪞 Tükör

- **Eredeti:** Egy saját bábu átkerülhet egy üres mezőre, az eredeti bábu pedig eltűnik. Ez ne hozzon létre másolatot.
- **Most:** Egy saját (nem király) bábu átkerül a tükörképmezőjére (a tábla függőleges középvonalára tükrözve, pl. c3 → f3), ha az üres. Az eredeti helyéről eltűnik – nem jön létre másolat.
- **Miért:** A tábla bármely üres mezőjére való áthelyezés 3 manáért erősebb lett volna a 4 manás Teleportnál. A „Tükör” név alapján a bábu a tükörképmezőjére kerül.

### 37. ⏸️ Időmegállítás

- **Eredeti:** Az ellenfél a következő körében nem tehet normál sakk-lépést, de egy spellt használhat.
- **Most:** Az ellenfél a következő körében nem tehet normál sakk-lépést, legfeljebb egy spellt használhat. Kivétel: ha a királya sakkban van, léphet, hogy elhárítsa.
- **Miért:** Kiegészítés a király biztonsága érdekében: ha az időmegállítás után sakkot adsz, az ellenfél léphet a sakk elhárítására, különben a spell automatikus mattot jelentene.

### 39. 🌋 Földrengés (4 → 3 mana)

- **Eredeti:** Minden gyalog egy mezővel közelebb kerül az aktuális menetirányának megfelelően, ha az adott mozgás szabályosan végrehajtható.
- **Most:** Minden gyalog (mindkét színből) egyszerre egy mezőt előrelép a saját menetirányában, ha előtte üres a mező. Átváltozó sorra nem lép, és ha két gyalog ugyanarra a mezőre lépne, egyik sem mozdul.
- **Miért:** Pontosítás a stabilitás érdekében: a lépések egyszerre történnek, az átváltozó sorra nem lép gyalog (egyszerre több átváltozás elkerülése), ütközés esetén egyik gyalog sem mozdul, és ha az eredmény a királyodat sakkba hozná, a spell nem használható. Egyensúly-teszt (1000 AI-játszma, véletlen paklik): a pakli a játszmák 42%-át nyerte – a mindkét félnek segítő gyalogroham 4 manáért drága volt; most 3 mana.

### 40. 🌌 Dimenzióváltás

- **Eredeti:** Egy kiválasztott 3×3-as területen a bábuk mozgása egy körig megváltozik a spell által meghatározott módon.
- **Most:** Kijelölsz egy 3×3-as területet: az ellenfél következő körének végéig az ott álló összes nem király bábu (mindkét színből) kizárólag huszárként léphet és üthet.
- **Miért:** Az eredeti leírás nem határozta meg a változást. Meghatározott szabály: a zónában álló nem király bábuk huszárként mozognak.

### 42. 🔋 Túltöltés (3 → 2 mana)

- **Eredeti:** A következő spellt 2 manával olcsóbban használhatod, minimum 1 mana költséggel. (3 mana)
- **Most:** A következő spelled 2 manával olcsóbb (minimum 1 mana). A kedvezmény megmarad, amíg fel nem használod.
- **Miért:** 3 manáért 2 mana megtakarítás mindig veszteséges lett volna. 2 manás költséggel semleges „mana-akkumulátor”: segít a 6-os plafon feletti manát átmenteni.

### 43. ⚡ Arcane Surge (4 → 1 mana)

- **Eredeti:** Azonnal kapsz 3 manát, de a következő saját köröd végéig a maximális manád 4. (4 mana)
- **Most:** Azonnal kapsz 3 manát, de a következő saját köröd végéig a maximális manád 4.
- **Miért:** 4 manáért 3 manát adott volna vissza (és még plafont is szabott), vagyis mindig veszteséges volt. 1 manás költséggel „vészhelyzeti töltés”: +2 nettó mana, cserébe két körig max. 4.

### 46. 🕊️ Utolsó esély (5 → 3 mana)

- **Eredeti:** Csak ha kevesebb bábud van: minden saját bábud túléli a következő leütési kísérletet. (5 mana)
- **Most:** Csak ha kevesebb bábud van, mint az ellenfélnek: minden saját bábud túléli a következő leütési kísérletet az ellenfél következő körének végéig.
- **Miért:** Egyensúly-teszt (1000 AI-játszma, véletlen paklik): a pakli a játszmák 38%-át nyerte, és a lapot szinte sosem lehetett jól kijátszani – csak hátrányban használható, egy körig véd, mégis a korlátozott 5 manás helyet foglalta. Most 3 mana.

### 47. ⚔️ Kivégzés (6 → 5 mana)

- **Eredeti:** Azonnal leüthetsz egy legfeljebb 3 pont értékű ellenfél-bábut, függetlenül a távolságtól. (6 mana)
- **Most:** Azonnal leütsz egy legfeljebb 3 pont értékű ellenséges bábut (gyalog, rabszolga, huszár, futó), bárhol is áll. Királyt nem célozhat; a pajzs véd, a megerősítés elnyeli (kivéve Halálbélyeg esetén).
- **Miért:** Balansz-módosítás (kérésre): 6 manáért egyetlen könnyűtiszt elvesztése kevés volt; most 5 mana.

### 48. ☄️ Meteor

- **Eredeti:** Pusztíts el egy nem király bábut, valamint minden vele szomszédos gyalogot.
- **Most:** Elpusztítasz egy legfeljebb 4 pontos bábut (gyalog, rabszolga, huszár, futó – bástyát, vezért nem) és a vele szomszédos gyalogokat/rabszolgákat (bármelyik színből) – összesen legfeljebb 4 pontnyi anyagot (gyalog/rabszolga 1, huszár/futó 3). A becsapódás után először az ellenséges, aztán a saját szomszédokat éri. A pajzs véd, a megerősítés elnyeli.
- **Miért:** Balansz-módosítás (kérésre): egy találattal akár vezér + 8 gyalog is eltűnhetett, ezért lett egy 9 pontos korlát. Egyensúly-teszt (1000 AI-játszma, véletlen paklik): a Meteoros pakli így is a játszmák 85%-át nyerte (a 6 manás lapok mind kiugróan erősek voltak), 5 pontos korláttal (vezér nélkül) még mindig 74%-ot. Most 4 pont: bástyára és vezérre nem lehet lőni.

### 49. 🧟 Nekromancia (5 → 2 mana)

- **Eredeti:** Egy korábban levett saját gyalogod visszatér a kezdősorodra egy általad választott üres mezőre. (5 mana)
- **Most:** Egy korábban levett saját gyalogod visszatér a kezdősorodra egy általad választott üres mezőre.
- **Miért:** Balansz-módosítás (kérésre): egyetlen gyalog visszahozása a kezdősorra 5 manáért túl drága volt; most 2 mana.

### 50. 🔮 Valóságtörés

- **Eredeti:** Egy teljes körig a normál bábumozgási szabályok jelentős része figyelmen kívül hagyható. A király továbbra sem léphet sakkba, és király nem üthető le.
- **Most:** Ebben a körben a nem király bábuid átsiklanak a köztes SAJÁT bábuidon (az ellenségeseken nem) – a gyalog kettőslépése is. A király nem léphet sakkba, királyt ütni nem lehet, a falak továbbra is akadályoznak.
- **Miért:** Konkretizálva: a saját köröd idejére a bábuid átsiklanak a köztes bábukon és +1 királylépést kapnak. Csak a te köröd, hogy ne segítse az ellenfelet is. Egyensúly-teszt (1000 AI-játszma, véletlen paklik): a pakli a játszmák 78%-át nyerte, főleg mert a bábuk az ellenséges bábukon át is ütöttek (a gyalogfal mögött álló bástyát, vezért). Most csak a saját bábuikon siklanak át – és mivel így is 66%-ot ért el, a „+1 mező bármely irányba” kiegészítés is kimaradt.

### 51. 👥 Brigád (5 → 3 mana)

- **Eredeti:** Ugyanez 5 manáért.
- **Most:** Leidézel 5 rabszolgát a saját 1–3. sorodba, az általad választott üres mezőkre. A rabszolga gyalogszerű bábu: mindig csak egy mezőt léphet előre (kezdő kettőslépés sincs), nem üthet, ezért nem támad és sakkot sem ad, és nem változik át. Leütni lehet (1 pont), de mana nem jár érte.
- **Miért:** Egyensúly-teszt (1000 AI-játszma, véletlen paklik): a Brigádos pakli csak a játszmák 28%-át nyerte – 5 manáért 5 ütni nem tudó bábu kevés volt, és minden leütött rabszolga +1 manát adott az ellenfélnek. Most 3 mana, és a rabszolga leütéséért nem jár mana.

### 52. 🧬 Klón

- **Eredeti:** Ára a bábu értékének fele + 1 (gyalog/rabszolga 2, huszár/futó 3, bástya 4, vezér 6).
- **Most:** Leklónozod egy saját (nem király, nem vezér) bábudat, és a klónt lerakod a bábu melletti (1 mezőnyire lévő) bármelyik szabad mezőre – kivéve, ha onnan sakkot adna. A klón félig átlátszó, ugyanúgy mozog, mint az eredeti, de amint leüt valamit, szertefoszlik. Egyszerre csak egy klónod lehet. Ára: a bábu értékének fele + 2, felfelé kerekítve (gyalog/rabszolga 3, huszár/futó 4, bástya 5).
- **Miért:** Egyensúly-teszt (1000 AI-játszma, véletlen paklik): a Klónos pakli a játszmák 66%-át nyerte. Minden klón 1 manával drágább (2–6 helyett 3–5 mana), vezért nem lehet klónozni, és (mivel így is 62% lett) egyszerre csak egy klónod lehet.

### 53. 🧀 Francia sajt (2 → 3 mana)

- **Eredeti:** Ugyanez 2 manáért.
- **Most:** Válassz egy saját gyalogot: ebben a körben a normál lépéseként en passant üthet BÁRMILYEN mellette (ugyanabban a sorban, közvetlenül balra/jobbra) álló ellenséges bábut: átlósan előre lép az üres mezőre a bábu mögé, a mellette álló bábu pedig megsemmisül. Királyt és vezért nem üthet, a pajzs véd, a megerősítés elnyeli.
- **Miért:** Egyensúly-teszt (1000 AI-játszma, véletlen paklik): a pakli a játszmák 65%-át nyerte – 2 manáért egy gyalog bármilyen mellette álló bábut, akár vezért üthetett. Most 3 mana, és (mivel így is 63%-ot ért el) vezért nem üthet.

### 55. 🧙 Mana mágus (3 → 2 mana)

- **Eredeti:** Egyszerre több mana mágus is dolgozhatott. (3 mana)
- **Most:** Egy legfeljebb 3 pont értékű saját bábudat (gyalog, rabszolga, huszár, futó) mana mágussá teszed a következő 3 saját körödre. Amíg él: minden körödben +1 extra manát kapsz (összesen +2/kör), és ha üt vele, +1 extra manát kapsz a szokásos +1 mellé. Aki spellel öli meg, azonnal 1 manát veszít. Egyszerre csak egy mana mágusod dolgozik: ha újat teszel, a régi elveszíti az erejét.
- **Miért:** Egyensúly-teszt (1000 AI-játszma, véletlen paklik): a pakli a játszmák 63%-át nyerte – az újra és újra kijátszott, egymás mellett dolgozó mágusok túl sok manát termeltek. Egyszerre csak egy mágus dolgozik: az új a régi helyére lép (a lap így mindig kijátszható, nem ragad be a kézbe). Halmozás nélkül 3 manáért már veszteséges volt (37–44%), ezért 2 mana.

### 60. 📣 Provokáció (2 → 3 mana)

- **Eredeti:** Ugyanez 2 manáért.
- **Most:** Kijelölsz egy ellenséges gyalogot vagy rabszolgát: az ellenfél következő körében a normál lépését ezzel a bábuval kell megtennie, ha az tud szabályosan lépni (spelleket ettől még használhat).
- **Miért:** Egyensúly-teszt (1000 AI-játszma, véletlen paklik): a pakli a játszmák 58–67%-át nyerte (két futásban), az AI játszmánként 3–4-szer kényszerített vele. Most 3 mana.

### 72. 🐉 Sárkánytűz

- **Eredeti:** Az útjába eső nem király bábuk elpusztulnak, összesen legfeljebb 9 pontnyi anyag.
- **Most:** Tűzcsóvát indítasz egy általad választott mezőről egy átlós irányban a tábla széléig: az útjába eső nem király bábuk (mindkét színből) elpusztulnak, összesen legfeljebb 4 pontnyi anyag, az út sorrendjében – ami már nem fér bele (bástya, vezér soha), azt a tűz átugorja. A pajzs véd, a megerősítés elnyeli.
- **Miért:** Egyensúly-teszt (1000 AI-játszma, véletlen paklik): a Sárkánytüzes pakli a játszmák 80%-át nyerte, 5 pontos korláttal még 61–70%-ot. Most 4 pont, mint a Meteornál: bástyát, vezért a tűz átugorja.

### 73. ☠️ Végítélet (6 → 4 mana)

- **Eredeti:** Minden gyalog és rabszolga a táblán (mindkét színből) elpusztul. A pajzs véd, a megerősítés elnyeli.
- **Most:** Minden ellenséges gyalog és rabszolga elpusztul, amely a te térfeleden (a saját szemszögedből az 1–4. sorban) áll – a Kaszás egyenként végez velük. A pajzs véd, a megerősítés elnyeli.
- **Miért:** Módosítás (kérésre): az eredeti változat a saját gyalogjaidat – a királyod előtti gyalogfalat is – elvitte, így 6 manáért többnyire semmit sem ért. Most csak a te térfeleden álló ellenséges gyalogokat és rabszolgákat sújtja, 5 manáért. Egyensúly-teszt (1000 AI-játszma, véletlen paklik): így is csak 38–40%-ot ért el (ritkán van célpontja), ezért 4 mana.

### 75. 🌑 Végzet

- **Eredeti:** A sima kijátszás is bármelyik ellenséges (nem király) bábut elpusztíthatta, a vezért is, és egy kijátszás után felébredt.
- **Most:** Egy ellenséges gyalog vagy rabszolga elpusztul – semmi sem védi meg (sem pajzs, sem megerősítés, sem Láthatatlanság vagy más védőspell). A lökéshullám a körülötte álló 8 mezőn minden nem király bábut (mindkét színből) egy mezővel egyenesen kifelé lök, ha a célmező üres (gyalog nem kerülhet az 1./8. sorra). Az ellenfél +1 manát kap. Körforgás: minden sima kijátszás tölt egyet a lapon; a második után, amikor legközelebb a kezedbe kerül, FELÉBREDVE játszhatod ki – akkor bármelyik nem király bábut sújthatja (bástyát, vezért is), és a bábu kitörlődik a létezésből: semmi sem hozza vissza, és ha tiszt volt, az ellenfél többé nem kaphat ilyen bábut. Utána a lap újra töltődik.
- **Miért:** Egyensúly-teszt (1000 AI-játszma, véletlen paklik): a Végzetes pakli a játszmák 78%-át nyerte. Lépésenként: a sima kijátszás csak legfeljebb 3 pontos bábut sújthatott (75%), a felébredéshez két sima kijátszás kellett (72%) – a sima forma egymagában is egy Meteornyi erő volt. Most a sima Végzet csak gyalogot vagy rabszolgát sújt (a lökéshullámmal együtt ez a lap feltöltése), a felébredt pedig bármit: a kitörlés a játszma ritka, nagy pillanata.

## Kategóriák

- **Mozgás** (14): Gyalogroham, Huszárugrás, Futóáldás, Bástyatöltés, Vezér kegyelme, Királylépés, Erőltetett menet, Teleport, Dupla lépés, Tükör, El az útból!, Gyorssánc, Gyalogugrás, Cserkész
- **Védelem** (8): Gyalogpajzs, Huszárpajzs, Megerősítés, Vészcsere, Királyvédelem, Sakkmegszakító, Utolsó esély, Láthatatlanság
- **Irányítás** (9): Gyengítés, Gyökér, Vakfolt, Némaság, Hatástalanítás, Gyalogfagyasztás, Provokáció, Vihar, Üvegátok
- **Taktika** (12): Csere, Azonnali átváltozás, Újrasáncolás, Káosz, Nekromancia, Valóságtörés, Brigád, Klón, Francia sajt, Mágnes, Taszítás, Átképzés
- **Terep** (7): Fal, Barikád, Gravitáció, Földrengés, Dimenzióváltás, Akna, Gravitációs kút
- **Idő** (3): Visszalépés, Időmegállítás, Visszatekerés
- **Mana** (10): Áldozat, Manaelszívás, Vérár, Túltöltés, Arcane Surge, Gambit, Mana mágus, Mana-letét, Mana-szomj, Mana-armageddon
- **Pusztítás** (8): Halálbélyeg, Kivégzés, Meteor, Futólövész, Pajzsromboló, Sárkánytűz, Végítélet, Végzet
