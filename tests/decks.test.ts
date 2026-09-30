import { describe, expect, it } from 'vitest';
import { costLimitReason, deckShapeError, PRESET_DECKS, randomDeck, SPELLS, validateDeck } from '../src/engine';
import type { SpellId } from '../src/engine';

function seeded(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

describe('decks', () => {
  it('every preset deck is valid', () => {
    for (const d of PRESET_DECKS) expect(validateDeck(d.spells)).toBeNull();
  });

  it('random decks are valid and playable', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const deck = randomDeck(seeded(i));
      expect(validateDeck(deck)).toBeNull();
      const costs = deck.map((id) => SPELLS[id].manaCost);
      expect(costs.filter((c) => c === 6).length).toBeLessThanOrEqual(1);
      expect(costs.filter((c) => c === 5).length).toBeLessThanOrEqual(1);
      expect(costs.filter((c) => c <= 2).length).toBeGreaterThanOrEqual(2);
      expect(costs.slice(0, 3).some((c) => c <= 3)).toBe(true); // castable opening hand
      seen.add(deck.join(','));
    }
    expect(seen.size).toBeGreaterThan(490); // really random
  });

  it('is deterministic with a seeded generator', () => {
    expect(randomDeck(seeded(42))).toEqual(randomDeck(seeded(42)));
  });

  it('holds at most one 6-mana and one 5-mana spell', () => {
    const base: SpellId[] = ['pawnShield', 'knightLeap', 'weaken', 'forcedMarch'];
    expect(validateDeck([...base, 'meteor', 'execution'])).toBeNull(); // one 6 and one 5: fine
    expect(validateDeck([...base, 'meteor', 'doom'])).toMatch(/legfeljebb egy 6 manás spell.*Meteor, Végzet/);
    expect(validateDeck([...base, 'timeStop', 'rewind'])).toMatch(/legfeljebb egy 5 manás spell/);
    // a deck that only breaks the limit still exists – a saved one can be fixed rather than lost
    expect(deckShapeError([...base, 'meteor', 'doom'])).toBeNull();
  });

  it('says why a card cannot join the deck', () => {
    const deck: SpellId[] = ['pawnShield', 'meteor', 'execution'];
    expect(costLimitReason(deck, 'doom')).toMatch(/már benne van: Meteor/);
    expect(costLimitReason(deck, 'rewind')).toMatch(/már benne van: Kivégzés/);
    expect(costLimitReason(deck, 'fortify')).toBeNull(); // 4 mana: no limit
    expect(costLimitReason(deck, 'meteor')).toBeNull(); // already in the deck
  });

  it('a random deck may still bring one of the most expensive spells', () => {
    const decks = Array.from({ length: 300 }, (_, i) => randomDeck(seeded(1000 + i)));
    expect(decks.some((d) => d.some((id) => SPELLS[id].manaCost === 6))).toBe(true);
    expect(decks.some((d) => d.some((id) => SPELLS[id].manaCost === 5))).toBe(true);
  });
});
