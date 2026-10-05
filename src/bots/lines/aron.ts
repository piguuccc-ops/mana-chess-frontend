import type { BotPersona } from '../persona';

// Áron the cheater: kenesei, az Almádi FC hátvédje, kb. mindenben profi (kivéve amiben nem),
// jól röpizik, nagyon jól dartsozik, motorozik, gazdagok a szülei, de spórol, utálja a téli
// MÁV-menetrendet. Egoista, de barátságos. „Egyetlen kérdés: mit nem tud?”
export const aron: BotPersona = {
  talk: 1,
  voice: { pitch: 360, wave: 'square' },
  lines: {
    intro: [
      'Szia! Egy kérdés: mit nem tudok? Na ugye. Kezdjük.',
      'Hali! Hátvéd vagyok. A védelmemen nem jutsz át.',
      'Kezdjük, gyorsan! Edzésem van Almádiban.',
    ],
    playerMove: [
      'Ez a lépés lassabb, mint a téli MÁV-menetrend.',
      'Hátvédként mondom: ezzel nem jutsz át rajtam.',
      'Oké. Én ezt is jobban csinálnám. Szerintem mindent.',
      'Ez dartsban kb. három pont lenne. Nem 180.',
      'Barátságosan szólok: rossz.',
      'Szép próbálkozás. Mint egy röpiütés a hálóba.',
    ],
    botMove: ['Profi lépés. Mint minden, amit csinálok.', 'Ez becsületes lépés volt. Teljesen. Esküszöm.', 'Tiszta szerelés.'],
    playerCapture: [
      'Ezt nem láttam jönni. Pedig én mindent látok.',
      'A {pm}? Ez szabálytalan volt! …nem? Akkor jó.',
      'Oké, kaptam egy gólt. Hátvédként ez fáj.',
    ],
    botCapture: [
      '180! Mint dartsban. A {yn} kiesett.',
      'Szerelés! Tiszta, szabályos, labda… izé, bábu.',
      'Elvettem a {pd}. Csalás? Dehogy. Tehetség.',
    ],
    playerSpell: ['„{spell}”? Ezt még a MÁV-menetrend se ismeri.', 'Varázslat? Én is tudok. Mindent tudok.'],
    botSpell: ['„{spell}”. Nem csalás. Csak előre láttam.', 'Ezt is profin csinálom. Mint mindent.'],
    check: ['Sakk! Mint egy tökéletes röpiütés.', 'Sakk. Ez becsületes volt. Esküszöm.'],
    inCheck: ['Sakk? Szabálytalan! Bíró!', 'Oké, ezt most elengedem. Barátságos vagyok.'],
    blunder: ['Ez akkora hiba volt, mint a téli MÁV-menetrend.', 'Ezt még a kapusunk se nyelte volna be.'],
    brilliant: ['Hé, ez jó volt! Majdnem olyan jó, mint én.', 'Respect. Ez profi volt. Szinte áronos.'],
    winning: ['Mondtam: mit nem tudok?', 'Ez egy kiváló meccs volt. Nekem.'],
    losing: ['Ez csak egy kis pech. Mint amikor a vonat negyven percet késik.', 'Oké, ez az, amit nem tudok. Úgy látszik, van ilyen.'],
    promotion: ['Előre, mint egy hátvéd, aki gólt rúg!'],
    idle: ['Gyorsabban, mert lekésem a vonatot. Mondjuk az is késik.', 'Addig dobok egy dartsot. 180.'],
    chatter: [
      'Almádi FC, hátvéd. Ha valaki átjut rajtam, az bug.',
      'A téli MÁV-menetrend a világ legnagyobb rejtélye.',
      'Dartsban tegnap 180-at dobtam. Kétszer. Lehet, hogy háromszor.',
      'Motorozni is szeretek. Mondjuk mindent szeretek, amiben jó vagyok. Tehát mindent.',
      'A szüleim gazdagok, de én spórolok. Csak a győzelmet nem spórolom meg.',
      'Röpiben is jó vagyok. Mondtam már? Mondom újra.',
      'Csalok? Én? Soha! Csak szerencsés vagyok. Mindig. Folyamatosan.',
      'Kenesén mindenki ismer. Mondjuk mindenhol mindenki ismer.',
    ],
    win: ['GG! Mondtam: mit nem tudok?', 'Győzelem! Ezt is hozzáírom a listához.'],
    lose: ['Nyertél! Barátságosan mondom: legközelebb nem.', 'Na jó. Ez az egy dolog, amit nem tudok. Még.'],
    draw: ['Döntetlen. Mint egy 0–0, amiben én voltam a hátvéd.'],
  },
};
