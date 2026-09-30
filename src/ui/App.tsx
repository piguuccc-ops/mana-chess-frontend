import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { newDraft, opposite, PRESET_DECKS, type Color, type DeckDef, type Draft, type SpellId } from '../engine';
import { forgetSeat, OnlineSession, rememberSeat } from '../net/client';
import { setAmbience, setSoundSettings, sfx, unlockAudio } from './audio/sound';
import { DeckBuilder, type DeckHome } from './components/DeckBuilder';
import { LocalDraft, OnlineDraftScreen } from './components/Draft';
import { Menu } from './components/Menu';
import { OnlineHub } from './components/online/OnlineHub';
import { Rules } from './components/Rules';
import { GameScreen } from './GameScreen';
import { decksOf, draftFromRoom, gameFromRoom, type OnlineDraft, type OnlineGame } from './netSync';
import { useOnline } from './online/useOnline';
import { loadCustomDecks, loadPrefs, playableDecks, resolveDeck, saveCustomDecks, savePrefs, type Prefs } from './storage';
import type { GameConfig } from './useGame';

type Screen = 'title' | 'online' | 'decks' | 'rules' | 'game' | 'draft';
/** Spell-toborzás in progress: on this machine, or in an online room. */
type DraftPlay = { kind: 'local'; draft: Draft; vsAi: boolean; autoEndTurn: boolean; key: number } | { kind: 'online'; od: OnlineDraft; key: number };

/** A drafted deck as the game screen takes it. */
const draftedDeck = (c: Color, spells: SpellId[]): DeckDef => ({ id: `draft-${c}`, name: 'Toborzott pakli', description: '', spells });
type TransitionKind = 'book' | 'scene' | 'fade';
interface Notice {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

function useOsReducedMotion() {
  const q = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const [v, setV] = useState(!!q?.matches);
  useEffect(() => {
    if (!q) return;
    const on = () => setV(q.matches);
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, [q]);
  return v;
}

export function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const [menuPanel, setMenuPanel] = useState<'setup' | 'settings' | null>(null);
  const [custom, setCustom] = useState<DeckDef[]>(() => loadCustomDecks());
  const [prefs, setPrefsState] = useState<Prefs>(() => loadPrefs());
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [draftPlay, setDraftPlay] = useState<DraftPlay | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [transition, setTransition] = useState<{ kind: TransitionKind; phase: 'in' | 'out'; key: number } | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const timers = useRef<number[]>([]);
  const osReduced = useOsReducedMotion();
  const reduced = osReduced || prefs.motion === 'reduced';

  const setPrefs = (p: Prefs) => {
    setPrefsState(p);
    savePrefs(p);
  };

  // ── short notes over any screen (a friend's challenge, a lost login…) ──
  const notify = useCallback((text: string, tone: 'info' | 'error' = 'info') => {
    const id = Date.now() + Math.random();
    sfx(tone === 'error' ? 'back' : 'manaGain');
    setNotices((all) => [...all.filter((n) => n.text !== text), { id, text, tone }].slice(-3));
    window.setTimeout(() => setNotices((all) => all.filter((n) => n.id !== id)), tone === 'error' ? 8000 : 6000);
  }, []);

  useEffect(() => setSoundSettings(prefs.sound), [prefs.sound]);
  useEffect(() => setAmbience(screen === 'title' || screen === 'online' || screen === 'draft' ? 'menu' : screen === 'game' ? 'war' : null), [screen]);
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  /** Switch screens behind a short, game-like transition. */
  const go = useCallback(
    (to: Screen, kind: TransitionKind, then?: () => void) => {
      timers.current.forEach((t) => window.clearTimeout(t));
      const half = reduced ? 90 : kind === 'scene' ? 380 : 300;
      const key = Date.now();
      setTransition({ kind, phase: 'in', key });
      timers.current = [
        window.setTimeout(() => {
          then?.();
          setScreen(to);
          // notes belong to the screen they came up on (e.g. „…elfogadta a kihívást” once the game is on)
          setNotices([]);
          setTransition({ kind, phase: 'out', key });
        }, half),
        window.setTimeout(() => setTransition(null), half * 2 + 60),
      ];
    },
    [reduced],
  );

  // ── online: the room's session lives here from the first game until leaving ──
  const session = useRef<OnlineSession | null>(null);
  const startOnline = (g: OnlineGame) => {
    sfx('turn');
    session.current = g.session;
    go('game', 'scene', () => {
      setConfig({ mode: 'online', aiColor: opposite(g.me), decks: decksOf(g.setup), seed: g.setup.seed, autoEndTurn: g.setup.autoEndTurn, online: g });
      setGameKey((k) => k + 1);
      setMenuPanel(null);
    });
  };
  const startOnlineRef = useRef(startOnline);
  startOnlineRef.current = startOnline;
  /** Online Spell-toborzás: the room's draft screen (the game follows from it). */
  const startOnlineDraft = (od: OnlineDraft) => {
    sfx('turn');
    session.current = od.session;
    go('draft', 'scene', () => {
      setDraftPlay({ kind: 'online', od, key: Date.now() });
      setMenuPanel(null);
    });
  };
  const startOnlineDraftRef = useRef(startOnlineDraft);
  startOnlineDraftRef.current = startOnlineDraft;
  /** Leaving the room: a running game counts as resigned, and the room closes. */
  const leaveOnline = () => {
    const s = session.current;
    session.current = null;
    if (!s) return;
    forgetSeat(s.server, s.seat.code);
    void s.leave().catch(() => undefined).finally(() => s.stop());
  };
  useEffect(() => () => session.current?.stop(), []);

  // the backend, the account and its live stream (a challenge reaches every screen)
  const online = useOnline({
    notify,
    // a friend accepted our challenge: the game starts – unless we are busy elsewhere
    onGame: (server, seat, state) => {
      if (screenRef.current === 'game' || screenRef.current === 'decks' || screenRef.current === 'draft') {
        notify('Elfogadták a kihívásodat – a játszmát az Online menüben, a Folytatásnál éred el.');
        return;
      }
      const s = new OnlineSession(server, seat, state);
      // a Spell-toborzás challenge begins with the draft
      if (state.draft) {
        const od = draftFromRoom(s, state);
        if (typeof od === 'string') return notify(od, 'error');
        s.start();
        rememberSeat({ server, ...seat, opponent: od.names[od.me === 'w' ? 'b' : 'w'], at: Date.now() });
        startOnlineDraftRef.current(od);
        return;
      }
      const g = gameFromRoom(s, state);
      if (typeof g === 'string') return notify(g, 'error');
      s.start();
      rememberSeat({ server, ...seat, opponent: g.setup.names[g.me === 'w' ? 'b' : 'w'], at: Date.now() });
      startOnlineRef.current(g);
    },
  });
  const account = online.account;

  // ── decks: this browser's, and the signed-in account's on the server ──
  const serverDecks = useMemo<DeckDef[] | null>(
    () => (account ? account.me.decks.map((d) => ({ id: d.id, name: d.name, description: d.description, spells: d.spells, source: 'server' }) as DeckDef) : null),
    [account],
  );
  /** Local and AI battles: every deck this player has. */
  const decks = playableDecks([...PRESET_DECKS, ...(serverDecks ?? []), ...custom]);
  /** Online: the account's decks when signed in, this browser's as a guest (LAN mode). */
  const onlineDecks = playableDecks([...PRESET_DECKS, ...(serverDecks ?? custom)]);

  const deckById = (id: string): DeckDef => resolveDeck(decks, id);

  const start = () => {
    sfx('turn');
    if (prefs.draft) {
      // Spell-toborzás: the decks are drafted first
      go('draft', 'scene', () => {
        setDraftPlay({ kind: 'local', draft: newDraft((Math.random() * 2 ** 31) | 0), vsAi: prefs.mode === 'ai', autoEndTurn: prefs.autoEndTurn, key: Date.now() });
        setMenuPanel(null);
      });
      return;
    }
    go('game', 'scene', () => {
      setConfig({
        mode: prefs.mode === 'ai' ? 'ai' : 'local',
        aiColor: 'b',
        decks: { w: deckById(prefs.whiteDeckId), b: deckById(prefs.blackDeckId) },
        seed: (Math.random() * 2 ** 31) | 0,
        autoEndTurn: prefs.autoEndTurn,
      });
      setGameKey((k) => k + 1);
      setMenuPanel(null);
    });
  };

  const saveDeck = async (deck: DeckDef, home: DeckHome): Promise<{ error?: string; note?: string }> => {
    if (home === 'server') {
      if (!account) return { error: 'Nem vagy bejelentkezve – a fiókba mentéshez lépj be az Online menüben.' };
      try {
        const r = await account.api.saveDeck({ id: deck.id, name: deck.name, description: deck.description, spells: deck.spells });
        if (!r.ok) return { error: r.error };
        await online.refresh();
        return {};
      } catch {
        return { error: 'Nem érem el a szervert – a pakli nincs elmentve.' };
      }
    }
    const next = [...custom.filter((d) => d.id !== deck.id), deck];
    setCustom(next);
    return saveCustomDecks(next) ? {} : { note: `„${deck.name}” használható ebben a munkamenetben (a böngésző nem engedi a tartós mentést).` };
  };
  const deleteDeck = async (id: string, home: DeckHome): Promise<string | null> => {
    if (home === 'server') {
      if (!account) return 'Nem vagy bejelentkezve.';
      try {
        const r = await account.api.deleteDeck(id);
        if (!r.ok) return r.error;
        await online.refresh();
        return null;
      } catch {
        return 'Nem érem el a szervert.';
      }
    }
    const next = custom.filter((d) => d.id !== id);
    setCustom(next);
    saveCustomDecks(next);
    return null;
  };

  // One click sound for every physical control (cards and board make their own sounds).
  // (a structural event type: fits the DOM's and React's click events alike)
  const onClickCapture = (e: { target: EventTarget | null }) => {
    const el = (e.target as HTMLElement | null)?.closest?.('.btn, .tab, .choice, .switch, .link-btn');
    if (el && !(el as HTMLButtonElement).disabled && el.getAttribute('aria-disabled') !== 'true') sfx('click');
  };

  const me = account?.me;
  const onlineBadge = me ? me.challengesIn.length + me.requestsIn.length : 0;

  return (
    <div className={`app screen-${screen} ${reduced ? 'motion-reduced' : ''}`} lang="hu" onClickCapture={onClickCapture}>
      {screen === 'title' && (
        <Menu
          decks={decks}
          prefs={prefs}
          onPrefs={setPrefs}
          onStart={start}
          onOnline={() => go('online', 'book')}
          onlineBadge={onlineBadge}
          onDeckBuilder={() => go('decks', 'book')}
          onRules={() => go('rules', 'book')}
          reduced={reduced}
          initialPanel={menuPanel}
        />
      )}
      {screen === 'online' && (
        <OnlineHub online={online} decks={onlineDecks} prefs={prefs} onPrefs={setPrefs} onGame={startOnline} onDraft={startOnlineDraft} onBack={() => go('title', 'fade')} notify={notify} />
      )}
      {screen === 'decks' && (
        <DeckBuilder
          customDecks={custom}
          serverDecks={serverDecks}
          accountLabel={account && online.server.phase === 'ok' ? `${account.me.user.name} · ${online.server.info.name}` : null}
          onSave={saveDeck}
          onDelete={deleteDeck}
          onBack={() => go('title', 'fade')}
          reduced={reduced}
        />
      )}
      {screen === 'rules' && <Rules onBack={() => go('title', 'fade')} reduced={reduced} />}
      {screen === 'draft' && draftPlay?.kind === 'local' && (
        <LocalDraft
          key={draftPlay.key}
          initial={draftPlay.draft}
          vsAi={draftPlay.vsAi}
          reduced={reduced}
          onLeave={() => go('title', 'fade')}
          onDone={(picks) => {
            const dp = draftPlay;
            go('game', 'scene', () => {
              setConfig({
                mode: dp.vsAi ? 'ai' : 'local',
                aiColor: 'b',
                decks: { w: draftedDeck('w', picks.w), b: draftedDeck('b', picks.b) },
                seed: (Math.random() * 2 ** 31) | 0,
                autoEndTurn: dp.autoEndTurn,
              });
              setGameKey((k) => k + 1);
            });
          }}
        />
      )}
      {screen === 'draft' && draftPlay?.kind === 'online' && (
        <OnlineDraftScreen
          key={draftPlay.key}
          od={draftPlay.od}
          reduced={reduced}
          notify={notify}
          onGame={(g) => startOnline(g)}
          onLeave={() => {
            leaveOnline();
            go('online', 'fade');
          }}
        />
      )}
      {screen === 'game' && config && (
        <GameScreen
          key={gameKey}
          config={config}
          prefs={prefs}
          onPrefs={setPrefs}
          reduced={reduced}
          onMenu={() => {
            if (config.mode === 'online') {
              leaveOnline();
              go('online', 'fade');
              return;
            }
            go('title', 'fade');
          }}
          onRematch={start}
          onNextGame={startOnline}
          onNextDraft={startOnlineDraft}
        />
      )}
      {notices.length > 0 && (
        <div className="app-notices" aria-live="polite">
          {notices.map((n) => (
            <button key={n.id} type="button" className={`app-notice frame-parchment is-${n.tone}`} onClick={() => setNotices((all) => all.filter((x) => x.id !== n.id))}>
              <span>{n.text}</span>
            </button>
          ))}
        </div>
      )}
      {transition && <div key={transition.key} className={`screen-transition t-${transition.kind} phase-${transition.phase}`} aria-hidden="true" />}
    </div>
  );
}
