// Presentation layer: every engine step must turn into a sane animation plan, and every
// spell effect must play to the end on the effect engine without throwing.
import { describe, expect, it } from 'vitest';
import { applyAction, createGame, SPELL_LIST, validTargets } from '../src/engine';
import type { Action, GameState, SpellId } from '../src/engine';
import { choreograph, rewindPlan, T } from '../src/ui/vfx/choreo';
import { DOOM, DOOM_PLAIN } from '../src/ui/vfx/doom';
import { VfxEngine } from '../src/ui/vfx/engine';
import { reaperTimeline } from '../src/ui/vfx/reaper';

const MID = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 1';

function start(id: SpellId, fen = MID): GameState {
  const others = SPELL_LIST.map((s) => s.id).filter((x) => x !== id).slice(0, 5);
  return createGame({ fen, decks: { w: [id, ...others], b: ['wall', 'mine', 'weaken', 'root', 'silence', 'gravity'] }, mana: { w: 6, b: 4 }, seed: 3 });
}

function pick(s: GameState, id: SpellId): number[] | null {
  const picked: number[] = [];
  const steps = SPELL_LIST.find((x) => x.id === id)!.steps.length;
  for (let i = 0; i < steps; i++) {
    const opts = validTargets(s, id, picked);
    if (!opts.length) return null;
    picked.push(opts[Math.floor(opts.length / 2)]);
  }
  return picked;
}

// Minimal browser stand-ins so the effect engine can run headless.
function headlessEngine() {
  const g = globalThis as Record<string, unknown>;
  g.ImageData ??= class {
    data: Uint8ClampedArray;
    constructor(
      public width: number,
      public height: number,
    ) {
      this.data = new Uint8ClampedArray(width * height * 4);
    }
  };
  let pending: ((t: number) => void) | null = null;
  g.requestAnimationFrame = (cb: (t: number) => void) => {
    pending = cb;
    return 1;
  };
  g.cancelAnimationFrame = () => {
    pending = null;
  };
  g.document ??= { querySelector: () => null };
  const e = new VfxEngine();
  e.attach({ width: 0, height: 0, style: {}, getContext: () => ({ putImageData() {} }) } as unknown as HTMLCanvasElement);
  const r = (left: number, top: number, width: number, height: number) => ({ left, top, width, height }) as DOMRect;
  e.layout(r(0, 0, 1440, 860), r(460, 200, 480, 480), false);
  const run = (maxFrames = 600) => {
    let t = 0;
    let frames = 0;
    while (pending && frames < maxFrames) {
      const cb = pending;
      pending = null;
      t += 16;
      cb(t);
      frames++;
    }
    return frames;
  };
  return { e, run };
}

describe('choreography', () => {
  it('plans a quiet move: the mover slides, the turn banner follows', () => {
    const s0 = createGame({ decks: { w: [], b: [] } });
    const a: Action = { type: 'MOVE', from: 12, to: 28 };
    const r = applyAction(s0, a);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const plan = choreograph({ id: 1, action: a, before: s0, after: r.state });
    const mover = s0.board[12]!.id;
    expect(plan.motions[mover]?.mode).toBe('slide');
    expect(plan.bannerAt).not.toBeNull();
    expect(plan.bannerAt!).toBeGreaterThanOrEqual(plan.motions[mover]!.dur);
  });

  it('knights leap and captures break when the attacker arrives', () => {
    const s0 = createGame({ fen: '4k3/8/8/3p4/8/4N3/8/4K3 w - - 0 1', decks: { w: [], b: [] } });
    const a: Action = { type: 'MOVE', from: 20, to: 35 };
    const r = applyAction(s0, a);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const plan = choreograph({ id: 2, action: a, before: s0, after: r.state });
    expect(plan.motions[s0.board[20]!.id]?.mode).toBe('leap');
    expect(plan.mana.w).toBeDefined();
    expect(plan.mana.w!.to).toBe(r.state.players.w.mana);
  });

  it('no turn banner once the game is decided', () => {
    const s0 = createGame({ fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', decks: { w: [], b: [] } });
    const a: Action = { type: 'MOVE', from: 3, to: 59 };
    const r = applyAction(s0, a);
    expect(r.ok && r.state.status.kind).toBe('checkmate');
    if (!r.ok) return;
    const plan = choreograph({ id: 3, action: a, before: s0, after: r.state });
    expect(plan.bannerAt).toBeNull();
    expect(plan.checkAt).not.toBeNull();
    expect(plan.overAt).toBeGreaterThan(plan.checkAt!);
  });

  it('Végítélet: the Reaper cuts its victims one after another and then leaves', () => {
    const others = SPELL_LIST.map((x) => x.id).filter((x) => x !== 'doomsday').slice(0, 5);
    const s0 = createGame({ fen: 'r3k2r/p4ppp/8/8/2p1p3/1p4p1/P1PP1P1P/RNBQKBNR w KQkq - 0 1', decks: { w: ['doomsday', ...others], b: [] }, mana: { w: 6, b: 3 } });
    const a: Action = { type: 'CAST', spellId: 'doomsday', targets: [] };
    const r = applyAction(s0, a);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ev = r.state.events.find((x) => x.type === 'spell');
    const squares = ev && 'squares' in ev && ev.squares ? ev.squares : [];
    expect(squares).toHaveLength(4);
    const hits = reaperTimeline(squares).visits.map((v) => v.hitAt);
    hits.forEach((h, i) => i > 0 && expect(h).toBeGreaterThan(hits[i - 1] + 200));
    const { e, run } = headlessEngine();
    choreograph({ id: 99, action: a, before: s0, after: r.state }).play(e);
    expect(run(900)).toBeLessThan(900);
    expect(e.busy).toBe(false);
  });

  it('Üvegátok: the cursed attacker travels, cracks and shatters before the turn passes', () => {
    const s0 = createGame({ fen: '4k3/8/8/8/r3N3/8/7P/4K3 w - - 0 1', decks: { w: ['glassCurse'], b: [] }, mana: { w: 6, b: 3 } });
    const s1 = applyAction(s0, { type: 'CAST', spellId: 'glassCurse', targets: [24] }); // a4
    expect(s1.ok).toBe(true);
    if (!s1.ok) return;
    const s2 = applyAction(s1.state, { type: 'MOVE', from: 4, to: 3 });
    expect(s2.ok).toBe(true);
    if (!s2.ok) return;
    const a: Action = { type: 'MOVE', from: 24, to: 28 }; // Rxe4, and the rook breaks
    const r = applyAction(s2.state, a);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const plan = choreograph({ id: 8, action: a, before: s2.state, after: r.state });
    expect(plan.bannerAt).not.toBeNull();
    expect(plan.bannerAt!).toBeGreaterThan(700); // the banner waits for the shatter
    const { e, run } = headlessEngine();
    plan.play(e);
    expect(run(900)).toBeLessThan(900);
    expect(e.busy).toBe(false);
  });

  it('Végzet, first cast: one short blow – the neighbours fly on the impact, nothing is locked', () => {
    const s0 = createGame({ fen: '4k3/8/8/4Ppp1/6P1/8/7P/4K3 w - - 0 1', decks: { w: ['doom'], b: [] }, mana: { w: 6, b: 3 } });
    const a: Action = { type: 'CAST', spellId: 'doom', targets: [37] }; // f5: the plain form takes a pawn
    const r = applyAction(s0, a);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const plan = choreograph({ id: 12, action: a, before: s0, after: r.state });
    expect(plan.lock).toBeUndefined();
    const thrown = Object.values(plan.motions);
    expect(thrown).toHaveLength(3); // e5, g5, g4
    for (const m of thrown) {
      expect(m.mode).toBe('blast');
      expect(m.delay).toBe(T.castStart + DOOM_PLAIN.impact);
    }
    expect(plan.mana.b).toMatchObject({ from: 3, to: 4, gainAt: T.castStart + DOOM_PLAIN.paid });
    expect(plan.bannerAt ?? plan.overAt).toBeLessThan(3000);
    const { e, run } = headlessEngine();
    plan.play(e);
    expect(run(1200)).toBeLessThan(1200);
    expect(e.busy).toBe(false);
  });

  it('Végzet, awakened: a long cinematic that locks the board, throws the neighbours on the boom and ends', () => {
    const s = createGame({ fen: '4k3/8/8/4Pbp1/6P1/8/7P/4K3 w - - 0 1', decks: { w: ['doom'], b: [] }, mana: { w: 6, b: 3 } });
    // the card has gone round the deck once: it is charged
    const s0: GameState = { ...s, players: { ...s.players, w: { ...s.players.w, charges: { doom: 2 } } } };
    const a: Action = { type: 'CAST', spellId: 'doom', targets: [37] }; // f5
    const r = applyAction(s0, a);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const plan = choreograph({ id: 11, action: a, before: s0, after: r.state });
    expect(plan.lock).toBeGreaterThan(7500);
    // the opponent's +1 forms at the very end, still under the lock
    expect(plan.mana.b).toMatchObject({ from: 3, to: 4, gainAt: T.castStart + DOOM.paid });
    expect(plan.mana.b!.gainAt).toBeLessThan(plan.lock!);
    const thrown = Object.values(plan.motions);
    expect(thrown).toHaveLength(3); // e5, g5, g4
    for (const m of thrown) {
      expect(m.mode).toBe('blast');
      expect(m.delay).toBeGreaterThan(4000); // on the boom, not before
    }
    const { e, run } = headlessEngine();
    plan.play(e);
    expect(run(1200)).toBeLessThan(1200);
    expect(e.busy).toBe(false);
  });

  it('undo: the mover glides back, the taken piece returns, no banner', () => {
    const s0 = createGame({ fen: '4k3/8/8/3p4/8/4N3/8/4K3 w - - 0 1', decks: { w: [], b: [] } });
    const a: Action = { type: 'MOVE', from: 20, to: 35 }; // Nxd5
    const r = applyAction(s0, a);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const plan = rewindPlan({ id: 7, action: a, before: r.state, after: s0, rewind: true });
    expect(plan.motions[s0.board[20]!.id]?.mode).toBe('rewind');
    expect(plan.motions[s0.board[35]!.id]?.mode).toBe('return');
    expect(plan.bannerAt).toBeNull();
    expect(plan.checkAt).toBeNull();
    expect(plan.cast).toBeNull();
    expect(plan.mana).toEqual({});
  });

  it('undo of a spell that made pieces: they blink out and the effects finish', () => {
    const { e, run } = headlessEngine();
    let checked = 0;
    for (const id of ['clone', 'brigade'] as SpellId[]) {
      const s0 = start(id);
      const t = pick(s0, id);
      if (!t) continue;
      const a: Action = { type: 'CAST', spellId: id, targets: t };
      const r = applyAction(s0, a);
      if (!r.ok) continue;
      const made = r.state.board.filter((p) => p && !s0.board.some((q) => q?.id === p.id));
      expect(made.length).toBeGreaterThan(0);
      const plan = rewindPlan({ id: 50 + checked, action: a, before: r.state, after: s0, rewind: true });
      for (const p of made) expect(plan.motions[p!.id]).toBeUndefined();
      plan.play(e);
      expect(e.busy).toBe(true); // the made pieces' ghosts
      expect(run()).toBeLessThan(120);
      expect(e.busy).toBe(false);
      checked++;
    }
    expect(checked).toBe(2);
  });

  it('every castable spell yields a plan whose effects run to completion', () => {
    const { e, run } = headlessEngine();
    let played = 0;
    for (const spell of SPELL_LIST) {
      const s0 = start(spell.id);
      const t = pick(s0, spell.id);
      if (!t) continue;
      const a: Action = { type: 'CAST', spellId: spell.id, targets: t };
      const r = applyAction(s0, a);
      if (!r.ok) continue;
      const plan = choreograph({ id: 10 + played, action: a, before: s0, after: r.state });
      expect(plan.cast).toEqual({ color: 'w', spellId: spell.id });
      for (const id of Object.keys(plan.motions)) {
        expect(r.state.board.some((p) => p?.id === id)).toBe(true);
      }
      expect(plan.mana.w?.to ?? r.state.players.w.mana).toBe(r.state.players.w.mana);
      plan.play(e);
      const frames = run();
      expect(frames).toBeLessThan(600); // everything expires on its own
      expect(e.busy).toBe(false);
      played++;
    }
    expect(played).toBeGreaterThanOrEqual(58);
  });
});
