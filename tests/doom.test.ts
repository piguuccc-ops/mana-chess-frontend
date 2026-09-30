// „Végzet”: an enemy pawn or slave is destroyed (nothing protects it) and its neighbours are blasted
// one square outward; the opponent is paid 1 mana. Every plain cast charges the card: after two, the
// next time it comes round it is awakened – any non-king piece, erased from existence.
import { describe, expect, it } from 'vitest';
import { aiNextAction } from '../src/ai/simpleAI';
import {
  applyAction, castBlockReason, chargeOf, createGame, hand, isAwakened, lostTypes, promotionChoices, SPELLS, validTargets,
} from '../src/engine';
import type { Color, GameState, Piece, SpellId } from '../src/engine';
import { act, at, canMove, cast, deckWith, game, move, S, tryMove } from './helpers';

const names = (_g: GameState, ids: number[]) => ids.map((s) => 'abcdefgh'[s % 8] + (Math.floor(s / 8) + 1)).sort();

/** The same position with `color`'s Végzet charged `n` times (default: fully – the next cast is awakened). */
const charged = (g: GameState, color: Color = g.turn, n = SPELLS.doom.cycles ?? 1): GameState => ({
  ...g,
  players: { ...g.players, [color]: { ...g.players[color], charges: { ...g.players[color].charges, doom: n } } },
});

const withMana = (g: GameState, color: Color, mana: number): GameState => ({
  ...g,
  players: { ...g.players, [color]: { ...g.players[color], mana } },
});

describe('Végzet', () => {
  it('costs 6: the plain form picks enemy pawns and slaves, the awakened one any but the king – shielded or invisible alike', () => {
    let g = game('4k3/8/2n5/3p4/1r6/8/8/4K3 b - - 0 1', { w: deckWith('doom'), b: deckWith('pawnShield', 'invisibility'), mana: 6 });
    g = cast(g, 'pawnShield', 'd5');
    g = cast(g, 'invisibility', 'c6');
    g = move(g, 'e8', 'f8');
    // White to move: wards and shields do not matter; the knight and the rook need the awakened card
    expect(SPELLS.doom.manaCost).toBe(6);
    expect(names(g, validTargets(g, 'doom', []))).toEqual(['d5']);
    expect(names(g, validTargets(charged(g), 'doom', []))).toEqual(['b4', 'c6', 'd5']);
  });

  it('first cast: the piece is destroyed like any spell kill, the opponent is paid 1 mana, the card charges', () => {
    let g = game('4k3/8/8/3p4/8/8/8/4K3 w - - 0 1', { w: deckWith('doom'), mana: { w: 6, b: 2 } });
    const id = at(g, 'd5')!.id;
    expect(isAwakened(g, 'w', 'doom')).toBe(false);
    expect(chargeOf(g, 'w', 'doom')).toEqual({ have: 0, need: 2 });
    // a first plain cast charges it halfway…
    const once = cast(g, 'doom', 'd5');
    expect(once.players.w.charges.doom).toBe(1);
    expect(isAwakened(once, 'w', 'doom')).toBe(false);
    expect(once.log.some((l) => l.text.includes('feltöltődött'))).toBe(false);
    // …the second one (here: the card has already been played once) fully
    g = charged(g, 'w', 1);
    g = cast(g, 'doom', 'd5');
    expect(at(g, 'd5')).toBeNull();
    expect(g.players.w.mana).toBe(0);
    expect(g.players.b.mana).toBe(3);
    // not erased: it lies among the fallen, so whatever brings pieces back still can
    expect(g.captured.b.map((p) => p.id)).toEqual([id]);
    expect(g.erased).toEqual([]);
    expect(lostTypes(g, 'b')).toEqual([]);
    expect(g.events.some((e) => e.type === 'destroy' && e.square === S('d5'))).toBe(true);
    expect(g.events.some((e) => e.type === 'erase')).toBe(false);
    expect(g.events.find((e) => e.type === 'spell')).not.toHaveProperty('awakened');
    expect(g.log.some((l) => l.text.includes('elpusztult'))).toBe(true);
    expect(g.log.some((l) => l.text.includes('+1 manát kapott'))).toBe(true);
    // …and the card has charged: the next time it is played, it is awakened
    expect(g.players.w.charges.doom).toBe(2);
    expect(isAwakened(g, 'w', 'doom')).toBe(true);
    expect(g.log.some((l) => l.text.includes('feltöltődött'))).toBe(true);
  });

  it('awakened: the piece is erased – not a capture, on record as erased – and the charge is spent', () => {
    let g = charged(game('4k3/8/8/3q4/8/8/8/4K3 w - - 0 1', { w: deckWith('doom'), mana: { w: 6, b: 2 } }));
    const id = at(g, 'd5')!.id;
    g = cast(g, 'doom', 'd5');
    expect(g.events.find((e) => e.type === 'spell')).toMatchObject({ spellId: 'doom', awakened: true });
    expect(g.log.some((l) => l.text.includes('Felébredt Végzet'))).toBe(true);
    expect(g.players.w.charges.doom).toBe(0);
    expect(isAwakened(g, 'w', 'doom')).toBe(false);
    expect(at(g, 'd5')).toBeNull();
    expect(g.players.w.mana).toBe(0);
    expect(g.players.b.mana).toBe(3);
    expect(g.events.some((e) => e.type === 'mana' && e.color === 'b' && e.delta === 1 && e.reason === 'Végzet')).toBe(true);
    expect(g.captured.b).toEqual([]);
    expect(g.players.w.captures).toBe(0);
    expect(g.erased.map((p) => p.id)).toEqual([id]);
    expect(g.erased[0]).toMatchObject({ type: 'Q', color: 'b' });
    expect(g.events.some((e) => e.type === 'erase' && e.square === S('d5'))).toBe(true);
    expect(g.events.some((e) => e.type === 'capture' || e.type === 'destroy')).toBe(false);
    expect(g.log.some((l) => l.text.includes('megszűnt létezni'))).toBe(true);
    expect(g.log.some((l) => l.text.includes('+1 manát kapott'))).toBe(true);
  });

  it('the opponent’s +1 is lost when its crystals are full', () => {
    let g = game('4k3/8/8/3p4/8/8/8/4K3 w - - 0 1', { w: deckWith('doom'), mana: { w: 6, b: 6 } });
    g = cast(g, 'doom', 'd5');
    expect(g.players.b.mana).toBe(6);
    expect(g.log.some((l) => l.text.includes('a +1 elveszett'))).toBe(true);
  });

  it('nothing protects it: shield, fortification, last chance – all ignored', () => {
    let g = game('4k3/8/8/3p4/2p5/8/8/4K3 b - - 0 1', { w: deckWith('doom'), b: deckWith('pawnShield', 'fortify'), mana: 6 });
    g = cast(g, 'pawnShield', 'd5');
    g = cast(g, 'fortify', 'c4');
    g = move(g, 'e8', 'e7');
    for (const form of [g, charged(g)]) {
      const shielded = cast(form, 'doom', 'd5');
      expect(at(shielded, 'd5')).toBeNull();
      const fortified = cast(form, 'doom', 'c4');
      expect(at(fortified, 'c4')).toBeNull();
      expect(fortified.effects.some((e) => e.kind === 'fortified')).toBe(false);
    }
  });

  it('the shockwave pushes the neighbours one square straight out, both colours, never the king', () => {
    // target d4; neighbours: c5 (black pawn), e4 (white knight), e3 (black king), d3 (white pawn), c3 (black rook)
    let g = game('8/8/8/2p5/3pN3/2rPk3/8/K7 w - - 0 1', { w: deckWith('doom'), mana: 6 });
    g = cast(g, 'doom', 'd4');
    expect(at(g, 'd4')).toBeNull();
    expect(at(g, 'b6')?.type).toBe('P'); // c5 → b6
    expect(at(g, 'f4')?.type).toBe('N'); // e4 → f4 (own pieces fly too)
    expect(at(g, 'd2')?.type).toBe('P'); // d3 → d2
    expect(at(g, 'b2')?.type).toBe('R'); // c3 → b2
    expect(at(g, 'e3')?.type).toBe('K'); // kings stay
  });

  it('a push is blocked by a piece, a wall, the edge, or a pawn reaching the last rank', () => {
    // target b6: c7 pawn → d8 (last rank), a5 pawn → off the board, b5 knight → b4 (a wall), c6 bishop → d6 (a piece)
    let g = game('4k3/2P5/1pBp4/PN6/8/8/8/4K3 w - - 0 1', { w: deckWith('wall', 'doom'), mana: 6 });
    g = cast(g, 'wall', 'b4');
    const g2 = { ...g, players: { ...g.players, w: { ...g.players.w, mana: 6 } } };
    const after = cast(g2, 'doom', 'b6');
    expect(at(after, 'b6')).toBeNull();
    expect(at(after, 'c7')?.type).toBe('P');
    expect(at(after, 'a5')?.type).toBe('P');
    expect(at(after, 'b5')?.type).toBe('N');
    expect(at(after, 'c6')?.type).toBe('B');
  });

  it('pieces are pushed outward in all eight directions at once', () => {
    let g = game('k7/8/2ppp3/2ppp3/2ppp3/8/8/K7 w - - 0 1', { w: deckWith('doom'), mana: 6 });
    g = cast(g, 'doom', 'd5');
    expect(names(g, g.board.map((p, s) => (p?.type === 'P' ? s : -1)).filter((s) => s >= 0))).toEqual(
      ['b3', 'b5', 'b7', 'd3', 'd7', 'f3', 'f5', 'f7'].sort(),
    );
  });

  it('Nekromancia can bring back a pawn the first form destroyed – but never an erased one', () => {
    const g0 = game('4k3/8/8/8/8/8/3P4/N3K3 b - - 0 1', { w: deckWith('necromancy'), b: deckWith('doom'), mana: 6 });
    const plain = move(cast(g0, 'doom', 'd2'), 'e8', 'e7');
    expect(castBlockReason(plain, 'necromancy')).toBeNull();
    const erased = move(cast(charged(g0), 'doom', 'd2'), 'e8', 'e7');
    expect(castBlockReason(erased, 'necromancy')).not.toBeNull();
  });

  it('Visszatekerés restores a destroyed piece – but not an erased one', () => {
    // spells after the move („spell a lépés után is”): the blow lands after the last normal move
    let g = createGame({ fen: '4k3/8/8/1p6/8/8/8/R3K3 w - - 0 1', seed: 1, decks: { w: deckWith('doom'), b: deckWith('rewind') }, mana: { w: 6, b: 6 }, autoEndTurn: false });
    g = move(g, 'a1', 'a2');
    for (const [form, back] of [[g, true], [charged(g), false]] as const) {
      let r = cast(form, 'doom', 'b5');
      expect(at(r, 'b5')).toBeNull();
      r = act(r, { type: 'END_TURN' });
      r = cast(r, 'rewind');
      expect(at(r, 'a1')?.type).toBe('R'); // the rook's move is undone…
      expect(at(r, 'b5')?.type ?? null).toBe(back ? 'P' : null); // …the pawn comes back only if it was not erased
    }
  });

  it('the charge comes from playing the card: it has to go round the deck twice before it is awakened', () => {
    const deck: SpellId[] = ['doom', 'silence', 'manaDrain', 'royalGuard', 'gravity', 'timeStop'];
    let g = game('4k3/2q5/8/3p4/7p/8/8/4K2N w - - 0 1', { w: deck, mana: { w: 6, b: 2 } });
    expect(validTargets(g, 'doom', [])).not.toContain(S('c7')); // the queen is out of the plain form's reach
    g = cast(g, 'doom', 'd5'); // plain: the pawn is destroyed, the card goes to the back and charges
    expect(g.captured.b.map((p) => p.type)).toEqual(['P']);
    expect(hand(g, 'w')).not.toContain('doom');
    expect(castBlockReason(g, 'doom')).not.toBeNull();
    // three other cards are played, and the card is back in the hand – half charged
    const round = (s: GameState, ids: SpellId[]) => ids.reduce((x, id) => cast(withMana(x, 'w', 6), id), s);
    g = round(g, ['silence', 'manaDrain', 'royalGuard']);
    expect(hand(g, 'w')).toContain('doom');
    expect(chargeOf(g, 'w', 'doom')).toEqual({ have: 1, need: 2 });
    expect(isAwakened(g, 'w', 'doom')).toBe(false);
    g = cast(withMana(g, 'w', 6), 'doom', 'h4'); // plain again: the pawn is destroyed – now it is charged
    expect(isAwakened(g, 'w', 'doom')).toBe(true);
    g = move(move(g, 'e1', 'd1'), 'e8', 'd8'); // a turn passes, the silence wears off
    g = round(g, ['gravity', 'timeStop', 'silence']);
    expect(hand(g, 'w')).toContain('doom');
    expect(isAwakened(g, 'w', 'doom')).toBe(true);
    g = cast(withMana(g, 'w', 6), 'doom', 'c7'); // awakened: now the queen can be struck – and it is erased
    expect(g.erased.map((p) => p.type)).toEqual(['Q']);
    expect(lostTypes(g, 'b')).toEqual(['Q']);
    expect(g.players.w.charges.doom).toBe(0); // …and the card starts charging again
  });

  it('each player charges their own card', () => {
    let g = game('4k3/8/8/3p4/8/8/3P4/4K3 w - - 0 1', { w: deckWith('doom'), b: deckWith('doom'), mana: 6 });
    g = cast(charged(g, 'w', 1), 'doom', 'd5');
    expect(isAwakened(g, 'w', 'doom')).toBe(true);
    expect(isAwakened(g, 'b', 'doom')).toBe(false);
    expect(g.players.b.charges.doom ?? 0).toBe(0);
    g = move(g, 'e1', 'f1');
    g = cast(withMana(g, 'b', 6), 'doom', 'd2'); // Black's first Végzet: a plain kill
    expect(g.captured.w.map((p) => p.type)).toEqual(['P']);
    expect(g.erased).toEqual([]);
  });

  it('the shockwave may not expose the caster’s own king', () => {
    // the white knight on d2 shields the white king (d1) from the rook on d8; erasing e3 would blow it to c1
    const g = game('3r2k1/8/8/8/8/4p3/3N4/3K4 w - - 0 1', { w: deckWith('doom'), mana: 6 });
    for (const form of [g, charged(g)]) expect(validTargets(form, 'doom', [])).not.toContain(S('e3'));
    expect(validTargets(charged(g), 'doom', [])).toContain(S('d8')); // the rook: awakened only
  });
});

describe('Végzet – an erased officer is lost for good', () => {
  // White erases Black's queen; Black's pawn on b2 is one step from promoting
  const setup = (b = deckWith('clone', 'retrain', 'instantPromotion')) => {
    let g = charged(game('4k3/8/8/3q4/8/7K/1p6/8 w - - 0 1', { w: deckWith('doom'), b, mana: 6 }));
    g = cast(g, 'doom', 'd5');
    return move(g, 'h3', 'h4');
  };

  it('no pawn may promote into it any more – every other piece is still allowed', () => {
    const g = setup();
    expect(lostTypes(g, 'b')).toEqual(['Q']);
    expect(promotionChoices(g, 'b')).toEqual(['R', 'B', 'N']);
    expect(lostTypes(g, 'w')).toEqual([]);
    expect(g.log.some((l) => l.text.includes('nem változhat vezérré'))).toBe(true);
    // straight away with the move…
    const asQueen = applyAction(g, { type: 'MOVE', from: S('b2'), to: S('b1'), promotion: 'Q' });
    expect(asQueen.ok).toBe(false);
    if (!asQueen.ok) expect(asQueen.error).toContain('vezérré');
    expect(move(g, 'b2', 'b1', 'R').board[S('b1')]?.type).toBe('R');
    // …or through the choice that follows it
    const pending = move(g, 'b2', 'b1');
    expect(pending.pendingPromotion?.square).toBe(S('b1'));
    const promoteQ = applyAction(pending, { type: 'PROMOTE', piece: 'Q' });
    expect(promoteQ.ok).toBe(false);
    expect(act(pending, { type: 'PROMOTE', piece: 'N' }).board[S('b1')]?.type).toBe('N');
  });

  it('the AI promotes into the strongest piece still allowed', () => {
    const g = setup([]);
    expect(aiNextAction(g)).toEqual({ type: 'MOVE', from: S('b2'), to: S('b1'), promotion: 'R' });
    expect(aiNextAction(move(g, 'b2', 'b1'))).toEqual({ type: 'PROMOTE', piece: 'R' });
  });

  it('Azonnali átváltozás follows the same rule', () => {
    let g = charged(game('4k3/8/8/3q4/8/1p5K/8/8 w - - 0 1', { w: deckWith('doom'), b: deckWith('instantPromotion'), mana: 6 }));
    g = cast(g, 'doom', 'd5');
    g = move(g, 'h3', 'h4');
    g = cast(g, 'instantPromotion', 'b3');
    expect(applyAction(g, { type: 'PROMOTE', piece: 'Q' }).ok).toBe(false);
    expect(act(g, { type: 'PROMOTE', piece: 'B' }).board[S('b3')]?.type).toBe('B');
  });

  it('no Klón and no Átképzés into it either', () => {
    // White erases one of Black's bishops (c6); Black keeps a bishop (e4) and a knight (b3)
    let g = charged(game('4k3/8/2b5/8/4b3/1n6/8/4K3 w - - 0 1', { w: deckWith('doom'), b: deckWith('clone', 'retrain'), mana: 6 }));
    g = cast(g, 'doom', 'c6');
    g = move(g, 'e1', 'f1');
    expect(lostTypes(g, 'b')).toEqual(['B']);
    const clones = validTargets(g, 'clone', []);
    expect(clones).toContain(S('b3')); // another knight: fine
    expect(clones).not.toContain(S('e4')); // another bishop: never again
    const retrains = validTargets(g, 'retrain', []);
    expect(retrains).toContain(S('e4')); // bishop → knight: fine
    expect(retrains).not.toContain(S('b3')); // knight → bishop: no
  });

  it('the first, plain form takes no kind of piece away', () => {
    let g = game('4k3/8/8/3p4/8/7K/1p6/8 w - - 0 1', { w: deckWith('doom'), mana: 6 });
    g = move(cast(g, 'doom', 'd5'), 'h3', 'h4');
    expect(lostTypes(g, 'b')).toEqual([]);
    expect(move(g, 'b2', 'b1', 'N').board[S('b1')]?.type).toBe('N');
  });

  it('an erased pawn or servant takes nothing else away', () => {
    let g = charged(game('4k3/8/8/3p4/8/1p6/8/4K3 w - - 0 1', { w: deckWith('doom'), b: deckWith('clone'), mana: 6 }));
    g = cast(g, 'doom', 'd5');
    g = move(g, 'e1', 'f1');
    expect(lostTypes(g, 'b')).toEqual([]);
    expect(validTargets(g, 'clone', [])).toContain(S('b3'));
  });

  it('with every officer erased a pawn cannot reach the last rank at all – not even by a spell', () => {
    const g = game('4k3/8/8/8/8/7K/1p6/8 b - - 0 1', { b: deckWith('forcedMarch', 'teleport', 'instantPromotion'), mana: 6 });
    const officer = (type: Piece['type'], i: number): Piece => ({ id: `gone${i}`, type, color: 'b', hasMoved: true, prevSquare: null });
    g.erased.push(...(['Q', 'R', 'B', 'N'] as const).map(officer));
    expect(promotionChoices(g, 'b')).toEqual([]);
    expect(canMove(g, 'b2', 'b1')).toBe(false);
    expect(tryMove(g, 'b2', 'b1').ok).toBe(false);
    expect(validTargets(g, 'forcedMarch', [])).not.toContain(S('b2'));
    expect(validTargets(g, 'teleport', [])).not.toContain(S('b2'));
    expect(validTargets(g, 'instantPromotion', [])).toEqual([]);
  });

  it('the kind of piece stays lost after a Visszatekerés too', () => {
    let g = game('4k3/8/8/3q4/8/7K/1p6/8 w - - 0 1', { w: deckWith('doom'), b: deckWith('rewind'), mana: 6 });
    g = move(g, 'h3', 'g3');
    g = move(g, 'e8', 'e7');
    g = cast(charged(g), 'doom', 'd5');
    g = move(g, 'g3', 'h3');
    g = cast(g, 'rewind');
    expect(lostTypes(g, 'b')).toEqual(['Q']);
    expect(g.board.some((p) => p?.type === 'Q')).toBe(false);
  });
});
