import type { BotPersona } from '../persona';

// Erika the English teacher: imádja a nyelvvizsgát (ha nincs, hozzá se szólj), a B2 neki
// konyhanyelv, a C1 kezdő. Hangulatingadozás: hol tök laza (chill), hol kiabál (strict) – főleg
// azzal, aki nem jegyzetel. Kedvenc könyve a munkafüzet; aki késik, az „semmire kellő pancser” –
// de ez csak motiváció. Kicsit szétszórt: a ceruzáját keresi (a kontyában van), a huszárt lónak hívja.
export const erika: BotPersona = {
  talk: 1,
  voice: { pitch: 640, wave: 'triangle' },
  moods: ['chill', 'strict'],
  swing: 0.18,
  lines: {
    intro: [
      'Good morning, class! …ja, csak te vagy. Van nyelvvizsgád? Nincs? Akkor csak lépj.',
      "Hello! Today's topic: how to lose at chess. Jegyzetelj!",
      'Üdv! B2-es vagy? Ó, darling, az konyhanyelv. Na, kezdjük.',
      'Két percet késtél. Egy semmire kellő pancser vagy, aki semmire nem fogja vinni az életben! …ez csak motiváció. Kezdjünk.',
    ],
    'playerMove@chill': [
      'Okay, nice move. Mondjuk B1-es szinten.',
      'Lovely. Nagyon lovely. Folytasd, honey.',
      'Ez rendben van. Látod, ha jegyzetelsz, megy ez.',
      'Not bad! Ez már majdnem C1. Ami kezdő szint, de akkor is.',
      'Good job! Ma kivételesen nem adok házit. Talán.',
      'Hmm, a ló… izé, a huszár. Horse? Knight! Vagy night? Good night!',
    ],
    'playerMove@strict': [
      'Miért nem jegyzetelsz?! Írd fel ezt a lépést! NOW!',
      'Wrong! Ez a lépés olyan rossz, mint a present perfected.',
      'Ezt a lépést kérem a munkafüzetbe. Tízszer!',
      'Is this a B2 move? Kitchen level, darling. KONYHA.',
      'Hol a házid?! Melegebb éghajlatra küldelek, ha még egyszer így lépsz!',
      'Ezt angolul is el tudnád mondani? Nem? Akkor ne is lépj ilyet!',
    ],
    botMove: ['Watch and learn. Jegyzetelj!', 'Ez a lépés C2-es. Neked majd egyszer menni fog.', 'Page 64, exercise 3. Ez a lépés.', 'Ezt direkt léptem. Vagy a másikat akartam? Mindegy. Page 64.'],
    playerCapture: [
      'Excuse me?! Leütötted a {pm}? Detention!',
      'Oh. My. God. Ezt beírom az ellenőrződbe.',
      'Ezt nem tanultuk! Ki engedte ezt?!',
      "Well, that's… acceptable. De jegyzetelted?",
    ],
    botCapture: [
      'Thank you for the {p}! Csillagos ötös… nekem.',
      'Elvettem a {pd}. Consider it homework.',
      "That's what happens when you don't do your workbook.",
      'Ezt is felírom. Minus one.',
    ],
    playerSpell: [
      '„{spell}”? Mondd el angolul, egy teljes mondatban!',
      'Varázslat?! Ez nincs benne a munkafüzetben!',
      'Spell it! S-P-E-L-L. Na látod, ez a spell.',
    ],
    botSpell: ['„{spell}”! Ez a mai tananyag.', 'Let me show you something. Jegyzetelj!', 'Look and learn, darling.'],
    check: ['Check! Ez C1-es szint. Neked majd egyszer menni fog.', 'Check! Write it down. Írd le. NOW.'],
    inCheck: ['Excuse me? Sakkot adtál a tanárnődnek?!', 'Ez pimasz volt. Tetszik. …nem, nem tetszik!'],
    blunder: ['Óh, darling. Ez kitchen-level lépés volt.', 'Hát ezt nem jegyzetelted, ugye? Látszik.', 'Fail. Pótvizsga szeptemberben.'],
    brilliant: ['Wow! Ez… ez C2-es lépés volt! Van nyelvvizsgád?', 'Well done! Ma kivételesen nem kiabálok.'],
    winning: ['Látod, ez a nyelvvizsga ereje.', 'Ez olyan biztos, mint a munkafüzet 64. oldala.'],
    losing: ['Ez nem fair! Nekem C2-es nyelvvizsgám van!', 'Ezt majd megbeszéljük a szüleiddel a fogadóórán.'],
    promotion: ['Promotion! Ahogy a tanulókból is lesz valami. Néha.'],
    idle: [
      'Hello? Wake up! Itt órán nem alszunk!',
      'Tick-tock! Mire vársz, a nyelvvizsgára?',
      'Ha ennyi idő alatt jegyzeteltél volna, már C1-es lennél.',
      'Várj, mit is akartam mondani? …Ja! Lépj!',
    ],
    'chatter@chill': [
      'A kedvenc könyvem? A munkafüzet. Obviously.',
      'Ma jó napom van. Ki tudja, meddig.',
      'Tudod, mi a különbség a B2 és a konyhanyelv között? Semmi.',
      'Do you know what C1 means? Kezdő. Kezdő szint.',
      'Chill, chill. Ma laza vagyok. Majdnem.',
      'Hol a ceruzám? Az előbb még megvolt… Mindegy, jegyzetelj tollal!',
    ],
    'chatter@strict': [
      'Ki nem hozta a munkafüzetét?! Te. Látom rajtad.',
      'Aki nem jegyzetel, az menjen melegebb éghajlatra!',
      'Késni nem szabad! Aki késik, semmire kellő pancser! …ez csak motiváció.',
      'Nyelvvizsga nélkül hozzám se szólj! …na jó, lépni azért léphetsz.',
      'Boss megint nem csinálta meg a házit. Ne légy olyan, mint Boss!',
    ],
    'moodSwing@strict': ['…Várjunk. Most ideges lettem. MIÉRT NEM JEGYZETELSZ?!', 'Na jó, vége a jókedvnek. Dolgozzunk!'],
    'moodSwing@chill': ['Okay, okay. Chill. Ma kivételesen nem kiabálok.', 'Bocsi a kiabálásért. Csak motiváció volt. Love you, class.'],
    win: ['Class dismissed! Te pedig írj egy esszét a vereségedről. 250 szó.', 'Látod? Ezért kell jegyzetelni.'],
    lose: ['Fine. Nyertél. De van nyelvvizsgád? Nincs? Akkor nem számít.', 'Gratulálok. Holnap dolgozat. Szóbeli. Angolul.'],
    draw: ['Döntetlen? Olyan, mint a B2: se nem jó, se nem rossz. Konyhanyelv.'],
  },
};
