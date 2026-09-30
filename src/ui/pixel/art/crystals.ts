// Mana crystals for the mana bar (10×14 art + outline = 12×16).
// Semantic keys: B/A light facets, z/y/x body (light → dark), s socket tones.
import type { Color } from '../../../engine';
import type { SpriteSrc } from '../sprite';

export const CRYSTAL: SpriteSrc = {
  outline: '0',
  rows: [
    '....BB....',
    '...BAAz...',
    '..BAzzzy..',
    '.BAzzzzyx.',
    'BAzzzzzyyx',
    'BAzzzzyyyx',
    'BAzBzzyyyx',
    'BAzzzzyyyx',
    'BAzzzzyyyx',
    'BAzzzyyyxx',
    '.Azzzyyyx.',
    '..zzyyyx..',
    '...zyyx...',
    '....yx....',
  ],
};

/** An empty crystal socket (same silhouette, cold iron). */
export const SOCKET: SpriteSrc = {
  outline: '0',
  rows: [
    '....dd....',
    '...dccb...',
    '..dcbbba..',
    '.dcbbbbaa.',
    'dcbbbbbaaa',
    'dcbbbbaaaa',
    'dcbbbbaaaa',
    'dcbbbbaaaa',
    'dcbbbbaaaa',
    'dcbbbaaaaa',
    '.cbbbaaaa.',
    '..bbaaaa..',
    '...baaa...',
    '....aa....',
  ],
};

/** A socket above the current maximum (Arcane Surge): barred with iron. */
export const SOCKET_LOCKED: SpriteSrc = {
  outline: '0',
  rows: [
    '....dd....',
    '...dccb...',
    '..dcbbba..',
    '.dcbbbbaa.',
    'eeeeeeeeee',
    'dddddddddd',
    'dcbbbbaaaa',
    'dcbbbbaaaa',
    'eeeeeeeeee',
    'dddddddddd',
    '.cbbbaaaa.',
    '..bbaaaa..',
    '...baaa...',
    '....aa....',
  ],
};

/** Mana colour per side: Világos = azure, Sötét = crimson. */
export const CRYSTAL_PAL: Record<Color, Readonly<Record<string, string>>> = {
  w: { B: '#e9fbff', A: '#9fe0f8', z: '#4fa0e0', y: '#3569b8', x: '#23407a' },
  b: { B: '#ffd9d2', A: '#f08a7a', z: '#d0453a', y: '#9b2a2a', x: '#5c1719' },
};
