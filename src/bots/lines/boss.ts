import type { BotPersona } from '../persona';

// Boss the boss: csöndes gyerek, bármikor lecsaphat. Nem beszél sokat, de ha igen, minden tanárt
// felidegesít – főleg Erikát. Nonchalant, szinte direkt elront minden sportot, nagyon lassan eszik.
export const boss: BotPersona = {
  talk: 0.4,
  voice: { pitch: 160, wave: 'triangle' },
  lines: {
    intro: ['…', 'Hm. Kezdjük.', 'Ja.'],
    playerMove: ['…', 'Hm.', 'Oké.', 'Mindegy.', '(lassan eszik)'],
    botMove: ['…', 'Na.', '(még mindig ugyanazt a szendvicset eszi)'],
    playerCapture: ['…ok.', 'Nem számít.', '(rágás)'],
    botCapture: ['Az enyém.', '…', 'Na.'],
    playerSpell: ['Felesleges.', '…ezt Erika néni se értené.'],
    botSpell: ['„{spell}”.', 'Ennyi.'],
    check: ['Sakk.', '…sakk.'],
    inCheck: ['Hm.', 'Ez nem zavar.'],
    blunder: ['…', 'Köszi.'],
    brilliant: ['Nem rossz.'],
    winning: ['Mindjárt vége.', '(még mindig ugyanazt a szendvicset eszi)'],
    losing: ['Nem érdekel.', 'Ez is olyan, mint a tesióra. Direkt.'],
    promotion: ['Hm. Vezér.'],
    idle: ['Én ráérek. Én mindenre ráérek.', '(eszik)'],
    chatter: [
      '…',
      'Erika néni ma megint ideges volt. Rám.',
      'Tesin ma megint elrontottam mindent. Direkt.',
      'Ez a szendvics még a reggeli.',
      'Nem beszélek sokat. Ez is sok volt.',
      'Megmondtam Erika néninek, hogy a házi az nem az én stílusom.',
    ],
    win: ['GG.', 'Ennyi volt.'],
    lose: ['Mindegy.', 'Ok. Megyek enni. Lassan.'],
    draw: ['Döntetlen. Jó.'],
  },
};
