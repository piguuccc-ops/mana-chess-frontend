// Small animated environment sprites, painted as horizontal frame strips for
// CSS `steps()` animation: torch & candle flames, a hanging war banner,
// castle pennants and birds.
import { PALETTE } from '../pixel/palette';
import { makeCanvas, once, px, toURL } from './paint';

export interface Strip {
  url: string;
  fw: number;
  fh: number;
  frames: number;
}

function strip(frames: string[][], pal: Record<string, string> = PALETTE): Strip {
  const fh = frames[0].length;
  const fw = frames[0][0].length;
  const p = makeCanvas(fw * frames.length, fh);
  frames.forEach((rows, f) => {
    rows.forEach((row, y) => {
      [...row].forEach((c, x) => {
        if (c !== '.' && c !== ' ') px(p, f * fw + x, y, pal[c] ?? '#f0f');
      });
    });
  });
  return { url: toURL(p), fw, fh, frames: frames.length };
}

const FLAME = [
  [
    '...i...',
    '...j...',
    '..jj...',
    '..jkj..',
    '.jkkj..',
    '.jkllj.',
    '.jkl9kj',
    'jkl99lj',
    'jkl99lj',
    '.jkllj.',
    '..jkkj.',
    '...jj..',
  ],
  [
    '....i..',
    '...jj..',
    '...jk..',
    '..jkkj.',
    '..jklj.',
    '.jkllj.',
    'jkl9lkj',
    'jkl99lj',
    'jkl99kj',
    '.jklkj.',
    '..jkkj.',
    '...jj..',
  ],
  [
    '.......',
    '..i....',
    '..jj...',
    '.jkj...',
    '.jkkj..',
    '.jkllj.',
    'jkl9lkj',
    'jkl99lj',
    '.kl99lj',
    '.jkllj.',
    '..jkkj.',
    '...jj..',
  ],
  [
    '...j...',
    '...jj..',
    '..jkj..',
    '..jkkj.',
    '.jkllj.',
    '.jkl9kj',
    'jkl99kj',
    'jkl99lj',
    'jkl99lj',
    '.jkllj.',
    '..jkj..',
    '...jj..',
  ],
];

const CANDLE = [
  ['.j.', '.k.', 'jlk', 'k9l', '.l.'],
  ['..j', '.k.', 'kl.', 'l9k', '.l.'],
  ['.j.', '.kj', '.lk', 'k9l', '.l.'],
];

const BIRD = [
  ['0...0', '.0.0.', '..0..'],
  ['.....', '00000', '..0..'],
];

const PENNANT = [
  ['hii....', 'hiiii..', 'hiiiiii', 'hii....'],
  ['hii....', 'hiiiii.', 'hiiii..', 'hi.....'],
  ['hi.....', 'hiiii..', 'hiiiiii', 'hiii...'],
];

/** The war banner on the menu's rampart: crimson cloth, gold trim, a knight emblem. */
function bannerStrip(): Strip {
  const W = 18;
  const H = 34;
  const frames = 4;
  const base: string[][] = Array.from({ length: H }, () => Array(W).fill('.'));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const tail = y > H - 7 && Math.abs(x - (W - 1) / 2) < (y - (H - 7)) * 1.2;
      if (tail) continue;
      let c = 'h';
      if (x < 2) c = 'i';
      if (x > W - 3) c = 'g';
      if (x === 2 || x === W - 3) c = 'o';
      if (y < 3) c = y === 0 ? 'p' : 'o';
      base[y][x] = c;
    }
  }
  // knight emblem (gold)
  const knight = ['..pp..', '.pppp.', 'ppqpp.', 'pppp..', '..ppp.', '.pppp.', 'pppppp'];
  knight.forEach((row, j) => [...row].forEach((c, i) => c !== '.' && (base[10 + j][6 + i] = c)));
  const out: string[][] = [];
  for (let f = 0; f < frames; f++) {
    const rows: string[] = [];
    for (let y = 0; y < H; y++) {
      const amp = (y / H) * 1.6;
      const off = Math.round(Math.sin(y / 5 + (f * Math.PI) / 2) * amp);
      const shade = Math.sin(y / 5 + (f * Math.PI) / 2 + 1) > 0.6;
      const row = Array(W + 2).fill('.');
      for (let x = 0; x < W; x++) {
        let c = base[y][x];
        if (c === 'h' && shade && x > 3 && x < W - 4) c = 'g';
        const nx = x + 1 + off;
        if (nx >= 0 && nx < W + 2 && c !== '.') row[nx] = c;
      }
      rows.push(row.join(''));
    }
    out.push(rows);
  }
  return strip(out);
}

export interface EnvArt {
  flame: Strip;
  candle: Strip;
  bird: Strip;
  pennant: Strip;
  banner: Strip;
}

export const envArt = once(
  (): EnvArt => ({
    flame: strip(FLAME),
    candle: strip(CANDLE),
    bird: strip(BIRD, { ...PALETTE, '0': '#2a2233' }),
    pennant: strip(PENNANT),
    banner: bannerStrip(),
  }),
);
