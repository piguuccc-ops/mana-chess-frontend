// ─────────────────────────────────────────────────────────────────────────────
// Spell demos: for every spell a short, real replay on a small position – the
// card is played on chosen targets and (where it helps) a follow-up move shows
// what the spell makes possible. Every script is built by actually running the
// engine, so a demo can never show something the rules would not allow. (The one
// exception is a card that charges up: its demo skips ahead the few turns a full
// cycle of the deck takes – see `cycleLater`.)
// ─────────────────────────────────────────────────────────────────────────────
import { applyAction, createGame, legalMoves, parseSquare, promotionChoices, SPELL_LIST, SPELLS, validTargets } from '../../engine';
import type { Action, Color, GameState, Move, PromotionPiece, SpellId, Square } from '../../engine';

/**
 * The demo table: few pieces, open lines, one of everything the spells need
 * (a moved pawn, a blocked bishop, a pawn beside an enemy piece, a pawn on the
 * 6th rank, castling still possible, White one piece down…).
 */
export const DEMO_FEN = 'r3k3/ppp2p1p/P7/1n2Pbp1/6P1/2NP4/3B4/3QK2R w Kq - 0 1';

type Sq = string;

export type FollowStep =
  /** A move the spell has just made possible for the caster. */
  | 'enabled'
  /** An unremarkable move for the side to move (lets the turn pass). */
  | 'quiet'
  /** The caster captures on the first target square. */
  | 'captureTarget'
  | { from: Sq; to: Sq }
  /** „Körforgás”: skip ahead until the played card is back in the hand, charged (caption). */
  | { cycle: string }
  /** The demo card is played again on these targets (caption for its result). */
  | { cast: Sq[]; note: string };

export interface DemoScenario {
  fen?: string;
  mana?: Partial<Record<Color, number>>;
  /** Moves played before the demo starts (history some spells need). */
  pre?: [Sq, Sq][];
  /** The caster's cards already charged („Körforgás”) when the demo starts. */
  charges?: Partial<Record<SpellId, number>>;
  targets?: Sq[];
  follow?: FollowStep[];
  /** Caption for the follow-up part. */
  note?: string;
}

const CHECK_FEN = '4k3/8/8/8/8/8/3q4/4K3 w - - 0 1';

/** Hand-picked setups; anything not listed plays in DEMO_FEN on central targets. */
export const SCENARIOS: Partial<Record<SpellId, DemoScenario>> = {
  pawnRush: { targets: ['d3'], follow: ['enabled'], note: 'A már lépett gyalog is kettőt léphet előre.' },
  knightLeap: { targets: ['c3', 'b5'], note: 'Azonnali huszárugrás – most ütéssel.' },
  bishopBlessing: { targets: ['d2'], follow: ['enabled'], note: 'A futó átugorja a saját huszárját.' },
  rookCharge: { targets: ['h1', 'h4'], note: 'A bástya azonnal előretör.' },
  queenGrace: { targets: ['d1'], follow: ['enabled'], note: 'A vezér huszárként lép.' },
  kingStride: { follow: ['enabled'], note: 'A király két mezőt lép.' },
  pawnShield: { targets: ['g4'], note: 'A pajzsos gyalogot nem lehet leütni.' },
  knightShield: { targets: ['c3'], note: 'A huszárt nem lehet leütni.' },
  fortify: { targets: ['g4'], follow: ['quiet', { from: 'f5', to: 'g4' }], note: 'Az ütés lepattan – a gyalog a helyén marad.' },
  sacrifice: { targets: ['d3'], note: 'A feláldozott gyalog manává válik.' },
  forcedMarch: { targets: ['d3'], note: 'A gyalog előrelép – a normál lépésed megmarad.' },
  teleport: { targets: ['d1', 'd5'], note: 'A vezér átlép a saját bábuin.' },
  swap: { targets: ['c3', 'd2'], note: 'Két saját bábu helyet cserél.' },
  emergencySwap: { targets: ['h1'], note: 'A király a bástya helyére menekül.' },
  stepBack: { fen: 'START', pre: [['g1', 'f3'], ['g8', 'f6']], targets: ['f3'], note: 'A huszár visszalép oda, ahonnan jött.' },
  doubleMove: { follow: ['quiet', 'quiet'], note: 'A lépés után még egy bábu léphet.' },
  instantPromotion: { targets: ['a6'], note: 'A gyalog azonnal vezérré változik.' },
  royalGuard: { follow: ['quiet'], note: 'Az ellenfél a következő körében nem adhat sakkot.' },
  checkBreaker: { fen: CHECK_FEN, note: 'Sakkból a király egy biztonságos mezőre ugrik.' },
  recastle: { fen: DEMO_FEN.replace('w Kq', 'w q'), follow: ['enabled'], note: 'A sáncolás újra szabad – és már lehet is sáncolni.' },
  deathMark: { targets: ['b5'], follow: ['captureTarget'], note: 'A megjelölt bábu elleni ütés biztosan sikerül.' },
  weaken: { targets: ['f5'], note: 'A futó a következő körében nem mozdulhat.' },
  root: { targets: ['f5'], note: 'A futó csak ütni tud, üres mezőre nem léphet.' },
  blindSpot: { targets: ['f5'], note: 'A futó a következő körében nem üthet.' },
  silence: { note: 'Az ellenfél a következő körében nem varázsolhat.' },
  manaDrain: { note: 'Az ellenfél manát veszít.' },
  disarm: { targets: ['b5'], note: 'A huszár nem üt és nem támad.' },
  pawnFreeze: { targets: ['g5'], note: 'A gyalog befagy – a következő körében nem mozdul.' },
  wall: { targets: ['e4'], note: 'Senki nem léphet a falra, és nem is haladhat át rajta.' },
  barricade: { targets: ['d4', 'e4'], note: 'Két szomszédos mező elzárva.' },
  gravity: { note: 'A huszárok nem ugorhatnak át bábukon.' },
  chaos: { note: 'Két véletlen bábu helyet cserél.' },
  mirror: { targets: ['c3'], note: 'A huszár a tükörképmezőjére kerül.' },
  timeStop: { note: 'Az ellenfél a következő körében nem léphet normál lépést.' },
  rewind: { fen: 'START', pre: [['e2', 'e4'], ['d7', 'd5'], ['g1', 'f3'], ['d5', 'e4']], note: 'Az utolsó lépés előtti állás tér vissza – a leütött gyalog is.' },
  earthquake: { note: 'Minden gyalog egyet lép előre.' },
  dimensionShift: { targets: ['d2'], follow: ['enabled'], note: 'A zónában mindenki huszárként lép.' },
  bloodPrice: { targets: ['c3'], note: 'Egy bábu vérárán 3 mana.' },
  overcharge: { note: 'A következő spelled 2-vel olcsóbb.' },
  arcaneSurge: { mana: { w: 1 }, note: 'Azonnal +3 mana, de a plafon 4.' },
  gambit: { note: 'Az ellenfél 2 manát kap, te előrébb lépsz a ciklusban.' },
  lastChance: { follow: ['quiet', { from: 'f5', to: 'g4' }], note: 'Hátrányban minden bábud túlél egy ütést.' },
  execution: { targets: ['b5'], note: 'Egy legfeljebb 3 pontos bábu azonnal elesik.' },
  meteor: { targets: ['f5'], note: 'A becsapódás a szomszédos gyalogokat is elviszi.' },
  necromancy: { fen: 'START', pre: [['e2', 'e4'], ['d7', 'd5'], ['e4', 'd5'], ['d8', 'd5']], note: 'Egy elesett gyalog visszatér.' },
  realityBreak: { follow: [{ from: 'd1', to: 'd7' }], note: 'A vezér átsiklik a saját bábuin – egészen a király mellé.' },
  brigade: { targets: ['b1', 'c1', 'f1', 'g1', 'e3'], note: 'Öt rabszolga áll csatasorba.' },
  clone: { targets: ['c3', 'b3'], note: 'A klón félig átlátszó, és ütés után szertefoszlik.' },
  frenchCheese: { targets: ['e5'], follow: ['enabled'], note: 'En passant ütés egy futó ellen.' },
  bishopSniper: { targets: ['d2'], follow: [{ from: 'd2', to: 'g5' }], note: 'A futó távolról lő, és a helyén marad.' },
  manaMage: { targets: ['c3'], follow: ['quiet', 'quiet'], note: 'A mágus minden körödben +1 manát hoz.' },
  mine: { targets: ['b5'], follow: ['quiet', 'quiet'], note: 'Az ellenfél körének végén az akna felrobban.' },
  outOfWay: { targets: ['c3', 'b3'], follow: ['quiet'], note: 'A kör végén a bábu visszatér a helyére.' },
  quickCastle: { targets: ['h1'], note: 'Sáncolás spellként, a normál lépés megmarad.' },
  pawnVault: { targets: ['g4'], follow: ['enabled'], note: 'A gyalog átugorja az előtte álló bábut.' },
  provoke: { targets: ['c7'], follow: ['quiet', 'quiet'], note: 'Az ellenfélnek ezzel a gyaloggal kell lépnie.' },
  invisibility: { targets: ['c3'], note: 'Az ellenfél spelljei nem célozhatják.' },
  magnet: { targets: ['h7', 'h1'], note: 'Az ellenséges gyalog a bástya felé csúszik.' },
  repulse: { targets: ['f5', 'd3'], note: 'A futó hátrébb csúszik.' },
  manaDeposit: { follow: ['quiet', 'quiet'], note: 'A következő körödben +3 mana.' },
  scout: { targets: ['d3'], follow: ['enabled'], note: 'A gyalog oldalra lép.' },
  manaThirst: { follow: [{ from: 'c3', to: 'b5' }], note: 'Az ütés a leütött bábu értékét adja manában.' },
  retrain: { targets: ['c3'], note: 'A huszárból futó lesz.' },
  storm: { note: 'Az ellenséges gyalogok hátrálnak.' },
  shieldBreaker: { targets: ['f5'], note: 'A védelem megszűnik, a bábu hátrébb csúszik.' },
  gravityWell: { targets: ['e3'], note: 'A kúttól két mezőre álló bábuk közelebb csúsznak.' },
  manaArmageddon: { note: 'Mindkét fél manája elfogy.' },
  dragonFire: { targets: ['h3', 'g4'], note: 'A tűzcsóva végigsöpör az átlón.' },
  doom: {
    targets: ['g5'],
    // the card has gone round once already (1/2): this plain cast charges it fully
    charges: { doom: 1 },
    note: 'Sima kijátszás (a lap már egyszer körbejárt): a gyalog elpusztul – de még visszahozható –, a lökéshullám szétveti a szomszédait, Sötét +1 manát kap. A lap a pakli végére kerül, és most feltöltődik.',
    follow: [
      { cycle: 'Néhány körrel később, három másik lap után a Végzet feltöltve tér vissza a kezedbe: FELÉBREDT.' },
      { cast: ['b5'], note: 'Felébredt Végzet: a huszár kitörlődik a létezésből – semmi sem hozza vissza, és Sötét többé nem kaphat huszárt. Sötét +1 manát kap, a lap újra töltődni kezd.' },
    ],
  },
  glassCurse: { targets: ['f5'], follow: ['quiet', { from: 'f5', to: 'd3' }], note: 'Az átkozott futó üt – és maga is darabokra törik.' },
  doomsday: {
    fen: 'r3k2r/p4ppp/8/8/2p1p3/1p4p1/P1PP1P1P/RNBQKBNR w KQkq - 0 1',
    note: 'A Kaszás egyenként levágja a térfeledre betört ellenséges gyalogokat.',
  },
};

export type DemoStep =
  /** `note`: the caption for this cast's result (default: the demo's note). */
  | { kind: 'cast'; spell: SpellId; targets: Square[]; note?: string }
  | { kind: 'move'; from: Square; to: Square }
  /** A pawn waits for its new shape (e.g. „Azonnali átváltozás”): the demo picks one. */
  | { kind: 'promote'; piece: PromotionPiece }
  /**
   * „Körforgás”: a few turns pass – the caster plays its other cards (`decks`: the deck after
   * each of them) until the charged card is back in the hand; `to` is the table afterwards.
   */
  | { kind: 'cycle'; decks: SpellId[][]; to: GameState; note: string };

export interface DemoScript {
  spell: SpellId;
  start: GameState;
  steps: DemoStep[];
  note: string;
}

const demoDeck = (id: SpellId): SpellId[] => [id, ...SPELL_LIST.map((s) => s.id).filter((s) => s !== id && s !== 'chaos').slice(0, 5)];

function startState(id: SpellId, sc: DemoScenario): GameState | null {
  const fen = sc.fen === 'START' ? undefined : sc.fen ?? DEMO_FEN;
  let s = createGame({
    ...(fen ? { fen } : {}),
    decks: { w: demoDeck(id), b: ['wall', 'mine', 'weaken', 'root', 'silence', 'gravity'] },
    deckNames: { w: 'Bemutató', b: 'Ellenfél' },
    mana: { w: 6, b: 3, ...(sc.mana ?? {}) },
    ...(sc.charges ? { charges: { w: sc.charges } } : {}),
    seed: 7,
  });
  for (const [a, b] of sc.pre ?? []) {
    const r = applyAction(s, { type: 'MOVE', from: parseSquare(a), to: parseSquare(b) });
    if (!r.ok) return null;
    s = r.state;
  }
  // the history moves should not cost the demo its mana
  if (sc.pre?.length) {
    s = { ...s, players: { ...s.players, w: { ...s.players.w, mana: sc.mana?.w ?? 6 } } };
  }
  return s;
}

/** Central squares first: demos read best in the middle of the board. */
const centrality = (s: Square) => Math.abs((s % 8) - 3.5) + Math.abs(Math.floor(s / 8) - 3.5);

function autoTargets(s: GameState, id: SpellId): Square[] | null {
  const picked: Square[] = [];
  for (let i = 0; i < SPELLS[id].steps.length; i++) {
    const opts = validTargets(s, id, picked);
    if (!opts.length) return null;
    const occupied = opts.filter((o) => s.board[o]);
    const pool = (occupied.length && i === 0 ? occupied : opts).slice().sort((a, b) => centrality(a) - centrality(b));
    picked.push(pool[0]);
  }
  return picked;
}

const key = (m: Move) => `${m.from}-${m.to}`;

/** A harmless move: a king step if possible, else a pawn push, never touching `avoid`. */
function quietMove(s: GameState, avoid: Set<Square>): Move | null {
  const moves = legalMoves(s).filter((m) => !m.capture && !m.castle && !avoid.has(m.from) && !avoid.has(m.to));
  const king = moves.filter((m) => s.board[m.from]?.type === 'K');
  const pawns = moves.filter((m) => s.board[m.from]?.type === 'P');
  const pool = king.length ? king : pawns.length ? pawns : moves.length ? moves : legalMoves(s);
  if (!pool.length) return null;
  return pool.slice().sort((a, b) => centrality(a.to) - centrality(b.to))[0];
}

function apply(s: GameState, a: Action): GameState | null {
  const r = applyAction(s, a);
  return r.ok ? r.state : null;
}

/**
 * The only step a demo does not play through the engine: a full cycle of the deck takes several
 * turns, which no demo can wait for. The caster plays its other hand cards, one after the other,
 * until the card `id` is back in its hand (that is exactly how the cycle turns); meanwhile the
 * crystals fill up again (and the opponent's grow by one), and it is the caster's turn again.
 */
export function cycleLater(s: GameState, id: SpellId): { decks: SpellId[][]; to: GameState } | null {
  const c = s.turn;
  let deck = [...s.players[c].deck];
  const decks: SpellId[][] = [];
  for (let i = 0; i < deck.length && !deck.slice(0, 3).includes(id); i++) {
    const played = deck.slice(0, 3).find((x) => x !== id)!;
    deck = [...deck.filter((x) => x !== played), played];
    decks.push(deck);
  }
  if (!deck.slice(0, 3).includes(id)) return null;
  const o: Color = c === 'w' ? 'b' : 'w';
  const turnIndex = s.turnIndex + 2;
  const to: GameState = {
    ...s,
    turnIndex,
    players: {
      ...s.players,
      [c]: { ...s.players[c], deck, mana: 6, spellsCast: s.players[c].spellsCast + decks.length, cycleCount: s.players[c].cycleCount + decks.length },
      [o]: { ...s.players[o], mana: Math.min(6, s.players[o].mana + 1) },
    },
    effects: s.effects.filter((e) => e.expiresAfterTurn === null || e.expiresAfterTurn >= turnIndex),
    turnState: { normalMoveDone: false, firstMovePieceId: null, bonusMoveAvailable: false, spellsCast: 0, irreversible: false },
    events: [],
    eventSeq: s.eventSeq + 1,
  };
  return { decks, to };
}

/** Builds a demo that is guaranteed to replay: every step was executed once here. */
export function buildDemo(id: SpellId): DemoScript | null {
  const sc = SCENARIOS[id] ?? {};
  const attempts: DemoScenario[] = [sc, { ...sc, targets: undefined }, { note: sc.note }];
  for (const attempt of attempts) {
    const start = startState(id, attempt);
    if (!start) continue;
    const targets = attempt.targets ? attempt.targets.map(parseSquare) : autoTargets(start, id);
    if (!targets || targets.length !== SPELLS[id].steps.length) continue;
    const afterCast = apply(start, { type: 'CAST', spellId: id, targets });
    if (!afterCast) continue;
    const steps: DemoStep[] = [{ kind: 'cast', spell: id, targets }];
    let cur = afterCast;
    // a promotion the step left open is chosen right away (the strongest piece still allowed: the clearest picture)
    const promote = (): boolean => {
      if (!cur.pendingPromotion) return true;
      const piece = promotionChoices(cur, cur.pendingPromotion.color)[0];
      const next = piece ? apply(cur, { type: 'PROMOTE', piece }) : null;
      if (!next || !piece) return false;
      steps.push({ kind: 'promote', piece });
      cur = next;
      return true;
    };
    if (!promote()) continue;
    const avoid = new Set<Square>(targets);
    for (const f of attempt.follow ?? []) {
      if (cur.status.kind !== 'playing' || cur.pendingPromotion) break;
      if (typeof f === 'object' && 'cycle' in f) {
        const later = cycleLater(cur, id);
        if (!later) break;
        steps.push({ kind: 'cycle', decks: later.decks, to: later.to, note: f.cycle });
        cur = later.to;
        continue;
      }
      if (typeof f === 'object' && 'cast' in f) {
        const again = f.cast.map(parseSquare);
        const next = apply(cur, { type: 'CAST', spellId: id, targets: again });
        if (!next) break;
        steps.push({ kind: 'cast', spell: id, targets: again, note: f.note });
        cur = next;
        if (!promote()) break;
        continue;
      }
      let mv: { from: Square; to: Square } | null = null;
      if (f === 'enabled') {
        const before = new Set(legalMoves(start).map(key));
        const fresh = legalMoves(cur).filter((m) => !before.has(key(m)));
        const onTarget = fresh.filter((m) => targets.includes(m.from));
        const pool = onTarget.length ? onTarget : fresh;
        mv = pool.length ? pool.slice().sort((a, b) => Number(!!b.capture) - Number(!!a.capture) || centrality(a.to) - centrality(b.to))[0] : null;
      } else if (f === 'captureTarget') {
        mv = legalMoves(cur).find((m) => m.to === targets[0] || m.captureSquare === targets[0]) ?? null;
      } else if (f === 'quiet') {
        mv = quietMove(cur, avoid);
      } else {
        mv = { from: parseSquare(f.from), to: parseSquare(f.to) };
      }
      if (!mv) break;
      const next = apply(cur, { type: 'MOVE', from: mv.from, to: mv.to });
      if (!next) break;
      steps.push({ kind: 'move', from: mv.from, to: mv.to });
      cur = next;
      if (!promote()) break;
    }
    return { spell: id, start, steps, note: attempt.note ?? sc.note ?? '' };
  }
  return null;
}
