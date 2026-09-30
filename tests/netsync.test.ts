// The browser side of an online game (NetSync) against the server rooms (tests/fixtures/lobby.ts,
// copied from the backend by its `npm run sync`), with the network
// in the test's hands: events are delivered when the test says so, and sends can be held back
// or fail – so the races an online game meets (a resignation crossing a move, a lost answer,
// a missed event) can be played out exactly.
import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine';
import type { Action, Color, GameState, SpellId } from '../src/engine';
import type { OnlineSession } from '../src/net/client';
import { BUILD_ID, stateHash, type ActionRequest, type DrawAnswer, type NetEvent, type Ok, type RoomState, type Seat } from '../src/net/protocol';
import { Lobby } from './fixtures/lobby';
import type { LastMove } from '../src/ui/history';
import { gameFromRoom, NetSync, type NetStatus, type OnlineGame } from '../src/ui/netSync';
import { S } from './helpers';

const DECK: SpellId[] = ['manaMage', 'manaDeposit', 'gambit', 'sacrifice', 'overcharge', 'arcaneSurge'];
const mv = (from: string, to: string): Action => ({ type: 'MOVE', from: S(from), to: S(to) });
const tick = (ms = 5) => new Promise((ok) => setTimeout(ok, ms));

/** One player's network: an in-process stand-in for OnlineSession, talking to the lobby. */
class FakeNet {
  events: NetEvent[] = [];
  lastEvent: number;
  connection: 'online' = 'online';
  listeners = new Set<(e: NetEvent) => void>();
  /** Sends waiting to be let through (hold = true), or to fail once (failNext). */
  hold = false;
  held: (() => void)[] = [];
  failNext = 0;
  /** Drop these event ids instead of delivering them (a lost message). */
  drop = new Set<number>();
  /** Change an action event's hash on the way (a client out of step). */
  corrupt = new Set<number>();

  constructor(
    readonly lobby: Lobby,
    readonly seat: Seat,
    initial: RoomState,
  ) {
    this.lastEvent = initial.lastEvent;
  }
  readonly server = 'test';

  subscribe(fromId: number, fn: (e: NetEvent) => void): () => void {
    this.listeners.add(fn);
    this.events.filter((e) => e.id > fromId).forEach((e) => fn(e));
    return () => this.listeners.delete(fn);
  }
  onConnection(): () => void {
    return () => {};
  }
  /** Everything new from the server reaches the browser now. */
  deliver(): void {
    const r = this.lobby.events(this.seat.code, this.seat.token, this.lastEvent);
    if (!r.ok) throw new Error(r.error);
    for (const e of r.events) {
      this.lastEvent = e.id;
      if (this.drop.has(e.id)) continue;
      const got = this.corrupt.has(e.id) && e.type === 'action' ? { ...e, hash: 'deadbeef' } : e;
      this.events.push(got);
      this.listeners.forEach((fn) => fn(got));
    }
  }
  private send<T>(fn: () => Ok<T>): Promise<Ok<T>> {
    if (this.failNext > 0) {
      this.failNext -= 1;
      return Promise.reject(new Error('network'));
    }
    if (!this.hold) return Promise.resolve(fn());
    return new Promise((ok) => this.held.push(() => ok(fn())));
  }
  release(): void {
    const h = this.held;
    this.held = [];
    h.forEach((f) => f());
  }
  act(req: Omit<ActionRequest, 'token'>) {
    return this.send(() => this.lobby.act(this.seat.code, { ...req, token: this.seat.token }));
  }
  draw(answer: DrawAnswer) {
    return this.send(() => this.lobby.draw(this.seat.code, this.seat.token, answer));
  }
  rematch() {
    return this.send(() => this.lobby.rematch(this.seat.code, this.seat.token));
  }
  leave() {
    return this.send(() => this.lobby.leave(this.seat.code, this.seat.token));
  }
  state() {
    return this.send(() => this.lobby.state(this.seat.code, this.seat.token));
  }
}

/** A browser: the screen (what it shows) and its NetSync. */
function browser(net: FakeNet, rs: RoomState) {
  const g = gameFromRoom(net as unknown as OnlineSession, rs) as OnlineGame;
  if (typeof g === 'string') throw new Error(g);
  const screen = { state: g.state, lastMove: null as LastMove, shows: 0, rewinds: 0, jumps: 0, toasts: [] as string[], status: null as NetStatus | null, next: [] as OnlineGame[] };
  const sync = new NetSync(
    g,
    {
      show: (s, lm, step) => {
        screen.state = s;
        screen.lastMove = lm;
        screen.shows += 1;
        if (step?.rewind) screen.rewinds += 1;
        if (step?.jump) screen.jumps += 1;
      },
      current: () => screen.state,
      holdUntil: () => 0,
      toast: (t) => screen.toasts.push(t),
      status: (st) => (screen.status = st),
      nextGame: (next) => screen.next.push(next),
      sound: () => {},
    },
    { gap: 0, fastGap: 0, afterHold: 0, retry: 10, stuck: 30 },
  );
  sync.start();
  /** The player acts on screen (as useGame's dispatch does): applied at once, then sent. */
  const act = (a: Action) => {
    const r = applyLocal(screen.state, a);
    screen.state = r;
    sync.local(a);
  };
  return { g, sync, screen, act, me: g.me as Color };
}

function applyLocal(s: GameState, a: Action): GameState {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

function match() {
  const lobby = new Lobby();
  const h = lobby.create({ name: 'Anna', deck: DECK, deckName: 'A', color: 'w', autoEndTurn: true, build: BUILD_ID });
  if (!h.ok) throw new Error(h.error);
  const j = lobby.join(h.seat.code, { name: 'Bence', deck: DECK, deckName: 'B', build: BUILD_ID });
  if (!j.ok) throw new Error(j.error);
  const hs = lobby.state(h.seat.code, h.seat.token);
  if (!hs.ok) throw new Error(hs.error);
  const netW = new FakeNet(lobby, h.seat, hs.state);
  const netB = new FakeNet(lobby, j.seat, j.state);
  return { lobby, code: h.seat.code, netW, netB, white: browser(netW, hs.state), black: browser(netB, j.state) };
}

const server = (m: ReturnType<typeof match>) => {
  const r = m.lobby.state(m.code, m.netW.seat.token);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

describe('NetSync', () => {
  it('own steps show at once, reach the other side, and are confirmed without a second show', async () => {
    const m = match();
    m.white.act(mv('e2', 'e4'));
    expect(m.white.screen.status?.unconfirmed).toBe(1);
    await tick();
    expect(server(m).actions).toHaveLength(1);
    m.netB.deliver();
    await tick();
    expect(stateHash(m.black.screen.state)).toBe(stateHash(m.white.screen.state));
    expect(m.black.screen.lastMove).toEqual({ from: S('e2'), to: S('e4') });
    const shows = m.white.screen.shows;
    m.netW.deliver();
    await tick();
    expect(m.white.screen.shows).toBe(shows); // the echo is not shown again
    expect(m.white.screen.status?.unconfirmed).toBe(0);
  });

  it('several own steps go out in order (a cast, a move, then the end of the turn)', async () => {
    const lobby = new Lobby();
    const h = lobby.create({ name: 'A', deck: DECK, deckName: 'A', color: 'w', autoEndTurn: false, build: BUILD_ID });
    if (!h.ok) throw new Error(h.error);
    const j = lobby.join(h.seat.code, { name: 'B', deck: DECK, deckName: 'B', build: BUILD_ID });
    if (!j.ok) throw new Error(j.error);
    const hs = lobby.state(h.seat.code, h.seat.token);
    if (!hs.ok) throw new Error(hs.error);
    const netW = new FakeNet(lobby, h.seat, hs.state);
    const white = browser(netW, hs.state);
    netW.hold = true;
    white.act(mv('e2', 'e4'));
    white.act({ type: 'END_TURN' });
    expect(white.screen.status?.unconfirmed).toBe(2);
    netW.release();
    await tick();
    netW.release(); // the second send leaves only after the first was answered
    await tick();
    const st = lobby.state(h.seat.code, h.seat.token);
    expect(st.ok && st.state.actions.map((a) => a.type)).toEqual(['MOVE', 'END_TURN']);
    netW.deliver();
    await tick();
    expect(white.screen.status?.unconfirmed).toBe(0);
  });

  it('a resignation that crosses an own move wins: the move is taken back', async () => {
    const m = match();
    m.white.act(mv('e2', 'e4'));
    await tick();
    m.netB.deliver();
    await tick();
    m.black.act(mv('e7', 'e5'));
    await tick();
    m.netW.deliver();
    await tick();
    // white moves, but black resigns first on the server
    m.netW.hold = true;
    m.white.act(mv('g1', 'f3'));
    m.black.act({ type: 'RESIGN', color: 'b' });
    await tick();
    m.netW.release(); // too late: the game is over
    await tick();
    m.netW.deliver();
    await tick();
    expect(m.white.screen.rewinds).toBe(1);
    expect(m.white.screen.state.status).toEqual({ kind: 'resigned', winner: 'w' });
    expect(m.white.screen.state.board[S('g1')]?.type).toBe('N'); // the knight went back home
    expect(stateHash(m.white.screen.state)).toBe(stateHash(m.lobby.rooms.get(m.code)!.state!));
    expect(m.white.screen.toasts.join(' ')).toMatch(/előbb ért be/);
  });

  it('an own resignation still counts when the opponent moved just before it', async () => {
    const m = match();
    m.white.act(mv('e2', 'e4'));
    await tick();
    m.netB.deliver();
    await tick();
    // black moves; white has not seen it yet and resigns
    m.black.act(mv('e7', 'e5'));
    await tick();
    m.white.act({ type: 'RESIGN', color: 'w' });
    await tick();
    expect(server(m).actions.map((a) => a.type)).toEqual(['MOVE', 'MOVE', 'RESIGN']);
    m.netW.deliver();
    await tick(40);
    expect(m.white.screen.state.status).toEqual({ kind: 'resigned', winner: 'b' });
    expect(stateHash(m.white.screen.state)).toBe(stateHash(m.lobby.rooms.get(m.code)!.state!));
  });

  it('a send without an answer is repeated, and a repeat that already got through is recognised', async () => {
    const m = match();
    m.netW.failNext = 1;
    m.white.act(mv('e2', 'e4'));
    await tick(40); // retried after 10 ms
    expect(server(m).actions).toHaveLength(1);
    m.netW.deliver();
    await tick();
    expect(m.white.screen.status?.unconfirmed).toBe(0);
    expect(m.white.screen.rewinds).toBe(0);
  });

  it('a missed event or a position that hashes differently fetches the whole game again', async () => {
    const m = match();
    m.white.act(mv('e2', 'e4'));
    await tick();
    const first = m.lobby.rooms.get(m.code)!.nextEvent - 1;
    m.netB.drop.add(first);
    m.netB.deliver();
    await tick();
    m.white.act({ type: 'RESIGN', color: 'w' }); // any later step reveals the gap
    await tick();
    m.netB.deliver();
    await tick(20);
    expect(m.black.screen.jumps).toBe(1);
    expect(stateHash(m.black.screen.state)).toBe(stateHash(m.lobby.rooms.get(m.code)!.state!));

    const n = match();
    n.white.act(mv('d2', 'd4'));
    await tick();
    n.netB.corrupt.add(n.lobby.rooms.get(n.code)!.nextEvent - 1);
    n.netB.deliver();
    await tick(20);
    expect(n.black.screen.jumps).toBe(1);
    expect(stateHash(n.black.screen.state)).toBe(stateHash(n.lobby.rooms.get(n.code)!.state!));
  });

  it('draw offers, answers, and an offer withdrawn by the next step', async () => {
    const m = match();
    m.black.sync.offerDraw();
    await tick();
    m.netW.deliver();
    m.netB.deliver();
    expect(m.white.screen.status?.drawOffer).toBe('b');
    expect(m.black.screen.status?.drawOffer).toBe('b');
    m.white.sync.answerDraw(false);
    await tick();
    m.netB.deliver();
    expect(m.black.screen.status?.drawOffer).toBeNull();
    expect(m.black.screen.toasts.join(' ')).toMatch(/nem fogadta el/);

    m.black.sync.offerDraw();
    await tick();
    m.netW.deliver();
    m.white.act(mv('e2', 'e4')); // moving on instead of answering
    await tick();
    m.netW.deliver();
    expect(m.white.screen.status?.drawOffer).toBeNull();

    m.white.sync.offerDraw();
    await tick();
    m.netB.deliver();
    m.black.sync.answerDraw(true);
    await tick();
    m.netW.deliver();
    m.netB.deliver();
    await tick();
    expect(m.white.screen.state.status.kind).toBe('draw');
    expect(m.black.screen.state.status.kind).toBe('draw');
  });

  it('both asking for a rematch starts the next game once, colours swapped', async () => {
    const m = match();
    m.black.act({ type: 'RESIGN', color: 'b' });
    await tick();
    m.netW.deliver();
    await tick();
    m.white.sync.requestRematch();
    await tick();
    m.netB.deliver();
    expect(m.black.screen.status?.rematch).toEqual(['host']);
    m.black.sync.requestRematch();
    await tick();
    m.netW.deliver();
    m.netB.deliver();
    expect(m.white.screen.next).toHaveLength(1);
    expect(m.black.screen.next).toHaveLength(1);
    expect(m.white.screen.next[0]).toMatchObject({ game: 2, me: 'b', actions: [] });
    expect(m.black.screen.next[0]).toMatchObject({ game: 2, me: 'w' });
    // the stream says it again (a re-fetch): still one start
    m.white.sync.resync();
    await tick();
    expect(m.white.screen.next).toHaveLength(1);
  });
});
