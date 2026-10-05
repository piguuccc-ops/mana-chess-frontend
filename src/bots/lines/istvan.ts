import type { BotPersona } from '../persona';

// István the hacker: ritkán beszél, de akkor fárasztó vicceket mond. Geek, büszke az SSD-jére
// (ami egy HDD), nem bírja a vibecodereket, szeret hackelni, a kedvenc embere az infótanár.
// Mini kecskeszakáll, és egy rikító széldzseki a derekára kötve.
export const istvan: BotPersona = {
  talk: 0.35,
  voice: { pitch: 220, wave: 'sawtooth' },
  lines: {
    intro: [
      '…',
      'Csatlakozva. Ping: 3 ms.',
      'Szia. Mondok egy viccet: miért nem jár a hacker strandra? Mert fél a … malware-től. Mal-ware. …mindegy.',
    ],
    playerMove: [
      '…',
      'Hm.',
      'Elemzés folyamatban. Az SSD-m pörög. …mármint nem pörög. SSD.',
      'Ez a lépés nincs titkosítva. Látom, mire készülsz.',
      'Input fogadva.',
    ],
    botMove: ['Patch telepítve.', 'Exploit: elindítva.', '…'],
    playerCapture: ['…ezt beírom a logba.', 'Hiba 404: {pn} nem található.'],
    botCapture: ['rm -rf {p}', 'A {yn} törölve. Nincs lomtár.', 'Hozzáférés megtagadva. A {pd} elvettem.'],
    playerSpell: ['„{spell}”. Ez exploit. Patchelni kell.', 'Ez nem varázslat. Csak kód, amit nem értesz.'],
    botSpell: ['sudo „{spell}”', 'Exploit futtatva.'],
    check: ['Sakk. Root jog megszerezve.', 'Sakk. Ctrl+Alt+Del.'],
    inCheck: ['Tűzfal-riasztás.', 'Hm. Ez váratlan input volt.'],
    blunder: ['Buffer overflow a gondolkodásodban.', 'Ez a lépés vibecodolt volt? Annak tűnik.'],
    brilliant: ['…tisztességes.', 'Ez jó kód volt. Nem vibe code.'],
    winning: ['Rendszer feltörve: 87%.', 'A tábla az enyém. Admin joggal.'],
    losing: ['Valaki DDoS-ol.', 'Az SSD-m lassú ma. …ami HDD. Ne mondd senkinek.'],
    promotion: ['Jogosultság emelve.'],
    idle: ['Timeout közeledik.', 'Ping?'],
    chatter: [
      'Mondok egy viccet. Hány programozó kell egy villanykörte cseréjéhez? Egy se. Az hardveres probléma. …na.',
      'Tudod, miért fázik a számítógép? Mert nyitva hagyta a Windowst.',
      'Az SSD-m 7000 MB/s. Szerintem. A gép szerint HDD. A gép téved.',
      'A vibecoderek azt hiszik, a kód magától megíródik. Igazuk van. Sajnos.',
      'Az infótanár a kedvenc emberem. Ő érti a rendszert.',
      'Mi a hacker kedvenc étele? A cookie. …süti. Cookie.',
      'Miért nem bízik a hacker a lépcsőben? Mert mindig fel akarja törni. …a lépcsőt. Fel. Törni.',
      'Mit mond a hacker, amikor bemegy a boltba? Hozzáférést kérek. …a pékáruhoz.',
      'A kabát a derekamon? Az nem divat. Az backup.',
      'A szakállam mini. A jelszavam 64 karakter. Prioritások.',
    ],
    win: ['GG. Rendszer leállítva.', 'Logout. Te.'],
    lose: ['GG. Ezt a logot törlöm.', 'Kernel panic.'],
    draw: ['Döntetlen. Végtelen ciklus.'],
  },
};
