import { describe, expect, it } from 'vitest';
import { hand, maxMana, nextCard } from '../src/engine';
import type { SpellId } from '../src/engine';
import { at, cast, deckWith, endTurn, game, move, tryCast } from './helpers';

describe('mana', () => {
  it('starts at 3 and grows by 1 from each player\'s second turn', () => {
    let g = game();
    expect(g.players.w.mana).toBe(3);
    expect(g.players.b.mana).toBe(3);
    g = move(g, 'e2', 'e4');
    expect(g.players.b.mana).toBe(3); // black's first turn: no income yet
    g = move(g, 'e7', 'e5');
    expect(g.players.w.mana).toBe(4); // white's second turn
    g = move(g, 'g1', 'f3');
    expect(g.players.b.mana).toBe(4);
  });

  it('never exceeds 6 – overflow is lost (and reported)', () => {
    let g = game(undefined, { mana: 6 });
    g = move(g, 'e2', 'e4');
    g = move(g, 'e7', 'e5');
    expect(g.players.w.mana).toBe(6);
    const ev = g.events.find((e) => e.type === 'mana');
    expect(ev && ev.type === 'mana' && ev.wasted).toBe(1);
  });

  it('+1 mana for capturing with a piece, capped at 6', () => {
    let g = game(undefined, { mana: 3 });
    g = move(g, 'e2', 'e4');
    g = move(g, 'd7', 'd5');
    const before = g.players.w.mana; // 4
    g = move(g, 'e4', 'd5');
    expect(g.players.w.mana).toBe(before + 1);
    expect(g.players.w.captures).toBe(1);

    let full = game(undefined, { mana: 6 });
    full = move(full, 'e2', 'e4');
    full = move(full, 'd7', 'd5');
    full = move(full, 'e4', 'd5');
    expect(full.players.w.mana).toBe(6);
  });

  it('spells cost mana immediately and cannot be cast without enough mana', () => {
    const g = game(undefined, { w: deckWith('knightLeap'), mana: 3 });
    const s = cast(g, 'knightLeap', 'g1', 'f3');
    expect(s.players.w.mana).toBe(1);
    expect(s.turn).toBe('w'); // spells do not end the turn
    const poor = game(undefined, { w: deckWith('teleport'), mana: 3 });
    const r = tryCast(poor, 'teleport', 'g1', 'f3');
    expect(r.ok).toBe(false);
  });

  it('capture made by a spell move also gives +1 mana', () => {
    const g = game('4k3/8/8/3p4/8/4N3/8/4K3 w - - 0 1', { w: deckWith('knightLeap'), mana: 3 });
    const s = cast(g, 'knightLeap', 'e3', 'd5');
    expect(at(s, 'd5')?.type).toBe('N');
    expect(s.players.w.mana).toBe(3 - 2 + 1);
  });
});

describe('spell cycle', () => {
  const deck: SpellId[] = ['pawnShield', 'silence', 'wall', 'gravity', 'royalGuard', 'overcharge'];
  // A B C D E F from the specification
  const [A, B, C, D, E, F] = deck;

  it('follows A→B→C→D→E→F exactly like the specification', () => {
    let g = game(undefined, { w: deck, mana: 6 });
    expect(hand(g, 'w')).toEqual([A, B, C]);
    g = cast(g, A, 'e2');
    expect(hand(g, 'w')).toEqual([B, C, D]);
    expect(g.players.w.deck).toEqual([B, C, D, E, F, A]);
    g = cast(g, B);
    expect(hand(g, 'w')).toEqual([C, D, E]);
    g = cast(g, C, 'e4');
    expect(hand(g, 'w')).toEqual([D, E, F]);
    expect(nextCard(g, 'w')).toBe(A);
    expect(g.players.w.cycleCount).toBe(3);
  });

  it('using a card from the middle of the hand pulls in the next card', () => {
    let g = game(undefined, { w: deck, mana: 6 });
    g = cast(g, B);
    expect(hand(g, 'w')).toEqual([A, C, D]);
    expect(g.players.w.deck).toEqual([A, C, D, E, F, B]);
  });

  it('only cards in hand can be cast', () => {
    const g = game(undefined, { w: deck, mana: 6 });
    expect(tryCast(g, 'gravity').ok).toBe(false);
  });

  it('Gambit advances the cycle by one extra step and gives the opponent 2 mana', () => {
    const d: SpellId[] = ['gambit', 'silence', 'wall', 'gravity', 'royalGuard', 'overcharge'];
    let g = game(undefined, { w: d, mana: 3 });
    g = cast(g, 'gambit');
    // gambit → back, then the first hand card (silence) → back as well
    expect(hand(g, 'w')).toEqual(['wall', 'gravity', 'royalGuard']);
    expect(g.players.b.mana).toBe(5);
    expect(g.players.w.mana).toBe(2);
  });
});

describe('mana spells', () => {
  it('Túltöltés makes the next spell 2 cheaper (min 1) once', () => {
    let g = game(undefined, { w: deckWith('overcharge', 'teleport', 'pawnShield'), mana: 6 });
    g = cast(g, 'overcharge'); // 6 - 2 = 4
    g = cast(g, 'teleport', 'g1', 'f3'); // 4 - (5-2) = 1
    expect(g.players.w.mana).toBe(1);
    g = cast(g, 'pawnShield', 'e2'); // full price again: 1
    expect(g.players.w.mana).toBe(0);
  });

  it('discount never goes below 1 mana', () => {
    let g = game(undefined, { w: deckWith('overcharge', 'pawnShield'), mana: 3 });
    g = cast(g, 'overcharge');
    g = cast(g, 'pawnShield', 'e2');
    expect(g.players.w.mana).toBe(0);
  });

  it('Arcane Surge: +3 mana but max 4 until the end of the next own turn', () => {
    let g = game(undefined, { w: deckWith('arcaneSurge'), mana: 2 });
    g = cast(g, 'arcaneSurge'); // 2 - 1 + 3 = 4
    expect(g.players.w.mana).toBe(4);
    expect(maxMana(g, 'w')).toBe(4);
    g = move(g, 'e2', 'e4');
    g = move(g, 'e7', 'e5');
    expect(g.players.w.mana).toBe(4); // income capped
    g = move(g, 'd2', 'd4');
    g = move(g, 'd7', 'd6');
    expect(maxMana(g, 'w')).toBe(6);
    expect(g.players.w.mana).toBe(5);
  });

  it('Manaelszívás, Vérár, Áldozat', () => {
    let g = game(undefined, { w: deckWith('manaDrain', 'bloodPrice'), mana: 6 });
    g = { ...g, players: { ...g.players, b: { ...g.players.b, mana: 5 } } };
    g = cast(g, 'manaDrain');
    expect(g.players.b.mana).toBe(3);
    expect(g.players.w.mana).toBe(3);
    g = cast(g, 'bloodPrice', 'b1'); // 3-2+3 = 4
    expect(g.players.w.mana).toBe(4);
    expect(at(g, 'b1')).toBeNull();

    let s = game(undefined, { w: deckWith('sacrifice'), mana: 1 });
    s = cast(s, 'sacrifice', 'a2'); // 1 - 1 + 3
    expect(s.players.w.mana).toBe(3);
    expect(at(s, 'a2')).toBeNull();
    expect(s.captured.w.some((p) => p.type === 'P')).toBe(true);
  });

  it('a spell-only turn may be ended; mana income resumes next turn', () => {
    let g = game(undefined, { w: deckWith('silence'), b: deckWith('silence'), mana: 3 });
    g = cast(g, 'silence');
    g = endTurn(g);
    expect(g.turn).toBe('b');
    const r = tryCast(g, 'silence');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain('Némaság');
  });
});
