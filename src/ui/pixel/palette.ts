// ─────────────────────────────────────────────────────────────────────────────
// The Mana Chess master palette. Every sprite, icon, texture and particle is
// drawn from these colours so the whole game reads as one pixel-art world:
// aged wood and leather, stone and iron, parchment, brass, ember, forest,
// mana-blue and (sparingly) arcane violet.
// Sprite rows use the single-character keys below; '.' and ' ' are transparent.
// ─────────────────────────────────────────────────────────────────────────────

export const PALETTE: Record<string, string> = {
  // outline, wood, leather, parchment
  '0': '#140d0b',
  '1': '#2a1b15',
  '2': '#3d2a1f',
  '3': '#58392a',
  '4': '#77503a',
  '5': '#98693f',
  '6': '#bf915e',
  '7': '#dcbd8a',
  '8': '#efdcb2',
  '9': '#fff4d9',
  // stone, iron, steel
  a: '#211f25',
  b: '#35323b',
  c: '#524e58',
  d: '#77727d',
  e: '#a6a1aa',
  f: '#d8d4da',
  // blood, ember, fire
  g: '#4a1316',
  h: '#7d1f22',
  i: '#b3322c',
  j: '#e05a33',
  k: '#f28c38',
  l: '#fbc254',
  // brass & gold
  m: '#4d3413',
  n: '#7c5a1c',
  o: '#b78a2b',
  p: '#e6bf4c',
  q: '#fff0a0',
  // forest
  r: '#16301c',
  s: '#24512b',
  t: '#3e7f3a',
  u: '#71b24e',
  v: '#b6e07a',
  // mana blue / ice
  w: '#14213d',
  x: '#23407a',
  y: '#3569b8',
  z: '#4fa0e0',
  A: '#8fd8f5',
  B: '#dff8ff',
  // arcane violet (accent only)
  C: '#2a1540',
  D: '#4f2a78',
  E: '#7b48b0',
  F: '#b184dc',
  // teal (movement magic)
  G: '#12383a',
  H: '#20615e',
  I: '#34948a',
  J: '#7fd3c4',
  // wine / rose, pure white & black sparks
  K: '#5b2338',
  L: '#9a3b54',
  M: '#e8a0b0',
  N: '#ffffff',
  O: '#000000',
};

/** Named colours for code (CSS, canvas effects) – same values as the sprite keys. */
export const C = {
  outline: PALETTE['0'],
  wood900: PALETTE['1'],
  wood800: PALETTE['2'],
  wood700: PALETTE['3'],
  wood600: PALETTE['4'],
  wood500: PALETTE['5'],
  wood400: PALETTE['6'],
  parch: PALETTE['7'],
  parchLight: PALETTE['8'],
  ivory: PALETTE['9'],
  stone900: PALETTE.a,
  stone800: PALETTE.b,
  stone700: PALETTE.c,
  stone500: PALETTE.d,
  stone300: PALETTE.e,
  stone100: PALETTE.f,
  blood: PALETTE.g,
  red: PALETTE.h,
  redLight: PALETTE.i,
  ember: PALETTE.j,
  orange: PALETTE.k,
  flame: PALETTE.l,
  bronze: PALETTE.m,
  brass: PALETTE.n,
  gold: PALETTE.o,
  goldLight: PALETTE.p,
  goldGlint: PALETTE.q,
  forestDeep: PALETTE.r,
  forest: PALETTE.s,
  green: PALETTE.t,
  greenLight: PALETTE.u,
  greenGlow: PALETTE.v,
  manaDeep: PALETTE.w,
  manaDark: PALETTE.x,
  mana: PALETTE.y,
  manaLight: PALETTE.z,
  manaGlow: PALETTE.A,
  ice: PALETTE.B,
  arcaneDeep: PALETTE.C,
  arcaneDark: PALETTE.D,
  arcane: PALETTE.E,
  arcaneLight: PALETTE.F,
  tealDeep: PALETTE.G,
  tealDark: PALETTE.H,
  teal: PALETTE.I,
  tealLight: PALETTE.J,
  wine: PALETTE.K,
  rose: PALETTE.L,
  pink: PALETTE.M,
  white: PALETTE.N,
  black: PALETTE.O,
} as const;

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
