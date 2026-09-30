// Akna, El az útból!, Némaság 2 mana and the spells picked from the 50 proposals.
import { describe, expect, it } from 'vitest';
import { castBlockReason, legalMoves, SPELLS, validTargets } from '../src/engine';
import type { GameState, SpellId } from '../src/engine';
import { act, at, canMove, cast, deckWith, game, move, S, tryCast } from './helpers';

const targets = (g: GameState, id: SpellId, ...picked: string[]) => validTargets(g, id, picked.map(S));

describe('Akna', () => {
  const fen = '4k3/8/8/8/3n4/8/8/4K3 w - - 0 1';

  it('explodes at the end of the opponent\'s next turn and destroys the piece on it', () => {
    let g = game(fen, { w: deckWith('mine'), mana: 4 });
    g = cast(g, 'mine', 'd4');
    expect(g.players.w.mana).toBe(0);
    g = move(g, 'e1', 'f1');
    expect(at(g, 'd4')?.type).toBe('N'); // still there during Black's turn
    g = move(g, 'e8', 'f8');
    expect(at(g, 'd4')).toBeNull();
    expect(g.captured.b.some((p) => p.type === 'N')).toBe(true);
    expect(g.events.some((e) => e.type === 'explode' && e.square === S('d4'))).toBe(true);
    expect(g.effects.some((e) => e.kind === 'mine')).toBe(false);
  });

  it('a piece that walks away survives; the mine explodes on the empty square', () => {
    let g = game(fen, { w: deckWith('mine'), mana: 4 });
    g = cast(g, 'mine', 'd4');
    g = move(g, 'e1', 'f1');
    g = move(g, 'd4', 'f5');
    expect(at(g, 'f5')?.type).toBe('N');
    expect(g.events.some((e) => e.type === 'explode')).toBe(true);
  });

  it('a shield saves the piece but is destroyed by the blast', () => {
    let g = game(fen, { w: deckWith('mine'), b: deckWith('knightShield'), mana: 4 });
    g = cast(g, 'mine', 'd4');
    g = move(g, 'e1', 'f1');
    g = cast(g, 'knightShield', 'd4');
    g = move(g, 'e8', 'f8');
    expect(at(g, 'd4')?.type).toBe('N');
    expect(g.effects.some((e) => e.kind === 'immune')).toBe(false);
  });

  it('a king next to the mine may defuse it as its move (staying put)', () => {
    let g = game('8/8/8/3k4/3n4/8/8/4K3 w - - 0 1', { w: deckWith('mine'), mana: 4 });
    g = cast(g, 'mine', 'd4');
    g = move(g, 'e1', 'f1');
    expect(legalMoves(g).some((m) => m.defuse && m.from === S('d5') && m.to === S('d4'))).toBe(true);
    g = move(g, 'd5', 'd4');
    expect(at(g, 'd5')?.type).toBe('K');
    expect(at(g, 'd4')?.type).toBe('N');
    expect(g.effects.some((e) => e.kind === 'mine')).toBe(false);
    expect(g.turn).toBe('w');
    expect(g.moveList.at(-1)?.san).toContain('💣');
  });

  it('a king stepping onto the mine defuses it', () => {
    let g = game('4k3/8/8/8/8/8/P7/4K3 w - - 0 1', { w: deckWith('mine'), mana: 4 });
    g = cast(g, 'mine', 'd7');
    g = move(g, 'e1', 'f1');
    g = move(g, 'e8', 'd7');
    expect(at(g, 'd7')?.type).toBe('K');
    expect(g.effects.some((e) => e.kind === 'mine')).toBe(false);
  });

  it('never on a king; an exploding mine may not expose the owner\'s king (pinned piece on a mine)', () => {
    let g = game('4k3/4n3/8/8/8/8/8/K3R3 w - - 0 1', { w: deckWith('mine'), mana: 4 });
    expect(targets(g, 'mine')).not.toContain(S('e8'));
    g = cast(g, 'mine', 'e7');
    g = move(g, 'a1', 'a2');
    // Black: the knight is pinned now, and staying on the mine would expose the king at turn end.
    expect(g.inCheck).toBe(true);
    const moves = legalMoves(g);
    expect(moves.some((m) => m.from === S('e7'))).toBe(false);
    expect(moves.every((m) => m.from === S('e8'))).toBe(true);
    expect(moves.some((m) => m.defuse)).toBe(true);
  });
});

describe('El az útból!', () => {
  it('the piece steps aside, others pass its square, and it returns at the end of the turn', () => {
    let g = game('4k3/8/8/8/8/8/3N4/2B1K3 w - - 0 1', { w: deckWith('outOfWay'), mana: 3 });
    const knightBefore = { ...at(g, 'd2')! };
    g = cast(g, 'outOfWay', 'd2', 'd3');
    expect(g.players.w.mana).toBe(1);
    expect(g.turn).toBe('w'); // not the normal move
    expect(canMove(g, 'd3', 'd4')).toBe(false); // the stepped-aside piece may not move on
    expect(canMove(g, 'c1', 'd2')).toBe(false); // the home square is reserved
    expect(canMove(g, 'c1', 'f4')).toBe(true); // …but may be passed through
    g = move(g, 'c1', 'f4');
    expect(g.turn).toBe('b');
    expect(at(g, 'd2')?.id).toBe(knightBefore.id);
    expect(at(g, 'd3')).toBeNull();
    expect(at(g, 'd2')?.hasMoved).toBe(knightBefore.hasMoved);
  });

  it('a pinned piece may only step aside along the pin line; the king cannot be moved', () => {
    const g = game('4r1k1/8/8/8/8/8/4N3/4K3 w - - 0 1', { w: deckWith('outOfWay'), mana: 3 });
    expect(targets(g, 'outOfWay', 'e2')).toEqual([S('e3')]);
    expect(targets(g, 'outOfWay')).not.toContain(S('e1'));
  });

  it('dodges a mine: the blast hits the empty square, then the piece returns', () => {
    let g = game('4k3/8/8/8/3n4/8/8/4K3 w - - 0 1', { w: deckWith('mine'), b: deckWith('outOfWay'), mana: 4 });
    g = cast(g, 'mine', 'd4');
    g = move(g, 'e1', 'f1');
    g = cast(g, 'outOfWay', 'd4', 'd5');
    g = move(g, 'e8', 'f8');
    expect(at(g, 'd4')?.type).toBe('N');
  });
});

describe('Némaság', () => {
  it('now costs 2 mana', () => {
    expect(SPELLS.silence.manaCost).toBe(2);
    const g = cast(game(undefined, { w: deckWith('silence'), mana: 3 }), 'silence');
    expect(g.players.w.mana).toBe(1);
  });
});

describe('movement picks', () => {
  it('Gyorssánc: castling as a spell, the normal move is still available', () => {
    let g = game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', { w: deckWith('quickCastle'), mana: 3 });
    expect(targets(g, 'quickCastle').sort()).toEqual([S('a1'), S('h1')].sort());
    g = cast(g, 'quickCastle', 'h1');
    expect(at(g, 'g1')?.type).toBe('K');
    expect(at(g, 'f1')?.type).toBe('R');
    expect(g.turn).toBe('w');
    expect(g.players.w.mana).toBe(1);
    g = move(g, 'a1', 'a2');
    expect(g.turn).toBe('b');
    const checked = game('4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1', { w: deckWith('quickCastle'), mana: 3 });
    expect(castBlockReason(checked, 'quickCastle')).not.toBeNull();
  });

  it('Gyalogugrás: a blocked pawn jumps over the piece in front (no en passant, promotion works)', () => {
    let g = game('4k3/8/8/8/8/4n3/4P3/4K3 w - - 0 1', { w: deckWith('pawnVault'), mana: 3 });
    expect(canMove(g, 'e2', 'e4')).toBe(false);
    g = cast(g, 'pawnVault', 'e2');
    g = move(g, 'e2', 'e4');
    expect(at(g, 'e4')?.type).toBe('P');
    expect(at(g, 'e3')?.type).toBe('N');
    expect(g.ep).toBeNull();
    let p = game('3k4/4r3/4P3/8/8/8/8/K7 w - - 0 1', { w: deckWith('pawnVault'), mana: 3 });
    p = cast(p, 'pawnVault', 'e6');
    p = move(p, 'e6', 'e8', 'Q');
    expect(at(p, 'e8')?.type).toBe('Q');
  });

  it('Cserkész: a pawn steps sideways', () => {
    let g = game('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', { w: deckWith('scout'), mana: 3 });
    g = cast(g, 'scout', 'e2');
    expect(g.players.w.mana).toBe(2);
    g = move(g, 'e2', 'd2');
    expect(at(g, 'd2')?.type).toBe('P');
    expect(g.moveList.at(-1)?.san).toBe('e2-d2');
  });
});

describe('control picks', () => {
  it('Provokáció: the provoked pawn must make the normal move if it can', () => {
    let g = game(undefined, { w: deckWith('provoke'), mana: 3 });
    g = cast(g, 'provoke', 'a7');
    g = move(g, 'e2', 'e4');
    const moves = legalMoves(g);
    expect(moves.length).toBe(2);
    expect(moves.every((m) => m.from === S('a7'))).toBe(true);
    // A blocked provoked pawn does not restrict anything.
    let b = game('4k3/p7/P7/8/8/8/8/4K3 w - - 0 1', { w: deckWith('provoke'), mana: 3 });
    b = cast(b, 'provoke', 'a7');
    b = move(b, 'e1', 'f1');
    expect(legalMoves(b).length).toBeGreaterThan(0);
  });

  it('Láthatatlanság: enemy spells cannot target the piece; Pajzsromboló removes it', () => {
    let g = game('4k3/8/8/8/8/4N3/8/4K3 w - - 0 1', { w: deckWith('invisibility'), b: deckWith('execution', 'shieldBreaker'), mana: 6 });
    g = cast(g, 'invisibility', 'e3');
    g = move(g, 'e1', 'f1');
    expect(castBlockReason(g, 'execution')).toBe('Nincs érvényes célpont.');
    expect(tryCast(g, 'execution', 'e3').ok).toBe(false);
    g = cast(g, 'shieldBreaker', 'e3');
    expect(g.effects.some((e) => e.kind === 'spellWard')).toBe(false);
    expect(at(g, 'e2')?.type).toBe('N'); // pushed one square back towards White's side
  });

  it('Vihar: enemy pawns step back, the rear one first', () => {
    let g = game('4k3/1p6/4p3/4p3/8/8/8/4K3 w - - 0 1', { w: deckWith('storm'), mana: 4 });
    g = cast(g, 'storm');
    expect(at(g, 'e7')?.type).toBe('P');
    expect(at(g, 'e6')?.type).toBe('P');
    expect(at(g, 'e5')).toBeNull();
    expect(at(g, 'b7')?.type).toBe('P'); // cannot go onto the back rank
    expect(g.turn).toBe('w');
  });
});

describe('tactic picks', () => {
  it('Mágnes pulls an enemy piece one square towards an own piece in line', () => {
    let g = game('4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1', { w: deckWith('magnet'), mana: 3 });
    expect(targets(g, 'magnet')).not.toContain(S('e8'));
    g = cast(g, 'magnet', 'd5', 'd2');
    expect(at(g, 'd4')?.type).toBe('Q');
    expect(at(g, 'd5')).toBeNull();
    expect(g.players.w.mana).toBe(0);
  });

  it('Taszítás pushes an enemy piece one square away from an own piece in line', () => {
    let g = game('4k3/8/8/8/3n4/3R4/8/4K3 w - - 0 1', { w: deckWith('repulse'), mana: 3 });
    g = cast(g, 'repulse', 'd4', 'd3');
    expect(at(g, 'd5')?.type).toBe('N');
    const blocked = game('4k3/8/8/3p4/3n4/3R4/8/4K3 w - - 0 1', { w: deckWith('repulse'), mana: 3 });
    expect(targets(blocked, 'repulse')).not.toContain(S('d4'));
  });

  it('Átképzés turns a knight into a bishop and back', () => {
    let g = game('4k3/8/8/8/8/8/8/1N2K3 w - - 0 1', { w: deckWith('retrain'), mana: 3 });
    g = cast(g, 'retrain', 'b1');
    expect(at(g, 'b1')?.type).toBe('B');
  });

  it('Gravitációs kút pulls every piece exactly two squares away one square closer', () => {
    let g = game('4k3/8/8/4n3/8/8/8/R3K3 w - - 0 1', { w: deckWith('gravityWell'), mana: 4 });
    g = cast(g, 'gravityWell', 'c3');
    expect(at(g, 'b2')?.type).toBe('R');
    expect(at(g, 'd4')?.type).toBe('N');
    expect(at(g, 'e1')?.type).toBe('K'); // kings never move
  });
});

describe('mana picks', () => {
  it('Mana-letét: pay 2 now, +3 at the start of the next own turn', () => {
    let g = game(undefined, { w: deckWith('manaDeposit'), mana: 3 });
    g = cast(g, 'manaDeposit');
    expect(g.players.w.mana).toBe(1);
    g = move(g, 'e2', 'e4');
    g = move(g, 'e7', 'e5');
    expect(g.players.w.mana).toBe(1 + 1 + 3);
    expect(g.effects.some((e) => e.kind === 'manaDeposit')).toBe(false);
  });

  it('Mana-szomj: the first capture this turn pays the victim\'s value', () => {
    let g = game('4k3/8/8/3r4/8/8/8/3QK3 w - - 0 1', { w: deckWith('manaThirst'), mana: 3 });
    g = cast(g, 'manaThirst');
    expect(g.players.w.mana).toBe(0);
    g = move(g, 'd1', 'd5');
    expect(g.players.w.mana).toBe(6); // 0 + 1 (capture) + 5 (rook)
  });

  it('Mana-armageddon: both players drop to 0 and skip the next base income', () => {
    let g = game(undefined, { w: deckWith('manaArmageddon'), mana: 6 });
    g = move(g, 'e2', 'e4');
    g = move(g, 'e7', 'e5');
    g = cast(g, 'manaArmageddon');
    expect(g.players.w.mana).toBe(0);
    expect(g.players.b.mana).toBe(0);
    g = move(g, 'g1', 'f3');
    expect(g.players.b.mana).toBe(0);
    g = move(g, 'b8', 'c6');
    expect(g.players.w.mana).toBe(0);
    g = move(g, 'f1', 'c4');
    expect(g.players.b.mana).toBe(1);
  });
});

describe('destruction picks', () => {
  it('Sárkánytűz burns along a diagonal up to 4 points of material, skipping what no longer fits', () => {
    let g = game('k7/8/5q2/4n3/3b4/2p5/8/7K w - - 0 1', { w: deckWith('dragonFire'), mana: 6 });
    g = act(g, { type: 'CAST', spellId: 'dragonFire', targets: [S('c3'), S('d4')] });
    expect(at(g, 'c3')).toBeNull();
    expect(at(g, 'd4')).toBeNull();
    expect(at(g, 'e5')?.type).toBe('N'); // 1 + 3 = 4: the budget is spent
    expect(at(g, 'f6')?.type).toBe('Q'); // the queen (9) never fits
    expect(g.players.w.mana).toBe(0);
    // a cheaper piece further along still burns
    let h = game('k7/8/8/4p3/3n4/2b5/8/7K w - - 0 1', { w: deckWith('dragonFire'), mana: 6 });
    h = act(h, { type: 'CAST', spellId: 'dragonFire', targets: [S('c3'), S('d4')] });
    expect(at(h, 'c3')).toBeNull();
    expect(at(h, 'd4')?.type).toBe('N'); // 3 + 3 would be 6
    expect(at(h, 'e5')).toBeNull(); // 3 + 1 = 4
  });

  it('Végítélet: the Reaper takes the enemy pawns on your half, nearest first', () => {
    const fen = 'r3k2r/p4ppp/8/8/2p1p3/1p4p1/P1PP1P1P/RNBQKBNR w KQkq - 0 1';
    let g = game(fen, { w: deckWith('doomsday'), mana: 4 });
    g = cast(g, 'doomsday');
    for (const sq of ['c4', 'e4', 'b3', 'g3']) expect(at(g, sq)).toBeNull();
    for (const sq of ['a7', 'f7', 'g7', 'h7']) expect(at(g, sq)?.type).toBe('P'); // still at home: out of reach
    for (const sq of ['a2', 'c2', 'd2', 'f2', 'h2']) expect(at(g, sq)?.color).toBe('w'); // own pawns are spared
    const ev = g.events.find((x) => x.type === 'spell' && x.spellId === 'doomsday');
    expect(ev && 'squares' in ev ? ev.squares : []).toEqual(['g3', 'e4', 'c4', 'b3'].map(S));
    expect(g.players.w.mana).toBe(0);
  });

  it('Végítélet works for Black too, and shields still protect', () => {
    let g = game('4k3/8/3P4/4P3/4P3/8/8/4K3 w - - 0 1', { w: deckWith('pawnShield'), b: deckWith('doomsday'), mana: 6 });
    g = cast(g, 'pawnShield', 'd6');
    g = move(g, 'e1', 'd1');
    g = cast(g, 'doomsday');
    expect(at(g, 'd6')?.type).toBe('P'); // shielded
    expect(at(g, 'e5')).toBeNull(); // Black's 4th rank
    expect(at(g, 'e4')?.type).toBe('P'); // White's own half: out of reach
  });

  it('Végítélet needs an enemy pawn on your half', () => {
    const g = game(undefined, { w: deckWith('doomsday'), mana: 6 });
    expect(tryCast(g, 'doomsday').ok).toBe(false);
  });
});
