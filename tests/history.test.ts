// Undo / redo of local games: steps are whole snapshots, so going back and forth returns the
// very same states (mana, hands, effects, the chaos seed), and a new step forgets the redo path.
import { describe, expect, it } from 'vitest';
import { applyAction, createGame } from '../src/engine';
import type { Action, GameState } from '../src/engine';
import { GameHistory, type Step } from '../src/ui/history';

function play(s: GameState, a: Action): GameState {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

function step(before: GameState, a: Action): Step {
  const after = play(before, a);
  const lm = a.type === 'MOVE' ? { from: a.from, to: a.to } : null;
  return { action: a, before: { state: before, lastMove: null }, after: { state: after, lastMove: lm } };
}

describe('undo / redo history', () => {
  it('starts empty', () => {
    const h = new GameHistory();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBeNull();
  });

  it('walks back and forth through the exact same states', () => {
    const s0 = createGame({ decks: { w: ['silence', 'knightLeap', 'pawnShield', 'weaken', 'root', 'wall'], b: ['wall', 'root', 'silence', 'weaken', 'mine', 'gravity'] }, autoEndTurn: false, mana: { w: 6, b: 6 } });
    const h = new GameHistory();
    const a1: Action = { type: 'MOVE', from: 12, to: 28 }; // e2–e4
    const st1 = step(s0, a1);
    h.record(st1);
    const a2: Action = { type: 'CAST', spellId: 'silence', targets: [] };
    const st2 = step(st1.after.state, a2);
    h.record(st2);
    const a3: Action = { type: 'END_TURN' };
    const st3 = step(st2.after.state, a3);
    h.record(st3);
    expect(st3.after.state.turn).toBe('b');
    expect(st2.after.state.players.w.mana).toBe(s0.players.w.mana - 2);

    // back to the start, one step at a time
    expect(h.undo()?.before.state).toBe(st2.after.state);
    expect(h.undo()?.before.state).toBe(st1.after.state);
    const first = h.undo();
    expect(first?.before.state).toBe(s0);
    expect(first?.before.state.players.w.mana).toBe(6);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(true);

    // and forward again
    expect(h.redo()?.after.state).toBe(st1.after.state);
    expect(h.redo()?.after.state).toBe(st2.after.state);
    expect(h.redo()?.after.state).toBe(st3.after.state);
    expect(h.canRedo).toBe(false);
  });

  it('a new step after an undo forgets the undone path', () => {
    const s0 = createGame({ decks: { w: [], b: [] } });
    const h = new GameHistory();
    const st1 = step(s0, { type: 'MOVE', from: 12, to: 28 });
    h.record(st1);
    h.undo();
    expect(h.canRedo).toBe(true);
    h.record(step(s0, { type: 'MOVE', from: 11, to: 27 })); // d2–d4 instead
    expect(h.canRedo).toBe(false);
    expect(h.undo()?.action).toEqual({ type: 'MOVE', from: 11, to: 27 });
  });

  it('keeps at most `limit` steps', () => {
    const h = new GameHistory(3);
    let s = createGame({ decks: { w: [], b: [] } });
    const moves: Action[] = [
      { type: 'MOVE', from: 6, to: 21 }, { type: 'MOVE', from: 62, to: 45 },
      { type: 'MOVE', from: 21, to: 6 }, { type: 'MOVE', from: 45, to: 62 },
      { type: 'MOVE', from: 6, to: 21 },
    ];
    for (const a of moves) {
      const st = step(s, a);
      h.record(st);
      s = st.after.state;
    }
    let n = 0;
    while (h.undo()) n++;
    expect(n).toBe(3);
  });
});
