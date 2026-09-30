// The "Mana Chess" wordmark: the hand-drawn Mana Gothic glyphs rendered as
// pixel art with a stepped gold ramp, dark outline, drop shadow and a crown
// set with a mana crystal.
import fontData from '../pixel/fontData.json';
import { makeCanvas, once, px, toURL } from './paint';

type Glyph = { top: number; rows: string[] };
const GOTHIC = (fontData as { gothic: Record<string, Glyph> }).gothic;
const SPACE = (fontData as { space: { gothic: number } }).space.gothic;

// gold ramp by row inside the cap height (row 9 = top … 0 = baseline)
const RAMP: Record<number, string> = {
  9: '#fff0a0',
  8: '#fbe08a',
  7: '#f0cc62',
  6: '#e6bf4c',
  5: '#d8ad3f',
  4: '#c89b33',
  3: '#b78a2b',
  2: '#a17624',
  1: '#8c651e',
  0: '#7c5a1c',
};

function glyphPixels(text: string): { w: number; pts: [number, number][] } {
  const pts: [number, number][] = [];
  let x = 0;
  for (const ch of text) {
    if (ch === ' ') {
      x += SPACE + 1;
      continue;
    }
    const g = GOTHIC[ch];
    if (!g) continue;
    g.rows.forEach((row, i) => {
      [...row].forEach((c, j) => {
        if (c === '#') pts.push([x + j, g.top - i]);
      });
    });
    x += Math.max(...g.rows.map((r) => r.length)) + 1;
  }
  return { w: x - 1, pts };
}

export interface LogoArt {
  url: string;
  w: number;
  h: number;
  /** Crystal centre (native pixels) – sparkles are placed around it. */
  crystal: { x: number; y: number };
}

export const logoArt = once((): LogoArt => {
  const { w: tw, pts } = glyphPixels('Mana Chess');
  const pad = 3;
  const crownH = 10;
  const W = tw + pad * 2;
  const H = crownH + 13 + pad * 2 + 3;
  const baseY = crownH + pad + 11; // baseline (canvas y of row 0 is baseY)
  const p = makeCanvas(W, H);
  const filled = new Set(pts.map(([x, y]) => `${x + pad},${baseY - y}`));
  const has = (x: number, y: number) => filled.has(`${x},${y}`);
  // drop shadow (2 px down) and outline (8-neighbourhood)
  for (const [gx, gy] of pts) {
    const x = gx + pad;
    const y = baseY - gy;
    for (let dy = -1; dy <= 3; dy++) for (let dx = -1; dx <= 1; dx++) px(p, x + dx, y + dy, dy >= 2 ? '#0b0605' : '#140d0b');
  }
  for (const [gx, gy] of pts) {
    const x = gx + pad;
    const y = baseY - gy;
    let c = RAMP[Math.max(0, Math.min(9, gy))] ?? '#7c5a1c';
    if (gy < 0) c = '#6a4c17';
    // bevel: pixels with open space above-left catch the light
    if (!has(x - 1, y) && !has(x, y - 1)) c = '#fff6c8';
    else if (!has(x + 1, y) && gy <= 4) c = '#6a4c17';
    px(p, x, y, c);
  }
  // crown centred above the gap between the words
  const cx = pad + Math.round(tw / 2);
  const top = pad - 1;
  const crown = [
    '..x...x...x..',
    '..x...x...x..',
    '.xgx.xgx.xgx.',
    '.xgx.xgx.xgx.',
    '.xggxgggxggx.',
    '.xgggggggggx.',
    '.xgGgggmgGgx.',
    '.xgggggggggx.',
    '.xddddddddddx',
    '..xxxxxxxxxx.',
  ];
  const cw = crown[0].length;
  crown.forEach((row, j) => {
    [...row].forEach((c, i) => {
      const x = cx - Math.floor(cw / 2) + i;
      const y = top + j;
      if (c === 'x') px(p, x, y, '#140d0b');
      else if (c === 'g') px(p, x, y, j < 4 ? '#fff0a0' : i < cw / 2 ? '#e6bf4c' : '#b78a2b');
      else if (c === 'd') px(p, x, y, '#7c5a1c');
      else if (c === 'G') px(p, x, y, '#b3322c');
      else if (c === 'm') {
        px(p, x, y, '#8fd8f5');
      }
    });
  });
  return { url: toURL(p), w: W, h: H, crystal: { x: cx, y: top + 6 } };
});
