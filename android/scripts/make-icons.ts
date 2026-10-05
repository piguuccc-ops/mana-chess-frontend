// ─────────────────────────────────────────────────────────────────────────────
// The app's launcher icons and start-screen logo, drawn from the game's own pixel art: the ivory
// knight with an azure mana crystal, on a violet night. Every size uses whole-pixel scaling, so
// the art stays crisp.
//
//   npx tsx android/scripts/make-icons.ts          (writes android/app/src/main/res/…)
//   npx tsx android/scripts/make-icons.ts preview  (also android/icon-preview.png: how launchers show it)
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { CRYSTAL, CRYSTAL_PAL } from '../../src/ui/pixel/art/crystals';
import { PIECE_PAL, PIECE_SPRITES } from '../../src/ui/pixel/art/pieces';
import { resolveSprite, type ResolvedSprite } from '../../src/ui/pixel/sprite';

const HERE = dirname(fileURLToPath(import.meta.url));
const RES = join(HERE, '../app/src/main/res');

type RGBA = [number, number, number, number];
class Img {
  readonly px: Uint8Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = new Uint8Array(w * h * 4);
  }
  set(x: number, y: number, c: RGBA): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const a = c[3] / 255;
    if (a >= 1) {
      this.px.set(c, i);
      return;
    }
    // source-over
    const da = this.px[i + 3] / 255;
    const oa = a + da * (1 - a);
    for (let k = 0; k < 3; k++) this.px[i + k] = oa ? Math.round((c[k] * a + this.px[i + k] * da * (1 - a)) / oa) : 0;
    this.px[i + 3] = Math.round(oa * 255);
  }
  get(x: number, y: number): RGBA {
    const i = (y * this.w + x) * 4;
    return [this.px[i], this.px[i + 1], this.px[i + 2], this.px[i + 3]];
  }
  png(): Buffer {
    const raw = Buffer.alloc((this.w * 4 + 1) * this.h);
    for (let y = 0; y < this.h; y++) {
      raw[y * (this.w * 4 + 1)] = 0;
      Buffer.from(this.px.buffer, y * this.w * 4, this.w * 4).copy(raw, y * (this.w * 4 + 1) + 1);
    }
    const crcT = Array.from({ length: 256 }, (_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c >>> 0;
    });
    const crc = (b: Buffer) => {
      let c = 0xffffffff;
      for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    };
    const chunk = (t: string, d: Buffer) => {
      const l = Buffer.alloc(4);
      l.writeUInt32BE(d.length);
      const td = Buffer.concat([Buffer.from(t), d]);
      const c = Buffer.alloc(4);
      c.writeUInt32BE(crc(td));
      return Buffer.concat([l, td, c]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0);
    ihdr.writeUInt32BE(this.h, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  }
}

const hex = (h: string, a = 255): RGBA => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
};

// ── the art: the knight and the crystal, cropped to what is drawn ──
function art(): { w: number; h: number; px: (string | null)[] } {
  const W = 32;
  const H = 28;
  const grid: (string | null)[] = new Array(W * H).fill(null);
  const stamp = (r: ResolvedSprite, ox: number, oy: number) => {
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const c = r.px[y * r.w + x];
      if (c) grid[(oy + y) * W + ox + x] = c;
    }
  };
  stamp(resolveSprite(PIECE_SPRITES.N, PIECE_PAL.w), 3, 3);
  stamp(resolveSprite(CRYSTAL, CRYSTAL_PAL.w), 17, 9);
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  grid.forEach((c, i) => {
    if (!c) return;
    const x = i % W, y = Math.floor(i / W);
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  });
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const px: (string | null)[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px.push(grid[y * W + x]);
  return { w, h, px };
}
const CROPPED = art();
const ART_W = CROPPED.w;
const ART_H = CROPPED.h;
const ART = CROPPED.px;

/** The art at `scale`, its top-left corner at (ox, oy); `mono`: one colour (themed icons). */
function drawArt(img: Img, scale: number, ox: number, oy: number, mono?: RGBA): void {
  for (let y = 0; y < ART_H; y++) for (let x = 0; x < ART_W; x++) {
    const c = ART[y * ART_W + x];
    if (!c) continue;
    const rgba = mono ?? hex(c);
    for (let j = 0; j < scale; j++) for (let i = 0; i < scale; i++) img.set(ox + x * scale + i, oy + y * scale + j, rgba);
  }
}

/** A soft glow of mana behind the knight (in whole art pixels, so it looks drawn). */
function drawGlow(img: Img, scale: number, ox: number, oy: number): void {
  const cx = ART_W / 2;
  const cy = ART_H / 2 + 1;
  for (let y = -6; y < ART_H + 6; y++) for (let x = -6; x < ART_W + 6; x++) {
    const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.1) / 17;
    if (d > 1) continue;
    const a = Math.round((1 - d) * (1 - d) * 120);
    for (let j = 0; j < scale; j++) for (let i = 0; i < scale; i++) img.set(ox + x * scale + i, oy + y * scale + j, [79, 160, 224, a]);
  }
}

/** The violet night: a radial gradient in coarse steps, a few stars. */
function drawBackground(img: Img, block: number): void {
  const inner = hex('#4f2a78');
  const outer = hex('#160c22');
  const cx = img.w / 2;
  const cy = img.h * 0.45;
  for (let y = 0; y < img.h; y += block) for (let x = 0; x < img.w; x += block) {
    const d = Math.min(1, Math.hypot(x + block / 2 - cx, y + block / 2 - cy) / (img.w * 0.62));
    const t = Math.round(d * 6) / 6; // banded, like the game's skies
    const c: RGBA = [0, 1, 2].map((k) => Math.round(inner[k] + (outer[k] - inner[k]) * t)) as RGBA;
    c[3] = 255;
    for (let j = 0; j < block; j++) for (let i = 0; i < block; i++) img.set(x + i, y + j, c);
  }
  // a handful of stars (fixed places, so every size matches)
  // (inside the middle 72 dp that launchers show)
  for (const [fx, fy, big] of [[0.3, 0.26, 1], [0.7, 0.24, 0], [0.76, 0.5, 0], [0.24, 0.66, 0], [0.64, 0.74, 1]] as const) {
    const x = Math.floor((fx * img.w) / block) * block;
    const y = Math.floor((fy * img.h) / block) * block;
    for (let j = 0; j < block; j++) for (let i = 0; i < block; i++) img.set(x + i, y + j, hex('#dff8ff', big ? 230 : 160));
    if (big) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      for (let j = 0; j < block; j++) for (let i = 0; i < block; i++) img.set(x + dx * block + i, y + dy * block + j, hex('#8fd8f5', 120));
    }
  }
}

const write = (rel: string, img: Img) => {
  const file = join(RES, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, img.png());
};

// adaptive icons: 108 dp layers, the art inside the 66 dp safe circle
const DENSITIES = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
] as const;

for (const [name, k] of DENSITIES) {
  const size = Math.round(108 * k);
  const scale = Math.max(1, Math.floor((64 * k) / ART_W)); // the art ≈ 64 dp wide at most (the safe circle is 66)
  const ox = Math.floor((size - ART_W * scale) / 2);
  const oy = Math.floor((size - ART_H * scale) / 2);
  const bg = new Img(size, size);
  drawBackground(bg, Math.max(1, Math.round(2 * k)));
  write(`mipmap-${name}/ic_launcher_background.png`, bg);
  const fg = new Img(size, size);
  drawGlow(fg, scale, ox, oy);
  drawArt(fg, scale, ox, oy);
  write(`mipmap-${name}/ic_launcher_foreground.png`, fg);
  const mono = new Img(size, size);
  drawArt(mono, scale, ox, oy, [255, 255, 255, 255]);
  write(`mipmap-${name}/ic_launcher_monochrome.png`, mono);

  // older launchers: a 48 dp picture – the same layers, cut to a rounded square / a circle
  const legacy = Math.round(48 * k);
  for (const round of [false, true]) {
    const img = new Img(legacy, legacy);
    const ls = Math.max(1, Math.floor((legacy * 0.8) / ART_W));
    const back = new Img(legacy, legacy);
    drawBackground(back, Math.max(1, Math.round(k)));
    const lx = Math.floor((legacy - ART_W * ls) / 2);
    const ly = Math.floor((legacy - ART_H * ls) / 2);
    drawGlow(back, ls, lx, ly);
    drawArt(back, ls, lx, ly);
    const r = legacy / 2;
    const corner = legacy * 0.18;
    for (let y = 0; y < legacy; y++) for (let x = 0; x < legacy; x++) {
      const inside = round
        ? Math.hypot(x + 0.5 - r, y + 0.5 - r) <= r - 0.5
        : (() => {
            const qx = Math.max(corner - x - 0.5, x + 0.5 - (legacy - corner), 0);
            const qy = Math.max(corner - y - 0.5, y + 0.5 - (legacy - corner), 0);
            return Math.hypot(qx, qy) <= corner;
          })();
      if (inside) img.set(x, y, back.get(x, y));
    }
    write(`mipmap-${name}/${round ? 'ic_launcher_round' : 'ic_launcher'}.png`, img);
  }
}

// the start screen's logo (Android 11 and older): drawn at a fixed size
const splash = new Img(ART_W * 8 + 32, ART_H * 8 + 32);
drawGlow(splash, 8, 16, 16);
drawArt(splash, 8, 16, 16);
write('drawable-nodpi/splash_logo.png', splash);

if (process.argv.includes('preview')) {
  // what a launcher shows: the xxxhdpi layers in a circle and in a squircle, and the legacy ones
  const size = 432;
  const scale = Math.floor((64 * 4) / ART_W);
  const bg = new Img(size, size);
  drawBackground(bg, 8);
  const ox = Math.floor((size - ART_W * scale) / 2);
  const oy = Math.floor((size - ART_H * scale) / 2);
  drawGlow(bg, scale, ox, oy);
  drawArt(bg, scale, ox, oy);
  const out = new Img(size * 2 + 48, size);
  const visible = 72 / 108; // launchers show the middle 72 dp
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = (size * visible) / 2;
    if (Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) <= r) out.set(x, y, bg.get(x, y));
    const q = Math.max(Math.abs(x + 0.5 - size / 2), Math.abs(y + 0.5 - size / 2)) / r;
    const sq = Math.pow(Math.abs(x + 0.5 - size / 2) / r, 4) + Math.pow(Math.abs(y + 0.5 - size / 2) / r, 4);
    if (q <= 1 && sq <= 1) out.set(x + size + 48, y, bg.get(x, y));
  }
  writeFileSync(join(HERE, '../icon-preview.png'), out.png());
}
console.log('icons written to', RES);
