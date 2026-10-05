import type { BotPersona } from '../persona';

// Magyar Péter the man: végtelen aura, aurafarmer, diplomatikus ember. (Pártpolitika nélkül:
// a játékban mindenki játszhat vele, bárhová is szavaz.)
export const peter: BotPersona = {
  talk: 0.9,
  voice: { pitch: 300, wave: 'triangle' },
  lines: {
    intro: [
      'Jó napot. Végtelen aurával érkeztem. Kezdhetünk.',
      'Üdvözlöm. Ma diplomatikusan foglak legyőzni.',
      'Aura: végtelen. Türelem: szintén. Öné a lépés.',
    ],
    playerMove: [
      'Diplomatikusan fogalmazok: ez a lépés nem volt a legjobb.',
      'Mínusz száz aura. Sajnálom.',
      'Értem az álláspontját. Nem értek vele egyet.',
      'Ez a lépés aurát vesztett. Érzem.',
      'Tárgyaljunk. …nem, mégsem. Nincs min.',
      'Plusz ötven aura. Nekem, mert nyugodt maradtam.',
      'Érdekes kezdeményezés. Bizottság elé viszem.',
    ],
    botMove: ['Aura-lépés. Nézze meg jól.', 'Diplomatikus, de határozott.', 'Ezt a lépést nem kell megmagyarázni. Az aura beszél.'],
    playerCapture: [
      'Elvitte a {pm}. Diplomatikusan reagálok: …rendben.',
      'Ezt nem felejtem el. Diplomatikusan.',
      'Az aura-veszteség minimális. A bábu-veszteség már kevésbé.',
    ],
    botCapture: [
      'A {yn} mostantól az én aurámat erősíti.',
      'Kompromisszumot ajánlottam. A {yn} elfogadta.',
      'Plusz aura. Sok aura.',
    ],
    playerSpell: ['„{spell}”. Bátor. Az aurája meginog, de bátor.', 'Varázslat? Én az aurámmal varázsolok.'],
    botSpell: ['„{spell}”. Ez nem varázslat. Ez aura.', 'Aurafarm üzemmód: bekapcsolva.'],
    check: ['Sakk. Diplomatikus, de határozott.', 'Sakk. Az aura nem kérdez, cselekszik.'],
    inCheck: ['Sakk? Az aurám ezt nem engedélyezte.', 'Nyugodt vagyok. Az aura nyugodt.'],
    blunder: ['Ez a lépés mínusz ezer aura volt.', 'Diplomatikusan: ez hiba volt. Nem diplomatikusan: NAGY hiba.'],
    brilliant: ['Elismerem: ez aura-lépés volt.', 'Plusz ezer aura. Önnek. Most az egyszer.'],
    winning: ['Az aura győz. Mindig.', 'Ez aurafarming a legmagasabb szinten.'],
    losing: ['Az aura ideiglenesen lemerült. Töltőt kérek.', 'Tárgyalni szeretnék. Döntetlen? Nem? Rendben.'],
    promotion: ['Előléptetés. Aura-alapon.'],
    idle: ['Ráérünk. Az aura nem siet.', 'Gondolkodjon csak. Én addig aurát farmolok.'],
    chatter: [
      'Az aura nem vásárolható. Csak farmolható.',
      'Minden lépésem diplomatikus. Még a gonoszak is.',
      'Ha az aura hő lenne, ez a szoba most égne.',
      'Tudja, mi a titkom? Nyugalom. És végtelen aura.',
      'A tábla közepe az aura szíve. Jegyezze meg.',
      'Egy igazi férfi nem kapkod. Csak aurát gyűjt.',
    ],
    win: ['Győzelem. Diplomatikusan: gratulálok a második helyhez.', 'Végtelen aura plusz egy győzelem. Az még mindig végtelen.'],
    lose: ['Gratulálok. Diplomatikusan. Az aurám viszont köszöni, jól van.', 'Ön nyert. Az aura nem.'],
    draw: ['Döntetlen. A diplomácia győzelme.'],
  },
};
