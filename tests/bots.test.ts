// The bots: every level plays only legal actions within its time, the strong ones take what hangs
// and see a mate in one, every personality has something to say about the big moments (with the
// placeholders filled in), and every portrait is a clean 32 × 32 pixel bust.
import { describe, expect, it } from 'vitest';
import { botNextAction, scoreMoves } from '../src/ai/botSearch';
import { PERSONAS, chatEvents, fill, freshMemory, linesFor, pickLine } from '../src/bots/chat';
import type { ChatTrigger } from '../src/bots/persona';
import { BOT_IDS, BOTS, botFullName } from '../src/bots/roster';
import { BOT_STRENGTH } from '../src/bots/strength';
import { applyAction, createGame, PRESET_DECKS } from '../src/engine';
import type { Action, GameState } from '../src/engine';
import { PALETTE } from '../src/ui/pixel/palette';
import { PORTRAITS } from '../src/ui/pixel/art/portraits';
import { resolveSprite, spriteGrid } from '../src/ui/pixel/sprite';
import { game, S } from './helpers';

/** A deterministic random source. */
function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('the roster', () => {
  it('eleven bots, Elo rising from Kende (100) to Oli (3000), each with a strength and a persona', () => {
    expect(BOT_IDS).toHaveLength(11);
    const elos = BOT_IDS.map((id) => BOTS[id].elo);
    expect(elos).toEqual([...elos].sort((a, b) => a - b));
    expect(elos[0]).toBe(100);
    expect(elos.at(-1)).toBe(3000);
    for (const id of BOT_IDS) {
      expect(BOT_STRENGTH[id]).toBeDefined();
      expect(PERSONAS[id]).toBeDefined();
      expect(BOTS[id].bio.length).toBeGreaterThan(20);
    }
    expect(botFullName(BOTS.kende)).toBe('Kende the genius');
    expect(botFullName(BOTS.erika)).toBe('Erika the English teacher');
    expect(botFullName(BOTS.oli)).toBe('Oli the phone taker');
  });

  it('the knobs get stronger up the ladder: less randomness, deeper search, more time', () => {
    const s = BOT_IDS.map((id) => BOT_STRENGTH[id]);
    for (let i = 1; i < s.length; i++) {
      expect(s[i].randomMove).toBeLessThanOrEqual(s[i - 1].randomMove);
      expect(s[i].depth).toBeGreaterThanOrEqual(s[i - 1].depth);
      expect(s[i].timeMs).toBeGreaterThanOrEqual(s[i - 1].timeMs);
    }
  });
});

describe('playing', () => {
  it('every bot plays a whole opening of legal actions, each within its time budget (plus a margin)', () => {
    for (const id of BOT_IDS) {
      const rand = seeded(42);
      let s = createGame({ decks: { w: PRESET_DECKS[0].spells, b: PRESET_DECKS[1].spells }, seed: 7 });
      const st = { ...BOT_STRENGTH[id], timeMs: Math.min(BOT_STRENGTH[id].timeMs, 600) };
      for (let i = 0; i < 12 && s.status.kind === 'playing'; i++) {
        const t0 = performance.now();
        const a = botNextAction(s, st, rand);
        const took = performance.now() - t0;
        expect(a, `${id} has an action`).not.toBeNull();
        expect(took, `${id} took ${took.toFixed(0)} ms`).toBeLessThan(st.timeMs * 2 + 1500);
        const r = applyAction(s, a!);
        expect(r.ok, `${id}: ${r.ok ? '' : r.error}`).toBe(true);
        if (r.ok) s = r.state;
      }
    }
  }, 120_000);

  it('the strong bots take a hanging queen and find a mate in one; the deep search stops on time', () => {
    // a queen left en prise
    const hang = game('4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1');
    for (const id of ['aron', 'magnum', 'boss', 'oli'] as const) {
      const a = botNextAction(hang, { ...BOT_STRENGTH[id], spellChance: 0, wildSpell: 0, timeMs: 800 }, seeded(1));
      expect(a, id).toMatchObject({ type: 'MOVE', from: S('d1'), to: S('d5') });
    }
    // back-rank mate: Ra8#
    const mate = game('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    for (const id of ['madar', 'boss', 'oli'] as const) {
      const a = botNextAction(mate, { ...BOT_STRENGTH[id], spellChance: 0, wildSpell: 0, timeMs: 800 }, seeded(2));
      expect(a, id).toMatchObject({ type: 'MOVE', from: S('a1'), to: S('a8') });
    }
    // the clock: a tiny budget still answers (the depth-0 glance at least)
    const s = createGame({ decks: { w: PRESET_DECKS[0].spells, b: PRESET_DECKS[1].spells }, seed: 3 });
    const t0 = performance.now();
    const scored = scoreMoves(s, { depth: 3, width: 12, quiescence: true, profile: BOT_STRENGTH.boss.profile }, performance.now() + 5);
    expect(performance.now() - t0).toBeLessThan(400);
    expect(scored.length).toBe(20);
  });
});

/** The triggers every bot must have a line for (the rest are optional colour). */
const MUST: ChatTrigger[] = ['intro', 'win', 'lose', 'draw', 'playerCapture', 'botCapture', 'check', 'inCheck', 'blunder', 'playerMove', 'idle', 'chatter'];

describe('personalities', () => {
  it('every bot has lines for the big moments (on a phone and on a computer)', () => {
    for (const id of BOT_IDS) {
      const p = PERSONAS[id];
      for (const t of MUST) {
        for (const phone of [false, true]) {
          const mood = freshMemory(p).mood;
          expect(linesFor(p, t, mood, phone).length, `${id} ${t} ${phone ? 'phone' : 'desktop'}`).toBeGreaterThan(0);
        }
      }
      expect(p.talk).toBeGreaterThan(0);
      expect(p.talk).toBeLessThanOrEqual(1.5);
    }
  });

  it('every line fills in: no unknown placeholders, no empty lines, nothing over two sentences of chat', () => {
    const known = new Set(['p', 'pacc', 'pert', 'yn', 'pd', 'pn', 'pm', 'spell', 'br']);
    for (const id of BOT_IDS) {
      const p = PERSONAS[id];
      for (const [key, lines] of Object.entries(p.lines)) {
        for (const line of lines ?? []) {
          expect(line.trim().length, `${id} ${key}`).toBeGreaterThan(0);
          for (const m of line.matchAll(/\{(\w+)\}/g)) expect(known.has(m[1]), `${id} ${key}: {${m[1]}}`).toBe(true);
          const filled = fill(line, { piece: 'N', spell: 'Tűzlabda' }, p, seeded(3));
          expect(filled, `${id} ${key}`).not.toMatch(/\{\w+\}/);
          expect(filled.length, `${id} ${key}: ${filled}`).toBeLessThan(200);
        }
      }
    }
  });

  it('a capture of a knight reads naturally; recent lines are not repeated while others are left', () => {
    const p = PERSONAS.misu;
    const mem = freshMemory(p);
    const rand = seeded(9);
    const seen = new Set<string>();
    const pool = linesFor(p, 'playerCapture', mem.mood, false).length;
    for (let i = 0; i < Math.min(pool, 10); i++) {
      const said = pickLine(p, { trigger: 'playerCapture', piece: 'N' }, mem, false, rand)!;
      expect(said.text).not.toMatch(/\{/);
      expect(seen.has(said.text)).toBe(false);
      seen.add(said.text);
    }
  });

  it('Erika swings between moods; Oli knows a phone when he sees one', () => {
    const erika = PERSONAS.erika;
    expect(erika.moods?.length).toBeGreaterThan(1);
    const mem = freshMemory(erika);
    const rand = seeded(5);
    const moods = new Set<string>();
    for (let i = 0; i < 80; i++) {
      pickLine(erika, { trigger: 'playerMove' }, mem, false, rand);
      if (mem.mood) moods.add(mem.mood);
    }
    expect(moods.size).toBeGreaterThan(1);
    const oli = PERSONAS.oli;
    expect(linesFor(oli, 'intro', null, true)).not.toEqual(linesFor(oli, 'intro', null, false));
  });

  it('the events of a move: a capture, a check, a spell, the end', () => {
    const before = game('4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1');
    const take: Action = { type: 'MOVE', from: S('d1'), to: S('d5') };
    const r = applyAction(before, take);
    expect(r.ok).toBe(true);
    const after = (r as { state: GameState }).state;
    // the bot plays black: white (the player) took its queen
    const ev = chatEvents(before, after, take, 'b').map((e) => e.trigger);
    expect(ev).toEqual(expect.arrayContaining(['brilliant', 'playerCapture']));
    expect(chatEvents(before, after, take, 'b').find((e) => e.trigger === 'playerCapture')?.piece).toBe('Q');
    const resign = applyAction(after, { type: 'RESIGN', color: 'b' });
    expect(resign.ok && chatEvents(after, resign.state, { type: 'RESIGN', color: 'b' }, 'b')).toEqual([{ trigger: 'lose' }]);
  });
});

describe('portraits', () => {
  it('each bot has a 32 × 32 bust drawn only with known colours', () => {
    for (const id of BOT_IDS) {
      const src = PORTRAITS[id]();
      const grid = spriteGrid(src);
      expect(grid.length, id).toBe(32);
      for (const row of grid) expect(row.length, id).toBe(32);
      const pal = { ...PALETTE, ...(src.pal ?? {}) };
      for (const row of grid) for (const k of row) if (k !== '.' && k !== ' ') expect(pal[k], `${id}: '${k}'`).toBeDefined();
      const r = resolveSprite(src);
      const filled = r.px.filter(Boolean).length;
      expect(filled / (32 * 32), id).toBeGreaterThan(0.45); // a bust, not a few stray pixels
    }
  });

  it('no two portraits are the same picture', () => {
    const keys = BOT_IDS.map((id) => resolveSprite(PORTRAITS[id]()).px.join(''));
    expect(new Set(keys).size).toBe(BOT_IDS.length);
  });
});
