// The social half of the online lobby (signed-in players): finding players, friend requests,
// the friend list with who is online, challenges, and the account itself.
import { useEffect, useRef, useState } from 'react';
import type { DeckDef } from '../../../engine';
import type { SearchHit } from '../../../net/client';
import type { ChallengeView, FriendView, UserBrief } from '../../../net/protocol';
import { sfx } from '../../audio/sound';
import type { AccountState } from '../../online/useOnline';
import { resolveDeck, type Prefs } from '../../storage';
import { ConfirmDialog } from '../Overlays';
import { Icon } from '../pixel';
import { ChallengeDialog, COLOR_WORD, PasswordDialog, Portal, PRESENCE_WORD, PresenceDot } from './parts';
import { clock, useChallengeClock } from './PlayPanel';

interface Props {
  account: AccountState;
  origin: string;
  decks: DeckDef[];
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
  refresh: () => Promise<void>;
  onLogout: () => void;
  notify: (text: string, tone?: 'info' | 'error') => void;
}

const ORDER = { playing: 0, online: 1, offline: 2 } as const;

export function FriendsPanel({ account, origin, decks, prefs, onPrefs, refresh, onLogout, notify }: Props) {
  const { me, api } = account;
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [challengeTo, setChallengeTo] = useState<FriendView | null>(null);
  const [removing, setRemoving] = useState<FriendView | null>(null);
  const [password, setPassword] = useState(false);
  const secondsLeft = useChallengeClock();
  const searchSeq = useRef(0);

  // search as you type (from two letters), a moment after the last key
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits(null);
      return;
    }
    const seq = ++searchSeq.current;
    const t = window.setTimeout(async () => {
      const r = await api.search(q).catch(() => null);
      if (seq !== searchSeq.current) return;
      setHits(r && r.ok ? r.users : []);
    }, 250);
    return () => window.clearTimeout(t);
  }, [query, api]);

  /** Run one friend action; the profile is fetched again afterwards (and the search, if open). */
  const act = async (key: string, call: () => Promise<{ ok: boolean; error?: string }>, done?: string) => {
    if (busy) return;
    setBusy(key);
    try {
      const r = await call();
      if (!r.ok) notify(r.error ?? 'Hiba történt.', 'error');
      else if (done) notify(done);
    } catch {
      notify('Nem érem el a szervert.', 'error');
    } finally {
      setBusy(null);
    }
    await refresh();
    if (query.trim().length >= 2) {
      const r = await api.search(query.trim()).catch(() => null);
      if (r && r.ok) setHits(r.users);
    }
  };

  const hitAction = (h: SearchHit) => {
    if (h.relation === 'friend') return <span className="hint">Barátod</span>;
    if (h.relation === 'asked')
      return (
        <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => void act(`cancel:${h.id}`, () => api.cancelRequest(h.id))}>
          Visszavonás
        </button>
      );
    if (h.relation === 'asking')
      return (
        <button type="button" className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => void act(`accept:${h.id}`, () => api.accept(h.id), `${h.name} mostantól a barátod.`)}>
          Elfogadás
        </button>
      );
    return (
      <button type="button" className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => void act(`add:${h.id}`, () => api.request(h.id), `Jelölés elküldve: ${h.name}`)}>
        <Icon name="plus" scale={1} /> Jelölés
      </button>
    );
  };

  const friends = [...me.friends].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name, 'hu'));
  const online = friends.filter((f) => f.status !== 'offline').length;
  const outFor = (id: string): ChallengeView | undefined => me.challengesOut.find((c) => c.to.id === id);

  const sendChallenge = async (): Promise<string | null> => {
    if (!challengeTo) return null;
    const deck = resolveDeck(decks, prefs.onlineDeckId);
    try {
      const r = await api.challenge(challengeTo.id, deck.spells, deck.name, prefs.onlineColor, prefs.autoEndTurn);
      if (!r.ok) return r.error;
      sfx('open');
      notify(`Kihívás elküldve: ${challengeTo.name}`);
      void refresh();
      return null;
    } catch {
      return 'Nem érem el a szervert.';
    }
  };

  const person = (u: UserBrief, extra?: string) => (
    <span className="friend-text">
      <b>{u.name}</b>
      {extra && <small>{extra}</small>}
    </span>
  );

  const shownDeck = prefs.onlineDeckId === 'random' ? null : decks.find((d) => d.id === prefs.onlineDeckId) ?? null;

  return (
    <section className="online-card friends-card frame-parchment" aria-labelledby="friends-title">
      <h2 className="online-card-title" id="friends-title">
        <Icon name="friends" scale={2} /> Barátok
        <small className="online-card-sub">
          {online} / {friends.length} online
        </small>
      </h2>

      <label className="field friend-search">
        <Icon name="search" scale={1} />
        <input
          id="friend-search"
          type="search"
          value={query}
          placeholder="Játékos keresése név szerint…"
          aria-label="Játékos keresése"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {hits !== null && (
        <ul className="friend-list search-hits" aria-label="Találatok">
          {hits.length === 0 && <li className="hint">Nincs ilyen nevű játékos.</li>}
          {hits.map((h) => (
            <li key={h.id} className="friend-item">
              <Icon name="user" scale={1} />
              {person(h, h.relation === 'asking' ? 'Jelölt téged' : h.relation === 'asked' ? 'Jelölve – válaszra vár' : undefined)}
              {hitAction(h)}
            </li>
          ))}
        </ul>
      )}

      {me.requestsIn.length > 0 && (
        <>
          <h3 className="section-title">
            Jelölések <span className="tab-count">{me.requestsIn.length}</span>
          </h3>
          <ul className="friend-list">
            {me.requestsIn.map((u) => (
              <li key={u.id} className="friend-item is-new">
                <Icon name="bell" scale={1} />
                {person(u, 'Barátnak jelölt')}
                <span className="room-item-actions">
                  <button type="button" className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => void act(`accept:${u.id}`, () => api.accept(u.id), `${u.name} mostantól a barátod.`)}>
                    Elfogadás
                  </button>
                  <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => void act(`decline:${u.id}`, () => api.decline(u.id))}>
                    Elutasítás
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {me.challengesOut.length > 0 && (
        <>
          <h3 className="section-title">Elküldött kihívások</h3>
          <ul className="friend-list">
            {me.challengesOut.map((c) => (
              <li key={c.id} className="friend-item">
                <Icon name="hourglass" scale={1} />
                {person(c.to, `Válaszra vár · te: ${COLOR_WORD[c.color]} · még ${clock(secondsLeft(c))}`)}
                <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => void act(`uncall:${c.id}`, () => api.cancelChallenge(c.id))}>
                  Visszavonás
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="section-title">Barátaid</h3>
      {friends.length === 0 ? (
        <p className="hint">Még nincs barátod ezen a szerveren. Keress rá valakinek a nevére fent, és jelöld be – ha elfogadja, itt látod, mikor van bent, és kihívhatod.</p>
      ) : (
        <ul className="friend-list" aria-label="Barátaid">
          {friends.map((f) => {
            const out = outFor(f.id);
            return (
              <li key={f.id} className={`friend-item is-${f.status}`}>
                <PresenceDot status={f.status} />
                {person(f, out ? `Kihívtad – még ${clock(secondsLeft(out))}` : PRESENCE_WORD[f.status])}
                <span className="room-item-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={!!busy || f.status === 'offline'}
                    title={f.status === 'offline' ? `${f.name} most nincs bent` : undefined}
                    onClick={() => setChallengeTo(f)}
                  >
                    <Icon name="swords" scale={1} /> Kihívás
                  </button>
                  <button type="button" className="btn btn-sm btn-icon" aria-label={`${f.name} törlése a barátaid közül`} disabled={!!busy} onClick={() => setRemoving(f)}>
                    <Icon name="trash" scale={1} />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {me.requestsOut.length > 0 && (
        <>
          <h3 className="section-title">Elküldött jelölések</h3>
          <ul className="friend-list">
            {me.requestsOut.map((u) => (
              <li key={u.id} className="friend-item">
                <Icon name="hourglass" scale={1} />
                {person(u, 'Válaszra vár')}
                <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => void act(`cancel:${u.id}`, () => api.cancelRequest(u.id))}>
                  Visszavonás
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="section-title">Fiók</h3>
      <div className="account-box">
        <Icon name="user" scale={2} />
        <span className="friend-text">
          <b>{me.user.name}</b>
          <small>
            {me.user.role === 'admin' ? 'adminisztrátor · ' : ''}
            {me.decks.length} pakli a szerveren
          </small>
        </span>
        <span className="account-actions">
          {me.user.role === 'admin' && (
            <a className="btn btn-sm" href={`${origin}/admin`} target="_blank" rel="noreferrer">
              <Icon name="gear" scale={1} /> Vezérlőpult
            </a>
          )}
          <button type="button" className="btn btn-sm" onClick={() => setPassword(true)}>
            <Icon name="lock" scale={1} /> Jelszócsere
          </button>
          <button type="button" className="btn btn-sm btn-dark" id="logout" onClick={onLogout}>
            <Icon name="back" scale={1} /> Kijelentkezés
          </button>
        </span>
      </div>

      {challengeTo && (
        <ChallengeDialog
          friend={challengeTo.name}
          deck={shownDeck}
          color={prefs.onlineColor}
          autoEndTurn={prefs.autoEndTurn}
          onColor={(c) => onPrefs({ ...prefs, onlineColor: c })}
          onAuto={(a) => onPrefs({ ...prefs, autoEndTurn: a })}
          onSend={sendChallenge}
          onClose={() => setChallengeTo(null)}
        />
      )}
      {removing && (
        <Portal>
          <ConfirmDialog
            text={`${removing.name} – törlöd a barátaid közül?`}
            yes="Törlés"
            onYes={() => {
              const f = removing;
              setRemoving(null);
              void act(`remove:${f.id}`, () => api.unfriend(f.id), `${f.name} már nem a barátod.`);
            }}
            onNo={() => setRemoving(null)}
          />
        </Portal>
      )}
      {password && (
        <PasswordDialog
          onSave={async (old, next) => {
            try {
              const r = await api.password(old, next);
              return r.ok ? null : r.error;
            } catch {
              return 'Nem érem el a szervert.';
            }
          }}
          onClose={() => setPassword(false)}
        />
      )}
    </section>
  );
}

/** What a guest sees instead of the friend list. */
export function GuestFriends({ info, onSignIn }: { info: { registration: string }; onSignIn: () => void }) {
  return (
    <section className="online-card friends-card frame-parchment" aria-labelledby="friends-title">
      <h2 className="online-card-title" id="friends-title">
        <Icon name="friends" scale={2} /> Barátok
      </h2>
      <p className="online-lead">Vendégként játszol (LAN mód): szobát nyithatsz, és beléphetsz mások szobáiba. A pakliid ebben a böngészőben vannak.</p>
      <p className="hint">
        Fiókkal barátokat jelölhetsz, láthatod, ki van bent, kihívhatod őket, és a pakliid a szerveren lesznek – bármelyik eszközről elérheted
        őket.
        {info.registration === 'closed' ? ' Ezen a szerveren fiókot az adminisztrátor hoz létre.' : ''}
      </p>
      <button type="button" className="btn btn-primary" onClick={onSignIn}>
        <Icon name="lock" scale={1} /> Belépés vagy regisztráció
      </button>
    </section>
  );
}
