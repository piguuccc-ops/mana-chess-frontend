// ─────────────────────────────────────────────────────────────────────────────
// „Végítélet”: the Reaper. A chess-piece reaper climbs out of the floor of the
// caster's half, glides from victim to victim (nearest first – the order the
// engine reports) and cuts each one down with a swing of its scythe, then
// dissolves into smoke. The timeline depends only on the squares, so the
// choreographer can time every cut and every blocked blow from it.
// ─────────────────────────────────────────────────────────────────────────────
import type { Square } from '../../engine';
import { sfx, type SfxName } from '../audio/sound';
import { REAPER_GRIP } from '../pixel/art/reaper';
import { pack, type PixelBuffer } from './buffer';
import { SQ, type VfxEngine, type XY } from './engine';
import { burst, easeInOut, easeOut, ghost, lerp, ring, smoke, wash } from './fx';
import { PX, RAMP } from './palettes';
import type { SpellCtx } from './spells';
import { haloOf, pieceSpr, reaperSpr } from './sprites';

/** Phase lengths (ms). */
const RISE = 440;
const FIRST = 150;
const WIND = 110;
const STRIKE = 95;
const FOLLOW = 70;
const RECOVER = 170;
const LINGER = 260;
const VANISH = 380;

/** Scythe angles (radians from upright, positive = towards the victim). */
const IDLE = -0.22;
const RAISED = -1.05;
const SWUNG = 2.1;

/** The swing reaches the victim at this fraction of the strike. */
const HIT_AT = 0.8;
/** Grip-to-victim distance (art px): the blade passes through the piece. */
const REACH = 13;

const SNATH_UP = 16;
const SNATH_DOWN = 9;
const BLADE = 13;
const CURVE = 5;

const WOOD = pack('#77503a');
const WOOD_DARK = pack('#3d2a1f');
const WOOD_LIGHT = pack('#98693f');
const STEEL_DARK = pack('#524e58');
const EDGE_DARK = pack('#140d0b');
const STEEL = pack('#a6a1aa');
const STEEL_LIGHT = pack('#e8e4ea');
const IRON = pack('#77727d');
const BONE = pack('#e6d3ac');
const BONE_DARK = pack('#a08664');
const HALO = pack('#b184dc', 0.55);
const TRAIL = pack('#4f2a78');
const ZONE = pack('#7d1f22');

export interface ReaperVisit {
  sq: Square;
  moveAt: number;
  moveDur: number;
  windAt: number;
  strikeAt: number;
  hitAt: number;
}

export interface ReaperTimeline {
  visits: ReaperVisit[];
  vanishAt: number;
  end: number;
}

/** All times in ms after the spell's impact. */
export function reaperTimeline(squares: readonly Square[]): ReaperTimeline {
  const visits: ReaperVisit[] = [];
  let t = RISE + FIRST;
  squares.forEach((sq, i) => {
    const moveAt = t;
    let moveDur = 0;
    if (i > 0) {
      const p = squares[i - 1];
      const d = Math.hypot((sq % 8) - (p % 8), Math.floor(sq / 8) - Math.floor(p / 8));
      moveDur = Math.round(Math.min(280, Math.max(150, 80 + 60 * d)));
      t += moveDur;
    }
    const windAt = t;
    t += WIND;
    const strikeAt = t;
    const hitAt = t + Math.round(STRIKE * HIT_AT);
    t += STRIKE + FOLLOW;
    visits.push({ sq, moveAt, moveDur, windAt, strikeAt, hitAt });
  });
  const vanishAt = t + LINGER;
  return { visits, vanishAt, end: vanishAt + VANISH };
}

/** When the scythe reaches a square (ms after impact); 0 if the Reaper never goes there. */
export const reaperHit = (squares: readonly Square[], sq: Square): number => reaperTimeline(squares).visits.find((v) => v.sq === sq)?.hitAt ?? 0;

interface Stand {
  grip: XY;
  floor: number;
  dir: 1 | -1;
}

interface Pose {
  x: number;
  y: number;
  floor: number;
  dir: 1 | -1;
  theta: number;
  alpha: number;
  /** 0 = still under the floor, 1 = fully risen. */
  risen: number;
  moving: boolean;
}

/** Where the Reaper stands for each victim: beside it, on the side it comes from. */
function stands(e: VfxEngine, tl: ReaperTimeline): Stand[] {
  const board = e.boardRect();
  const out: Stand[] = [];
  let prev: Stand | null = null;
  for (const v of tl.visits) {
    const c = e.c(v.sq);
    let dir: 1 | -1;
    if (!prev) dir = c.x < board.x + board.w / 2 ? -1 : 1;
    else if (Math.abs(prev.grip.x - c.x) < 1) dir = prev.dir;
    else dir = prev.grip.x < c.x ? 1 : -1;
    const s: Stand = { grip: { x: c.x - REACH * dir, y: c.y + 0.5 }, floor: c.y + SQ / 2, dir };
    out.push(s);
    prev = s;
  }
  return out;
}

function poseAt(ms: number, tl: ReaperTimeline, st: Stand[]): Pose {
  const first = st[0];
  const pose: Pose = { x: first.grip.x, y: first.grip.y, floor: first.floor, dir: first.dir, theta: IDLE, alpha: 1, risen: 1, moving: false };
  if (ms < RISE) {
    pose.risen = easeOut(Math.max(0, ms / RISE));
    return pose;
  }
  let lastStrikeEnd = -Infinity;
  for (let i = 0; i < tl.visits.length; i++) {
    const v = tl.visits[i];
    const s = st[i];
    if (ms < v.moveAt) break;
    // gliding over from the previous victim
    if (i > 0 && ms < v.moveAt + v.moveDur) {
      const a = st[i - 1];
      const k = easeInOut((ms - v.moveAt) / v.moveDur);
      pose.x = lerp(a.grip.x, s.grip.x, k);
      pose.y = lerp(a.grip.y, s.grip.y, k) - 4 * Math.sin(Math.PI * k);
      pose.floor = lerp(a.floor, s.floor, k);
      pose.dir = k < 0.5 ? a.dir : s.dir;
      pose.moving = true;
    } else {
      pose.x = s.grip.x;
      pose.y = s.grip.y;
      pose.floor = s.floor;
      pose.dir = s.dir;
    }
    pose.theta = IDLE;
    if (ms >= lastStrikeEnd && ms < lastStrikeEnd + RECOVER) pose.theta = lerp(SWUNG, IDLE, easeOut((ms - lastStrikeEnd) / RECOVER));
    if (ms >= v.windAt && ms < v.strikeAt) pose.theta = lerp(IDLE, RAISED, easeOut((ms - v.windAt) / WIND));
    if (ms >= v.strikeAt && ms < v.strikeAt + STRIKE) {
      const k = (ms - v.strikeAt) / STRIKE;
      pose.theta = lerp(RAISED, SWUNG, Math.pow(k, 1.5));
      pose.x += pose.dir; // leans into the blow
    }
    if (ms >= v.strikeAt + STRIKE) {
      lastStrikeEnd = v.strikeAt + STRIKE;
      pose.theta = ms < lastStrikeEnd + RECOVER ? lerp(SWUNG, IDLE, easeOut((ms - lastStrikeEnd) / RECOVER)) : IDLE;
    }
  }
  if (!pose.moving) pose.y += Math.round(Math.sin(ms / 150)) * 0.5;
  if (ms >= tl.vanishAt) {
    const k = Math.min(1, (ms - tl.vanishAt) / VANISH);
    pose.alpha = 1 - k;
    pose.y -= 7 * k;
  }
  return pose;
}

/** The scythe, rotated about the grip: a wooden snath and a curved steel blade. */
function drawScythe(b: PixelBuffer, g: XY, theta: number, dir: 1 | -1, alpha: number, below: number, ghostTint?: number): void {
  const ux = dir * Math.sin(theta);
  const uy = -Math.cos(theta);
  const vx = dir * Math.cos(theta);
  const vy = Math.sin(theta);
  const dot = (x: number, y: number, c: number) => {
    if (y < below) b.dot(x, y, ghostTint ?? c, alpha);
  };
  const top = { x: g.x + ux * SNATH_UP, y: g.y + uy * SNATH_UP };
  if (!ghostTint) {
    // snath: a dark back line and a lit front line
    const n = SNATH_UP + SNATH_DOWN;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = lerp(g.x - ux * SNATH_DOWN, top.x, t);
      const y = lerp(g.y - uy * SNATH_DOWN, top.y, t);
      dot(x, y, i % 5 === 0 ? WOOD_LIGHT : WOOD);
      dot(x - vx, y - vy, WOOD_DARK);
    }
    dot(top.x, top.y, IRON);
    dot(top.x - vx, top.y - vy, IRON);
  }
  // blade: a dark back, a steel spine along the curve and a bright cutting edge inside it
  for (let i = 0; i <= 30; i++) {
    const s = i / 30;
    const x = top.x + vx * BLADE * s - ux * CURVE * s * s;
    const y = top.y + vy * BLADE * s - uy * CURVE * s * s;
    if (!ghostTint && s < 0.92) dot(x + ux, y + uy, EDGE_DARK);
    dot(x, y, s > 0.9 ? STEEL_DARK : STEEL);
    if (s < 0.86) dot(x - ux, y - uy, s < 0.4 ? PX.white : STEEL_LIGHT);
  }
  if (!ghostTint) {
    // two bony hands on the snath
    for (const k of [0, -4]) {
      const hx = Math.round(g.x + ux * k);
      const hy = Math.round(g.y + uy * k);
      dot(hx, hy, BONE);
      dot(hx - dir, hy, BONE);
      dot(hx, hy + 1, BONE_DARK);
      dot(hx - dir, hy + 1, BONE_DARK);
    }
  }
}

function drawReaper(b: PixelBuffer, p: Pose, lag: Pose[]): void {
  const spr = reaperSpr();
  const halo = haloOf('reaper', spr, HALO);
  const origin = (q: Pose) => ({ x: Math.round(q.x - REAPER_GRIP.x - REAPER_GRIP.side * q.dir), y: Math.round(q.y - REAPER_GRIP.y + (1 - q.risen) * spr.h) });
  const o = origin(p);
  const below = Math.round(p.floor);
  const mask = (_sx: number, sy: number) => o.y + sy < below;
  // shadow on the floor
  if (p.alpha > 0.2) b.disc(p.x - REAPER_GRIP.side * p.dir, p.floor - 1, 7 * Math.max(0.3, p.risen), PX.shadow, 1, 0.3);
  // afterimages while gliding
  lag.forEach((q, i) => {
    const lo = origin(q);
    b.sprite(spr, lo.x, lo.y, (i === 0 ? 0.38 : 0.18) * p.alpha, TRAIL);
  });
  b.sprite(halo, o.x - 1, o.y - 1, p.alpha * 0.9, undefined, (_sx, sy) => o.y - 1 + sy < below);
  b.sprite(spr, o.x, o.y, p.alpha, undefined, mask);
  const grip = { x: Math.round(p.x), y: Math.round(p.y + (1 - p.risen) * spr.h) };
  drawScythe(b, grip, p.theta, p.dir, p.alpha, below);
}

const snd = (e: VfxEngine, name: SfxName, at: number) =>
  e.at(at, () => {
    if (!e.muted) sfx(name);
  });

/** The whole Végítélet performance. */
export function playReaper(e: VfxEngine, c: SpellCtx): void {
  const squares = c.squares.length ? c.squares : c.removed.map((r) => r.sq);
  if (!squares.length) return;
  const tl = reaperTimeline(squares);
  const st = stands(e, tl);
  const total = c.impact - c.start + tl.end;

  // the judged half of the board darkens and its border glows
  const zone = e.boardRect();
  const casterBottom = (c.caster === 'w') !== e.board.flipped;
  const half = { x: zone.x, y: casterBottom ? zone.y + zone.h / 2 : zone.y, w: zone.w, h: zone.h / 2 };
  wash(e, zone.x, zone.y, zone.w, zone.h, { color: pack('#140d0b'), dur: total, alpha: 0.32, delay: c.start, soft: true, attack: 0.08 });
  wash(e, half.x, half.y, half.w, half.h, { color: ZONE, dur: total, alpha: 0.22, delay: c.start, soft: true, attack: 0.1 });
  const edgeY = casterBottom ? half.y : half.y + half.h - 1;
  e.add({
    delay: c.start,
    dur: total,
    layer: 0,
    draw: (b, p, ms) => {
      const a = (p < 0.1 ? p / 0.1 : p > 0.88 ? (1 - p) / 0.12 : 1) * (0.75 + 0.25 * Math.sin(ms / 60));
      b.rect(zone.x, edgeY, zone.w, 1, PX.ember, a);
      b.rect(zone.x, edgeY + (casterBottom ? 1 : -1), zone.w, 1, PX.darkRed, a * 0.8);
    },
  });
  burst(e, zone.x + zone.w / 2, edgeY, { n: 26, ramp: RAMP.ember, speed: [6, 18], angle: [-Math.PI * 0.9, -Math.PI * 0.1], life: [400, 900], gravity: -20, box: { w: zone.w, h: 2 }, delay: [c.start, c.start + 500], flicker: 0.1 });

  // it climbs out of the floor
  const s0 = st[0];
  ring(e, s0.grip.x, s0.floor - 1, { r0: 2, r1: 12, dur: 520, color: pack('#4f2a78'), squash: 0.35, delay: c.impact - 80, thick: 2, layer: 0 });
  ring(e, s0.grip.x, s0.floor - 1, { r0: 1, r1: 9, dur: 440, color: PX.ember, squash: 0.35, delay: c.impact, layer: 0 });
  smoke(e, s0.grip.x, s0.floor - 2, 14, c.impact - 40, 7);
  burst(e, s0.grip.x, s0.floor - 2, { n: 18, ramp: RAMP.curse, speed: [8, 26], angle: [-Math.PI * 0.85, -Math.PI * 0.15], life: [400, 800], gravity: -26, box: { w: 14, h: 2 }, delay: [c.impact, c.impact + 300], flicker: 0.06 });
  snd(e, 'reaper', c.start + 40);

  e.add({
    delay: c.impact,
    dur: tl.end,
    layer: 1,
    draw: (b, _p, ms) => {
      const pose = poseAt(ms, tl, st);
      const lag = pose.moving ? [poseAt(ms - 45, tl, st), poseAt(ms - 90, tl, st)].filter((q) => q.moving || Math.hypot(q.x - pose.x, q.y - pose.y) > 2) : [];
      drawReaper(b, pose, lag);
      // motion smear of the blade during the swing
      for (const v of tl.visits) {
        if (ms < v.strikeAt || ms > v.strikeAt + STRIKE + 40) continue;
        const k = Math.min(1, (ms - v.strikeAt) / STRIKE);
        const th = lerp(RAISED, SWUNG, Math.pow(k, 1.5));
        const grip = { x: Math.round(pose.x), y: Math.round(pose.y) };
        for (let j = 1; j <= 3; j++) drawScythe(b, grip, th - j * 0.3, pose.dir, (0.55 - j * 0.14) * pose.alpha, 9999, j === 1 ? PX.white : PX.ice);
      }
    },
  });

  // the victims stand until the blade reaches them
  const standOf = new Map(tl.visits.map((v, i) => [v.sq, st[i]]));
  for (const r of c.removed) {
    const v = tl.visits.find((x) => x.sq === r.sq);
    const s = standOf.get(r.sq);
    const hit = c.impact + (v?.hitAt ?? 0);
    ghost(e, pieceSpr(r.piece.type, r.piece.color), r.sq, { breakAt: hit, style: 'cleave', from: s?.grip, translucent: r.piece.clone });
  }
  tl.visits.forEach((v, i) => {
    const s = st[i];
    const hit = c.impact + v.hitAt;
    // a crescent of light follows the blade through the piece
    e.add({
      delay: hit - 20,
      dur: 190,
      layer: 1,
      draw: (b, p) => {
        // the blade sweeps a ring about 15 px around the grip; the light trails behind it
        const a = 1 - p;
        for (let f = -0.85; f <= 0.85; f += 0.03) {
          const phi = 1.1 + f;
          for (const [r, col, k] of [
            [16, PX.white, 1],
            [15, PX.white, 0.8],
            [17, PX.ice, 0.7],
            [13, PX.red, 0.55],
          ] as const) {
            const fade = a * k * (f < -0.25 ? (f + 0.85) / 0.6 : 1);
            b.dot(s.grip.x + s.dir * Math.sin(phi) * r, s.grip.y - Math.cos(phi) * r, col, fade);
          }
        }
      },
    });
    snd(e, 'scythe', hit - 55);
    e.at(hit, () => e.shake(1, 110));
  });

  // and sinks back into the dark
  const last = st[st.length - 1];
  const gone = c.impact + tl.vanishAt;
  smoke(e, last.grip.x, last.grip.y - 4, 16, gone + 60, 8);
  burst(e, last.grip.x, last.grip.y - 6, { n: 22, ramp: RAMP.arcane, speed: [10, 30], angle: [-Math.PI * 0.9, -Math.PI * 0.1], life: [420, 820], gravity: -30, box: { w: 14, h: 20 }, delay: [gone, gone + 280], flicker: 0.08 });
  snd(e, 'wind', gone);
}
