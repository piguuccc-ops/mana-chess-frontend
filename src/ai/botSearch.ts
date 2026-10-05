// ─────────────────────────────────────────────────────────────────────────────
// The bots' brain: one search with knobs, from Kende (100 Elo, plays any move half the time) to
// Oli (3000 Elo, three plies deep with captures followed to the end and spells weighed against the
// moves they lead to).
//
//  • Weak levels: random moves, noise on every judgement, they miss what can be taken back
//    („short-sighted”), and spells now and then at a random target.
//  • Strong levels: alpha-beta search (negamax) over normal moves with iterative deepening inside a
//    time budget, quiescence (captures until the dust settles) at the leaves, and for the top ones a
//    look at the best few spells *together with* the move that follows.
//
// Every action has a hard time budget (`timeMs`): a slow phone simply searches less deep.
// Like the classic AI it only talks to the engine through `applyAction` – it cannot cheat.
// ─────────────────────────────────────────────────────────────────────────────
import { applyAction, canEndTurn, castBlockReason, hand, legalMoves, SPELLS, targetCombos } from '../engine';
import type { Action, Color, GameState, Move, Square } from '../engine';
import {
  anyEscape, bestPromotion, DEFAULT_AI, escapes, evaluate, moveAction, orderMoves, play, spellChoices, threatAwareEval, VAL, WIN,
  type AIProfile, type SpellChoice,
} from './simpleAI';

export interface BotStrength {
  /** Plies of normal moves searched (1 = the best-looking move right now). */
  depth: 1 | 2 | 3;
  /** Follow the captures at the end of the search until the position is quiet. */
  quiescence: boolean;
  /** Chance that a turn's move is simply any legal move. */
  randomMove: number;
  /** Noise added to the judgement of every candidate move (pawns, ±). */
  noise: number;
  /** Chance that a turn is played without looking at what the opponent can take back. */
  shortSighted: number;
  /** Chance that spells are thought about at all in a turn. */
  spellChance: number;
  /** Chance of casting a random affordable spell at a random target instead. */
  wildSpell: number;
  /** Noise on the spells' scores (pawns, ±). */
  spellNoise: number;
  /** How many of the best spell candidates are tried together with the move after them (0: none). */
  spellLook: number;
  /** The classic AI's knobs (mana worth, cast threshold, targets tried …). */
  profile: AIProfile;
  /** The whole decision (spells and move) gets this long (ms); deeper search stops here. */
  timeMs: number;
  /**
   * Three plies deep is only affordable selectively: inside such a search every position looks at
   * this many of its best-ordered moves (captures first). Leave out for no limit.
   */
  width?: number;
}

export type Rand = () => number;
type Clock = () => number;

const ABORT = new Error('abort');
/** Quiescence: plies of captures followed, and captures tried per position. */
const Q_PLIES = 4;
const Q_WIDTH = 8;
/** At three plies only the best root moves of the two-ply search are searched again. */
const BEAM = 10;

interface Ctx {
  me: Color;
  quiescence: boolean;
  profile: AIProfile;
  deadline: number;
  now: Clock;
  nodes: number;
  /** Moves searched per inner position (selective search); Infinity: all. */
  width: number;
}

const tick = (ctx: Ctx) => {
  if ((++ctx.nodes & 7) === 0 && ctx.now() > ctx.deadline) throw ABORT;
};

/** The position from the side to move's point of view, when the search stops here. */
function leaf(state: GameState, ctx: Ctx, alpha: number, beta: number): number {
  if (state.status.kind !== 'playing' || !ctx.quiescence) return evaluate(state, state.turn, ctx.profile);
  // a selective (deep) search cannot afford following every capture: a quick estimate instead
  if (ctx.width !== Infinity) return quickLeaf(state, ctx);
  return quiesce(state, ctx, alpha, beta, 0);
}

const KNIGHT_JUMPS = [-17, -15, -10, -6, 6, 10, 15, 17];
const KING_STEPS = [-9, -8, -7, -1, 1, 7, 8, 9];
const ROOK_RAYS = [-8, -1, 1, 8];
const BISHOP_RAYS = [-9, -7, 7, 9];
const fileOf = (s: number) => s & 7;
/** One step from `s` by `d` stays on the board (no wrapping round the edge). */
const step = (s: number, d: number): number => {
  const t = s + d;
  return t < 0 || t > 63 || Math.abs(fileOf(t) - fileOf(s)) > 2 ? -1 : t;
};

/** Plain chess geometry: is square `s` attacked by a piece of `by`? (Spell effects are not considered.) */
function attacked(board: GameState['board'], s: number, by: Color): boolean {
  const pawnFrom = by === 'w' ? [-9, -7] : [7, 9];
  for (const d of pawnFrom) {
    const t = step(s, d);
    const p = t >= 0 ? board[t] : null;
    if (p && p.color === by && (p.type === 'P' || p.type === 'S')) return true;
  }
  for (const d of KNIGHT_JUMPS) {
    const t = step(s, d);
    const p = t >= 0 ? board[t] : null;
    if (p && p.color === by && p.type === 'N') return true;
  }
  for (const d of KING_STEPS) {
    const t = step(s, d);
    const p = t >= 0 ? board[t] : null;
    if (p && p.color === by && p.type === 'K') return true;
  }
  const ray = (dirs: number[], kinds: string) => {
    for (const d of dirs) {
      let t = s;
      for (;;) {
        t = step(t, d);
        if (t < 0) break;
        const p = board[t];
        if (!p) continue;
        if (p.color === by && kinds.includes(p.type)) return true;
        break;
      }
    }
    return false;
  };
  return ray(ROOK_RAYS, 'RQ') || ray(BISHOP_RAYS, 'BQ');
}

/** The static value plus the best capture the side to move has (taken back if the victim is guarded). */
function quickLeaf(state: GameState, ctx: Ctx): number {
  tick(ctx);
  const stm = state.turn;
  let gain = 0;
  for (const m of legalMoves(state, { capturesOnly: true })) {
    const victim = state.board[m.captureSquare ?? m.to];
    const attacker = state.board[m.from];
    if (!victim || !attacker || victim.color === stm) continue;
    const g = attacked(state.board, m.to, victim.color) ? VAL[victim.type] - VAL[attacker.type] : VAL[victim.type];
    if (g > gain) gain = g;
  }
  return evaluate(state, stm, ctx.profile) + gain * 0.9;
}

/** Captures until nothing hangs (negamax, side-to-move view). */
function quiesce(state: GameState, ctx: Ctx, alpha: number, beta: number, ply: number): number {
  tick(ctx);
  const stand = evaluate(state, state.turn, ctx.profile);
  if (state.status.kind !== 'playing' || ply >= Q_PLIES) return stand;
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  const caps = orderMoves(state, legalMoves(state, { capturesOnly: true })).slice(0, Q_WIDTH);
  for (const m of caps) {
    // delta pruning: even winning the piece cannot lift us to alpha
    const victim = state.board[m.captureSquare ?? m.to];
    if (victim && stand + VAL[victim.type] + 1 < alpha) continue;
    const child = play(state, m);
    if (!child) continue;
    const v = child.turn === state.turn ? evaluate(child, state.turn, ctx.profile) : -quiesce(child, ctx, -beta, -alpha, ply + 1);
    if (v >= beta) return v;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

/** Negamax with alpha-beta over normal moves; the score is from the side to move's point of view. */
function negamax(state: GameState, depth: number, alpha: number, beta: number, ctx: Ctx, ply: number): number {
  tick(ctx);
  if (state.status.kind !== 'playing') {
    const v = evaluate(state, state.turn, ctx.profile);
    // a quicker mate is better, a slower one less bad
    return v >= WIN ? v - ply : v <= -WIN ? v + ply : v;
  }
  if (depth <= 0) return leaf(state, ctx, alpha, beta);
  let moves = orderMoves(state, legalMoves(state));
  if (!moves.length) return leaf(state, ctx, alpha, beta);
  if (moves.length > ctx.width) moves = moves.slice(0, ctx.width);
  let best = -Infinity;
  for (const m of moves) {
    const child = play(state, m);
    if (!child) continue;
    // the same side goes on (a bonus move, manual turn end): judge it here
    const v = child.turn === state.turn && child.status.kind === 'playing' ? evaluate(child, state.turn, ctx.profile) : -negamax(child, depth - 1, -beta, -alpha, ctx, ply + 1);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best === -Infinity ? leaf(state, ctx, alpha, beta) : best;
}

export interface Scored {
  move: Move;
  score: number;
}

/** A root move's child position and its score at `depth` (from `me`'s side). */
function rootValue(child: GameState, depth: number, ctx: Ctx, window: number): number {
  if (child.status.kind !== 'playing') {
    const v = evaluate(child, ctx.me, ctx.profile);
    return v >= WIN ? v - 1 : v;
  }
  if (child.turn === ctx.me) return threatAwareEval(child, ctx.me, ctx.profile);
  if (depth <= 1) return ctx.quiescence ? -quiesce(child, ctx, -Infinity, Infinity, 0) : evaluate(child, ctx.me, ctx.profile);
  return -negamax(child, depth - 1, -Infinity, window, ctx, 1);
}

/**
 * The moves of the side to move, scored, best first – deepening one ply at a time until `depth`
 * or until the clock passes `deadline` (then the last finished depth counts).
 */
export function scoreMoves(state: GameState, s: Pick<BotStrength, 'depth' | 'quiescence' | 'profile' | 'width'>, deadline: number, now: Clock = defaultNow): Scored[] {
  const ctx: Ctx = { me: state.turn, quiescence: s.quiescence, profile: s.profile, deadline, now, nodes: 0, width: Infinity };
  const children = new Map<Move, GameState>();
  for (const m of orderMoves(state, legalMoves(state))) {
    const c = play(state, m);
    if (c) children.set(m, c);
  }
  // depth 0: a glance at every move (always finishes; the fallback when time is very short)
  let done: Scored[] = [...children].map(([move, c]) => ({ move, score: c.status.kind !== 'playing' || c.turn !== ctx.me ? evaluate(c, ctx.me, ctx.profile) : threatAwareEval(c, ctx.me, ctx.profile) }));
  done.sort((a, b) => b.score - a.score);
  for (let d = 1; d <= s.depth; d++) {
    // the shallow passes look at everything; the deep one is selective
    ctx.width = d >= 3 ? (s.width ?? Infinity) : Infinity;
    try {
      const pool = d >= 3 ? done.slice(0, BEAM) : done;
      const scored: Scored[] = [];
      let alpha = -Infinity;
      for (const { move } of pool) {
        // exact scores for the best few (the noise needs them), bounds for the clearly worse
        const v = rootValue(children.get(move)!, d, ctx, scored.length < 4 ? Infinity : -alpha + 3);
        if (v > alpha) alpha = v;
        scored.push({ move, score: v });
      }
      scored.sort((a, b) => b.score - a.score);
      // at the beam depth the rest keep their place below the searched ones
      done = d >= 3 ? [...scored, ...done.slice(BEAM).map((x) => ({ ...x, score: Math.min(x.score, scored.at(-1)?.score ?? x.score) - 1 }))] : scored;
    } catch (e) {
      if (e !== ABORT) throw e;
      break;
    }
  }
  return done;
}

const defaultNow: Clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Noise in [-1, 1], heavier in the middle (two dice). */
const wobble = (rand: Rand) => rand() + rand() - 1;

function pick<T>(xs: readonly T[], rand: Rand): T {
  return xs[Math.floor(rand() * xs.length)];
}

/** Any affordable spell at any target – Kende's style. */
function wildCast(state: GameState, rand: Rand): Action | null {
  const ids = hand(state, state.turn).filter((id) => castBlockReason(state, id) === null);
  for (let tries = 0; tries < 4 && ids.length; tries++) {
    const id = pick(ids, rand);
    const combos: Square[][] = [];
    for (const t of targetCombos(state, SPELLS[id])) {
      combos.push(t);
      if (combos.length >= 24) break;
    }
    if (!combos.length) continue;
    const targets = pick(combos, rand);
    const r = applyAction(state, { type: 'CAST', spellId: id, targets });
    if (r.ok && escapes(r.state)) return { type: 'CAST', spellId: id, targets };
  }
  return null;
}

/** The value of the position after the best move the search finds in `ms` (from `me`'s side). */
function bestAfter(state: GameState, s: BotStrength, me: Color, ms: number, now: Clock): number {
  if (state.status.kind !== 'playing') return evaluate(state, me, s.profile);
  if (state.turn !== me) return threatAwareEval(state, me, s.profile);
  const scored = scoreMoves(state, { ...s, depth: Math.min(2, s.depth) as 1 | 2 }, now() + ms, now);
  return scored.length ? scored[0].score : threatAwareEval(state, me, s.profile);
}

/** A spell worth casting before the move, by this bot's judgement (or null). */
function chooseSpell(state: GameState, s: BotStrength, rand: Rand, end: number, now: Clock): SpellChoice | null {
  const me = state.turn;
  // the spells get at most a third of the time; the move needs the rest
  const spellEnd = now() + (end - now()) / 3;
  const all = spellChoices(state, me, false, s.profile, () => now() > spellEnd);
  if (!all.length) return null;
  const judged = all.map((c) => ({ ...c, score: c.score + s.spellNoise * wobble(rand) })).sort((a, b) => b.score - a.score);
  if (!s.spellLook || now() > spellEnd) return judged[0].score > s.profile.castThreshold ? judged[0] : null;
  // the best few, each followed by the best move it allows, against not casting at all
  const slice = Math.max(30, (end - now()) / (3 * (s.spellLook + 1)));
  const plain = bestAfter(state, s, me, slice, now);
  let best: SpellChoice | null = judged[0].score > s.profile.castThreshold ? judged[0] : null;
  let bestGain = best ? Math.max(s.profile.castThreshold, 0) : s.profile.castThreshold;
  let looked = 0;
  for (const c of judged) {
    if (looked >= s.spellLook || now() > spellEnd + slice) break;
    if (c.score < -1) break;
    looked++;
    const r = applyAction(state, { type: 'CAST', spellId: c.spellId, targets: c.targets });
    if (!r.ok) continue;
    const gain = bestAfter(r.state, s, me, slice, now) - plain - s.profile.costPenalty * SPELLS[c.spellId].manaCost;
    if (gain > bestGain) {
      bestGain = gain;
      best = { ...c, score: gain };
    }
  }
  return best;
}

/** The bot's next action (the UI calls this again and again while it is the bot's turn). */
export function botNextAction(state: GameState, s: BotStrength, rand: Rand = Math.random, now: Clock = defaultNow): Action | null {
  if (state.status.kind !== 'playing') return null;
  if (state.pendingPromotion) return { type: 'PROMOTE', piece: bestPromotion(state, state.pendingPromotion.color) };
  const end = now() + s.timeMs;
  const me = state.turn;
  const profile = s.profile;
  const moves = legalMoves(state);
  if (!moves.length) {
    // after the move (manual turn end), or no move at all: a spell may still help – or must
    if (state.turnState.normalMoveDone && canEndTurn(state) && state.turnState.spellsCast < 2 && rand() < s.spellChance) {
      const post = chooseSpell(state, s, rand, end, now);
      if (post) return { type: 'CAST', spellId: post.spellId, targets: post.targets };
    }
    if (state.mustCastSpell || !canEndTurn(state)) {
      const esc = spellChoices(state, me, true, profile).sort((a, b) => b.score - a.score)[0] ?? anyEscape(state, me, profile);
      if (esc) return { type: 'CAST', spellId: esc.spellId, targets: esc.targets };
    }
    return canEndTurn(state) ? { type: 'END_TURN' } : null;
  }
  if (!state.turnState.normalMoveDone && state.turnState.spellsCast < 2) {
    if (rand() < s.wildSpell) {
      const wild = wildCast(state, rand);
      if (wild) return wild;
    } else if (rand() < s.spellChance) {
      const sp = chooseSpell(state, s, rand, end, now);
      if (sp) return { type: 'CAST', spellId: sp.spellId, targets: sp.targets };
    }
  }
  // the move
  let choice: Move | null = null;
  let bestScore = -Infinity;
  if (rand() < s.randomMove) choice = pick(moves, rand);
  else {
    const blind = rand() < s.shortSighted;
    const scored = scoreMoves(state, blind ? { ...s, depth: 1, quiescence: false } : s, end, now);
    let top = -Infinity;
    for (const x of scored) {
      // a mate is a mate: no noise talks the bot out of it (or into walking into one)
      const v = Math.abs(x.score) >= WIN / 2 ? x.score : x.score + s.noise * wobble(rand);
      if (v > top) {
        top = v;
        choice = x.move;
        bestScore = x.score;
      }
    }
  }
  if (state.turnState.bonusMoveAvailable && canEndTurn(state)) {
    // a bonus move only if it does not make things worse
    const stay = threatAwareEval(state, me, profile);
    if (!choice || bestScore < stay - 0.2) return { type: 'END_TURN' };
  }
  if (choice) return moveAction(state, choice);
  return canEndTurn(state) ? { type: 'END_TURN' } : null;
}

/** The classic in-game AI as a strength (used where no bot is chosen). */
export const CLASSIC: BotStrength = {
  depth: 2, quiescence: false, randomMove: 0, noise: 0.05, shortSighted: 0, spellChance: 1, wildSpell: 0, spellNoise: 0, spellLook: 0,
  profile: DEFAULT_AI, timeMs: 4000,
};
