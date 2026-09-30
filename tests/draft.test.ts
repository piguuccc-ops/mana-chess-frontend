// Spell-toborzás (the draft): the table, the turn order, the deck rules while picking, and the AI's
// picks – which must always add up to a playable deck.
import { describe, expect, it } from 'vitest';
import {
  applyPick, costLimitReason, DECK_SIZE, draftDone, draftPool, draftTurn, DRAFT_CHEAP_MIN, DRAFT_POOL_SIZE, isValidDraft, newDraft, pickBlockReason,
  pickLimitReason, SPELLS, SPELL_LIST, takenBy, validateDeck, type Color, type Draft, type SpellId,
} from '../src/engine';
import { aiDraftPick, DRAFT_VALUE } from '../src/ai/draftAI';

/** A small seeded generator for the tests. */
const rng = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

describe('the table', () => {
  it('32 different spells from the game, the same for the same seed', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const pool = draftPool(seed);
      expect(pool).toHaveLength(DRAFT_POOL_SIZE);
      expect(new Set(pool).size).toBe(DRAFT_POOL_SIZE);
      expect(pool.every((id) => SPELLS[id])).toBe(true);
      expect(pool.filter((id) => SPELLS[id].manaCost <= 2).length).toBeGreaterThanOrEqual(DRAFT_CHEAP_MIN);
      expect(draftPool(seed)).toEqual(pool);
    }
    expect(draftPool(1)).not.toEqual(draftPool(2));
    // over many tables every spell of the game turns up
    const seen = new Set<SpellId>();
    for (let seed = 1; seed <= 200; seed++) draftPool(seed).forEach((id) => seen.add(id));
    expect(seen.size).toBe(SPELL_LIST.length);
  });
});

describe('picking', () => {
  it('Világos first, then one each in turn, until both have 6', () => {
    let d = newDraft(7);
    const order: Color[] = [];
    for (let i = 0; i < DECK_SIZE * 2; i++) {
      const who = draftTurn(d)!;
      order.push(who);
      const id = d.pool.find((s) => pickBlockReason(d, who, s) === null)!;
      d = applyPick(d, who, id);
      expect(takenBy(d, id)).toBe(who);
    }
    expect(order.join('')).toBe('wbwbwbwbwbwb');
    expect(draftDone(d)).toBe(true);
    expect(draftTurn(d)).toBeNull();
    expect(d.picks.w).toHaveLength(6);
    expect(d.picks.b).toHaveLength(6);
    expect(validateDeck(d.picks.w)).toBeNull();
    expect(validateDeck(d.picks.b)).toBeNull();
    expect(isValidDraft(d)).toBe(true);
    // Sötét can start too
    expect(draftTurn(newDraft(7, 'b'))).toBe('b');
  });

  it('not your turn, a spell already taken, one off the table, and the deck rules', () => {
    let d = newDraft(11);
    const first = d.pool[0];
    expect(pickBlockReason(d, 'b', first)).toMatch(/nem te választasz/);
    d = applyPick(d, 'w', first);
    expect(pickBlockReason(d, 'b', first)).toMatch(/elvitték/);
    const outside = SPELL_LIST.map((s) => s.id).find((id) => !d.pool.includes(id))!;
    expect(pickBlockReason(d, 'b', outside)).toMatch(/nincs az asztalon/);
    // at most one 6-mana (and one 5-mana) spell per deck, as in the deck builder
    const six = SPELL_LIST.filter((s) => s.manaCost === 6).map((s) => s.id);
    const table: Draft = { pool: [...six, ...d.pool.filter((id) => !six.includes(id))].slice(0, DRAFT_POOL_SIZE), picks: { w: [six[0]], b: [] }, first: 'w' };
    const t2 = applyPick(table, 'b', table.pool.find((id) => !six.includes(id))!);
    expect(draftTurn(t2)).toBe('w');
    expect(pickBlockReason(t2, 'w', six[1])).toBe(costLimitReason([six[0]], six[1]));
    expect(pickLimitReason(t2, 'b', six[1])).toBeNull(); // Sötét could still take one
  });

  it('a draft from the network is checked pick by pick', () => {
    let d = newDraft(5);
    d = applyPick(d, 'w', d.pool[3]);
    d = applyPick(d, 'b', d.pool[4]);
    expect(isValidDraft(d)).toBe(true);
    expect(isValidDraft({ ...d, picks: { w: [d.pool[3], d.pool[5]], b: [d.pool[4]] } })).toBe(true); // Világos's turn again
    expect(isValidDraft({ ...d, picks: { w: [d.pool[3]], b: [d.pool[4], d.pool[5]] } })).toBe(false); // Sötét twice
    expect(isValidDraft({ ...d, picks: { w: [d.pool[3]], b: [d.pool[3]] } })).toBe(false); // the same card twice
    expect(isValidDraft({ ...d, pool: d.pool.slice(1) })).toBe(false);
    expect(isValidDraft({ ...d, first: 'x' })).toBe(false);
    expect(isValidDraft(null)).toBe(false);
  });
});

describe('the AI drafts', () => {
  it('a legal, playable deck every time – two cheap spells and a castable opening hand', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const random = rng(seed);
      let d = newDraft(seed, seed % 2 ? 'w' : 'b');
      while (!draftDone(d)) {
        const who = draftTurn(d)!;
        const id = aiDraftPick(d, who, random);
        expect(id).not.toBeNull();
        expect(pickBlockReason(d, who, id!)).toBeNull();
        d = applyPick(d, who, id!);
      }
      for (const c of ['w', 'b'] as const) {
        const deck = d.picks[c];
        expect(validateDeck(deck)).toBeNull();
        const costs = deck.map((id) => SPELLS[id].manaCost);
        expect(costs.filter((x) => x <= 2).length).toBeGreaterThanOrEqual(2);
        expect(costs.slice(0, 3).some((x) => x <= 3)).toBe(true);
      }
    }
  });

  it('prefers what it plays well, skips what it cannot use', () => {
    let top = 0;
    let avoided = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const d = newDraft(seed);
      const pick = aiDraftPick(d, 'w', rng(seed))!;
      const best5 = [...d.pool].sort((a, b) => DRAFT_VALUE[b] - DRAFT_VALUE[a]).slice(0, 5);
      if (best5.includes(pick)) top++;
      if (['brigade', 'doubleMove'].includes(pick)) avoided++;
    }
    expect(top).toBeGreaterThan(160); // the first pick is nearly always one of the table's five best
    expect(avoided).toBe(0);
    expect(aiDraftPick(newDraft(1), 'b')).toBeNull(); // not its turn
  });
});
