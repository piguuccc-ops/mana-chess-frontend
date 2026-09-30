// ─────────────────────────────────────────────────────────────────────────────
// The online screen: 1. which backend (ip:port or https://…), 2. sign in / register / guest,
// 3. the lobby – new game and rooms on one side, friends and challenges on the other.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import type { DeckDef } from '../../../engine';
import { displayServer } from '../../../net/client';
import type { OnlineGame } from '../../netSync';
import { guessBackend, startAddress, type Online } from '../../online/useOnline';
import type { Prefs } from '../../storage';
import { Icon } from '../pixel';
import { AuthStep } from './AuthStep';
import { FriendsPanel, GuestFriends } from './FriendsPanel';
import { PlayPanel } from './PlayPanel';
import { ServerStep } from './ServerStep';

interface Props {
  online: Online;
  /** The decks this player can take into an online game (presets + the account's or this browser's). */
  decks: DeckDef[];
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
  onGame: (g: OnlineGame) => void;
  onBack: () => void;
  notify: (text: string, tone?: 'info' | 'error') => void;
}

export function OnlineHub({ online, decks, prefs, onPrefs, onGame, onBack, notify }: Props) {
  const { server, account, guest } = online;
  const [tab, setTab] = useState<'play' | 'friends'>('play');

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
          <button type="button" role="tab" aria-selected={tab === 'play'} className="tab" onClick={() => setTab('play')}>
            <Icon name="swords" scale={1} /> Játék {playBadge > 0 && <span className="tab-count">{playBadge}</span>}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'friends'} className="tab" onClick={() => setTab('friends')}>
            <Icon name="friends" scale={1} /> Barátok {friendsBadge > 0 && <span className="tab-count">{friendsBadge}</span>}
          </button>
        </nav>
        <div className={`online-lobby show-${tab} ${urgent ? 'has-urgent' : ''} ${account ? 'is-member' : 'is-guest'}`}>
          <PlayPanel
            origin={server.origin}
            info={server.info}
            account={account}
            guestName={prefs.playerName}
            decks={decks}
            prefs={prefs}
            onPrefs={onPrefs}
            onGame={onGame}
            refresh={online.refresh}
          />
          {account ? (
            <FriendsPanel account={account} origin={server.origin} decks={decks} prefs={prefs} onPrefs={onPrefs} refresh={online.refresh} onLogout={() => void online.logout()} notify={notify} />
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
