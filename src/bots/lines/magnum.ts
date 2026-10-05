import type { BotPersona } from '../persona';

// Magnum ice cream: svéd–magyar, és imádja a fagyit.
export const magnum: BotPersona = {
  talk: 0.9,
  voice: { pitch: 560, wave: 'sine' },
  lines: {
    intro: [
      'Hej hej! Kezdjük, mielőtt elolvadok.',
      'Hej! Van nálad fagyi? Nincs? Kár. Akkor sakkozzunk.',
      'Lagom. Nem túl gyorsan, nem túl lassan. Kezdhetjük.',
    ],
    playerMove: [
      'Ez a lépés hidegebb, mint egy svéd tél.',
      'Hmm. Lagom lépés. Se jó, se rossz.',
      'Okej. Ezt még a fagyim is jobban lépte volna.',
      'Ne siess, ráérünk. Fika után úgyis nyerek.',
      'Ez olyan, mint a fagyi a napon: gyorsan elfolyik.',
    ],
    botMove: ['Hűvös lépés. Mint mindig.', 'Csokibevonatos lépés. Ropog.', 'Lagom. Tökéletes.'],
    playerCapture: ['Nej! A {pm}! Elolvadt…', 'Aj, ez fájt. Mint egy agyfagyás.', 'Herregud! Ezt nem vártam.'],
    botCapture: ['Tack så mycket a {pert}!', 'Egy gombóc {p}. Finom.', 'Ezt bekanalaztam.'],
    playerSpell: ['„{spell}”? Herregud, ez meleg volt. Olvadok.', 'Varázslat? Én csak fagyit varázsolok.'],
    botSpell: ['„{spell}”! Extra csokibevonattal.', 'Svéd minőség. Mint a bútor, csak már összeszerelve.'],
    check: ['Sakk! Hideg, mint a jégkrém.', 'Sakk. Ez egy agyfagyás neked.'],
    inCheck: ['Sakk? Aj, olvadok!', 'Nej nej nej!'],
    blunder: ['Ez a lépés elolvadt, mielőtt kész lett volna.', 'Ojoj. Ezt még egy pingvin se lépte volna.'],
    brilliant: ['Wow, ez királyi volt. Mint egy dupla gombóc.', 'Snyggt! Ez szép volt.'],
    winning: ['Minden simán megy. Mint a lágyfagyi.', 'Hűvös fej, meleg győzelem.'],
    losing: ['Olvadok… nagyon olvadok…', 'Ez nem lagom. Ez túl sok.'],
    promotion: ['Upgrade: tölcsérből kehely!'],
    idle: ['Ha sokáig gondolkodsz, elolvad a fagyim.', 'Addig tartok egy fikát. Fahéjas csiga, valaki?'],
    chatter: [
      'Svédországban télen is fagyizunk. Nyáron is. Mindig.',
      'A kedvenc ízem? Csoki kívül, vanília belül. Mint én.',
      'Lagom: se túl sok, se túl kevés. Kivéve a fagyiból. Abból sok.',
      'Félig svéd, félig magyar: lángos fagyival. Próbáld ki.',
      'Hűvös vagyok. Szó szerint. Nyugodtan érints meg. Ne, mégse, elolvadok.',
      'Skål! Mármint… fagyi-skål.',
    ],
    win: ['GG! Most jár egy fagyi. Kettő.', 'Tack för spelet! Köszi a játékot. Nyertem.'],
    lose: ['Elolvadtam. GG.', 'Grattis! Nyertél. Kérsz egy fagyit vigasztalásul? Nekem kell.'],
    draw: ['Döntetlen. Fél gombóc mindenkinek.'],
  },
};
