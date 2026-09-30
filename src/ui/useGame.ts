import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { aiNextAction } from '../ai/simpleAI';
import { applyAction, createGame, type DeckDef } from '../engine';
import type { Action, Color, GameState, SpellId } from '../engine';
import { sfx } from './audio/sound';
import { GameHistory, type LastMove, type Step } from './history';
import { lastMoveOf, NetSync, type NetStatus, type OnlineDraft, type OnlineGame } from './netSync';
import type { Batch } from './vfx/choreo';

export interface GameConfig {
  mode: 'local' | 'ai' | 'online';
  aiColor: Color;
  decks: Record<Color, DeckDef>;
  seed: number;
  autoEndTurn: boolean;
  /** Optional starting position / mana (scenario tests and future puzzles). */
  fen?: string;
  mana?: Record<Color, number>;
  charges?: Partial<Record<Color, Partial<Record<SpellId, number>>>>;
  /** Online games: the room's live session and the game played in it. */
  online?: OnlineGame;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'error' | 'info';
}

let counter = 1;

/**
 * Owns the game state. Every successful action produces a `Batch`
 * (action + state before/after); the screen turns it into animations.
 * Local games also keep an undo / redo history (misclicks); online games
 * keep in step with the server (see netSync.ts).
 */
export function useGame(config: GameConfig, opts: { onNextGame?: (g: OnlineGame) => void; onNextDraft?: (d: OnlineDraft) => void } = {}) {
  const [state, setState] = useState<GameState>(() =>
    config.online
      ? config.online.state
      : createGame({
          decks: { w: config.decks.w.spells, b: config.decks.b.spells },
          deckNames: { w: config.decks.w.name, b: config.decks.b.name },
          seed: config.seed,
          autoEndTurn: config.autoEndTurn,
          ...(config.fen ? { fen: config.fen } : {}),
          ...(config.mana ? { mana: config.mana } : {}),
          ...(config.charges ? { charges: config.charges } : {}),
        }),
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const [batch, setBatch] = useState<Batch | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [lastMove, setLastMove] = useState<LastMove>(() => (config.online ? lastMoveOf(config.online.actions) : null));
  const lastMoveRef = useRef<LastMove>(lastMove);
  const [thinking, setThinking] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  const history = useRef(new GameHistory());
  /** The AI waits until a cinematic has played out. */
  const holdUntil = useRef(0);
  const hold = useCallback((ms: number) => {
    holdUntil.current = Math.max(holdUntil.current, performance.now() + ms);
  }, []);
  const [, setHistoryTick] = useState(0);
  const keepsHistory = config.mode === 'local';

  const showToast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: counter++, text, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), tone === 'error' ? 2600 : 1800);
  }, []);

  const show = useCallback((s: GameState, lm: LastMove) => {
    stateRef.current = s;
    setState(s);
    lastMoveRef.current = lm;
    setLastMove(lm);
  }, []);

  // ── online: one NetSync per game screen ──
  const nextGame = useRef(opts.onNextGame);
  nextGame.current = opts.onNextGame;
  const nextDraft = useRef(opts.onNextDraft);
  nextDraft.current = opts.onNextDraft;
  const sync = useMemo(
    () =>
      config.online
        ? new NetSync(config.online, {
            show: (s, lm, step) => {
              show(s, lm);
              if (step) setBatch({ id: counter++, action: step.action, before: step.before, after: s, ...(step.rewind ? { rewind: true } : {}), ...(step.jump ? { jump: true } : {}) });
            },
            current: () => stateRef.current,
            holdUntil: () => holdUntil.current,
            toast: (text, tone) => showToast(text, tone),
            status: (st) => setNetStatus(st),
            nextGame: (g) => nextGame.current?.(g),
            nextDraft: (d) => nextDraft.current?.(d),
            sound: (name) => sfx(name),
          })
        : null,
    // one per mounted game (a rematch mounts a new screen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [netStatus, setNetStatus] = useState<NetStatus | null>(() => sync?.status ?? null);
  useEffect(() => {
    if (!sync) return;
    setNetStatus(sync.status);
    sync.start();
    return () => sync.stop();
  }, [sync]);

  const dispatch = useCallback(
    (a: Action): boolean => {
      // giving up: first show what the opponent has already done
      if (sync && a.type === 'RESIGN') sync.flush();
      const before = stateRef.current;
      const r = applyAction(before, a);
      if (!r.ok) {
        showToast(r.error, 'error');
        return false;
      }
      const lmBefore = lastMoveRef.current;
      const lmAfter = a.type === 'MOVE' ? { from: a.from, to: a.to } : lmBefore;
      if (keepsHistory) {
        history.current.record({ action: a, before: { state: before, lastMove: lmBefore }, after: { state: r.state, lastMove: lmAfter } });
        setHistoryTick((t) => t + 1);
      }
      show(r.state, lmAfter);
      setBatch({ id: counter++, action: a, before, after: r.state });
      sync?.local(a);
      return true;
    },
    [showToast, show, keepsHistory, sync],
  );

  /** Takes back the last step (local games). Returns the step, or null if there is none. */
  const undo = useCallback((): Step | null => {
    const s = history.current.undo();
    if (!s) return null;
    const cur = stateRef.current;
    show(s.before.state, s.before.lastMove);
    setBatch({ id: counter++, action: s.action, before: cur, after: s.before.state, rewind: true });
    setHistoryTick((t) => t + 1);
    return s;
  }, [show]);

  /** Replays the last undone step, with its usual animation. */
  const redo = useCallback((): Step | null => {
    const s = history.current.redo();
    if (!s) return null;
    const cur = stateRef.current;
    show(s.after.state, s.after.lastMove);
    setBatch({ id: counter++, action: s.action, before: cur, after: s.after.state });
    setHistoryTick((t) => t + 1);
    return s;
  }, [show]);

  // ── AI opponent (waits for the previous step's animation to breathe) ──
  const aiFailures = useRef(0);
  useEffect(() => {
    if (config.mode !== 'ai' || state.status.kind !== 'playing') return;
    const aiToAct = state.pendingPromotion ? state.pendingPromotion.color === config.aiColor : state.turn === config.aiColor;
    if (!aiToAct) {
      aiFailures.current = 0;
      return;
    }
    setThinking(true);
    const busy = state.turnState.spellsCast || state.turnState.normalMoveDone;
    const t = window.setTimeout(() => {
      const a = aiNextAction(stateRef.current);
      setThinking(false);
      if (!a) return;
      const ok = dispatch(a);
      if (!ok && ++aiFailures.current > 3) dispatch({ type: 'RESIGN', color: config.aiColor });
    }, Math.max(busy ? 1050 : 1300, holdUntil.current - performance.now() + 450));
    return () => {
      window.clearTimeout(t);
      setThinking(false);
    };
  }, [state, config.mode, config.aiColor, dispatch]);

  return {
    state,
    stateRef,
    dispatch,
    batch,
    toast,
    showToast,
    lastMove,
    thinking,
    undo,
    redo,
    canUndo: keepsHistory && history.current.canUndo,
    canRedo: keepsHistory && history.current.canRedo,
    hold,
    /** Online games: the link, the opponent and the room – and the calls that go with them. */
    net: sync && netStatus ? { ...netStatus, game: sync.g, opponent: sync.opponent } : null,
    sync,
  };
}
