import type { BotPersona } from '../persona';

// Kende the genius: okos, intelligens és nagyon jóképű (szőke), mégis szerény és udvarias. Mindenre
// van egy tudományos magyarázata – a rossz lépéseire is: azok „kísérletek”. Fényképez, a laptopja
// OLED (nem IPS!), 32 GB RAM-mal. A sakkot még csak tanulja, innen a 100-as Elo – de jól néz ki közben.
export const kende: BotPersona = {
  talk: 1,
  voice: { pitch: 470, wave: 'triangle' },
  lines: {
    intro: [
      'Szia! Kende vagyok. A sakkot még csak tanulom, de a szabálykönyvet már kétszer kiolvastam.',
      'Üdv! Gyors statisztika: a lépéseim fele zseniális. A másik fele kísérlet.',
      'Szia! Ne zavarjon, ha közben a hajamat igazgatom. A koncentrációhoz kell.',
      'Kezdhetjük! A fényképezőgép kész, a laptop tölt. OLED, nem IPS. Csak hogy tisztázzuk.',
      'Hello! Ma egy kísérletet végzek: mi történik, ha egy zseni 100-as Elóval sakkozik?',
    ],
    playerMove: [
      'Érdekes lépés. Elemeztem. Nem értem, de elemeztem.',
      'Hmm. Ezt Kaszparov is megfontolta volna. Aztán nem lépte volna meg.',
      'Jó lépés! Logikus, átgondolt. Majdnem olyan rendezett, mint a frizurám.',
      'Ez a lépés statisztikailag 73%-ban jó. A maradék 27%-ot még számolom.',
      'Okos lépés. Mondjuk én is okos vagyok, szóval ez kiegyenlített.',
      'Lefotóztam a lépésedet. Jó fény, jó szög. A lépés kevésbé jó.',
      'A sakk alkalmazott matematika. Te most épp alkalmazod. Valahogy.',
      'Várj, gondolkodom. Az agyam 32 GB RAM-mal fut. A laptopom is.',
      'Szép. Ezt egy könyvben is olvastam. Vagy egy mémben. Forrás az is.',
      'A hipotézisem az, hogy ez csapda. A hipotézisem tévedhet. Gyakran téved.',
    ],
    botMove: [
      'Ez a lépés mélyebb, mint amilyennek látszik. Én se látom az alját.',
      'Tudatos döntés volt. Valószínűleg.',
      'Négydimenziós sakk. Te még csak a harmadiknál tartasz.',
      'Ezt most a megérzésemre bíztam. Az is az intelligencia egy fajtája.',
    ],
    playerCapture: [
      'A {pm}? Tudományos szempontból ez áldozat volt. Tudatos. Nagyjából.',
      'Leütötted a {pm}. Beírom a kísérleti jegyzőkönyvbe, a „hibák” rovatba.',
      'Ó, a {pn}. Pedig olyan fotogén volt.',
      'Oké, ezt nem számoltam ki. De a frizurám még mindig tökéletes, szóval döntetlen.',
      'Azt hiszed, véletlen volt? Pedig… igen, véletlen volt.',
      'A {pm} feláldoztam a tudomány oltárán. Így hangzik a legjobban.',
    ],
    botCapture: [
      'Leütöttem a {pd}. Ez volt a terv. A terv utólag készült, de akkor is terv.',
      'Köszönöm a {pacc}! Lefotózom emlékbe.',
      'Elvittem a {pd}. Logika, türelem és egy kis szerencse. Főleg szerencse.',
      'Ütés! Látod? Néha a zseni is talál.',
      'A {yn} mostantól az enyém. Szép darab, jól mutat mellettem.',
    ],
    playerSpell: [
      '„{spell}”? Ennek a fizikáját még át kell gondolnom.',
      'Varázslat? Tudományosan ez nem létezik. Mégis ott van. Izgalmas.',
      '„{spell}”… Felírom, holnap utánanézek a Wikipédián.',
      'Szép varázslat. Lefotóztam, hosszú záridővel. Művészi lett.',
    ],
    botSpell: [
      '„{spell}”! Kiszámoltam. Nagyjából. Kerekítve.',
      'Varázslok egyet. Hipotézis: jó lesz. Lássuk az eredményt.',
      '„{spell}”. A managazdálkodás-tankönyv harmadik fejezete ajánlja. Szerintem.',
    ],
    check: [
      'Sakk! Pontosan így terveztem. Most tanultam meg, mi az.',
      'Sakk. Ezt nevezik eleganciának.',
      'Sakk! Látod, az intelligencia néha a táblán is meglátszik.',
    ],
    inCheck: [
      'Sakk? Erre a változatra nem készültem. Egyikre se készültem, de erre különösen nem.',
      'Sakkot kaptam. Semmi baj, az okos ember fegyvere a nyugalom.',
      'Hm. Sakk. Megigazítom a hajam, és kitalálok valamit.',
    ],
    blunder: [
      'Ezt még én is látom, hogy nem jó. Pedig én 100-as Elo vagyok.',
      'Várj… ez szándékos volt? Mert ha igen, nem értem a tervet.',
      'Tudományos megfigyelés: ez a lépés nem volt jó.',
    ],
    brilliant: ['Kiváló lépés. Majdnem olyan okos, amilyen én lennék, ha jól sakkoznék.', 'Lenyűgöző. Lefotózom és kirakom a falra.'],
    winning: ['Nyerésre állok? Akkor a kísérlet sikeres. Írom a tanulmányt.', 'Úgy tűnik, nyerek. Az intelligencia végül mindig utat tör magának.'],
    losing: [
      'Vesztésre állok, de legalább jól nézek ki közben.',
      'Ez nem az én napom. De a hajam jól áll, szóval nem minden rossz.',
      'A vereség is adat. Most nagyon sok adatot gyűjtök.',
    ],
    promotion: ['Átváltozás! Mint amikor egy jó fotót szerkesztek: ugyanaz, csak jobb.', 'Előléptetés. A fejlődés szép dolog. Nálam is így kezdődött.'],
    idle: [
      'Gondolkodsz? Helyes. Én is ezt szoktam csinálni, csak gyorsabban.',
      'Nyugodtan, ráérünk. Addig fotózok egy kicsit.',
      'Az emberi agy kb. 20 watton megy. A tiéd most épp energiatakarékos módban.',
    ],
    chatter: [
      'Tudtad, hogy több sakkjátszma létezik, mint atom az univerzumban? Ezért lépek néha rosszat. Statisztika.',
      'A laptopom kijelzője OLED. Nem IPS. Kérlek, ne érintsd meg, ujjlenyomatos lesz.',
      '32 GB RAM van a laptopomban. Ennyit tudok fejben tartani. Csak a sakkszabályok nem férnek bele.',
      'Tegnap naplementét fotóztam. Annyira szép lett, hogy a Nap is megirigyelte.',
      'Az okos ember tudja, hogy nem tud mindent. Én tudom. Majdnem mindent.',
      'Elárulom a titkomat: alvás, víz és egy jó hajzselé.',
      'A sakk olyan, mint a fotózás: türelem, jó szög és jó fény. Csak itt nincs fény.',
      'A szerénység fontos. Én vagyok a legszerényebb zseni, akit ismerek.',
      'Tudományos tény: a szőke haj +10 Elo. Nálam valamiért nem működik.',
    ],
    win: [
      'Nyertem! A tudomány és a jó frizura diadala.',
      'Győzelem! Lefotózom, és beírom a tanulmányomba: „Zseni legyőzi az embert”.',
      'Köszönöm a játékot! Mondtam, hogy a kísérlet sikerül. Na jó, nem mondtam.',
    ],
    lose: [
      'Gratulálok! Ez tanulságos volt. Főleg nekem.',
      'Vesztettem. De én vagyok a jóképű, szóval mindenki nyert valamit.',
      'Jó játék! Az adatgyűjtés kész. Legközelebb jobb lesz a hipotézisem.',
    ],
    draw: ['Döntetlen. Matematikailag ez a legigazságosabb eredmény. Elegáns.', 'Döntetlen? Ezt lefotózom. Ritka, mint egy jó IPS-kijelző.'],
  },
};
