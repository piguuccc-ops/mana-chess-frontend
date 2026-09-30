// Randomised games with random decks: after every single action the game state
// must still satisfy the core invariants (no illegal chess positions, no desync).
import { describe, expect, it } from 'vitest';
import {
  applyAction, canEndTurn, castBlockReason, createGame, findKing, hand, inCheck, legalMoves, maxMana, opposite,
  promotionChoices, rankOf, SPELL_LIST, validTargets,
} from '../src/engine';
import type { Action, GameState, SpellId } from '../src/engine';
import { aiNextAction } from '../src/ai/simpleAI';

function rng(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function randomDeck(r: () => number): SpellId[] {
  const pool = SPELL_LIST.map((s) => s.id);
  const deck: SpellId[] = [];
  while (deck.length < 6) {
    const id = pool.splice(Math.floor(r() * pool.length), 1)[0];
    deck.push(id);
  }
  return deck;
}

function checkInvariants(prev: GameState, s: GameState, decks: Record<'w' | 'b', SpellId[]>, totalPieces = 32) {
  for (const c of ['w', 'b'] as const) {
    expect(s.board.filter((p) => p && p.type === 'K' && p.color === c)).toHaveLength(1);
    expect(s.players[c].mana).toBeGreaterThanOrEqual(0);
    expect(s.players[c].mana).toBeLessThanOrEqual(maxMana(s, c));
    expect([...s.players[c].deck].sort()).toEqual([...decks[c]].sort());
  }
  const ids = s.board.filter(Boolean).map((p) => p!.id);
  expect(new Set(ids).size).toBe(ids.length);
  // every piece is on the board, captured, or erased by „Végzet” (gone from existence, never back)
  expect(ids.length + s.captured.w.length + s.captured.b.length + s.erased.length).toBe(totalPieces);
  for (const { id } of s.erased) {
    expect(ids).not.toContain(id);
    expect([...s.captured.w, ...s.captured.b].some((p) => p.id === id)).toBe(false);
  }
  s.board.forEach((p, i) => {
    if (p && p.type === 'P' && (rankOf(i) === 0 || rankOf(i) === 7)) expect(s.pendingPromotion?.square).toBe(i);
  });
  const walls = new Set(s.effects.filter((e) => e.kind === 'wall').flatMap((e) => e.squares ?? []));
  for (const w of walls) expect(s.board[w]).toBeNull();
  // The player who just finished a turn must never be left in check.
  if (s.turn !== prev.turn && s.status.kind === 'playing') expect(inCheck(s, prev.turn)).toBe(false);
  // A playing side always has something legal to do.
  if (s.status.kind === 'playing' && !s.pendingPromotion) {
    const options = legalMoves(s).length > 0 || canEndTurn(s) || hand(s, s.turn).some((id) => castBlockReason(s, id) === null);
    expect(options).toBe(true);
  }
  expect(findKing(s.board, opposite(s.turn))).toBeGreaterThanOrEqual(0);
}

function randomAction(s: GameState, r: () => number): Action | null {
  if (s.pendingPromotion) {
    // only the kinds of piece „Végzet” has not erased
    const choices = promotionChoices(s, s.pendingPromotion.color);
    return { type: 'PROMOTE', piece: choices[Math.floor(r() * choices.length)] };
  }
  const castable = hand(s, s.turn).filter((id) => castBlockReason(s, id) === null);
  const moves = legalMoves(s);
  if (castable.length && (r() < 0.35 || moves.length === 0)) {
    const id = castable[Math.floor(r() * castable.length)];
    const spell = SPELL_LIST.find((x) => x.id === id)!;
    const targets: number[] = [];
    for (let i = 0; i < spell.steps.length; i++) {
      const opts = validTargets(s, id, targets);
      if (!opts.length) return null;
      targets.push(opts[Math.floor(r() * opts.length)]);
    }
    return { type: 'CAST', spellId: id, targets };
  }
  if (moves.length && !(s.turnState.normalMoveDone && !s.turnState.bonusMoveAvailable)) {
    const m = moves[Math.floor(r() * moves.length)];
    return { type: 'MOVE', from: m.from, to: m.to };
  }
  return canEndTurn(s) ? { type: 'END_TURN' } : null;
}

describe('fuzz: random games keep the state legal', () => {
  it('60 random games with random decks', () => {
    let totalActions = 0;
    let spellsCast = 0;
    for (let gameNo = 0; gameNo < 60; gameNo++) {
      const r = rng(1000 + gameNo);
      const decks = { w: randomDeck(r), b: randomDeck(r) };
      let s = createGame({ decks, seed: gameNo, mana: { w: 6, b: 6 }, autoEndTurn: gameNo % 4 !== 3 });
      let total = 32;
      for (let i = 0; i < 160 && s.status.kind === 'playing'; i++) {
        const a = randomAction(s, r);
        expect(a).not.toBeNull();
        const res = applyAction(s, a!);
        if (!res.ok) throw new Error(`game ${gameNo} action ${i} ${JSON.stringify(a)}: ${res.error}`);
        if (a!.type === 'CAST' && a!.spellId === 'brigade') total += 5;
        if (a!.type === 'CAST' && a!.spellId === 'clone') total += 1;
        checkInvariants(s, res.state, decks, total);
        if (a!.type === 'CAST') spellsCast++;
        s = res.state;
        totalActions++;
      }
    }
    console.log(`fuzz: ${totalActions} actions, ${spellsCast} spells`);
    expect(totalActions).toBeGreaterThan(3000);
    expect(spellsCast).toBeGreaterThan(500);
  }, 120_000);

  it('40 random games focused on the newest spells (mines, stepping aside, forced moves…)', () => {
    const pool: SpellId[] = [
      'mine', 'outOfWay', 'quickCastle', 'pawnVault', 'provoke', 'invisibility', 'magnet', 'repulse', 'manaDeposit',
      'scout', 'manaThirst', 'retrain', 'storm', 'shieldBreaker', 'gravityWell', 'manaArmageddon', 'dragonFire',
      'doomsday', 'silence', 'fortify', 'pawnShield', 'knightLeap',
    ];
    const cast = new Map<string, number>();
    let explosions = 0;
    let defuses = 0;
    let returns = 0;
    for (let gameNo = 0; gameNo < 40; gameNo++) {
      const r = rng(5000 + gameNo);
      const pick = () => {
        const p = [...pool];
        const d: SpellId[] = [];
        while (d.length < 6) d.push(p.splice(Math.floor(r() * p.length), 1)[0]);
        return d;
      };
      const decks = { w: pick(), b: pick() };
      let s = createGame({ decks, seed: gameNo, mana: { w: 6, b: 6 }, autoEndTurn: gameNo % 4 !== 3 });
      for (let i = 0; i < 140 && s.status.kind === 'playing'; i++) {
        const a = randomAction(s, r);
        expect(a).not.toBeNull();
        const res = applyAction(s, a!);
        if (!res.ok) throw new Error(`game ${gameNo} action ${i} ${JSON.stringify(a)}: ${res.error}`);
        checkInvariants(s, res.state, decks, 32);
        if (a!.type === 'CAST') cast.set(a!.spellId, (cast.get(a!.spellId) ?? 0) + 1);
        explosions += res.state.events.filter((e) => e.type === 'explode').length;
        defuses += res.state.events.filter((e) => e.type === 'defuse').length;
        returns += res.state.log.length > s.log.length
          ? res.state.log.slice(s.log.length).filter((l) => l.text.includes('visszatért')).length
          : 0;
        s = res.state;
      }
    }
    console.log(`new-spell fuzz: ${[...cast.entries()].map(([k, v]) => `${k}:${v}`).join(' ')} | explosions ${explosions}, defuses ${defuses}, returns ${returns}`);
    for (const id of pool) if (id !== 'quickCastle') expect(cast.get(id) ?? 0).toBeGreaterThan(0);
    expect(explosions).toBeGreaterThan(0);
    expect(returns).toBeGreaterThan(0);
  }, 180_000);

  it('AI vs AI plays only legal actions', () => {
    for (let gameNo = 0; gameNo < 3; gameNo++) {
      const r = rng(77 + gameNo);
      const decks = { w: randomDeck(r), b: randomDeck(r) };
      let s = createGame({ decks, seed: gameNo });
      let total = 32;
      for (let i = 0; i < 60 && s.status.kind === 'playing'; i++) {
        const a = aiNextAction(s);
        expect(a).not.toBeNull();
        const res = applyAction(s, a!);
        if (!res.ok) throw new Error(`AI illegal action ${JSON.stringify(a)}: ${res.error}`);
        if (a!.type === 'CAST' && a!.spellId === 'brigade') total += 5;
        if (a!.type === 'CAST' && a!.spellId === 'clone') total += 1;
        checkInvariants(s, res.state, decks, total);
        s = res.state;
      }
    }
  }, 120_000);
});
