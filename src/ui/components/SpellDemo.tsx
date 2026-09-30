// ─────────────────────────────────────────────────────────────────────────────
// Spell demo: a small war table that replays how a spell is used. A pointing
// glove picks the card from the hand and aims it exactly like a player would,
// the spell lands with the real game choreography and effects, and (where it
// helps) a follow-up move shows what the spell made possible. Every step is
// executed by the real engine (see demo/scenarios.ts), then the table resets
// and the demo loops. A card that charges up („Végzet”) is played twice: plain,
// then – a deck cycle later – awakened.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { applyAction, chargeOf, effectiveCost, hand, legalMoves, lostTypes, maxMana, SPELLS, validTargets } from '../../engine';
import type { Action, Color, GameState, Move, PromotionPiece, SpellId, Square } from '../../engine';
import { sfx, type SfxName } from '../audio/sound';
import { buildDemo, type DemoStep } from '../demo/scenarios';
import { CATEGORY_COLOR } from '../format';
import { POINTER, POINTER_TIP } from '../pixel/art/pointer';
import { awakenFx, choreograph, type Plan } from '../vfx/choreo';
import { VfxEngine } from '../vfx/engine';
import { Board } from './Board';
import { ManaCrystals } from './ManaCrystals';
import { CheckStamp, PromotionDialog } from './Overlays';
import { Icon, SpellIcon, Sprite } from './pixel';
import { SpellCard } from './SpellCard';

/** Board scales the demo may use (CSS px per art pixel); the board art is 184 px with its frame. */
const SCALES = [2.5, 2, 1.75, 1.5, 1.25, 1];
const BOARD_ART = 184;
/** The hand cards grow with the board (`--bs × 10 + 32px`); the hand row adds 12 px around them. */
const handCard = (k: number) => 10 * k + 32;
/** Gap between the rows / columns of the demo table (CSS: .demo-screen). */
const GAP = 6;

type SoundMode = 'auto' | 'on' | 'off';
/** Shared by every demo in the session. 'auto': a demo's first run is heard, its loops are silent. */
let soundMode: SoundMode = 'auto';

interface Box {
  x: number;
  y: number;
  left: number;
  top: number;
  w: number;
  h: number;
}

interface Flight {
  id: number;
  /** The card on its way to the table. */
  spell: SpellId;
  left: number;
  top: number;
  w: number;
  h: number;
  tx: number;
  ty: number;
}

interface View {
  state: GameState;
  plan: Plan | null;
  card: 'idle' | 'active' | 'armed';
  targets: Square[] | null;
  picked: Square[];
  selected: Square | null;
  moves: Move[];
  lastMove: { from: Square; to: Square } | null;
  /** Whose turn the table shows (switches with the turn-banner timing, like the game). */
  turn: Color;
  flight: Flight | null;
  stamp: { id: number; mate: boolean } | null;
  /** The promotion choice is on the table (opens once the spell has landed). */
  promoOpen: boolean;
  /** The promotion choice the glove is pointing at. */
  promoHot: PromotionPiece | null;
  fading: boolean;
}

interface Caption {
  /** Step number while the spell is being played; null for the result line. */
  step: number | null;
  text: string;
}

interface Pointer {
  x: number;
  y: number;
  on: boolean;
  press: number;
  dur: number;
}

const freshView = (s: GameState, fading = false): View => ({
  state: s,
  plan: null,
  card: 'idle',
  targets: null,
  picked: [],
  selected: null,
  moves: [],
  lastMove: null,
  turn: s.turn,
  flight: null,
  stamp: null,
  promoOpen: false,
  promoHot: null,
  fading,
});

const FIRST_CAPTION = 'Kattints a lapra a kezedben.';
let planSeq = 1;

interface Props {
  spell: SpellId;
  reduced: boolean;
  /**
   * Height (px) the demo may take up so that its host fits the window; called with the demo's
   * root element. Without it the demo keeps `reserve` px of the window free.
   */
  room?: (demo: HTMLElement) => number | null;
  reserve?: number;
}

export function SpellDemo({ spell, reduced, room, reserve = 160 }: Props) {
  const script = useMemo(() => buildDemo(spell), [spell]);
  const sp = SPELLS[spell];
  const engine = useMemo(() => new VfxEngine(), []);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scale, setScale] = useState(2);
  /** Hand beside the board (like the game's wide layout) instead of under it. */
  const [side, setSide] = useState(false);
  const [view, setView] = useState<View | null>(() => (script ? freshView(script.start) : null));
  const [pointer, setPointer] = useState<Pointer>({ x: 0, y: 0, on: false, press: 0, dur: 0 });
  const [caption, setCaption] = useState<Caption>({ step: 1, text: FIRST_CAPTION });
  const [run, setRun] = useState(0);
  const [finished, setFinished] = useState(false);
  const [audible, setAudible] = useState(soundMode !== 'off');
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const sideRef = useRef(side);
  sideRef.current = side;
  const roomRef = useRef(room);
  roomRef.current = room;
  engine.reduced = reduced;

  // ── effect engine on the demo's own canvas ──
  useEffect(() => {
    engine.attach(canvasRef.current);
    engine.scope = stageRef.current;
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
          { transform: 'translate(0, 0)' },
        ],
        { duration: dur, easing: 'linear' },
      );
    };
    return () => {
      engine.reset();
      engine.attach(null);
      engine.scope = null;
      engine.onShake = null;
    };
  }, [engine]);

  const relayout = useCallback(() => {
    const st = stageRef.current;
    const b = boardRef.current;
    if (st && b) engine.layout(st.getBoundingClientRect(), b.getBoundingClientRect(), false);
  }, [engine]);

  // ── board size: as large as the column and the window allow ──
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const cur = scaleRef.current;
      const boardH = frameRef.current?.offsetHeight || BOARD_ART * cur;
      // height around the board that does not depend on its size: bars, caption, tools
      let chrome = el.offsetHeight - boardH;
      if (!sideRef.current) chrome -= (el.querySelector<HTMLElement>('.demo-bar-bottom')?.offsetHeight ?? 0) + GAP;
      const h = roomRef.current?.(el) ?? window.innerHeight - reserve;
      const roomH = h - chrome - 6;
      const w = el.clientWidth - 24;
      const best = (fits: (k: number) => boolean) => SCALES.find(fits) ?? 1;
      // hand under the board …
      const kBottom = best((k) => BOARD_ART * k <= w && BOARD_ART * k + handCard(k) + 12 + GAP <= roomH);
      // … or beside it, when the column is wide but the window is short
      const kSide = best((k) => BOARD_ART * k + handCard(k) + 4 * GAP <= w && BOARD_ART * k <= roomH);
      const useSide = kSide > kBottom;
      setSide(useSide);
      setScale(useSide ? kSide : kBottom);
    };
    measure();
    const ro = new ResizeObserver(() => {
      measure();
      relayout();
    });
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [reserve, relayout]);
  useLayoutEffect(() => relayout(), [scale, relayout]);

  // ── each engine step plays its choreography on the demo canvas ──
  const plan = view?.plan ?? null;
  useLayoutEffect(() => {
    if (!plan) return;
    relayout();
    plan.play(engine);
  }, [plan, engine, relayout]);

  // ── the script: card → targets → cast → follow-up moves → hold → loop ──
  useEffect(() => {
    if (!script) return;
    let alive = true;
    const timers = new Set<number>();
    const later = (ms: number, fn: () => void) => {
      const t = window.setTimeout(() => {
        timers.delete(t);
        if (alive) fn();
      }, ms);
      timers.add(t);
    };
    const wait = (ms: number) => new Promise<void>((res) => later(ms, res));
    const patch = (p: Partial<View> | ((v: View) => Partial<View>)) => setView((v) => (v ? { ...v, ...(typeof p === 'function' ? p(v) : p) } : v));
    const play = (n: SfxName) => {
      if (!engine.muted) sfx(n);
    };
    const find = (sel: string) => stageRef.current?.querySelector(sel) ?? null;
    const squareEl = (s: Square) => find(`.board [data-square="${s}"]`);
    const box = (el: Element | null): Box | null => {
      const st = stageRef.current;
      if (!st || !el) return null;
      const a = st.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return null;
      return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2, left: r.left - a.left, top: r.top - a.top, w: r.width, h: r.height };
    };
    const goTo = async (el: Element | null, ms: number) => {
      const b = box(el);
      if (b) setPointer((q) => ({ ...q, x: b.x, y: b.y, on: true, dur: ms }));
      await wait(ms + 60);
    };
    const tap = async () => {
      setPointer((q) => ({ ...q, press: q.press + 1 }));
      await wait(170);
    };
    const hidePointer = () => setPointer((q) => ({ ...q, on: false }));

    /** Runs one action through the engine and the choreographer; schedules the table-side cues. */
    const exec = (s: GameState, a: Action) => {
      const r = applyAction(s, a);
      if (!r.ok) return null;
      const p = choreograph({ id: planSeq++, action: a, before: s, after: r.state });
      if (r.state.turn !== s.turn) later(p.bannerAt ?? 0, () => patch({ turn: r.state.turn }));
      if (p.checkAt !== null) {
        const id = p.id;
        const mate = r.state.status.kind === 'checkmate';
        later(p.checkAt, () => patch({ stamp: { id, mate } }));
        later(p.checkAt + 1100, () => patch((v) => (v.stamp?.id === id ? { stamp: null } : {})));
      }
      return { state: r.state, plan: p };
    };

    /** Waits for the pieces to arrive and the effects to burn out (bounded). */
    const settle = async (p: Plan, min: number) => {
      const ends = Object.values(p.motions).map((m) => m.delay + m.dur + 160);
      await wait(Math.max(min, p.terrainAt + 300, ...ends));
      for (let i = 0; i < 40 && engine.busy; i++) await wait(100);
    };

    const cast = async (step: Extract<DemoStep, { kind: 'cast' }>, s: GameState): Promise<GameState | null> => {
      const spell = SPELLS[step.spell];
      const cost = effectiveCost(s, 'w', spell, step.targets);
      setCaption({ step: 1, text: `Kattints a lapra a kezedben – ára ${cost} mana.` });
      await goTo(find('[data-demo-card] .card-face'), 640);
      await tap();
      play('cardPick');
      if (!spell.steps.length) {
        patch({ card: 'armed' });
        setCaption({ step: 2, text: 'Nincs célpontja: erősítsd meg a kijátszást.' });
        await wait(520);
        await goTo(find('.demo-confirm'), 420);
        await tap();
      } else {
        patch({ card: 'active', targets: validTargets(s, spell.id, []), picked: [] });
        const quick = step.targets.length > 2;
        for (let k = 0; k < step.targets.length; k++) {
          setCaption({ step: k + 2, text: spell.steps[k]?.prompt ?? 'Válaszd ki a célpontot.' });
          await wait(k === 0 ? 620 : quick ? 140 : 320);
          await goTo(squareEl(step.targets[k]), quick ? 340 : 480);
          await tap();
          play('click');
          const picked = step.targets.slice(0, k + 1);
          patch({ picked, targets: k + 1 < step.targets.length ? validTargets(s, spell.id, picked) : null });
        }
        await wait(160);
      }
      const from = box(find('[data-demo-card] .card-face'));
      const board = box(boardRef.current);
      const r = exec(s, { type: 'CAST', spellId: spell.id, targets: step.targets });
      if (!r) return null;
      const fid = r.plan.id;
      patch({
        state: r.state,
        plan: r.plan,
        card: 'idle',
        targets: null,
        picked: [],
        flight: from && board ? { id: fid, spell: spell.id, left: from.left, top: from.top, w: from.w, h: from.h, tx: board.x - from.x, ty: board.y - from.y } : null,
      });
      later(640, () => patch((v) => (v.flight?.id === fid ? { flight: null } : {})));
      play('manaSpend');
      hidePointer();
      setCaption({ step: null, text: step.note ?? (script.note || spell.description) });
      await settle(r.plan, 900);
      return r.state;
    };

    /**
     * „Körforgás”: a few turns pass. The other cards of the hand are played one after the other
     * (they fly off to the table), until the charged card is back in the hand – awakened.
     */
    const cycle = async (step: Extract<DemoStep, { kind: 'cycle' }>, s: GameState): Promise<GameState | null> => {
      hidePointer();
      await wait(2600); // time to read what the first cast did
      setCaption({ step: null, text: step.note });
      await wait(600);
      let cur = s;
      for (const deck of step.decks) {
        const leaving = hand(cur, 'w').find((id) => !deck.slice(0, 3).includes(id));
        const from = leaving ? box(find(`.demo-hand [data-spell="${leaving}"] .card-face`)) : null;
        const board = box(boardRef.current);
        const fid = planSeq++;
        cur = { ...cur, players: { ...cur.players, w: { ...cur.players.w, deck } } };
        patch({
          state: cur,
          flight: from && board && leaving ? { id: fid, spell: leaving, left: from.left, top: from.top, w: from.w, h: from.h, tx: board.x - from.x, ty: board.y - from.y } : null,
        });
        later(560, () => patch((v) => (v.flight?.id === fid ? { flight: null } : {})));
        play('cardPick');
        await wait(560);
      }
      // …the crystals have filled up again, and the charged card is back: awakened
      const refill: Plan = {
        id: planSeq++,
        motions: {},
        mana: Object.fromEntries(
          (['w', 'b'] as Color[])
            .filter((c) => cur.players[c].mana !== step.to.players[c].mana)
            .map((c) => [c, { from: cur.players[c].mana, mid: cur.players[c].mana, to: step.to.players[c].mana, spendAt: 0, gainAt: 120, wasted: 0 }]),
        ),
        cast: null,
        terrainAt: 0,
        bannerAt: null,
        checkAt: null,
        overAt: 0,
        play: (e) => awakenFx(e, 'w', script.spell, 60),
      };
      patch({ state: step.to, plan: refill, turn: step.to.turn, lastMove: null });
      await wait(1900);
      return step.to;
    };

    const move = async (step: Extract<DemoStep, { kind: 'move' }>, s: GameState): Promise<GameState | null> => {
      const mover = s.board[step.from];
      if (!mover) return null;
      const mine = mover.color === 'w';
      if (mine) {
        await goTo(squareEl(step.from), 560);
        await tap();
        play('cardPick');
        patch({ selected: step.from, moves: legalMoves(s).filter((m) => m.from === step.from) });
        await wait(440);
        await goTo(squareEl(step.to), 460);
        await tap();
      } else {
        // the opponent answers on its own (no glove on the other side of the table)
        hidePointer();
        await wait(760);
      }
      const r = exec(s, { type: 'MOVE', from: step.from, to: step.to });
      if (!r) return null;
      patch({ state: r.state, plan: r.plan, selected: null, moves: [], lastMove: { from: step.from, to: step.to } });
      if (mine) later(160, hidePointer);
      await settle(r.plan, 560);
      return r.state;
    };

    /** A pawn waits for its new shape: the glove picks it in the promotion choice. */
    const promote = async (step: Extract<DemoStep, { kind: 'promote' }>, s: GameState, n: number): Promise<GameState | null> => {
      setCaption({ step: n, text: 'Válaszd ki, mivé változzon a gyalog.' });
      patch({ promoOpen: true });
      play('open');
      await wait(620);
      await goTo(find(`.demo-board .promo-option[data-piece="${step.piece}"]`), 520);
      patch({ promoHot: step.piece });
      await tap();
      play('click');
      const r = exec(s, { type: 'PROMOTE', piece: step.piece });
      if (!r) return null;
      patch({ state: r.state, plan: r.plan, promoOpen: false, promoHot: null });
      hidePointer();
      setCaption({ step: null, text: script.note || SPELLS[script.spell].description });
      await settle(r.plan, 700);
      return r.state;
    };

    const rest = (): { x: number; y: number } => {
      const st = stageRef.current;
      return st ? { x: st.clientWidth - 28, y: st.clientHeight - 16 } : { x: 0, y: 0 };
    };

    void (async () => {
      let first = true;
      for (;;) {
        engine.reset();
        engine.muted = soundMode === 'off' || (soundMode === 'auto' && !first);
        setAudible(!engine.muted);
        setFinished(false);
        setView(freshView(script.start, !first));
        const r0 = rest();
        setPointer({ x: r0.x, y: r0.y, on: false, press: 0, dur: 0 });
        setCaption({ step: 1, text: FIRST_CAPTION });
        if (first) await wait(700);
        else {
          await wait(80);
          patch({ fading: false });
          await wait(460);
        }
        let s = script.start;
        const promoStep = Math.max(1, SPELLS[script.spell].steps.length) + 2; // after the card and its targets (or its confirm)
        for (const step of script.steps) {
          const next =
            step.kind === 'cast'
              ? await cast(step, s)
              : step.kind === 'promote'
                ? await promote(step, s, promoStep)
                : step.kind === 'cycle'
                  ? await cycle(step, s)
                  : await move(step, s);
          if (!next) break;
          s = next;
        }
        hidePointer();
        await wait(2300);
        if (reducedRef.current) {
          setFinished(true);
          return;
        }
        patch({ fading: true });
        await wait(380);
        first = false;
      }
    })();

    return () => {
      alive = false;
      timers.forEach((t) => window.clearTimeout(t));
      timers.clear();
      engine.reset();
    };
  }, [script, run, engine]);

  const targetSet = useMemo(() => (view?.targets ? new Set(view.targets) : null), [view?.targets]);

  const toggleSound = () => {
    const on = !audible;
    soundMode = on ? 'on' : 'off';
    engine.muted = !on;
    setAudible(on);
  };

  if (!script || !view) {
    return (
      <div className="demo" ref={rootRef}>
        <p className="demo-caption">
          <Icon name="scroll" scale={1} /> Ehhez a spellhez nincs bemutató.
        </p>
      </div>
    );
  }

  const st = view.state;
  const cards = hand(st, 'w');
  const crystalScale = scale >= 2 ? 1.5 : 1;
  const pScale = scale >= 2 ? 3 : 2;
  const tipX = POINTER_TIP.x * pScale;
  const tipY = POINTER_TIP.y * pScale;

  return (
    <div
      className={`demo ${finished ? 'is-finished' : ''} ${scale < 2 ? 'is-small' : ''} ${side ? 'is-side' : ''}`}
      ref={rootRef}
      style={{ ['--cs' as string]: String(crystalScale) }}
    >
      <div className={`demo-stage ${view.fading ? 'is-fading' : ''}`} ref={stageRef} style={{ ['--bs' as string]: `${scale}px` }} aria-hidden="true" inert>
        <div className="demo-screen">
          <div className="demo-bar demo-bar-top">
            <span className="demo-who">
              <Icon name="crestB" scale={1} /> <span className="demo-who-name">Sötét</span>
            </span>
            <ManaCrystals color="b" mana={st.players.b.mana} cap={maxMana(st, 'b')} anim={view.plan?.mana.b} planId={view.plan?.id ?? 0} scale={crystalScale} showCount={false} />
            <span className={`demo-turn is-${view.turn}`}>{view.turn === 'w' ? 'Világos köre' : 'Sötét köre'}</span>
          </div>

          <div className="board-stage demo-board">
            <Board
              state={st}
              flipped={false}
              scale={scale}
              selected={view.selected}
              moveTargets={view.moves}
              spellTargets={targetSet}
              picked={view.picked}
              targetColor={view.targets ? CATEGORY_COLOR[sp.category] : null}
              lastMove={view.lastMove}
              plan={view.plan}
              canAct={false}
              turning={false}
              reduced={reduced}
              onSquareClick={noop}
              onCancel={noop}
              boardRef={boardRef}
              frameRef={frameRef}
            />
            {view.stamp && <CheckStamp key={view.stamp.id} mate={view.stamp.mate} />}
            {view.promoOpen && st.pendingPromotion && (
              <PromotionDialog color={st.pendingPromotion.color} lost={lostTypes(st, st.pendingPromotion.color)} onPick={noop} hot={view.promoHot} />
            )}
          </div>

          <div className="demo-bar demo-bar-bottom">
            <span className="demo-who">
              <Icon name="crestW" scale={1} /> <span className="demo-who-name">Világos</span>
            </span>
            <div className="demo-hand" data-hand="w">
              {cards.map((id) => {
                const isDemo = id === spell;
                return (
                  <div key={id} className="demo-hand-slot" data-demo-card={isDemo ? '' : undefined}>
                    <SpellCard
                      spell={SPELLS[id]}
                      cost={effectiveCost(st, 'w', SPELLS[id])}
                      blockReason={null}
                      interactive
                      size="mini"
                      active={isDemo && view.card === 'active'}
                      armed={isDemo && view.card === 'armed'}
                      charge={chargeOf(st, 'w', id)}
                    />
                    {isDemo && view.card === 'armed' && (
                      <span className="btn btn-primary btn-sm demo-confirm">
                        <Icon name="rune" scale={1} /> Kijátszás
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <ManaCrystals color="w" mana={st.players.w.mana} cap={maxMana(st, 'w')} anim={view.plan?.mana.w} planId={view.plan?.id ?? 0} scale={crystalScale} showCount={false} />
          </div>
        </div>

        <canvas className="vfx-canvas" ref={canvasRef} />
        {view.flight && (
          <div
            key={view.flight.id}
            className="demo-flight"
            data-cat={SPELLS[view.flight.spell].category}
            style={{
              left: `${view.flight.left}px`,
              top: `${view.flight.top}px`,
              width: `${view.flight.w}px`,
              height: `${view.flight.h}px`,
              ['--tx' as string]: `${view.flight.tx}px`,
              ['--ty' as string]: `${view.flight.ty}px`,
            }}
          >
            <SpellIcon id={view.flight.spell} fill />
          </div>
        )}
        {pointer.press > 0 && <span key={`r${pointer.press}`} className="demo-ripple" style={{ left: `${pointer.x}px`, top: `${pointer.y}px` }} />}
        <div
          className={`demo-pointer ${pointer.on ? '' : 'is-off'}`}
          style={{ transform: `translate(${Math.round(pointer.x - tipX)}px, ${Math.round(pointer.y - tipY)}px)`, transitionDuration: `${reduced ? 0 : pointer.dur}ms, 220ms` }}
        >
          <span key={pointer.press} className={`demo-pointer-hand ${pointer.press ? 'is-press' : ''}`}>
            <Sprite src={POINTER} scale={pScale} />
          </span>
        </div>
      </div>

      <div className="demo-foot">
        <p className={`demo-caption ${caption.step === null ? 'is-result' : ''}`}>
          {caption.step !== null ? <b className="demo-step">{caption.step}.</b> : <SpellIcon id={spell} scale={2} className="demo-result-icon" />}
          <span key={caption.text} className="demo-caption-text">
            {caption.text}
          </span>
        </p>
        <div className="demo-tools">
          <button
            type="button"
            className={`btn btn-sm btn-iron btn-icon ${audible ? '' : 'is-muted'}`}
            onClick={toggleSound}
            aria-pressed={audible}
            aria-label="A bemutató hangja"
            title={audible ? 'A bemutató hangja: be' : 'A bemutató hangja: ki'}
          >
            <Icon name={audible ? 'soundOn' : 'soundOff'} scale={1} />
          </button>
          <button
            type="button"
            className={`btn btn-sm btn-icon ${finished ? 'btn-primary' : 'btn-iron'}`}
            onClick={() => setRun((n) => n + 1)}
            aria-label="A bemutató újraindítása"
            title="Újra"
          >
            <Icon name="rotate" scale={1} />
          </button>
        </div>
      </div>
    </div>
  );
}

function noop(): void {}
