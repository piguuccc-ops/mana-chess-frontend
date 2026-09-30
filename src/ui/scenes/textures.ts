// ─────────────────────────────────────────────────────────────────────────────
// Procedural pixel textures and 9-slice frames (wood, iron, brass, parchment,
// stone, the chess board). Generated once at start-up and exposed to CSS as
// custom properties (--tex-*, --frame-*), so the stylesheet can use them like
// ordinary image assets.
// ─────────────────────────────────────────────────────────────────────────────
import { makeCanvas, px, rect, rng, toURL, type Paint } from './paint';

const TAU = Math.PI * 2;

// ── Tiles ────────────────────────────────────────────────────────────────────

function planks(seed: number, ramp: string[], seam: string, glint: string): string {
  const p = makeCanvas(64, 32);
  const r = rng(seed);
  for (let k = 0; k < 4; k++) {
    const y0 = k * 8;
    const phase = r() * TAU;
    const cycles = 2 + Math.floor(r() * 3);
    const baseShift = Math.floor(r() * 2);
    for (let y = y0; y < y0 + 8; y++) {
      for (let x = 0; x < 64; x++) {
        const g = Math.sin((x / 64) * TAU * cycles + phase + (y - y0) * 0.8) + Math.sin((x / 64) * TAU * (cycles + 3) + y * 1.7) * 0.5;
        let i = 1 + baseShift + (g > 0.95 ? 1 : g < -0.9 ? -1 : 0);
        if (r() < 0.04) i += r() < 0.5 ? -1 : 1;
        px(p, x, y, ramp[Math.max(0, Math.min(ramp.length - 1, i))]);
      }
    }
    for (let x = 0; x < 64; x++) {
      px(p, x, y0, glint);
      px(p, x, y0 + 7, seam);
    }
    // butt joint with two nails
    const jx = 6 + Math.floor(r() * 50);
    for (let y = y0 + 1; y < y0 + 7; y++) px(p, jx, y, seam);
    px(p, jx - 2, y0 + 2, seam);
    px(p, jx + 2, y0 + 5, seam);
    // a knot
    if (r() < 0.6) {
      const kx = 4 + Math.floor(r() * 56);
      const ky = y0 + 3;
      px(p, kx, ky, seam);
      px(p, kx + 1, ky, seam);
      px(p, kx - 1, ky + 1, ramp[0]);
      px(p, kx + 2, ky + 1, ramp[0]);
      px(p, kx, ky + 2, ramp[0]);
      px(p, kx + 1, ky + 2, ramp[0]);
    }
  }
  return toURL(p);
}

function parchmentTile(seed: number, base: string[], size = 96): string {
  const p = makeCanvas(size, size);
  const r = rng(seed);
  // periodic value noise for soft blotches
  const cells = 6;
  const grid = Array.from({ length: cells * cells }, () => r());
  const at = (x: number, y: number) => grid[(((y % cells) + cells) % cells) * cells + (((x % cells) + cells) % cells)];
  const smooth = (x: number, y: number) => {
    const fx = (x / size) * cells;
    const fy = (y / size) * cells;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = smooth(x, y) * 0.75 + r() * 0.25;
      const i = n < 0.28 ? 0 : n < 0.62 ? 1 : n < 0.9 ? 2 : 3;
      px(p, x, y, base[i]);
    }
  }
  // fibres
  for (let k = 0; k < size * 1.4; k++) {
    const x = Math.floor(r() * size);
    const y = Math.floor(r() * size);
    const len = 2 + Math.floor(r() * 4);
    const c = r() < 0.5 ? base[0] : base[3];
    for (let j = 0; j < len; j++) px(p, (x + j) % size, y, c);
  }
  return toURL(p);
}

function stoneTile(seed: number): string {
  const p = makeCanvas(64, 48);
  const r = rng(seed);
  const tones = ['#2e2b31', '#35323b', '#3c3842', '#433f49'];
  rect(p, 0, 0, 64, 48, '#1c1a1f');
  for (let row = 0; row < 4; row++) {
    const y0 = row * 12;
    const off = row % 2 ? 8 : 0;
    for (let b = -1; b < 4; b++) {
      const x0 = b * 16 + off;
      const tone = tones[Math.floor(r() * tones.length)];
      for (let y = y0 + 1; y < y0 + 12; y++) {
        for (let x = x0 + 1; x < x0 + 16; x++) {
          const xx = ((x % 64) + 64) % 64;
          let c = tone;
          const n = r();
          if (n < 0.08) c = '#28252b';
          else if (n > 0.95) c = '#4a4650';
          if (y === y0 + 1) c = '#4f4a55';
          if (x === x0 + 15 || y === y0 + 11) c = '#242127';
          px(p, xx, y, c);
        }
      }
      // cracks & moss
      if (r() < 0.3) {
        let cx = x0 + 4 + Math.floor(r() * 8);
        for (let y = y0 + 3; y < y0 + 9; y++) {
          px(p, ((cx % 64) + 64) % 64, y, '#1f1d22');
          cx += r() < 0.5 ? 1 : 0;
        }
      }
      if (r() < 0.18) for (let k = 0; k < 5; k++) px(p, ((x0 + 2 + k * 2) % 64 + 64) % 64, y0 + 10, k % 2 ? '#24512b' : '#16301c');
    }
  }
  return toURL(p);
}

function ironTile(seed: number): string {
  const p = makeCanvas(32, 32);
  const r = rng(seed);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) px(p, x, y, r() < 0.5 ? '#2c2a30' : r() < 0.6 ? '#322f36' : '#28262b');
  for (let k = 0; k < 6; k++) {
    const x = Math.floor(r() * 32);
    const y = Math.floor(r() * 32);
    for (let j = 0; j < 4; j++) px(p, (x + j) % 32, (y + j) % 32, '#3b3840');
  }
  return toURL(p);
}

// ── 9-slice frames (border-image) ────────────────────────────────────────────

interface FrameSpec {
  size: number;
  slice: number;
  paint: (p: Paint) => void;
}

function bevelBox(p: Paint, x: number, y: number, w: number, h: number, outer: string, light: string, mid: string, dark: string, t: number) {
  rect(p, x, y, w, h, outer);
  rect(p, x + 1, y + 1, w - 2, h - 2, mid);
  for (let i = 1; i < t; i++) {
    rect(p, x + i, y + i, w - 2 * i, 1, light);
    rect(p, x + i, y + i, 1, h - 2 * i, light);
    rect(p, x + i, y + h - 1 - i, w - 2 * i, 1, dark);
    rect(p, x + w - 1 - i, y + i, 1, h - 2 * i, dark);
  }
}

function rivet(p: Paint, x: number, y: number, hi: string, mid: string, lo: string) {
  px(p, x, y, hi);
  px(p, x + 1, y, mid);
  px(p, x, y + 1, mid);
  px(p, x + 1, y + 1, lo);
}

function cornerPlate(p: Paint, x: number, y: number, s: number, metal: [string, string, string, string]) {
  const [hi, light, mid, dark] = metal;
  rect(p, x, y, s, s, dark);
  rect(p, x + 1, y + 1, s - 2, s - 2, mid);
  rect(p, x + 1, y + 1, s - 2, 1, light);
  rect(p, x + 1, y + 1, 1, s - 2, light);
  rivet(p, x + Math.floor(s / 2) - 1, y + Math.floor(s / 2) - 1, hi, light, dark);
}

const BRASS: [string, string, string, string] = ['#fff0a0', '#e6bf4c', '#b78a2b', '#4d3413'];
const IRON: [string, string, string, string] = ['#d8d4da', '#a6a1aa', '#77727d', '#211f25'];

function woodFrame(inner: string | null, metal = BRASS): FrameSpec {
  return {
    size: 24,
    slice: 8,
    paint: (p) => {
      // outer outline + chunky wood bevel
      rect(p, 0, 0, 24, 24, '#140d0b');
      rect(p, 1, 1, 22, 22, '#58392a');
      rect(p, 1, 1, 22, 1, '#98693f');
      rect(p, 1, 1, 1, 22, '#98693f');
      rect(p, 2, 2, 20, 20, '#77503a');
      rect(p, 2, 2, 20, 1, '#8e6545');
      rect(p, 2, 21, 20, 1, '#3d2a1f');
      rect(p, 21, 2, 1, 20, '#3d2a1f');
      rect(p, 1, 22, 22, 1, '#2a1b15');
      rect(p, 22, 1, 1, 22, '#2a1b15');
      // grain streaks on the frame
      for (let i = 3; i < 21; i += 3) {
        px(p, i, 3, '#6b4632');
        px(p, 3, i, '#6b4632');
        px(p, i + 1, 20, '#5d3e2c');
        px(p, 20, i + 1, '#5d3e2c');
      }
      // inner lip
      rect(p, 5, 5, 14, 14, '#2a1b15');
      rect(p, 6, 6, 12, 12, inner ?? '#00000000');
      if (!inner) p.ctx.clearRect(6, 6, 12, 12);
      rect(p, 5, 18, 14, 1, '#98693f');
      rect(p, 18, 5, 1, 14, '#98693f');
      // metal corners
      cornerPlate(p, 0, 0, 6, metal);
      cornerPlate(p, 18, 0, 6, metal);
      cornerPlate(p, 0, 18, 6, metal);
      cornerPlate(p, 18, 18, 6, metal);
    },
  };
}

function ironFrame(): FrameSpec {
  return {
    size: 18,
    slice: 6,
    paint: (p) => {
      rect(p, 0, 0, 18, 18, '#0d0b0e');
      rect(p, 1, 1, 16, 16, '#524e58');
      rect(p, 1, 1, 16, 1, '#8a8690');
      rect(p, 1, 1, 1, 16, '#8a8690');
      rect(p, 2, 2, 14, 14, '#3b3940');
      rect(p, 2, 16, 15, 1, '#211f25');
      rect(p, 16, 2, 1, 15, '#211f25');
      rect(p, 4, 4, 10, 10, '#1a181c');
      p.ctx.clearRect(5, 5, 8, 8);
      rivet(p, 2, 2, IRON[0], IRON[1], IRON[3]);
      rivet(p, 14, 2, IRON[0], IRON[1], IRON[3]);
      rivet(p, 2, 14, IRON[0], IRON[1], IRON[3]);
      rivet(p, 14, 14, IRON[0], IRON[1], IRON[3]);
    },
  };
}

function goldFrame(): FrameSpec {
  return {
    size: 18,
    slice: 6,
    paint: (p) => {
      rect(p, 0, 0, 18, 18, '#140d0b');
      rect(p, 1, 1, 16, 16, '#b78a2b');
      rect(p, 1, 1, 16, 1, '#fff0a0');
      rect(p, 1, 1, 1, 16, '#e6bf4c');
      rect(p, 2, 2, 14, 14, '#7c5a1c');
      rect(p, 2, 2, 14, 1, '#e6bf4c');
      rect(p, 2, 15, 14, 1, '#4d3413');
      rect(p, 15, 2, 1, 14, '#4d3413');
      rect(p, 16, 1, 1, 16, '#4d3413');
      rect(p, 1, 16, 16, 1, '#4d3413');
      rect(p, 3, 3, 12, 12, '#140d0b');
      p.ctx.clearRect(4, 4, 10, 10);
      for (const [x, y] of [[1, 1], [15, 1], [1, 15], [15, 15]] as const) {
        px(p, x, y, '#fff0a0');
      }
    },
  };
}

/** Burnt parchment rim (the fill comes from the parchment background texture). */
function parchmentEdge(): FrameSpec {
  return {
    size: 24,
    slice: 8,
    paint: (p) => {
      p.ctx.clearRect(0, 0, 24, 24);
      rect(p, 0, 0, 24, 24, '#3d2a1f');
      rect(p, 1, 1, 22, 22, '#77503a');
      rect(p, 2, 2, 20, 20, '#a57b4c');
      rect(p, 3, 3, 18, 18, '#c49a66');
      p.ctx.clearRect(4, 4, 16, 16);
      // chipped corners
      for (const [x, y] of [[0, 0], [23, 0], [0, 23], [23, 23]] as const) p.ctx.clearRect(x, y, 1, 1);
      px(p, 1, 1, '#3d2a1f');
      px(p, 22, 1, '#3d2a1f');
      px(p, 1, 22, '#3d2a1f');
      px(p, 22, 22, '#3d2a1f');
    },
  };
}

/** Compact bevelled frame for buttons, tabs, fields and cards (12×12, slice 4). */
function bevelFrame(outline: string, light: string, dark: string, corner: string | null, inner: string | null = null, inset = false): FrameSpec {
  return {
    size: 12,
    slice: 4,
    paint: (p) => {
      p.ctx.clearRect(0, 0, 12, 12);
      rect(p, 0, 0, 12, 12, outline);
      // chamfered outer corners
      p.ctx.clearRect(0, 0, 1, 1);
      p.ctx.clearRect(11, 0, 1, 1);
      p.ctx.clearRect(0, 11, 1, 1);
      p.ctx.clearRect(11, 11, 1, 1);
      const tl = inset ? dark : light;
      const br = inset ? light : dark;
      rect(p, 1, 1, 10, 1, tl);
      rect(p, 1, 1, 1, 10, tl);
      rect(p, 1, 10, 10, 1, br);
      rect(p, 10, 1, 1, 10, br);
      rect(p, 2, 2, 8, 8, inner ?? '#000');
      if (!inner) p.ctx.clearRect(2, 2, 8, 8);
      if (corner) {
        px(p, 1, 1, corner);
        px(p, 10, 1, corner);
        px(p, 1, 10, corner);
        px(p, 10, 10, corner);
      }
    },
  };
}

function frameURL(spec: FrameSpec): string {
  const p = makeCanvas(spec.size, spec.size);
  spec.paint(p);
  return toURL(p);
}

// ── The chess board ─────────────────────────────────────────────────────────

/** 8×8 squares of 20 px: light maple and dark walnut, every square slightly different. */
export function boardTexture(): string {
  const S = 20;
  const p = makeCanvas(S * 8, S * 8);
  const r = rng(2024);
  const light = ['#b99463', '#c6a06c', '#d0ac78', '#dbb985', '#e4c593'];
  const dark = ['#5a3a26', '#65422b', '#704a30', '#7b5236', '#865b3c'];
  for (let sy = 0; sy < 8; sy++) {
    for (let sx = 0; sx < 8; sx++) {
      const isLight = (sx + sy) % 2 === 0;
      const ramp = isLight ? light : dark;
      const phase = r() * TAU;
      const cyc = 1 + r() * 1.5;
      const vertical = r() < 0.5;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const u = vertical ? x : y;
          const v = vertical ? y : x;
          const g = Math.sin((v / S) * TAU * cyc + phase + u * 0.55) * 0.6 + Math.sin(u * 1.3 + phase * 2) * 0.4;
          let i = 2 + (g > 0.55 ? 1 : g < -0.55 ? -1 : 0);
          if (r() < 0.05) i += r() < 0.5 ? -1 : 1;
          px(p, sx * S + x, sy * S + y, ramp[Math.max(0, Math.min(4, i))]);
        }
      }
      // bevel: light top/left edge, dark bottom/right edge (tiles feel inlaid)
      for (let i = 0; i < S; i++) {
        px(p, sx * S + i, sy * S, ramp[4]);
        px(p, sx * S, sy * S + i, ramp[3]);
        px(p, sx * S + i, sy * S + S - 1, ramp[0]);
        px(p, sx * S + S - 1, sy * S + i, ramp[1]);
      }
    }
  }
  return toURL(p);
}

/** Carved board frame with brass corner plates (border-image, slice 12). */
function boardFrame(): FrameSpec {
  return {
    size: 36,
    slice: 12,
    paint: (p) => {
      rect(p, 0, 0, 36, 36, '#0d0806');
      // outer moulding
      bevelBox(p, 1, 1, 34, 34, '#2a1b15', '#8e6545', '#6b4632', '#3d2a1f', 3);
      rect(p, 4, 4, 28, 28, '#4a3022');
      // carved groove
      rect(p, 6, 6, 24, 24, '#2a1b15');
      rect(p, 7, 7, 22, 22, '#5a3a28');
      rect(p, 7, 7, 22, 1, '#7a5238');
      rect(p, 7, 7, 1, 22, '#7a5238');
      // inner lip into the board
      rect(p, 9, 9, 18, 18, '#140d0b');
      rect(p, 10, 10, 16, 16, '#00000000');
      p.ctx.clearRect(11, 11, 14, 14);
      rect(p, 10, 26, 16, 1, '#8e6545');
      rect(p, 26, 10, 1, 16, '#8e6545');
      // brass corners
      for (const [x, y] of [[0, 0], [28, 0], [0, 28], [28, 28]] as const) {
        rect(p, x, y, 8, 8, '#4d3413');
        rect(p, x + 1, y + 1, 6, 6, '#b78a2b');
        rect(p, x + 1, y + 1, 6, 1, '#e6bf4c');
        rect(p, x + 1, y + 1, 1, 6, '#e6bf4c');
        rect(p, x + 6, y + 2, 1, 5, '#7c5a1c');
        rect(p, x + 2, y + 6, 5, 1, '#7c5a1c');
        rivet(p, x + 3, y + 3, '#fff0a0', '#e6bf4c', '#4d3413');
      }
      // small brass studs mid-edges
      for (const [x, y] of [[17, 1], [17, 33], [1, 17], [33, 17]] as const) rivet(p, x, y, '#fff0a0', '#e6bf4c', '#4d3413');
    },
  };
}

// ── Public: install everything as CSS custom properties ────────────────────

let installed = false;

export function installTextures(root: HTMLElement = document.documentElement): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const vars: Record<string, string> = {
    '--tex-wood': planks(7, ['#4f3424', '#5d3e2c', '#6b4632', '#77503a', '#825a3f'], '#2a1b15', '#8e6545'),
    '--tex-wood-dark': planks(19, ['#281a13', '#302017', '#38261b', '#40291e', '#482f22'], '#140d0b', '#553826'),
    '--tex-wood-light': planks(23, ['#77503a', '#825a3f', '#8e6545', '#98693f', '#a57446'], '#4f3424', '#b58658'),
    '--tex-parchment': parchmentTile(5, ['#c9a672', '#d6b681', '#dfc28f', '#e8cfa0']),
    '--tex-parchment-dark': parchmentTile(9, ['#a8844f', '#b69260', '#c29e6b', '#cfad7b']),
    '--tex-stone': stoneTile(3),
    '--tex-iron': ironTile(13),
    '--tex-board': boardTexture(),
    '--frame-wood': frameURL(woodFrame(null)),
    '--frame-wood-iron': frameURL(woodFrame(null, IRON)),
    '--frame-iron': frameURL(ironFrame()),
    '--frame-gold': frameURL(goldFrame()),
    '--frame-parchment': frameURL(parchmentEdge()),
    '--frame-board': frameURL(boardFrame()),
    '--frame-btn': frameURL(bevelFrame('#140d0b', '#a57446', '#3d2a1f', '#e6bf4c')),
    '--frame-btn-down': frameURL(bevelFrame('#140d0b', '#a57446', '#2a1b15', '#b78a2b', null, true)),
    '--frame-btn-gold': frameURL(bevelFrame('#140d0b', '#fff0a0', '#7c5a1c', '#fff0a0')),
    '--frame-btn-iron': frameURL(bevelFrame('#0d0b0e', '#a6a1aa', '#211f25', '#d8d4da')),
    '--frame-btn-red': frameURL(bevelFrame('#140d0b', '#d0453a', '#4a1316', '#e6bf4c')),
    '--frame-btn-void': frameURL(bevelFrame('#07050c', '#b58cf0', '#2a1842', '#f2e6ff')),
    '--frame-field': frameURL(bevelFrame('#140d0b', '#58392a', '#efdcb2', null, null, true)),
    '--frame-slot': frameURL(bevelFrame('#0d0907', '#1d140f', '#58392a', null, null, true)),
  };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, `url(${v})`);
}
