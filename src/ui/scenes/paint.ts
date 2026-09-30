// Low-level helpers for the procedurally painted pixel-art scenes and textures.
// Everything is drawn at native pixel resolution on small canvases and shown
// scaled up with `image-rendering: pixelated`.

export type Rng = () => number;

/** Deterministic PRNG (mulberry32) – scenes look the same on every visit. */
export function rng(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export const between = (r: Rng, a: number, b: number) => a + (b - a) * r();
export const pick = <T,>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

export interface Paint {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
}

export function makeCanvas(w: number, h: number): Paint {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx, w, h };
}

export const toURL = (p: Paint) => p.canvas.toDataURL('image/png');

export function px(p: Paint, x: number, y: number, c: string) {
  p.ctx.fillStyle = c;
  p.ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

export function rect(p: Paint, x: number, y: number, w: number, h: number, c: string) {
  p.ctx.fillStyle = c;
  p.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** 4×4 ordered (Bayer) dither threshold in [0,1). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

/** Pick between two colours with ordered dithering (t = share of `b`). */
export const dither = (x: number, y: number, t: number, a: string, b: string) => (t > bayer(x, y) ? b : a);

/**
 * Vertical gradient through colour stops, rendered with dithered bands so it stays
 * inside the palette (stops: [position 0..1, colour]).
 */
export function ditherGradient(p: Paint, y0: number, y1: number, stops: [number, string][], x0 = 0, x1 = p.w) {
  for (let y = y0; y < y1; y++) {
    const t = (y - y0) / Math.max(1, y1 - y0 - 1);
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const [ta, ca] = stops[i];
    const [tb, cb] = stops[i + 1];
    const k = Math.min(1, Math.max(0, (t - ta) / Math.max(1e-6, tb - ta)));
    for (let x = x0; x < x1; x++) px(p, x, y, dither(x, y, k, ca, cb));
  }
}

/** Smooth 1D value noise (periodic when `period` is given). */
export function noise1(seed: number, period = 0) {
  const r = rng(seed);
  const n = period || 256;
  const vals = Array.from({ length: n + 1 }, () => r());
  if (period) vals[n] = vals[0];
  return (x: number) => {
    const xi = Math.floor(x);
    const f = x - xi;
    const a = vals[((xi % n) + n) % n];
    const b = vals[(((xi + 1) % n) + n) % n];
    const s = f * f * (3 - 2 * f);
    return a + (b - a) * s;
  };
}

/** Fractal ridge line: sum of octaves of 1D noise (0..1). */
export function ridge(seed: number, scale: number, octaves = 4, period = 0) {
  const layers = Array.from({ length: octaves }, (_, i) => noise1(seed + i * 101, period ? period * 2 ** i : 0));
  return (x: number) => {
    let v = 0;
    let amp = 1;
    let sum = 0;
    let f = 1 / scale;
    for (const n of layers) {
      v += n(x * f) * amp;
      sum += amp;
      amp *= 0.5;
      f *= 2;
    }
    return v / sum;
  };
}

export function hexMix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/** Memoises an expensive painter (scenes are generated once per session). */
export function once<T>(fn: () => T): () => T {
  let v: T | undefined;
  let done = false;
  return () => {
    if (!done) {
      v = fn();
      done = true;
    }
    return v as T;
  };
}

/**
 * Adds a dithered pool of coloured light (quantised into `levels` steps) –
 * implemented on the raw pixel buffer so it stays fast.
 */
export function glow(
  p: Paint,
  cx: number,
  cy: number,
  radius: number,
  colour: string,
  maxMix: number,
  opts: { levels?: number; squashY?: number; y0?: number; y1?: number; power?: number } = {},
) {
  const levels = opts.levels ?? 4;
  const squash = opts.squashY ?? 1;
  const y0 = Math.max(0, opts.y0 ?? cy - radius / squash);
  const y1 = Math.min(p.h, opts.y1 ?? cy + radius / squash);
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(p.w, Math.ceil(cx + radius));
  if (x1 <= x0 || y1 <= y0) return;
  const img = p.ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
  const n = parseInt(colour.slice(1), 16);
  const cr = (n >> 16) & 255;
  const cg = (n >> 8) & 255;
  const cb = n & 255;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const d = Math.hypot(x - cx, (y - cy) * squash);
      const g = Math.max(0, 1 - d / radius);
      if (g <= 0) continue;
      const lv = Math.pow(g, opts.power ?? 1.4) * levels;
      const level = Math.floor(lv) + (lv - Math.floor(lv) > bayer(x, y) ? 1 : 0);
      if (level <= 0) continue;
      const k = (maxMix * level) / levels;
      const i = ((y - y0) * (x1 - x0) + (x - x0)) * 4;
      if (img.data[i + 3] === 0) continue;
      img.data[i] = Math.round(img.data[i] * (1 - k) + cr * k);
      img.data[i + 1] = Math.round(img.data[i + 1] * (1 - k) + cg * k);
      img.data[i + 2] = Math.round(img.data[i + 2] * (1 - k) + cb * k);
    }
  }
  p.ctx.putImageData(img, x0, y0);
}
