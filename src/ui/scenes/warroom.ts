// ─────────────────────────────────────────────────────────────────────────────
// The war room behind the game board: torch-lit stone wall, the two armies'
// banners and a heavy oak table with maps, books, candles and mana crystals.
// 480×270 native pixels; flames and dust are animated DOM sprites on top.
// ─────────────────────────────────────────────────────────────────────────────
import { bayer, glow, hexMix, makeCanvas, once, px, rect, rng, toURL, type Paint } from './paint';

export const WW = 480;
export const WH = 270;

export interface WarRoomArt {
  wall: string;
  table: string;
  torches: { x: number; y: number }[];
  candles: { x: number; y: number }[];
  crystals: { x: number; y: number }[];
}

const TABLE_TOP = 196;

function paintWall(p: Paint, torches: { x: number; y: number }[]) {
  const r = rng(12);
  const tones = ['#2b2830', '#302d36', '#35323b', '#3a3640', '#403c46'];
  // stone blocks
  for (let row = 0; row * 11 < TABLE_TOP + 10; row++) {
    const y0 = row * 11;
    const off = row % 2 ? 9 : 0;
    for (let b = -1; b * 18 < WW + 18; b++) {
      const x0 = b * 18 + off;
      const tone = tones[Math.floor(r() * tones.length)];
      for (let y = y0; y < y0 + 11; y++) {
        for (let x = x0; x < x0 + 18; x++) {
          if (x < 0 || x >= WW) continue;
          let c = tone;
          if (y === y0 || x === x0) c = '#1b191e';
          else if (y === y0 + 1) c = hexMix(tone, '#6a6270', 0.35);
          else if (x === x0 + 17 || y === y0 + 10) c = hexMix(tone, '#141216', 0.4);
          else if (r() < 0.07) c = hexMix(tone, '#141216', 0.25);
          px(p, x, y, c);
        }
      }
      if (r() < 0.12) {
        let cx = x0 + 5 + Math.floor(r() * 8);
        for (let y = y0 + 2; y < y0 + 9; y++) {
          if (cx >= 0 && cx < WW) px(p, cx, y, '#19171c');
          cx += r() < 0.4 ? 1 : 0;
        }
      }
    }
  }
  // warm torch light pools on the wall
  for (const t of torches) glow(p, t.x, t.y, 110, '#e0873f', 0.46, { levels: 4, squashY: 1.15, y1: TABLE_TOP });
  // darken towards the ceiling (quantised, not noisy)
  const img = p.ctx.getImageData(0, 0, WW, 70);
  for (let y = 0; y < 70; y++) {
    const k = Math.round(((70 - y) / 70) * 4) / 4;
    for (let x = 0; x < WW; x++) {
      const i = (y * WW + x) * 4;
      const kk = Math.min(0.8, k * 0.8 + (bayer(x, y) - 0.5) * 0.1);
      img.data[i] = Math.round(img.data[i] * (1 - kk) + 20 * kk);
      img.data[i + 1] = Math.round(img.data[i + 1] * (1 - kk) + 18 * kk);
      img.data[i + 2] = Math.round(img.data[i + 2] * (1 - kk) + 22 * kk);
    }
  }
  p.ctx.putImageData(img, 0, 0);
  // ceiling beam
  rect(p, 0, 0, WW, 12, '#1d140f');
  rect(p, 0, 12, WW, 2, '#0e0907');
  for (let x = 0; x < WW; x += 1) {
    if ((x * 7) % 23 < 3) px(p, x, 5, '#2a1d15');
    if ((x * 5) % 31 < 2) px(p, x, 9, '#2a1d15');
  }
  for (const bx of [40, 150, 330, 440]) {
    rect(p, bx, 10, 6, 8, '#3b3940');
    px(p, bx + 1, 11, '#77727d');
    px(p, bx + 4, 15, '#77727d');
  }
}

function banner(p: Paint, x: number, y: number, w: number, h: number, cloth: [string, string, string], trim: [string, string], emblem: 'sun' | 'moon') {
  // rod
  rect(p, x - 3, y - 2, w + 6, 2, '#4d3413');
  rect(p, x - 3, y - 2, w + 6, 1, '#b78a2b');
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      // swallow-tail bottom
      const tail = j > h - 8 && Math.abs(i - w / 2) < (j - (h - 8)) * 0.9;
      if (tail) continue;
      let c = cloth[1];
      if (i < 2) c = cloth[2];
      if (i > w - 3) c = cloth[0];
      if ((i + j * 3) % 11 === 0 && i > 2 && i < w - 3) c = hexMix(cloth[1], cloth[0], 0.3);
      if (i === 3 || i === w - 4) c = trim[1];
      px(p, x + i, y + j, c);
    }
  }
  // trim band at the top
  rect(p, x, y, w, 3, trim[0]);
  rect(p, x, y + 3, w, 1, trim[1]);
  // emblem
  const cx = x + Math.floor(w / 2);
  const cy = y + Math.floor(h * 0.38);
  for (let j = -6; j <= 6; j++) {
    for (let i = -6; i <= 6; i++) {
      const d = Math.hypot(i, j);
      if (emblem === 'sun') {
        if (d <= 3.5) px(p, cx + i, cy + j, trim[0]);
        else if (d <= 6 && (Math.abs(i) < 1 || Math.abs(j) < 1 || Math.abs(Math.abs(i) - Math.abs(j)) < 1)) px(p, cx + i, cy + j, trim[1]);
      } else if (d <= 5 && Math.hypot(i - 2.5, j - 1) > 4) px(p, cx + i, cy + j, trim[0]);
    }
  }
}

function paintTable(p: Paint, candles: { x: number; y: number }[], crystals: { x: number; y: number }[]) {
  const r = rng(8);
  // back edge shadow on the wall
  rect(p, 0, TABLE_TOP - 3, WW, 3, '#0f0c0e');
  // table top: long oak planks seen almost edge-on
  const ramp = ['#3d2718', '#4a3020', '#553826', '#61402b', '#6c4830'];
  for (let y = TABLE_TOP; y < WH; y++) {
    const band = Math.floor((y - TABLE_TOP) / 12);
    for (let x = 0; x < WW; x++) {
      const g = Math.sin(x / (9 + band) + band * 2.1 + (y - TABLE_TOP) * 0.35) + Math.sin(x / 3.1 + y) * 0.35;
      let i = 2 + (g > 0.9 ? 1 : g < -0.9 ? -1 : 0);
      const depth = (y - TABLE_TOP) / (WH - TABLE_TOP);
      i += depth > 0.6 ? 1 : 0;
      if (r() < 0.03) i += r() < 0.5 ? 1 : -1;
      let c = ramp[Math.max(0, Math.min(4, i))];
      if ((y - TABLE_TOP) % 12 === 0) c = '#2c1c12';
      px(p, x, y, c);
    }
  }
  rect(p, 0, TABLE_TOP, WW, 1, '#7a5238');
  // warm light on the table from the candles
  for (const cx of [70, 410]) glow(p, cx, 238, 95, '#e3a15a', 0.24, { levels: 3, squashY: 1.6, y0: TABLE_TOP });
  // rolled map (left)
  const mx = 18;
  const my = 222;
  rect(p, mx, my, 56, 14, '#d9bd8a');
  for (let i = 0; i < 56; i++) {
    px(p, mx + i, my, '#efdcb2');
    px(p, mx + i, my + 13, '#a8844f');
    if (i % 7 === 3) for (let j = 3; j < 11; j++) if (bayer(i, j) < 0.3) px(p, mx + i, my + j, '#8c6a44');
  }
  rect(p, mx - 4, my - 2, 5, 18, '#bf915e');
  rect(p, mx - 4, my - 2, 2, 18, '#efdcb2');
  rect(p, mx + 55, my - 2, 5, 18, '#98693f');
  rect(p, mx + 58, my - 2, 2, 18, '#58392a');
  // red route on the map
  for (let i = 6; i < 48; i++) px(p, mx + i, my + 6 + Math.round(Math.sin(i / 5) * 2), i % 2 ? '#b3322c' : '#d9bd8a');
  // goblet (left)
  const gx = 92;
  rect(p, gx, 232, 8, 2, '#7c5a1c');
  rect(p, gx + 3, 222, 2, 10, '#b78a2b');
  rect(p, gx - 1, 212, 10, 10, '#b78a2b');
  rect(p, gx - 1, 212, 10, 2, '#e6bf4c');
  rect(p, gx - 1, 212, 2, 10, '#e6bf4c');
  rect(p, gx + 7, 214, 2, 8, '#7c5a1c');
  rect(p, gx, 212, 8, 1, '#7d1f22');
  // stack of books (right)
  const bx = 400;
  const books: [number, number, string, string][] = [
    [bx, 236, '#5b2338', '#9a3b54'],
    [bx + 3, 228, '#24512b', '#3e7f3a'],
    [bx - 2, 220, '#23407a', '#3569b8'],
  ];
  for (const [x, y, dark, lit] of books) {
    rect(p, x, y, 44, 8, dark);
    rect(p, x, y, 44, 2, lit);
    rect(p, x + 40, y, 4, 8, '#efdcb2');
    rect(p, x + 40, y, 4, 1, '#fff4d9');
    rect(p, x + 4, y + 3, 2, 3, '#e6bf4c');
    rect(p, x + 30, y + 3, 2, 3, '#e6bf4c');
  }
  // mana crystal cluster (right, glowing)
  const kx = 452;
  const ky = 222;
  const shard = (x: number, y: number, h: number) => {
    for (let j = 0; j < h; j++) {
      const hw = j < 2 ? 0 : 1;
      for (let i = -hw; i <= hw; i++) px(p, x + i, y + j, i < 0 ? '#8fd8f5' : i > 0 ? '#23407a' : '#4fa0e0');
    }
  };
  shard(kx, ky, 12);
  shard(kx - 4, ky + 4, 8);
  shard(kx + 4, ky + 5, 7);
  rect(p, kx - 7, ky + 12, 14, 2, '#524e58');
  crystals.push({ x: kx, y: ky + 4 });
  // candles
  for (const [x, h] of [
    [120, 18],
    [128, 12],
    [352, 16],
  ] as const) {
    rect(p, x - 3, 244, 8, 2, '#7c5a1c');
    rect(p, x - 1, 244 - h, 4, h, '#e8d8b8');
    rect(p, x - 1, 244 - h, 1, h, '#fff4d9');
    rect(p, x + 2, 244 - h, 1, h, '#bfa98a');
    px(p, x + 1, 245 - h - 1, '#2a1b15');
    candles.push({ x: x + 1, y: 244 - h - 1 });
  }
  // front edge of the table
  rect(p, 0, WH - 6, WW, 6, '#24170f');
  rect(p, 0, WH - 6, WW, 1, '#6c4830');
}

export const warRoomArt = once((): WarRoomArt => {
  const art: WarRoomArt = { wall: '', table: '', torches: [{ x: 34, y: 92 }, { x: 446, y: 92 }], candles: [], crystals: [] };
  const wall = makeCanvas(WW, WH);
  paintWall(wall, art.torches);
  banner(wall, 150, 22, 30, 96, ['#b99a62', '#e3cfa2', '#f3e6c6'], ['#b78a2b', '#7c5a1c'], 'sun');
  banner(wall, 300, 22, 30, 96, ['#140f16', '#241c28', '#352a3a'], ['#b3322c', '#7d1f22'], 'moon');
  // torch sconces
  for (const t of art.torches) {
    rect(wall, t.x - 3, t.y + 2, 7, 3, '#524e58');
    rect(wall, t.x - 1, t.y + 5, 3, 12, '#3a2618');
    rect(wall, t.x - 1, t.y + 5, 1, 12, '#6b4632');
    rect(wall, t.x - 2, t.y + 17, 5, 2, '#35323b');
  }
  art.wall = toURL(wall);
  const table = makeCanvas(WW, WH);
  paintTable(table, art.candles, art.crystals);
  art.table = toURL(table);
  return art;
});
