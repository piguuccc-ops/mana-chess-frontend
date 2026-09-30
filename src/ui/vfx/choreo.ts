// ─────────────────────────────────────────────────────────────────────────────
// Choreography: turns one engine step (action + state before/after + events)
// into a timed plan – how each piece travels, when captured pieces break,
// when mana crystals crack or form, when the turn banner may show – plus the
// canvas effects and sounds that go with it. The engine itself stays pure;
// this module only reads what happened.
// ─────────────────────────────────────────────────────────────────────────────
import { isAwakened, SPELLS } from '../../engine';
import type { Action, Color, GameEvent, GameState, Piece, PieceType, SpellId, Square } from '../../engine';
import { sfx, type SfxName } from '../audio/sound';
import { pack } from './buffer';
import type { VfxEngine } from './engine';
import { burst, dust, ghost, glassGhost, pillar, ring, smoke, sparkle, squareWash, tracer, type BreakStyle } from './fx';
import { MANA_RAMP, PX, RAMP } from './palettes';
import { spellFx, spellTiming, type SpellCtx } from './spells';
import { pieceSpr } from './sprites';

export interface Batch {
  id: number;
  action: Action;
  before: GameState;
  after: GameState;
  /** An undo: `action` is the step being taken back, `after` the restored earlier state. */
  rewind?: boolean;
  /** With `rewind`: a jump to the server's position (an online game got out of step). */
  jump?: boolean;
}

export type MotionMode =
  | 'slide' | 'leap' | 'dash' | 'push' | 'pull' | 'blink' | 'appear' | 'rise' | 'transform' | 'lunge' | 'recoil'
  /** Thrown by a shockwave („Végzet”): tumbles, spins or slams, depending on the piece. */
  | 'blast'
  /** Undo: glide straight back, in a pale time-glow. */
  | 'rewind'
  /** Undo: a taken piece fades back in where it stood. */
  | 'return';

export interface Motion {
  mode: MotionMode;
  /** ms before the motion starts. */
  delay: number;
  dur: number;
  /** Target square of a lunge / recoil. */
  toward?: Square;
}

/** Crystals: `from` → (spend down to `mid`) → (form up to `to`). */
export interface ManaAnim {
  from: number;
  mid: number;
  to: number;
  spendAt: number;
  gainAt: number;
  wasted: number;
}

export interface Plan {
  id: number;
  motions: Record<string, Motion>;
  mana: Partial<Record<Color, ManaAnim>>;
  /** The card that leaves a hand. */
  cast: { color: Color; spellId: SpellId } | null;
  /** New walls and mines appear at this time. */
  terrainAt: number;
  /** Turn banner time (null when the turn did not pass). */
  bannerAt: number | null;
  checkAt: number | null;
  /** When the game-over screen may appear. */
  overAt: number;
  /** A cinematic is playing: the board takes no input for this long (ms). */
  lock?: number;
  play: (e: VfxEngine) => void;
}

/** Base timings (ms). */
export const T = {
  move: 200,
  leap: 270,
  castStart: 240,
  shot: 160,
  appear: 380,
};

type Cue = (e: VfxEngine) => void;
const snd = (e: VfxEngine, name: SfxName, at: number) => e.at(at, () => {
  if (!e.muted) sfx(name);
});

function index(board: GameState['board']): Map<string, { sq: Square; piece: Piece }> {
  const m = new Map<string, { sq: Square; piece: Piece }>();
  board.forEach((p, sq) => {
    if (p) m.set(p.id, { sq, piece: p });
  });
  return m;
}

const wallSquares = (s: GameState): Set<Square> => new Set(s.effects.filter((e) => e.kind === 'wall').flatMap((e) => e.squares ?? []));

export function choreograph(b: Batch): Plan {
  const { action, before, after } = b;
  const events: GameEvent[] = after.events;
  const bPos = index(before.board);
  const aPos = index(after.board);
  const motions: Record<string, Motion> = {};
  const cues: Cue[] = [];
  const handled = new Set<string>();
  let cast: Plan['cast'] = null;
  let mainEnd = 0;
  let impactAt = 0;
  let mainGainAt = 0;
  let terrainAt = 0;
  let lock: number | undefined;

  // ── split the events into the action, the turn-end changes and the next turn ──
  const turnIdx = events.findIndex((x) => x.type === 'turn');
  const homeOf = new Map(before.effects.filter((x) => x.kind === 'outOfWay' && x.pieceId).map((x) => [x.pieceId!, x.squares?.[0]]));
  let endStart = events.findIndex(
    (x, i) => (turnIdx < 0 || i < turnIdx) && (x.type === 'explode' || (x.type === 'move' && homeOf.get(x.pieceId) === x.to)),
  );
  if (endStart < 0) endStart = turnIdx < 0 ? events.length : turnIdx;
  const main = events.slice(0, endStart);
  const endEv = events.slice(endStart, turnIdx < 0 ? events.length : turnIdx);
  const phaseOf = (i: number): 'main' | 'end' | 'next' => (i < endStart ? 'main' : turnIdx >= 0 && i >= turnIdx ? 'next' : 'end');

  // ── the action itself ───────────────────────────────────────────────────────
  if (action.type === 'MOVE') {
    const mover = before.board[action.from];
    const knight = mover?.type === 'N';
    const dur = knight ? T.leap : T.move;
    let ranged = false;
    let blocked = false;
    for (const x of main) {
      if (x.type === 'move') {
        const isMover = x.pieceId === mover?.id;
        motions[x.pieceId] = { mode: isMover && knight ? 'leap' : 'slide', delay: isMover ? 0 : 40, dur: isMover ? dur : T.move + 40 };
      } else if (x.type === 'shot') {
        ranged = true;
        const shooter = after.board[x.from];
        if (shooter) motions[shooter.id] = { mode: 'recoil', delay: 0, dur: 240, toward: x.to };
        cues.push((e) => shot(e, x.from, x.to, x.color));
      } else if (x.type === 'bounce') {
        blocked = true;
        const attacker = after.board[x.attackerSquare];
        if (attacker) motions[attacker.id] = { mode: 'lunge', delay: 0, dur: 340, toward: x.square };
        cues.push((e) => shieldFlash(e, x.square, 150));
      } else if (x.type === 'defuse') {
        blocked = true;
        const king = after.board[action.from];
        if (king) motions[king.id] = { mode: 'lunge', delay: 0, dur: 340, toward: x.square };
        cues.push((e) => defuse(e, x.square, 150));
      }
    }
    const arrive = ranged ? T.shot : dur;
    let captured = false;
    let shatterEnd = 0;
    for (const x of main) {
      if (x.type === 'capture') {
        captured = true;
        handled.add(x.piece.id);
        const from = action.from;
        cues.push((e) => {
          ghost(e, pieceSpr(x.piece.type, x.piece.color), x.square, { breakAt: arrive - 25, style: 'shatter', from: e.c(from), translucent: x.piece.clone });
          impactFx(e, x.square, arrive - 25);
        });
      } else if (x.type === 'destroy') {
        // a clone that dissolves right after capturing
        handled.add(x.piece.id);
        cues.push((e) => ghost(e, pieceSpr(x.piece.type, x.piece.color), x.square, { breakAt: arrive + 140, style: 'dissolve', translucent: true }));
      } else if (x.type === 'shatter') {
        // „Üvegátok”: the cursed attacker arrives as glass, cracks, and breaks
        handled.add(x.piece.id);
        const crackAt = arrive + 110;
        const breakAt = arrive + 470;
        const from = ranged ? x.square : action.from;
        cues.push((e) => {
          glassGhost(e, pieceSpr(x.piece.type, x.piece.color), { from, to: x.square, travel: ranged ? 0 : dur, leap: knight && !ranged, crackAt, breakAt });
          snd(e, 'glass', breakAt - 15);
        });
        shatterEnd = breakAt + 320;
      } else if (x.type === 'shieldBlock' && !blocked) {
        cues.push((e) => shieldFlash(e, x.square, arrive - 20));
      }
    }
    if (!ranged && !blocked) {
      const to = action.to;
      cues.push((e) => {
        dust(e, e.c(to).x, e.c(to).y + 8, captured ? 5 : 8, arrive - 15);
        if (!captured) snd(e, 'move', arrive - 30);
      });
      for (const x of main) {
        if (x.type === 'move' && x.pieceId !== mover?.id) cues.push((e) => dust(e, e.c(x.to).x, e.c(x.to).y + 8, 6, T.move + 40));
      }
    }
    if (captured) mainGainAt = arrive + 160;
    mainEnd = Math.max(arrive + (captured ? 220 : 90), shatterEnd);
  } else if (action.type === 'PROMOTE') {
    for (const x of main) {
      if (x.type !== 'promotion') continue;
      const p = after.board[x.square];
      if (p) motions[p.id] = { mode: 'transform', delay: 0, dur: 460 };
      cues.push((e) => {
        const c = e.c(x.square);
        pillar(e, c.x, c.y + 8, { w: 12, h: 48, ramp: RAMP.holy, dur: 560 });
        burst(e, c.x, c.y, { n: 26, ramp: RAMP.holy, speed: [30, 80], life: [300, 600], drag: 2.5, delay: [120, 160] });
        snd(e, 'promote', 60);
      });
    }
    mainEnd = 460;
  } else if (action.type === 'CAST') {
    const id = action.spellId;
    const spellEv = main.find((x) => x.type === 'spell') as Extract<GameEvent, { type: 'spell' }> | undefined;
    // a card that charges up („Végzet”) looks different when it is played awakened
    const awakened = !!spellEv?.awakened;
    const fx = spellFx(id, awakened);
    const tm = spellTiming(id, awakened);
    const start = T.castStart;
    const impact = start + tm.windup;
    impactAt = impact;
    cast = { color: before.turn, spellId: id };

    const evMoves = main.filter((x): x is Extract<GameEvent, { type: 'move' }> => x.type === 'move');
    const moved: SpellCtx['moved'] = [];
    const seenMove = new Set<string>();
    for (const m of evMoves) {
      if (seenMove.has(m.pieceId)) continue;
      seenMove.add(m.pieceId);
      const piece = aPos.get(m.pieceId)?.piece ?? bPos.get(m.pieceId)?.piece;
      const from = bPos.get(m.pieceId)?.sq ?? m.from;
      const to = aPos.get(m.pieceId)?.sq ?? m.to;
      if (piece && from !== to) moved.push({ id: m.pieceId, from, to, piece });
    }
    // relocations without events (e.g. „Visszatekerés”)
    for (const [pid, a] of aPos) {
      const bp = bPos.get(pid);
      if (bp && bp.sq !== a.sq && !seenMove.has(pid)) moved.push({ id: pid, from: bp.sq, to: a.sq, piece: a.piece });
    }
    const removed: SpellCtx['removed'] = [];
    const arrivals = new Set(moved.map((m) => m.to));
    const capturedByMove: { sq: Square; piece: Piece }[] = [];
    const shattered: { sq: Square; piece: Piece }[] = [];
    for (const x of main) {
      if (x.type === 'shatter') {
        handled.add(x.piece.id);
        shattered.push({ sq: x.square, piece: x.piece });
      } else if (x.type === 'capture' || x.type === 'destroy') {
        handled.add(x.piece.id);
        if (x.type === 'capture' && arrivals.has(x.square)) capturedByMove.push({ sq: x.square, piece: x.piece });
        else removed.push({ sq: x.square, piece: x.piece });
      }
    }
    for (const [pid, bp] of bPos) {
      if (!aPos.has(pid) && !handled.has(pid)) {
        handled.add(pid);
        removed.push({ sq: bp.sq, piece: bp.piece });
      }
    }
    const appeared: SpellCtx['appeared'] = [];
    for (const [pid, a] of aPos) if (!bPos.has(pid)) appeared.push({ sq: a.sq, piece: a.piece });
    const changed: SpellCtx['changed'] = [];
    for (const [pid, a] of aPos) {
      const bp = bPos.get(pid);
      if (bp && bp.sq === a.sq && bp.piece.type !== a.piece.type) changed.push({ sq: a.sq, piece: a.piece, fromType: bp.piece.type as PieceType });
    }

    const ctx: SpellCtx = {
      id,
      caster: before.turn,
      targets: action.targets,
      squares: spellEv?.squares ?? [],
      removed,
      moved,
      appeared,
      changed,
      start,
      impact,
      before,
      after,
    };
    let latest = impact;
    moved.forEach((m, i) => {
      const st = fx.stagger?.(m.to, ctx, i) ?? 0;
      if (tm.move === 'blink') {
        motions[m.id] = { mode: 'blink', delay: impact + st, dur: 300 };
        const pc = bPos.get(m.id)?.piece ?? m.piece;
        cues.push((e) => ghost(e, pieceSpr(pc.type, pc.color), m.from, { breakAt: impact + st - 30, style: 'blink', translucent: pc.clone }));
      } else {
        motions[m.id] = { mode: tm.move, delay: impact + st, dur: tm.moveDur };
      }
      latest = Math.max(latest, impact + st + tm.moveDur);
    });
    for (const x of capturedByMove) {
      const m = moved.find((mm) => mm.to === x.sq);
      const arrive = impact + (m ? (fx.stagger?.(m.to, ctx, 0) ?? 0) : 0) + tm.moveDur - 30;
      cues.push((e) => {
        ghost(e, pieceSpr(x.piece.type, x.piece.color), x.sq, { breakAt: arrive, style: 'shatter', from: m ? e.c(m.from) : undefined, translucent: x.piece.clone });
        impactFx(e, x.sq, arrive);
      });
      latest = Math.max(latest, arrive + 200);
    }
    for (const x of shattered) {
      // „Üvegátok”: the cursed piece made its capture through a spell, then breaks
      const m = moved.find((mm) => mm.id === x.piece.id);
      const travel = m ? tm.moveDur : 0;
      const start0 = m ? impact : 0;
      const crackAt = travel + 110 + (m ? 0 : impact);
      const breakAt = crackAt + 360;
      cues.push((e) => {
        glassGhost(e, pieceSpr(x.piece.type, x.piece.color), { from: m ? m.from : x.sq, to: x.sq, travel, leap: tm.move === 'leap', crackAt, breakAt, delay: start0 });
        snd(e, 'glass', start0 + breakAt - 15);
      });
      if (m) delete motions[m.id];
      latest = Math.max(latest, start0 + breakAt + 320);
    }
    removed.forEach((x, i) => {
      const st = fx.stagger?.(x.sq, ctx, i) ?? 0;
      if (fx.ghosts !== false) {
        cues.push((e) => ghost(e, pieceSpr(x.piece.type, x.piece.color), x.sq, { breakAt: impact + st, style: tm.destroy, translucent: x.piece.clone }));
      }
      latest = Math.max(latest, impact + st + 300);
    });
    appeared.forEach((x, i) => {
      const st = fx.stagger?.(x.sq, ctx, i) ?? 0;
      const mode = tm.appear === 'rise' ? 'rise' : tm.appear === 'blink' ? 'blink' : 'appear';
      motions[x.piece.id] = { mode, delay: impact + st, dur: T.appear };
      latest = Math.max(latest, impact + st + T.appear);
    });
    for (const x of changed) motions[x.piece.id] = { mode: 'transform', delay: impact, dur: 460 };
    for (const x of main) {
      if (x.type !== 'shieldBlock') continue;
      // a blocked blow lands when the spell reaches that square (sweeps, the Reaper's round)
      const si = ctx.squares.indexOf(x.square);
      const at = impact + (fx.stagger?.(x.square, ctx, Math.max(0, si)) ?? 0);
      cues.push((e) => shieldFlash(e, x.square, at));
      latest = Math.max(latest, at + 380);
    }
    cues.push((e) => fx.play(e, ctx));
    if (fx.tail) latest = Math.max(latest, start + fx.tail);
    // the price leaves the crystals right away
    cues.push((e) => spendSparks(e, before.turn, 40));
    terrainAt = impact;
    mainGainAt = fx.gainAt !== undefined ? start + fx.gainAt : impact + 700;
    mainEnd = Math.max(latest, impact + 320);
    if (fx.cinematic) lock = mainEnd;
    // „Körforgás”: the card has charged on its way to the back of the deck…
    const caster = before.turn;
    if (SPELLS[id].cycles && !awakened && isAwakened(after, caster, id)) {
      const at = Math.max(impact + 200, mainEnd - 150);
      cues.push((e) => chargeFx(e, caster, id, at));
    }
    // …or a charged card has just come back to the hand, awakened
    for (const x of main) {
      if (x.type !== 'cycle' || !x.drawn || !SPELLS[x.drawn].cycles || !isAwakened(after, x.color, x.drawn)) continue;
      const drawn = x.drawn;
      cues.push((e) => awakenFx(e, x.color, drawn, 220));
    }
  }

  // ── turn end: mines, returning pieces, walls crumbling ──────────────────────
  const tEnd = mainEnd + (endEv.length ? 60 : 0);
  let t = tEnd;
  let explosions = 0;
  for (const x of endEv) {
    if (x.type === 'explode') {
      const at = tEnd + explosions * 200;
      explosions++;
      cues.push((e) => mineBlast(e, x.square, at));
      t = at;
    } else if (x.type === 'destroy') {
      handled.add(x.piece.id);
      const at = t;
      cues.push((e) => ghost(e, pieceSpr(x.piece.type, x.piece.color), x.square, { breakAt: at, style: 'burn', translucent: x.piece.clone }));
    } else if (x.type === 'shieldBlock') {
      const at = t;
      cues.push((e) => shieldFlash(e, x.square, at));
    } else if (x.type === 'move') {
      motions[x.pieceId] = { mode: 'slide', delay: tEnd, dur: 260 };
      cues.push((e) => dust(e, e.c(x.to).x, e.c(x.to).y + 8, 6, tEnd + 250));
    }
  }
  const beforeWalls = wallSquares(before);
  const afterWalls = wallSquares(after);
  const fallen = [...beforeWalls].filter((s) => !afterWalls.has(s));
  if (fallen.length) {
    cues.push((e) => {
      for (const s of fallen) {
        const c = e.c(s);
        burst(e, c.x, c.y, { n: 18, ramp: RAMP.stone, speed: [20, 50], life: [300, 520], gravity: 240, delay: [tEnd, tEnd + 60], floor: c.y + 9 });
        smoke(e, c.x, c.y + 6, 5, tEnd + 40, 6);
      }
    });
  }
  // anything else that simply vanished (keeps the board honest)
  for (const [pid, bp] of bPos) {
    if (!aPos.has(pid) && !handled.has(pid)) {
      handled.add(pid);
      cues.push((e) => ghost(e, pieceSpr(bp.piece.type, bp.piece.color), bp.sq, { breakAt: Math.max(60, mainEnd - 100), style: 'shatter' }));
    }
  }
  const endDone = endEv.length ? t + (explosions ? 380 : 280) : mainEnd;

  // ── next turn ───────────────────────────────────────────────────────────────
  // no banner once the game is decided – the result screen takes over
  const bannerAt = turnIdx >= 0 && after.status.kind === 'playing' ? Math.max(endDone, 120) : null;
  let checkAt: number | null = null;
  let overAt = (bannerAt ?? mainEnd) + 400;
  events.forEach((x, i) => {
    if (x.type === 'check') {
      checkAt = phaseOf(i) === 'next' && bannerAt !== null ? bannerAt + 260 : Math.max(mainEnd, endDone);
      const at = checkAt;
      const mate = after.status.kind === 'checkmate';
      cues.push((e) => checkFx(e, after, x.color, at, mate));
    }
    if (x.type === 'gameOver') overAt = Math.max(overAt, (checkAt ?? mainEnd) + 700);
  });

  // ── mana crystals ───────────────────────────────────────────────────────────
  const mana: Plan['mana'] = {};
  for (const color of ['w', 'b'] as Color[]) {
    let neg = 0;
    let pos = 0;
    let wasted = 0;
    let gainPhase = 'main' as 'main' | 'end' | 'next';
    events.forEach((x, i) => {
      if (x.type !== 'mana' || x.color !== color) return;
      if (x.delta < 0) neg += x.delta;
      if (x.delta > 0) {
        pos += x.delta;
        gainPhase = phaseOf(i);
      }
      wasted += x.wasted;
    });
    const from = before.players[color].mana;
    const to = after.players[color].mana;
    if (!neg && !pos && !wasted && from === to) continue;
    const mid = Math.max(0, Math.min(from, to, from + neg));
    const gainAt =
      gainPhase === 'next' && bannerAt !== null ? bannerAt + 380 : gainPhase === 'end' ? tEnd + 200 : mainGainAt || mainEnd;
    // nothing spent: the count changes when the crystals form, not before
    const spent = neg < 0 || to < from;
    const spendAt = !spent ? gainAt : action.type === 'CAST' && color === before.turn ? 60 : impactAt || 80;
    mana[color] = { from, mid, to, spendAt, gainAt, wasted };
    if (to > mid) {
      const at = gainAt;
      cues.push((e) => snd(e, 'manaGain', at));
    }
  }

  return {
    id: b.id,
    motions,
    mana,
    cast,
    terrainAt,
    bannerAt,
    checkAt,
    overAt,
    ...(lock ? { lock } : {}),
    play: (e) => {
      for (const c of cues) c(e);
    },
  };
}

// ── shared little effects ────────────────────────────────────────────────────

/** Hit on a captured piece: flash, sparks, a short shake and the capture sound. */
/**
 * Undo (local games): the taken-back step runs in reverse, quick and quiet – pieces glide
 * straight back in a pale time-glow, taken pieces fade in where they stood, pieces the step
 * had brought onto the board blink out. No banner, no stamps, no mana animation.
 */
export function rewindPlan(b: Batch): Plan {
  const now = index(b.before.board);
  const then = index(b.after.board);
  const motions: Record<string, Motion> = {};
  const moved: [Square, Square][] = [];
  for (const [id, t] of then) {
    const n = now.get(id);
    if (!n) motions[id] = { mode: 'return', delay: 40, dur: 320 };
    else if (n.sq !== t.sq) {
      motions[id] = { mode: 'rewind', delay: 0, dur: 260 };
      moved.push([n.sq, t.sq]);
    } else if (n.piece.type !== t.piece.type) motions[id] = { mode: 'transform', delay: 0, dur: 460 };
  }
  const gone = [...now].filter(([id]) => !then.has(id)).map(([, x]) => x);
  return {
    id: b.id,
    motions,
    mana: {},
    cast: null,
    terrainAt: 0,
    bannerAt: null,
    checkAt: null,
    overAt: 0,
    play: (e) => {
      for (const g of gone) ghost(e, pieceSpr(g.piece.type, g.piece.color), g.sq, { breakAt: 60, style: 'blink', translucent: !!g.piece.clone });
      for (const [from, to] of moved) {
        const c = e.c(from);
        sparkle(e, c.x, c.y, { n: 6, ramp: RAMP.time, w: 14, h: 14, dur: 380 });
        squareWash(e, to, { color: PX.sky, dur: 300, alpha: 0.35, layer: 0 });
      }
    },
  };
}

function impactFx(e: VfxEngine, sq: Square, at: number): void {
  const c = e.c(sq);
  // a four-pointed hit star that snaps open and closes again
  e.add({
    delay: at,
    dur: 150,
    layer: 1,
    draw: (b, t) => {
      const len = Math.round(3 + 8 * Math.sin(t * Math.PI));
      const a = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      b.line(c.x - len, c.y, c.x + len, c.y, PX.white, a);
      b.line(c.x, c.y - len, c.x, c.y + len, PX.white, a);
      b.line(c.x - len / 2, c.y - len / 2, c.x + len / 2, c.y + len / 2, PX.glint, a * 0.8);
      b.line(c.x - len / 2, c.y + len / 2, c.x + len / 2, c.y - len / 2, PX.glint, a * 0.8);
    },
  });
  ring(e, c.x, c.y, { r0: 3, r1: 13, dur: 220, color: PX.glint, delay: at });
  e.at(at, () => {
    e.shake(1, 160);
    if (!e.muted) sfx('capture');
  });
}

function shieldFlash(e: VfxEngine, sq: Square, at: number): void {
  const c = e.c(sq);
  e.add({
    delay: at,
    dur: 380,
    layer: 1,
    draw: (b, t) => {
      const a = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
      b.circle(c.x, c.y + 1, 10 + t * 2, PX.steel, a, 1, 1);
      b.circle(c.x, c.y + 1, 11 + t * 2, PX.white, a * 0.5);
    },
  });
  burst(e, c.x, c.y, { n: 12, ramp: RAMP.spark, speed: [40, 80], life: [100, 220], shape: 2, drag: 3, delay: [at, at + 10] });
  snd(e, 'shield', at);
}

function shot(e: VfxEngine, from: Square, to: Square, color: Color): void {
  const a = e.c(from);
  const b = e.c(to);
  burst(e, a.x, a.y - 4, { n: 10, ramp: RAMP.spark, speed: [30, 70], life: [100, 200], shape: 2 });
  tracer(e, { x: a.x, y: a.y - 4 }, b, { color: color === 'w' ? PX.glint : pack('#f08a7a'), dur: 260, grow: 0.55 });
  sparkle(e, b.x, b.y, { n: 6, ramp: RAMP.spark, w: 8, h: 8, dur: 120, delay: T.shot - 20 });
  snd(e, 'shot', 0);
}

function defuse(e: VfxEngine, sq: Square, at: number): void {
  const c = e.c(sq);
  burst(e, c.x, c.y + 4, { n: 14, ramp: RAMP.ice, speed: [30, 70], life: [140, 260], shape: 2, delay: [at, at + 60] });
  smoke(e, c.x, c.y + 6, 6, at + 60, 4);
  snd(e, 'defuse', at);
}

function mineBlast(e: VfxEngine, sq: Square, at: number): void {
  const c = e.c(sq);
  e.at(at, () => {
    squareWash(e, sq, { color: PX.glint, dur: 140, alpha: 0.9, layer: 1 });
    burst(e, c.x, c.y, { n: 40, ramp: RAMP.fire, speed: [30, 90], life: [260, 600], size: [1, 2], drag: 3, gravity: -20 });
    burst(e, c.x, c.y, { n: 12, ramp: RAMP.dust, speed: [40, 80], life: [300, 520], gravity: 240, floor: c.y + 9 });
    ring(e, c.x, c.y, { r0: 4, r1: 22, dur: 360, color: PX.glint });
    smoke(e, c.x, c.y, 12, 100, 7);
    e.shake(2, 300);
    if (!e.muted) sfx('explosion');
  });
}

/** „Körforgás”: the played card has charged – a violet glint on its chip at the back of the queue. */
function chargeFx(e: VfxEngine, color: Color, id: SpellId, at: number): void {
  e.at(at, () => {
    if (!e.muted) sfx('charge');
    const c = e.elementCenter(e.query(`[data-queue-owner="${color}"] [data-queue="${id}"]`));
    if (!c) return;
    ring(e, c.x, c.y, { r0: 2, r1: 12, dur: 320, color: RAMP.arcane[1] });
    sparkle(e, c.x, c.y, { n: 10, ramp: RAMP.arcane, w: 16, h: 8, dur: 480 });
  });
}

/** „Körforgás”: a charged card comes back to the hand, awakened. */
export function awakenFx(e: VfxEngine, color: Color, id: SpellId, at: number): void {
  e.at(at, () => {
    if (!e.muted) sfx('awaken');
    const c = e.elementCenter(e.query(`[data-hand="${color}"] [data-spell="${id}"]`));
    if (!c) return;
    ring(e, c.x, c.y, { r0: 4, r1: 26, dur: 420, color: PX.white });
    ring(e, c.x, c.y, { r0: 4, r1: 20, dur: 520, color: RAMP.arcane[1], delay: 80 });
    burst(e, c.x, c.y, { n: 22, ramp: [PX.white, ...RAMP.arcane], speed: [20, 60], life: [300, 600], drag: 2, box: { w: 30, h: 12 } });
  });
}

function spendSparks(e: VfxEngine, color: Color, at: number): void {
  e.at(at, () => {
    const el = e.query(`[data-crystals="${color}"]`);
    const c = e.elementCenter(el);
    if (!c) return;
    burst(e, c.x, c.y, { n: 16, ramp: MANA_RAMP[color], speed: [20, 50], life: [240, 420], gravity: 140, box: { w: 50, h: 6 } });
  });
}

function checkFx(e: VfxEngine, s: GameState, color: Color, at: number, mate: boolean): void {
  const k = s.board.findIndex((p) => p?.type === 'K' && p.color === color);
  if (k < 0) return;
  const c = e.c(k);
  ring(e, c.x, c.y, { r0: 4, r1: 16, dur: 320, color: PX.red, delay: at, thick: 2 });
  ring(e, c.x, c.y, { r0: 4, r1: 20, dur: 380, color: PX.ember, delay: at + 140 });
  squareWash(e, k, { color: PX.red, dur: 420, alpha: 0.6, delay: at, layer: 0 });
  snd(e, mate ? 'mate' : 'check', at);
}

export type { BreakStyle };
