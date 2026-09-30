// ─────────────────────────────────────────────────────────────────────────────
// Effect primitives. Every spell, capture and mana change is composed from
// these few pieces: particle bursts, rings, light pillars, bolts, projectiles,
// stamps, square washes, swirls, flows and sprite shatters.
// Units: art pixels (1 board square = 20) and milliseconds.
// ─────────────────────────────────────────────────────────────────────────────
import type { PackedSprite, PixelBuffer } from './buffer';
import { passes } from './buffer';
import { SQ, type Particle, type VfxEngine, type XY } from './engine';
import { PX, RAMP } from './palettes';

export const rand = (a: number, b: number): number => a + Math.random() * (b - a);
export const irand = (a: number, b: number): number => Math.floor(rand(a, b + 1));
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);
export const easeIn = (t: number): number => t * t;
export const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
/** Fades out over the last `tail` part of the progress. */
export const tailFade = (p: number, tail = 0.4): number => (p < 1 - tail ? 1 : Math.max(0, (1 - p) / tail));

// ── Particles ────────────────────────────────────────────────────────────────

export interface BurstOpts {
  n: number;
  ramp: readonly number[];
  /** Speed range (art px / s). */
  speed?: [number, number];
  /** Emission angle range (radians, 0 = right, −π/2 = up). */
  angle?: [number, number];
  life?: [number, number];
  size?: [number, number];
  gravity?: number;
  drag?: number;
  shape?: 0 | 1 | 2;
  /** Random start offset radius. */
  spread?: number;
  /** Start offsets as a box instead of a circle. */
  box?: { w: number; h: number };
  delay?: [number, number];
  fade?: boolean;
  floor?: number;
  flicker?: number;
  ax?: number;
}

export function burst(e: VfxEngine, x: number, y: number, o: BurstOpts): void {
  if (e.reduced) o = { ...o, n: Math.ceil(o.n / 3) };
  const [a0, a1] = o.angle ?? [0, Math.PI * 2];
  for (let i = 0; i < o.n; i++) {
    const a = rand(a0, a1);
    const v = rand(...(o.speed ?? [20, 60]));
    let px = x;
    let py = y;
    if (o.box) {
      px += rand(-o.box.w / 2, o.box.w / 2);
      py += rand(-o.box.h / 2, o.box.h / 2);
    } else if (o.spread) {
      const r = Math.sqrt(Math.random()) * o.spread;
      const t = Math.random() * Math.PI * 2;
      px += Math.cos(t) * r;
      py += Math.sin(t) * r;
    }
    const p: Particle = {
      x: px,
      y: py,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      ax: o.ax ?? 0,
      ay: o.gravity ?? 0,
      drag: o.drag ?? 0,
      life: rand(...(o.life ?? [300, 600])),
      age: -rand(...(o.delay ?? [0, 0])),
      size: irand(...(o.size ?? [1, 1])),
      ramp: o.ramp,
      fade: o.fade ?? true,
      shape: o.shape ?? 0,
      floor: o.floor,
      flicker: o.flicker,
    };
    e.spawn(p);
  }
}

/** Little puffs kicked up where a piece lands. */
export function dust(e: VfxEngine, x: number, y: number, n = 8, delay = 0): void {
  burst(e, x, y, {
    n,
    ramp: RAMP.dust,
    speed: [14, 34],
    angle: [Math.PI * 0.95, Math.PI * 1.05],
    life: [260, 420],
    size: [1, 2],
    gravity: -10,
    drag: 4,
    box: { w: 14, h: 2 },
    delay: [delay, delay + 20],
  });
  burst(e, x, y, {
    n,
    ramp: RAMP.dust,
    speed: [14, 34],
    angle: [-0.05, 0.05],
    life: [260, 420],
    size: [1, 2],
    gravity: -10,
    drag: 4,
    box: { w: 14, h: 2 },
    delay: [delay, delay + 20],
  });
}

/** Rising smoke puffs. */
export function smoke(e: VfxEngine, x: number, y: number, n = 10, delay = 0, spread = 6): void {
  burst(e, x, y, {
    n,
    ramp: RAMP.smoke,
    speed: [4, 14],
    angle: [-Math.PI * 0.75, -Math.PI * 0.25],
    life: [500, 900],
    size: [2, 3],
    gravity: -16,
    drag: 1.5,
    spread,
    delay: [delay, delay + 160],
    flicker: 0.08,
  });
}

/** Twinkling plus-shaped sparkles scattered over an area. */
export function sparkle(e: VfxEngine, x: number, y: number, o: { n: number; ramp?: readonly number[]; w?: number; h?: number; dur?: number; delay?: number; rise?: number }): void {
  const n = e.reduced ? Math.ceil(o.n / 3) : o.n;
  for (let i = 0; i < n; i++) {
    e.spawn({
      x: x + rand(-(o.w ?? 16) / 2, (o.w ?? 16) / 2),
      y: y + rand(-(o.h ?? 16) / 2, (o.h ?? 16) / 2),
      vx: 0,
      vy: -(o.rise ?? 6),
      ax: 0,
      ay: 0,
      drag: 0,
      life: rand(220, 420),
      age: -rand(o.delay ?? 0, (o.delay ?? 0) + (o.dur ?? 400)),
      size: 1,
      ramp: o.ramp ?? RAMP.holy,
      fade: true,
      shape: Math.random() < 0.45 ? 1 : 0,
    });
  }
}

// ── Shapes ───────────────────────────────────────────────────────────────────

/** Expanding ring, optionally squashed into a floor ellipse. */
export function ring(
  e: VfxEngine,
  x: number,
  y: number,
  o: { r0: number; r1: number; dur: number; color: number; thick?: number; squash?: number; delay?: number; layer?: 0 | 1; hold?: number },
): void {
  e.add({
    delay: o.delay,
    dur: o.dur,
    layer: o.layer ?? 1,
    draw: (b, p) => {
      const r = lerp(o.r0, o.r1, easeOut(p));
      b.circle(x, y, r, o.color, tailFade(p, 1 - (o.hold ?? 0.35)), o.squash ?? 1, o.thick ?? 1);
    },
  });
}

/** Solid wash over a rectangle that dithers away. */
/** Same colour with a real alpha channel (for large, soft tints). */
export const withAlpha = (c: number, a: number): number => (((Math.round(Math.max(0, Math.min(1, a)) * 255) & 255) << 24) | (c & 0x00ffffff)) >>> 0;

export function wash(
  e: VfxEngine,
  x: number,
  y: number,
  w: number,
  h: number,
  o: { color: number; dur: number; alpha?: number; delay?: number; layer?: 0 | 1; attack?: number; soft?: boolean },
): void {
  e.add({
    delay: o.delay,
    dur: o.dur,
    layer: o.layer ?? 0,
    draw: (b, p) => {
      const atk = o.attack ?? 0.15;
      const env = p < atk ? p / atk : 1 - (p - atk) / (1 - atk);
      const a = (o.alpha ?? 0.5) * env;
      // small areas dither (pixel look); whole-board tints use real translucency so they stay calm
      if (o.soft) b.rect(x, y, w, h, withAlpha(o.color, a), 1);
      else b.rect(x, y, w, h, o.color, a);
    },
  });
}

export function squareWash(e: VfxEngine, sq: number, o: { color: number; dur: number; alpha?: number; delay?: number; layer?: 0 | 1 }): void {
  const p = e.sq(sq);
  // keep square tints translucent so they read as light on the board, not as a block
  wash(e, p.x + 1, p.y + 1, SQ - 2, SQ - 2, { ...o, alpha: Math.min(o.alpha ?? 0.5, 0.42) });
}

export function boardWash(e: VfxEngine, o: { color: number; dur: number; alpha?: number; delay?: number }): void {
  const r = e.boardRect();
  wash(e, r.x, r.y, r.w, r.h, { ...o, layer: 0, soft: true, alpha: Math.min(o.alpha ?? 0.4, 0.45) });
}

/** A pillar of light falling onto a point (holy light, teleports, promotions). */
export function pillar(
  e: VfxEngine,
  x: number,
  yBottom: number,
  o: { w: number; h: number; ramp: readonly number[]; dur: number; delay?: number },
): void {
  e.add({
    delay: o.delay,
    dur: o.dur,
    layer: 1,
    draw: (b, p) => {
      const grow = p < 0.18 ? p / 0.18 : p > 0.7 ? Math.max(0, 1 - (p - 0.7) / 0.3) : 1;
      const half = Math.max(0.5, (o.w / 2) * grow);
      const top = yBottom - o.h * Math.min(1, p * 4);
      for (let yy = Math.floor(top); yy <= yBottom; yy++) {
        const vy = (yBottom - yy) / o.h; // 0 at bottom → 1 at top
        const fade = 1 - vy * 0.85;
        for (let xx = Math.floor(x - half); xx <= Math.ceil(x + half); xx++) {
          const d = Math.abs(xx + 0.5 - x) / half;
          if (d > 1) continue;
          const idx = d < 0.3 ? 0 : d < 0.65 ? 1 : 2;
          b.dot(xx, yy, o.ramp[Math.min(o.ramp.length - 1, idx)], fade * (d < 0.65 ? 1 : 0.55) * grow);
        }
      }
      // floor glow
      b.disc(x, yBottom, half * 1.6, o.ramp[Math.min(o.ramp.length - 1, 2)], 0.6 * grow, 0.35, (d) => 1 - d);
    },
  });
}

/** Jagged lightning between two points, re-rolled every few frames. */
export function bolt(
  e: VfxEngine,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  o: { dur: number; core?: number; glow?: number; jitter?: number; segments?: number; delay?: number; forks?: number },
): void {
  const segs = o.segments ?? 7;
  const jit = o.jitter ?? 4;
  let seed = -1;
  let pts: XY[] = [];
  let forks: XY[][] = [];
  e.add({
    delay: o.delay,
    dur: o.dur,
    layer: 1,
    draw: (b, p, ms) => {
      const s = Math.floor(ms / 50);
      if (s !== seed) {
        seed = s;
        pts = [];
        for (let i = 0; i <= segs; i++) {
          const t = i / segs;
          const off = i === 0 || i === segs ? 0 : rand(-jit, jit);
          const nx = -(y1 - y0);
          const ny = x1 - x0;
          const len = Math.hypot(nx, ny) || 1;
          pts.push({ x: lerp(x0, x1, t) + (nx / len) * off, y: lerp(y0, y1, t) + (ny / len) * off });
        }
        forks = [];
        for (let f = 0; f < (o.forks ?? 1); f++) {
          const at = pts[irand(1, Math.max(1, segs - 2))];
          const ang = Math.atan2(y1 - y0, x1 - x0) + rand(-1.1, 1.1);
          const l = rand(5, 10);
          forks.push([at, { x: at.x + Math.cos(ang) * l, y: at.y + Math.sin(ang) * l }]);
        }
      }
      const a = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      const glow = o.glow ?? PX.sky;
      const core = o.core ?? PX.white;
      for (let i = 0; i < pts.length - 1; i++) {
        b.line(pts[i].x + 1, pts[i].y, pts[i + 1].x + 1, pts[i + 1].y, glow, a * 0.6);
        b.line(pts[i].x - 1, pts[i].y, pts[i + 1].x - 1, pts[i + 1].y, glow, a * 0.6);
      }
      for (const f of forks) b.line(f[0].x, f[0].y, f[1].x, f[1].y, glow, a);
      for (let i = 0; i < pts.length - 1; i++) b.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, core, a);
    },
  });
}

/** Straight tracer line that snaps in and fades (shots, magnet pulls). */
export function tracer(e: VfxEngine, a: XY, b2: XY, o: { color: number; dur: number; delay?: number; thick?: number; grow?: number }): void {
  e.add({
    delay: o.delay,
    dur: o.dur,
    layer: 1,
    draw: (b, p) => {
      const g = Math.min(1, p / (o.grow ?? 0.25));
      b.line(a.x, a.y, lerp(a.x, b2.x, g), lerp(a.y, b2.y, g), o.color, tailFade(p, 0.5), o.thick ?? 1);
    },
  });
}

export interface ProjectileOpts {
  dur: number;
  delay?: number;
  /** Arc height (art px); negative arcs upward. */
  arc?: number;
  /** Draws the head at (x, y). */
  head: (b: PixelBuffer, x: number, y: number, p: number) => void;
  /** Trail particles emitted every frame. */
  trail?: { ramp: readonly number[]; rate: number; speed?: [number, number]; life?: [number, number]; size?: [number, number]; gravity?: number };
  onHit?: () => void;
}

/** Something flying from `from` to `to` along a (possibly arched) path. */
export function projectile(e: VfxEngine, from: XY, to: XY, o: ProjectileOpts): void {
  let lastMs = 0;
  e.add({
    delay: o.delay,
    dur: o.dur,
    layer: 1,
    draw: (b, p, ms) => {
      const t = easeIn(p) * 0.35 + p * 0.65;
      const x = lerp(from.x, to.x, t);
      const y = lerp(from.y, to.y, t) - (o.arc ?? 0) * 4 * t * (1 - t);
      if (o.trail && !e.reduced) {
        const dt = ms - lastMs;
        lastMs = ms;
        const n = Math.max(1, Math.round((o.trail.rate * dt) / 1000));
        burst(e, x, y, {
          n,
          ramp: o.trail.ramp,
          speed: o.trail.speed ?? [2, 10],
          life: o.trail.life ?? [160, 320],
          size: o.trail.size ?? [1, 2],
          gravity: o.trail.gravity ?? -12,
          spread: 1.5,
        });
      }
      o.head(b, x, y, p);
    },
    done: o.onHit,
  });
}

/** A sprite that pops in (2× → 1×), holds and dithers away, optionally rising. */
export function stamp(
  e: VfxEngine,
  spr: PackedSprite,
  x: number,
  y: number,
  o: { dur: number; delay?: number; pop?: boolean; rise?: number; tint?: number; layer?: 0 | 1 },
): void {
  e.add({
    delay: o.delay,
    dur: o.dur,
    layer: o.layer ?? 1,
    draw: (b, p, ms) => {
      const yy = y - (o.rise ?? 0) * easeOut(p);
      const a = tailFade(p, 0.35);
      if (o.pop !== false && ms < 70 && !e.reduced) b.spriteScaled(spr, x - spr.w, yy - spr.h, 2, a, ms < 35 ? PX.white : o.tint);
      else b.sprite(spr, x - spr.w / 2, yy - spr.h / 2, a, o.tint);
    },
  });
}

/** Particles orbiting a point and spiralling in (or out). */
export function swirl(
  e: VfxEngine,
  x: number,
  y: number,
  o: { n: number; r0: number; r1: number; dur: number; ramp: readonly number[]; spin?: number; delay?: number; squash?: number; size?: number },
): void {
  const n = e.reduced ? Math.ceil(o.n / 3) : o.n;
  const seeds = Array.from({ length: n }, () => ({ a: rand(0, Math.PI * 2), k: rand(0.75, 1.25), c: irand(0, o.ramp.length - 1) }));
  e.add({
    delay: o.delay,
    dur: o.dur,
    layer: 1,
    draw: (b, p) => {
      const r = lerp(o.r0, o.r1, easeInOut(p));
      const a = tailFade(p, 0.3);
      for (const s of seeds) {
        const ang = s.a + (o.spin ?? 7) * p * s.k;
        const px = x + Math.cos(ang) * r * s.k;
        const py = y + Math.sin(ang) * r * s.k * (o.squash ?? 1);
        b.rect(Math.round(px), Math.round(py), o.size ?? 1, o.size ?? 1, o.ramp[s.c], a);
      }
    },
  });
}

/** A stream of motes travelling from A to B (mana flowing into crystals…). */
export function flow(
  e: VfxEngine,
  from: XY,
  to: XY,
  o: { n: number; ramp: readonly number[]; dur: number; delay?: number; spread?: number; bend?: number; stagger?: number; onArrive?: () => void },
): void {
  const n = e.reduced ? Math.ceil(o.n / 3) : o.n;
  const motes = Array.from({ length: n }, () => ({
    ox: rand(-(o.spread ?? 6), o.spread ?? 6),
    oy: rand(-(o.spread ?? 6), o.spread ?? 6),
    bend: rand(-1, 1) * (o.bend ?? 18),
    lag: rand(0, o.stagger ?? 0.35),
    c: irand(0, Math.min(2, o.ramp.length - 1)),
  }));
  e.add({
    delay: o.delay,
    dur: o.dur,
    layer: 1,
    draw: (b, p) => {
      for (const m of motes) {
        const t = Math.min(1, Math.max(0, (p - m.lag) / (1 - m.lag)));
        if (t <= 0 || t >= 1) continue;
        const tt = easeInOut(t);
        const sx = from.x + m.ox;
        const sy = from.y + m.oy;
        const mx = (sx + to.x) / 2 + m.bend;
        const my = (sy + to.y) / 2 - Math.abs(m.bend) * 0.8;
        const x = (1 - tt) * (1 - tt) * sx + 2 * (1 - tt) * tt * mx + tt * tt * to.x;
        const y = (1 - tt) * (1 - tt) * sy + 2 * (1 - tt) * tt * my + tt * tt * to.y;
        b.rect(Math.round(x), Math.round(y), 1, 1, o.ramp[m.c]);
        b.dot(Math.round(x - (to.x - sx) * 0.02), Math.round(y - (to.y - sy) * 0.02), o.ramp[Math.min(o.ramp.length - 1, m.c + 2)], 0.6);
      }
    },
    done: o.onArrive,
  });
}

/** Horizontal/vertical streaks sweeping an area (wind, quake, time scans). */
export function streaks(
  e: VfxEngine,
  area: { x: number; y: number; w: number; h: number },
  o: { n: number; ramp: readonly number[]; dir: XY; speed: number; len: number; dur: number; delay?: number },
): void {
  const n = e.reduced ? Math.ceil(o.n / 3) : o.n;
  const lines = Array.from({ length: n }, () => ({ x: rand(0, area.w), y: rand(0, area.h), lag: rand(0, 0.4), c: irand(0, o.ramp.length - 1) }));
  e.add({
    delay: o.delay,
    dur: o.dur,
    layer: 1,
    draw: (b, p) => {
      for (const l of lines) {
        const t = (p - l.lag) / (1 - l.lag);
        if (t <= 0 || t >= 1) continue;
        const d = t * o.speed;
        const x = area.x + ((l.x + o.dir.x * d) % area.w + area.w) % area.w;
        const y = area.y + ((l.y + o.dir.y * d) % area.h + area.h) % area.h;
        b.line(x, y, x - o.dir.x * o.len, y - o.dir.y * o.len, o.ramp[l.c], tailFade(t, 0.4));
      }
    },
  });
}

// ── Pieces ───────────────────────────────────────────────────────────────────

export type BreakStyle = 'shatter' | 'burn' | 'dissolve' | 'crush' | 'slash' | 'drain' | 'blink' | 'freeze' | 'cleave' | 'glass';

/** Where a piece sprite sits inside its square (bottom-aligned, like the DOM pieces). */
export const spriteOrigin = (e: VfxEngine, sq: number, spr: PackedSprite): XY => {
  const p = e.sq(sq);
  return { x: p.x + Math.floor((SQ - spr.w) / 2), y: p.y + SQ - spr.h };
};

/**
 * A piece that has already left the board state: drawn where it stood until
 * `breakAt`, then taken apart in the given style.
 */
export function ghost(
  e: VfxEngine,
  spr: PackedSprite,
  sq: number,
  o: { breakAt: number; style: BreakStyle; from?: XY; translucent?: boolean; onBreak?: () => void },
): void {
  const at = spriteOrigin(e, sq, spr);
  const alpha = o.translucent ? 0.55 : 1;
  e.add({
    dur: o.breakAt,
    layer: 0,
    draw: (b, _p, ms) => {
      const flash = o.breakAt - ms < 70 && Math.floor(ms / 35) % 2 === 0;
      b.sprite(spr, at.x, at.y, alpha, flash ? PX.white : undefined);
    },
    done: () => {
      breakSprite(e, spr, at, o.style, o.from);
      o.onBreak?.();
    },
  });
}

/**
 * A clean cut (a scythe, a sword): the part above the blade's line slides off along it and
 * drops, the rest stands for a beat and then crumbles. `from` is where the blow came from.
 */
function cleave(e: VfxEngine, spr: PackedSprite, at: XY, from?: XY): void {
  // piece sprites are bottom-aligned; cut through the body, a little below the middle
  let top = spr.h;
  for (let i = 0; i < spr.px.length && top === spr.h; i++) if (spr.px[i]) top = Math.floor(i / spr.w);
  const cx = at.x + spr.w / 2;
  const cy = at.y + top + (spr.h - top) * 0.52;
  const dir = from ? Math.sign(cx - from.x) || 1 : 1;
  const slope = 0.55 * dir;
  const upper: PackedSprite = { w: spr.w, h: spr.h, px: new Uint32Array(spr.px.length) };
  const lower: PackedSprite = { w: spr.w, h: spr.h, px: new Uint32Array(spr.px.length) };
  for (let y = 0; y < spr.h; y++) {
    for (let x = 0; x < spr.w; x++) {
      const i = y * spr.w + x;
      const c = spr.px[i];
      if (!c) continue;
      if (at.y + y < cy + (at.x + x - cx) * slope) upper.px[i] = c;
      else lower.px[i] = c;
    }
  }
  // the line of the cut flashes
  e.add({
    dur: 120,
    layer: 1,
    draw: (b, p) => {
      const a = 1 - p;
      b.line(cx - 10, cy - 10 * slope, cx + 10, cy + 10 * slope, PX.white, a);
      b.line(cx - 7, cy - 7 * slope + 1, cx + 7, cy + 7 * slope + 1, PX.red, a * 0.7);
    },
  });
  // the severed top slides down the blade's line and drops away
  e.add({
    dur: 540,
    layer: 0,
    draw: (b, p, ms) => {
      const t = ms / 1000;
      const dx = dir * 30 * t;
      const dy = Math.abs(slope) * 30 * t + 130 * t * t;
      b.sprite(upper, at.x + dx, at.y + dy, p < 0.4 ? 1 : 1 - (p - 0.4) / 0.6);
    },
  });
  // the rest stands for a heartbeat, then falls to dust
  e.add({
    dur: 180,
    layer: 0,
    draw: (b) => b.sprite(lower, at.x, at.y),
    done: () => breakSprite(e, lower, at, 'crush'),
  });
  const fwd = dir > 0 ? 0 : Math.PI;
  burst(e, cx, cy, { n: 12, ramp: RAMP.spark, speed: [50, 110], life: [120, 260], shape: 2, drag: 3, angle: [fwd - 0.7, fwd + 0.7] });
  burst(e, cx, cy, { n: 10, ramp: RAMP.blood, speed: [20, 60], life: [260, 520], gravity: 220, floor: at.y + spr.h + 1, angle: [fwd - 0.9, fwd + 0.3 * dir] });
}

// ── Glass („Üvegátok”) ─────────────────────────────────────────────────────────

const glassCache = new WeakMap<PackedSprite, PackedSprite>();

/**
 * The piece as if it were made of glass: the outline turns into a dark-blue rim and every inner
 * pixel takes a pale ice colour by its brightness (stretched, so dark pieces become glass too).
 */
export function glassify(spr: PackedSprite): PackedSprite {
  const hit = glassCache.get(spr);
  if (hit) return hit;
  const G = RAMP.glass;
  const px = new Uint32Array(spr.px.length);
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < spr.w && y < spr.h && spr.px[y * spr.w + x] !== 0;
  const lum = (c: number) => (0.3 * (c & 255) + 0.59 * ((c >> 8) & 255) + 0.11 * ((c >> 16) & 255)) / 255;
  let lo = 1;
  let hi = 0;
  const inner: number[] = [];
  for (let y = 0; y < spr.h; y++) {
    for (let x = 0; x < spr.w; x++) {
      const i = y * spr.w + x;
      if (!spr.px[i]) continue;
      if (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)) {
        px[i] = G[G.length - 1];
        continue;
      }
      inner.push(i);
      const l = lum(spr.px[i]);
      lo = Math.min(lo, l);
      hi = Math.max(hi, l);
    }
  }
  const span = Math.max(0.05, hi - lo);
  for (const i of inner) {
    const k = (lum(spr.px[i]) - lo) / span; // 1 = brightest
    px[i] = G[Math.min(G.length - 2, Math.floor((1 - k) * (G.length - 1)))];
  }
  const out = { w: spr.w, h: spr.h, px };
  glassCache.set(spr, out);
  return out;
}

/** Jagged cracks from a point: pixel offsets (sprite coordinates), in the order they appear. */
function crackPixels(spr: PackedSprite): { x: number; y: number }[] {
  let top = spr.h;
  for (let i = 0; i < spr.px.length && top === spr.h; i++) if (spr.px[i]) top = Math.floor(i / spr.w);
  const ox = spr.w / 2 + rand(-1.5, 1.5);
  const oy = top + (spr.h - top) * 0.45;
  const out: { x: number; y: number }[] = [];
  const seen = new Set<number>();
  const arms = 5;
  for (let a = 0; a < arms; a++) {
    let ang = (a / arms) * Math.PI * 2 + rand(-0.4, 0.4);
    let x = ox;
    let y = oy;
    for (let step = 0; step < 14; step++) {
      ang += rand(-0.5, 0.5);
      x += Math.cos(ang);
      y += Math.sin(ang) * 1.2;
      const ix = Math.round(x);
      const iy = Math.round(y);
      if (ix < 0 || iy < 0 || ix >= spr.w || iy >= spr.h || !spr.px[iy * spr.w + ix]) break;
      const k = iy * spr.w + ix;
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ x: ix, y: iy });
      }
    }
  }
  // interleave the arms so they all grow at once
  return out.sort((p, q) => Math.hypot(p.x - ox, p.y - oy) - Math.hypot(q.x - ox, q.y - oy));
}

/**
 * A glass piece breaks: it is split into a dozen irregular shards (sprites of its own glass
 * pixels) that fly apart, bounce on the board and fade, with glints and the curse leaving.
 */
function shatterGlass(e: VfxEngine, spr: PackedSprite, at: XY, from?: XY): void {
  const glass = glassify(spr);
  const cx = at.x + spr.w / 2;
  const cy = at.y + spr.h / 2;
  const floor = at.y + spr.h;
  const pixels: number[] = [];
  for (let i = 0; i < glass.px.length; i++) if (glass.px[i]) pixels.push(i);
  if (!pixels.length) return;
  const n = e.reduced ? 5 : 12;
  const seeds = Array.from({ length: n }, () => {
    const i = pixels[irand(0, pixels.length - 1)];
    return { x: i % spr.w, y: Math.floor(i / spr.w) };
  });
  const groups = seeds.map(() => [] as number[]);
  for (const i of pixels) {
    const x = i % spr.w;
    const y = Math.floor(i / spr.w);
    let best = 0;
    let bd = Infinity;
    seeds.forEach((s, k) => {
      const d = (s.x - x) ** 2 + (s.y - y) ** 2 * 0.8 + rand(0, 3); // a little noise → jagged edges
      if (d < bd) {
        bd = d;
        best = k;
      }
    });
    groups[best].push(i);
  }
  const dirX = from ? Math.sign(cx - from.x) : 0;
  for (const g of groups) {
    if (!g.length) continue;
    let x0 = spr.w;
    let y0 = spr.h;
    let x1 = 0;
    let y1 = 0;
    for (const i of g) {
      const x = i % spr.w;
      const y = Math.floor(i / spr.w);
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const px = new Uint32Array(w * h);
    for (const i of g) px[(Math.floor(i / spr.w) - y0) * w + (i % spr.w) - x0] = glass.px[i];
    const sx = at.x + x0 + w / 2;
    const sy = at.y + y0 + h / 2;
    const rx = sx - cx;
    const ry = sy - cy;
    e.spawn({
      x: sx, y: sy, vx: rx * rand(3, 7) + dirX * rand(8, 24) + rand(-10, 10), vy: ry * rand(2, 4) - rand(45, 90),
      ax: 0, ay: 420, drag: 0.4, life: rand(620, 980), age: -rand(0, 30), size: 1, ramp: [0], fade: true, shape: 3,
      spr: { w, h, px }, floor: floor - h / 2 + rand(-1, 2),
    });
  }
  burst(e, cx, cy, { n: 16, ramp: [PX.white, RAMP.glass[1], RAMP.glass[3]], speed: [60, 140], life: [120, 260], shape: 2, drag: 3 });
  burst(e, cx, cy, { n: 18, ramp: [PX.white, RAMP.glass[1], RAMP.glass[2]], speed: [20, 70], life: [380, 700], gravity: 300, floor, flicker: 0.25 });
  burst(e, cx, cy - 2, { n: 10, ramp: RAMP.arcane.slice(1), speed: [6, 18], life: [420, 760], gravity: -26, delay: [40, 160] });
  ring(e, cx, cy, { r0: 3, r1: 18, dur: 260, color: PX.white });
}

/**
 * „Üvegátok”: the cursed piece that has already left the board state. It glides (or leaps)
 * from `from` to `to` as glass, stands there while cracks run through it, then shatters.
 */
export function glassGhost(
  e: VfxEngine,
  spr: PackedSprite,
  o: { from: number; to: number; travel: number; leap?: boolean; crackAt: number; breakAt: number; delay?: number },
): void {
  const glass = glassify(spr);
  const a = spriteOrigin(e, o.from, spr);
  const b = spriteOrigin(e, o.to, spr);
  const cracks = crackPixels(spr);
  const arc = o.leap ? 7 : o.travel > 0 ? 2 : 0;
  e.add({
    delay: o.delay,
    dur: o.breakAt,
    layer: 0,
    draw: (buf, _p, ms) => {
      const t = o.travel > 0 ? Math.min(1, ms / o.travel) : 1;
      const k = o.leap ? t : 1 - (1 - t) ** 3;
      const x = a.x + (b.x - a.x) * k;
      const y = a.y + (b.y - a.y) * k - Math.sin(Math.PI * t) * arc;
      buf.sprite(glass, x, y);
      if (ms < o.crackAt) return;
      // cracks spread from the heart of the piece: white edges with a violet (curse) core
      const grow = Math.min(1, (ms - o.crackAt) / Math.max(1, o.breakAt - o.crackAt - 60));
      const shown = Math.ceil(cracks.length * grow);
      for (let i = 0; i < shown; i++) {
        const c = cracks[i];
        buf.dot(Math.round(x) + c.x, Math.round(y) + c.y, i % 3 === 0 ? RAMP.arcane[1] : PX.white);
      }
      // the last instant: the whole piece flashes
      if (o.breakAt - ms < 60) buf.sprite(glass, x, y, 0.7, PX.white);
    },
    done: () => shatterGlass(e, spr, b, e.c(o.from)),
  });
}

/** Turns every opaque pixel of a sprite into a particle. */
export function breakSprite(e: VfxEngine, spr: PackedSprite, at: XY, style: BreakStyle, from?: XY): void {
  if (style === 'cleave') {
    cleave(e, spr, at, from);
    return;
  }
  if (style === 'glass') {
    shatterGlass(e, spr, at, from);
    return;
  }
  const cx = at.x + spr.w / 2;
  const cy = at.y + spr.h / 2;
  const floor = at.y + spr.h + 1;
  const dirX = from ? Math.sign(cx - from.x) || rand(-1, 1) : 0;
  const dirY = from ? Math.sign(cy - from.y) : 0;
  const step = e.reduced ? 2 : 1;
  for (let y = 0; y < spr.h; y += step) {
    for (let x = 0; x < spr.w; x += step) {
      const c = spr.px[y * spr.w + x];
      if (!c) continue;
      const px = at.x + x;
      const py = at.y + y;
      const rx = px - cx;
      const ry = py - cy;
      let p: Particle;
      const base = { x: px, y: py, ax: 0, drag: 0, age: 0, size: 1, fade: true, shape: 0 as const };
      switch (style) {
        case 'burn':
          p = { ...base, vx: rand(-8, 8) + rx * 0.6, vy: rand(-26, -8), ay: -18, life: rand(260, 620), ramp: [c, ...RAMP.ember], flicker: 0.1, age: -rand(0, (spr.h - y) * 14) };
          break;
        case 'dissolve':
          p = { ...base, vx: rand(-4, 4), vy: rand(-18, -6), ay: -6, life: rand(380, 760), ramp: [c, ...RAMP.holy.slice(2)], age: -y * 10 - rand(0, 80), flicker: 0.12 };
          break;
        case 'drain':
          p = { ...base, vx: -rx * 1.5, vy: -ry * 1.5 - 10, ay: -30, drag: 2, life: rand(300, 520), ramp: [c, ...RAMP.blood.slice(0, 2)], age: -rand(0, 100) };
          break;
        case 'crush':
          p = { ...base, vx: rand(-14, 14), vy: rand(0, 20), ay: 380, life: rand(420, 700), ramp: [c, c, ...RAMP.shadow.slice(1)], floor, age: -rand(0, 40) };
          break;
        case 'slash': {
          const side = x + y < (spr.w + spr.h) / 2 ? -1 : 1;
          p = { ...base, vx: side * rand(18, 40), vy: side * rand(-26, -6) - 10, ay: 260, life: rand(380, 640), ramp: [c, c, ...RAMP.blood.slice(1)], floor };
          break;
        }
        case 'blink':
          p = { ...base, vx: rx * 3, vy: ry * 3, ay: 0, drag: 5, life: rand(150, 300), ramp: [PX.white, c, ...RAMP.teal.slice(1, 3)], age: -rand(0, 60) };
          break;
        case 'freeze':
          p = { ...base, vx: rand(-30, 30), vy: rand(-50, -10), ay: 300, life: rand(360, 620), ramp: [PX.ice, c, ...RAMP.ice.slice(2)], floor };
          break;
        default:
          p = {
            ...base,
            vx: rx * rand(2.5, 6) + dirX * rand(15, 45),
            vy: ry * rand(1.5, 4) - rand(30, 70) + dirY * 10,
            ay: 320,
            life: rand(380, 700),
            ramp: [c, c, c, ...RAMP.shadow.slice(0, 2)],
            floor: floor + rand(-2, 3),
          };
      }
      e.spawn(p);
    }
  }
  if (style === 'shatter' || style === 'slash' || style === 'crush') {
    burst(e, cx, cy, { n: 10, ramp: RAMP.spark, speed: [40, 90], life: [120, 240], shape: 2, drag: 3 });
  }
}

/** Draws a dithered rune circle (magic glyph) on the floor of a square. */
export function glyphCircle(e: VfxEngine, sq: number, o: { color: number; dur: number; delay?: number; r?: number }): void {
  const c = e.c(sq);
  const cy = c.y + 6;
  const r = o.r ?? 9;
  e.add({
    delay: o.delay,
    dur: o.dur,
    layer: 0,
    draw: (b, p, ms) => {
      const env = p < 0.2 ? p / 0.2 : tailFade(p, 0.4);
      const rr = r * (0.6 + 0.4 * easeOut(Math.min(1, p * 3)));
      b.circle(c.x, cy, rr, o.color, env, 0.4);
      b.circle(c.x, cy, rr - 3, o.color, env * 0.6, 0.4);
      // rotating tick marks
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + ms / 400;
        const x = c.x + Math.cos(a) * (rr - 1.5);
        const y = cy + Math.sin(a) * (rr - 1.5) * 0.4;
        if (passes(Math.round(x), Math.round(y), env)) b.dot(x, y, PX.white);
      }
    },
  });
}
