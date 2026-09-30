// Tiny 7×7 status glyphs shown on pieces (+ automatic outline → 9×9).
// They answer "what is on this piece?" at a glance; the parchment tooltip and the
// "Aktív hatások" panel carry the full text.
import type { EffectKind } from '../../../engine';
import type { SpriteSrc } from '../sprite';

const g = (rows: string[]): SpriteSrc => ({ rows, outline: '0' });

export const BADGE_GLYPHS: Partial<Record<EffectKind, SpriteSrc>> = {
  // steel heater shield with a bronze rim
  immune: g([
    'ooooooo',
    'offfeeo',
    'ofeeedo',
    'ofeeedo',
    '.oeedo.',
    '..odo..',
    '...o...',
  ]),
  // little stone keep
  fortified: g([
    'e.e.e.e',
    'eeeeeee',
    'effeedc',
    'efe0edc',
    'eee0ddc',
    'dddddcc',
  ]),
  // bone skull
  deathMark: g([
    '.99999.',
    '9999997',
    '9009007',
    '9999977',
    '.99099.',
    '.9.9.7.',
  ]),
  // brass padlock – cannot move at all
  weakened: g([
    '..ddd..',
    '.d...d.',
    '.d...d.',
    'ppppppp',
    'poo0oon',
    'poo0oon',
    'nnnnnnn',
  ]),
  // creeping roots – may only capture
  rooted: g([
    't..u..t',
    '.t.u.t.',
    '..tut..',
    '...t...',
    '.s.t.s.',
    's.sts.s',
    '...s...',
  ]),
  // snow crystal
  frozen: g([
    '...B...',
    '.B.B.B.',
    '..BAB..',
    'BBAAABB',
    '..BAB..',
    '.B.B.B.',
    '...B...',
  ]),
  // eye struck through – may not capture
  blinded: g([
    '......i',
    '..eeei.',
    '.e99i9e',
    'e90i09e',
    '.ei99e.',
    '.iee...',
    'i......',
  ]),
  // cracked goblet – „Üvegátok”: breaks if it captures
  glassCursed: g([
    'B9BBBAz',
    'BA0AAzx',
    '.BA0Az.',
    '..B0z..',
    '...A...',
    '...z...',
    '.BAAzx.',
  ]),
  // broken blade – no captures, no attacks
  disarmed: g([
    '......f',
    '.....fe',
    '....fe.',
    '.......',
    '..fe...',
    '.nn....',
    'n.n....',
  ]),
  // pale ghost – spells cannot target it
  spellWard: g([
    '.99999.',
    '9999998',
    '9009008',
    '9999988',
    '9999988',
    '9.9.8.8',
  ]),
  // mana crystal
  manaMage: g([
    '...B...',
    '..BAz..',
    '.BAzzy.',
    '.Azzyy.',
    '..zyx..',
    '...x...',
  ]),
  // war horn blast – must move this piece
  provoked: g([
    '..iii..',
    '..iji..',
    '..iji..',
    '..iii..',
    '...i...',
    '.......',
    '..iii..',
  ]),
  // crosshair
  sniper: g([
    '..ooo..',
    '.o.o.o.',
    'o..o..o',
    'ooo.ooo',
    'o..o..o',
    '.o.o.o.',
    '..ooo..',
  ]),
  // double chevron – rush
  pawnRush: g([
    '...J...',
    '..JIJ..',
    '.JI.IJ.',
    '...J...',
    '..JIJ..',
    '.JI.IJ.',
  ]),
  // leap over a bar
  pawnVault: g([
    '...J...',
    '..JJJ..',
    '.J.J.J.',
    '...J...',
    'IIIIIII',
  ]),
  // side steps
  scout: g([
    '.J...J.',
    'JI...IJ',
    'IIIIIII',
    'JI...IJ',
    '.J...J.',
  ]),
  // golden star
  bishopBlessing: g([
    '...q...',
    '..ppp..',
    'qppppoq',
    '.ppppo.',
    '.pp.oo.',
    '.p...o.',
  ]),
  // small crown
  queenGrace: g([
    'p..p..p',
    'pp.p.pp',
    'ppppppo',
    'pipBpio',
    'ooooooo',
  ]),
  // cheese wedge
  frenchCheese: g([
    '......p',
    '....ppp',
    '..ppppo',
    'pp.ppoo',
    'pppp.po',
    'ooooooo',
  ]),
  // return arrow
  outOfWay: g([
    '..JJJ..',
    '.J...J.',
    '.....J.',
    '.J...J.',
    'JJJ.J..',
    '.J.....',
  ]),
};
