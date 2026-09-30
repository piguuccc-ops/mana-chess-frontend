// The AI opponent: it must always have an action while the game is running.
import { describe, expect, it } from 'vitest';
import { aiNextAction, DEFAULT_AI } from '../src/ai/simpleAI';
import type { AIProfile } from '../src/ai/simpleAI';
import { applyAction, legalMoves } from '../src/engine';
import { deckWith, game, S } from './helpers';

const BOLD: AIProfile = { ...DEFAULT_AI, castThreshold: 0.1, manaValue: 0.18, spreadCombos: true, overflowAware: true };

describe('AI', () => {
  // Black is in check along the 8th rank with no legal move; only a wall on b8–g8 saves the king.
  // Those squares come last in board order, beyond the handful of targets the AI samples normally.
  const fen = 'R6k/6pp/8/8/8/8/8/4K3 b - - 0 1';
  const blocks = ['b8', 'c8', 'd8', 'e8', 'f8', 'g8'].map(S);

  for (const [name, profile] of [['in-game', DEFAULT_AI], ['bold', BOLD]] as const) {
    it(`finds a spell escape anywhere on the board (${name} profile)`, () => {
      const g = game(fen, { b: deckWith('wall'), mana: 6 });
      expect(g.status.kind).toBe('playing');
      expect(g.mustCastSpell).toBe(true);
      expect(legalMoves(g)).toEqual([]);
      const a = aiNextAction(g, profile);
      expect(a?.type).toBe('CAST');
      if (a?.type !== 'CAST') return;
      expect(a.spellId).toBe('wall');
      expect(blocks).toContain(a.targets[0]);
      const r = applyAction(g, a);
      expect(r.ok).toBe(true);
    });
  }

  it('the default profile is the in-game opponent', () => {
    expect(DEFAULT_AI).toEqual({
      manaValue: 0.28, castThreshold: 0.45, costPenalty: 0.05, comboLimit: 24, spreadCombos: false, overflowAware: false, cycleValue: 0,
    });
  });
});
