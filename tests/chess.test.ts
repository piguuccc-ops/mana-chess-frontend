import { describe, expect, it } from 'vitest';
import { applyAction, inCheck, legalMoves } from '../src/engine';
import { at, canMove, endTurn, game, move, perft, S, tryMove } from './helpers';

describe('move generation (perft – verifies castling, en passant, promotion, pins)', () => {
  it('start position', () => {
    const g = game();
    expect(perft(g, 1)).toBe(20);
    expect(perft(g, 2)).toBe(400);
    expect(perft(g, 3)).toBe(8902);
  });
  it('Kiwipete', () => {
    const g = game('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    expect(perft(g, 1)).toBe(48);
    expect(perft(g, 2)).toBe(2039);
  });
  it('position 3 (en passant pins)', () => {
    const g = game('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
    expect(perft(g, 1)).toBe(14);
    expect(perft(g, 2)).toBe(191);
    expect(perft(g, 3)).toBe(2812);
  });
  it('position 4 (promotions, castling)', () => {
    const g = game('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1');
    expect(perft(g, 1)).toBe(6);
    expect(perft(g, 2)).toBe(264);
    expect(perft(g, 3)).toBe(9467);
  });
  it('position 5', () => {
    const g = game('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8');
    expect(perft(g, 1)).toBe(44);
    expect(perft(g, 2)).toBe(1486);
  });
});

describe('game end', () => {
  it("fool's mate is checkmate", () => {
    let g = game();
    g = move(g, 'f2', 'f3');
    g = move(g, 'e7', 'e5');
    g = move(g, 'g2', 'g4');
    g = move(g, 'd8', 'h4');
    expect(g.status).toEqual({ kind: 'checkmate', winner: 'b' });
    expect(g.moveList[g.moveList.length - 1].san).toBe('Vh4#');
    expect(g.events.some((e) => e.type === 'gameOver')).toBe(true);
  });

  it('stalemate is a draw', () => {
    const g = game('7k/8/6Q1/6K1/8/8/8/8 w - - 0 1');
    const s = move(g, 'g6', 'f7');
    expect(s.status.kind).toBe('stalemate');
  });

  it('further actions are rejected after the game ends', () => {
    let g = game();
    g = move(g, 'f2', 'f3');
    g = move(g, 'e7', 'e5');
    g = move(g, 'g2', 'g4');
    g = move(g, 'd8', 'h4');
    expect(tryMove(g, 'e2', 'e4').ok).toBe(false);
  });

  it('bare kings are a draw', () => {
    const g = game('7k/8/8/8/8/8/8/K5q1 w - - 0 1');
    // White king captures nothing here – set up a capture of the last piece instead
    const g2 = game('7k/8/8/8/8/8/1q6/K7 w - - 0 1');
    const s = move(g2, 'a1', 'b2');
    expect(s.status).toEqual({ kind: 'draw', reason: 'Elégtelen anyag' });
    expect(g.status.kind).toBe('playing');
  });

  it('a check forces a response', () => {
    let g = game();
    g = move(g, 'e2', 'e4');
    g = move(g, 'f7', 'f6');
    g = move(g, 'd1', 'h5');
    expect(g.inCheck).toBe(true);
    expect(inCheck(g, 'b')).toBe(true);
    // Every legal black move must resolve the check
    expect(legalMoves(g).map((m) => m.to).sort()).toEqual([S('g6')]);
  });
});

describe('special moves', () => {
  it('castling both sides and losing the right', () => {
    const g = game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(canMove(g, 'e1', 'g1')).toBe(true);
    expect(canMove(g, 'e1', 'c1')).toBe(true);
    const s = move(g, 'e1', 'g1');
    expect(at(s, 'g1')?.type).toBe('K');
    expect(at(s, 'f1')?.type).toBe('R');
    expect(s.moveList[0].san).toBe('O-O');
    const q = move(s, 'e8', 'c8');
    expect(at(q, 'd8')?.type).toBe('R');
    // after moving the king castling is gone
    let k = move(g, 'e1', 'e2');
    k = move(k, 'e8', 'e7');
    k = move(k, 'e2', 'e1');
    k = move(k, 'e7', 'e8');
    expect(canMove(k, 'e1', 'g1')).toBe(false);
  });

  it('cannot castle out of, through or into check', () => {
    const through = game('4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1'); // f1 attacked
    expect(canMove(through, 'e1', 'g1')).toBe(false);
    expect(canMove(through, 'e1', 'c1')).toBe(true);
    const inCheckPos = game('4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1');
    expect(canMove(inCheckPos, 'e1', 'g1')).toBe(false);
    expect(canMove(inCheckPos, 'e1', 'c1')).toBe(false);
  });

  it('en passant only immediately', () => {
    let g = game('4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1');
    g = move(g, 'd7', 'd5');
    expect(canMove(g, 'e5', 'd6')).toBe(true);
    const ep = move(g, 'e5', 'd6');
    expect(at(ep, 'd5')).toBeNull();
    expect(at(ep, 'd6')?.type).toBe('P');
    // if white waits, the right is gone
    let w = move(g, 'e1', 'e2');
    w = move(w, 'e8', 'e7');
    expect(canMove(w, 'e5', 'd6')).toBe(false);
  });

  it('promotion: pending choice or direct, including under-promotion', () => {
    const g = game('8/P6k/8/8/8/8/8/K7 w - - 0 1');
    const r = applyAction(g, { type: 'MOVE', from: S('a7'), to: S('a8') });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.pendingPromotion?.square).toBe(S('a8'));
    expect(r.state.turn).toBe('w'); // turn waits for the choice
    expect(tryMove(r.state, 'a1', 'a2').ok).toBe(false);
    const p = applyAction(r.state, { type: 'PROMOTE', piece: 'N' });
    expect(p.ok && p.state.board[S('a8')]?.type).toBe('N');
    expect(p.ok && p.state.turn).toBe('b');
    const direct = move(g, 'a7', 'a8', 'Q');
    expect(at(direct, 'a8')?.type).toBe('Q');
    expect(direct.moveList[0].san).toBe('a8=V');
  });

  it('pinned pieces cannot move', () => {
    const g = game('4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1');
    expect(legalMoves(g).some((m) => m.from === S('e2'))).toBe(false);
  });

  it('a turn cannot be ended without a move or a spell', () => {
    const g = game();
    const r = applyAction(g, { type: 'END_TURN' });
    expect(r.ok).toBe(false);
    expect(() => endTurn(g)).toThrow();
  });
});
