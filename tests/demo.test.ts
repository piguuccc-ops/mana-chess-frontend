// The card inspector's demos: every spell must have one, and every scripted step
// must be a legal action when replayed from the demo's starting position.
import { describe, expect, it } from 'vitest';
import { applyAction, hand, isAwakened, SPELL_LIST, SPELLS } from '../src/engine';
import type { Action } from '../src/engine';
import { buildDemo, SCENARIOS } from '../src/ui/demo/scenarios';

describe('spell demos', () => {
  it('every spell has a demo that replays step by step', () => {
    for (const spell of SPELL_LIST) {
      const d = buildDemo(spell.id);
      expect(d, spell.id).not.toBeNull();
      if (!d) continue;
      expect(hand(d.start, 'w'), spell.id).toContain(spell.id);
      expect(d.steps[0]).toMatchObject({ kind: 'cast', spell: spell.id });
      expect(d.note.length, spell.id).toBeGreaterThan(0);
      let s = d.start;
      for (const step of d.steps) {
        if (step.kind === 'cycle') {
          // „Körforgás”: the skip ahead only turns the deck over – the board stays as it was
          expect(step.to.board, spell.id).toEqual(s.board);
          expect(hand(step.to, 'w'), spell.id).toContain(spell.id);
          s = step.to;
          continue;
        }
        const a: Action =
          step.kind === 'cast'
            ? { type: 'CAST', spellId: step.spell, targets: step.targets }
            : step.kind === 'promote'
              ? { type: 'PROMOTE', piece: step.piece }
              : { type: 'MOVE', from: step.from, to: step.to };
        const r = applyAction(s, a);
        expect(r.ok, `${spell.id}: ${JSON.stringify(step)}`).toBe(true);
        if (!r.ok) break;
        s = r.state;
      }
      // a demo never stops halfway, e.g. with a pawn still waiting for its new shape
      expect(s.pendingPromotion, `${spell.id} ends with an open promotion`).toBeNull();
    }
  });

  it('Azonnali átváltozás: the demo pawn really becomes a queen', () => {
    const d = buildDemo('instantPromotion')!;
    const cast = d.steps[0];
    expect(d.steps.map((x) => x.kind)).toEqual(['cast', 'promote']);
    let s = d.start;
    for (const step of d.steps) {
      const a: Action = step.kind === 'cast' ? { type: 'CAST', spellId: step.spell, targets: step.targets } : { type: 'PROMOTE', piece: 'Q' };
      const r = applyAction(s, a);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    expect(cast.kind === 'cast' && s.board[cast.targets[0]]?.type).toBe('Q');
  });

  it('hand-picked targets and follow-ups are actually used', () => {
    for (const [id, sc] of Object.entries(SCENARIOS)) {
      const d = buildDemo(id as keyof typeof SPELLS)!;
      const cast = d.steps[0];
      if (sc?.targets && cast.kind === 'cast') expect(cast.targets.length, id).toBe(SPELLS[id as keyof typeof SPELLS].steps.length);
      if (sc?.follow?.length) expect(d.steps.filter((x) => x.kind !== 'promote').length - 1, `${id} follow-up`).toBe(sc.follow.length);
    }
  });

  it('Végzet: plain first, then a deck cycle later the awakened card erases its target', () => {
    const d = buildDemo('doom')!;
    expect(d.start.players.w.charges.doom).toBe(1); // it has gone round once already: one more plain cast charges it
    expect(d.steps.map((x) => x.kind)).toEqual(['cast', 'cycle', 'cast']);
    const [first, skip, second] = d.steps;
    if (first.kind !== 'cast' || skip.kind !== 'cycle' || second.kind !== 'cast') throw new Error('unexpected steps');
    const r1 = applyAction(d.start, { type: 'CAST', spellId: 'doom', targets: first.targets });
    if (!r1.ok) throw new Error(r1.error);
    // the plain form: the pawn is destroyed (it could still come back), the card charges
    expect(r1.state.captured.b.map((p) => p.type)).toEqual(['P']);
    expect(r1.state.erased).toEqual([]);
    expect(hand(r1.state, 'w')).not.toContain('doom');
    // three other cards later it is back, awakened, with full crystals
    expect(skip.decks).toHaveLength(3);
    expect(hand(skip.to, 'w')).toContain('doom');
    expect(isAwakened(skip.to, 'w', 'doom')).toBe(true);
    expect(skip.to.players.w.mana).toBe(6);
    const r2 = applyAction(skip.to, { type: 'CAST', spellId: 'doom', targets: second.targets });
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.state.erased.map((p) => p.type)).toEqual(['N']);
    expect(r2.state.events.find((e) => e.type === 'spell')).toMatchObject({ awakened: true });
    expect(second.note).toContain('Felébredt');
  });
});
