import { describe, expect, it } from 'vitest';
import {
  applyAction, canEndTurn, castBlockReason, createGame, findKing, inCheck, legalMoves, REMOVED_SPELLS, SPELL_LIST, SPELLS, validTargets,
} from '../src/engine';
import type { GameState, SpellId } from '../src/engine';
import { act, at, canMove, cast, deckWith, endTurn, game, move, S, tryCast, tryMove } from './helpers';

const targets = (g: GameState, id: Parameters<typeof validTargets>[1], ...picked: string[]) =>
  validTargets(g, id, picked.map(S));

describe('registry', () => {
  it('contains exactly the 50 designed spells with required metadata', () => {
    // 50 designed − Tűzés − Manalopás − Dupla vagy semmi − Ködfátyol + Brigád + Klón + Francia sajt + Futólövész
    // + Mana mágus + Akna + El az útból! + 16 picks from the 50 proposals + Üvegátok + Végzet
    expect(SPELL_LIST).toHaveLength(71);
    expect(new Set(SPELL_LIST.map((s) => s.id)).size).toBe(71);
    expect(new Set(SPELL_LIST.map((s) => s.number)).size).toBe(71);
    for (const removed of ['pin', 'manaSteal', 'doubleOrNothing', 'fog']) {
      expect(SPELL_LIST.some((s) => (s.id as string) === removed)).toBe(false);
      const r = REMOVED_SPELLS.find((x) => x.id === removed);
      expect(r, removed).toBeDefined();
      expect(SPELL_LIST.some((s) => s.id === r!.replacement)).toBe(true);
    }
    expect(SPELL_LIST.some((s) => s.random && s.id !== 'chaos')).toBe(false); // no luck-based mana spells left
    SPELL_LIST.forEach((s) => {
      expect(s.manaCost).toBeGreaterThanOrEqual(1);
      expect(s.manaCost).toBeLessThanOrEqual(6);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(10);
      expect(typeof s.execute).toBe('function');
    });
  });
});

describe('king safety with spells', () => {
  const pinned = '4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1';

  it('a spell may not expose the own king (pinned piece cannot be sacrificed / teleported / mirrored)', () => {
    const g = game(pinned, { w: deckWith('bloodPrice', 'teleport', 'mirror'), mana: 6 });
    expect(targets(g, 'bloodPrice')).not.toContain(S('e2'));
    expect(targets(g, 'teleport')).not.toContain(S('e2'));
    expect(targets(g, 'mirror')).not.toContain(S('e2'));
    expect(tryCast(g, 'bloodPrice', 'e2').ok).toBe(false);
  });

  it('while in check spells are allowed, but the check must still be resolved', () => {
    let g = game('4k3/8/8/8/8/8/P7/R3K2r w - - 0 1', { w: deckWith('pawnShield', 'checkBreaker'), mana: 3 });
    expect(g.inCheck).toBe(true);
    g = cast(g, 'pawnShield', 'a2');
    expect(g.inCheck).toBe(true);
    expect(applyAction(g, { type: 'END_TURN' }).ok).toBe(false);
    expect(targets(g, 'checkBreaker').sort()).toEqual([S('d2'), S('e2'), S('f2')].sort());
    g = cast(g, 'checkBreaker', 'd2');
    expect(at(g, 'd2')?.type).toBe('K');
    expect(g.inCheck).toBe(false);
    expect(g.turn).toBe('w'); // the normal move is still available
    g = move(g, 'a1', 'b1');
    expect(g.turn).toBe('b');
  });

  it('Sakkmegszakító is only castable in check', () => {
    const g = game(undefined, { w: deckWith('checkBreaker'), mana: 3 });
    expect(castBlockReason(g, 'checkBreaker')).not.toBeNull();
  });

  it('Vészcsere never swaps the king into check', () => {
    const g = game('r3k3/8/8/8/8/8/8/R3K2R w - - 0 1', { w: deckWith('emergencySwap'), mana: 4 });
    expect(targets(g, 'emergencySwap')).toEqual([S('h1')]);
  });

  it('spells can never destroy or target a king', () => {
    const g = game(undefined, { w: deckWith('meteor', 'execution'), mana: 6 });
    const kings = [findKing(g.board, 'w'), findKing(g.board, 'b')];
    for (const id of ['meteor', 'execution'] as const) for (const k of kings) expect(targets(g, id)).not.toContain(k);
  });

  it('a spell escape prevents checkmate (Vészcsere out of a back-rank mate)', () => {
    const fen = '4r1k1/5ppp/8/8/8/R7/5PPP/6K1 b - - 0 1';
    const noSpells = move(game(fen), 'e8', 'e1');
    expect(noSpells.status).toEqual({ kind: 'checkmate', winner: 'b' });

    let g = move(game(fen, { w: deckWith('emergencySwap'), mana: 4 }), 'e8', 'e1');
    expect(g.status.kind).toBe('playing');
    expect(g.mustCastSpell).toBe(true);
    expect(legalMoves(g)).toHaveLength(0);
    g = cast(g, 'emergencySwap', 'a3');
    expect(at(g, 'a3')?.type).toBe('K');
    expect(g.inCheck).toBe(false);
    expect(canEndTurn(g)).toBe(true);
  });

  it('a useless spell does not save a mated king', () => {
    const fen = '4r1k1/5ppp/8/8/8/R7/5PPP/6K1 b - - 0 1';
    const g = move(game(fen, { w: deckWith('pawnShield', 'silence', 'wall'), mana: 3 }), 'e8', 'e1');
    // Wall on f1 blocks the check → escape exists! (Fal can interpose)
    expect(g.status.kind).toBe('playing');
    const g2 = move(game(fen, { w: deckWith('pawnShield', 'silence', 'gravity'), mana: 3 }), 'e8', 'e1');
    expect(g2.status).toEqual({ kind: 'checkmate', winner: 'b' });
  });

  it('spell + normal move can deliver mate (Gyengítés on the defender, then Be8#)', () => {
    let g = game('3r2k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', { w: deckWith('weaken'), mana: 3 });
    g = cast(g, 'weaken', 'd8');
    g = move(g, 'e1', 'e8');
    expect(g.status).toEqual({ kind: 'checkmate', winner: 'w' });
  });
});

describe('spell + normal move interaction', () => {
  it('spells do not end the turn, the normal move does', () => {
    let g = game(undefined, { w: deckWith('knightLeap', 'forcedMarch'), mana: 6 });
    g = cast(g, 'knightLeap', 'g1', 'f3');
    g = cast(g, 'forcedMarch', 'e2');
    expect(g.turn).toBe('w');
    expect(at(g, 'f3')?.type).toBe('N');
    expect(at(g, 'e3')?.type).toBe('P');
    g = move(g, 'd2', 'd4');
    expect(g.turn).toBe('b');
    // white cannot act during black's turn
    expect(tryCast(g, 'knightLeap', 'f3', 'g5').ok).toBe(false);
  });

  it('Dupla lépés gives a bonus move with a different piece', () => {
    let g = game(undefined, { w: deckWith('doubleMove'), mana: 4 });
    g = cast(g, 'doubleMove');
    g = move(g, 'e2', 'e4');
    expect(g.turn).toBe('w');
    expect(g.turnState.bonusMoveAvailable).toBe(true);
    expect(canMove(g, 'e4', 'e5')).toBe(false);
    g = move(g, 'd2', 'd4');
    expect(g.turn).toBe('b');
    expect(g.moveList.map((m) => m.kind)).toEqual(['move', 'bonus']);
  });

  it('Dupla lépés: giving check with the first move forfeits the bonus', () => {
    let g = game('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', { w: deckWith('doubleMove'), mana: 4 });
    g = cast(g, 'doubleMove');
    g = move(g, 'a1', 'a8');
    expect(g.turn).toBe('b');
    expect(g.inCheck).toBe(true);
  });

  it('Dupla lépés: the bonus move can be skipped', () => {
    let g = game(undefined, { w: deckWith('doubleMove'), mana: 4 });
    g = cast(g, 'doubleMove');
    g = move(g, 'e2', 'e4');
    g = endTurn(g);
    expect(g.turn).toBe('b');
  });

  it('Időmegállítás: no normal move (only one spell), except to escape check', () => {
    let g = game(undefined, { w: deckWith('timeStop'), b: deckWith('silence', 'pawnShield'), mana: 5 });
    g = cast(g, 'timeStop');
    g = move(g, 'e2', 'e4');
    expect(legalMoves(g)).toHaveLength(0);
    expect(canEndTurn(g)).toBe(true);
    g = cast(g, 'pawnShield', 'e7');
    expect(tryCast(g, 'silence').ok).toBe(false);
    g = endTurn(g);
    expect(g.turn).toBe('w');

    let c = game('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', { w: deckWith('timeStop'), mana: 5 });
    c = cast(c, 'timeStop');
    c = move(c, 'a1', 'a8');
    expect(c.inCheck).toBe(true);
    expect(legalMoves(c).length).toBeGreaterThan(0);
  });
});

describe('manual end-turn mode (spells after the normal move)', () => {
  it('after the normal move spells can still be cast; END_TURN finishes the turn', () => {
    let g = createGame({ decks: { w: deckWith('pawnShield', 'silence'), b: [] }, seed: 1, autoEndTurn: false });
    g = move(g, 'e2', 'e4');
    expect(g.turn).toBe('w');
    expect(legalMoves(g)).toHaveLength(0); // the normal move is used up
    expect(canEndTurn(g)).toBe(true);
    g = cast(g, 'pawnShield', 'e4');
    g = cast(g, 'silence');
    g = endTurn(g);
    expect(g.turn).toBe('b');
    expect(g.players.w.mana).toBe(0); // 3 − 1 (pajzs) − 2 (Némaság)
  });
});

describe('protections', () => {
  it('Gyalogpajzs: the pawn cannot be captured until the end of the opponent\'s turn', () => {
    let g = game('4k3/8/8/4p3/3P4/8/8/4K3 w - - 0 1', { w: deckWith('pawnShield'), b: deckWith('execution'), mana: 6 });
    g = cast(g, 'pawnShield', 'd4');
    g = move(g, 'e1', 'e2');
    expect(canMove(g, 'e5', 'd4')).toBe(false);
    expect(castBlockReason(g, 'execution')).toBe('Nincs érvényes célpont.');
    g = move(g, 'e8', 'e7');
    expect(g.effects.some((e) => e.kind === 'immune')).toBe(false);
  });

  it('Huszárpajzs: the knight cannot be captured', () => {
    let g = game('4k3/8/8/4p3/3N4/8/8/4K3 w - - 0 1', { w: deckWith('knightShield'), mana: 3 });
    g = cast(g, 'knightShield', 'd4');
    g = move(g, 'e1', 'e2');
    expect(canMove(g, 'e5', 'd4')).toBe(false);
  });

  it('Megerősítés: the attacker bounces back, the shield is used up', () => {
    let g = game('4k3/8/8/4p3/3N4/8/8/4K3 w - - 0 1', { w: deckWith('fortify'), mana: 4 });
    g = cast(g, 'fortify', 'd4');
    g = move(g, 'e1', 'e2');
    const bMana = g.players.b.mana;
    g = move(g, 'e5', 'd4');
    expect(at(g, 'd4')?.type).toBe('N');
    expect(at(g, 'e5')?.color).toBe('b');
    expect(g.turn).toBe('w');
    expect(g.players.b.mana).toBe(bMana);
    expect(g.effects.some((e) => e.kind === 'fortified')).toBe(false);
    expect(g.events.some((e) => e.type === 'bounce')).toBe(true);
    g = move(g, 'e2', 'e1');
    g = move(g, 'e5', 'd4');
    expect(at(g, 'd4')?.color).toBe('b');
  });

  it('Halálbélyeg ignores protections', () => {
    let g = game('4k3/8/8/4p3/3N4/8/8/4K3 w - - 0 1', { w: deckWith('fortify'), b: deckWith('deathMark'), mana: 4 });
    g = cast(g, 'fortify', 'd4');
    g = move(g, 'e1', 'e2');
    g = cast(g, 'deathMark', 'd4');
    g = move(g, 'e5', 'd4');
    expect(at(g, 'd4')?.color).toBe('b');
    expect(g.effects.some((e) => e.kind === 'deathMark')).toBe(false);
  });

  it('Utolsó esély only when behind in pieces; fortifies every piece', () => {
    const behind = game('4k3/pppp4/8/8/8/8/P7/4K3 w - - 0 1', { w: deckWith('lastChance'), mana: 5 });
    const g = cast(behind, 'lastChance');
    expect(g.effects.filter((e) => e.kind === 'fortified')).toHaveLength(1);
    const equal = game(undefined, { w: deckWith('lastChance'), mana: 5 });
    expect(castBlockReason(equal, 'lastChance')).not.toBeNull();
  });

  it('Megerősítés also absorbs a Kivégzés', () => {
    let g = game('4k3/8/8/8/3N4/8/8/4K3 w - - 0 1', { w: deckWith('fortify'), b: deckWith('execution'), mana: 6 });
    g = cast(g, 'fortify', 'd4');
    g = move(g, 'e1', 'e2');
    g = cast(g, 'execution', 'd4');
    expect(at(g, 'd4')?.type).toBe('N');
  });

  it('Királyvédelem: the opponent may not give check next turn', () => {
    let g = game('4k3/8/8/8/8/8/8/R3K3 b - - 0 1', { b: deckWith('royalGuard'), mana: 3 });
    g = cast(g, 'royalGuard');
    g = move(g, 'e8', 'f8');
    expect(canMove(g, 'a1', 'a8')).toBe(false);
    expect(canMove(g, 'a1', 'a7')).toBe(true);
  });
});

describe('Visszatekerés', () => {
  it('restores the board before the last normal move but keeps mana and the cycle', () => {
    let g = game(undefined, { b: deckWith('rewind'), mana: 6 });
    g = move(g, 'e2', 'e4');
    g = move(g, 'd7', 'd5');
    g = move(g, 'e4', 'd5');
    const wMana = g.players.w.mana;
    g = cast(g, 'rewind');
    expect(at(g, 'd5')?.color).toBe('b');
    expect(at(g, 'e4')?.color).toBe('w');
    expect(g.players.w.mana).toBe(wMana);
    expect(g.players.b.mana).toBe(1);
    expect(g.players.b.deck[5]).toBe('rewind');
    expect(g.moveList[2].rewound).toBe(true);
    expect(g.captured.b).toHaveLength(0);
    expect(g.turn).toBe('b');
    g = move(g, 'd5', 'e4');
    expect(at(g, 'e4')?.color).toBe('b');
  });

  it('is only available before the normal move and when there is history', () => {
    const g = game(undefined, { w: deckWith('rewind'), mana: 6 });
    expect(castBlockReason(g, 'rewind')).not.toBeNull();
  });
});

describe('promotion and castling with spells', () => {
  it('Erőltetett menet onto the last rank asks for a promotion; the turn continues', () => {
    let g = game('4k3/P7/8/8/8/8/8/4K3 w - - 0 1', { w: deckWith('forcedMarch'), mana: 3 });
    g = cast(g, 'forcedMarch', 'a7');
    expect(g.pendingPromotion?.context).toBe('spell');
    expect(tryMove(g, 'e1', 'd1').ok).toBe(false);
    g = act(g, { type: 'PROMOTE', piece: 'Q' });
    expect(at(g, 'a8')?.type).toBe('Q');
    expect(g.turn).toBe('w');
    g = move(g, 'e1', 'd1');
    expect(g.turn).toBe('b');
    expect(g.inCheck).toBe(true);
  });

  it('Azonnali átváltozás promotes a pawn on the 6th/7th rank in place', () => {
    let g = game('4k3/1P6/8/P7/8/8/8/4K3 w - - 0 1', { w: deckWith('instantPromotion'), mana: 5 });
    expect(targets(g, 'instantPromotion')).toEqual([S('b7')]);
    g = cast(g, 'instantPromotion', 'b7');
    g = act(g, { type: 'PROMOTE', piece: 'R' });
    expect(at(g, 'b7')?.type).toBe('R');
  });

  it('Újrasáncolás restores lost castling rights', () => {
    let g = game('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', { w: deckWith('recastle'), mana: 3 });
    g = move(g, 'e1', 'f1');
    g = move(g, 'e8', 'e7');
    g = move(g, 'f1', 'e1');
    g = move(g, 'e7', 'e8');
    expect(canMove(g, 'e1', 'g1')).toBe(false);
    g = cast(g, 'recastle');
    expect(canMove(g, 'e1', 'g1')).toBe(true);
    expect(canMove(g, 'e1', 'c1')).toBe(true);
    g = move(g, 'e1', 'c1');
    expect(at(g, 'd1')?.type).toBe('R');
  });

  it('a wall blocks castling', () => {
    let g = game('4k3/8/8/8/8/8/8/4K2R b K - 0 1', { b: deckWith('wall'), mana: 3 });
    g = cast(g, 'wall', 'f1');
    g = move(g, 'e8', 'd8');
    expect(canMove(g, 'e1', 'g1')).toBe(false);
  });
});

describe('movement spells', () => {
  it('Gyalogroham: a moved pawn may step two squares', () => {
    let g = game('4k3/8/8/8/8/4P3/8/4K3 w - - 0 1', { w: deckWith('pawnRush'), mana: 2 });
    expect(canMove(g, 'e3', 'e5')).toBe(false);
    g = cast(g, 'pawnRush', 'e3');
    g = move(g, 'e3', 'e5');
    expect(at(g, 'e5')?.type).toBe('P');
    expect(g.ep?.target).toBe(S('e4'));
  });

  it('Futóáldás: the bishop jumps over one own piece once', () => {
    let g = game(undefined, { w: deckWith('bishopBlessing'), mana: 2 });
    g = cast(g, 'bishopBlessing', 'c1');
    expect(canMove(g, 'c1', 'e3')).toBe(true);
    expect(canMove(g, 'c1', 'a3')).toBe(true);
    g = move(g, 'c1', 'f4');
    expect(g.effects.some((e) => e.kind === 'bishopBlessing')).toBe(false);
  });

  it('Bástyatöltés moves at most 3 squares', () => {
    const g = game('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', { w: deckWith('rookCharge'), mana: 2 });
    expect(targets(g, 'rookCharge', 'a1').sort((a, b) => a - b)).toEqual(['b1', 'c1', 'd1', 'a2', 'a3', 'a4'].map(S).sort((a, b) => a - b));
  });

  it('Vezér kegyelme: the queen can also jump like a knight', () => {
    let g = game(undefined, { w: deckWith('queenGrace'), mana: 3 });
    expect(canMove(g, 'd1', 'c3')).toBe(false);
    g = cast(g, 'queenGrace', 'd1');
    expect(canMove(g, 'd1', 'c3')).toBe(true);
    expect(canMove(g, 'd1', 'e3')).toBe(true);
  });

  it('Királylépés: the king may move two squares in a line', () => {
    let g = game('4k3/p7/8/8/8/8/8/4K3 w - - 0 1', { w: deckWith('kingStride'), mana: 2 });
    g = cast(g, 'kingStride');
    expect(canMove(g, 'e1', 'e3')).toBe(true);
    expect(canMove(g, 'e1', 'c3')).toBe(true);
    const blocked = cast(game('4kr2/8/8/8/8/8/8/4K3 w - - 0 1', { w: deckWith('kingStride'), mana: 2 }), 'kingStride');
    expect(canMove(blocked, 'e1', 'g1')).toBe(false); // passes the attacked f1
  });

  it('Teleport ignores blockers but never captures', () => {
    const g = game(undefined, { w: deckWith('teleport'), mana: 5 });
    expect(targets(g, 'teleport', 'a1').sort((a, b) => a - b)).toEqual(['a3', 'a4', 'a5', 'a6'].map(S));
  });

  it('Tükör moves the piece to its mirrored square', () => {
    const g = cast(game('4k3/8/8/8/8/2N5/8/4K3 w - - 0 1', { w: deckWith('mirror'), mana: 3 }), 'mirror', 'c3');
    expect(at(g, 'f3')?.type).toBe('N');
    expect(at(g, 'c3')).toBeNull();
  });

  it('Csere swaps two different own pieces; pawns never onto the back rank', () => {
    const g = game(undefined, { w: deckWith('swap'), mana: 3 });
    expect(targets(g, 'swap', 'b1')).toContain(S('c1'));
    expect(targets(g, 'swap', 'b1')).not.toContain(S('g1'));
    expect(targets(g, 'swap', 'a2')).not.toContain(S('a1'));
    const s = cast(g, 'swap', 'b1', 'c1');
    expect(at(s, 'b1')?.type).toBe('B');
    expect(at(s, 'c1')?.type).toBe('N');
  });

  it('Visszalépés returns a piece to where it came from', () => {
    let g = game(undefined, { w: deckWith('stepBack'), mana: 3 });
    expect(castBlockReason(g, 'stepBack')).not.toBeNull();
    g = move(g, 'g1', 'f3');
    g = move(g, 'e7', 'e5');
    g = cast(g, 'stepBack', 'f3');
    expect(at(g, 'g1')?.type).toBe('N');
  });

  it('Valóságtörés: sliders pass through their own pieces this turn only – never through enemy pieces', () => {
    let g = game(undefined, { w: deckWith('realityBreak'), mana: 6 });
    g = cast(g, 'realityBreak');
    expect(canMove(g, 'a1', 'a5')).toBe(true);
    expect(canMove(g, 'a1', 'a7')).toBe(true); // through the own a2 pawn, taking a7
    expect(canMove(g, 'a1', 'a8')).toBe(false); // the black a7 pawn still blocks
    expect(canMove(g, 'd1', 'd7')).toBe(true);
    expect(canMove(g, 'd1', 'd8')).toBe(false);
    expect(canMove(g, 'c1', 'g5')).toBe(true);
    // no extra king-like step any more: a lone rook still moves like a rook
    const lone = cast(game('4k3/8/8/8/3R4/8/8/4K3 w - - 0 1', { w: deckWith('realityBreak'), mana: 6 }), 'realityBreak');
    expect(canMove(lone, 'd4', 'e5')).toBe(false);
    g = move(g, 'a1', 'a5');
    expect(g.effects.some((e) => e.kind === 'realityBreak')).toBe(false);
    expect(canMove(g, 'a8', 'a4')).toBe(false);
  });
});

describe('control spells', () => {
  it('Gyengítés and Gyalogfagyasztás freeze a piece for one turn', () => {
    let g = game(undefined, { w: deckWith('weaken', 'pawnFreeze'), mana: 4 });
    g = cast(g, 'weaken', 'b8');
    g = cast(g, 'pawnFreeze', 'e7');
    g = move(g, 'e2', 'e4');
    expect(canMove(g, 'b8', 'c6')).toBe(false);
    expect(canMove(g, 'e7', 'e5')).toBe(false);
    g = move(g, 'd7', 'd5');
    g = move(g, 'd2', 'd4');
    expect(canMove(g, 'b8', 'c6')).toBe(true);
  });

  it('Gyökér: only captures; Vakfolt: no captures', () => {
    const fen = '4k3/8/8/3n4/5P2/8/8/4K3 w - - 0 1';
    let r = game(fen, { w: deckWith('root'), mana: 3 });
    r = cast(r, 'root', 'd5');
    r = move(r, 'e1', 'd1');
    expect(legalMoves(r).filter((m) => m.from === S('d5')).map((m) => m.to)).toEqual([S('f4')]);
    let b = game(fen, { w: deckWith('blindSpot'), mana: 3 });
    b = cast(b, 'blindSpot', 'd5');
    b = move(b, 'e1', 'd1');
    const kn = legalMoves(b).filter((m) => m.from === S('d5'));
    expect(kn.length).toBeGreaterThan(0);
    expect(kn.some((m) => m.to === S('f4'))).toBe(false);
  });

  it('Hatástalanítás removes the piece\'s attack (no check)', () => {
    let g = game('4k3/8/8/8/8/8/8/r3K3 w - - 0 1', { w: deckWith('disarm'), mana: 3 });
    expect(inCheck(g, 'w')).toBe(true);
    g = cast(g, 'disarm', 'a1');
    expect(inCheck(g, 'w')).toBe(false);
    expect(canMove(g, 'e1', 'd1')).toBe(true);
  });

  it('Fal blocks passing and landing and crumbles after the opponent\'s turn', () => {
    let g = game('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', { b: deckWith('wall'), mana: 3 });
    g = move(g, 'e1', 'f2');
    g = cast(g, 'wall', 'd1');
    g = move(g, 'e8', 'e7');
    expect(canMove(g, 'a1', 'c1')).toBe(true);
    expect(canMove(g, 'a1', 'd1')).toBe(false);
    expect(canMove(g, 'a1', 'e1')).toBe(false);
    g = move(g, 'a1', 'b1');
    expect(g.effects.some((e) => e.kind === 'wall')).toBe(false);
  });

  it('Barikád blocks two adjacent squares', () => {
    const g = game('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', { w: deckWith('barricade'), mana: 3 });
    expect(targets(g, 'barricade', 'd4').sort((a, b) => a - b)).toEqual(['d3', 'c4', 'e4', 'd5'].map(S).sort((a, b) => a - b));
    const s = cast(g, 'barricade', 'a3', 'a4');
    expect(canMove(s, 'a1', 'a2')).toBe(true);
    expect(canMove(s, 'a1', 'a5')).toBe(false);
  });

  it('Gravitáció: knights cannot jump', () => {
    const g = cast(game(undefined, { w: deckWith('gravity'), mana: 3 }), 'gravity');
    expect(legalMoves(g).some((m) => g.board[m.from]?.type === 'N')).toBe(false);
  });

  it('Dimenzióváltás: pieces inside the zone move like knights', () => {
    const g = cast(game(undefined, { w: deckWith('dimensionShift'), mana: 5 }), 'dimensionShift', 'b2');
    expect(canMove(g, 'a1', 'b3')).toBe(true);
    expect(canMove(g, 'c2', 'c3')).toBe(false); // pawn in the zone moves as a knight now
    expect(canMove(g, 'c2', 'd4')).toBe(true);
    expect(canMove(g, 'e2', 'e4')).toBe(true); // outside the zone: normal
  });

  it('Némaság blocks the opponent\'s spells', () => {
    let g = game(undefined, { w: deckWith('silence'), b: deckWith('pawnShield'), mana: 3 });
    g = cast(g, 'silence');
    g = move(g, 'e2', 'e4');
    expect(castBlockReason(g, 'pawnShield')).toContain('Némaság');
  });
});

describe('board-changing spells', () => {
  it('Földrengés moves all pawns one square', () => {
    const g = cast(game(undefined, { w: deckWith('earthquake'), mana: 4 }), 'earthquake');
    expect(at(g, 'e3')?.type).toBe('P');
    expect(at(g, 'e6')?.type).toBe('P');
    expect(at(g, 'e2')).toBeNull();
    expect(g.turn).toBe('w');
  });

  it('Káosz swaps two non-king pieces deterministically and safely', () => {
    const g = game(undefined, { w: deckWith('chaos'), mana: 4, seed: 7 });
    const a = cast(g, 'chaos');
    const b = cast(g, 'chaos');
    expect(a.board.map((p) => p?.id ?? null)).toEqual(b.board.map((p) => p?.id ?? null));
    const changed = a.board.map((p, i) => (p?.id ?? null) !== (g.board[i]?.id ?? null)).filter(Boolean).length;
    expect(changed).toBe(2);
    expect(findKing(a.board, 'w')).toBe(S('e1'));
    expect(inCheck(a, 'w')).toBe(false);
  });

  it('Kivégzés: only pieces worth ≤ 3, no capture mana', () => {
    const g = game('r3k3/8/8/3n4/8/8/8/4K3 w - - 0 1', { w: deckWith('execution'), mana: 6 });
    expect(targets(g, 'execution')).toEqual([S('d5')]);
    const s = cast(g, 'execution', 'd5');
    expect(at(s, 'd5')).toBeNull();
    expect(s.players.w.mana).toBe(1); // costs 5, no capture mana for a spell kill
  });

  it('Meteor destroys the target and adjacent pawns only', () => {
    const g = cast(game(undefined, { w: deckWith('meteor'), mana: 6 }), 'meteor', 'd7');
    expect(at(g, 'd7')).toBeNull();
    expect(at(g, 'c7')).toBeNull();
    expect(at(g, 'e7')).toBeNull();
    expect(at(g, 'd8')?.type).toBe('Q');
    expect(at(g, 'e8')?.type).toBe('K');
  });

  it('Meteor destroys at most 4 points of material and cannot hit a rook or a queen', () => {
    // a bishop (3) surrounded by 8 black pawns leaves room for one pawn
    const bishop = cast(game('4k3/8/2ppp3/2pbp3/2ppp3/8/8/4K3 w - - 0 1', { w: deckWith('meteor'), mana: 6 }), 'meteor', 'd5');
    expect(at(bishop, 'd5')).toBeNull();
    expect(bishop.board.filter((p) => p?.type === 'P' && p.color === 'b')).toHaveLength(7);
    // a pawn in the middle: itself and 3 neighbours
    const pawn = cast(game('4k3/8/2ppp3/2ppp3/2ppp3/8/8/4K3 w - - 0 1', { w: deckWith('meteor'), mana: 6 }), 'meteor', 'd5');
    expect(pawn.board.filter((p) => p?.type === 'P' && p.color === 'b')).toHaveLength(5);
    // the rook (5) and the queen (9) are out of reach
    for (const big of ['r', 'q']) {
      const g = game(`4k3/8/2ppp3/2p${big}p3/2ppp3/8/8/4K3 w - - 0 1`, { w: deckWith('meteor'), mana: 6 });
      expect(targets(g, 'meteor')).not.toContain(S('d5'));
      expect(targets(g, 'meteor')).toContain(S('c6'));
    }
  });

  it('Meteor splash hits enemy pawns before the caster\'s own', () => {
    const g = cast(game('4k3/8/2ppp3/2pnP3/2PPP3/8/8/4K3 w - - 0 1', { w: deckWith('meteor'), mana: 6 }), 'meteor', 'd5');
    expect(g.board.filter((p) => p?.type === 'P' && p.color === 'b')).toHaveLength(3); // knight 3 + 1 of the 4 black pawns
    expect(g.board.filter((p) => p?.type === 'P' && p.color === 'w')).toHaveLength(4); // nothing left for the own pawns
    // a pawn in the middle: the enemy neighbour first, then the caster's own pawns with the rest of the budget
    const p = cast(game('4k3/8/8/2pp4/2PPP3/8/8/4K3 w - - 0 1', { w: deckWith('meteor'), mana: 6 }), 'meteor', 'd5');
    expect(p.board.filter((x) => x?.type === 'P')).toHaveLength(1); // 1 + 1 + 2 = 4: one own pawn survives
  });

  it('costs changed on request or after the balance test', () => {
    const costs: [SpellId, number][] = [
      ['execution', 5], ['fortify', 4], ['meteor', 6], ['teleport', 5], ['brigade', 3], ['wall', 1], ['kingStride', 1],
      ['gravity', 2], ['earthquake', 3], ['lastChance', 3], ['recastle', 1], ['frenchCheese', 3], ['clone', 3], ['provoke', 3],
      ['doomsday', 4], ['manaMage', 2],
    ];
    for (const [id, cost] of costs) expect([id, SPELLS[id].manaCost]).toEqual([id, cost]);
  });

  it('Nekromancia revives a lost pawn on the starting rank', () => {
    let g = game(undefined, { w: deckWith('sacrifice', 'necromancy'), mana: 6 });
    expect(castBlockReason(g, 'necromancy')).not.toBeNull();
    g = cast(g, 'sacrifice', 'e2');
    expect(targets(g, 'necromancy')).toEqual([S('e2')]);
    g = cast(g, 'necromancy', 'e2');
    expect(at(g, 'e2')?.type).toBe('P');
    expect(g.captured.w).toHaveLength(0);
    expect(canMove(g, 'e2', 'e4')).toBe(true);
  });
});

describe('every spell is castable in some position', () => {
  it('each spell has a valid cast in a suitable test position', () => {
    // Quick sanity: in the start position after a few moves, most spells have targets.
    let g = game(undefined, { mana: 6 });
    g = move(g, 'e2', 'e4');
    g = move(g, 'd7', 'd5');
    g = move(g, 'e4', 'd5');
    const castable = SPELL_LIST.filter((s) => {
      const st = { ...g, players: { ...g.players, b: { ...g.players.b, mana: 6, deck: [s.id, ...deckWith().filter((x) => x !== s.id)].slice(0, 6) } } };
      return castBlockReason(st, s.id) === null;
    }).map((s) => s.id);
    // Spells that need a special situation in this position:
    const situational = [
      'checkBreaker', 'recastle', 'instantPromotion', 'lastChance', 'necromancy', 'rewind', 'pawnRush', 'stepBack',
      'kingStride', 'arcaneSurge', 'rookCharge', 'frenchCheese', 'bishopSniper', 'quickCastle', 'pawnVault',
    ];
    for (const s of SPELL_LIST) if (!situational.includes(s.id)) expect(castable).toContain(s.id);
  });
});

describe('Brigád and the Rabszolga', () => {
  const quiet = '4k3/p7/8/8/8/8/8/4K3 w - - 0 1';

  it('summons 5 servants onto chosen empty squares of the own ranks 1–3', () => {
    const g = game(undefined, { w: deckWith('brigade'), mana: 6 });
    expect(targets(g, 'brigade').sort((a, b) => a - b)).toEqual(['a3', 'b3', 'c3', 'd3', 'e3', 'f3', 'g3', 'h3'].map(S));
    const s = cast(g, 'brigade', 'a3', 'b3', 'c3', 'f3', 'h3');
    expect(s.board.filter((p) => p?.type === 'S' && p.color === 'w')).toHaveLength(5);
    expect(s.players.w.mana).toBe(3); // Brigád costs 3
    expect(s.turn).toBe('w'); // a spell does not end the turn
    expect(targets(game(quiet, { w: deckWith('brigade'), mana: 6 }), 'brigade')).not.toContain(S('a4'));
  });

  it('servants step one square forward only – no double step, no capture', () => {
    let g = game('4k3/p7/8/8/8/n1n5/8/4K3 w - - 0 1', { w: deckWith('brigade'), mana: 6 });
    g = cast(g, 'brigade', 'b2', 'f2', 'g2', 'h2', 'h1');
    expect(canMove(g, 'b2', 'b3')).toBe(true);
    expect(canMove(g, 'b2', 'b4')).toBe(false);
    expect(canMove(g, 'b2', 'a3')).toBe(false);
    expect(canMove(g, 'b2', 'c3')).toBe(false);
    expect(canMove(g, 'f2', 'f3')).toBe(true);
    expect(canMove(g, 'f2', 'f4')).toBe(false);
  });

  it('servants never attack: no check, and taking one earns no mana', () => {
    let g = game('8/p7/8/8/8/3k4/8/4K3 w - - 0 1', { w: deckWith('brigade'), mana: { w: 6, b: 2 } });
    g = cast(g, 'brigade', 'c2', 'a1', 'b1', 'g2', 'h2');
    expect(inCheck(g, 'b')).toBe(false); // a pawn on c2 would give check to d3
    g = move(g, 'e1', 'f1');
    const before = g.players.b.mana;
    expect(canMove(g, 'd3', 'c2')).toBe(true);
    g = move(g, 'd3', 'c2');
    expect(g.players.b.mana).toBe(before);
    expect(g.captured.w.map((p) => p.type)).toEqual(['S']);
    expect(g.log.some((l) => l.text.includes('rabszolgáért nem jár mana'))).toBe(true);
  });

  it('a servant can block a check – Brigád is a valid escape from mate', () => {
    const fen = '4r1k1/5ppp/8/8/8/R7/5PPP/6K1 b - - 0 1';
    let g = move(game(fen, { w: deckWith('brigade'), mana: 6 }), 'e8', 'e1');
    expect(g.status.kind).toBe('playing');
    expect(g.mustCastSpell).toBe(true);
    g = cast(g, 'brigade', 'f1', 'a1', 'b1', 'c1', 'd1');
    expect(g.inCheck).toBe(false);
    expect(canEndTurn(g)).toBe(true);
  });

  it('needs 5 free squares', () => {
    const full = game('4k3/8/8/8/8/PPPPPPPP/PPPPPPPP/RNBQKBNR w - - 0 1', { w: deckWith('brigade'), mana: 6 });
    expect(castBlockReason(full, 'brigade')).not.toBeNull();
  });
});

describe('Klón', () => {
  it('costs half the piece value + 2, rounded up', () => {
    const cases: [string, string, number][] = [
      ['4k3/8/8/8/8/8/3P4/4K3 w - - 0 1', 'd2', 3],
      ['4k3/8/8/8/8/8/3N4/4K3 w - - 0 1', 'd2', 4],
      ['4k3/8/8/8/8/8/3B4/4K3 w - - 0 1', 'd2', 4],
    ];
    for (const [fen, from, cost] of cases) {
      const g = game(fen, { w: deckWith('clone'), mana: 6 });
      const to = targets(g, 'clone', from)[0];
      const s = act(g, { type: 'CAST', spellId: 'clone', targets: [S(from), to] });
      expect(6 - s.players.w.mana).toBe(cost);
    }
    const rook = game('4k3/8/8/8/8/8/3R4/4K3 w - - 0 1', { w: deckWith('clone'), mana: 6 });
    expect(6 - cast(rook, 'clone', 'd2', 'c1').players.w.mana).toBe(5);
  });

  it('only affordable pieces can be targeted; never the king or the queen', () => {
    const fen = '4k3/8/8/8/8/8/Q2R4/4K3 w - - 0 1';
    const poor = game(fen, { w: deckWith('clone'), mana: 4 });
    expect(targets(poor, 'clone')).not.toContain(S('d2')); // rook: 5
    const rich = game(fen, { w: deckWith('clone'), mana: 6 });
    expect(targets(rich, 'clone')).toContain(S('d2'));
    expect(targets(rich, 'clone')).not.toContain(S('a2')); // the queen: never
    expect(targets(rich, 'clone')).not.toContain(S('e1'));
  });

  it('the clone goes onto an adjacent free square and may not give check', () => {
    const g = game('4k3/8/8/8/8/8/3R4/4K3 w - - 0 1', { w: deckWith('clone'), mana: 6 });
    const sq = targets(g, 'clone', 'd2').sort((a, b) => a - b);
    expect(sq).toEqual(['c1', 'd1', 'c2', 'c3', 'd3'].map(S).sort((a, b) => a - b)); // e2/e3 would check e8
    const s = cast(g, 'clone', 'd2', 'd3');
    expect(at(s, 'd3')?.type).toBe('R');
    expect(at(s, 'd3')?.clone).toBe(true);
    expect(at(s, 'd2')?.clone).toBeFalsy();
    expect(s.turn).toBe('w');
  });

  it('a pawn clone never lands on the last rank', () => {
    const g = game('4k3/1P6/8/8/8/8/8/4K3 w - - 0 1', { w: deckWith('clone'), mana: 6 });
    for (const t of targets(g, 'clone', 'b7')) expect(t >> 3).not.toBe(7);
  });

  it('the clone dissolves right after it captures something', () => {
    let g = game('4k3/8/8/3p4/8/4N3/8/4K3 w - - 0 1', { w: deckWith('clone'), mana: 4 });
    g = cast(g, 'clone', 'e3', 'f4');
    expect(g.players.w.mana).toBe(0);
    g = move(g, 'f4', 'd5');
    expect(at(g, 'd5')).toBeNull(); // pawn captured, clone gone
    expect(at(g, 'e3')?.type).toBe('N'); // the original stays
    expect(g.players.w.mana).toBe(1); // capture mana as usual
    expect(g.captured.b.map((p) => p.type)).toEqual(['P']);
    expect(g.captured.w.filter((p) => p.dissolved)).toHaveLength(1);
    expect(g.events.some((e) => e.type === 'destroy')).toBe(true);
  });

  it('one clone at a time: a new one only after the last is gone', () => {
    const withClone = (x: GameState): GameState => ({
      ...x, players: { ...x.players, w: { ...x.players.w, mana: 6, deck: ['clone', ...x.players.w.deck.filter((d) => d !== 'clone')] } },
    });
    let g = game('4k3/8/8/3p4/8/4N3/1P6/4K3 w - - 0 1', { w: deckWith('clone'), mana: 6 });
    g = cast(g, 'clone', 'e3', 'f4');
    expect(castBlockReason(withClone(g), 'clone')).not.toBeNull();
    g = move(g, 'f4', 'd5'); // the clone captures and dissolves
    g = move(g, 'e8', 'd8');
    expect(castBlockReason(withClone(g), 'clone')).toBeNull();
  });

  it('a clone that does not capture keeps playing like the original', () => {
    let g = game('4k3/8/8/8/8/4N3/8/4K3 w - - 0 1', { w: deckWith('clone'), mana: 4 });
    g = cast(g, 'clone', 'e3', 'f4');
    g = move(g, 'f4', 'g6');
    expect(at(g, 'g6')?.clone).toBe(true);
  });
});

describe('Francia sajt', () => {
  const fen = '4k3/8/8/3nP3/8/8/8/4K3 w - - 0 1';

  it('lets a pawn take ANY piece beside it en passant (this turn, as the normal move)', () => {
    let g = game(fen, { w: deckWith('frenchCheese'), mana: 3 });
    expect(canMove(g, 'e5', 'd6')).toBe(false);
    expect(targets(g, 'frenchCheese')).toEqual([S('e5')]);
    g = cast(g, 'frenchCheese', 'e5');
    expect(g.players.w.mana).toBe(0);
    expect(canMove(g, 'e5', 'd6')).toBe(true);
    expect(canMove(g, 'e5', 'f6')).toBe(false); // nothing beside on f5
    g = move(g, 'e5', 'd6');
    expect(at(g, 'd6')?.type).toBe('P');
    expect(at(g, 'd5')).toBeNull();
    expect(at(g, 'e5')).toBeNull();
    expect(g.players.w.mana).toBe(1); // capture +1
    expect(g.captured.b.some((p) => p.type === 'N')).toBe(true);
    expect(g.turn).toBe('b');
  });

  it('never takes the queen', () => {
    const g = game('4k3/8/8/3qP3/8/8/8/4K3 w - - 0 1', { w: deckWith('frenchCheese'), mana: 3 });
    expect(targets(g, 'frenchCheese')).toEqual([]);
    const both = game('4k3/8/8/3qPn2/8/8/8/4K3 w - - 0 1', { w: deckWith('frenchCheese'), mana: 3 });
    const s = cast(both, 'frenchCheese', 'e5');
    expect(canMove(s, 'e5', 'f6')).toBe(true); // the knight beside it: yes
    expect(canMove(s, 'e5', 'd6')).toBe(false); // the queen: no
  });

  it('lasts only this turn', () => {
    let g = game(fen, { w: deckWith('frenchCheese'), mana: 3 });
    g = cast(g, 'frenchCheese', 'e5');
    g = move(g, 'e1', 'd1');
    g = move(g, 'e8', 'f8');
    expect(g.effects.some((e) => e.kind === 'frenchCheese')).toBe(false);
    expect(canMove(g, 'e5', 'd6')).toBe(false);
  });

  it('works on the 7th rank with promotion', () => {
    let g = game('4k3/1rP5/8/8/8/8/8/4K3 w - - 0 1', { w: deckWith('frenchCheese'), mana: 3 });
    g = cast(g, 'frenchCheese', 'c7');
    g = move(g, 'c7', 'b8', 'Q');
    expect(at(g, 'b8')?.type).toBe('Q');
    expect(at(g, 'b7')).toBeNull();
  });

  it('never against the king or a shielded piece; the square behind must be empty', () => {
    const king = game('8/8/8/3kP3/8/8/8/4K3 w - - 0 1', { w: deckWith('frenchCheese'), mana: 3 });
    expect(castBlockReason(king, 'frenchCheese')).not.toBeNull();
    const blocked = game('4k3/8/3N4/3nP3/8/8/8/4K3 w - - 0 1', { w: deckWith('frenchCheese'), mana: 3 });
    expect(castBlockReason(blocked, 'frenchCheese')).not.toBeNull();
    let g = game('4k3/8/8/3nP3/8/8/8/4K3 b - - 0 1', { w: deckWith('frenchCheese'), b: deckWith('knightShield'), mana: 3 });
    g = cast(g, 'knightShield', 'd5');
    g = move(g, 'e8', 'f8');
    expect(targets(g, 'frenchCheese')).not.toContain(S('e5'));
  });
});

describe('Futólövész', () => {
  const fen = '4k3/8/8/6n1/8/8/8/2B1K3 w - - 0 1';

  it('the bishop shoots its target but stays on its square', () => {
    let g = game(fen, { w: deckWith('bishopSniper'), mana: 4 });
    expect(targets(g, 'bishopSniper')).toEqual([S('c1')]);
    g = cast(g, 'bishopSniper', 'c1');
    expect(g.players.w.mana).toBe(0);
    const r = applyAction(g, { type: 'MOVE', from: S('c1'), to: S('g5') });
    expect(r.ok).toBe(true);
    g = r.ok ? r.state : g;
    expect(at(g, 'g5')).toBeNull();
    expect(at(g, 'c1')?.type).toBe('B');
    expect(g.turn).toBe('b');
    expect(g.players.w.mana).toBe(1); // capture +1
    expect(g.events.some((e) => e.type === 'shot' && e.from === S('c1') && e.to === S('g5'))).toBe(true);
    expect(g.moveList.at(-1)?.san).toContain('lövés');
    // quiet moves of the sniper are still normal moves
    let q = cast(game(fen, { w: deckWith('bishopSniper'), mana: 4 }), 'bishopSniper', 'c1');
    q = move(q, 'c1', 'd2');
    expect(at(q, 'd2')?.type).toBe('B');
  });

  it('needs a bishop with something to shoot', () => {
    const g = game('4k3/8/8/8/8/8/8/2B1K3 w - - 0 1', { w: deckWith('bishopSniper'), mana: 4 });
    expect(castBlockReason(g, 'bishopSniper')).not.toBeNull();
  });

  it('a pinned bishop may shoot off the pin line (it does not move)', () => {
    let g = game('4k3/8/8/b7/5n2/8/3B4/4K3 w - - 0 1', { w: deckWith('bishopSniper'), mana: 4 });
    expect(canMove(g, 'd2', 'f4')).toBe(false);
    g = cast(g, 'bishopSniper', 'd2');
    g = move(g, 'd2', 'f4');
    expect(at(g, 'd2')?.type).toBe('B');
    expect(at(g, 'f4')).toBeNull();
    expect(inCheck(g, 'w')).toBe(false);
  });

  it('Megerősítés absorbs the shot', () => {
    let g = game('4k3/8/8/6n1/8/8/8/2B1K3 b - - 0 1', { w: deckWith('bishopSniper'), b: deckWith('fortify'), mana: { w: 3, b: 4 } });
    g = cast(g, 'fortify', 'g5');
    g = move(g, 'e8', 'd8');
    expect(g.players.w.mana).toBe(4);
    g = cast(g, 'bishopSniper', 'c1');
    g = move(g, 'c1', 'g5');
    expect(at(g, 'g5')?.type).toBe('N');
    expect(at(g, 'c1')?.type).toBe('B');
    expect(g.effects.some((e) => e.kind === 'fortified')).toBe(false);
    expect(g.players.w.mana).toBe(0);
    expect(g.events.some((e) => e.type === 'bounce')).toBe(true);
  });
});

describe('Mana mágus', () => {
  const mageLog = (g: GameState) => g.log.filter((l) => l.text.startsWith('Mana mágus (')).length;

  it('+1 extra mana at the start of each of the next 3 own turns', () => {
    let g = game(undefined, { w: deckWith('manaMage'), mana: 2 });
    g = cast(g, 'manaMage', 'b1');
    expect(g.players.w.mana).toBe(0);
    g = move(g, 'e2', 'e4');
    g = move(g, 'e7', 'e5');
    expect(g.players.w.mana).toBe(2); // +1 turn +1 mage
    g = move(g, 'b1', 'c3'); // the mage may move freely
    g = move(g, 'b8', 'c6');
    expect(g.players.w.mana).toBe(4);
    g = move(g, 'f1', 'c4');
    g = move(g, 'g8', 'f6');
    expect(g.players.w.mana).toBe(6);
    expect(mageLog(g)).toBe(3);
    g = move(g, 'd2', 'd3');
    expect(g.effects.some((e) => e.kind === 'manaMage')).toBe(false);
    g = move(g, 'd7', 'd6');
    expect(mageLog(g)).toBe(3); // no 4th payment
  });

  it('a capture with the mage gives +1 extra mana', () => {
    let g = game('4k3/8/8/3p4/8/4N3/8/4K3 w - - 0 1', { w: deckWith('manaMage'), mana: 2 });
    g = cast(g, 'manaMage', 'e3');
    g = move(g, 'e3', 'd5');
    expect(g.players.w.mana).toBe(2);
  });

  it('only pieces worth at most 3 points', () => {
    const g = game('4k3/8/8/8/8/8/PNBRQ3/4K3 w - - 0 1', { w: deckWith('manaMage'), mana: 3 });
    expect(targets(g, 'manaMage').sort()).toEqual(['a2', 'b2', 'c2'].map(S).sort());
  });

  it('one mage at a time: a new mage takes over from the old one', () => {
    // the card coming back round is simulated by putting it in front of the deck again
    const mage = (g: GameState): GameState => ({ ...g, players: { ...g.players, w: { ...g.players.w, deck: ['manaMage' as SpellId, ...g.players.w.deck.filter((x) => x !== 'manaMage')], mana: 6 } } });
    let g = game('4k3/8/8/8/8/4N3/1P6/4K3 w - - 0 1', { w: deckWith('manaMage'), mana: 6 });
    g = cast(g, 'manaMage', 'e3');
    expect(castBlockReason(mage(g), 'manaMage')).toBeNull(); // never stuck in the hand
    g = cast(mage(g), 'manaMage', 'b2');
    const mages = g.effects.filter((e) => e.kind === 'manaMage');
    expect(mages).toHaveLength(1);
    expect(mages[0].pieceId).toBe(at(g, 'b2')!.id);
    expect(g.log.some((l) => l.text.includes('elveszítette az erejét'))).toBe(true);
  });

  it('killed by a spell → the CASTER loses 1 mana at once (never below 0); a normal capture costs nothing', () => {
    let g = game('4k3/8/8/8/8/4N3/8/4K3 w - - 0 1', { w: deckWith('manaMage'), b: deckWith('execution'), mana: { w: 5, b: 6 } });
    g = cast(g, 'manaMage', 'e3');
    g = move(g, 'e1', 'd1');
    expect(g.players.w.mana).toBe(3);
    g = cast(g, 'execution', 'e3');
    expect(at(g, 'e3')).toBeNull();
    expect(g.players.b.mana).toBe(6 - 5 - 1);
    expect(g.players.w.mana).toBe(3); // the mage's owner loses nothing

    let broke = game('4k3/8/8/8/8/4N3/8/4K3 w - - 0 1', { w: deckWith('manaMage'), b: deckWith('execution'), mana: 5 });
    broke = cast(broke, 'manaMage', 'e3');
    broke = move(broke, 'e1', 'd1');
    broke = cast(broke, 'execution', 'e3');
    expect(broke.players.b.mana).toBe(0);

    let n = game('4k3/8/8/2b5/8/4N3/8/4K3 w - - 0 1', { w: deckWith('manaMage'), mana: 5 });
    n = cast(n, 'manaMage', 'e3');
    n = move(n, 'e1', 'd1');
    n = move(n, 'c5', 'e3');
    expect(n.players.w.mana).toBe(3 + 1); // untouched by the capture, +1 regular income
  });
});
