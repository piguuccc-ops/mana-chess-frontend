import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  canEndTurn, castBlockReason, COLOR_NAME_HU, colorHas, effectiveCost, endTurnBlockReason, hand as handCards, legalMoves, lostTypes,
  opposite, PIECE_NAME_HU, provokedSquares, SPELLS, squareName, validTargets,
} from '../engine';
import type { Action, Color, GameState, SpellId, Square } from '../engine';
import { BOTS, botFullName } from '../bots/roster';
import { RANKED_TURN_MS } from '../net/protocol';
import { cutAmbience, sfx } from './audio/sound';
import { Board } from './components/Board';
import { BotPortrait } from './components/BotPortrait';
import { ChatBubble } from './components/ChatBubble';
import { Chronicle, EffectsPanel } from './components/Chronicle';
import { HandColumn } from './components/HandColumn';
import { CastFlight, CheckStamp, ConfirmDialog, GameOverScreen, PromotionDialog, TurnBanner } from './components/Overlays';
import { Icon, SpellIcon } from './components/pixel';
import { PlayerPlate } from './components/PlayerPlate';
import { WarRoomScene } from './components/scenes';
import { SettingsBody, Switch } from './components/Settings';
import { SpellInspector } from './components/SpellInspector';
import { CATEGORY_COLOR } from './format';
import type { Step } from './history';
import { keepScreenOn, onPhone, pushBack, vibrate } from './native';
import type { OnlineDraft, OnlineGame } from './netSync';
import { addBotResult, type Prefs } from './storage';
import { useBotChat } from './useBotChat';
import { useGame, type GameConfig } from './useGame';
import { choreograph, rewindPlan, type Plan } from './vfx/choreo';
import { VfxEngine } from './vfx/engine';

interface Props {
  config: GameConfig;
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
  reduced: boolean;
  onMenu: () => void;
  onRematch: () => void;
  /** Ranked games: back to the queue for a new opponent (there is no rematch). */
  onNewOpponent?: () => void;
  /** Online: the next game in the same room has begun (both asked for a rematch). */
  onNextGame?: (g: OnlineGame) => void;
  /** Online, Spell-toborzás room: the rematch begins with a new draft. */
  onNextDraft?: (d: OnlineDraft) => void;
  /** Test seam: receives the dispatcher and a state getter (scenario scripts). */
  testHook?: (api: { dispatch: (a: Action) => boolean; getState: () => GameState }) => void;
}

/**
 * wide / mid: side columns next to the board. narrow: a phone (or a tablet) upright – everything in
 * one column that fits the screen. flat: a phone on its side – the board, and a column next to it.
 */
type Layout = 'wide' | 'mid' | 'narrow' | 'flat';

function useMedia(query: string): boolean {
  const q = useMemo(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query) : null), [query]);
  const [v, setV] = useState(!!q?.matches);
  useEffect(() => {
    if (!q) return;
    const on = () => setV(q.matches);
    on();
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, [q]);
  return v;
}

/** Board art is 160 px + a 12 px frame on each side; pick the largest crisp-ish scale that fits. */
const SCALES = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.75, 1.5, 1.25];
const BOARD_ART = 184;
/** On phones every pixel counts: the largest eighth-step scale that fits. */
const phoneScale = (fit: number) => Math.max(1, Math.min(4, Math.floor((fit / BOARD_ART) * 8) / 8));
/** A phone on its side: the column next to the board needs at least this much. */
const FLAT_SIDE = 300;

/** A few words about an engine step, for the undo / redo notes. */
function stepText(s: Step): string {
  const a = s.action;
  switch (a.type) {
    case 'MOVE': {
      const p = s.before.state.board[a.from];
      return `${p ? PIECE_NAME_HU[p.type] : 'lépés'} ${squareName(a.from)}–\u2060${squareName(a.to)}`; // no line break inside e2–e4
    }
    case 'CAST':
      return SPELLS[a.spellId].name;
    case 'PROMOTE':
      return 'átváltozás';
    case 'END_TURN':
      return 'kör vége';
    case 'RESIGN':
      return 'feladás';
    case 'AGREE_DRAW':
      return 'döntetlen';
  }
}

export function GameScreen({ config, prefs, onPrefs, reduced, onMenu, onRematch, onNewOpponent, onNextGame, onNextDraft, testHook }: Props) {
  const { state, stateRef, dispatch, batch, toast, showToast, lastMove, thinking, undo, redo, canUndo, canRedo, hold, net, sync } = useGame(config, { onNextGame, onNextDraft });
  /** Online games: this browser's colour (the other side is played from another machine). */
  const me: Color | null = config.mode === 'online' && config.online ? config.online.me : null;
  const names = config.online?.setup.names ?? null;
  /** A ranked (matchmade) game: both ratings at its start. */
  const ranked = config.online?.ranked ?? null;
  /** Local games get back / forward arrows (misclicks). */
  const history = config.mode === 'local';
  /** Against a bot: who it is, and what it says. */
  const botId = config.mode === 'ai' ? (config.bot ?? null) : null;
  const bot = botId ? BOTS[botId] : null;
  const onPhoneDevice = useMemo(() => onPhone(), []);
  const chat = useBotChat({ bot: botId, botColor: config.aiColor, state, batch, enabled: prefs.botChat, phone: onPhoneDevice });
  useEffect(() => {
    testHook?.({ dispatch, getState: () => stateRef.current });
  }, [testHook, dispatch, stateRef]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [targeting, setTargeting] = useState<{ spellId: SpellId; picked: Square[] } | null>(null);
  const [armed, setArmed] = useState<SpellId | null>(null);
  const [manualFlip, setManualFlip] = useState(me ? me === 'b' : config.mode === 'ai' && config.aiColor === 'w');
  const [showOver, setShowOver] = useState(false);
  const [confirm, setConfirm] = useState<'resign' | 'draw' | 'leave' | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Phones: the battle report and the active effects slide up over the table. */
  const [sheetOpen, setSheetOpen] = useState(false);
  /** A card opened for reading (its full text and a demo). */
  const [inspect, setInspect] = useState<{ id: SpellId; list: SpellId[] } | null>(null);
  const [banner, setBanner] = useState<{ id: number; color: Color; round: number; sub: string } | null>(null);
  const [stamp, setStamp] = useState<{ id: number; mate: boolean } | null>(null);
  const [flights, setFlights] = useState<{ id: number; spellId: SpellId; color: Color; rect: { left: number; top: number; width: number; height: number }; to: { x: number; y: number } }[]>([]);
  /**
   * The animation plan of the latest step. Derived in the same render as the new position, so
   * the board applies each piece's timing (e.g. „wait for the impact”) together with its new
   * square – a plan set a render later would let the pieces slide off at once.
   */
  const plan = useMemo<Plan | null>(() => (batch ? (batch.rewind ? rewindPlan(batch) : choreograph(batch)) : null), [batch]);
  const [scale, setScale] = useState(3);
  const [turning, setTurning] = useState(false);
  /** A cinematic spell is playing: the board takes no input. */
  const [locked, setLocked] = useState(false);
  /** The turn as the table shows it: switches when the turn banner appears, not mid-move. */
  const [shownTurn, setShownTurn] = useState<Color>(state.turn);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const centerRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  /** Camera moves in flight (cinematic spells) and when they end. */
  const camera = useRef<{ anims: Animation[]; until: number }>({ anims: [], until: 0 });
  const cardRects = useRef<Map<string, DOMRect>>(new Map());
  const timers = useRef<number[]>([]);
  const lockUntil = useRef(0);
  const engine = useMemo(() => new VfxEngine(), []);

  const wide = useMedia('(min-width: 1280px)');
  const mid = useMedia('(min-width: 900px)');
  const short = useMedia('(max-height: 800px)');
  const low = useMedia('(max-height: 560px) and (min-aspect-ratio: 5/4)');
  const layout: Layout = low ? 'flat' : wide ? 'wide' : mid ? 'mid' : 'narrow';
  const phone = layout === 'narrow' || layout === 'flat';
  const platesAside = layout === 'wide' && short;

  const isHuman = useCallback((c: Color) => (me ? c === me : config.mode === 'local' || c !== config.aiColor), [config, me]);
  const playing = state.status.kind === 'playing';
  const canAct = playing && isHuman(state.turn) && !state.pendingPromotion && !locked;
  const human: Color | null = me ?? (config.mode === 'ai' ? opposite(config.aiColor) : null);
  const flipped = config.mode === 'local' && prefs.autoFlip ? shownTurn === 'b' : manualFlip;
  const bottom: Color = flipped ? 'b' : 'w';
  const top: Color = opposite(bottom);
  const handColor: Color = human ?? shownTurn;

  // ── the device: the screen stays on during a game; a buzz on the moments that matter ──
  useEffect(() => {
    keepScreenOn(true);
    return () => keepScreenOn(false);
  }, []);
  const buzzed = useRef<number | null>(null);
  useEffect(() => {
    if (!batch || batch.rewind || batch.id === buzzed.current) return;
    buzzed.current = batch.id;
    const after = batch.after;
    if (after.status.kind !== 'playing') vibrate(after.status.kind === 'checkmate' || after.status.kind === 'resigned' ? [60, 60, 120] : [40, 40, 40]);
    else if (after.inCheck && after.turn !== batch.before.turn) vibrate([30, 40, 30]);
    else if (after.events.some((e) => e.type === 'capture' || e.type === 'destroy')) vibrate(28);
    else if (batch.action.type === 'CAST') vibrate(18);
    else if (batch.action.type === 'MOVE') vibrate(10);
  }, [batch]);

  // ── ranked games: the turn clock (the server's is the real one; this one shows it) ──
  const clockOwner: Color = state.pendingPromotion?.color ?? state.turn;
  const [clockSince, setClockSince] = useState(() => Date.now() - (RANKED_TURN_MS - (config.online?.turnLeftMs ?? RANKED_TURN_MS)));
  const firstOwner = useRef(true);
  useEffect(() => {
    if (firstOwner.current) {
      firstOwner.current = false;
      return;
    }
    setClockSince(Date.now());
  }, [clockOwner]);
  const [, tickClock] = useState(0);
  const clockRunning = !!ranked && state.status.kind === 'playing';
  useEffect(() => {
    if (!clockRunning) return;
    const t = window.setInterval(() => tickClock((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [clockRunning]);
  const clockLeft = clockRunning ? Math.max(0, Math.ceil((RANKED_TURN_MS - (Date.now() - clockSince)) / 1000)) : 0;
  const clockMine = clockRunning && !!me && clockOwner === me;
  /** Half a minute and ten seconds before the end of the own turn: a buzz and a sound (once each per turn). */
  const warned = useRef<{ since: number; at: Set<number> }>({ since: 0, at: new Set() });
  useEffect(() => {
    if (!clockMine) return;
    if (warned.current.since !== clockSince) warned.current = { since: clockSince, at: new Set() };
    const at = [10, 30].find((x) => clockLeft <= x && clockLeft > 0 && !warned.current.at.has(x));
    if (at === undefined) return;
    [10, 30].filter((x) => x >= at).forEach((x) => warned.current.at.add(x));
    vibrate(at === 10 ? [80, 60, 80] : 60);
    sfx('turn');
  }, [clockMine, clockLeft, clockSince]);

  // ── against a bot: the result goes into the record (this device) ──
  const recorded = useRef(false);
  useEffect(() => {
    if (!botId || recorded.current || state.status.kind === 'playing' || !human) return;
    recorded.current = true;
    const st = state.status;
    addBotResult(botId, st.kind === 'checkmate' || st.kind === 'resigned' ? (st.winner === human ? 'w' : 'l') : 'd');
  }, [botId, state.status, human]);

  const legal = useMemo(() => legalMoves(state), [state]);
  const moveTargets = useMemo(() => (selected !== null ? legal.filter((m) => m.from === selected) : []), [legal, selected]);
  const spellTargets = useMemo(() => (targeting ? new Set(validTargets(state, targeting.spellId, targeting.picked)) : null), [state, targeting]);

  // ── engine & layout ──
  useEffect(() => {
    engine.attach(canvasRef.current);
    engine.onShake = (strength, dur) => {
      const el = frameRef.current;
      if (!el || !el.animate) return;
      const k = Math.max(1, Math.round((strength * engine.scale) / 2));
      el.animate(
        [
          { transform: 'translate(0, 0)' },
          { transform: `translate(${-k}px, ${k}px)` },
          { transform: `translate(${k}px, ${-k}px)` },
          { transform: `translate(${-k}px, 0)` },
          { transform: `translate(${k}px, ${k}px)` },
          { transform: 'translate(0, 0)' },
        ],
        { duration: dur, easing: 'linear' },
      );
    };
    // cinematic spells: a slow push-in towards a point of the board (the board and the effect
    // canvas scale together around the same screen point), and a hard cut of the music
    engine.onCamera = (m) => {
      const stage = stageRef.current;
      const canvas = canvasRef.current;
      if (!stage || !canvas || !stage.animate) return;
      const p = engine.toClient(m.focus);
      const total = m.inMs + m.holdMs + m.outMs;
      const move = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        el.style.transformOrigin = `${p.x - r.left}px ${p.y - r.top}px`;
        return el.animate(
          [
            { transform: 'scale(1)', offset: 0, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' },
            { transform: `scale(${m.zoom})`, offset: m.inMs / total },
            { transform: `scale(${m.zoom})`, offset: (m.inMs + m.holdMs) / total, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' },
            { transform: 'scale(1)', offset: 1 },
          ],
          { duration: total },
        );
      };
      camera.current = { anims: [move(stage), move(canvas)], until: performance.now() + total + 50 };
    };
    engine.onSilence = (ms) => cutAmbience(ms);
    return () => {
      camera.current.anims.forEach((a) => a.cancel());
      cutAmbience(0);
      engine.onCamera = null;
      engine.onSilence = null;
      engine.reset();
      engine.attach(null);
    };
  }, [engine]);
  engine.reduced = reduced;

  const relayout = useCallback(() => {
    const root = rootRef.current;
    const board = boardRef.current;
    if (!root || !board) return;
    // while the camera is pushed in the board's screen rect is scaled – keep the last mapping
    if (performance.now() < camera.current.until) return;
    engine.layout(root.getBoundingClientRect(), board.getBoundingClientRect(), flipped);
  }, [engine, flipped]);

  useLayoutEffect(() => {
    const el = centerRef.current;
    if (!el) return;
    const measure = () => {
      if (phone) {
        // layout sizes (not screen rects: a cinematic's camera may be scaling the board right now)
        const cs = getComputedStyle(el);
        const innerW = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const innerH = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        if (layout === 'flat') {
          setScale(phoneScale(Math.min(innerH, innerW - FLAT_SIDE - 12)));
          return;
        }
        // upright: the board gets what the plates, the status line and the hand leave free
        const stage = stageRef.current;
        const gap = parseFloat(cs.rowGap) || 0;
        const others = [...el.children].filter((c) => c !== stage && (c as HTMLElement).offsetParent !== null) as HTMLElement[];
        const used = others.reduce((n, c) => n + c.offsetHeight, 0) + gap * others.length;
        setScale(phoneScale(Math.min(innerW, innerH - used)));
        return;
      }
      const r = el.getBoundingClientRect();
      const plates = platesAside ? 0 : 132;
      const reserve = plates + 52 + 20;
      const fit = Math.min(r.width - 16, r.height - reserve);
      const s = SCALES.find((k) => BOARD_ART * k <= fit) ?? 1;
      setScale(s);
    };
    measure();
    const ro = new ResizeObserver(() => {
      measure();
      relayout();
    });
    ro.observe(el);
    // on phones the parts around the board can change height too (a longer status line)
    if (phone) [...el.children].forEach((c) => c !== stageRef.current && ro.observe(c));
    return () => ro.disconnect();
  }, [layout, phone, platesAside, relayout]);
  useLayoutEffect(() => relayout(), [scale, relayout, layout]);

  // turning the board: no piece travel, a short fade
  const firstFlip = useRef(true);
  useEffect(() => {
    if (firstFlip.current) {
      firstFlip.current = false;
      return;
    }
    setTurning(true);
    const t = window.setTimeout(() => setTurning(false), 260);
    return () => window.clearTimeout(t);
  }, [flipped]);

  // ── each engine step becomes an animation plan ──
  useLayoutEffect(() => {
    if (!batch) return;
    if (batch.rewind) {
      // undo: whatever the taken-back step still had in flight (effects, banner, stamps,
      // the game-over screen, a cinematic's camera and silence) belongs to a past that no
      // longer happened
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      camera.current.anims.forEach((a) => a.cancel());
      camera.current = { anims: [], until: 0 };
      cutAmbience(0);
      lockUntil.current = 0;
      setLocked(false);
      engine.reset();
      setFlights([]);
      setBanner(null);
      setStamp(null);
      setShowOver(false);
      setShownTurn(batch.after.turn);
      const p = plan!;
      relayout();
      p.play(engine);
      sfx('rewind');
      // an online game caught up with the server: an ended game shows its result
      if (batch.jump && batch.after.status.kind !== 'playing') timers.current.push(window.setTimeout(() => setShowOver(true), 700));
      return;
    }
    const p = plan!;
    relayout();
    p.play(engine);
    if (p.lock) {
      lockUntil.current = performance.now() + p.lock;
      setLocked(true);
      hold(p.lock);
      timers.current.push(window.setTimeout(() => {
        if (performance.now() >= lockUntil.current - 30) setLocked(false);
      }, p.lock));
    }
    timers.current = timers.current.slice(-40);
    const after = batch.after;
    if (p.cast) {
      const rect = cardRects.current.get(`${p.cast.color}:${p.cast.spellId}`);
      const b = boardRef.current?.getBoundingClientRect();
      if (rect && b) {
        const id = batch.id;
        setFlights((f) => [
          ...f,
          { id, spellId: p.cast!.spellId, color: p.cast!.color, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, to: { x: b.left + b.width / 2, y: b.top + b.height * 0.42 } },
        ]);
        timers.current.push(window.setTimeout(() => setFlights((f) => f.filter((x) => x.id !== id)), 700));
      }
      sfx('manaSpend');
      sfx('cardPick');
    }
    if (after.turn !== batch.before.turn) {
      if (p.bannerAt !== null) timers.current.push(window.setTimeout(() => setShownTurn(after.turn), p.bannerAt));
      else setShownTurn(after.turn);
    }
    if (p.bannerAt !== null && after.status.kind === 'playing') {
      const who = after.turn;
      const sub = me && names
        ? who === me ? 'Te következel' : `${names[who]} következik`
        : config.mode === 'ai' ? (who === config.aiColor ? 'Az AI következik' : 'Te következel') : `${COLOR_NAME_HU[who]} lép`;
      timers.current.push(
        window.setTimeout(() => {
          setBanner({ id: batch.id, color: who, round: Math.floor(after.turnIndex / 2) + 1, sub });
          sfx('turn');
        }, p.bannerAt),
      );
      timers.current.push(window.setTimeout(() => setBanner((b) => (b?.id === batch.id ? null : b)), p.bannerAt + (reduced ? 900 : 1500)));
    }
    if (p.checkAt !== null) {
      const mate = after.status.kind === 'checkmate';
      timers.current.push(window.setTimeout(() => setStamp({ id: batch.id, mate }), p.checkAt));
      timers.current.push(window.setTimeout(() => setStamp((x) => (x?.id === batch.id ? null : x)), p.checkAt + 1100));
    }
    if (after.status.kind !== 'playing') {
      timers.current.push(window.setTimeout(() => setShowOver(true), p.overAt));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // remember where the cards are (the next cast flies out of its slot)
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const m = new Map<string, DOMRect>();
    root.querySelectorAll('[data-hand] [data-spell]').forEach((el) => {
      const owner = el.closest('[data-hand]')?.getAttribute('data-hand');
      const id = el.getAttribute('data-spell');
      if (owner && id) m.set(`${owner}:${id}`, el.getBoundingClientRect());
    });
    cardRects.current = m;
  });

  // clear transient choices whenever the game moves on
  useEffect(() => {
    setSelected(null);
    setTargeting(null);
    setArmed(null);
  }, [state.eventSeq]);

  const cancel = useCallback(() => {
    setTargeting(null);
    setArmed(null);
    setSelected(null);
  }, []);

  const onUndo = useCallback(() => {
    const s = undo();
    if (s) showToast(`Visszavonva: ${stepText(s)}`);
  }, [undo, showToast]);
  const onRedo = useCallback(() => {
    const s = redo();
    if (s) showToast(`Újra: ${stepText(s)}`);
  }, [redo, showToast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspect) return; // the card closes itself
        if (sheetOpen) setSheetOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else cancel();
        return;
      }
      // Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z, ⌘ on Mac): back / forward in local games
      if (!history || !(e.ctrlKey || e.metaKey) || e.altKey || settingsOpen || confirm || inspect) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) onUndo();
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        if (canRedo) onRedo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancel, settingsOpen, sheetOpen, inspect, confirm, history, canUndo, canRedo, onUndo, onRedo]);

  // online: a hidden tab shows in its title that it is your turn; closing the tab mid-game asks first
  const myTurn = !!me && playing && (state.pendingPromotion ? state.pendingPromotion.color : state.turn) === me;
  useEffect(() => {
    if (!me) return;
    const base = document.title;
    const apply = () => {
      document.title = document.hidden && myTurn ? `\u25B6 Te következel – ${base}` : base;
    };
    apply();
    document.addEventListener('visibilitychange', apply);
    return () => {
      document.removeEventListener('visibilitychange', apply);
      document.title = base;
    };
  }, [me, myTurn]);
  useEffect(() => {
    if (!me || !playing) return;
    const ask = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', ask);
    return () => window.removeEventListener('beforeunload', ask);
  }, [me, playing]);

  const onSquareClick = (s: Square) => {
    if (!canAct) return;
    if (targeting) {
      if (!spellTargets?.has(s)) {
        showToast('Ide nem célozhatsz ezzel a spellel.', 'error');
        sfx('illegal');
        return;
      }
      const picked = [...targeting.picked, s];
      if (picked.length === SPELLS[targeting.spellId].steps.length) {
        dispatch({ type: 'CAST', spellId: targeting.spellId, targets: picked });
        setTargeting(null);
      } else {
        sfx('click');
        setTargeting({ ...targeting, picked });
      }
      return;
    }
    if (selected !== null) {
      const mv = moveTargets.find((m) => m.to === s);
      if (mv) {
        dispatch({ type: 'MOVE', from: mv.from, to: mv.to });
        setSelected(null);
        return;
      }
    }
    const p = state.board[s];
    if (p && p.color === state.turn) {
      setArmed(null);
      if (selected !== s) sfx('cardPick');
      setSelected(selected === s ? null : s);
      return;
    }
    if (selected !== null) sfx('back');
    setSelected(null);
  };

  const onCardClick = (id: SpellId) => {
    if (!canAct) return;
    const reason = castBlockReason(state, id);
    if (reason) {
      showToast(reason, 'error');
      sfx('illegal');
      return;
    }
    setSelected(null);
    if (SPELLS[id].steps.length === 0) {
      setTargeting(null);
      setArmed(armed === id ? null : id);
      return;
    }
    setArmed(null);
    setTargeting(targeting?.spellId === id ? null : { spellId: id, picked: [] });
  };

  const onConfirmCast = (id: SpellId) => {
    dispatch({ type: 'CAST', spellId: id, targets: [] });
    setArmed(null);
  };

  // ── status line ──
  const provoked = provokedSquares(state);
  const endReason = endTurnBlockReason(state);
  const bonus = state.turnState.bonusMoveAvailable;
  const timeStopped = colorHas(state, state.turn, 'timeStop');
  let status: { text: string; tone: 'plain' | 'check' | 'aim' | 'wait'; spell?: SpellId; icon?: 'globe' } = { text: 'Lépj egy bábuval, vagy játssz ki egy spellt.', tone: 'plain' };
  if (!playing) status = { text: 'A játszma véget ért.', tone: 'plain' };
  else if (locked) status = { text: 'A varázslat lesújt…', tone: 'wait' };
  else if (state.pendingPromotion && !isHuman(state.pendingPromotion.color)) status = { text: `${label(state.pendingPromotion.color)} kiválasztja, mivé változzon a gyalog…`, tone: 'wait' };
  else if (state.pendingPromotion) status = { text: 'Válaszd ki, mivé változzon a gyalog.', tone: 'aim' };
  else if (!isHuman(state.turn)) {
    status = !me
      ? { text: thinking ? 'Az AI gondolkodik…' : 'Az AI következik.', tone: 'wait' }
      : net && !net.opponentOnline
        ? { text: `${label(state.turn)} kapcsolata megszakadt – várunk rá…`, tone: 'wait' }
        : { text: `${label(state.turn)} következik.`, tone: 'wait' };
  }
  else if (targeting) {
    const sp = SPELLS[targeting.spellId];
    const price = sp.costFor && targeting.picked.length ? ` (ára: ${effectiveCost(state, state.turn, sp, targeting.picked)} mana)` : '';
    status = { text: `${sp.name}${price}: ${sp.steps[targeting.picked.length]?.prompt ?? ''}`, tone: 'aim', spell: sp.id };
  } else if (armed) status = { text: `${SPELLS[armed].name}: erősítsd meg a kijátszást a lapon.`, tone: 'aim', spell: armed };
  else if (state.mustCastSpell) status = { text: 'Nincs szabályos lépésed – csak egy spell menthet meg!', tone: 'check' };
  else if (provoked.length && legal.some((m) => provoked.includes(m.from))) {
    status = { text: `Provokáció: a normál lépésedet a(z) ${provoked.map(squareName).join(', ')} mezőn álló bábuval kell megtenned.`, tone: 'aim' };
  } else if (state.inCheck) status = { text: 'Sakk! Hárítsd el lépéssel vagy spellel.', tone: 'check' };
  else if (state.turnState.normalMoveDone && !bonus) status = { text: 'Lépés megtörtént – varázsolhatsz még, majd fejezd be a kört.', tone: 'plain' };
  else if (bonus) status = { text: 'Dupla lépés: még egy lépés egy másik bábuval – vagy fejezd be a kört.', tone: 'aim' };
  else if (timeStopped) status = { text: 'Időmegállítás: most nincs normál lépésed, legfeljebb egy spellt használhatsz.', tone: 'aim' };
  else if (state.turnState.spellsCast > 0) status = { text: 'Lépj, varázsolj tovább, vagy fejezd be a kört.', tone: 'plain' };
  // online: link problems and the opponent's absence take the ribbon (unless a spell is being aimed)
  if (net && playing && !targeting && !armed) {
    const who = me ? label(opposite(me)) : '';
    if (net.connection === 'reconnecting') status = { text: 'Megszakadt a kapcsolat a szerverrel – újrapróbálom…', tone: 'check', icon: 'globe' };
    else if (net.connection === 'lost') status = { text: 'Nem érem el a szervert. Fut még, és ugyanazon a hálózaton vagy?', tone: 'check', icon: 'globe' };
    else if (net.closed) status = { text: net.closed, tone: 'wait', icon: 'globe' };
    else if (!net.opponentOnline) status = { text: `${who} kapcsolata megszakadt – ha visszatér, folytatódik a játszma.`, tone: 'wait', icon: 'globe' };
  }

  const endReady = canAct && canEndTurn(state) && (bonus || state.turnState.normalMoveDone || state.turnState.spellsCast > 0 || timeStopped);
  function label(c: Color): string {
    if (me && names) return names[c];
    // phones: the bot's first name only (the plate has room for little more)
    return config.mode === 'ai' ? (c === config.aiColor ? (bot ? (phone ? bot.name : botFullName(bot)) : 'Egyszerű AI') : 'Te') : COLOR_NAME_HU[c];
  }
  const round = Math.floor(state.turnIndex / 2) + 1;
  const targetColor = targeting ? CATEGORY_COLOR[SPELLS[targeting.spellId].category] : null;
  const crystalScale = phone ? (scale >= 3 ? 2 : 1.5) : scale >= 3.5 ? 3 : 2;
  const openInspect = (id: SpellId, owner: Color) => {
    sfx('open');
    setInspect({ id, list: handCards(state, owner) });
  };

  // ── online: the rematch button ──
  const opponent = me ? label(opposite(me)) : '';
  const rematchView = net
    ? ranked
      ? { label: 'Új ellenfél', disabled: false, note: 'Rangsorolt játszma után nincs visszavágó: az Új ellenfél gombbal azonnal újra keresel.' }
      : net.closed
      ? { label: 'Visszavágó', disabled: true, note: net.closed }
      : net.rematch.includes(net.game.role)
        ? { label: 'Várakozás…', disabled: true, note: `Visszavágót kértél – ha ${opponent} is kéri, cserélt színekkel indul.` }
        : net.rematch.length
          ? { label: 'Visszavágó!', disabled: false, note: `${opponent} visszavágót kér.` }
          : { label: 'Visszavágó', disabled: false, note: 'Új játszma ugyanezzel az ellenféllel, cserélt színekkel.' }
    : undefined;

  const plate = (c: Color, placement: 'top' | 'bottom') => (
    <PlayerPlate
      state={state}
      color={c}
      label={`${label(c)}${me && c === me ? ' (te)' : ''}${ranked && phone ? ` · ${ranked[c]}` : ''}`}
      active={playing && shownTurn === c}
      thinking={thinking && !isHuman(c)}
      placement={placement}
      plan={plan}
      showHand={c !== handColor}
      showNext={phone && c === handColor}
      crystalScale={phone || placement === 'bottom' ? crystalScale : 2}
      onInspect={(id) => openInspect(id, c)}
      avatar={bot && c === config.aiColor ? <BotPortrait id={bot.id} scale={phone ? 1 : 2} talking={!!chat.line} /> : undefined}
      elo={phone ? null : bot && c === config.aiColor ? { value: bot.elo, tier: bot.tier } : ranked ? { value: ranked[c] } : null}
    />
  );

  const hand = (
    <HandColumn
      state={state}
      color={handColor}
      owner={config.mode === 'local' ? `${COLOR_NAME_HU[handColor]} lapjai` : 'A te lapjaid'}
      interactive={canAct && state.turn === handColor}
      armed={armed}
      targeting={targeting?.spellId ?? null}
      onCardClick={onCardClick}
      onConfirm={onConfirmCast}
      waitingText={playing && state.turn !== handColor && shownTurn !== handColor ? (thinking ? 'Az ellenfél gondolkodik…' : 'Az ellenfél köre') : null}
      layout={phone ? 'strip' : 'column'}
      onInfo={(id) => openInspect(id, handColor)}
    />
  );

  const endTurn = (
    <button
      type="button"
      id="end-turn"
      className={`btn btn-end ${endReady ? 'btn-primary is-ready' : ''}`}
      disabled={!canAct || endReason !== null}
      title={endReason ?? ''}
      onClick={() => dispatch({ type: 'END_TURN' })}
    >
      <Icon name="hourglass" scale={2} />
      <span>{bonus ? 'Bónusz kihagyása' : 'Kör vége'}</span>
    </button>
  );

  // back / forward (local games): in the top bar, or under the board on narrow screens
  const historyButtons = (where: 'bar' | 'row') => (
    <div className={`history-btns history-${where}`} role="group" aria-label="Visszavonás">
      <button
        type="button"
        id="undo"
        className={`btn btn-iron ${where === 'bar' ? 'btn-sm' : 'btn-icon'}`}
        disabled={!canUndo}
        onClick={onUndo}
        title="Vissza – az utolsó lépés visszavonása (Ctrl+Z)"
        aria-label="Vissza"
      >
        <Icon name="undo" scale={where === 'bar' ? 1 : 2} />
        {where === 'bar' && <span className="hide-sm">Vissza</span>}
      </button>
      <button
        type="button"
        id="redo"
        className={`btn btn-iron ${where === 'bar' ? 'btn-sm' : 'btn-icon'}`}
        disabled={!canRedo}
        onClick={onRedo}
        title="Előre – a visszavont lépés újra (Ctrl+Y)"
        aria-label="Előre"
      >
        <Icon name="redo" scale={where === 'bar' ? 1 : 2} />
        {where === 'bar' && <span className="hide-sm">Előre</span>}
      </button>
    </div>
  );

  /** The bot's lines in the battle report, after the entry they were said at. */
  const chatLog = useMemo(() => (bot ? chat.log.map((l) => ({ id: l.id, logAt: l.logAt, text: l.text, who: bot.name, bot: bot.id })) : undefined), [bot, chat.log]);

  // ── the Android back button: closes what is open, then asks before leaving the game ──
  const backRef = useRef<() => boolean>(() => false);
  backRef.current = () => {
    if (inspect) setInspect(null);
    else if (confirm) setConfirm(null);
    else if (settingsOpen) setSettingsOpen(false);
    else if (sheetOpen) setSheetOpen(false);
    else if (targeting || armed || selected !== null) cancel();
    else if (!playing) onMenu();
    else setConfirm('leave');
    return true;
  };
  useEffect(() => pushBack(() => backRef.current()), []);

  const [sideTab, setSideTab] = useState<'log' | 'effects'>('log');
  const sideTabs = (
    <div className="side-tabs">
      <div className="mini-tabs side-switch" role="tablist">
        <button type="button" role="tab" aria-selected={sideTab === 'log'} className={`mini-tab ${sideTab === 'log' ? 'is-on' : ''}`} onClick={() => setSideTab('log')}>
          Történet
        </button>
        <button type="button" role="tab" aria-selected={sideTab === 'effects'} className={`mini-tab ${sideTab === 'effects' ? 'is-on' : ''}`} onClick={() => setSideTab('effects')}>
          Aktív hatások {state.effects.length > 0 && <span className="count-chip">{state.effects.length}</span>}
        </button>
      </div>
      {sideTab === 'log' ? <Chronicle state={state} chat={chatLog} /> : <EffectsPanel state={state} />}
    </div>
  );

  return (
    <div className={`game layout-${layout} ${platesAside ? 'plates-aside' : ''} turn-${state.turn}`} ref={rootRef}>
      <WarRoomScene reduced={reduced} dim={0.2} />

      <header className="game-bar">
        <div className="game-bar-left">
          <button type="button" className="btn btn-sm btn-iron" onClick={() => (me && playing ? setConfirm('leave') : onMenu())} aria-label={me ? 'Kilépés a szobából' : 'Vissza a menübe'}>
            <Icon name="back" scale={1} /> <span className="hide-xs">{me ? 'Kilépés' : 'Menü'}</span>
          </button>
          <button type="button" className="btn btn-sm btn-iron" onClick={() => setManualFlip((f) => !f)} disabled={config.mode === 'local' && prefs.autoFlip} title="A tábla megfordítása">
            <Icon name="rotate" scale={1} /> <span className="hide-sm">Forgatás</span>
          </button>
          {config.mode === 'local' && !phone && (
            <Switch id="auto-flip" on={prefs.autoFlip} onChange={(v) => onPrefs({ ...prefs, autoFlip: v })} label="Automatikus forgatás" />
          )}
          {phone && (
            <button type="button" id="open-sheet" className="btn btn-sm btn-iron sheet-btn" onClick={() => setSheetOpen(true)} aria-label="Történet és aktív hatások">
              <Icon name="scroll" scale={1} />
              {state.effects.length > 0 && <span className="count-chip">{state.effects.length}</span>}
            </button>
          )}
          {net && (
            <span
              className={`room-chip is-${net.connection} ${ranked ? 'is-ranked' : ''}`}
              title={`${ranked ? 'Rangsorolt játszma' : 'Online szoba'}: ${net.game.code}${net.connection === 'online' ? '' : ' – nincs kapcsolat a szerverrel'}`}
            >
              <Icon name={ranked ? 'trophy' : 'globe'} scale={1} />
              <span className="hide-sm">{ranked ? 'Rangsorolt' : net.game.code}</span>
            </span>
          )}
          {clockRunning && (
            <span
              id="turn-clock"
              className={`turn-clock ${clockMine ? 'is-mine' : 'is-theirs'} ${clockLeft <= 30 ? 'is-low' : ''}`}
              title={clockMine ? 'Ennyi időd van a körödre – ha lejár, elveszíted a játszmát.' : 'Az ellenfél ennyi ideje van a körére.'}
              aria-label={`Lépésidő: ${Math.floor(clockLeft / 60)} perc ${clockLeft % 60} másodperc`}
            >
              <Icon name="hourglass" scale={1} />
              {Math.floor(clockLeft / 60)}:{String(clockLeft % 60).padStart(2, '0')}
            </span>
          )}
        </div>
        <div className={`turn-plaque turn-plaque-${shownTurn}`} aria-live="polite">
          <Icon name={shownTurn === 'w' ? 'crestW' : 'crestB'} scale={1} />
          <b>
            {playing ? (
              <>
                {COLOR_NAME_HU[shownTurn]}
                <span className="plaque-more"> köre</span>
              </>
            ) : (
              'Vége'
            )}
          </b>
          <small>{round}. kör</small>
        </div>
        <div className="game-bar-right">
          {history && !phone && historyButtons('bar')}
          <button
            type="button"
            className="btn btn-sm btn-iron"
            disabled={!playing || config.mode === 'ai' || (!!net && (net.drawOffer === me || !!net.closed))}
            onClick={() => setConfirm('draw')}
            title={net ? (net.drawOffer === me ? 'Döntetlent ajánlottál – az ellenfél válaszára vársz' : 'Döntetlen ajánlása') : 'Döntetlen megegyezéssel'}
          >
            <Icon name="scales" scale={1} /> <span className="hide-sm">{net && net.drawOffer === me ? 'Ajánlva' : 'Döntetlen'}</span>
          </button>
          <button type="button" className="btn btn-sm btn-iron" disabled={!playing} onClick={() => setConfirm('resign')} title="Feladás">
            <Icon name="flag" scale={1} /> <span className="hide-sm">Feladás</span>
          </button>
          {!playing && !showOver && (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setShowOver(true)}>
              <Icon name="crown" scale={1} /> Eredmény
            </button>
          )}
          <button type="button" className="btn btn-sm btn-iron btn-icon" onClick={() => setSettingsOpen(true)} aria-label="Beállítások">
            <Icon name="gear" scale={1} />
          </button>
        </div>
      </header>

      <main className="game-main">
        {!phone && (
          <aside className="game-left">
            {platesAside && plate(bottom, 'bottom')}
            {hand}
            {layout === 'mid' && sideTabs}
          </aside>
        )}

        <section className="game-center" ref={centerRef} style={{ ['--bs' as string]: `${scale}px` }}>
          {!platesAside && plate(top, 'top')}
          <div className="board-stage" ref={stageRef}>
            <Board
              state={state}
              flipped={flipped}
              scale={scale}
              selected={selected}
              moveTargets={moveTargets}
              spellTargets={spellTargets}
              picked={targeting?.picked ?? []}
              targetColor={targetColor}
              lastMove={lastMove}
              plan={plan}
              canAct={canAct}
              turning={turning}
              reduced={reduced}
              onSquareClick={onSquareClick}
              onCancel={cancel}
              boardRef={boardRef}
              frameRef={frameRef}
            />
            {bot && layout !== 'flat' && <ChatBubble bot={bot.id} line={chat.line} reduced={reduced} voice={prefs.botChat} placement={platesAside ? 'right' : 'left'} />}
            {banner && <TurnBanner key={banner.id} color={banner.color} round={banner.round} sub={banner.sub} />}
            {stamp && <CheckStamp key={stamp.id} mate={stamp.mate} />}
            {toast && (
              <div key={toast.id} className={`toast frame-parchment toast-${toast.tone}`} role="status">
                {toast.text}
              </div>
            )}
            {state.pendingPromotion && isHuman(state.pendingPromotion.color) && (
              <PromotionDialog
                color={state.pendingPromotion.color}
                lost={lostTypes(state, state.pendingPromotion.color)}
                onPick={(p) => dispatch({ type: 'PROMOTE', piece: p })}
              />
            )}
          </div>
          <div className="status-row">
            {history && phone && historyButtons('row')}
            <div className={`status-ribbon tone-${status.tone}`} aria-live="polite">
              {status.spell ? <SpellIcon id={status.spell} scale={1} /> : <Icon name={status.icon ?? (status.tone === 'check' ? 'swords' : status.tone === 'wait' ? 'hourglass' : 'scroll')} scale={1} />}
              <span>{status.text}</span>
              {(targeting || armed || selected !== null) && (
                <button type="button" className="link-btn status-cancel" onClick={cancel}>
                  Mégse<span className="hide-touch"> (Esc)</span>
                </button>
              )}
            </div>
            {!phone && endTurn}
          </div>
          {phone && (
            <div className="hand-dock">
              {hand}
              {endTurn}
            </div>
          )}
          {/* a phone on its side: the bot talks in the column next to the board, not over it */}
          {bot && layout === 'flat' && (
            <div className="chat-slot">
              <ChatBubble bot={bot.id} line={chat.line} reduced={reduced} voice={prefs.botChat} />
            </div>
          )}
          {!platesAside && plate(bottom, 'bottom')}
        </section>

        {layout === 'wide' && (
          <aside className="game-right">
            {platesAside && plate(top, 'top')}
            {platesAside ? (
              sideTabs
            ) : (
              <>
                <Chronicle state={state} chat={chatLog} />
                <EffectsPanel state={state} />
              </>
            )}
          </aside>
        )}
      </main>

      <canvas className="vfx-canvas" ref={canvasRef} aria-hidden="true" />
      {flights.map((f) => (
        <CastFlight key={f.id} spellId={f.spellId} color={f.color} rect={f.rect} to={f.to} />
      ))}

      {confirm && !me && (
        <ConfirmDialog
          text={
            confirm === 'leave'
              ? 'Kilépsz a menübe? Ez a játszma nem folytatható később.'
              : confirm === 'resign'
                ? `${COLOR_NAME_HU[config.mode === 'ai' ? opposite(config.aiColor) : state.turn]} feladja a játszmát?`
                : 'Döntetlen megegyezéssel?'
          }
          yes={confirm === 'leave' ? 'Kilépek' : confirm === 'resign' ? 'Feladom' : 'Döntetlen'}
          onYes={() => {
            if (confirm === 'leave') onMenu();
            else dispatch(confirm === 'resign' ? { type: 'RESIGN', color: config.mode === 'ai' ? opposite(config.aiColor) : state.turn } : { type: 'AGREE_DRAW' });
            setConfirm(null);
          }}
          onNo={() => setConfirm(null)}
        />
      )}
      {confirm && me && (
        <ConfirmDialog
          text={
            confirm === 'resign'
              ? 'Feladod a játszmát?'
              : confirm === 'draw'
                ? `Döntetlent ajánlasz ${label(opposite(me))} játékosnak?`
                : ranked
                  ? 'Kilépsz? A rangsorolt játszma vereségnek számít, és csökken az Élő-pontszámod.'
                  : 'Kilépsz a szobából? A futó játszma feladásnak számít.'
          }
          yes={confirm === 'resign' ? 'Feladom' : confirm === 'draw' ? 'Ajánlom' : 'Kilépek'}
          tone={confirm === 'draw' ? 'primary' : 'danger'}
          onYes={() => {
            if (confirm === 'resign') dispatch({ type: 'RESIGN', color: me });
            else if (confirm === 'draw') sync?.offerDraw();
            else onMenu();
            setConfirm(null);
          }}
          onNo={() => setConfirm(null)}
        />
      )}
      {!confirm && me && net && playing && net.drawOffer && net.drawOffer !== me && (
        <ConfirmDialog
          text={`${label(net.drawOffer)} döntetlent ajánl. Elfogadod?`}
          yes="Elfogadom"
          no="Elutasítom"
          tone="primary"
          onYes={() => sync?.answerDraw(true)}
          onNo={() => sync?.answerDraw(false)}
        />
      )}
      {sheetOpen && phone && (
        <div className="overlay overlay-soft sheet-overlay" role="dialog" aria-modal="true" aria-label="Történet és aktív hatások" onClick={() => setSheetOpen(false)}>
          <div className="game-sheet frame-wood" onClick={(e: { stopPropagation(): void }) => e.stopPropagation()}>
            {sideTabs}
            <button type="button" className="btn btn-sm btn-iron sheet-close" onClick={() => setSheetOpen(false)} aria-label="Bezárás">
              <Icon name="close" scale={1} />
            </button>
          </div>
        </div>
      )}
      {inspect && (
        <SpellInspector
          spellId={inspect.id}
          list={inspect.list}
          onNavigate={(id) => setInspect({ ...inspect, id })}
          onClose={() => setInspect(null)}
          reduced={reduced}
        />
      )}
      {settingsOpen && (
        <div className="overlay overlay-soft" role="dialog" aria-modal="true" aria-label="Beállítások" onClick={() => setSettingsOpen(false)}>
          <div className="dialog frame-parchment settings-dialog" onClick={(e: { stopPropagation(): void }) => e.stopPropagation()}>
            <h3 className="dialog-title">
              <Icon name="gear" scale={2} /> Beállítások
            </h3>
            <SettingsBody prefs={prefs} onPrefs={onPrefs} />
            <div className="dialog-actions">
              <button type="button" className="btn btn-primary" onClick={() => setSettingsOpen(false)}>
                Kész
              </button>
            </div>
          </div>
        </div>
      )}
      {!playing && showOver && (
        <GameOverScreen
          state={state}
          human={human}
          names={names}
          reasonText={
            net?.forfeit
              ? net.forfeit.reason === 'time'
                ? `${label(net.forfeit.by)} lépésideje lejárt`
                : `${label(net.forfeit.by)} túl sokáig nem tért vissza`
              : undefined
          }
          extra={
            bot && chat.log.length > 0 ? (
              <div className="gameover-bot">
                <BotPortrait id={bot.id} scale={2} />
                <p>
                  <b>{bot.name}:</b> „{chat.log[chat.log.length - 1].text}”
                </p>
              </div>
            ) : ranked && me ? (
              <RatingResult change={net?.rated?.[me] ?? null} before={ranked[me]} />
            ) : null
          }
          onRematch={net ? (ranked ? (onNewOpponent ?? onMenu) : () => sync?.requestRematch()) : onRematch}
          rematch={rematchView}
          onMenu={onMenu}
          menuLabel={me ? 'Lobbi' : undefined}
          onClose={() => setShowOver(false)}
        />
      )}
    </div>
  );
}

/** A ranked game's result: the rating before and after (the server sends it right after the last step). */
function RatingResult({ change, before }: { change: { before: number; after: number } | null; before: number }) {
  if (!change) {
    return (
      <div className="gameover-rating is-pending">
        <Icon name="trophy" scale={2} />
        <span>
          Élő-pontszám: <b>{before}</b> – az új pontszám számolása…
        </span>
      </div>
    );
  }
  const d = change.after - change.before;
  return (
    <div className={`gameover-rating ${d > 0 ? 'is-up' : d < 0 ? 'is-down' : ''}`} id="rating-result">
      <Icon name="trophy" scale={2} />
      <span>
        Élő-pontszám: <b>{change.before}</b> → <b>{change.after}</b> <em>({d > 0 ? `+${d}` : d})</em>
      </span>
    </div>
  );
}
