// ─────────────────────────────────────────────────────────────────────────────
// Spell effects. Every spell has its own composition that matches what the
// spell actually does (fire burns, ice freezes, time runs backwards…), plus the
// timing the board uses to move, reveal or break pieces at the right moment.
// All delays are relative to the moment the cast is played (card leaves hand).
// ─────────────────────────────────────────────────────────────────────────────
import type { Color, GameState, Piece, PieceType, SpellId, Square } from '../../engine';
import { sfx, type SfxName } from '../audio/sound';
import { pack } from './buffer';
import { SQ, type VfxEngine, type XY } from './engine';
import {
  boardWash, bolt, burst, dust, easeIn, flow, glassify, glyphCircle, lerp, pillar, projectile, rand, ring, smoke, sparkle,
  spriteOrigin, squareWash, stamp, streaks, swirl, tracer, type BreakStyle,
} from './fx';
import { MANA_RAMP, PX, RAMP } from './palettes';
import { DOOM, DOOM_PLAIN, playDoom, playDoomPlain } from './doom';
import { playReaper, reaperHit } from './reaper';
import { anchorSpr, fxSpr, iconSpr, pieceSpr, spellSpr } from './sprites';

export interface SpellCtx {
  id: SpellId;
  caster: Color;
  /** Squares the player picked. */
  targets: Square[];
  /** Squares the engine reported for the cast. */
  squares: Square[];
  removed: { sq: Square; piece: Piece }[];
  moved: { id: string; from: Square; to: Square; piece: Piece }[];
  appeared: { sq: Square; piece: Piece }[];
  changed: { sq: Square; piece: Piece; fromType: PieceType }[];
  /** When the effect starts (the card has reached the board). */
  start: number;
  /** When the spell lands (pieces move / break / appear). */
  impact: number;
  before: GameState;
  after: GameState;
}

export type MoveStyle = 'blink' | 'slide' | 'leap' | 'dash' | 'push' | 'pull' | 'blast';

export interface SpellFx {
  move?: MoveStyle;
  moveDur?: number;
  destroy?: BreakStyle;
  appear?: 'rise' | 'appear' | 'blink';
  /** From effect start to impact (ms). */
  windup?: number;
  /** Extra delay for a square (sweeps, one-by-one summons). */
  stagger?: (sq: Square, c: SpellCtx, index: number) => number;
  /** false: the effect draws (and breaks) the destroyed pieces itself. */
  ghosts?: boolean;
  /** The effect keeps the table busy until this long after it starts (long cinematics). */
  tail?: number;
  /** A cinematic: the board takes no input until it is over. */
  cinematic?: boolean;
  /** When the mana the spell pays out forms in the crystals (ms after the start; default 700 ms after impact). */
  gainAt?: number;
  /** The awakened form's own effect (cards that charge up, see `Spell.cycles`). */
  awakened?: SpellFx;
  play: (e: VfxEngine, c: SpellCtx) => void;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const snd = (e: VfxEngine, name: SfxName, at: number) => e.at(at, () => {
  if (!e.muted) sfx(name);
});
const opp = (c: Color): Color => (c === 'w' ? 'b' : 'w');
const kingOf = (s: GameState, c: Color): Square => s.board.findIndex((p) => p?.type === 'K' && p.color === c);
const crystals = (e: VfxEngine, c: Color): XY | null => e.elementCenter(e.query(`[data-crystals="${c}"]`));
const first = (c: SpellCtx): Square => c.targets[0] ?? c.squares[0] ?? kingOf(c.after, c.caster);
const hexA = (h: string, a: number) => pack(h, a);

/** Ground rune + rising motes: the common "a spell settles on this piece" look. */
function aura(e: VfxEngine, sq: Square, ramp: readonly number[], at: number, o: { rise?: number; ring?: number } = {}) {
  const c = e.c(sq);
  glyphCircle(e, sq, { color: ramp[2], dur: 820, delay: at, r: 10 });
  ring(e, c.x, c.y + 5, { r0: 3, r1: o.ring ?? 15, dur: 460, color: ramp[1], squash: 0.45, delay: at });
  ring(e, c.x, c.y, { r0: 14, r1: 6, dur: 360, color: ramp[0], delay: at + 60 });
  burst(e, c.x, c.y + 6, { n: 22, ramp, speed: [6, 20], angle: [-Math.PI * 0.8, -Math.PI * 0.2], life: [420, 760], gravity: -(o.rise ?? 32), box: { w: 16, h: 3 }, delay: [at, at + 300], shape: 0 });
  sparkle(e, c.x, c.y - 2, { n: 8, ramp, w: 18, h: 20, dur: 460, delay: at + 120 });
}

/** A curse closing in on a piece. */
function curse(e: VfxEngine, sq: Square, ramp: readonly number[], at: number) {
  const c = e.c(sq);
  ring(e, c.x, c.y, { r0: 16, r1: 5, dur: 360, color: ramp[1], delay: at, thick: 1 });
  ring(e, c.x, c.y, { r0: 22, r1: 8, dur: 420, color: ramp[2], delay: at + 40 });
  smoke(e, c.x, c.y + 4, 8, at + 280, 5);
  squareWash(e, sq, { color: ramp[3], dur: 520, alpha: 0.5, delay: at + 280 });
}

/** The spell's own icon, stamped above the square for a moment. */
function icon(e: VfxEngine, c: SpellCtx, sq: Square, at: number) {
  const p = e.c(sq);
  stamp(e, spellSpr(c.id), p.x, p.y - 14, { dur: 700, delay: at, rise: 5 });
}

/** A piece-sized dome of light (shields). */
function dome(e: VfxEngine, sq: Square, rim: number, glint: number, at: number) {
  const p = e.c(sq);
  e.add({
    delay: at,
    dur: 700,
    layer: 1,
    draw: (b, t) => {
      const grow = Math.min(1, t * 4);
      const a = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      const r = 3 + 9 * grow;
      b.circle(p.x, p.y + 1, r, rim, a);
      b.circle(p.x, p.y + 1, r + 1, rim, a * 0.35);
      // glint travelling around the rim
      const ang = -Math.PI / 2 - t * Math.PI * 3;
      b.dot(p.x + Math.cos(ang) * r, p.y + 1 + Math.sin(ang) * r, glint, a);
      b.dot(p.x + Math.cos(ang) * r + 1, p.y + 1 + Math.sin(ang) * r, glint, a);
    },
  });
  burst(e, p.x, p.y, { n: 10, ramp: RAMP.spark, speed: [30, 60], life: [120, 240], shape: 2, drag: 3, delay: [at + 120, at + 140] });
}

/** Where pieces blink out/in: a pillar of light plus an implosion/explosion of motes. */
function blinkAt(e: VfxEngine, sq: Square, ramp: readonly number[], at: number, inward: boolean) {
  const p = e.c(sq);
  pillar(e, p.x, p.y + 8, { w: 10, h: 34, ramp, dur: 420, delay: at });
  if (inward) swirl(e, p.x, p.y, { n: 18, r0: 14, r1: 1, dur: 300, ramp, delay: at, spin: 9 });
  else burst(e, p.x, p.y, { n: 18, ramp, speed: [25, 60], life: [220, 420], drag: 3, delay: [at, at + 30] });
}

/** Big fire explosion with smoke and a shock ring. */
function explosion(e: VfxEngine, x: number, y: number, at: number, size = 1) {
  // fireball core: white heart, yellow body, orange rim – swells and dithers away
  e.add({
    delay: at,
    dur: 320,
    layer: 1,
    draw: (b, t) => {
      const r = (5 + 9 * Math.sqrt(t)) * size;
      const a = t < 0.35 ? 1 : 1 - (t - 0.35) / 0.65;
      b.disc(x, y, r, RAMP.fire[3], a);
      b.disc(x, y, r * 0.72, RAMP.fire[2], a);
      b.disc(x, y, r * 0.48, RAMP.fire[1], a);
      if (t < 0.4) b.disc(x, y, r * 0.26, PX.white, 1 - t / 0.4);
    },
  });
  burst(e, x, y, { n: Math.round(46 * size), ramp: RAMP.fire, speed: [30, 95 * size], life: [260, 620], size: [1, 2], drag: 3.2, gravity: -20, delay: [at, at + 40] });
  burst(e, x, y, { n: Math.round(14 * size), ramp: RAMP.spark, speed: [70, 140], life: [140, 280], shape: 2, drag: 2, delay: [at, at + 10] });
  ring(e, x, y, { r0: 4, r1: 22 * size, dur: 360, color: PX.glint, delay: at });
  ring(e, x, y + 6, { r0: 6, r1: 26 * size, dur: 460, color: RAMP.fire[3], squash: 0.45, delay: at + 30, layer: 0 });
  smoke(e, x, y, Math.round(14 * size), at + 120, 8 * size);
  e.at(at, () => e.shake(size > 1 ? 3 : 2, 320));
}

/** Motes flowing from a square to a player's crystals (mana gained). */
function manaIn(e: VfxEngine, from: XY, color: Color, at: number, n = 18) {
  e.at(at, () => {
    const to = crystals(e, color);
    if (to) flow(e, from, to, { n, ramp: MANA_RAMP[color], dur: 560, spread: 5, bend: 26 });
  });
}

/** Motes leaving a player's crystals towards a point (mana taken). */
function manaOut(e: VfxEngine, to: XY, color: Color, at: number, n = 18) {
  e.at(at, () => {
    const from = crystals(e, color);
    if (from) flow(e, from, to, { n, ramp: MANA_RAMP[color], dur: 520, spread: 16, bend: 22 });
  });
}

const boardCenter = (e: VfxEngine): XY => {
  const r = e.boardRect();
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
};

// ── the book of effects ──────────────────────────────────────────────────────

export const SPELL_FX: Record<SpellId, SpellFx> = {
  // Mozgás ────────────────────────────────────────────────────────────────────
  pawnRush: {
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      aura(e, sq, RAMP.teal, c.start);
      burst(e, p.x, p.y + 6, { n: 16, ramp: RAMP.teal, speed: [60, 110], angle: [-Math.PI * 0.56, -Math.PI * 0.44], life: [160, 300], shape: 2, box: { w: 12, h: 2 }, delay: [c.start + 60, c.start + 300] });
      icon(e, c, sq, c.impact);
      snd(e, 'wind', c.start);
    },
  },
  knightLeap: {
    move: 'leap',
    moveDur: 300,
    windup: 120,
    play: (e, c) => {
      const m = c.moved[0];
      if (!m) return;
      const a = e.c(m.from);
      const b = e.c(m.to);
      ring(e, a.x, a.y + 6, { r0: 3, r1: 12, dur: 320, color: RAMP.teal[1], squash: 0.45, delay: c.start });
      dust(e, a.x, a.y + 8, 6, c.impact);
      projectile(e, a, b, {
        dur: 300,
        delay: c.impact,
        arc: 16,
        head: () => {},
        trail: { ramp: RAMP.teal, rate: 90, life: [180, 320], gravity: 6 },
      });
      dust(e, b.x, b.y + 8, 8, c.impact + 300);
      ring(e, b.x, b.y + 7, { r0: 3, r1: 14, dur: 300, color: RAMP.dust[1], squash: 0.4, delay: c.impact + 290, layer: 0 });
      snd(e, 'wind', c.start);
    },
  },
  bishopBlessing: {
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      pillar(e, p.x, p.y + 8, { w: 8, h: 40, ramp: RAMP.holy, dur: 640, delay: c.start });
      sparkle(e, p.x, p.y - 4, { n: 16, ramp: RAMP.holy, w: 18, h: 26, dur: 520, delay: c.start + 80, rise: -8 });
      icon(e, c, sq, c.impact);
      snd(e, 'holy', c.start);
    },
  },
  rookCharge: {
    move: 'dash',
    moveDur: 190,
    windup: 140,
    play: (e, c) => {
      const m = c.moved[0];
      if (!m) return;
      const a = e.c(m.from);
      const b = e.c(m.to);
      ring(e, a.x, a.y + 7, { r0: 2, r1: 12, dur: 260, color: RAMP.dust[1], squash: 0.4, delay: c.start, layer: 0 });
      burst(e, a.x, a.y + 8, { n: 10, ramp: RAMP.dust, speed: [10, 30], life: [300, 500], size: [1, 2], gravity: -8, box: { w: 12, h: 2 }, delay: [c.start, c.start + 120] });
      const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / SQ));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        dust(e, lerp(a.x, b.x, t), lerp(a.y, b.y, t) + 8, 5, c.impact + 190 * easeIn(t));
      }
      e.at(c.impact + 190, () => e.shake(2, 200));
      snd(e, 'earth', c.impact + 150);
    },
  },
  queenGrace: {
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      aura(e, sq, RAMP.gold, c.start);
      // an L of teal sparks: the knight pattern it gains
      for (const [dx, dy] of [[1, -2], [2, -1], [-1, -2], [-2, -1], [1, 2], [2, 1], [-1, 2], [-2, 1]]) {
        sparkle(e, p.x + dx * SQ * 0.5, p.y + dy * SQ * 0.5, { n: 2, ramp: RAMP.teal, w: 4, h: 4, dur: 360, delay: c.start + 200 });
      }
      icon(e, c, sq, c.impact);
      snd(e, 'holy', c.start);
    },
  },
  kingStride: {
    play: (e, c) => {
      const sq = kingOf(c.after, c.caster);
      if (sq < 0) return;
      const p = e.c(sq);
      aura(e, sq, RAMP.gold, c.start);
      dust(e, p.x - 5, p.y + 8, 5, c.start + 120);
      dust(e, p.x + 5, p.y + 8, 5, c.start + 300);
      icon(e, c, sq, c.impact);
      snd(e, 'wind', c.start);
    },
  },
  forcedMarch: {
    move: 'slide',
    moveDur: 260,
    windup: 120,
    play: (e, c) => {
      const m = c.moved[0];
      if (!m) return;
      const a = e.c(m.from);
      const b = e.c(m.to);
      ring(e, a.x, a.y + 7, { r0: 3, r1: 11, dur: 300, color: RAMP.gold[1], squash: 0.45, delay: c.start });
      dust(e, a.x, a.y + 8, 6, c.impact);
      dust(e, b.x, b.y + 8, 7, c.impact + 250);
      snd(e, 'move', c.impact + 230);
    },
  },
  teleport: {
    move: 'blink',
    windup: 260,
    play: (e, c) => {
      const m = c.moved[0];
      if (!m) return;
      blinkAt(e, m.from, RAMP.arcane, c.start, true);
      blinkAt(e, m.to, RAMP.teal, c.impact - 40, false);
      ring(e, e.c(m.to).x, e.c(m.to).y + 6, { r0: 3, r1: 16, dur: 380, color: RAMP.teal[1], squash: 0.45, delay: c.impact, layer: 0 });
      snd(e, 'teleport', c.start);
    },
  },
  doubleMove: {
    play: (e, c) => {
      const sq = kingOf(c.after, c.caster);
      const r = e.boardRect();
      const own = c.caster === 'w' !== e.board.flipped;
      streaks(e, { x: r.x, y: own ? r.y + r.h / 2 : r.y, w: r.w, h: r.h / 2 }, { n: 22, ramp: RAMP.teal, dir: { x: 1, y: 0 }, speed: 120, len: 7, dur: 620, delay: c.start });
      if (sq >= 0) {
        const p = e.c(sq);
        ring(e, p.x, p.y, { r0: 4, r1: 14, dur: 380, color: RAMP.teal[1], delay: c.start });
        ring(e, p.x, p.y, { r0: 4, r1: 14, dur: 380, color: RAMP.teal[0], delay: c.start + 160 });
        icon(e, c, sq, c.impact);
      }
      snd(e, 'wind', c.start);
    },
  },
  mirror: {
    move: 'blink',
    windup: 240,
    play: (e, c) => {
      const m = c.moved[0];
      const r = e.boardRect();
      // a silver seam down the middle of the board
      e.add({
        delay: c.start,
        dur: 520,
        layer: 1,
        draw: (b, t) => {
          const a = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
          const x = r.x + r.w / 2;
          const reach = Math.min(1, t * 3) * r.h;
          for (let y = r.y; y < r.y + reach; y++) {
            b.dot(x - 1, y, PX.steel, a * 0.6);
            b.dot(x, y, PX.white, a);
            if ((y + Math.floor(t * 30)) % 7 === 0) b.dot(x + 1, y, PX.white, a);
          }
        },
      });
      if (m) {
        blinkAt(e, m.from, RAMP.steel, c.start + 60, true);
        blinkAt(e, m.to, RAMP.steel, c.impact - 40, false);
      }
      snd(e, 'teleport', c.start);
    },
  },
  outOfWay: {
    move: 'slide',
    moveDur: 200,
    windup: 80,
    play: (e, c) => {
      const m = c.moved[0];
      if (!m) return;
      const a = e.c(m.from);
      const b = e.c(m.to);
      smoke(e, a.x, a.y + 6, 5, c.impact, 4);
      streaks(e, { x: Math.min(a.x, b.x) - 4, y: Math.min(a.y, b.y) - 4, w: Math.abs(b.x - a.x) + 8, h: Math.abs(b.y - a.y) + 8 }, { n: 6, ramp: RAMP.teal, dir: { x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) }, speed: 50, len: 5, dur: 260, delay: c.impact });
      dust(e, b.x, b.y + 8, 5, c.impact + 190);
      snd(e, 'wind', c.start);
    },
  },
  quickCastle: {
    move: 'slide',
    moveDur: 260,
    windup: 100,
    play: (e, c) => {
      for (const m of c.moved) {
        const b = e.c(m.to);
        dust(e, b.x, b.y + 8, 6, c.impact + 250);
        sparkle(e, b.x, b.y, { n: 6, ramp: RAMP.gold, dur: 300, delay: c.impact + 240 });
      }
      snd(e, 'move', c.impact + 230);
      snd(e, 'move', c.impact + 290);
    },
  },
  pawnVault: {
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      aura(e, sq, RAMP.teal, c.start);
      projectile(e, { x: p.x, y: p.y + 4 }, { x: p.x, y: p.y - 18 }, {
        dur: 320,
        delay: c.start + 120,
        arc: 6,
        head: (b, x, y) => b.rect(x - 1, y - 1, 2, 2, PX.teal),
        trail: { ramp: RAMP.teal, rate: 70 },
      });
      icon(e, c, sq, c.impact);
      snd(e, 'wind', c.start);
    },
  },
  scout: {
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      aura(e, sq, RAMP.teal, c.start);
      for (const dir of [-1, 1]) {
        burst(e, p.x + dir * 4, p.y + 2, { n: 8, ramp: RAMP.teal, speed: [50, 90], angle: dir < 0 ? [Math.PI - 0.08, Math.PI + 0.08] : [-0.08, 0.08], life: [160, 280], shape: 2, delay: [c.start + 120, c.start + 320] });
      }
      icon(e, c, sq, c.impact);
      snd(e, 'wind', c.start);
    },
  },

  // Védelem ───────────────────────────────────────────────────────────────────
  pawnShield: {
    play: (e, c) => {
      const sq = first(c);
      dome(e, sq, PX.steel, PX.white, c.start + 60);
      icon(e, c, sq, c.impact);
      snd(e, 'shield', c.start + 80);
    },
  },
  knightShield: {
    play: (e, c) => {
      const sq = first(c);
      dome(e, sq, PX.gold, PX.glint, c.start + 60);
      icon(e, c, sq, c.impact);
      snd(e, 'shield', c.start + 80);
    },
  },
  fortify: {
    windup: 260,
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        flow(e, { x: p.x + dx * 18, y: p.y + dy * 18 }, p, { n: 6, ramp: RAMP.stone, dur: 280, delay: c.start, spread: 3, bend: 6, stagger: 0.2 });
      }
      squareWash(e, sq, { color: hexA('#a6a1aa', 1), dur: 300, alpha: 0.6, delay: c.impact });
      ring(e, p.x, p.y, { r0: 6, r1: 14, dur: 300, color: PX.steel, delay: c.impact, thick: 2 });
      burst(e, p.x, p.y, { n: 12, ramp: RAMP.spark, speed: [40, 80], life: [120, 240], shape: 2, drag: 3, delay: [c.impact, c.impact + 20] });
      e.at(c.impact, () => e.shake(1, 140));
      icon(e, c, sq, c.impact + 80);
      snd(e, 'earth', c.start);
      snd(e, 'shield', c.impact);
    },
  },
  emergencySwap: {
    move: 'blink',
    windup: 240,
    play: (e, c) => {
      for (const m of c.moved) {
        const p = e.c(m.from);
        ring(e, p.x, p.y, { r0: 4, r1: 16, dur: 240, color: PX.red, delay: c.start });
        ring(e, p.x, p.y, { r0: 4, r1: 16, dur: 240, color: PX.red, delay: c.start + 120 });
        blinkAt(e, m.from, RAMP.gold, c.start + 60, true);
        blinkAt(e, m.to, RAMP.gold, c.impact - 40, false);
      }
      snd(e, 'teleport', c.start);
      snd(e, 'shield', c.impact);
    },
  },
  royalGuard: {
    play: (e, c) => {
      const sq = kingOf(c.after, c.caster);
      if (sq < 0) return;
      const p = e.c(sq);
      dome(e, sq, PX.gold, PX.glint, c.start);
      ring(e, p.x, p.y + 6, { r0: 6, r1: 30, dur: 600, color: RAMP.gold[1], squash: 0.45, delay: c.start + 120, layer: 0 });
      sparkle(e, p.x, p.y - 6, { n: 14, ramp: RAMP.holy, w: 26, h: 22, dur: 500, delay: c.start + 100 });
      icon(e, c, sq, c.impact);
      snd(e, 'holy', c.start);
    },
  },
  checkBreaker: {
    move: 'blink',
    windup: 160,
    play: (e, c) => {
      const m = c.moved[0];
      if (!m) return;
      const a = e.c(m.from);
      const b = e.c(m.to);
      burst(e, a.x, a.y + 4, { n: 18, ramp: RAMP.bone, speed: [20, 50], life: [300, 520], size: [1, 2], drag: 3, gravity: -10, delay: [c.start, c.start + 80] });
      streaks(e, { x: Math.min(a.x, b.x) - 6, y: Math.min(a.y, b.y) - 6, w: Math.abs(b.x - a.x) + 12, h: Math.abs(b.y - a.y) + 12 }, { n: 8, ramp: RAMP.bone, dir: { x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) }, speed: 60, len: 6, dur: 260, delay: c.start + 60 });
      blinkAt(e, m.to, RAMP.bone, c.impact - 30, false);
      snd(e, 'wind', c.start);
    },
  },
  lastChance: {
    play: (e, c) => {
      const own = c.after.board.flatMap((p, i) => (p && p.color === c.caster ? [i] : []));
      own.forEach((sq, i) => {
        const p = e.c(sq);
        ring(e, p.x, p.y + 1, { r0: 3, r1: 10, dur: 360, color: RAMP.holy[1], delay: c.start + i * 30 });
        const f = fxSpr('feather');
        projectile(e, { x: p.x + rand(-6, 6), y: p.y - 22 }, { x: p.x + rand(-4, 4), y: p.y + 2 }, {
          dur: 520,
          delay: c.start + i * 30,
          arc: -3,
          head: (b, x, y, t) => b.sprite(f, x - 2, y - 3, t < 0.8 ? 1 : (1 - t) / 0.2),
        });
      });
      boardWash(e, { color: PX.ivory, dur: 420, alpha: 0.25, delay: c.start });
      snd(e, 'holy', c.start);
    },
  },
  invisibility: {
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      burst(e, p.x, p.y + 6, { n: 20, ramp: RAMP.bone, speed: [4, 12], angle: [-Math.PI * 0.8, -Math.PI * 0.2], life: [500, 800], size: [1, 2], gravity: -20, box: { w: 16, h: 4 }, delay: [c.start, c.start + 300], flicker: 0.2 });
      ring(e, p.x, p.y, { r0: 14, r1: 4, dur: 420, color: PX.ivory, delay: c.start });
      icon(e, c, sq, c.impact);
      snd(e, 'arcane', c.start);
    },
  },

  // Irányítás ─────────────────────────────────────────────────────────────────
  weaken: {
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      curse(e, sq, RAMP.curse, c.start);
      burst(e, p.x, p.y - 8, { n: 10, ramp: [pack('#9a3b54'), pack('#5b2338')], speed: [4, 10], angle: [0, Math.PI], life: [500, 800], gravity: 20, box: { w: 16, h: 4 }, delay: [c.start + 100, c.start + 400], floor: p.y + 9 });
      icon(e, c, sq, c.impact);
      snd(e, 'dark', c.start);
    },
  },
  root: {
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      glyphCircle(e, sq, { color: RAMP.nature[2], dur: 700, delay: c.start });
      // vines climbing up around the piece
      e.add({
        delay: c.start + 60,
        dur: 700,
        layer: 1,
        draw: (b, t) => {
          const grow = Math.min(1, t * 2.2);
          const a = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
          for (const side of [-1, 1]) {
            for (let i = 0; i < 16 * grow; i++) {
              const y = p.y + 9 - i;
              const x = p.x + side * (7 - Math.sin(i * 0.7) * 2 - i * 0.15);
              b.dot(x, y, i % 5 === 0 ? PX.green : RAMP.nature[3], a);
              if (i % 5 === 2) b.dot(x + side, y, RAMP.nature[1], a);
            }
          }
        },
      });
      icon(e, c, sq, c.impact);
      snd(e, 'earth', c.start);
    },
  },
  blindSpot: {
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      swirl(e, p.x, p.y - 4, { n: 26, r0: 10, r1: 4, dur: 560, ramp: RAMP.shadow, spin: 8, squash: 0.5, delay: c.start, size: 2 });
      smoke(e, p.x, p.y - 2, 6, c.start + 300, 4);
      icon(e, c, sq, c.impact);
      snd(e, 'dark', c.start);
    },
  },
  silence: {
    play: (e, c) => {
      const sq = kingOf(c.after, opp(c.caster));
      const target = crystals(e, opp(c.caster));
      if (sq >= 0) {
        const p = e.c(sq);
        curse(e, sq, RAMP.arcane, c.start);
        icon(e, c, sq, c.impact);
        if (target) flow(e, p, target, { n: 10, ramp: RAMP.arcane, dur: 420, delay: c.start + 160, spread: 3 });
      }
      snd(e, 'dark', c.start);
    },
  },
  manaDrain: {
    play: (e, c) => {
      const center = boardCenter(e);
      manaOut(e, center, opp(c.caster), c.start, 22);
      swirl(e, center.x, center.y, { n: 20, r0: 16, r1: 1, dur: 520, ramp: MANA_RAMP[opp(c.caster)], delay: c.start + 300 });
      snd(e, 'arcane', c.start);
      snd(e, 'manaSpend', c.start + 80);
    },
  },
  disarm: {
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      curse(e, sq, RAMP.steel, c.start);
      stamp(e, iconSpr('sword'), p.x, p.y - 12, { dur: 360, delay: c.start + 120, rise: -4 });
      burst(e, p.x, p.y - 10, { n: 16, ramp: RAMP.steel, speed: [30, 70], life: [260, 460], gravity: 240, delay: [c.impact, c.impact + 20], floor: p.y + 9 });
      burst(e, p.x, p.y - 10, { n: 8, ramp: RAMP.spark, speed: [50, 90], life: [100, 200], shape: 2, delay: [c.impact, c.impact] });
      icon(e, c, sq, c.impact + 60);
      snd(e, 'shield', c.impact);
    },
  },
  pawnFreeze: {
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        flow(e, { x: p.x + Math.cos(a) * 16, y: p.y + Math.sin(a) * 16 }, p, { n: 3, ramp: RAMP.ice, dur: 260, delay: c.start, spread: 1, bend: 2 });
      }
      // frost spikes snap outwards around the frozen pawn
      e.add({
        delay: c.impact,
        dur: 520,
        layer: 1,
        draw: (b, t) => {
          const a = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
          const len = 3 + Math.min(1, t * 5) * 6;
          for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2 + 0.2;
            const x0 = p.x + Math.cos(ang) * 5;
            const y0 = p.y + Math.sin(ang) * 5;
            b.line(x0, y0, x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len, i % 2 ? PX.ice : PX.sky, a);
          }
        },
      });
      ring(e, p.x, p.y, { r0: 3, r1: 15, dur: 360, color: PX.ice, delay: c.impact });
      burst(e, p.x, p.y, { n: 14, ramp: RAMP.ice, speed: [20, 50], life: [280, 520], gravity: 60, delay: [c.impact, c.impact + 40], floor: p.y + 9 });
      icon(e, c, sq, c.impact + 40);
      snd(e, 'freeze', c.start + 60);
    },
  },
  provoke: {
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      for (let i = 0; i < 3; i++) ring(e, p.x, p.y, { r0: 22, r1: 6, dur: 300, color: i % 2 ? PX.ember : PX.red, delay: c.start + i * 110, thick: 1 });
      icon(e, c, sq, c.impact);
      snd(e, 'dark', c.start);
    },
  },
  storm: {
    move: 'push',
    moveDur: 220,
    windup: 280,
    play: (e, c) => {
      const r = e.boardRect();
      const down = (c.caster === 'w') !== e.board.flipped ? -1 : 1; // enemy pawns retreat towards their side
      streaks(e, r, { n: 46, ramp: [pack('#dff8ff'), pack('#a6a1aa'), pack('#77727d')], dir: { x: 0.45, y: down }, speed: 170, len: 6, dur: 760, delay: c.start });
      boardWash(e, { color: pack('#35323b'), dur: 700, alpha: 0.45, delay: c.start });
      const hits = c.moved.slice(0, 3);
      hits.forEach((m, i) => {
        const b = e.c(m.from);
        bolt(e, b.x + rand(-4, 4), r.y - 10, b.x, b.y, { dur: 160, delay: c.start + 120 + i * 110, jitter: 5 });
      });
      snd(e, 'wind', c.start);
      if (hits.length) snd(e, 'lightning', c.start + 120);
    },
  },

  // Taktika ───────────────────────────────────────────────────────────────────
  swap: {
    move: 'blink',
    windup: 260,
    play: (e, c) => {
      const [m1, m2] = c.moved;
      if (m1 && m2) {
        flow(e, e.c(m1.from), e.c(m2.from), { n: 14, ramp: RAMP.teal, dur: 360, delay: c.start, spread: 2, bend: 14 });
        flow(e, e.c(m2.from), e.c(m1.from), { n: 14, ramp: RAMP.nature, dur: 360, delay: c.start, spread: 2, bend: -14 });
      }
      for (const m of c.moved) {
        blinkAt(e, m.from, RAMP.teal, c.start + 40, true);
        blinkAt(e, m.to, RAMP.teal, c.impact - 40, false);
      }
      snd(e, 'teleport', c.start);
    },
  },
  recastle: {
    play: (e, c) => {
      const k = kingOf(c.after, c.caster);
      if (k < 0) return;
      const rooks = c.after.board.flatMap((p, i) => (p && p.color === c.caster && p.type === 'R' && Math.floor(i / 8) === Math.floor(k / 8) ? [i] : []));
      aura(e, k, RAMP.gold, c.start);
      rooks.forEach((r, i) => {
        tracer(e, e.c(k), e.c(r), { color: PX.gold, dur: 420, delay: c.start + 160 + i * 80 });
        sparkle(e, e.c(r).x, e.c(r).y, { n: 8, ramp: RAMP.gold, dur: 300, delay: c.start + 260 + i * 80 });
      });
      icon(e, c, k, c.impact);
      snd(e, 'arcane', c.start);
    },
  },
  chaos: {
    move: 'blink',
    windup: 300,
    play: (e, c) => {
      const ramps = [RAMP.arcane, RAMP.gold, RAMP.teal, RAMP.fire];
      for (const m of c.moved) {
        const p = e.c(m.from);
        for (const r of ramps) sparkle(e, p.x, p.y, { n: 5, ramp: r, w: 18, h: 18, dur: 300, delay: c.start });
        blinkAt(e, m.from, RAMP.arcane, c.start + 80, true);
        blinkAt(e, m.to, RAMP.gold, c.impact - 40, false);
      }
      boardWash(e, { color: pack('#7b48b0'), dur: 300, alpha: 0.3, delay: c.impact - 60 });
      snd(e, 'teleport', c.start);
      snd(e, 'arcane', c.impact);
    },
  },
  instantPromotion: {
    windup: 300,
    play: (e, c) => {
      const sq = c.changed[0]?.sq ?? first(c);
      const p = e.c(sq);
      pillar(e, p.x, p.y + 8, { w: 14, h: 60, ramp: RAMP.holy, dur: 720, delay: c.start });
      burst(e, p.x, p.y, { n: 30, ramp: RAMP.holy, speed: [30, 80], life: [300, 600], drag: 2.5, delay: [c.impact, c.impact + 40] });
      ring(e, p.x, p.y, { r0: 4, r1: 22, dur: 420, color: PX.glint, delay: c.impact });
      snd(e, 'holy', c.start);
      snd(e, 'promote', c.impact);
    },
  },
  necromancy: {
    appear: 'rise',
    windup: 300,
    play: (e, c) => {
      const sq = c.appeared[0]?.sq ?? first(c);
      const p = e.c(sq);
      glyphCircle(e, sq, { color: RAMP.nature[3], dur: 900, delay: c.start });
      burst(e, p.x, p.y + 8, { n: 26, ramp: [pack('#71b24e'), pack('#3e7f3a'), pack('#24512b'), pack('#16301c')], speed: [4, 16], angle: [-Math.PI * 0.8, -Math.PI * 0.2], life: [500, 900], size: [1, 2], gravity: -18, box: { w: 16, h: 4 }, delay: [c.start, c.start + 400] });
      const bone = fxSpr('bone');
      for (let i = 0; i < 4; i++) {
        e.spawn({ x: p.x + rand(-6, 6), y: p.y + 8, vx: rand(-10, 10), vy: rand(-50, -30), ax: 0, ay: 160, drag: 0, life: 520, age: -(c.impact + i * 40), size: 1, ramp: [PX.ivory], fade: true, shape: 3, spr: bone, floor: p.y + 9 });
      }
      snd(e, 'summon', c.start);
      snd(e, 'dark', c.impact);
    },
  },
  realityBreak: {
    play: (e, c) => {
      const r = e.boardRect();
      boardWash(e, { color: pack('#2a1540'), dur: 700, alpha: 0.5, delay: c.start });
      for (let i = 0; i < 5; i++) {
        const x0 = r.x + rand(0, r.w);
        const y0 = r.y + rand(0, r.h);
        const a = rand(0, Math.PI * 2);
        const l = rand(24, 60);
        bolt(e, x0, y0, x0 + Math.cos(a) * l, y0 + Math.sin(a) * l, { dur: 420, delay: c.start + i * 70, core: PX.arcane, glow: pack('#4f2a78'), jitter: 3, segments: 5, forks: 2 });
      }
      streaks(e, r, { n: 20, ramp: RAMP.arcane, dir: { x: 1, y: 0 }, speed: 200, len: 10, dur: 520, delay: c.start + 100 });
      e.at(c.start + 100, () => e.shake(1, 220));
      snd(e, 'arcane', c.start);
    },
  },
  brigade: {
    appear: 'rise',
    windup: 160,
    stagger: (_sq, _c, i) => i * 90,
    play: (e, c) => {
      c.appeared.forEach((a, i) => {
        const p = e.c(a.sq);
        const at = c.impact + i * 90;
        ring(e, p.x, p.y + 7, { r0: 3, r1: 12, dur: 300, color: RAMP.gold[2], squash: 0.45, delay: at - 60, layer: 0 });
        dust(e, p.x, p.y + 8, 7, at);
        snd(e, 'move', at);
      });
      snd(e, 'summon', c.start);
    },
  },
  clone: {
    appear: 'blink',
    windup: 260,
    play: (e, c) => {
      const src = c.targets[0];
      const dst = c.appeared[0]?.sq ?? c.targets[1];
      if (src !== undefined && dst !== undefined) {
        flow(e, e.c(src), e.c(dst), { n: 22, ramp: RAMP.teal, dur: 360, delay: c.start, spread: 4, bend: 8 });
        ring(e, e.c(src).x, e.c(src).y, { r0: 3, r1: 12, dur: 300, color: RAMP.teal[1], delay: c.start });
        blinkAt(e, dst, RAMP.teal, c.impact - 40, false);
      }
      snd(e, 'summon', c.start);
    },
  },
  frenchCheese: {
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      aura(e, sq, RAMP.gold, c.start);
      for (const dir of [-1, 1]) {
        sparkle(e, p.x + dir * SQ, p.y, { n: 6, ramp: RAMP.gold, w: 10, h: 14, dur: 360, delay: c.start + 200 });
      }
      icon(e, c, sq, c.impact);
      snd(e, 'arcane', c.start);
    },
  },
  magnet: {
    move: 'pull',
    moveDur: 260,
    windup: 260,
    play: (e, c) => {
      const [enemy, own] = c.targets;
      if (enemy !== undefined && own !== undefined) {
        const a = e.c(enemy);
        const b = e.c(own);
        for (let i = 0; i < 3; i++) tracer(e, { x: a.x, y: a.y + (i - 1) * 2 }, { x: b.x, y: b.y + (i - 1) * 2 }, { color: i === 1 ? PX.red : PX.iron, dur: 380, delay: c.start + i * 40 });
        flow(e, a, b, { n: 12, ramp: RAMP.steel, dur: 380, delay: c.start + 60, spread: 2, bend: 3 });
      }
      for (const m of c.moved) dust(e, e.c(m.to).x, e.c(m.to).y + 8, 6, c.impact + 250);
      snd(e, 'arcane', c.start);
      snd(e, 'move', c.impact + 240);
    },
  },
  repulse: {
    move: 'push',
    moveDur: 220,
    windup: 220,
    play: (e, c) => {
      const [enemy, own] = c.targets;
      if (enemy !== undefined && own !== undefined) {
        const a = e.c(own);
        const b = e.c(enemy);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        burst(e, a.x, a.y, { n: 24, ramp: RAMP.bone, speed: [80, 140], angle: [ang - 0.2, ang + 0.2], life: [180, 320], shape: 2, delay: [c.start + 60, c.start + 180] });
        ring(e, a.x, a.y, { r0: 4, r1: 18, dur: 280, color: PX.ivory, delay: c.start });
      }
      for (const m of c.moved) dust(e, e.c(m.to).x, e.c(m.to).y + 8, 6, c.impact + 210);
      e.at(c.impact + 200, () => e.shake(1, 160));
      snd(e, 'wind', c.start);
    },
  },
  retrain: {
    windup: 240,
    play: (e, c) => {
      const sq = c.changed[0]?.sq ?? first(c);
      const p = e.c(sq);
      swirl(e, p.x, p.y, { n: 22, r0: 4, r1: 13, dur: 420, ramp: RAMP.bone, spin: 10, delay: c.start });
      burst(e, p.x, p.y, { n: 22, ramp: RAMP.bone, speed: [20, 50], life: [300, 520], size: [1, 2], drag: 3, delay: [c.impact, c.impact + 20] });
      ring(e, p.x, p.y, { r0: 3, r1: 14, dur: 300, color: PX.ivory, delay: c.impact });
      snd(e, 'arcane', c.start);
      snd(e, 'promote', c.impact);
    },
  },
  gambit: {
    play: (e, c) => {
      const from = crystals(e, c.caster);
      const to = crystals(e, opp(c.caster));
      if (from && to) flow(e, from, to, { n: 16, ramp: RAMP.gold, dur: 600, delay: c.start, spread: 10, bend: 40 });
      snd(e, 'arcane', c.start);
      snd(e, 'cardDrop', c.start + 200);
    },
  },

  // Terep ─────────────────────────────────────────────────────────────────────
  wall: {
    windup: 180,
    play: (e, c) => {
      for (const sq of c.squares.length ? c.squares : c.targets) {
        const p = e.c(sq);
        burst(e, p.x, p.y + 8, { n: 16, ramp: RAMP.dust, speed: [16, 40], angle: [Math.PI, Math.PI * 2], life: [300, 520], size: [1, 2], gravity: 60, box: { w: 18, h: 2 }, delay: [c.impact, c.impact + 60] });
        burst(e, p.x, p.y, { n: 10, ramp: RAMP.stone, speed: [30, 60], angle: [-Math.PI * 0.9, -Math.PI * 0.1], life: [300, 500], gravity: 260, delay: [c.impact + 60, c.impact + 120], floor: p.y + 9 });
      }
      e.at(c.impact + 60, () => e.shake(1, 180));
      snd(e, 'earth', c.impact);
    },
  },
  barricade: {
    windup: 180,
    stagger: (_sq, _c, i) => i * 110,
    play: (e, c) => {
      (c.squares.length ? c.squares : c.targets).forEach((sq, i) => {
        const p = e.c(sq);
        const at = c.impact + i * 110;
        burst(e, p.x, p.y + 8, { n: 14, ramp: RAMP.dust, speed: [16, 40], angle: [Math.PI, Math.PI * 2], life: [300, 520], size: [1, 2], gravity: 60, box: { w: 18, h: 2 }, delay: [at, at + 60] });
        burst(e, p.x, p.y, { n: 8, ramp: RAMP.wood, speed: [30, 60], angle: [-Math.PI * 0.9, -Math.PI * 0.1], life: [300, 500], gravity: 260, delay: [at + 40, at + 100], floor: p.y + 9 });
        e.at(at + 40, () => e.shake(1, 140));
        snd(e, 'earth', at);
      });
    },
  },
  gravity: {
    play: (e, c) => {
      const r = e.boardRect();
      streaks(e, r, { n: 36, ramp: [pack('#b184dc'), pack('#77727d'), pack('#524e58')], dir: { x: 0, y: 1 }, speed: 150, len: 8, dur: 700, delay: c.start });
      boardWash(e, { color: pack('#211f25'), dur: 700, alpha: 0.5, delay: c.start });
      e.at(c.start + 200, () => e.shake(1, 260));
      snd(e, 'earth', c.start);
      snd(e, 'arcane', c.start + 120);
    },
  },
  earthquake: {
    move: 'push',
    moveDur: 220,
    windup: 260,
    play: (e, c) => {
      const r = e.boardRect();
      e.at(c.start, () => e.shake(3, 620));
      streaks(e, r, { n: 24, ramp: RAMP.dust, dir: { x: 1, y: 0 }, speed: 60, len: 5, dur: 600, delay: c.start });
      for (const m of c.moved) {
        const p = e.c(m.from);
        dust(e, p.x, p.y + 8, 6, c.impact);
      }
      for (let i = 0; i < 6; i++) {
        const x0 = r.x + rand(10, r.w - 10);
        const y0 = r.y + rand(10, r.h - 10);
        bolt(e, x0, y0, x0 + rand(-18, 18), y0 + rand(-8, 8), { dur: 520, delay: c.start + 60 * i, core: pack('#211f25'), glow: pack('#58392a'), jitter: 2, segments: 4, forks: 1 });
      }
      snd(e, 'earth', c.start);
      snd(e, 'explosion', c.start + 60);
    },
  },
  dimensionShift: {
    windup: 260,
    play: (e, c) => {
      const zone = c.squares.length ? c.squares : c.targets;
      if (!zone.length) return;
      const pts = zone.map((s) => e.sq(s));
      const x0 = Math.min(...pts.map((p) => p.x));
      const y0 = Math.min(...pts.map((p) => p.y));
      const x1 = Math.max(...pts.map((p) => p.x)) + SQ;
      const y1 = Math.max(...pts.map((p) => p.y)) + SQ;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      e.add({
        delay: c.start,
        dur: 760,
        layer: 1,
        draw: (b, t) => {
          const grow = Math.min(1, t * 2.5);
          const a = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
          const w = (x1 - x0) * grow;
          const h = (y1 - y0) * grow;
          b.frame(cx - w / 2, cy - h / 2, w, h, PX.arcane, a, 1);
          b.frame(cx - w / 2 + 2, cy - h / 2 + 2, Math.max(0, w - 4), Math.max(0, h - 4), PX.teal, a * 0.7, 1);
        },
      });
      swirl(e, cx, cy, { n: 30, r0: 4, r1: (x1 - x0) / 2, dur: 700, ramp: [...RAMP.arcane.slice(0, 3), ...RAMP.teal.slice(1, 3)], spin: 6, delay: c.start });
      snd(e, 'arcane', c.start);
    },
  },
  mine: {
    windup: 180,
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      burst(e, p.x, p.y + 7, { n: 18, ramp: RAMP.dust, speed: [20, 50], angle: [-Math.PI * 0.95, -Math.PI * 0.05], life: [320, 540], size: [1, 2], gravity: 220, delay: [c.start, c.start + 200], floor: p.y + 9 });
      stamp(e, anchorSpr('bomb'), p.x, p.y - 2, { dur: 420, delay: c.start + 40, pop: false, rise: -6 });
      snd(e, 'earth', c.start);
      snd(e, 'defuse', c.impact);
    },
  },
  gravityWell: {
    move: 'pull',
    moveDur: 240,
    windup: 300,
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      swirl(e, p.x, p.y, { n: 40, r0: 42, r1: 2, dur: 760, ramp: [pack('#b184dc'), pack('#7b48b0'), pack('#4f2a78'), pack('#211f25')], spin: 9, delay: c.start, size: 1 });
      e.add({
        delay: c.start,
        dur: 760,
        layer: 0,
        draw: (b, t) => {
          const a = t < 0.8 ? Math.min(1, t * 4) : 1 - (t - 0.8) / 0.2;
          b.disc(p.x, p.y, 6 + 2 * Math.sin(t * 20), pack('#140d0b'), a);
          b.circle(p.x, p.y, 7 + 2 * Math.sin(t * 20), PX.violet, a);
        },
      });
      e.at(c.impact, () => e.shake(1, 200));
      snd(e, 'arcane', c.start);
      snd(e, 'wind', c.start + 100);
    },
  },

  // Idő ───────────────────────────────────────────────────────────────────────
  stepBack: {
    move: 'slide',
    moveDur: 300,
    windup: 200,
    play: (e, c) => {
      const m = c.moved[0];
      if (!m) return;
      const a = e.c(m.from);
      const b = e.c(m.to);
      // clock hand sweeping backwards
      e.add({
        delay: c.start,
        dur: 520,
        layer: 1,
        draw: (buf, t) => {
          const al = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
          buf.circle(a.x, a.y, 11, RAMP.time[2], al);
          const ang = -Math.PI / 2 - t * Math.PI * 2;
          buf.line(a.x, a.y, a.x + Math.cos(ang) * 9, a.y + Math.sin(ang) * 9, PX.white, al);
        },
      });
      flow(e, a, b, { n: 14, ramp: RAMP.time, dur: 320, delay: c.impact, spread: 3, bend: 4 });
      snd(e, 'time', c.start);
    },
  },
  timeStop: {
    windup: 240,
    play: (e, c) => {
      const center = boardCenter(e);
      const r = e.boardRect();
      ring(e, center.x, center.y, { r0: 6, r1: r.w * 0.75, dur: 620, color: RAMP.time[1], delay: c.start, thick: 2 });
      ring(e, center.x, center.y, { r0: 4, r1: r.w * 0.6, dur: 620, color: PX.white, delay: c.start + 80 });
      boardWash(e, { color: pack('#9fe0f8'), dur: 620, alpha: 0.35, delay: c.start + 80 });
      stamp(e, anchorSpr('hourglass'), center.x, center.y, { dur: 700, delay: c.start + 60 });
      snd(e, 'time', c.start);
    },
  },
  rewind: {
    move: 'blink',
    appear: 'blink',
    destroy: 'blink',
    windup: 360,
    play: (e, c) => {
      const r = e.boardRect();
      streaks(e, r, { n: 40, ramp: RAMP.time, dir: { x: -1, y: 0 }, speed: 220, len: 10, dur: 720, delay: c.start });
      boardWash(e, { color: pack('#56a8c8'), dur: 720, alpha: 0.35, delay: c.start });
      for (const m of c.moved) flow(e, e.c(m.from), e.c(m.to), { n: 8, ramp: RAMP.time, dur: 320, delay: c.start + 120, spread: 2, bend: 5 });
      snd(e, 'time', c.start);
    },
  },

  // Mana ──────────────────────────────────────────────────────────────────────
  sacrifice: {
    destroy: 'dissolve',
    windup: 160,
    play: (e, c) => {
      const sq = c.removed[0]?.sq ?? first(c);
      const p = e.c(sq);
      pillar(e, p.x, p.y + 8, { w: 8, h: 30, ramp: RAMP.bone, dur: 520, delay: c.start });
      manaIn(e, p, c.caster, c.impact + 200, 12);
      snd(e, 'dark', c.start);
      snd(e, 'manaGain', c.impact + 700);
    },
  },
  bloodPrice: {
    destroy: 'drain',
    windup: 200,
    play: (e, c) => {
      const sq = c.removed[0]?.sq ?? first(c);
      const p = e.c(sq);
      curse(e, sq, RAMP.blood, c.start);
      const drop = fxSpr('drop');
      for (let i = 0; i < 5; i++) {
        e.spawn({ x: p.x + rand(-5, 5), y: p.y - 4, vx: rand(-20, 20), vy: rand(-50, -25), ax: 0, ay: 200, drag: 0, life: 520, age: -(c.impact + i * 30), size: 1, ramp: [PX.red], fade: true, shape: 3, spr: drop, floor: p.y + 9 });
      }
      manaIn(e, p, c.caster, c.impact + 240, 24);
      snd(e, 'dark', c.start);
      snd(e, 'manaGain', c.impact + 740);
    },
  },
  overcharge: {
    play: (e, c) => {
      e.at(c.start, () => {
        const at = crystals(e, c.caster);
        if (!at) return;
        for (let i = 0; i < 4; i++) bolt(e, at.x - 24 + i * 14, at.y - 8, at.x - 16 + i * 14, at.y + 8, { dur: 180, delay: i * 90, core: PX.glint, glow: PX.gold, jitter: 3, segments: 4 });
        sparkle(e, at.x, at.y, { n: 14, ramp: RAMP.spark, w: 60, h: 16, dur: 420 });
      });
      snd(e, 'lightning', c.start);
    },
  },
  arcaneSurge: {
    play: (e, c) => {
      const center = boardCenter(e);
      swirl(e, center.x, center.y, { n: 30, r0: 2, r1: 26, dur: 400, ramp: MANA_RAMP[c.caster], delay: c.start, spin: 8 });
      manaIn(e, center, c.caster, c.start + 260, 26);
      e.at(c.start + 200, () => {
        const at = crystals(e, c.caster);
        if (at) bolt(e, center.x, center.y, at.x, at.y, { dur: 220, core: PX.white, glow: MANA_RAMP[c.caster][1], jitter: 6, segments: 9 });
      });
      snd(e, 'lightning', c.start + 200);
      snd(e, 'manaGain', c.start + 700);
    },
  },
  manaMage: {
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      aura(e, sq, MANA_RAMP[c.caster], c.start, { rise: 40 });
      swirl(e, p.x, p.y - 2, { n: 12, r0: 10, r1: 8, dur: 600, ramp: MANA_RAMP[c.caster], spin: 6, delay: c.start + 100, squash: 0.5 });
      icon(e, c, sq, c.impact);
      snd(e, 'arcane', c.start);
    },
  },
  manaDeposit: {
    play: (e, c) => {
      e.at(c.start, () => {
        const at = crystals(e, c.caster);
        if (!at) return;
        const coin = fxSpr('coin');
        for (let i = 0; i < 5; i++) {
          e.spawn({ x: at.x + rand(-20, 20), y: at.y, vx: rand(-8, 8), vy: rand(-70, -50), ax: 0, ay: 120, drag: 0, life: 620, age: -i * 70, size: 1, ramp: [PX.gold], fade: true, shape: 3, spr: coin });
        }
        sparkle(e, at.x, at.y - 10, { n: 10, ramp: RAMP.gold, w: 50, h: 14, dur: 500, delay: 100 });
      });
      snd(e, 'arcane', c.start);
      snd(e, 'manaSpend', c.start + 120);
    },
  },
  manaThirst: {
    play: (e, c) => {
      e.at(c.start, () => {
        const at = crystals(e, c.caster);
        if (!at) return;
        swirl(e, at.x, at.y, { n: 24, r0: 34, r1: 10, dur: 600, ramp: [...RAMP.blood.slice(0, 2), ...MANA_RAMP[c.caster].slice(1, 3)], spin: 7, squash: 0.35 });
      });
      snd(e, 'dark', c.start);
    },
  },
  manaArmageddon: {
    windup: 200,
    play: (e, c) => {
      const center = boardCenter(e);
      const r = e.boardRect();
      manaOut(e, center, 'w', c.start, 14);
      manaOut(e, center, 'b', c.start, 14);
      e.at(c.impact, () => {
        explosion(e, center.x, center.y, 0, 1.4);
        ring(e, center.x, center.y, { r0: 10, r1: r.w, dur: 620, color: PX.white, thick: 2 });
      });
      boardWash(e, { color: pack('#b3322c'), dur: 700, alpha: 0.4, delay: c.impact });
      snd(e, 'explosion', c.impact);
    },
  },

  // Pusztítás ─────────────────────────────────────────────────────────────────
  // the plain form: a short, heavy blow; awakened (charged by one cycle): the full cinematic
  doom: {
    windup: DOOM_PLAIN.impact, move: 'blast', moveDur: 420, ghosts: false, tail: DOOM_PLAIN.end, gainAt: DOOM_PLAIN.paid,
    play: (e, c) => playDoomPlain(e, c),
    awakened: {
      windup: DOOM.boom, move: 'blast', moveDur: 540, ghosts: false, tail: DOOM.end, cinematic: true, gainAt: DOOM.paid,
      play: (e, c) => playDoom(e, c),
    },
  },
  glassCurse: {
    windup: 360,
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      const piece = c.after.board[sq];
      // the curse closes in, glass motes swirl onto the piece…
      curse(e, sq, RAMP.arcane, c.start);
      swirl(e, p.x, p.y - 3, { n: 24, r0: 16, r1: 3, dur: 380, ramp: RAMP.glass.slice(0, 4), spin: 7, squash: 0.6, delay: c.start + 40 });
      // …and it turns to glass: a pale copy of it with a white sheen sweeping across
      if (piece) {
        const spr = pieceSpr(piece.type, piece.color);
        const glass = glassify(spr);
        const o = spriteOrigin(e, sq, spr);
        e.add({
          delay: c.impact - 40,
          dur: 620,
          layer: 1,
          draw: (b, t) => {
            const a = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
            b.sprite(glass, o.x, o.y, a);
            const band = -6 + t * (spr.w + spr.h + 12);
            b.sprite(glass, o.x, o.y, a, PX.white, (sx, sy) => Math.abs(sx + sy - band) < 2);
          },
        });
      }
      ring(e, p.x, p.y, { r0: 4, r1: 17, dur: 300, color: PX.white, delay: c.impact });
      burst(e, p.x, p.y - 4, { n: 12, ramp: [PX.white, RAMP.glass[1], RAMP.glass[3]], speed: [40, 90], life: [120, 240], shape: 2, drag: 3, delay: [c.impact, c.impact + 20] });
      icon(e, c, sq, c.impact + 120);
      snd(e, 'glassCurse', c.start);
    },
  },
  deathMark: {
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      curse(e, sq, RAMP.blood, c.start);
      stamp(e, iconSpr('skull'), p.x, p.y - 12, { dur: 820, delay: c.start + 160, rise: 3 });
      snd(e, 'dark', c.start);
    },
  },
  execution: {
    destroy: 'slash',
    windup: 260,
    play: (e, c) => {
      const sq = c.removed[0]?.sq ?? first(c);
      const s = e.sq(sq);
      squareWash(e, sq, { color: PX.darkRed, dur: 360, alpha: 0.6, delay: c.start });
      // the blade: a white diagonal cut that snaps across the square
      tracer(e, { x: s.x - 4, y: s.y - 4 }, { x: s.x + SQ + 4, y: s.y + SQ + 4 }, { color: PX.white, dur: 220, delay: c.impact - 40, thick: 2, grow: 0.3 });
      tracer(e, { x: s.x - 2, y: s.y - 6 }, { x: s.x + SQ + 6, y: s.y + SQ + 2 }, { color: PX.red, dur: 200, delay: c.impact - 30, grow: 0.3 });
      e.at(c.impact, () => e.shake(2, 200));
      snd(e, 'dark', c.start);
      snd(e, 'capture', c.impact);
    },
  },
  meteor: {
    destroy: 'burn',
    windup: 420,
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      const r = e.boardRect();
      const from = { x: p.x - 70, y: r.y - 70 };
      const rock = fxSpr('rock');
      glyphCircle(e, sq, { color: RAMP.fire[3], dur: 420, delay: c.start, r: 12 });
      projectile(e, from, { x: p.x, y: p.y }, {
        dur: 420,
        delay: c.start,
        head: (b, x, y) => {
          b.disc(x, y, 5, RAMP.fire[2], 0.8);
          b.sprite(rock, x - 3, y - 3);
        },
        trail: { ramp: RAMP.fire, rate: 520, life: [220, 460], size: [1, 3], gravity: -14, speed: [4, 16] },
      });
      e.at(c.impact, () => explosion(e, p.x, p.y, 0, 1.3));
      for (const x of c.removed) if (x.sq !== sq) squareWash(e, x.sq, { color: RAMP.fire[3], dur: 400, alpha: 0.7, delay: c.impact + 40 });
      snd(e, 'fire', c.start);
      snd(e, 'explosion', c.impact);
    },
  },
  bishopSniper: {
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      aura(e, sq, RAMP.gold, c.start);
      e.add({
        delay: c.start + 100,
        dur: 520,
        layer: 1,
        draw: (b, t) => {
          const a = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
          const r = 12 - Math.min(1, t * 3) * 5;
          b.circle(p.x, p.y - 2, r, PX.gold, a);
          b.line(p.x - r - 3, p.y - 2, p.x - r + 2, p.y - 2, PX.gold, a);
          b.line(p.x + r - 2, p.y - 2, p.x + r + 3, p.y - 2, PX.gold, a);
          b.line(p.x, p.y - r - 5, p.x, p.y - r, PX.gold, a);
          b.line(p.x, p.y + r - 2, p.x, p.y + r + 3, PX.gold, a);
        },
      });
      icon(e, c, sq, c.impact);
      snd(e, 'arcane', c.start);
    },
  },
  shieldBreaker: {
    windup: 220,
    play: (e, c) => {
      const sq = first(c);
      const p = e.c(sq);
      dome(e, sq, PX.steel, PX.white, c.start);
      e.at(c.impact, () => {
        squareWash(e, sq, { color: PX.white, dur: 160, alpha: 0.9, layer: 1 });
        burst(e, p.x, p.y, { n: 26, ramp: RAMP.steel, speed: [40, 90], life: [260, 480], gravity: 260, floor: p.y + 9 });
        burst(e, p.x, p.y, { n: 10, ramp: RAMP.spark, speed: [60, 110], life: [100, 200], shape: 2 });
        ring(e, p.x, p.y, { r0: 6, r1: 20, dur: 300, color: PX.steel, thick: 2 });
        e.shake(2, 200);
      });
      snd(e, 'shield', c.start);
      snd(e, 'capture', c.impact);
    },
  },
  dragonFire: {
    destroy: 'burn',
    windup: 160,
    stagger: (sq, c) => {
      const from = c.targets[0];
      if (from === undefined) return 0;
      const d = Math.max(Math.abs((sq % 8) - (from % 8)), Math.abs(Math.floor(sq / 8) - Math.floor(from / 8)));
      return d * 70;
    },
    play: (e, c) => {
      const from = c.targets[0];
      const dir = c.targets[1];
      if (from === undefined) return;
      const a = e.c(from);
      // direction square is the second pick; sweep to the board edge
      let path = [from];
      if (dir !== undefined) {
        const df = Math.sign((dir % 8) - (from % 8));
        const dr = Math.sign(Math.floor(dir / 8) - Math.floor(from / 8));
        let f = from % 8;
        let r = Math.floor(from / 8);
        path = [];
        while (f >= 0 && f < 8 && r >= 0 && r < 8) {
          path.push(r * 8 + f);
          f += df;
          r += dr;
        }
      }
      const end = e.c(path[path.length - 1]);
      const dur = 70 * Math.max(1, path.length - 1) + 60;
      glyphCircle(e, from, { color: RAMP.fire[3], dur: 300, delay: c.start });
      projectile(e, a, end, {
        dur,
        delay: c.impact,
        head: (b, x, y) => {
          b.disc(x, y, 6, RAMP.fire[3], 0.9);
          b.disc(x, y, 4, RAMP.fire[1]);
          b.disc(x, y, 2, RAMP.fire[0]);
        },
        trail: { ramp: RAMP.fire, rate: 420, life: [260, 520], size: [1, 3], gravity: -30, speed: [6, 24] },
      });
      path.forEach((sq, i) => squareWash(e, sq, { color: RAMP.fire[4], dur: 480, alpha: 0.55, delay: c.impact + i * 70 }));
      e.at(c.impact + 40, () => e.shake(1, dur));
      snd(e, 'fire', c.start);
      snd(e, 'fire', c.impact + 80);
    },
  },
  doomsday: {
    // the Reaper: it draws and cuts down its victims itself (see reaper.ts)
    windup: 240,
    ghosts: false,
    stagger: (sq, c) => reaperHit(c.squares, sq),
    play: (e, c) => playReaper(e, c),
  },
};

/** The effect of a cast – the awakened form's own one when the card has it. */
export const spellFx = (id: SpellId, awakened = false): SpellFx => (awakened && SPELL_FX[id].awakened) || SPELL_FX[id];

/** Timing for a spell (with defaults). */
export const spellTiming = (id: SpellId, awakened = false) => {
  const s = spellFx(id, awakened);
  return {
    windup: s.windup ?? 180,
    move: s.move ?? 'slide',
    moveDur: s.moveDur ?? 240,
    destroy: s.destroy ?? 'shatter',
    appear: s.appear ?? 'appear',
  };
};
