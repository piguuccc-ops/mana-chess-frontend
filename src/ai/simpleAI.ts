// ─────────────────────────────────────────────────────────────────────────────
// Simple AI opponent ("Egyszerű AI").
//  • Chess moves: 2-ply alpha-beta search with a material + mana + position eval.
//  • Spells: every castable card/target combination is simulated and scored by a
//    quick threat-aware evaluation; the best one is cast if it clearly pays off.
// The AI only talks to the engine through `applyAction`, exactly like a human
// or a network client would – it cannot cheat the rules.
// ─────────────────────────────────────────────────────────────────────────────
import {
  applyAction, canEndTurn, castBlockReason, effectiveCost, hand, legalMoves, maxMana, opposite, projectTurnEnd, promotionChoices,
  SPELLS, targetCombos, validTargets,
} from '../engine';
import type { Action, Color, GameState, Move, PieceType, PromotionPiece, SpellId, Square } from '../engine';

export const VAL: Record<PieceType, number> = { P: 1, N: 3, B: 3.2, R: 5, Q: 9, K: 0, S: 0.4 };
export const WIN = 10000;

/**
 * Tuning knobs. `DEFAULT_AI` is the in-game opponent; the balance simulation (scripts/balance.ts)
 * plays a bolder profile so that the decks actually get used.
 */
export interface AIProfile {
  /** What one mana point is worth in the evaluation (pawns). */
  manaValue: number;
  /** How much a spell has to improve the position (beyond the mana it costs) before it is cast. */
  castThreshold: number;
  /** Extra hesitation per mana point spent. */
  costPenalty: number;
  /** Target combinations tried per card. */
  comboLimit: number;
  /**
   * Spread the tries over randomly chosen first targets instead of taking the first combinations in
   * board order (matters for two-step spells such as Teleport or Csere, and big boards of targets).
   */
  spreadCombos: boolean;
  /**
   * The crystal that would overflow at the next turn's income is worth nothing: mana counts only up
   * to one below the maximum, so a full player spends instead of wasting it.
   */
  overflowAware: boolean;
  /** What playing a card is worth by itself: the hand moves on to the next card of the deck. */
  cycleValue: number;
}

export const DEFAULT_AI: AIProfile = {
  manaValue: 0.28, castThreshold: 0.45, costPenalty: 0.05, comboLimit: 24, spreadCombos: false, overflowAware: false, cycleValue: 0,
};

/** Mana as the evaluation counts it. */
function manaWorth(state: GameState, c: Color, ai: AIProfile): number {
  const m = state.players[c].mana;
  return ai.overflowAware ? Math.min(m, maxMana(state, c) - 1) : m;
}

function centre(s: Square): number {
  const f = s & 7;
  const r = s >> 3;
  return 3.5 - Math.max(Math.abs(f - 3.5), Math.abs(r - 3.5));
}

/** Static evaluation from `me`'s point of view (pawns = 1). */
export function evaluate(state: GameState, me: Color, ai: AIProfile = DEFAULT_AI): number {
  const st = state.status;
  if (st.kind === 'checkmate' || st.kind === 'resigned') return st.winner === me ? WIN : -WIN;
  if (st.kind === 'stalemate' || st.kind === 'draw') return 0;
  let score = 0;
  const queens = state.board.some((p) => p && p.type === 'Q');
  for (let s = 0; s < 64; s++) {
    const p = state.board[s];
    if (!p) continue;
    const file = s & 7;
    const rel = p.color === 'w' ? s >> 3 : 7 - (s >> 3);
    let v = VAL[p.type];
    if (p.type === 'N' || p.type === 'B') {
      v += centre(s) * 0.08;
      if (rel === 0) v -= 0.18; // undeveloped minor piece
    } else if (p.type === 'P') {
      const central = file >= 2 && file <= 5;
      v += central ? centre(s) * 0.05 + (rel - 1) * 0.03 : -Math.max(0, rel - 2) * 0.04;
      if (rel >= 5) v += (rel - 4) * 0.15; // advanced / passed-ish pawns
    } else if (p.type === 'K' && queens) {
      v += rel === 0 ? 0.25 : -0.1 * rel; // keep the king home while queens are around
    } else if (p.type === 'Q' && rel >= 3 && state.turnIndex < 12) {
      v -= 0.12; // no early queen raids
    }
    score += p.color === me ? v : -v;
  }
  score += (manaWorth(state, me, ai) - manaWorth(state, opposite(me), ai)) * ai.manaValue;
  for (const e of state.effects) {
    const mine = e.owner === me ? 1 : -1;
    if (e.kind === 'manaMage' && e.expiresAfterTurn !== null && state.board.some((p) => p?.id === e.pieceId)) {
      // „Mana mágus”: future income of living mages (one payment per remaining own turn).
      const left = Math.max(0, Math.ceil((e.expiresAfterTurn - state.turnIndex) / 2));
      score += mine * left * ai.manaValue * 1.2;
    } else if (e.kind === 'manaDeposit') {
      score += mine * (e.value ?? 3) * ai.manaValue * 0.9;
    } else if (e.kind === 'mine' && e.squares?.length) {
      // „Akna”: the piece standing on a live mine is probably lost unless it moves.
      const victim = state.board[e.squares[0]];
      if (victim && victim.type !== 'K') {
        const guarded = state.effects.some((x) => x.pieceId === victim.id && (x.kind === 'immune' || x.kind === 'fortified'));
        const loss = guarded ? 0.4 : VAL[victim.type] * 0.55;
        score += victim.color === me ? -loss : loss;
      }
    }
  }
  if (state.inCheck) score += state.turn === me ? -0.3 : 0.3;
  return score;
}

/** Evaluation that also looks at the opponent's best immediate capture next turn. */
export function threatAwareEval(raw: GameState, me: Color, ai: AIProfile = DEFAULT_AI): number {
  // Mid-turn positions are judged as they will be when the turn ends (mines, „El az útból!” returns…).
  const state = raw.turn === me && raw.status.kind === 'playing' ? projectTurnEnd(raw) : raw;
  const base = evaluate(state, me, ai);
  if (state.status.kind !== 'playing') return base;
  const opp = opposite(me);
  // Look at the position as if the opponent were to move now.
  const view: GameState = state.turn === opp ? state : {
    ...state,
    turn: opp,
    turnIndex: state.turnIndex + 1,
    turnState: { normalMoveDone: false, firstMovePieceId: null, bonusMoveAvailable: false, spellsCast: 0, irreversible: false },
    pendingPromotion: null,
  };
  let worst = 0;
  for (const m of legalMoves(view)) {
    if (!m.capture) continue;
    const victim = view.board[m.captureSquare ?? m.to];
    const attacker = view.board[m.from];
    if (!victim || !attacker) continue;
    const gain = VAL[victim.type] - Math.min(VAL[victim.type], defended(view, m.to, me) ? VAL[attacker.type] : 0);
    if (gain > worst) worst = gain;
  }
  return base - worst * 0.85;
}

function defended(state: GameState, s: Square, by: Color): boolean {
  // Cheap approximation: is there any piece of `by` that could recapture on s?
  const view: GameState = { ...state, turn: by, turnState: { ...state.turnState, normalMoveDone: false, bonusMoveAvailable: false } };
  const board = view.board.slice();
  const occupant = board[s];
  if (!occupant) return false;
  board[s] = { ...occupant, color: opposite(by), type: 'P' };
  return legalMoves({ ...view, board, effects: [] }).some((m) => m.to === s && m.capture);
}

/** The most the side to move wins with one capture right now (a piece left hanging; pawns). */
export function bestCaptureGain(state: GameState): number {
  if (state.status.kind !== 'playing') return 0;
  const victimSide = opposite(state.turn);
  let best = 0;
  for (const m of legalMoves(state, { capturesOnly: true })) {
    const victim = state.board[m.captureSquare ?? m.to];
    const attacker = state.board[m.from];
    if (!victim || !attacker || victim.color !== victimSide) continue;
    const gain = VAL[victim.type] - Math.min(VAL[victim.type], defended(state, m.to, victimSide) ? VAL[attacker.type] : 0);
    if (gain > best) best = gain;
  }
  return best;
}

export function orderMoves(state: GameState, moves: Move[]): Move[] {
  const score = (m: Move) => {
    let v = 0;
    const piece = state.board[m.from];
    if (m.capture) {
      const victim = state.board[m.captureSquare ?? m.to];
      v += 10 * (victim ? VAL[victim.type] : 1) - (piece ? VAL[piece.type] : 0);
    } else if (piece) {
      // quiet moves (a narrow search looks at the first few only): towards the centre, minor
      // pieces out first, the king and an early queen last
      v += (centre(m.to) - centre(m.from)) * 0.3;
      const home = piece.color === 'w' ? m.from >> 3 === 0 : m.from >> 3 === 7;
      if ((piece.type === 'N' || piece.type === 'B') && home) v += 0.6;
      if (piece.type === 'K') v -= 0.6;
      else if (piece.type === 'Q' && state.turnIndex < 12) v -= 0.3;
    }
    if (m.promotion) v += 8;
    return -v;
  };
  const keyed = moves.map((m) => ({ m, k: score(m) }));
  keyed.sort((a, b) => a.k - b.k);
  return keyed.map((x) => x.m);
}

/** The strongest piece a pawn of `color` may still become („Végzet” may have taken some). */
export const bestPromotion = (state: GameState, color: Color): PromotionPiece => promotionChoices(state, color)[0] ?? 'Q';

export const moveAction = (state: GameState, m: Move): Action => ({
  type: 'MOVE', from: m.from, to: m.to, ...(m.promotion ? { promotion: bestPromotion(state, state.turn) } : {}),
});

export function play(state: GameState, m: Move): GameState | null {
  const r = applyAction(state, moveAction(state, m));
  return r.ok ? r.state : null;
}

interface SearchResult {
  move: Move | null;
  score: number;
}

/** 2-ply alpha-beta search over normal moves. */
export function searchMove(state: GameState, me: Color = state.turn, ai: AIProfile = DEFAULT_AI): SearchResult {
  const moves = orderMoves(state, legalMoves(state));
  let best: SearchResult = { move: null, score: -Infinity };
  for (const m of moves) {
    const s1 = play(state, m);
    if (!s1) continue;
    let score: number;
    if (s1.status.kind !== 'playing' || s1.turn === me) {
      score = s1.turn === me ? threatAwareEval(s1, me, ai) : evaluate(s1, me, ai);
    } else {
      const replies = orderMoves(s1, legalMoves(s1));
      if (!replies.length) score = evaluate(s1, me, ai);
      else {
        score = Infinity;
        for (const r of replies) {
          const s2 = play(s1, r);
          if (!s2) continue;
          const v = evaluate(s2, me, ai);
          if (v < score) score = v;
          if (score <= best.score) break; // alpha cut-off
        }
        if (score === Infinity) score = evaluate(s1, me, ai);
      }
    }
    score += Math.random() * 0.05; // a little variety between games
    if (score > best.score) best = { move: m, score };
  }
  return best;
}

function* combos(state: GameState, id: SpellId, picked: Square[] = [], limit = { n: 24 }): Generator<Square[]> {
  const spell = SPELLS[id];
  if (picked.length === spell.steps.length) {
    if (limit.n-- > 0) yield picked;
    return;
  }
  for (const t of validTargets(state, id, picked)) {
    if (limit.n <= 0) return;
    yield* combos(state, id, [...picked, t], limit);
  }
}

function shuffled<T>(xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Up to `budget` combinations, spread over a few randomly chosen targets at every step. */
function* spreadCombos(state: GameState, id: SpellId, picked: Square[], budget: number): Generator<Square[]> {
  const steps = SPELLS[id].steps.length;
  if (picked.length === steps) {
    yield picked;
    return;
  }
  const ts = shuffled(validTargets(state, id, picked));
  if (picked.length === steps - 1) {
    for (const t of ts.slice(0, budget)) yield [...picked, t];
    return;
  }
  // a few first choices, each followed up with its share of the budget
  const n = Math.min(ts.length, Math.ceil(Math.sqrt(budget)));
  for (let i = 0; i < n; i++) {
    const share = Math.floor(budget / n) + (i < budget % n ? 1 : 0);
    if (share > 0) yield* spreadCombos(state, id, [...picked, ts[i]], share);
  }
}

const tryCombos = (state: GameState, id: SpellId, ai: AIProfile): Iterable<Square[]> =>
  ai.spreadCombos ? spreadCombos(state, id, [], ai.comboLimit) : combos(state, id, [], { n: ai.comboLimit });

export interface SpellChoice {
  spellId: SpellId;
  targets: Square[];
  score: number;
}

/** A cast that leaves a promotion to choose (Azonnali átváltozás…) is judged with the best choice made. */
function settled(s: GameState): GameState {
  if (!s.pendingPromotion) return s;
  const r = applyAction(s, { type: 'PROMOTE', piece: bestPromotion(s, s.pendingPromotion.color) });
  return r.ok ? r.state : s;
}

/** After a cast: may the side to move go on (a legal move, a promotion to choose, or ending the turn)? */
export const escapes = (s: GameState) => !!s.pendingPromotion || legalMoves(s).length > 0 || canEndTurn(s);

/**
 * Last resort when only a spell can save the king and the sampled targets missed it (say a wall that
 * has to stand on the far side of the board): every target combination, the way the engine itself
 * decides that such an escape exists. Without it the AI would have no action at all.
 */
export function anyEscape(state: GameState, me: Color, ai: AIProfile): SpellChoice | null {
  let best: SpellChoice | null = null;
  let found = 0;
  for (const id of hand(state, me)) {
    if (castBlockReason(state, id) !== null) continue;
    for (const targets of targetCombos(state, SPELLS[id])) {
      const r = applyAction(state, { type: 'CAST', spellId: id, targets });
      if (!r.ok || !escapes(r.state)) continue;
      const score = threatAwareEval(r.state, me, ai);
      if (!best || score > best.score) best = { spellId: id, targets, score };
      if (++found >= 40) return best;
    }
  }
  return best;
}

/** Best spell to cast now (or null if nothing clearly pays off). */
export function pickSpell(state: GameState, me: Color = state.turn, requireEscape = false, ai: AIProfile = DEFAULT_AI): SpellChoice | null {
  let best: SpellChoice | null = null;
  for (const c of spellChoices(state, me, requireEscape, ai)) if (!best || c.score > best.score) best = c;
  if (!best) return requireEscape ? anyEscape(state, me, ai) : null;
  if (requireEscape || best.score > ai.castThreshold) return best;
  return null;
}

/**
 * Every castable card with the target combinations tried, each scored by how much it improves the
 * position (beyond the mana it costs). The bots pick from these with their own judgement.
 */
export function spellChoices(state: GameState, me: Color = state.turn, requireEscape = false, ai: AIProfile = DEFAULT_AI, stop?: () => boolean): SpellChoice[] {
  const baseline = threatAwareEval(state, me, ai);
  // Buffs for this turn's normal move (Francia sajt, Futólövész, Gyalogroham…) are judged by the
  // best move they unlock compared with the best move available without them (1 ply).
  const moveKey = (m: Move) => `${m.from}-${m.to}-${m.captureSquare ?? ''}-${m.ranged ? 1 : 0}`;
  const afterMove = (s: GameState, m: Move) => {
    const s1 = play(s, m);
    return s1 ? threatAwareEval(s1, me, ai) : -WIN;
  };
  let plain: { keys: Set<string>; best: number } | null = null;
  const plainMoves = () => {
    if (!plain) {
      const ms = legalMoves(state);
      plain = { keys: new Set(ms.map(moveKey)), best: Math.max(-WIN, ...ms.map((m) => afterMove(state, m))) };
    }
    return plain;
  };
  const out: SpellChoice[] = [];
  for (const id of hand(state, me)) {
    if (castBlockReason(state, id) !== null) continue;
    const cost = effectiveCost(state, me, SPELLS[id]);
    for (const targets of tryCombos(state, id, ai)) {
      // out of time (the bots' budget): what has been judged so far
      if (stop?.()) return out;
      const r = applyAction(state, { type: 'CAST', spellId: id, targets });
      if (!r.ok) continue;
      if (requireEscape && !escapes(r.state)) continue;
      // Mana spent is already reflected in the evaluation (manaValue per point).
      let score = threatAwareEval(settled(r.state), me, ai) - baseline - ai.costPenalty * cost + ai.cycleValue;
      if (SPELLS[id].needsNormalMove && !requireEscape) {
        const p = plainMoves();
        const fresh = legalMoves(r.state).filter((m) => !p.keys.has(moveKey(m)));
        if (!fresh.length) continue;
        score = Math.max(...fresh.map((m) => afterMove(r.state, m))) - p.best - ai.costPenalty * cost + ai.cycleValue;
      }
      out.push({ spellId: id, targets, score });
    }
  }
  return out;
}

/** Next action for the side to move (the UI calls this repeatedly with delays). */
export function aiNextAction(state: GameState, ai: AIProfile = DEFAULT_AI): Action | null {
  if (state.status.kind !== 'playing') return null;
  if (state.pendingPromotion) return { type: 'PROMOTE', piece: bestPromotion(state, state.pendingPromotion.color) };
  const me = state.turn;
  const moves = legalMoves(state);
  if (!moves.length) {
    // Manual end-turn mode: after the normal move a spell may still be worth casting.
    if (state.turnState.normalMoveDone && canEndTurn(state) && state.turnState.spellsCast < 2) {
      const post = pickSpell(state, me, false, ai);
      if (post) return { type: 'CAST', spellId: post.spellId, targets: post.targets };
    }
    if (state.mustCastSpell || !canEndTurn(state)) {
      const esc = pickSpell(state, me, true, ai);
      if (esc) return { type: 'CAST', spellId: esc.spellId, targets: esc.targets };
    }
    return canEndTurn(state) ? { type: 'END_TURN' } : null;
  }
  if (!state.turnState.normalMoveDone && state.turnState.spellsCast < 2) {
    const sp = pickSpell(state, me, false, ai);
    if (sp) return { type: 'CAST', spellId: sp.spellId, targets: sp.targets };
  }
  const best = searchMove(state, me, ai);
  if (state.turnState.bonusMoveAvailable && canEndTurn(state)) {
    // Only take the bonus move if it does not make things worse.
    const stay = threatAwareEval(state, me, ai);
    if (!best.move || best.score < stay - 0.2) return { type: 'END_TURN' };
  }
  if (best.move) return moveAction(state, best.move);
  return canEndTurn(state) ? { type: 'END_TURN' } : null;
}
