// Ranked play: the player's Élő-pontszám, looking for an opponent (skill-based matchmaking on the
// server – the closest rating first, the range widening while you wait) and the server's
// leaderboard. Only these games change the rating: friends, rooms and the bots never do.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeckDef } from '../../../engine';
import { NetError, OnlineSession, rememberSeat, roomState } from '../../../net/client';
import { BUILD_ID, PROVISIONAL_GAMES, RANKED_TURN_MS, RATING_START, type LeaderRow, type MyGame, type QueueView, type ServerInfo } from '../../../net/protocol';
import { sfx } from '../../audio/sound';
import { gameFromRoom, type OnlineGame } from '../../netSync';
import type { AccountState } from '../../online/useOnline';
import { resolveDeck, type Prefs } from '../../storage';
import { EloBadge } from '../BotPortrait';
import { DeckCarousel } from '../DeckCarousel';
import { Icon } from '../pixel';
import { UpdateAppButton } from './parts';
import { clock, useTick } from './PlayPanel';

const message = (e: unknown) => (e instanceof NetError ? e.message : 'Váratlan hiba történt.');
/** How often a searching page asks about the queue (the server drops a page silent for 15 s). */
const STATUS_EVERY_MS = 2500;

interface Props {
  origin: string;
  info: ServerInfo;
  account: AccountState | null;
  decks: DeckDef[];
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
  onGame: (g: OnlineGame) => void;
  /** A guest: to the sign-in step. */
  onSignIn: () => void;
  /** Hidden behind another tab (it keeps searching meanwhile). */
  hidden: boolean;
  /** Searching started / stopped (the tab shows it). */
  onSearching: (on: boolean) => void;
  /** Start looking for an opponent at once (the game-over screen's „Új ellenfél”). */
  autoSearch?: boolean;
}

export function RankedPanel({ origin, info, account, decks, prefs, onPrefs, onGame, onSignIn, hidden, onSearching, autoSearch = false }: Props) {
  const [queue, setQueue] = useState<{ view: QueueView; at: number } | null>(null);
  const [found, setFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [board, setBoard] = useState<{ rows: LeaderRow[]; me: LeaderRow | null; players: number } | null>(null);
  const searching = !!queue || found;
  const searchingRef = useRef(searching);
  searchingRef.current = searching;
  const api = account?.api ?? null;
  const apiRef = useRef(api);
  apiRef.current = api;
  const versionClash = info.build !== BUILD_ID && info.build !== 'dev' && BUILD_ID !== 'dev';
  useTick(searching ? 1000 : 60_000);

  useEffect(() => onSearching(searching), [searching, onSearching]);

  // leaving the online screen (or signing out) ends the search
  useEffect(
    () => () => {
      if (searchingRef.current) void apiRef.current?.rankedLeave().catch(() => undefined);
    },
    [],
  );

  const me = account?.me.user ?? null;
  const games = me ? me.ranked.w + me.ranked.l + me.ranked.d : 0;

  // the leaderboard: on opening, after every ranked game, and now and then
  const loadBoard = useCallback(async () => {
    const a = apiRef.current;
    if (!a) return;
    try {
      const r = await a.leaderboard();
      if (r.ok) setBoard({ rows: r.rows, me: r.me, players: r.players });
    } catch {
      /* the next try */
    }
  }, []);
  useEffect(() => {
    void loadBoard();
    const t = window.setInterval(() => void loadBoard(), 30_000);
    return () => window.clearInterval(t);
  }, [loadBoard, games, me?.rating]);

  // while searching: keep the place in the queue, and notice when an opponent was found
  useEffect(() => {
    if (!queue || !api) return;
    let alive = true;
    const t = window.setInterval(async () => {
      try {
        const r = await api.rankedStatus();
        if (!alive) return;
        if (!r.ok) {
          setQueue(null);
          setError(r.error);
          return;
        }
        if (r.queue) setQueue({ view: r.queue, at: Date.now() });
        else {
          // out of the queue: an opponent was found – the game arrives on the account's stream
          setQueue(null);
          setFound(true);
        }
      } catch {
        /* a missed answer: the next one */
      }
    }, STATUS_EVERY_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [queue !== null, api]); // eslint-disable-line react-hooks/exhaustive-deps

  // found, but no game came: it is in the list of running games – open it from there
  const running = account?.me.games.find((g) => g.ranked && g.running) ?? null;
  const resume = useCallback(
    async (g: MyGame) => {
      setBusy(true);
      setError(null);
      try {
        const r = await roomState(origin, g);
        if (!r.ok || r.state.closed) return setError(r.ok ? 'Ez a játszma már véget ért.' : r.error);
        const session = new OnlineSession(origin, { code: g.code, token: g.token, role: g.role }, r.state);
        const og = gameFromRoom(session, r.state);
        if (typeof og === 'string') return setError(og);
        session.start();
        rememberSeat({ server: origin, code: g.code, token: g.token, role: g.role, opponent: g.opponent, at: Date.now() });
        onGame(og);
      } catch (e) {
        setError(message(e));
      } finally {
        setBusy(false);
      }
    },
    [origin, onGame],
  );
  useEffect(() => {
    if (!found) return;
    const t = window.setTimeout(() => {
      setFound(false);
      if (running) void resume(running);
    }, 6000);
    return () => window.clearTimeout(t);
  }, [found, running, resume]);

  const search = async () => {
    if (!api || busy) return;
    setBusy(true);
    setError(null);
    try {
      const deck = resolveDeck(decks, prefs.onlineDeckId);
      const r = await api.rankedJoin(deck.spells, deck.name);
      if (!r.ok) return setError(r.error);
      sfx('open');
      if (r.queue) setQueue({ view: r.queue, at: Date.now() });
      else setFound(true);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  // „Új ellenfél” after a ranked game: straight back into the queue
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoSearch || autoStarted.current || !api || running) return;
    autoStarted.current = true;
    void search();
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = async () => {
    sfx('back');
    setQueue(null);
    setFound(false);
    try {
      await api?.rankedLeave();
    } catch {
      /* the server drops a silent page by itself */
    }
  };

  if (!account || !me) {
    return (
      <div className={`ranked-col ${hidden ? 'is-hidden' : ''}`}>
        <section className="online-card ranked-card frame-parchment" aria-labelledby="ranked-title">
          <h2 className="online-card-title" id="ranked-title">
            <Icon name="trophy" scale={2} /> Rangsorolt játék
          </h2>
          <p className="online-lead">
            A rangsorolt játszmákban a szerver hozzád hasonló erősségű ellenfelet keres, és az eredmény alapján változik az{' '}
            <b>Élő-pontszámod</b>. Ehhez fiók kell – vendégként csak barátságos játszmát játszhatsz.
          </p>
          <button type="button" id="ranked-signin" className="btn btn-primary btn-big" onClick={onSignIn}>
            <Icon name="user" scale={2} /> Bejelentkezés
          </button>
        </section>
      </div>
    );
  }

  const v = queue?.view;
  const waited = v ? v.waited + Math.floor((Date.now() - queue!.at) / 1000) : 0;
  const deck = resolveDeck(decks, prefs.onlineDeckId);
  const provisional = games < PROVISIONAL_GAMES;

  return (
    <div className={`ranked-col ${hidden ? 'is-hidden' : ''}`}>
      <section className="online-card ranked-card frame-parchment" aria-labelledby="ranked-title">
        <h2 className="online-card-title" id="ranked-title">
          <Icon name="trophy" scale={2} /> Rangsorolt játék
        </h2>
        <div className="ranked-me">
          <span className="ranked-rating" title="Élő-pontszám">
            <small>Élő</small>
            <b>{me.rating}</b>
          </span>
          <span className="ranked-me-text">
            <b>{me.name}</b>
            <small>{games ? `${me.ranked.w} győzelem · ${me.ranked.l} vereség · ${me.ranked.d} döntetlen` : 'Még nincs rangsorolt játszmád.'}</small>
            <small>{me.rank ? `${me.rank}. hely a szerveren` : 'Az első játszma után felkerülsz a ranglistára.'}</small>
            {provisional && <small>Ideiglenes pontszám: még {PROVISIONAL_GAMES - games} játszmán át gyorsabban változik.</small>}
          </span>
        </div>

        {versionClash && (
          <p className="msg msg-error" role="alert">
            Ez a szerver a játék egy másik változatát futtatja ({info.build}, a tiéd: {BUILD_ID}), ezért nem enged játszani.
            <UpdateAppButton />
          </p>
        )}

        {running && !searching ? (
          <div className="ranked-running">
            <p className="hint">
              <Icon name="swords" scale={1} /> Futó rangsorolt játszmád van{running.opponent ? ` ${running.opponent} ellen` : ''} – amíg tart, nem kereshetsz újat.
            </p>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void resume(running)}>
              <Icon name="swords" scale={1} /> Folytatás
            </button>
          </div>
        ) : searching ? (
          <div className="ranked-search" aria-live="polite">
            <div className="ranked-radar" aria-hidden="true">
              <span className="ranked-radar-arm" />
              <span className="ranked-radar-blip b1" />
              <span className="ranked-radar-blip b2" />
              <span className="ranked-radar-blip b3" />
            </div>
            <p className="ranked-search-title">{found ? 'Megvan az ellenfél!' : 'Ellenfelet keresünk…'}</p>
            {!found && v && (
              <>
                <p className="ranked-search-clock">{clock(waited)}</p>
                <dl className="ranked-facts">
                  <dt>Keresési tartomány</dt>
                  <dd>{v.range === null ? 'bárki (már egy perce vársz)' : `±${v.range} (${Math.max(0, me.rating - v.range)}–${me.rating + v.range})`}</dd>
                  <dt>Most keres</dt>
                  <dd>{v.searching} játékos</dd>
                  <dt>Pakli</dt>
                  <dd>{deck.name}</dd>
                </dl>
              </>
            )}
            {found ? (
              <p className="hint">Indul a játszma…</p>
            ) : (
              <button type="button" id="ranked-cancel" className="btn btn-dark" onClick={() => void cancel()}>
                <Icon name="close" scale={1} /> Mégse
              </button>
            )}
          </div>
        ) : (
          <>
            <DeckCarousel side="any" label="A paklid" value={prefs.onlineDeckId} decks={decks} onChange={(id) => onPrefs({ ...prefs, onlineDeckId: id })} />
            <ul className="ranked-rules">
              <li>
                <Icon name="dice" scale={1} /> Saját paklik, véletlen szín, automatikus kör vége.
              </li>
              <li>
                <Icon name="hourglass" scale={1} /> Egy körre {Math.round(RANKED_TURN_MS / 60_000)} perc jut – ha lejár, a játszma elveszett.
              </li>
              <li>
                <Icon name="flag" scale={1} /> A kilépés, és ha egy percnél tovább nincs kapcsolatod, vereségnek számít.
              </li>
              <li>
                <Icon name="scales" scale={1} /> A pontszámot csak a rangsorolt játszmák változtatják – a barátságosak és a botok elleniek nem.
              </li>
            </ul>
            <button type="button" id="ranked-search" className="btn btn-primary btn-big online-submit" disabled={busy || versionClash} onClick={() => void search()}>
              <Icon name="swords" scale={2} /> {busy ? 'Pillanat…' : 'Ellenfél keresése'}
            </button>
          </>
        )}
        {error && (
          <p className="msg msg-error" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="online-card ranked-board frame-parchment" aria-labelledby="board-title">
        <h2 className="online-card-title" id="board-title">
          <Icon name="crown" scale={2} /> Ranglista
        </h2>
        {!board ? (
          <p className="hint">Betöltés…</p>
        ) : board.players === 0 ? (
          <p className="hint">Ezen a szerveren még senki nem játszott rangsorolt játszmát. Légy te az első!</p>
        ) : (
          <>
            <ol className="leader-list" aria-label="Ranglista">
              {board.rows.map((r) => (
                <LeaderItem key={r.name} row={r} />
              ))}
            </ol>
            {board.me && !board.rows.some((r) => r.me) && (
              <ol className="leader-list leader-list-me" aria-label="A helyezésed">
                <LeaderItem row={board.me} />
              </ol>
            )}
            <p className="hint">
              {board.players} játékos · aki legalább egy rangsorolt játszmát lejátszott. Mindenki {RATING_START} ponttal kezd; az első {PROVISIONAL_GAMES} játszmában
              gyorsabban változik a pontszám.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function LeaderItem({ row }: { row: LeaderRow }) {
  return (
    <li className={`leader-item ${row.me ? 'is-me' : ''} ${row.rank <= 3 ? `is-top is-top-${row.rank}` : ''}`}>
      <span className="leader-rank">{row.rank <= 3 ? <Icon name="crown" scale={1} /> : null}{row.rank}.</span>
      <span className="leader-name">
        <b>{row.name}</b>
        <small>
          {row.games} játszma · {row.w}/{row.l}/{row.d}
        </small>
      </span>
      <EloBadge elo={row.rating} title={`Élő-pontszám: ${row.rating}`} />
    </li>
  );
}
