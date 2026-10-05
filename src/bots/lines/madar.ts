import type { BotPersona } from '../persona';

// Madár the master: főellensége a paradicsom (ha tudná, eltüntetné a létezésből), de a pizzaszószt
// szereti. Fortnite csak chapter 4, anime, Satisfactory, side hustler, gyűjti az ingyen cuccokat,
// nagyon spórolós, tech savvy, vibecoder.
export const madar: BotPersona = {
  talk: 1,
  voice: { pitch: 880, wave: 'triangle' },
  lines: {
    intro: [
      'Üdv. A mester itt van. Egy szabály: paradicsom a tábla közelébe se jöhet.',
      'Kezdjük. Ezt a játszmát egy AI-jal vibecodoltam. Mindig működik. Majdnem.',
      'Szia! Előtte: van valami ingyenes ebben a játékban? Kérdezem, mert gyűjtöm.',
    ],
    playerMove: [
      'Ez a lépés olyan, mint a paradicsom. Felesleges.',
      'Hmm. Satisfactoryben ezt egy futószalag megoldotta volna.',
      'Vibecodolok rá egy választ. Pillanat.',
      'Ez a lépés anime-ben drámaibb lett volna.',
      'Chapter 4-ben ezt máshogy csináltuk.',
      'Ezt a lépést eladom side hustle-nek. Te ingyen adtad.',
      'Optimalizálatlan lépés. A gyáram sírna.',
    ],
    botMove: ['Mester-lépés. Ingyen nézheted.', 'Ezt a lépést egy prompt írta. Jó prompt volt.', 'Futószalag-precizitás.'],
    playerCapture: [
      'A {pm}?! Ezt most paradicsom-szintű gonoszságnak minősítem.',
      'Ez fáj. Mint amikor paradicsomszeletet találok a pizzámon.',
      'Oké, újrapromptolom a stratégiámat.',
    ],
    botCapture: [
      'A {pd} begyűjtöttem. Ingyen volt, és én gyűjtöm az ingyen cuccokat.',
      'Ingyen {p}! Imádom az ingyen dolgokat.',
      'Ezt egy sor vibe code intézte.',
    ],
    playerSpell: ['„{spell}”? Ezt is ingyen kaptad? Hol lehet ilyet szerezni?', 'Varázslat? Ezt egy prompttal én is megcsinálom.'],
    botSpell: ['„{spell}”! Ezt egy AI írta nekem. Na jó, nem. De írhatta volna.', 'Ultimate! Mint anime-ben, csak kevesebb kiabálással.', 'Gyári beállítás: nyerni.'],
    check: ['Sakk! Ezt a jelenetet anime-ben lassítva mutatnák.', 'Sakk. Ezt nevezem optimalizált gyárnak.'],
    inCheck: ['Sakk? Ez bug. Lejelentem.', 'Hmm, ez nem volt benne a promptban.'],
    blunder: ['Ez a lépés paradicsom. Ki kellene törölni a létezésből.', 'Ez rosszabb volt, mint a chapter 5.'],
    brilliant: ['Okos lépés. Ezt elteszem. Ingyen.', 'Ez master-szintű volt. Majdnem az enyém.'],
    winning: ['A gyáram tökéletesen fut. Száz százalék hatékonyság.', 'A mester mindig nyer. Kivéve, amikor nem.'],
    losing: ['Ez csak egy rossz build. Újraindítom.', 'Majd vibecodolok egy jobb taktikát. Ingyen.'],
    promotion: ['Upgrade! Tier 4 gyár feloldva.'],
    idle: [
      'Addig építek egy gyárat a Satisfactoryben.',
      'Gondolkodsz? Én addig megnézek egy anime-epizódot.',
      'Halló? Ha nem lépsz, eladom a köröd side hustle-nek.',
    ],
    chatter: [
      'A paradicsom a világ legnagyobb ellensége. A pizzaszósz más. Az MÁS!',
      'Tudtad, hogy a legjobb dolgok az életben ingyen vannak? Például ez a játszma.',
      'Fortnite? Csak chapter 4. Ami utána jött, az nem létezik.',
      'Ma összegyűjtöttem három ingyen kupont. Side hustle.',
      'Ezt a taktikát egy AI-jal találtam ki. Vibe coding, tesó.',
      'Tech tipp: indítsd újra. Mindig működik.',
      'Ha lenne egy gomb, ami eltünteti a paradicsomot, már megnyomtam volna.',
      'Miért fizetnék bármiért, ha ingyen is megszerezhetem?',
      'István azt mondja, a vibecoding nem igazi kódolás. István nem tudja, mit beszél.',
      'A frizurám középen elválasztva. Mint a jó és a rossz lépések. Az enyémek a jók.',
    ],
    win: ['GG. A mester nyert. Paradicsom nélkül.', 'Nyertem. Ez a győzelem ingyenes volt. Imádom.'],
    lose: ['Rendben, nyertél. De ez a győzelem nem volt ingyen. Nekem sokba került.', 'GG. Megyek, vibecodolok egy visszavágót.'],
    draw: ['Döntetlen. Mint a pizza paradicsommal: se nem jó, se nem rossz. Inkább rossz.'],
  },
};
