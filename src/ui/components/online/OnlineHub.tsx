// ─────────────────────────────────────────────────────────────────────────────
// The online screen: 1. which backend (ip:port or https://…), 2. sign in / register / guest,
// 3. the lobby – ranked play (matchmaking, the leaderboard) on one tab; friendly games (new game,
// rooms) and friends with their challenges on the other.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import type { DeckDef } from '../../../engine';
import { displayServer } from '../../../net/client';
import type { OnlineDraft, OnlineGame } from '../../netSync';
import { guessBackend, startAddress, type Online } from '../../online/useOnline';
import type { Prefs } from '../../storage';
import { Icon } from '../pixel';
import { AuthStep } from './AuthStep';
import { FriendsPanel, GuestFriends } from './FriendsPanel';
import { PlayPanel } from './PlayPanel';
import { RankedPanel } from './RankedPanel';
import { ServerStep } from './ServerStep';

export type HubTab = 'ranked' | 'play' | 'friends';

interface Props {
  online: Online;
  /** The decks this player can take into an online game (presets + the account's or this browser's). */
  decks: DeckDef[];
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
  onGame: (g: OnlineGame) => void;
  /** A Spell-toborzás room's draft has begun. */
  onDraft: (d: OnlineDraft) => void;
  onBack: () => void;
  notify: (text: string, tone?: 'info' | 'error') => void;
  /** The tab to open with (the main menu's Rangsorolt opens the ranked one). */
  initialTab?: HubTab;
  /** Look for a ranked opponent at once (after a ranked game: „Új ellenfél”). */
  autoSearch?: boolean;
}

export function OnlineHub({ online, decks, prefs, onPrefs, onGame, onDraft, onBack, notify, initialTab = 'play', autoSearch = false }: Props) {
  const { server, account, guest } = online;
  const [tab, setTab] = useState<HubTab>(initialTab);
  const [searching, setSearching] = useState(false);
  const onSearching = useCallback((on: boolean) => setSearching(on), []);

  // opening the screen: connect to the usual server, or refresh what we know about it
  useEffect(() => {
    if (server.phase === 'idle') {
      const a = startAddress(prefs.serverAddress);
      const guess = guessBackend();
      if (a) void online.connect(a);
      else if (guess) void online.connect(guess, true);
    } else if (server.phase === 'ok') {
      void online.reloadInfo();
      void online.refresh();
    }
    // once, on opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inLobby = server.phase === 'ok' && (account || guest);
  const me = account?.me;
  const urgent = !!me && (me.challengesIn.length > 0 || me.games.length > 0);
  const playBadge = me?.challengesIn.length ?? 0;
  const friendsBadge = me?.requestsIn.length ?? 0;

  let body;
  if (server.phase !== 'ok') {
    body = (
      <div className="online-steps">
        {server.phase === 'checking' ? (
          <section className="online-card online-step frame-parchment" aria-live="polite">
            <h2 className="online-card-title">
              <Icon name="hourglass" scale={2} /> Kapcsolódás…
            </h2>
            <p className="online-lead">{displayServer(server.origin)}</p>
            <button type="button" className="link-btn" onClick={online.disconnect}>
              Másik szerver
            </button>
          </section>
        ) : (
          <ServerStep
            online={online}
            initial={server.phase === 'error' && server.origin ? displayServer(server.origin) : prefs.serverAddress || ''}
            onAddress={(a) => onPrefs({ ...prefs, serverAddress: a.trim() })}
          />
        )}
      </div>
    );
  } else if (!inLobby) {
    body = (
      <div className="online-steps">
        <AuthStep online={online} origin={server.origin} info={server.info} guestName={prefs.playerName} onGuestName={(n) => onPrefs({ ...prefs, playerName: n })} />
      </div>
    );
  } else {
    body = (
      <>
        <nav className="tabs online-lobby-tabs" role="tablist" aria-label="Online">
          <button type="button" role="tab" id="tab-ranked" aria-selected={tab === 'ranked'} className="tab" onClick={() => setTab('ranked')}>
            <Icon name="trophy" scale={1} /> Rangsorolt {searching && <span className="tab-pulse" aria-label="keresés folyamatban" />}
          </button>
          {/* wide screens: the friendly lobby is one tab (its cards side by side); phones split it in two */}
          <button type="button" role="tab" id="tab-friendly" aria-selected={tab !== 'ranked'} className="tab tab-wide-only" onClick={() => tab === 'ranked' && setTab('play')}>
            <Icon name="globe" scale={1} /> Barátságos {playBadge + friendsBadge > 0 && <span className="tab-count">{playBadge + friendsBadge}</span>}
          </button>
          <button type="button" role="tab" id="tab-play" aria-selected={tab === 'play'} className="tab tab-phone-only" onClick={() => setTab('play')}>
            <Icon name="swords" scale={1} /> Játék {playBadge > 0 && <span className="tab-count">{playBadge}</span>}
          </button>
          <button type="button" role="tab" id="tab-friends" aria-selected={tab === 'friends'} className="tab tab-phone-only" onClick={() => setTab('friends')}>
            <Icon name="friends" scale={1} /> Barátok {friendsBadge > 0 && <span className="tab-count">{friendsBadge}</span>}
          </button>
        </nav>
        <RankedPanel
          origin={server.origin}
          info={server.info}
          account={account}
          decks={decks}
          prefs={prefs}
          onPrefs={onPrefs}
          onGame={onGame}
          onSignIn={() => online.setGuest(false)}
          hidden={tab !== 'ranked'}
          onSearching={onSearching}
          autoSearch={autoSearch}
        />
        <div className={`online-lobby show-${tab} ${tab === 'ranked' ? 'is-hidden' : ''} ${urgent ? 'has-urgent' : ''} ${account ? 'is-member' : 'is-guest'}`}>
          <PlayPanel
            origin={server.origin}
            info={server.info}
            account={account}
            guestName={prefs.playerName}
            decks={decks}
            prefs={prefs}
            onPrefs={onPrefs}
            onGame={onGame}
            onDraft={onDraft}
            refresh={online.refresh}
          />
          {account ? (
            <FriendsPanel account={account} decks={decks} prefs={prefs} onPrefs={onPrefs} refresh={online.refresh} onLogout={() => void online.logout()} notify={notify} />
          ) : (
            <GuestFriends info={server.info} onSignIn={() => online.setGuest(false)} />
          )}
        </div>
      </>
    );
  }

  return (
    <div className="online-screen">
      <header className="online-head">
        <button type="button" className="btn btn-iron" onClick={onBack}>
          <Icon name="back" scale={2} /> Menü
        </button>
        <h1 className="online-title">
          <Icon name="globe" scale={3} /> <span className="gold-text">Online</span>
        </h1>
        <div className="online-who">
          {inLobby && server.phase === 'ok' && (
            <span className={`online-chip is-${online.link}`} title={`${server.info.name} – ${displayServer(server.origin)}`}>
              <span className={`presence-dot ${account ? (online.link === 'online' ? 'is-online' : 'is-offline') : 'is-guest'}`} aria-hidden="true" />
              <span className="online-chip-text">
                <b>{account ? account.me.user.name : `Vendég: ${prefs.playerName.trim()}`}</b>
                <small>{account && online.link !== 'online' ? 'Kapcsolódás…' : server.info.name}</small>
              </span>
            </span>
          )}
          {inLobby && !account && (
            <button type="button" className="btn btn-sm" onClick={online.disconnect}>
              Másik szerver
            </button>
          )}
        </div>
      </header>
      <div className="online-body">{body}</div>
    </div>
  );
}
