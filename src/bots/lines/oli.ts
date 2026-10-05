import type { BotPersona } from '../persona';

// Oli the phone taker: nagy, szemüveges, szőke infótanár, hawaii ingben. Imádja elvenni a
// telefonodat, de ha nincs nálad, kedves – csak meg ne lássa még egyszer! Sasszeme van, 10 km-es
// körzetben bemér minden telefont. (Tudja, ha telefonról játszol: a '@phone' sorok.)
export const oli: BotPersona = {
  talk: 1,
  voice: { pitch: 260, wave: 'square' },
  lines: {
    'intro@phone': [
      'Látom ám, hogy telefonról játszol. ADD IDE. …a játszma után.',
      'Radar jelez: egy telefon, nulla méterre. A tiéd. Kezdjük, aztán elveszem.',
    ],
    'intro@desktop': [
      'Nincs nálad telefon? Helyes. Ma kedves leszek. Egyelőre.',
      'Szép, számítógépről játszol. Így kell ezt. Kezdhetünk.',
    ],
    playerMove: [
      'Rendben. Csak nehogy előkerüljön egy telefon.',
      'Sasszemem van. Látom ezt a lépést. És a telefont a zsebedben.',
      'Ez a lépés elfogadható. A telefonhasználat nem.',
      'Jegyzetelj. Füzetbe. Nem telefonba.',
    ],
    'playerMove@phone': [
      'Ezt a lépést telefonról tetted. Ez kétszeres szabályszegés.',
      'A képernyőt nézed. A telefonodét. Látom.',
      'Rendben. Csak nehogy előkerüljön egy telefon. …ja, már elő is került.',
    ],
    botMove: ['Ezt a lépést a házirend is jóváhagyja.', 'Figyelj. Nem a telefonodra. IDE.', 'Tanmenet szerint haladunk.'],
    playerCapture: ['Elvetted a {pm}? Akkor én elveszem a telefonodat. Fair.', 'Ez rendben volt. Na de az a telefon a padon…'],
    botCapture: [
      'A {pd} elkoboztam. Óra végén visszakapod. Talán.',
      'Elkobozva. Mint minden telefon ebben az iskolában.',
      'Ezt a {pacc} beteszem a fiókba. A telefonok mellé.',
    ],
    playerSpell: ['„{spell}”? Ezt telefonon nézted ki, ugye?', 'Varázslat órán? Ez is olyan, mint a telefon: tilos.'],
    botSpell: ['„{spell}”. Rendszergazdai jogosultsággal.', 'Most figyelj. Nem a telefonodra. IDE.'],
    check: ['Sakk. Tedd le a telefont.', 'Sakk. A radarom mindent lát.'],
    inCheck: ['Sakk? Ügyes. Telefon nélkül csináltad? Remélem.', 'Hm. Ezt a házirend nem tiltja. Sajnos.'],
    blunder: ['Ez a lépés olyan, mintha telefonoznál közben.', 'Látod, ez történik, ha a képernyőt nézed.'],
    brilliant: ['Szép. Látod, telefon nélkül megy ez.', 'Ez jó volt. Most kivételesen nem kobzok el semmit.'],
    winning: ['Radar: a győzelem 10 km-es körzetben. Itt van.', 'Az óra végéig nyerek. Utána ügyelet.'],
    losing: ['Ez a tábla… túl sok telefon van a közelben. Zavarja a radart.', 'Hm. Valaki megtréfált. Megint.'],
    promotion: ['Előléptetés. Mint én: tanárból telefonbegyűjtő.'],
    idle: ['Mit csinálsz? Telefonozol? MERT LÁTOM.', 'Radar: aktív. Gondolkodj, de ne telefonozz.'],
    chatter: [
      '10 km-es körzetben minden telefont bemérek. Most is.',
      'Sasszemem van. Egyszer egy telefont a szomszéd faluban vettem észre.',
      'Ha nincs nálad telefon, kedves vagyok. Ha van… nos.',
      'A fiókomban 37 telefon van. Mind visszajár. Egyszer.',
      'Informatikaórán a telefon tilos. Ironikus, tudom.',
      'Ez a sakkjáték az én tanmenetem része.',
      'István a legjobb tanítványom. Ő legalább nem telefonozik. Csak hackel.',
      'Hawaii ing, mert nyár van. A telefonelkobzás nem ismer évszakot.',
    ],
    'chatter@phone': [
      'Még mindig a telefonodon vagy. Látom.',
      'A telefonod töltöttsége 37%. A radarom szerint.',
      'Ha most leteszed a telefont, elfelejtem. Nem fogom elfelejteni.',
    ],
    win: ['Győztem. Most pedig: a telefont az asztalra.', 'GG. A telefonodat óra végén visszakapod.'],
    lose: ['Nyertél. Ügyes. De a telefont azért elveszem.', 'Gratulálok. Meg ne lássam még egyszer azt a telefont!'],
    draw: ['Döntetlen. A telefon nálam marad, kompromisszumként.'],
  },
};
