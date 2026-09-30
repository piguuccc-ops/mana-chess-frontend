// ─────────────────────────────────────────────────────────────────────────────
// Main-menu landscape: a castle in the mountains at golden hour, painted
// procedurally in layers (for parallax) at 480×270 native pixels.
// Animated details (clouds, flags, banner, torch, birds) are separate DOM sprites
// positioned with the anchor points returned here.
// ─────────────────────────────────────────────────────────────────────────────
import { bayer, dither, ditherGradient, hexMix, makeCanvas, once, px, rect, ridge, rng, toURL, type Paint, type Rng } from './paint';

export const LW = 480;
export const LH = 270;

export interface LandscapeArt {
  sky: string;
  clouds: string;
  cloudsW: number;
  cloudsH: number;
  far: string;
  mid: string;
  near: string;
  fg: string;
  /** Castle flag poles (scene pixels, the flag hangs to the right of x). */
  flags: { x: number; y: number }[];
  /** Torch flame anchors (bottom centre of the flame). */
  torches: { x: number; y: number }[];
  /** Banner hanging point (top-left of the cloth). */
  banner: { x: number; y: number };
  /** Lit castle windows (tiny flicker sprites). */
  windows: { x: number; y: number }[];
}

const SUN = { x: 150, y: 150 };

// ── Sky ─────────────────────────────────────────────────────────────────────

const SKY_STOPS: [number, string][] = [
    [0, '#232b42'],
    [0.1, '#29324c'],
    [0.2, '#313957'],
    [0.3, '#3d4262'],
    [0.38, '#4c4c6b'],
    [0.45, '#5f5873'],
    [0.51, '#76647a'],
    [0.56, '#8f707e'],
    [0.61, '#a87d80'],
    [0.66, '#c08b7e'],
    [0.71, '#d49a7a'],
    [0.77, '#e3ab78'],
    [0.85, '#eebc7d'],
    [1, '#f4cb87'],
];

function skyAt(y: number): string {
  const t = y / (LH - 1);
  let i = 0;
  while (i < SKY_STOPS.length - 2 && t > SKY_STOPS[i + 1][0]) i++;
  const [ta, ca] = SKY_STOPS[i];
  const [tb, cb] = SKY_STOPS[i + 1];
  return hexMix(ca, cb, Math.min(1, Math.max(0, (t - ta) / (tb - ta))));
}

function paintSky(p: Paint) {
  ditherGradient(p, 0, LH, SKY_STOPS);
  // sun glow: blend the sky towards warm light, quantised into dithered levels
  for (let y = 40; y < 240; y++) {
    for (let x = 20; x < 290; x++) {
      const d = Math.hypot(x - SUN.x, (y - SUN.y) * 1.2);
      const g = Math.max(0, 1 - d / 95);
      if (g <= 0) continue;
      const lv = Math.pow(g, 1.7) * 6;
      const level = Math.floor(lv) + (lv - Math.floor(lv) > bayer(x, y) ? 1 : 0);
      if (level <= 0) continue;
      const base = skyAt(y);
      px(p, x, y, hexMix(base, '#fff0c8', Math.min(1, level / 6)));
    }
  }
  for (let y = -12; y <= 12; y++) {
    for (let x = -12; x <= 12; x++) {
      const d = Math.hypot(x, y);
      if (d <= 8.5) px(p, SUN.x + x, SUN.y + y, d < 7 ? '#fff9e8' : '#fff2cf');
    }
  }
  // a few long, thin high clouds catching the light
  const r = rng(41);
  for (let k = 0; k < 9; k++) {
    const y = 26 + Math.floor(r() * 90);
    const x0 = Math.floor(r() * LW);
    const len = 24 + Math.floor(r() * 80);
    const c = y < 70 ? '#4a4a69' : y < 100 ? '#7a6679' : '#b88a86';
    for (let i = 0; i < len; i++) {
      if (r() < 0.85) px(p, (x0 + i) % LW, y, c);
      if (i > 4 && i < len - 6 && r() < 0.35) px(p, (x0 + i) % LW, y + 1, c);
    }
  }
}

// ── Clouds (horizontally tileable strip) ───────────────────────────────────

function paintClouds(p: Paint) {
  const r = rng(7);
  const W = p.w;
  const blobs: { x: number; y: number; rx: number; ry: number }[] = [];
  const clouds = 8;
  for (let c = 0; c < clouds; c++) {
    const cx = (c / clouds) * W + r() * 50;
    const cy = 26 + r() * 60;
    const n = 3 + Math.floor(r() * 5);
    const size = 7 + r() * 11;
    for (let i = 0; i < n; i++) {
      const k = n === 1 ? 0.5 : i / (n - 1);
      blobs.push({
        x: cx + (i - n / 2) * size * 0.8 + r() * 6,
        y: cy - Math.sin(k * Math.PI) * size * 0.7 + r() * 3,
        rx: size * (0.75 + r() * 0.5),
        ry: size * (0.5 + r() * 0.3),
      });
    }
    // flat base
    blobs.push({ x: cx, y: cy + size * 0.1, rx: size * n * 0.45, ry: size * 0.32 });
  }
  const mask = new Uint8Array(W * p.h);
  for (const b of blobs) {
    for (let y = Math.floor(b.y - b.ry); y <= b.y + b.ry; y++) {
      if (y < 0 || y >= p.h) continue;
      for (let x = Math.floor(b.x - b.rx); x <= b.x + b.rx; x++) {
        const dx = (x - b.x) / b.rx;
        const dy = (y - b.y) / b.ry;
        if (dx * dx + dy * dy <= 1) mask[y * W + (((x % W) + W) % W)] = 1;
      }
    }
  }
  const m = (x: number, y: number) => y >= 0 && y < p.h && mask[y * W + (((x % W) + W) % W)] === 1;
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < W; x++) {
      if (!m(x, y)) continue;
      let up = 0;
      while (up < 7 && m(x, y - up - 1)) up++;
      let down = 0;
      while (down < 7 && m(x, y + down + 1)) down++;
      const leftEdge = !m(x - 1, y) || !m(x - 2, y - 1);
      let c = '#b8888c';
      if (up === 0) c = leftEdge ? '#ffe3b8' : '#f7cfa5';
      else if (up === 1) c = '#e8b59a';
      else if (up < 4) c = dither(x, y, 0.5, '#cf9d93', '#e0ac97');
      else if (down === 0) c = '#8a6c83';
      else if (down < 3) c = dither(x, y, 0.5, '#8a6c83', '#a07a88');
      if (leftEdge && up < 4 && c !== '#ffe3b8') c = '#f2c6a0';
      px(p, x, y, c);
    }
  }
}

// ── Mountains ──────────────────────────────────────────────────────────────

interface PeakColours {
  lit: string;
  shade: string;
  dark: string;
  snowLit: string;
  snowShade: string;
  haze: string;
}

function peaks(p: Paint, r: Rng, baseY: number, list: { x: number; h: number; w: number }[], col: PeakColours, snow = 0.32) {
  for (const pk of list.sort((a, b) => b.h - a.h)) {
    const jag = ridge(Math.floor(r() * 1e6), 5, 3);
    const snowJag = ridge(Math.floor(r() * 1e6), 3, 2);
    for (let x = Math.floor(pk.x - pk.w); x <= pk.x + pk.w; x++) {
      if (x < 0 || x >= p.w) continue;
      const k = 1 - Math.abs(x - pk.x) / pk.w;
      const top = Math.round(baseY - pk.h * k - (jag(x) - 0.5) * 6 * k);
      for (let y = top; y < baseY; y++) {
        const fromTop = (y - top) / Math.max(1, baseY - top);
        const left = x < pk.x + (jag(y * 0.7) - 0.5) * 4;
        let c = left ? col.lit : col.shade;
        if (!left && x > pk.x + pk.w * 0.35 && bayer(x, y) < 0.5) c = col.dark;
        const snowLine = top + (baseY - top) * snow * k + (snowJag(x) - 0.5) * 8;
        if (y < snowLine && k > 0.35) c = left ? col.snowLit : col.snowShade;
        if (fromTop > 0.7 && bayer(x, y) < (fromTop - 0.7) * 2.5) c = col.haze;
        px(p, x, y, c);
      }
    }
  }
}

function paintFar(p: Paint) {
  const r = rng(99);
  peaks(
    p,
    r,
    196,
    [
      { x: 30, h: 70, w: 70 },
      { x: 110, h: 52, w: 60 },
      { x: 200, h: 88, w: 80 },
      { x: 280, h: 66, w: 65 },
      { x: 360, h: 96, w: 85 },
      { x: 440, h: 72, w: 70 },
      { x: 500, h: 60, w: 60 },
    ],
    { lit: '#9a8fa6', shade: '#6e6d8a', dark: '#5f607c', snowLit: '#f3e2cf', snowShade: '#b9b3c6', haze: '#c7a08f' },
  );
}

// ── Mid hills + castle ─────────────────────────────────────────────────────

const hillLine = ridge(1234, 60, 3);
/** The rolling hill as the noise draws it, with a knoll around x 318. */
const naturalHill = (x: number) => Math.round(190 + (hillLine(x) - 0.5) * 34 - Math.exp(-((x - 318) ** 2) / 1800) * 26);

/** The castle's foot, and its footprint (every wall and tower, with a pixel to spare). */
const CASTLE_BASE = naturalHill(318) + 6;
const CASTLE_X0 = 267;
const CASTLE_X1 = 370;
/** How far the ground eases back to the natural hill on either side of the castle. */
const SHOULDER = 46;

/**
 * The hill's top edge. The noise alone rounds the knoll off under the side towers, which left the
 * castle floating above the slopes; so under the castle the ground is raised (never lowered) to
 * one pixel above its foot, and beyond the walls it eases back down to the natural hill line.
 */
const hillY = (x: number) => {
  const natural = naturalHill(x);
  const out = x < CASTLE_X0 ? CASTLE_X0 - x : x > CASTLE_X1 ? x - CASTLE_X1 : 0;
  if (out >= SHOULDER) return natural;
  const t = (1 - Math.cos((out / SHOULDER) * Math.PI)) / 2;
  const knoll = CASTLE_BASE - 1 + t * (natural - (CASTLE_BASE - 1));
  return Math.min(natural, Math.round(knoll));
};

function paintMid(p: Paint, art: LandscapeArt) {
  // second, nearer mountain row (bluish-green)
  const r = rng(5);
  peaks(
    p,
    r,
    214,
    [
      { x: 60, h: 46, w: 70 },
      { x: 170, h: 34, w: 60 },
      { x: 430, h: 50, w: 70 },
    ],
    { lit: '#6e7a82', shade: '#4d5868', dark: '#434d5c', snowLit: '#e9dccb', snowShade: '#9ea4b4', haze: '#a98f84' },
    0.18,
  );
  // rolling hill with the castle
  for (let x = 0; x < LW; x++) {
    const top = hillY(x);
    for (let y = top; y < LH; y++) {
      const d = y - top;
      let c = '#3e5448';
      if (d === 0) c = '#6d8a62';
      else if (d < 3) c = dither(x, y, 0.5, '#58744f', '#3e5448');
      else if (d > 14) c = dither(x, y, Math.min(1, (d - 14) / 14), '#3e5448', '#33463c');
      px(p, x, y, c);
    }
  }
  paintCastle(p, art);
}

function stoneWall(p: Paint, x: number, y: number, w: number, h: number, litCols: number) {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const xx = x + i;
      const yy = y + j;
      let c = i < litCols ? '#c2b4a0' : '#8c8290';
      if (i >= litCols && i > w - 3) c = '#6b6474';
      if ((yy % 4 === 0 && (xx + (Math.floor(yy / 4) % 2) * 2) % 5 !== 0) || (xx + (Math.floor(yy / 4) % 2) * 2) % 5 === 0 && yy % 4 === 2) {
        c = i < litCols ? '#a8998a' : '#766d7c';
      }
      px(p, xx, yy, c);
    }
  }
}

function battlements(p: Paint, x: number, y: number, w: number, litCols: number) {
  for (let i = 0; i < w; i += 2) {
    const c = i < litCols ? '#d3c5ae' : '#958b98';
    px(p, x + i, y - 1, c);
    px(p, x + i, y - 2, c);
  }
}

function coneRoof(p: Paint, cx: number, baseY: number, halfW: number, h: number) {
  for (let j = 0; j < h; j++) {
    const hw = Math.round(halfW * (j / (h - 1)));
    for (let i = -hw; i <= hw; i++) {
      let c = i < 0 ? '#5a4f6a' : '#3a3450';
      if (i === -hw) c = '#7d6d86';
      if (j === h - 1) c = '#2a2538';
      px(p, cx + i, baseY - h + j, c);
    }
  }
}

function tower(p: Paint, art: LandscapeArt, cx: number, w: number, h: number, roofH: number, base: number, windows: number[]) {
  const x = cx - Math.floor(w / 2);
  const top = base - h;
  stoneWall(p, x, top, w, h, Math.ceil(w * 0.45));
  // overhang ring
  rect(p, x - 1, top, w + 2, 1, '#5e566a');
  coneRoof(p, cx, top, Math.ceil(w / 2) + 1, roofH);
  art.flags.push({ x: cx, y: top - roofH - 1 });
  for (const wy of windows) {
    px(p, cx - 1, top + wy, '#fbc254');
    px(p, cx - 1, top + wy + 1, '#f28c38');
    art.windows.push({ x: cx - 1, y: top + wy });
  }
  // flag pole
  rect(p, cx, top - roofH - 6, 1, 6, '#2a2538');
}

function paintCastle(p: Paint, art: LandscapeArt) {
  const base = CASTLE_BASE;
  // curtain wall
  stoneWall(p, 270, base - 20, 98, 20, 30);
  battlements(p, 270, base - 20, 98, 30);
  // gate
  rect(p, 312, base - 11, 9, 11, '#241f2a');
  rect(p, 313, base - 12, 7, 1, '#241f2a');
  px(p, 314, base - 13, '#241f2a');
  px(p, 318, base - 13, '#241f2a');
  rect(p, 314, base - 13, 5, 1, '#241f2a');
  tower(p, art, 274, 11, 40, 14, base, [10, 22]);
  tower(p, art, 296, 13, 52, 17, base, [12, 26]);
  tower(p, art, 318, 18, 70, 22, base, [14, 28, 42]); // keep
  tower(p, art, 342, 12, 46, 15, base, [11, 24]);
  tower(p, art, 364, 10, 36, 12, base, [9]);
  // a lit hall window row on the curtain wall
  for (const x of [284, 330, 352]) {
    px(p, x, base - 12, '#fbc254');
    art.windows.push({ x, y: base - 12 });
  }
  // the walls stand in the grass: a shadow line at their foot, and tufts growing up against them
  const r = rng(77);
  for (let x = CASTLE_X0 + 2; x <= CASTLE_X1 - 2; x++) {
    px(p, x, base, '#33463c');
    const tuft = r();
    if (tuft < 0.45) px(p, x, base - 1, tuft < 0.15 ? '#6d8a62' : '#58744f');
    if (tuft < 0.12) px(p, x, base - 2, '#6d8a62');
  }
}

// ── Near: forests, fields, river ───────────────────────────────────────────

function conifer(p: Paint, x: number, baseY: number, h: number, dark: string, mid: string, lit: string) {
  for (let j = 0; j < h; j++) {
    const t = j / h;
    const hw = Math.max(0, Math.round((t * h) / 3.2 - ((j % 3) === 0 ? 1 : 0)));
    for (let i = -hw; i <= hw; i++) {
      let c = mid;
      if (i === -hw || (i < 0 && j % 3 === 1)) c = lit;
      if (i > 0 && i >= hw - 1) c = dark;
      px(p, x + i, baseY - h + j, c);
    }
  }
  px(p, x, baseY, dark);
}

const riverX = (y: number) => 316 - (y - 200) * 1.05 + Math.sin((y - 200) / 12) * 14;
const riverW = (y: number) => 1.5 + (y - 200) * 0.3;

function paintNear(p: Paint) {
  const r = rng(31);
  // meadow bands
  for (let y = 206; y < LH; y++) {
    for (let x = 0; x < LW; x++) {
      const t = (y - 206) / 64;
      let c = dither(x, y, t, '#56703f', '#40592f');
      if ((x * 7 + y * 13) % 53 === 0) c = '#7a9150';
      px(p, x, y, c);
    }
  }
  // the road winding down from the castle gate
  for (let y = 200; y < LH; y++) {
    const cx = riverX(y);
    const hw = riverW(y);
    for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
      const e = Math.abs(x - cx) / Math.max(1, hw);
      let c = dither(x, y, (y - 200) / 70, '#c9a676', '#a98556');
      if (e > 0.35 && e < 0.5 && y > 225) c = '#8c6a44';
      if (x < cx && e > 0.8) c = '#e0bf8a';
      if (e > 0.92) c = '#5f4a31';
      px(p, x, y, c);
    }
  }
  // back forest row along the hill foot
  for (let x = -4; x < LW + 4; x += 3 + Math.floor(r() * 3)) {
    const base = 214 + Math.floor(r() * 5);
    if (Math.abs(x - riverX(base)) < riverW(base) + 3) continue;
    conifer(p, x, base, 9 + Math.floor(r() * 9), '#18271f', '#20352a', '#2f4a36');
  }
  // closer groves
  for (const [x0, x1, y0] of [
    [0, 150, 236],
    [360, 480, 240],
  ] as const) {
    for (let x = x0; x < x1; x += 4 + Math.floor(r() * 3)) {
      const base = y0 + Math.floor(r() * 10);
      if (Math.abs(x - riverX(base)) < riverW(base) + 4) continue;
      conifer(p, x, base, 14 + Math.floor(r() * 14), '#0f1c16', '#16271f', '#24402f');
    }
  }
}

// ── Foreground rampart ─────────────────────────────────────────────────────

function paintFg(p: Paint, art: LandscapeArt) {
  const r = rng(3);
  // left: a stone rampart tower cutting into the frame
  const x1 = 104;
  const top = 128;
  for (let y = top; y < LH; y++) {
    for (let x = 0; x < x1 - Math.max(0, (y - top) * 0.05); x++) {
      const row = Math.floor((y - top) / 9);
      const off = row % 2 ? 7 : 0;
      const mortar = (y - top) % 9 === 0 || (x + off) % 15 === 0;
      let c = mortar ? '#1c1a20' : r() < 0.14 ? '#3a3640' : r() < 0.1 ? '#26232b' : '#2f2c34';
      if (!mortar && (y - top) % 9 === 1) c = '#46424d';
      if (x > x1 - 8) c = mortar ? '#17151a' : '#24212a';
      if (x > x1 - 3 && !mortar && (y - top) % 9 < 5) c = '#6b5a55';
      px(p, x, y, c);
    }
  }
  // merlons
  for (let m = 0; m < 5; m++) {
    const mx = 2 + m * 21;
    for (let y = top - 12; y < top; y++) {
      for (let x = mx; x < mx + 13; x++) {
        let c = x > mx + 10 ? '#26232a' : '#34313a';
        if (y === top - 12) c = '#8a6f62';
        else if (y === top - 11) c = '#57505c';
        if (x === mx + 12 && y > top - 12) c = '#6b5a55';
        px(p, x, y, c);
      }
    }
  }
  // moss & ivy on the rampart
  for (let k = 0; k < 90; k++) {
    const x = Math.floor(r() * 96);
    const y = top + Math.floor(r() * 140);
    px(p, x, y, r() < 0.5 ? '#24512b' : '#3e7f3a');
  }
  art.banner = { x: 60, y: top + 6 };
  // banner pole bracket
  rect(p, 52, top + 4, 22, 2, '#1a1612');
  rect(p, 52, top + 4, 1, 6, '#1a1612');
  // right: rocky ledge with a torch stand
  for (let x = 380; x < LW; x++) {
    const t = Math.min(1, (x - 380) / 30);
    const topY = Math.round(250 - t * 22 + Math.sin(x / 5) * 1.5);
    for (let y = topY; y < LH; y++) {
      let c = y === topY ? '#b08a6e' : y === topY + 1 ? '#6a5a5a' : r() < 0.18 ? '#2a272e' : '#38343f';
      if (y > topY + 10) c = r() < 0.2 ? '#302c36' : '#26232a';
      px(p, x, y, c);
    }
  }
  rect(p, 441, 206, 2, 26, '#2a1b15');
  rect(p, 437, 205, 10, 2, '#4d3413');
  rect(p, 438, 203, 8, 2, '#7c5a1c');
  art.torches.push({ x: 442, y: 203 });
  // grass tufts along the bottom
  for (let x = 104; x < 380; x += 2) {
    const h = 1 + Math.floor(r() * 4);
    for (let j = 0; j < h; j++) px(p, x + (j % 2), LH - 1 - j, j === h - 1 ? '#7a9150' : '#2f4a2a');
  }
}

export const landscapeArt = once((): LandscapeArt => {
  const art: LandscapeArt = {
    sky: '',
    clouds: '',
    cloudsW: 960,
    cloudsH: 110,
    far: '',
    mid: '',
    near: '',
    fg: '',
    flags: [],
    torches: [],
    banner: { x: 0, y: 0 },
    windows: [],
  };
  const sky = makeCanvas(LW, LH);
  paintSky(sky);
  art.sky = toURL(sky);
  const clouds = makeCanvas(art.cloudsW, art.cloudsH);
  paintClouds(clouds);
  art.clouds = toURL(clouds);
  const far = makeCanvas(LW, LH);
  paintFar(far);
  art.far = toURL(far);
  const mid = makeCanvas(LW, LH);
  paintMid(mid, art);
  art.mid = toURL(mid);
  const near = makeCanvas(LW, LH);
  paintNear(near);
  art.near = toURL(near);
  const fg = makeCanvas(LW, LH);
  paintFg(fg, art);
  art.fg = toURL(fg);
  return art;
});
