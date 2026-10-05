// The playing half of the online lobby: the deck to take along, opening a room and waiting in it,
// the open rooms, games to continue, and the challenges friends sent.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { DeckDef } from '../../../engine';
import {
  createRoom, forgetSeat, joinRoom, listRooms, NetError, OnlineSession, rememberSeat, roomState, savedSeats, type SavedSeat,
} from '../../../net/client';
import { BUILD_ID, type ChallengeView, type RoomState, type RoomSummary, type Seat, type ServerInfo } from '../../../net/protocol';
import { sfx } from '../../audio/sound';
import { draftFromEvent, draftFromRoom, gameFromRoom, gameFromStart, other, type OnlineDraft, type OnlineGame } from '../../netSync';
import type { AccountState } from '../../online/useOnline';
import { resolveDeck, type Prefs } from '../../storage';
import { DeckCarousel } from '../DeckCarousel';
import { DeckModeChoices } from '../DeckModeChoices';
import { Icon } from '../pixel';
import { COLOR_WORD, ColorChoices, theirColor, TurnChoices, UpdateAppButton } from './parts';

const message = (e: unknown) => (e instanceof NetError ? e.message : 'Váratlan hiba történt.');
const ago = (s: number) => (s < 60 ? 'most nyílt' : s < 3600 ? `${Math.floor(s / 60)} perce vár` : `${Math.floor(s / 3600)} órája vár`);

/** A seat this player can go back to. */
interface Resumable {
  code: string;
  token: string;
  role: Seat['role'];
  opponent: string | null;
  waiting: boolean;
  ranked?: boolean;
}

/** Re-render every `ms` (count-downs). */
export function useTick(ms: number): number {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setT(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return t;
}

/** Seconds left of a challenge, measured on this device's clock from when we first saw it. */
export function useChallengeClock() {
  const seen = useRef(new Map<string, number>());
  useTick(1000);
  return (c: ChallengeView) => {
    if (!seen.current.has(c.id)) seen.current.set(c.id, Date.now());
    const life = c.expiresAt - c.createdAt;
    const elapsed = Math.max(0, Date.now() - seen.current.get(c.id)!);
    return Math.max(0, Math.min(Math.round(life / 1000), Math.ceil((life - elapsed) / 1000)));
  };
}
export const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

interface Props {
  origin: string;
  info: ServerInfo;
  /** null: playing as a guest. */
  account: AccountState | null;
  guestName: string;
  decks: DeckDef[];
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
  onGame: (g: OnlineGame) => void;
  /** A Spell-toborzás room's draft has begun. */
  onDraft: (d: OnlineDraft) => void;
  refresh: () => Promise<void>;
}

export function PlayPanel({ origin, info, account, guestName, decks, prefs, onPrefs, onGame, onDraft, refresh }: Props) {
  const onGameRef = useRef(onGame);
  onGameRef.current = onGame;
  const onDraftRef = useRef(onDraft);
  onDraftRef.current = onDraft;
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  const [seats, setSeats] = useState<SavedSeat[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setErrorState] = useState<{ text: string; at: 'setup' | 'rooms' } | null>(null);
  const setError = (text: string | null, at: 'setup' | 'rooms' = 'rooms') => setErrorState(text ? { text, at } : null);
  const [code, setCode] = useState('');
  const [waiting, setWaiting] = useState<{ session: OnlineSession; state: RoomState } | null>(null);
  const waitingRef = useRef(waiting);
  waitingRef.current = waiting;
  const handedOver = useRef(false);
  const secondsLeft = useChallengeClock();
  const versionClash = info.build !== BUILD_ID && info.build !== 'dev' && BUILD_ID !== 'dev';
  const auth = account?.token;

  const closeWaiting = useCallback(() => {
    const w = waitingRef.current;
    if (!w) return;
    waitingRef.current = null;
    setWaiting(null);
    forgetSeat(w.session.server, w.state.code);
    void w.session.leave().catch(() => undefined).finally(() => w.session.stop());
  }, []);

  const handOver = useCallback(
    (g: OnlineGame) => {
      // a room of ours still waiting for someone else closes: we are playing elsewhere now
      if (waitingRef.current && waitingRef.current.state.code !== g.code) closeWaiting();
      handedOver.current = true;
      rememberSeat({ server: g.session.server, ...g.session.seat, opponent: g.setup.names[g.me === 'w' ? 'b' : 'w'], at: Date.now() });
      onGameRef.current(g);
    },
    [closeWaiting],
  );

  const handOverDraft = useCallback(
    (d: OnlineDraft) => {
      if (waitingRef.current && waitingRef.current.state.code !== d.code) closeWaiting();
      handedOver.current = true;
      rememberSeat({ server: d.session.server, ...d.session.seat, opponent: d.names[d.me === 'w' ? 'b' : 'w'], at: Date.now() });
      onDraftRef.current(d);
    },
    [closeWaiting],
  );

  // the open rooms, refreshed while on screen
  const loadRooms = useCallback(async () => {
    try {
      const r = await listRooms(origin);
      if (r.ok) setRooms(r.rooms);
    } catch {
      setRooms(null);
    }
  }, [origin]);
  useEffect(() => {
    if (waiting) return;
    void loadRooms();
    const t = window.setInterval(() => void loadRooms(), 3000);
    return () => window.clearInterval(t);
  }, [waiting, loadRooms]);

  // a guest's games live in this browser (an account's come from the server)
  useEffect(() => {
    if (account) return;
    let cancelled = false;
    void (async () => {
      const alive: SavedSeat[] = [];
      for (const s of savedSeats(origin)) {
        try {
          const r = await roomState(origin, s);
          if (r.ok && !r.state.closed) alive.push({ ...s, opponent: r.state.names[other(s.role)] ?? s.opponent });
          else forgetSeat(origin, s.code);
        } catch {
          // unreachable right now: keep it for later
        }
      }
      if (!cancelled) setSeats(alive);
    })();
    return () => {
      cancelled = true;
    };
  }, [origin, account]);

  // our own room: wait for the second player
  useEffect(() => {
    if (!waiting) return;
    const { session, state } = waiting;
    return session.subscribe(state.lastEvent, (e) => {
      if (handedOver.current) return;
      if (e.type === 'start') {
        sfx('open');
        handOver(gameFromStart({ session, code: state.code, role: state.role }, e));
      } else if (e.type === 'draft') {
        sfx('open');
        handOverDraft(draftFromEvent({ session, code: state.code, role: state.role }, e));
      } else if (e.type === 'closed') {
        session.stop();
        forgetSeat(session.server, state.code);
        setWaiting(null);
        setError(e.reason, 'setup');
      }
    });
  }, [waiting, handOver, handOverDraft]);

  // leaving the lobby while waiting closes the room
  useEffect(
    () => () => {
      if (!handedOver.current) closeWaiting();
    },
    [closeWaiting],
  );

  const myDeck = () => resolveDeck(decks, prefs.onlineDeckId);
  const myName = () => (account ? account.me.user.name : guestName.trim());

  const run = async (key: string, job: () => Promise<void>, at: 'setup' | 'rooms' = 'rooms') => {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      await job();
    } catch (e) {
      setError(message(e), at);
    } finally {
      setBusy(null);
    }
  };

  const open = (seat: Seat, state: RoomState, at: 'setup' | 'rooms' = 'rooms') => {
    const session = new OnlineSession(origin, seat, state);
    session.start();
    if (state.game === 0) {
      rememberSeat({ server: origin, ...seat, opponent: null, at: Date.now() });
      sfx('open');
      setWaiting({ session, state });
      return;
    }
    if (state.draft) {
      const d = draftFromRoom(session, state);
      if (typeof d === 'string') {
        session.stop();
        setError(d, at);
        return;
      }
      handOverDraft(d);
      return;
    }
    const g = gameFromRoom(session, state);
    if (typeof g === 'string') {
      session.stop();
      setError(g, at);
      return;
    }
    handOver(g);
  };

  const create = () =>
    run('create', async () => {
      const deck = myDeck();
      const r = await createRoom(origin, { name: myName(), deck: deck.spells, deckName: deck.name, color: prefs.onlineColor, autoEndTurn: prefs.autoEndTurn, draft: prefs.onlineDraft, auth });
      if (!r.ok) return setError(r.error, 'setup');
      open(r.seat, r.state, 'setup');
      void refresh();
    }, 'setup');

  const join = (roomCode: string) => {
    const c = roomCode.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(c)) return setError('A szobakód 4 betű, például KXRT.');
    return run(`join:${c}`, async () => {
      const deck = myDeck();
      const r = await joinRoom(origin, c, { name: myName(), deck: deck.spells, deckName: deck.name, auth });
      if (!r.ok) {
        setError(r.error);
        void loadRooms();
        return;
      }
      open(r.seat, r.state);
    });
  };

  const resume = (s: Resumable) =>
    run(`resume:${s.code}`, async () => {
      const r = await roomState(origin, s);
      if (!r.ok || r.state.closed) {
        forgetSeat(origin, s.code);
        setSeats((all) => all.filter((x) => x.code !== s.code));
        void refresh();
        return setError(r.ok ? 'Ez a szoba már bezárult.' : r.error);
      }
      open({ code: s.code, token: s.token, role: s.role }, r.state);
    });

  const accept = (c: ChallengeView) =>
    run(`challenge:${c.id}`, async () => {
      if (!account) return;
      const deck = myDeck();
      const r = await account.api.acceptChallenge(c.id, deck.spells, deck.name);
      if (!r.ok) {
        setError(r.error);
        void refresh();
        return;
      }
      sfx('open');
      open(r.seat, r.state);
    });

  const decline = (c: ChallengeView) =>
    run(`decline:${c.id}`, async () => {
      if (!account) return;
      const r = await account.api.declineChallenge(c.id);
      if (!r.ok) setError(r.error);
      void refresh();
    });

  // what can be continued: an account's rooms on the server, a guest's in this browser
  const resumable: Resumable[] = (
    account
      ? account.me.games.map((g) => ({ code: g.code, token: g.token, role: g.role, opponent: g.opponent, waiting: g.game === 0, ranked: g.ranked }))
      : seats.map((s) => ({ code: s.code, token: s.token, role: s.role, opponent: s.opponent, waiting: !s.opponent }))
  ).filter((s) => s.code !== waiting?.state.code);
  const openRooms = (rooms ?? []).filter((r) => r.code !== waiting?.state.code && !resumable.some((s) => s.code === r.code));
  const challenges = account?.me.challengesIn ?? [];
  const deckSide = prefs.onlineColor === 'random' ? 'any' : prefs.onlineColor;

  const errorBox = (at: 'setup' | 'rooms') =>
    error?.at === at && (
      <p className="msg msg-error" role="alert">
        {error.text}
      </p>
    );

  const setupCard = (
    <section className="online-card play-setup frame-parchment" aria-labelledby="setup-title">
      <h2 className="online-card-title" id="setup-title">
        <Icon name="swords" scale={2} /> {waiting ? 'A szobád' : 'Új játszma'}
      </h2>
      {versionClash && (
        <p className="msg msg-error" role="alert">
          Ez a szerver a játék egy másik változatát futtatja ({info.build}, a tiéd: {BUILD_ID}), ezért nem enged játszani. Használd a
          szerverhez tartozó játékoldalt (mana-chess.html), vagy frissítsd az alkalmazást.
          <UpdateAppButton />
        </p>
      )}
      {waiting ? (
        <div className="online-wait" aria-live="polite">
          <span className="field-label">A szobád kódja</span>
          <div className="room-code" aria-label={`Szobakód: ${waiting.state.code.split('').join(' ')}`}>
            {waiting.state.code.split('').map((ch, i) => (
              <span key={i}>{ch}</span>
            ))}
          </div>
          <p className="online-wait-text">
            <Icon name="hourglass" scale={1} /> Várakozás az ellenfélre…
          </p>
          <p className="hint">
            A szoba ott van a <b>Nyitott szobák</b> listájában ezen a szerveren; a barátod a kóddal is beléphet.
          </p>
          <p className="hint">
            Színed: {COLOR_WORD[prefs.onlineColor]} · Kör vége: {prefs.autoEndTurn ? 'automatikus' : 'kézi'} · Pakli:{' '}
            {waiting.state.draftMode ? 'spell-toborzás' : myDeckName(decks, prefs.onlineDeckId)}
          </p>
          <button type="button" className="btn btn-dark" id="close-room" onClick={() => { sfx('back'); closeWaiting(); }}>
            <Icon name="close" scale={1} /> Szoba bezárása
          </button>
        </div>
      ) : (
        <>
          <span className="field-label">Paklik</span>
          <DeckModeChoices draft={prefs.onlineDraft} onChange={(d) => onPrefs({ ...prefs, onlineDraft: d })} />
          {prefs.onlineDraft ? (
            <p className="hint">
              Spell-toborzás: amikor az ellenfél belép, 32 véletlen spell kerül az asztalra, és felváltva választotok, amíg mindkettőtöknek 6
              lesz. Világos kezd.
            </p>
          ) : (
            <DeckCarousel side={deckSide} label={account ? 'A paklid (fiók)' : 'A paklid (böngésző)'} value={prefs.onlineDeckId} decks={decks} onChange={(id) => onPrefs({ ...prefs, onlineDeckId: id })} />
          )}
          <span className="field-label">A színed</span>
          <ColorChoices value={prefs.onlineColor} onChange={(c) => onPrefs({ ...prefs, onlineColor: c })} />
          <span className="field-label">Kör vége</span>
          <TurnChoices auto={prefs.autoEndTurn} onChange={(a) => onPrefs({ ...prefs, autoEndTurn: a })} />
          <button id="create-room" type="button" className="btn btn-primary btn-big online-submit" disabled={!!busy || versionClash} onClick={() => void create()}>
            <Icon name="plus" scale={2} /> {busy === 'create' ? 'Nyitás…' : 'Szoba nyitása'}
          </button>
          <p className="hint">A szoba megjelenik a Nyitott szobák között; aki belép, az ellenfeled lesz. A barátaidat a Barátok résznél közvetlenül is kihívhatod.</p>
        </>
      )}
      {errorBox('setup')}
    </section>
  );

  const roomsCard = (
    <section className="online-card play-rooms frame-parchment" aria-labelledby="rooms-title">
      <h2 className="online-card-title" id="rooms-title">
        <Icon name="duel" scale={2} /> Játszmák
      </h2>
      {errorBox('rooms')}
      {challenges.length > 0 && (
        <>
          <h3 className="section-title">
            Kihívások <span className="tab-count">{challenges.length}</span>
          </h3>
          <ul className="room-list">
            {challenges.map((c) => {
              const left = secondsLeft(c);
              return (
                <li key={c.id} className="room-item is-challenge">
                  <Icon name="duel" scale={2} />
                  <span className="room-item-text">
                    <b>{c.from.name} kihív</b>
                    <small>
                      Te: {COLOR_WORD[theirColor(c.color)]} · kör vége: {c.autoEndTurn ? 'automatikus' : 'kézi'}
                      {c.draft ? ' · spell-toborzás' : ''} · még {clock(left)}
                    </small>
                  </span>
                  <span className="room-item-actions">
                    <button type="button" className="btn btn-sm btn-primary" disabled={!!busy || versionClash || left === 0} onClick={() => void accept(c)}>
                      {busy === `challenge:${c.id}` ? '…' : 'Elfogadás'}
                    </button>
                    <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => void decline(c)}>
                      Elutasítás
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="hint">
            Elfogadáskor a pakliválasztóban beállított pakliddal játszol (spell-toborzásnál a paklik a játszma elején készülnek).
          </p>
        </>
      )}
      {resumable.length > 0 && (
        <>
          <h3 className="section-title">Folytatás</h3>
          <ul className="room-list">
            {resumable.map((s) => (
              <li key={s.code} className="room-item is-mine">
                <span className="room-item-code">{s.code}</span>
                <span className="room-item-text">
                  <b>{s.waiting ? 'A szobád (várakozik)' : `${s.ranked ? 'Rangsorolt játszma' : 'Játszma'} ${s.opponent ?? '?'} ellen`}</b>
                  <small>{s.waiting ? 'Még nem lépett be senki.' : 'Innen folytathatod, ahol abbahagytad.'}</small>
                </span>
                <button type="button" className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => void resume(s)}>
                  {busy === `resume:${s.code}` ? '…' : 'Folytatás'}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <h3 className="section-title">Nyitott szobák</h3>
      {rooms === null ? (
        <p className="hint">Szobák betöltése…</p>
      ) : openRooms.length === 0 ? (
        <p className="hint">Most nincs nyitott szoba. Nyiss egyet, vagy írd be a barátod szobakódját.</p>
      ) : (
        <ul className="room-list" aria-label="Nyitott szobák">
          {openRooms.map((r) => (
            <li key={r.code} className="room-item">
              <span className="room-item-code">{r.code}</span>
              <span className="room-item-text">
                <b>
                  {r.host}
                  {r.guest && <span className="guest-tag">vendég</span>}
                  {r.draft && <span className="guest-tag draft-tag">toborzás</span>}
                </b>
                <small>
                  Te: {COLOR_WORD[theirColor(r.hostColor)]} · kör vége: {r.autoEndTurn ? 'automatikus' : 'kézi'} · {ago(r.age)}
                </small>
              </span>
              <button type="button" className="btn btn-sm btn-primary" disabled={!!busy || versionClash} onClick={() => void join(r.code)}>
                {busy === `join:${r.code}` ? '…' : 'Belépés'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="online-row online-code"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void join(code);
        }}
      >
        <label className="field">
          <Icon name="lock" scale={1} />
          <input
            id="room-code"
            value={code}
            maxLength={4}
            placeholder="Szobakód"
            aria-label="Szobakód"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          />
        </label>
        <button type="submit" className="btn" id="join-code" disabled={!!busy || code.length !== 4 || versionClash}>
          Belépés kóddal
        </button>
      </form>
    </section>
  );

  return (
    <div className="play-col">
      {setupCard}
      {roomsCard}
    </div>
  );
}

function myDeckName(decks: DeckDef[], id: string): string {
  return id === 'random' ? 'véletlen' : decks.find((d) => d.id === id)?.name ?? 'véletlen';
}
