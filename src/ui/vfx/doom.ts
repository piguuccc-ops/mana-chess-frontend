// ─────────────────────────────────────────────────────────────────────────────
// „Végzet”. The plain form (the card's first cast) is one short, heavy blow: the doomed piece
// shakes, cracks and bursts, and the shockwave throws its neighbours. The awakened form (once
// the card has gone round the deck) is the cinematic. The mana is sucked back and the crystals shatter, the music
// stops dead, a thin circle marks the doomed piece… and nothing happens. Then the board
// goes dark, reality cracks around the piece, it lifts off the board and flickers, every
// way it could have been saved appears and breaks (a shield, a fortification, a rewind,
// a resurrection sigil, a clone), its edges go missing, it is pulled into a singularity
// and collapses. The shockwave throws its neighbours outward and fractures the board. A
// rewind tries to undo it – ERROR – and is dragged into the void too; a square of the
// board blinks out of existence, the word VÉGZET falls apart, one bass hit brings the
// music back. Afterwards: nothing. No corpse, no grave – an empty square.
// ─────────────────────────────────────────────────────────────────────────────
import { maxMana } from '../../engine';
import { sfx, type SfxName } from '../audio/sound';
import { pack, type PackedSprite, type PixelBuffer } from './buffer';
import { SQ, type VfxEngine, type XY } from './engine';
import { breakSprite, burst, easeIn, easeInOut, easeOut, irand, lerp, rand, ring, smoke, spriteOrigin } from './fx';
import { MANA_RAMP, PX, RAMP } from './palettes';
import type { SpellCtx } from './spells';
import { pieceSpr } from './sprites';
import { textSprite } from './text';

/** The plain form's timeline (ms after the card reaches the board). */
export const DOOM_PLAIN = {
  cracks: [150, 280, 390],
  impact: 480,
  pay: 830,
  paid: 1430,
  end: 1600,
} as const;

/** The awakened form's timeline (ms after the card reaches the board). */
export const DOOM = {
  circle: 350,
  dark: 850,
  cracks: [950, 1100, 1250],
  saves: 1500,
  saveStep: 300,
  silence: 3000,
  singularity: 3900,
  boom: 4350,
  rewind: 5150,
  error: 5550,
  drag: 5800,
  hole: 6150,
  word: 6450,
  bass: 6900,
  /** The price, paid to the other side: one mote of mana climbs out of the void… */
  pay: 7000,
  /** …and forms a crystal for the opponent. */
  paid: 7700,
  end: 8000,
} as const;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// a near-black with real alpha, in 33 steps (the overlay is drawn per pixel)
const DARK = Array.from({ length: 33 }, (_, i) => pack('#05030a', i / 32));
const dark = (a: number) => DARK[Math.round(clamp01(a) * 32)];

const VOID = pack('#000000');
const SPLIT = pack('#1a0f0a');
const SPLINTER = pack('#bf915e');
const VIOLET = RAMP.arcane;
const WHITE = PX.white;

/** Distance of every opaque pixel from the sprite's silhouette edge (0 = on the edge). */
function edgeDistance(spr: PackedSprite): Int16Array {
  const d = new Int16Array(spr.px.length).fill(-1);
  const q: number[] = [];
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < spr.w && y < spr.h && spr.px[y * spr.w + x] !== 0;
  for (let y = 0; y < spr.h; y++) {
    for (let x = 0; x < spr.w; x++) {
      if (!solid(x, y)) continue;
      if (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)) {
        d[y * spr.w + x] = 0;
        q.push(y * spr.w + x);
      }
    }
  }
  for (let k = 0; k < q.length; k++) {
    const i = q[k];
    const x = i % spr.w;
    const y = Math.floor(i / spr.w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (!solid(nx, ny)) continue;
      const j = ny * spr.w + nx;
      if (d[j] >= 0) continue;
      d[j] = d[i] + 1;
      q.push(j);
    }
  }
  return d;
}

interface Crack {
  born: number;
  pts: XY[];
  /** 'reality': glowing white fissures in the air; 'board': dark fractures in the wood. */
  kind: 'reality' | 'board';
}

/** A jagged crack from `o` heading along `angle`, with the odd branch. */
function makeCrack(o: XY, angle: number, len: number, born: number, kind: Crack['kind'], out: Crack[], depth = 0): void {
  const pts: XY[] = [];
  let x = o.x;
  let y = o.y;
  let a = angle;
  const seen = new Set<string>();
  for (let i = 0; i < len; i++) {
    if (i % 3 === 0) a += rand(-0.45, 0.45);
    x += Math.cos(a);
    y += Math.sin(a);
    const key = `${Math.round(x)},${Math.round(y)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pts.push({ x: Math.round(x), y: Math.round(y) });
    if (depth < 1 && i > 4 && Math.random() < 0.05) {
      makeCrack({ x, y }, a + (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 0.9), Math.round(len * rand(0.3, 0.5)), born + i * 12, kind, out, depth + 1);
    }
  }
  out.push({ born, pts, kind });
}

export function playDoom(e: VfxEngine, c: SpellCtx): void {
  const sq = c.targets[0] ?? c.squares[0];
  if (sq === undefined) return;
  const victim = c.removed.find((r) => r.sq === sq)?.piece ?? c.before.board[sq];
  if (!victim) return;
  const S = c.start;
  const at = (ms: number) => S + ms;
  const snd = (name: SfxName, ms: number) =>
    e.at(at(ms), () => {
      if (!e.muted) sfx(name);
    });

  const spr = pieceSpr(victim.type, victim.color);
  const o = spriteOrigin(e, sq, spr);
  const sqc = e.c(sq);
  const board = e.boardRect();
  const FLOAT = 7;
  const floatAt = (ms: number) => -FLOAT * easeInOut(clamp01((ms - DOOM.cracks[0]) / 2400));
  /** The heart of the piece, where it collapses (it has floated up by then). */
  const P: XY = { x: o.x + spr.w / 2, y: o.y + spr.h * 0.55 - FLOAT };
  const dist = edgeDistance(spr);
  let maxD = 0;
  for (let i = 0; i < dist.length; i++) maxD = Math.max(maxD, dist[i]);
  const cracks: Crack[] = [];
  let flashUntil = -1;

  // ── the price: every mote of mana is sucked back to the caster and the crystals shatter ──
  // (both crystal rows are measured now, while the camera is still at rest)
  const cryst = e.elementCenter(e.query(`[data-crystals="${c.caster}"]`)) ?? { x: board.x + board.w / 2, y: board.y + board.h + 20 };
  payMote(e, c, { x: sqc.x, y: sqc.y - 1 }, at(DOOM.pay), DOOM.paid - DOOM.pay);
  const ramp = MANA_RAMP[c.caster];
  const motes = Array.from({ length: e.reduced ? 12 : 36 }, () => ({
    x: board.x + rand(0, board.w),
    y: board.y + rand(0, board.h),
    lag: rand(0, 0.35),
    c: ramp[irand(0, 2)],
  }));
  e.add({
    delay: at(0),
    dur: 420,
    layer: 1,
    draw: (b, p) => {
      for (const m of motes) {
        const t = clamp01((p - m.lag) / (1 - m.lag));
        if (t <= 0 || t >= 1) continue;
        const k = easeIn(t);
        const x = lerp(m.x, cryst.x, k);
        const y = lerp(m.y, cryst.y, k);
        const k2 = easeIn(Math.max(0, t - 0.12));
        b.line(lerp(m.x, cryst.x, k2), lerp(m.y, cryst.y, k2), x, y, m.c);
      }
    },
  });
  e.at(at(330), () => {
    burst(e, cryst.x, cryst.y, { n: 24, ramp: [WHITE, ...ramp], speed: [30, 90], life: [200, 420], gravity: 160, shape: 2, drag: 2 });
    ring(e, cryst.x, cryst.y, { r0: 3, r1: 16, dur: 260, color: WHITE });
  });
  snd('doomCast', 0);
  // the music stops – not fades, stops – and comes back with the bass hit
  e.at(at(0), () => {
    if (!e.muted) e.onSilence?.(DOOM.bass);
  });

  // ── the darkness (under everything that still shines) ──
  e.add({
    delay: at(DOOM.dark),
    dur: DOOM.bass + 650 - DOOM.dark,
    layer: 0,
    draw: (b, _p, ms) => {
      const t = ms + DOOM.dark;
      let base = 0.9 * clamp01(ms / 160);
      let spot = true;
      if (t >= DOOM.boom) {
        spot = false;
        base = t < DOOM.bass ? 0.55 : 0.55 * (1 - clamp01((t - DOOM.bass) / 600));
      }
      const x0 = board.x - 12;
      const y0 = board.y - 12;
      const x1 = board.x + board.w + 12;
      const y1 = board.y + board.h + 12;
      const fy = floatAt(t);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          let a = base;
          if (spot) {
            const d = Math.hypot(x + 0.5 - (o.x + spr.w / 2), y + 0.5 - (o.y + spr.h / 2 + fy));
            a *= 0.2 + 0.8 * smooth(8, 26, d);
          }
          if (a > 0.01) b.dot(x, y, dark(a));
        }
      }
    },
  });

  // ── a thin circle under the doomed piece … and for half a second, nothing ──
  e.add({
    delay: at(DOOM.circle),
    dur: DOOM.boom - DOOM.circle,
    layer: 1,
    draw: (b, _p, ms) => {
      const a = clamp01(ms / 200);
      const pulse = 0.75 + 0.25 * Math.sin(ms / 110);
      b.circle(sqc.x, sqc.y + 7, 8, WHITE, a * pulse, 0.4);
      if (ms > 500) b.circle(sqc.x, sqc.y + 7, 9, VIOLET[1], a * 0.5, 0.4);
    },
  });

  // ── the ways it could have been saved – each appears, and each breaks ──
  type Save = 'shield' | 'fortify' | 'rewind' | 'sigil' | 'clone';
  const saves: Save[] = ['shield', 'fortify', 'rewind', 'sigil', 'clone'];
  const saveStart = (i: number) => DOOM.saves + i * DOOM.saveStep;
  const drawSave = (kind: Save, b: PixelBuffer, ms: number) => {
    const t0 = saveStart(saves.indexOf(kind));
    const k = ms - t0;
    if (k < 0 || k > 230) return;
    const grow = easeOut(clamp01(k / 170));
    const flash = k >= 200;
    const fy = floatAt(ms);
    const cx = o.x + spr.w / 2;
    const cy = o.y + spr.h / 2 + fy;
    if (kind === 'shield') {
      const r = lerp(5, 12, grow);
      b.circle(cx, cy, r, flash ? WHITE : RAMP.steel[1], 1);
      b.circle(cx, cy, r - 1, flash ? WHITE : RAMP.steel[0], 0.5);
      const g = -Math.PI / 2 - k / 60;
      b.dot(cx + Math.cos(g) * r, cy + Math.sin(g) * r, WHITE);
    } else if (kind === 'fortify') {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        const r = lerp(18, 11, grow);
        const x = cx + Math.cos(a) * r - 1;
        const y = cy + Math.sin(a) * r * 0.8 - 1;
        b.rect(x, y, 3, 3, flash ? WHITE : RAMP.stone[1]);
        b.rect(x, y + 2, 3, 1, flash ? WHITE : RAMP.stone[3]);
      }
    } else if (kind === 'rewind') {
      const r = lerp(2, 8, grow);
      const x = cx;
      const y = o.y + fy - 1;
      b.circle(x, y, r, flash ? WHITE : RAMP.time[2]);
      b.circle(x, y, r - 1, flash ? WHITE : RAMP.time[3], 0.5);
      const h = -k / 40;
      b.line(x, y, x + Math.cos(h) * (r - 2), y + Math.sin(h) * (r - 2), flash ? WHITE : RAMP.time[0]);
      b.line(x, y, x, y - (r - 3), flash ? WHITE : RAMP.time[1]);
    } else if (kind === 'sigil') {
      const r = lerp(3, 11, grow);
      const col = flash ? WHITE : RAMP.nature[1];
      b.circle(sqc.x, sqc.y + 7, r, col, 1, 0.4);
      b.circle(sqc.x, sqc.y + 7, r - 3, col, 0.6, 0.4);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + k / 160;
        b.dot(sqc.x + Math.cos(a) * (r - 1.5), sqc.y + 7 + Math.sin(a) * (r - 1.5) * 0.4, flash ? WHITE : RAMP.nature[0]);
      }
    } else {
      // a clone materialising beside it, row by row from the floor up
      const shown = Math.floor(spr.h * grow);
      b.sprite(spr, o.x + 15, o.y + fy, 0.6, flash ? WHITE : RAMP.teal[1], (_sx, sy) => sy >= spr.h - shown);
    }
  };
  const breakSave = (kind: Save, ms: number) => {
    const fy = floatAt(ms);
    const cx = o.x + spr.w / 2;
    const cy = o.y + spr.h / 2 + fy;
    if (kind === 'shield') {
      for (let i = 0; i < (e.reduced ? 6 : 18); i++) {
        const a = (i / 18) * Math.PI * 2;
        e.spawn({
          x: cx + Math.cos(a) * 12, y: cy + Math.sin(a) * 12, vx: Math.cos(a) * rand(40, 80), vy: Math.sin(a) * rand(40, 80) - 10,
          ax: 0, ay: 200, drag: 1.5, life: rand(260, 420), age: 0, size: 1, ramp: RAMP.steel, fade: true, shape: 2,
        });
      }
    } else if (kind === 'fortify') {
      burst(e, cx, cy, { n: 22, ramp: RAMP.stone, speed: [40, 90], life: [300, 520], gravity: 260, size: [1, 2], floor: sqc.y + 9 });
    } else if (kind === 'rewind') {
      burst(e, cx, o.y + fy - 1, { n: 18, ramp: RAMP.time, speed: [40, 90], life: [220, 380], shape: 2, drag: 2 });
    } else if (kind === 'sigil') {
      burst(e, sqc.x, sqc.y + 7, { n: 20, ramp: RAMP.nature, speed: [30, 70], life: [260, 460], gravity: -30, box: { w: 20, h: 4 } });
    } else {
      breakSprite(e, spr, { x: o.x + 15, y: o.y + fy }, 'blink');
    }
    ring(e, cx, cy, { r0: 4, r1: 16, dur: 180, color: WHITE });
    flashUntil = ms + 70;
    e.shake(1, 120);
    const a = rand(0, Math.PI * 2);
    makeCrack({ x: cx + Math.cos(a) * 5, y: cy + Math.sin(a) * 5 }, a, irand(12, 20), ms, 'reality', cracks);
  };
  saves.forEach((kind, i) => {
    snd('ward', saveStart(i));
    snd('realityCrack', saveStart(i) + 200);
    e.at(at(saveStart(i) + 200), () => breakSave(kind, saveStart(i) + 200));
  });
  // the rewind clock hangs behind the piece, the sigil lies beneath it: drawn before the piece
  e.add({
    delay: at(DOOM.saves),
    dur: DOOM.saveStep * 5,
    layer: 1,
    draw: (b, _p, ms) => {
      drawSave('rewind', b, ms + DOOM.saves);
      drawSave('sigil', b, ms + DOOM.saves);
    },
  });

  // ── the doomed piece: it lifts, flickers, loses its edges and is pulled into a point ──
  const colors = spr.px;
  e.add({
    delay: at(0),
    dur: DOOM.boom,
    layer: 1,
    draw: (b, _p, t) => {
      const fy = floatAt(t);
      const unstable = clamp01((t - 1300) / 1700);
      const jx = unstable > 0 && Math.random() < unstable * 0.5 ? irand(-1, 1) : 0;
      const ox = Math.round(o.x + jx);
      const oy = Math.round(o.y + fy);
      // the floor shadow shrinks as it rises
      if (t < DOOM.singularity) b.disc(sqc.x, sqc.y + 8, 6 - (-fy / FLOAT) * 3, PX.shadow, 1, 0.35);
      const lit = t < flashUntil;
      if (t < DOOM.singularity) {
        // edges go missing – not dark, not burned: missing (the board shows through)
        const eat = t >= DOOM.silence ? easeIn(clamp01((t - DOOM.silence) / (DOOM.singularity - DOOM.silence))) * (maxD * 0.6 + 1) : -1;
        for (let y = 0; y < spr.h; y++) {
          for (let x = 0; x < spr.w; x++) {
            const i = y * spr.w + x;
            const col = colors[i];
            if (!col) continue;
            const d = dist[i];
            if (d < eat - 1) continue;
            let cc = col;
            if (d < eat) cc = VOID;
            else if (lit) cc = WHITE;
            else if (unstable > 0 && Math.random() < unstable * 0.1) cc = Math.random() < 0.5 ? WHITE : VIOLET[1];
            b.dot(ox + x, oy + y, cc);
          }
        }
        return;
      }
      // the singularity: everything left stretches into one microscopic point
      const u = clamp01((t - DOOM.singularity) / (DOOM.boom - DOOM.singularity));
      const eat = maxD * 0.6 + 1;
      for (let y = 0; y < spr.h; y++) {
        for (let x = 0; x < spr.w; x++) {
          const i = y * spr.w + x;
          if (!colors[i] || dist[i] < eat - 1) continue;
          const lag = (dist[i] / Math.max(1, maxD)) * 0.35;
          const k = easeIn(clamp01((u - lag) / (1 - lag)));
          const k0 = easeIn(clamp01((u - lag - 0.1) / (1 - lag)));
          const sx = o.x + x;
          const syy = o.y + fy + y;
          b.line(lerp(sx, P.x, k0), lerp(syy, P.y, k0), lerp(sx, P.x, k), lerp(syy, P.y, k), k > 0.7 ? WHITE : colors[i]);
        }
      }
      b.rect(P.x - 1, P.y - 1, 2, 2, WHITE);
    },
  });
  e.add({
    delay: at(DOOM.saves),
    dur: DOOM.saveStep * 5,
    layer: 1,
    draw: (b, _p, ms) => {
      drawSave('shield', b, ms + DOOM.saves);
      drawSave('fortify', b, ms + DOOM.saves);
      drawSave('clone', b, ms + DOOM.saves);
    },
  });

  // ── the first cracks: not in the board – in reality ──
  DOOM.cracks.forEach((t, i) => {
    e.at(at(t), () => {
      const a = [Math.PI * 0.75, Math.PI * 0.2, Math.PI * 1.1][i];
      makeCrack({ x: sqc.x + irand(-2, 2), y: sqc.y + 7 }, a, irand(14, 22), t, 'reality', cracks);
    });
    snd('realityCrack', t);
  });
  e.add({
    delay: at(DOOM.cracks[0]),
    dur: DOOM.end - DOOM.cracks[0],
    layer: 1,
    draw: (b, _p, ms) => {
      const t = ms + DOOM.cracks[0];
      const closing = t > DOOM.bass ? easeIn(clamp01((t - DOOM.bass) / 900)) : 0;
      for (const cr of cracks) {
        const grow = easeOut(clamp01((t - cr.born) / (cr.kind === 'board' ? 260 : 600)));
        const n = Math.floor(cr.pts.length * grow * (1 - closing));
        for (let i = 0; i < n; i++) {
          const p = cr.pts[i];
          if (cr.kind === 'reality') {
            b.dot(p.x + 1, p.y, VIOLET[1], 0.6);
            b.dot(p.x, p.y + 1, VIOLET[2], 0.5);
            b.dot(p.x, p.y, WHITE);
          } else {
            // a fracture in the wood: a dark split with a pale, splintered lip
            b.dot(p.x + 1, p.y + 1, SPLINTER, 0.55);
            b.dot(p.x, p.y, SPLIT);
          }
        }
      }
    },
  });

  // ── silence; the camera creeps in ──
  e.at(at(DOOM.silence), () => {
    if (!e.reduced) e.onCamera?.({ focus: P, zoom: 1.22, inMs: 900, holdMs: DOOM.bass - DOOM.silence - 900, outMs: 700 });
  });
  snd('singularity', DOOM.singularity);

  // ── BOOM. It does not explode – it collapses. ──
  snd('doomBoom', DOOM.boom);
  e.at(at(DOOM.boom), () => {
    const t = DOOM.boom;
    ring(e, P.x, P.y, { r0: 2, r1: 84, dur: 560, color: WHITE, thick: 2 });
    ring(e, P.x, P.y, { r0: 2, r1: 62, dur: 500, color: VIOLET[1], delay: 60 });
    ring(e, sqc.x, sqc.y + 7, { r0: 4, r1: 70, dur: 620, color: VIOLET[2], squash: 0.45, layer: 0 });
    burst(e, P.x, P.y, { n: 70, ramp: [VIOLET[2], ...RAMP.shadow], speed: [70, 180], life: [500, 900], gravity: 140, drag: 1.3, size: [1, 2] });
    burst(e, P.x, P.y, { n: 26, ramp: [WHITE, VIOLET[0], VIOLET[1]], speed: [140, 260], life: [150, 320], shape: 2, drag: 1 });
    burst(e, P.x, P.y, { n: 24, ramp: VIOLET, speed: [30, 80], life: [400, 800], drag: 2, flicker: 0.2 });
    smoke(e, sqc.x, sqc.y + 4, 14, 80, 10);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rand(-0.3, 0.3);
      makeCrack({ x: sqc.x, y: sqc.y + 2 }, a, irand(26, 44), t + i * 18, 'board', cracks);
    }
    e.shake(5, 650);
  });
  // the collapse itself: a point of light, a white flash
  e.add({
    delay: at(DOOM.boom),
    dur: 140,
    layer: 1,
    draw: (b, p) => {
      b.disc(P.x, P.y, lerp(3, 36, easeOut(p)), WHITE, 1 - p, 1, (d) => 1 - d * 0.6);
    },
  });

  // ── the square keeps glowing … a rewind tries to bring it back … ERROR ──
  e.add({
    delay: at(DOOM.boom + 250),
    dur: DOOM.hole - DOOM.boom - 250,
    layer: 1,
    draw: (b, _p, ms) => {
      const a = 0.35 + 0.2 * Math.sin(ms / 140);
      b.disc(sqc.x, sqc.y, 9, VIOLET[0], a, 1, (d) => 1 - d);
    },
  });
  const errText = textSprite('ERROR', 'pixel', (k) => (k > 0.5 ? pack('#ff6a4a') : pack('#b3322c')), pack('#07060a'));
  const clockAt = { x: sqc.x, y: sqc.y - 5 };
  e.add({
    delay: at(DOOM.rewind),
    dur: DOOM.hole - DOOM.rewind,
    layer: 1,
    draw: (b, _p, ms) => {
      const t = ms + DOOM.rewind;
      let r = lerp(0, 8, easeOut(clamp01(ms / 150)));
      let cx = clockAt.x;
      let cy = clockAt.y;
      if (t >= DOOM.drag + 100) {
        // dragged into the square and erased
        const k = easeIn(clamp01((t - DOOM.drag - 100) / (DOOM.hole - DOOM.drag - 100)));
        r *= 1 - k;
        cx = lerp(clockAt.x, sqc.x, k);
        cy = lerp(clockAt.y, sqc.y, k);
        if (r < 0.6) return;
      }
      const hand = -t / (t < DOOM.error ? 35 : 12);
      const glitch = t >= DOOM.error && t < DOOM.error + 250;
      const drawClock = (dx: number, dy: number, tint?: number) => {
        b.circle(cx + dx, cy + dy, r, tint ?? RAMP.time[1]);
        b.circle(cx + dx, cy + dy, Math.max(0, r - 1), tint ?? RAMP.time[3], 0.5);
        b.line(cx + dx, cy + dy, cx + dx + Math.cos(hand) * (r - 2), cy + dy + Math.sin(hand) * (r - 2), tint ?? WHITE);
        // the backwards arrow on the rim
        const ax = cx + dx - r * 0.7;
        const ay = cy + dy - r * 0.7;
        b.line(ax, ay, ax + 2, ay, tint ?? RAMP.time[0]);
        b.line(ax, ay, ax, ay + 2, tint ?? RAMP.time[0]);
      };
      if (glitch) {
        drawClock(-2, 0, pack('#e05a33'));
        drawClock(2, 0, pack('#8fd8f5'));
        const slice = irand(-2, 2);
        drawClock(slice, 0);
        if (Math.floor(t / 50) % 2 === 0) b.sprite(errText, cx - errText.w / 2 + irand(-1, 1), cy - r - errText.h - 2);
      } else {
        drawClock(0, 0);
      }
      if (t >= DOOM.drag && t < DOOM.drag + 160) {
        // the symbol cracks
        b.line(cx - r, cy - 2, cx + 1, cy + 1, WHITE);
        b.line(cx + 1, cy + 1, cx + r - 1, cy - 3, WHITE);
        b.line(cx + 1, cy + 1, cx - 1, cy + r, WHITE);
      }
    },
  });
  snd('ward', DOOM.rewind);
  snd('glitch', DOOM.error);
  snd('realityCrack', DOOM.drag);
  snd('erase', DOOM.hole - 40);
  e.at(at(DOOM.error), () => e.shake(1, 200));

  // ── a tiny piece of the board blinks out of existence ──
  const hole = e.sq(sq);
  const stars = Array.from({ length: 7 }, () => ({ x: irand(2, SQ - 3), y: irand(2, SQ - 3), c: Math.random() < 0.5 ? WHITE : VIOLET[1] }));
  e.add({
    delay: at(DOOM.hole),
    dur: DOOM.word - DOOM.hole + 120,
    layer: 1,
    draw: (b, p, ms) => {
      const a = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      b.rect(hole.x, hole.y, SQ, SQ, VOID, a);
      if (ms < 60) b.frame(hole.x - 1, hole.y - 1, SQ + 2, SQ + 2, WHITE);
      for (const s of stars) if (Math.random() < 0.6) b.dot(hole.x + s.x, hole.y + s.y, s.c, a);
    },
  });

  // ── VÉGZET … and then the letters themselves come apart ──
  const word = textSprite(
    'VÉGZET',
    'gothic',
    (k) => (k > 0.82 ? WHITE : k > 0.6 ? VIOLET[0] : k > 0.4 ? VIOLET[1] : k > 0.2 ? VIOLET[2] : VIOLET[3]),
    pack('#07060a'),
  );
  const K = 2;
  const wx = Math.round(board.x + (board.w - word.w * K) / 2);
  const wy = Math.round(board.y + board.h / 2 - (word.h * K) / 2);
  const crumble = DOOM.bass;
  const colDelay = (sx: number) => (sx / word.w) * 520;
  e.add({
    delay: at(DOOM.word),
    dur: crumble - DOOM.word + 560,
    layer: 1,
    draw: (b, _p, ms) => {
      const t = ms + DOOM.word;
      const a = clamp01(ms / 120);
      const pop = ms < 120 ? Math.round((1 - ms / 120) * 3) : 0;
      for (let sy = 0; sy < word.h; sy++) {
        for (let sx = 0; sx < word.w; sx++) {
          const col = word.px[sy * word.w + sx];
          if (!col) continue;
          if (t >= crumble + colDelay(sx)) continue; // this pixel has already flown off
          b.rect(wx + sx * K, wy + sy * K - pop, K, K, col, a);
        }
      }
    },
  });
  e.at(at(crumble), () => {
    for (let sy = 0; sy < word.h; sy++) {
      for (let sx = 0; sx < word.w; sx++) {
        const col = word.px[sy * word.w + sx];
        if (!col || (e.reduced && (sx + sy) % 3)) continue;
        e.spawn({
          x: wx + sx * K + 1, y: wy + sy * K + 1, vx: rand(10, 34), vy: rand(-24, -6), ax: 0, ay: -12, drag: 0.8,
          life: rand(500, 900), age: -colDelay(sx), size: K, ramp: [col, VIOLET[2], VIOLET[3], RAMP.shadow[2]], fade: true, shape: 0,
        });
      }
    }
  });

  // ── one gigantic bass hit: the music is back, the dust settles, the cracks close ──
  snd('doomBass', DOOM.bass);
  e.at(at(DOOM.bass), () => {
    e.shake(2, 300);
    for (let i = 0; i < (e.reduced ? 5 : 16); i++) {
      e.spawn({
        x: board.x + rand(0, board.w), y: board.y + rand(board.h * 0.3, board.h), vx: rand(8, 22), vy: rand(-8, -2), ax: 0, ay: -2,
        drag: 0.2, life: rand(900, 1500), age: -rand(0, 300), size: irand(2, 3), ramp: RAMP.smoke, fade: true, shape: 0,
      });
    }
  });
}

/**
 * The price is paid to the other side: one mote of mana climbs out of the struck square and flies
 * to the opponent's crystals, landing in the socket its new crystal forms in (the last one when
 * full). The crystals are measured now, while the camera is still at rest.
 */
function payMote(e: VfxEngine, c: SpellCtx, from: XY, at: number, dur: number): void {
  const opp = c.caster === 'w' ? 'b' : 'w';
  const slot = Math.max(0, Math.min(maxMana(c.after, opp) - 1, c.before.players[opp].mana));
  const to = e.elementCenter(e.query(`[data-crystals="${opp}"] [data-slot="${slot}"]`)) ?? e.elementCenter(e.query(`[data-crystals="${opp}"]`));
  if (!to) return;
  const ramp = MANA_RAMP[opp];
  // up out of the square first, then a long curve over to the crystals
  const ctrl: XY = { x: lerp(from.x, to.x, 0.3), y: Math.min(from.y, to.y) - 22 };
  const path = (k: number): XY => ({
    x: (1 - k) * (1 - k) * from.x + 2 * (1 - k) * k * ctrl.x + k * k * to.x,
    y: (1 - k) * (1 - k) * from.y + 2 * (1 - k) * k * ctrl.y + k * k * to.y,
  });
  e.at(at, () => burst(e, from.x, from.y, { n: 8, ramp, speed: [8, 24], life: [240, 420], drag: 2, gravity: -20 }));
  e.add({
    delay: at,
    dur,
    layer: 1,
    draw: (b, p, ms) => {
      const k = easeInOut(p);
      for (let i = 7; i >= 1; i--) {
        const q = path(Math.max(0, k - i * 0.022));
        b.dot(Math.round(q.x), Math.round(q.y), ramp[Math.min(ramp.length - 1, 1 + (i >> 1))], 1 - i / 9);
      }
      const q = path(k);
      const glow = 0.5 + 0.5 * Math.sin(ms / 45);
      b.disc(q.x, q.y, 3, ramp[1], 0.35 * glow, 1, (d) => 1 - d);
      b.rect(Math.round(q.x) - 1, Math.round(q.y) - 1, 2, 2, ramp[0]);
    },
    done: () => {
      ring(e, to.x, to.y, { r0: 2, r1: 14, dur: 280, color: ramp[1] });
      burst(e, to.x, to.y, { n: 12, ramp: [WHITE, ...ramp], speed: [20, 50], life: [200, 380], drag: 2, shape: 2 });
    },
  });
}

/**
 * The plain form: a thin circle closes under the piece, it shakes and cracks – violet light
 * through the cracks – then it bursts, and the shockwave throws its neighbours and splits the
 * wood. The pieces of it stay behind as dust: this one could still come back.
 */
export function playDoomPlain(e: VfxEngine, c: SpellCtx): void {
  const sq = c.targets[0] ?? c.squares[0];
  if (sq === undefined) return;
  const victim = c.removed.find((r) => r.sq === sq)?.piece ?? c.before.board[sq];
  if (!victim) return;
  const S = c.start;
  const at = (ms: number) => S + ms;
  const snd = (name: SfxName, ms: number) =>
    e.at(at(ms), () => {
      if (!e.muted) sfx(name);
    });
  const T = DOOM_PLAIN;
  const spr = pieceSpr(victim.type, victim.color);
  const o = spriteOrigin(e, sq, spr);
  const sqc = e.c(sq);
  const heart: XY = { x: o.x + spr.w / 2, y: o.y + spr.h * 0.55 };

  // cracks across the piece itself (only where it has pixels), then fractures in the board
  const onPiece: XY[][] = [];
  const board: Crack[] = [];
  const solid = (x: number, y: number) => {
    const sx = Math.round(x - o.x);
    const sy = Math.round(y - o.y);
    return sx >= 0 && sy >= 0 && sx < spr.w && sy < spr.h && spr.px[sy * spr.w + sx] !== 0;
  };
  T.cracks.forEach((t, i) => {
    e.at(at(t), () => {
      const tmp: Crack[] = [];
      const a = [-Math.PI * 0.35, Math.PI * 0.85, Math.PI * 0.2][i];
      makeCrack({ x: heart.x + irand(-1, 1), y: heart.y + irand(-2, 1) }, a, irand(7, 11), t, 'reality', tmp);
      for (const cr of tmp) onPiece.push(cr.pts.filter((q) => solid(q.x, q.y)));
    });
    snd('realityCrack', t);
  });
  snd('dark', 0);

  // the circle under it, the shaking piece, light through its cracks
  e.add({
    delay: at(0),
    dur: T.impact,
    layer: 1,
    draw: (b, p, ms) => {
      const a = clamp01(ms / 120);
      b.disc(sqc.x, sqc.y + 7, 8, dark(0.55 * a), 1, 0.4);
      b.circle(sqc.x, sqc.y + 7, lerp(11, 8, easeOut(p)), WHITE, a, 0.4);
      const shake = p > 0.25 ? Math.round(rand(-1, 1) * Math.min(1, (p - 0.25) * 2)) : 0;
      const lit = ms > T.impact - 70;
      b.sprite(spr, o.x + shake, o.y, 1, lit ? WHITE : undefined);
      for (const pts of onPiece) {
        for (const q of pts) {
          b.dot(q.x + shake, q.y, lit ? WHITE : VIOLET[0]);
          b.dot(q.x + shake + 1, q.y, VIOLET[1], 0.5);
        }
      }
    },
  });

  // the blow: it bursts, the shockwave throws the neighbours and splits the wood
  snd('doomBlast', T.impact);
  e.at(at(T.impact), () => {
    breakSprite(e, spr, o, 'shatter');
    ring(e, heart.x, heart.y, { r0: 2, r1: 46, dur: 380, color: WHITE, thick: 2 });
    ring(e, sqc.x, sqc.y + 7, { r0: 4, r1: 40, dur: 460, color: VIOLET[2], squash: 0.45, layer: 0 });
    burst(e, heart.x, heart.y, { n: 36, ramp: [VIOLET[1], VIOLET[2], ...RAMP.shadow], speed: [50, 130], life: [300, 620], gravity: 160, drag: 1.4, size: [1, 2] });
    burst(e, heart.x, heart.y, { n: 14, ramp: [WHITE, VIOLET[0], VIOLET[1]], speed: [100, 200], life: [120, 260], shape: 2, drag: 1 });
    smoke(e, sqc.x, sqc.y + 5, 8, 60, 8);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rand(-0.4, 0.4);
      makeCrack({ x: sqc.x, y: sqc.y + 3 }, a, irand(14, 24), T.impact + i * 20, 'board', board);
    }
    e.shake(3, 360);
  });
  e.add({
    delay: at(T.impact),
    dur: 120,
    layer: 1,
    draw: (b, p) => b.disc(heart.x, heart.y, lerp(3, 22, easeOut(p)), WHITE, 1 - p, 1, (d) => 1 - d * 0.6),
  });
  e.add({
    delay: at(T.impact),
    dur: T.end + 500 - T.impact,
    layer: 0,
    draw: (b, p, ms) => {
      const fade = p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1;
      for (const cr of board) {
        const n = Math.floor(cr.pts.length * easeOut(clamp01((ms + T.impact - cr.born) / 220)));
        for (let i = 0; i < n; i++) {
          const q = cr.pts[i];
          b.dot(q.x + 1, q.y + 1, SPLINTER, 0.55 * fade);
          b.dot(q.x, q.y, SPLIT, fade);
        }
      }
    },
  });

  payMote(e, c, { x: sqc.x, y: sqc.y - 1 }, at(T.pay), T.paid - T.pay);
}
