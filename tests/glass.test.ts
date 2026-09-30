// „Üvegátok”: a cursed enemy piece breaks right after it captures something (until the end of
// the opponent's next turn). 2 mana, 3 on a queen.
import { describe, expect, it } from 'vitest';
import { effectiveCost, SPELLS, validTargets } from '../src/engine';
import type { GameState } from '../src/engine';
import { at, canMove, cast, deckWith, game, move, S } from './helpers';

const cursed = (g: GameState, sq: string) => g.effects.some((e) => e.kind === 'glassCursed' && e.pieceId === at(g, sq)?.id);

describe('Üvegátok', () => {
  it('costs 2, or 3 on a queen, and only a queen needs the third mana', () => {
    const fen = '4k3/8/8/q7/r3N3/8/8/4K3 w - - 0 1';
    let g = game(fen, { w: deckWith('glassCurse'), mana: 6 });
    expect(effectiveCost(g, 'w', SPELLS.glassCurse, [S('a4')])).toBe(2);
    expect(effectiveCost(g, 'w', SPELLS.glassCurse, [S('a5')])).toBe(3);
    const rook = cast(g, 'glassCurse', 'a4');
    expect(rook.players.w.mana).toBe(4);
    const queen = cast(g, 'glassCurse', 'a5');
    expect(queen.players.w.mana).toBe(3);
    // with 2 mana the queen cannot be picked
    g = game(fen, { w: deckWith('glassCurse'), mana: 2 });
    expect(validTargets(g, 'glassCurse', [])).toEqual([S('a4')]);
  });

  it('targets enemy pieces that can capture: no king, no slave, no clone, not twice', () => {
    const g = game('4k3/8/8/8/r7/8/8/4K3 w - - 0 1', { w: deckWith('glassCurse'), mana: 6 });
    g.board[S('c3')] = { id: 'slave', type: 'S', color: 'b', hasMoved: false, prevSquare: null };
    g.board[S('d5')] = { id: 'copy', type: 'N', color: 'b', hasMoved: true, prevSquare: null, clone: true };
    expect(validTargets(g, 'glassCurse', [])).toEqual([S('a4')]);
    const g2 = cast(g, 'glassCurse', 'a4');
    expect(cursed(g2, 'a4')).toBe(true);
    expect(validTargets(g2, 'glassCurse', [])).toEqual([]);
  });

  it('the cursed piece breaks right after its capture, the capture still counts', () => {
    let g = game('4k3/8/8/8/r3N3/8/8/4K3 w - - 0 1', { w: deckWith('glassCurse'), mana: { w: 6, b: 2 } });
    g = cast(g, 'glassCurse', 'a4');
    g = move(g, 'e1', 'd1');
    const manaB = g.players.b.mana;
    g = move(g, 'a4', 'e4');
    expect(at(g, 'e4')).toBeNull(); // the knight was taken, the rook broke
    expect(at(g, 'a4')).toBeNull();
    expect(g.captured.w.map((p) => p.type)).toEqual(['N']);
    expect(g.captured.b.map((p) => p.type)).toEqual(['R']);
    expect(g.players.b.mana).toBe(manaB + 1); // the capture still pays
    expect(g.events.some((e) => e.type === 'shatter' && e.square === S('e4'))).toBe(true);
    expect(g.log.some((l) => l.text.startsWith('Üvegátok'))).toBe(true);
    expect(g.moveList.at(-1)?.san).toContain('(összetört)');
    expect(g.effects.some((e) => e.kind === 'glassCursed')).toBe(false);
  });

  it('lasts until the end of the opponent’s next turn', () => {
    let g = game('4k3/8/8/8/r3N3/8/8/4K3 w - - 0 1', { w: deckWith('glassCurse'), mana: 6 });
    g = cast(g, 'glassCurse', 'a4');
    g = move(g, 'e1', 'd1');
    g = move(g, 'e8', 'd8'); // Black does not capture
    expect(g.effects.some((e) => e.kind === 'glassCursed')).toBe(false);
    g = move(g, 'd1', 'e1');
    g = move(g, 'a4', 'e4');
    expect(at(g, 'e4')?.type).toBe('R'); // the curse is over: a normal capture
  });

  it('a shield or a fortification does not save it (it is not a capture)', () => {
    let g = game('4k3/8/8/8/r3N3/8/8/4K3 w - - 0 1', { w: deckWith('glassCurse'), b: deckWith('fortify'), mana: 6 });
    g = cast(g, 'glassCurse', 'a4');
    g = move(g, 'e1', 'd1');
    g = cast(g, 'fortify', 'a4');
    g = move(g, 'a4', 'e4');
    expect(at(g, 'e4')).toBeNull();
    expect(g.effects.some((e) => e.kind === 'fortified')).toBe(false);
  });

  it('a bounced attack is not a capture: the piece stays whole', () => {
    let g = game('4k3/8/8/8/r3N3/8/8/4K3 w - - 0 1', { w: deckWith('glassCurse', 'fortify'), mana: 6 });
    g = cast(g, 'glassCurse', 'a4');
    g = cast(g, 'fortify', 'e4');
    g = move(g, 'e1', 'd1');
    g = move(g, 'a4', 'e4');
    expect(at(g, 'a4')?.type).toBe('R');
    expect(at(g, 'e4')?.type).toBe('N');
  });

  it('a cursed pawn that captures onto the last rank breaks instead of promoting', () => {
    let g = game('4k3/8/8/8/8/8/1p6/R3K3 w - - 0 1', { w: deckWith('glassCurse'), mana: 6 });
    g = cast(g, 'glassCurse', 'b2');
    g = move(g, 'e1', 'e2');
    g = move(g, 'b2', 'a1');
    expect(g.pendingPromotion).toBeNull();
    expect(at(g, 'a1')).toBeNull();
    expect(g.turn).toBe('w');
  });

  it('a capture that would open a line to the own king becomes illegal', () => {
    // the bishop may take e4 normally (it keeps blocking the e-file), but a cursed one would break there
    const fen = '4k3/1b6/8/8/4N3/8/8/4R2K w - - 0 1';
    let g = game(fen, { w: deckWith('glassCurse'), mana: 6 });
    let free = move(g, 'h1', 'g1');
    expect(canMove(free, 'b7', 'e4')).toBe(true);
    g = cast(g, 'glassCurse', 'b7');
    free = move(g, 'h1', 'g1');
    expect(canMove(free, 'b7', 'e4')).toBe(false);
    expect(canMove(free, 'b7', 'c6')).toBe(true);
  });

  it('also when a spell makes the piece capture: a shot from range, a spell move', () => {
    // Futólövész: the cursed bishop shoots from c5 and breaks where it stands
    let g = game('4k3/8/8/2b5/8/8/5N2/4K3 w - - 0 1', { w: deckWith('glassCurse'), b: deckWith('bishopSniper'), mana: 6 });
    g = cast(g, 'glassCurse', 'c5');
    g = move(g, 'e1', 'd1');
    g = cast(g, 'bishopSniper', 'c5');
    g = move(g, 'c5', 'f2');
    expect(at(g, 'f2')).toBeNull();
    expect(at(g, 'c5')).toBeNull();
    expect(g.events.some((e) => e.type === 'shatter' && e.square === S('c5'))).toBe(true);
    // Huszárugrás: a spell move that captures
    let k = game('4k3/8/8/8/8/5n2/8/4K1R1 w - - 0 1', { w: deckWith('glassCurse'), b: deckWith('knightLeap'), mana: 6 });
    k = cast(k, 'glassCurse', 'f3');
    k = move(k, 'e1', 'd1');
    k = cast(k, 'knightLeap', 'f3', 'g1');
    expect(at(k, 'g1')).toBeNull();
    expect(at(k, 'f3')).toBeNull();
    expect(k.turn).toBe('b'); // the spell move is not the normal move
  });

  it('a cursed „Mana mágus” killed this way costs the curse’s owner 1 mana', () => {
    let g = game('4k3/8/8/8/n7/8/1P6/4K3 b - - 0 1', { w: deckWith('glassCurse'), b: deckWith('manaMage'), mana: 5 });
    g = cast(g, 'manaMage', 'a4');
    g = move(g, 'e8', 'd8');
    g = cast(g, 'glassCurse', 'a4');
    g = move(g, 'e1', 'd1');
    g = move(g, 'a4', 'b2');
    expect(at(g, 'b2')).toBeNull();
    expect(g.events.some((e) => e.type === 'mana' && e.color === 'w' && e.delta === -1 && e.reason === 'Mana mágus megölése')).toBe(true);
  });

  it('a cursed mage breaking in its owner’s own spell move costs only the curse’s owner', () => {
    let g = game('4k3/8/8/8/8/5n2/8/4K1R1 b - - 0 1', { w: deckWith('glassCurse'), b: deckWith('manaMage', 'knightLeap'), mana: 6 });
    g = cast(g, 'manaMage', 'f3');
    g = move(g, 'e8', 'd8');
    g = cast(g, 'glassCurse', 'f3');
    g = move(g, 'e1', 'd1');
    const bMana = g.players.b.mana;
    const cost = 2; // Huszárugrás
    g = cast(g, 'knightLeap', 'f3', 'g1');
    expect(at(g, 'g1')).toBeNull();
    const fines = g.events.filter((e) => e.type === 'mana' && e.reason === 'Mana mágus megölése');
    expect(fines.map((e) => e.type === 'mana' && e.color)).toEqual(['w']);
    // Black: paid the spell, got +1 for the capture and +1 from the mage's capture bonus – no fine
    expect(g.players.b.mana).toBe(Math.min(6, bMana - cost + 2));
    expect(g.log.some((l) => /üvegátok ölte meg a mana mágust/i.test(l.text))).toBe(true);
  });
});
