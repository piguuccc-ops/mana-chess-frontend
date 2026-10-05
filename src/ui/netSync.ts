// ─────────────────────────────────────────────────────────────────────────────
// Keeps one online game in step with the server.
//
//  • Own steps appear at once and are sent in order; the server's stream confirms each one
//    (recognised by its nonce). If something else got there first (a resignation, an accepted
//    draw), the own steps are taken back and the server's version is shown.
//  • The opponent's steps are shown one at a time, paced so every animation – a cinematic spell
//    included – plays out before the next step lands.
//  • Anything unexpected (a gap, an illegal step, a position that hashes differently) fetches the
//    whole game again and replays it. The server is always right.
// ─────────────────────────────────────────────────────────────────────────────
import { applyAction, isValidDraft, opposite, type DeckDef } from '../engine';
import type { Action, Color, Draft, GameState } from '../engine';
import type { Connection, OnlineSession } from '../net/client';
import {
  colorOf, replay, setupGame, stateHash, type ForfeitReason, type NetEvent, type RatingChange, type Role, type RoomState, type Setup,
} from '../net/protocol';
import type { LastMove } from './history';

/** An online game as the screens hold it: the room's live session and the game it is playing. */
export interface OnlineGame {
  session: OnlineSession;
  code: string;
  role: Role;
  /** The game's number in the room (a rematch is the next one). */
  game: number;
  setup: Setup;
  me: Color;
  /** Steps already played (coming back into a running game) and the position after them. */
  actions: Action[];
  state: GameState;
  /** Events up to this id are already reflected above. */
  fromEvent: number;
  drawOffer: Color | null;
  rematch: Role[];
  opponentOnline: boolean;
  closed: string | null;
  /** A ranked (matchmade) game: both players' Élő-pontszám at its start, by colour. Null: friendly. */
  ranked: Record<Color, number> | null;
  /** A ranked game that has ended: the new ratings. */
  rated: Record<Color, RatingChange> | null;
  /** A ranked game lost on the clock or by being away. */
  forfeit: { by: Color; reason: ForfeitReason } | null;
  /** A ranked game: what was left of the current turn when the room was read (ms). */
  turnLeftMs: number | null;
}

/** A Spell-toborzás draft in an online room, as the draft screen holds it. */
export interface OnlineDraft {
  session: OnlineSession;
  code: string;
  role: Role;
  /** The number of the game this draft is for. */
  game: number;
  me: Color;
  names: Record<Color, string>;
  draft: Draft;
  /** Events up to this id are already reflected above. */
  fromEvent: number;
  opponentOnline: boolean;
}

/** The players' names by colour (a room keeps them by seat). */
export function namesByColor(names: RoomState['names'], hostColor: Color): Record<Color, string> {
  const host = names.host ?? '?';
  const guest = names.guest ?? '?';
  return hostColor === 'w' ? { w: host, b: guest } : { w: guest, b: host };
}

/** Ranked ratings by colour (a room keeps them by seat). */
export const ratingsByColor = (r: Record<Role, number>, hostColor: Color): Record<Color, number> =>
  hostColor === 'w' ? { w: r.host, b: r.guest } : { w: r.guest, b: r.host };

/** A room in its draft → the draft screen's data (or why it cannot be shown). */
export function draftFromRoom(session: OnlineSession, rs: RoomState): OnlineDraft | string {
  if (!rs.draft || !rs.hostColor) return 'Most nincs toborzás.';
  if (!isValidDraft(rs.draft)) return 'A toborzás adatai hibásak – frissítsd az oldalt.';
  return {
    session,
    code: rs.code,
    role: rs.role,
    game: rs.game,
    me: colorOf(rs.role, rs.hostColor),
    names: namesByColor(rs.names, rs.hostColor),
    draft: rs.draft,
    fromEvent: rs.lastEvent,
    opponentOnline: rs.online[other(rs.role)],
  };
}

/** A draft that has just begun (the second player sat down, or a rematch in a Spell-toborzás room). */
export function draftFromEvent(
  seat: { session: OnlineSession; code: string; role: Role },
  e: Extract<NetEvent, { type: 'draft' }>,
  opponentOnline = true,
): OnlineDraft {
  return { ...seat, game: e.game, me: colorOf(seat.role, e.hostColor), names: e.names, draft: e.draft, fromEvent: e.id, opponentOnline };
}

export interface NetStatus {
  /** This browser's link to the server. */
  connection: Connection;
  opponentOnline: boolean;
  /** An open draw offer, and who made it. */
  drawOffer: Color | null;
  /** Who has asked for a rematch after this game. */
  rematch: Role[];
  /** Why the room closed (the opponent left…), or null while it is open. */
  closed: string | null;
  /** Own steps the server has not confirmed yet. */
  unconfirmed: number;
  /** A ranked game is over: the new ratings. */
  rated: Record<Color, RatingChange> | null;
  /** A ranked game lost on the clock (or by being away). */
  forfeit: { by: Color; reason: ForfeitReason } | null;
}

export interface NetHooks {
  /** Put a position on the screen; `step` animates the way there (null: just show it). */
  show(state: GameState, lastMove: LastMove, step: { action: Action; before: GameState; rewind?: boolean; jump?: boolean } | null): void;
  /** The position on screen right now. */
  current(): GameState;
  /** Until when (performance.now) a cinematic is still playing. */
  holdUntil(): number;
  toast(text: string, tone?: 'error' | 'info'): void;
  status(s: NetStatus): void;
  /** A new game has begun in the room (a rematch). */
  nextGame(g: OnlineGame): void;
  /** A Spell-toborzás room: the rematch begins with a new draft. */
  nextDraft?(d: OnlineDraft): void;
  sound(name: 'open' | 'turn'): void;
}

export const other = (r: Role): Role => (r === 'host' ? 'guest' : 'host');

/** The highlighted last move after a list of steps (a spell keeps the previous one). */
export function lastMoveOf(actions: Action[]): LastMove {
  for (let i = actions.length - 1; i >= 0; i--) {
    const a = actions[i];
    if (a.type === 'MOVE') return { from: a.from, to: a.to };
  }
  return null;
}

/** The decks of an online game in the shape the game screen takes. */
export const decksOf = (s: Setup): Record<Color, DeckDef> => ({
  w: { id: 'online-w', name: s.deckNames.w, description: '', spells: s.decks.w },
  b: { id: 'online-b', name: s.deckNames.b, description: '', spells: s.decks.b },
});

/** A room seen by one player → the game to open (or why it cannot be opened). */
export function gameFromRoom(session: OnlineSession, rs: RoomState): OnlineGame | string {
  if (!rs.setup || !rs.hostColor || rs.game === 0) return 'A játszma még nem kezdődött el.';
  let state: GameState;
  try {
    state = replay(rs.setup, rs.actions);
  } catch (e) {
    return `A játszma nem tölthető be: ${(e as Error).message}`;
  }
  return {
    session,
    code: rs.code,
    role: rs.role,
    game: rs.game,
    setup: rs.setup,
    me: colorOf(rs.role, rs.hostColor),
    actions: [...rs.actions],
    state,
    fromEvent: rs.lastEvent,
    drawOffer: rs.drawOffer,
    rematch: [...rs.rematch],
    opponentOnline: rs.online[other(rs.role)],
    closed: rs.closed,
    ranked: rs.ranked ? ratingsByColor(rs.ranked, rs.hostColor) : null,
    rated: rs.rated ?? null,
    forfeit: rs.forfeit ?? null,
    turnLeftMs: rs.turnLeftMs ?? null,
  };
}

/** A game that has just begun (the second player sat down, or both asked for a rematch). */
export function gameFromStart(
  seat: { session: OnlineSession; code: string; role: Role },
  e: Extract<NetEvent, { type: 'start' }>,
  opponentOnline = true,
): OnlineGame {
  return {
    ...seat,
    game: e.game,
    setup: e.setup,
    me: colorOf(seat.role, e.hostColor),
    actions: [],
    state: setupGame(e.setup),
    fromEvent: e.id,
    drawOffer: null,
    rematch: [],
    opponentOnline,
    closed: null,
    // a new game in the same room: rooms with a rematch are friendly ones
    ranked: null,
    rated: null,
    forfeit: null,
    turnLeftMs: null,
  };
}

const newNonce = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/** Timing (ms): the gap between the opponent's steps (a short one when many are waiting), the
 *  pause after a cinematic, how soon a failed send is repeated, and when an unconfirmed step
 *  makes us fetch the whole game. */
export interface NetPace {
  gap: number;
  fastGap: number;
  afterHold: number;
  retry: number;
  stuck: number;
}
const PACE: NetPace = { gap: 650, fastGap: 160, afterHold: 120, retry: 1500, stuck: 4000 };
type Timer = ReturnType<typeof setTimeout>;

interface Pending {
  action: Action;
  nonce: string;
  sent: boolean;
  at: number;
}

interface Shown {
  action: Action;
  before: GameState;
  after: GameState;
  lastMove: LastMove;
}

export class NetSync {
  /** The server's game as far as this browser has heard. */
  private known: { n: number; state: GameState; lastMove: LastMove };
  private pending: Pending[] = [];
  /** The opponent's steps waiting for their turn on screen. */
  private queue: Shown[] = [];
  private st: NetStatus;
  private alive = false;
  private sending = false;
  private resyncing = false;
  private lastShown = 0;
  private lastEvent: number;
  private pumpTimer: Timer | undefined;
  private timers = new Set<Timer>();
  private readonly pace: NetPace;
  private offs: (() => void)[] = [];
  /** The game number whose start was already handed on. */
  private nextGame = 0;

  constructor(
    readonly g: OnlineGame,
    private readonly hooks: NetHooks,
    pace: Partial<NetPace> = {},
  ) {
    this.pace = { ...PACE, ...pace };
    this.known = { n: g.actions.length, state: g.state, lastMove: lastMoveOf(g.actions) };
    this.lastEvent = g.fromEvent;
    this.st = {
      connection: g.session.connection,
      opponentOnline: g.opponentOnline,
      drawOffer: g.drawOffer,
      rematch: [...g.rematch],
      closed: g.closed,
      unconfirmed: 0,
      rated: g.rated,
      forfeit: g.forfeit,
    };
  }

  get status(): NetStatus {
    return this.st;
  }

  get opponent(): string {
    return this.g.setup.names[opposite(this.g.me)];
  }

  start(): void {
    if (this.alive) return;
    this.alive = true;
    this.offs.push(this.g.session.subscribe(this.lastEvent, (e) => this.onEvent(e)));
    this.offs.push(this.g.session.onConnection((c) => this.set({ connection: c })));
    this.set({ connection: this.g.session.connection });
    if (this.pending.some((p) => !p.sent)) this.sendNext();
    if (this.queue.length) this.pump();
  }

  stop(): void {
    this.alive = false;
    this.offs.forEach((off) => off());
    this.offs = [];
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    clearTimeout(this.pumpTimer);
  }

  // ── own steps ──────────────────────────────────────────────────────────────

  /** An own step, already on screen: send it (after the ones before it). */
  local(action: Action): void {
    this.pending.push({ action, nonce: newNonce(), sent: false, at: Date.now() });
    this.lastShown = performance.now();
    this.set({ unconfirmed: this.pending.length });
    this.sendNext();
  }

  /** Shows the opponent's waiting steps at once (before an own resignation). */
  flush(): void {
    if (!this.queue.length) return;
    const last = this.queue[this.queue.length - 1];
    this.queue = [];
    clearTimeout(this.pumpTimer);
    this.hooks.show(last.after, last.lastMove, null);
  }

  offerDraw(): void {
    this.post(() => this.g.session.draw('offer'), 'Döntetlent ajánlottál – várjuk a választ.');
  }

  answerDraw(accept: boolean): void {
    this.set({ drawOffer: null });
    this.post(() => this.g.session.draw(accept ? 'accept' : 'decline'));
  }

  requestRematch(): void {
    if (this.st.rematch.includes(this.g.role)) return;
    this.set({ rematch: [...this.st.rematch, this.g.role] });
    this.post(() => this.g.session.rematch(), undefined, () => this.set({ rematch: this.st.rematch.filter((r) => r !== this.g.role) }));
  }

  private post(call: () => Promise<{ ok: boolean; error?: string }>, done?: string, undo?: () => void): void {
    call().then(
      (r) => {
        if (!this.alive) return;
        if (r.ok) {
          if (done) this.hooks.toast(done);
        } else {
          undo?.();
          this.hooks.toast(r.error ?? 'A szerver nem fogadta el.', 'error');
        }
      },
      () => {
        if (!this.alive) return;
        undo?.();
        this.hooks.toast('Nem érem el a szervert – próbáld újra.', 'error');
      },
    );
  }

  private sendNext(): void {
    if (!this.alive || this.sending) return;
    const i = this.pending.findIndex((p) => !p.sent);
    if (i < 0) return;
    const item = this.pending[i];
    item.sent = true;
    this.sending = true;
    // everything before it is already on the server, so its number is known
    const n = this.known.n + i;
    this.g.session.act({ game: this.g.game, n, action: item.action, nonce: item.nonce }).then(
      (r) => {
        this.sending = false;
        if (!this.alive) return;
        // confirmed (or dropped) by the stream meanwhile, or accepted: on to the next one
        if (r.ok || !this.pending.includes(item)) return this.sendNext();
        // the game moved on without it: the stream shows what came first
        if (r.stale) return this.later(() => this.checkStuck(), this.pace.stuck);
        this.hooks.toast(r.error, 'error');
        this.rollback();
        void this.resync();
      },
      () => {
        this.sending = false;
        if (!this.alive || !this.pending.includes(item)) return;
        // no answer: send it again – a repeat that already got through is recognised by its number
        item.sent = false;
        this.later(() => this.sendNext(), this.pace.retry);
      },
    );
  }

  /** Own steps the stream has still not confirmed: fetch the whole game. */
  private checkStuck(): void {
    if (this.pending.some((p) => p.sent && Date.now() - p.at >= this.pace.stuck - 500)) void this.resync();
  }

  /** Takes back the own steps not confirmed by the server. */
  private rollback(): void {
    const items = this.pending;
    this.pending = [];
    this.set({ unconfirmed: 0 });
    if (!items.length) return;
    this.hooks.show(this.known.state, this.known.lastMove, { action: items[items.length - 1].action, before: this.hooks.current(), rewind: true });
  }

  // ── the server's stream ─────────────────────────────────────────────────────

  private onEvent(e: NetEvent): void {
    if (!this.alive) return;
    this.lastEvent = Math.max(this.lastEvent, e.id);
    const g = this.g;
    switch (e.type) {
      case 'action':
        if (e.game === g.game) this.onAction(e);
        return;
      case 'drawOffer':
        if (e.game !== g.game) return;
        this.set({ drawOffer: e.by });
        if (e.by !== g.me) this.hooks.sound('open');
        return;
      case 'drawDeclined':
        if (e.game !== g.game) return;
        this.set({ drawOffer: null });
        if (e.by !== g.me) this.hooks.toast(`${this.opponent} nem fogadta el a döntetlent.`);
        return;
      case 'rematch':
        if (e.game !== g.game || this.st.rematch.includes(e.by)) return;
        this.set({ rematch: [...this.st.rematch, e.by] });
        if (e.by !== g.role) {
          this.hooks.toast(`${this.opponent} visszavágót kér.`);
          this.hooks.sound('open');
        }
        return;
      case 'presence':
        if (e.role === g.role || e.online === this.st.opponentOnline) return;
        this.set({ opponentOnline: e.online });
        // going away shows in the status line for as long as it lasts; coming back is news
        if (e.online) this.hooks.toast(`${this.opponent} visszatért.`);
        return;
      case 'left':
        if (e.role !== g.role) this.hooks.toast(`${e.name} kilépett a szobából.`, 'error');
        return;
      case 'closed':
        this.set({ closed: e.reason });
        return;
      case 'rated':
        if (e.game === g.game) this.set({ rated: e.changes });
        return;
      case 'forfeit': {
        if (e.game !== g.game) return;
        this.set({ forfeit: { by: e.by, reason: e.reason } });
        const mine = e.by === g.me;
        const text =
          e.reason === 'time'
            ? mine
              ? 'Lejárt a lépésidőd – elvesztetted a játszmát.'
              : `${this.opponent} lépésideje lejárt – nyertél!`
            : mine
              ? 'Túl sokáig nem volt kapcsolatod a szerverrel – elvesztetted a játszmát.'
              : `${this.opponent} túl sokáig nem tért vissza – nyertél!`;
        this.hooks.toast(text, mine ? 'error' : 'info');
        return;
      }
      case 'start':
        if (e.game <= g.game || e.game <= this.nextGame) return;
        this.nextGame = e.game;
        this.hooks.nextGame(gameFromStart({ session: g.session, code: g.code, role: g.role }, e, this.st.opponentOnline));
        return;
      case 'draft':
        if (e.game <= g.game || e.game <= this.nextGame) return;
        this.nextGame = e.game;
        this.hooks.nextDraft?.(draftFromEvent({ session: g.session, code: g.code, role: g.role }, e, this.st.opponentOnline));
        return;
      case 'pick':
        return;
    }
  }

  private onAction(e: Extract<NetEvent, { type: 'action' }>): void {
    const k = this.known;
    if (e.n < k.n) return; // already known
    if (e.n > k.n) return void this.resync(); // a gap
    const r = applyAction(k.state, e.action);
    if (!r.ok || stateHash(r.state) !== e.hash) return void this.resync(); // out of step
    const lastMove = e.action.type === 'MOVE' ? { from: e.action.from, to: e.action.to } : k.lastMove;
    const mine = this.pending[0];
    const own = !!mine && e.nonce === mine.nonce;
    if (!own && this.pending.length) {
      // something else got there first: the own steps are void and the screen goes back to the
      // server's game before this step (a resignation still reaches the server – it stands at
      // any point – and comes back in the stream by itself)
      if (this.pending.some((p) => p.action.type !== 'RESIGN')) this.hooks.toast('Az ellenfél lépése előbb ért be – a te lépésed elmaradt.', 'error');
      this.rollback();
    }
    this.known = { n: k.n + 1, state: r.state, lastMove };
    if (this.st.drawOffer) this.set({ drawOffer: null }); // any step withdraws an open offer
    if (own) {
      // an own step came back: it is already on screen
      this.pending.shift();
      this.set({ unconfirmed: this.pending.length });
      this.sendNext();
      return;
    }
    this.queue.push({ action: e.action, before: k.state, after: r.state, lastMove });
    this.pump();
  }

  /** Shows the next waiting step of the opponent when the previous one has played out. */
  private pump(): void {
    clearTimeout(this.pumpTimer);
    if (!this.alive || !this.queue.length) return;
    const now = performance.now();
    const gap = this.queue.length > 3 ? this.pace.fastGap : this.pace.gap;
    const readyAt = Math.max(this.hooks.holdUntil() + this.pace.afterHold, this.lastShown + gap);
    if (now < readyAt) {
      this.pumpTimer = setTimeout(() => this.pump(), readyAt - now);
      return;
    }
    const step = this.queue.shift()!;
    this.lastShown = now;
    this.hooks.show(step.after, step.lastMove, { action: step.action, before: step.before });
    // the next one checks again once this step's own timing (e.g. a cinematic) is known
    if (this.queue.length) this.pumpTimer = setTimeout(() => this.pump(), gap);
  }

  /** Fetches the whole game from the server and shows it (the server is always right). */
  async resync(): Promise<void> {
    if (this.resyncing || !this.alive) return;
    this.resyncing = true;
    try {
      for (let attempt = 0; this.alive && attempt < 8; attempt++) {
        let res: Awaited<ReturnType<OnlineSession['state']>>;
        try {
          res = await this.g.session.state();
        } catch {
          await new Promise<void>((ok) => this.later(ok, this.pace.retry));
          continue;
        }
        if (!this.alive) return;
        if (!res.ok) {
          this.set({ closed: this.st.closed ?? res.error });
          return;
        }
        const rs = res.state;
        // a new game has begun meanwhile: its start event takes over
        if (rs.game !== this.g.game || !rs.setup) return;
        let s: GameState;
        try {
          s = replay(rs.setup, rs.actions);
        } catch (err) {
          this.hooks.toast(`A játszma nem tölthető be: ${(err as Error).message}`, 'error');
          return;
        }
        const lastMove = lastMoveOf(rs.actions);
        this.known = { n: rs.actions.length, state: s, lastMove };
        this.pending = [];
        this.queue = [];
        clearTimeout(this.pumpTimer);
        const last = rs.actions[rs.actions.length - 1];
        this.hooks.show(s, lastMove, last ? { action: last, before: this.hooks.current(), rewind: true, jump: true } : null);
        this.lastShown = performance.now();
        this.set({
          unconfirmed: 0,
          drawOffer: rs.drawOffer,
          rematch: [...rs.rematch],
          closed: rs.closed,
          opponentOnline: rs.online[other(this.g.role)],
          rated: rs.rated ?? this.st.rated,
          forfeit: rs.forfeit ?? this.st.forfeit,
        });
        // events that arrived while the answer was on its way
        this.g.session.events.filter((e) => e.id > rs.lastEvent).forEach((e) => this.onEvent(e));
        return;
      }
    } finally {
      this.resyncing = false;
    }
  }

  private set(p: Partial<NetStatus>): void {
    this.st = { ...this.st, ...p };
    if (this.alive) this.hooks.status(this.st);
  }

  private later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }
}
