// ─────────────────────────────────────────────────────────────────────────────
// Balance test: the AI plays itself with random legal decks (the menu's
// „Véletlen pakli” generator) and the results are written to BALANCE.md.
//
//   npm run balance                              600 games + 150 pure-chess games, 2 jobs
//   npm run balance -- --games 1000 --jobs 4     more games / more cores
//   npm run balance -- --resume                  continue an interrupted run (same options)
//   npm run balance -- --report                  rebuild BALANCE.md from balance-results.jsonl
//   … --compare old-results.jsonl [--compare-label "a régi szabályok"]   add an earlier run's numbers
//   npm run balance -- --duel sim default        the simulation profile against the in-game AI
//
// Every deck pair is played twice, once with each colour. The game rules are untouched: the
// players are the in-game AI (`aiNextAction`) with a profile that casts spells more readily.
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { aiNextAction, DEFAULT_AI } from '../src/ai/simpleAI';
import type { AIProfile } from '../src/ai/simpleAI';
import {
  applyAction, canCast, createGame, effectiveCost, hand, isAwakened, PIECE_VALUE, randomDeck, SPELL_LIST, SPELLS,
} from '../src/engine';
import type { Color, GameState, SpellId } from '../src/engine';

/**
 * The simulation players: the same search as the in-game AI, but they spend mana instead of letting it
 * overflow, value moving the hand on, and try targets all over the board. Chosen by duels
 * (`--duel`, 40 games each, seed 11/12): this profile beat the in-game AI 73.8% ± 13.1 while casting
 * 12 spells a game against its 2.5; an even bolder one (21 spells) lost to it 40.0% ± 15.4.
 */
export const SIM_AI: AIProfile = {
  ...DEFAULT_AI, manaValue: 0.15, castThreshold: 0.05, costPenalty: 0.02, spreadCombos: true, overflowAware: true, cycleValue: 0.3,
};
const PROFILES: Record<string, AIProfile> = { default: DEFAULT_AI, sim: SIM_AI };

// ── Rules of the simulation (not of the game) ────────────────────────────────
/** A game still running after this many turns (both colours counted) is stopped. */
const MAX_PLIES = 240;
/** A lead of this much material, held for RESIGN_PLIES turns in a row, ends the game (the AI is slow to mate). */
const RESIGN_MARGIN = 10;
const RESIGN_PLIES = 20;
/** At the 50-move rule or the turn limit, a lead of at least this much material wins on adjudication. */
const ADJUDICATE_MARGIN = 3;

// ── Options ──────────────────────────────────────────────────────────────────
interface Options {
  games: number;
  control: number;
  jobs: number;
  seed: number;
  profile: string;
  duel: [string, string] | null;
  out: string;
  results: string;
  report: boolean;
  resume: boolean;
  /** Earlier results to compare with (the report shows both), and how the report names them. */
  compare: string | null;
  compareLabel: string | null;
  worker: [number, number] | null;
}

function parseArgs(argv: string[]): Options {
  const o: Options = {
    games: 600, control: 150, jobs: 2, seed: 1, profile: 'sim', duel: null, out: 'BALANCE.md',
    results: 'balance-results.jsonl', report: false, resume: false, compare: null, compareLabel: null, worker: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Hiányzó érték: ${a}`);
      return v;
    };
    if (a === '--games') o.games = Number(val());
    else if (a === '--control') o.control = Number(val());
    else if (a === '--jobs') o.jobs = Math.max(1, Number(val()));
    else if (a === '--seed') o.seed = Number(val());
    else if (a === '--profile') o.profile = val();
    else if (a === '--duel') {
      const x = val();
      o.duel = [x, val()];
    } else if (a === '--out') o.out = val();
    else if (a === '--results') o.results = val();
    else if (a === '--report') o.report = true;
    else if (a === '--resume') o.resume = true;
    else if (a === '--compare') o.compare = val();
    else if (a === '--compare-label') o.compareLabel = val();
    else if (a === '--worker') {
      const [k, n] = val().split('/').map(Number);
      o.worker = [k, n];
    } else throw new Error(`Ismeretlen kapcsoló: ${a}`);
  }
  // deck pairs: every pair is played with both colours
  o.games += o.games % 2;
  o.control += o.control % 2;
  if (o.duel) {
    o.control = 0;
    if (!argv.includes('--results')) o.results = 'balance-duel.jsonl';
  }
  return o;
}

/** "sim", "default" or a tweak such as "sim:castThreshold=0.2,manaValue=0.2". */
function parseProfile(spec: string): AIProfile {
  const [base, mods] = spec.split(':');
  const p = PROFILES[base];
  if (!p) throw new Error(`Ismeretlen AI-profil: ${base} (${Object.keys(PROFILES).join(', ')})`);
  const out: Record<string, number | boolean> = { ...p };
  for (const kv of mods ? mods.split(',') : []) {
    const [k, v] = kv.split('=');
    if (!(k in out)) throw new Error(`Ismeretlen profilbeállítás: ${k}`);
    out[k] = v === 'true' ? true : v === 'false' ? false : Number(v);
  }
  return out as unknown as AIProfile;
}

// ── Reproducible randomness ──────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (...xs: number[]): number => xs.reduce((h, x) => Math.imul(h ^ (x >>> 0), 16777619) >>> 0, 2166136261);

// ── One game ─────────────────────────────────────────────────────────────────
interface Plan {
  i: number;
  kind: 'mana' | 'control';
  /** Games of a pair share their decks, with the colours swapped. */
  pair: number;
  swap: boolean;
}

function plans(o: Options): Plan[] {
  const mana: Plan[] = Array.from({ length: o.games }, (_, i) => ({ i, kind: 'mana', pair: i >> 1, swap: (i & 1) === 1 }));
  const control: Plan[] = Array.from({ length: o.control }, (_, j) => ({
    i: o.games + j, kind: 'control', pair: 1_000_000 + (j >> 1), swap: (j & 1) === 1,
  }));
  // control games are spread among the others, so the progress estimate stays honest
  const at = (p: Plan, idx: number, n: number) => ({ p, t: (Math.floor(idx / 2) + 0.5) / Math.max(1, n / 2) });
  return [...mana.map((p, k) => at(p, k, mana.length)), ...control.map((p, k) => at(p, k, control.length))]
    .sort((a, b) => a.t - b.t || a.p.i - b.p.i)
    .map((x) => x.p);
}

type End = 'checkmate' | 'resign' | 'fifty' | 'stalemate' | 'bareKings' | 'cap' | 'error';

interface CastRec {
  c: Color;
  id: SpellId;
  ply: number;
  cost: number;
  /** Awakened cast („Körforgás”). */
  aw?: 1;
  /** Material change for the caster from the cast until its next turn (after the opponent's reply). */
  swing?: number;
}

interface GameRecord {
  i: number;
  kind: 'mana' | 'control';
  pair: number;
  /** Duel only: which profile played which colour. */
  players?: Record<Color, string>;
  decks: Record<Color, SpellId[]>;
  end: End;
  winner: Color | null;
  /** The result was decided by the simulation's material rule, not by the game. */
  adjudicated: boolean;
  plies: number;
  /** Material balance at the end (White − Black, see `material`). */
  material: number;
  casts: CastRec[];
  /** Turns each card spent in the hand: [in hand, castable at some point of the turn]. */
  hand: Record<Color, Record<string, [number, number]>>;
  /** Mana lost to the cap. */
  wasted: Record<Color, number>;
  ms: number;
  error?: string;
}

/**
 * Material balance, White − Black: pawn 1, knight/bishop 3, rook 5, queen 9, kings not counted.
 * Slaves (they never capture) and clones (gone after one capture) count half.
 */
function material(s: GameState): number {
  let m = 0;
  for (const p of s.board) {
    if (!p || p.type === 'K') continue;
    const v = PIECE_VALUE[p.type] * (p.type === 'S' || p.clone ? 0.5 : 1);
    m += p.color === 'w' ? v : -v;
  }
  return m;
}
const persp = (c: Color, m: number) => (c === 'w' ? m : -m);

export function playGame(plan: Plan, seed: number, ai: Record<Color, AIProfile>): GameRecord {
  const t0 = performance.now();
  const deckRng = mulberry32(hash(seed, 1, plan.pair));
  const pair: Record<Color, SpellId[]> = plan.kind === 'control' ? { w: [], b: [] } : { w: randomDeck(deckRng), b: randomDeck(deckRng) };
  const decks = plan.swap ? { w: pair.b, b: pair.w } : pair;
  Math.random = mulberry32(hash(seed, 2, plan.i)); // the AI's bit of variety, reproducible
  let s = createGame({ decks, seed: hash(seed, 3, plan.pair) & 0x7fffffff });

  const rec: GameRecord = {
    i: plan.i, kind: plan.kind, pair: plan.pair, decks, end: 'error', winner: null, adjudicated: false, plies: 0, material: 0,
    casts: [], hand: { w: {}, b: {} }, wasted: { w: 0, b: 0 }, ms: 0,
  };
  /** Casts waiting for the opponent's reply before their material swing is known. */
  const open: { cast: CastRec; before: number }[] = [];
  const settle = (all: boolean) => {
    for (let k = open.length - 1; k >= 0; k--) {
      const o = open[k];
      if (!all && s.turnIndex < o.cast.ply + 2) continue;
      o.cast.swing = persp(o.cast.c, material(s)) - o.before;
      open.splice(k, 1);
    }
  };
  const adjudicate = () => {
    const m = material(s);
    if (Math.abs(m) >= ADJUDICATE_MARGIN) {
      rec.winner = m > 0 ? 'w' : 'b';
      rec.adjudicated = true;
    }
  };

  /** Cards in the hand during the current turn, and whether each could be cast at some point of it. */
  let turnCards = new Map<SpellId, boolean>();
  let turnColor: Color = s.turn;
  const flushTurn = () => {
    for (const [id, ok] of turnCards) {
      const h = (rec.hand[turnColor][id] ??= [0, 0]);
      h[0]++;
      if (ok) h[1]++;
    }
    turnCards = new Map();
  };

  let seen = -1;
  let lead: Color | null = null;
  let leadPlies = 0;
  let actions = 0;
  let stopped: End | null = null;
  while (s.status.kind === 'playing') {
    if (s.turnIndex !== seen) {
      // a new turn begins
      seen = s.turnIndex;
      settle(false);
      flushTurn();
      turnColor = s.turn;
      const m = material(s);
      const side: Color | null = m >= RESIGN_MARGIN ? 'w' : m <= -RESIGN_MARGIN ? 'b' : null;
      leadPlies = side && side === lead ? leadPlies + 1 : side ? 1 : 0;
      lead = side;
      if (lead && leadPlies >= RESIGN_PLIES) {
        stopped = 'resign';
        rec.winner = lead;
        rec.adjudicated = true;
        break;
      }
      if (s.turnIndex >= MAX_PLIES) {
        stopped = 'cap';
        adjudicate();
        break;
      }
    }
    if (!s.pendingPromotion) for (const id of hand(s, s.turn)) turnCards.set(id, turnCards.get(id) || canCast(s, id));
    let a: ReturnType<typeof aiNextAction>;
    try {
      a = aiNextAction(s, ai[s.turn]);
    } catch (e) {
      stopped = 'error';
      rec.error = `AI-hiba: ${(e as Error).message}`;
      break;
    }
    if (!a) {
      stopped = 'error';
      rec.error = 'Az AI nem talált szabályos akciót.';
      break;
    }
    let cast: CastRec | null = null;
    let before = 0;
    if (a.type === 'CAST') {
      cast = { c: s.turn, id: a.spellId, ply: s.turnIndex, cost: effectiveCost(s, s.turn, SPELLS[a.spellId], a.targets) };
      if (isAwakened(s, s.turn, a.spellId)) cast.aw = 1;
      before = persp(s.turn, material(s));
    }
    let r: ReturnType<typeof applyAction>;
    try {
      r = applyAction(s, a);
    } catch (e) {
      stopped = 'error';
      rec.error = `Motorhiba (${a.type}${a.type === 'CAST' ? ` ${a.spellId}` : ''}): ${(e as Error).message}`;
      break;
    }
    if (!r.ok) {
      stopped = 'error';
      rec.error = `${a.type}${a.type === 'CAST' ? ` ${a.spellId}` : ''}: ${r.error}`;
      break;
    }
    if (cast) {
      rec.casts.push(cast);
      open.push({ cast, before });
    }
    for (const e of r.state.events) if (e.type === 'mana' && e.wasted > 0) rec.wasted[e.color] += e.wasted;
    s = r.state;
    if (++actions > 5000) {
      stopped = 'error';
      rec.error = 'Túl sok akció.';
      break;
    }
  }
  settle(true);
  flushTurn();

  if (stopped) rec.end = stopped;
  else {
    const st = s.status;
    if (st.kind === 'checkmate' || st.kind === 'resigned') {
      rec.end = st.kind === 'checkmate' ? 'checkmate' : 'resign';
      rec.winner = st.winner;
    } else if (st.kind === 'stalemate') rec.end = 'stalemate';
    else if (st.kind === 'draw' && st.reason === 'Elégtelen anyag') rec.end = 'bareKings';
    else if (st.kind === 'draw') {
      rec.end = 'fifty';
      adjudicate();
    }
  }
  rec.plies = s.turnIndex;
  rec.material = material(s);
  rec.ms = Math.round(performance.now() - t0);
  return rec;
}

// ── Duel: which colour each profile plays ────────────────────────────────────
function playersFor(o: Options, p: Plan): { ai: Record<Color, AIProfile>; names?: Record<Color, string> } {
  if (!o.duel) {
    const one = parseProfile(o.profile);
    return { ai: { w: one, b: one } };
  }
  const [x, y] = o.duel;
  // the first profile is White in half of the games (and gets both decks of a pair either way)
  const names: Record<Color, string> = p.i % 4 < 2 ? { w: x, b: y } : { w: y, b: x };
  return { ai: { w: parseProfile(names.w), b: parseProfile(names.b) }, names };
}

function runWorker(o: Options): void {
  const [k, n] = o.worker!;
  const finished = new Set(o.resume ? readResults(o.results).records.map((r) => r.i) : []);
  plans(o).forEach((p, idx) => {
    if (idx % n !== k || finished.has(p.i)) return;
    const { ai, names } = playersFor(o, p);
    const rec = playGame(p, o.seed, ai);
    if (names) rec.players = names;
    process.stdout.write(JSON.stringify(rec) + '\n');
  });
}

interface Meta {
  options: Omit<Options, 'worker' | 'report' | 'resume' | 'compare' | 'compareLabel'>;
  profile: AIProfile | null;
  started: string;
}

/** The options that decide which games are played (a resumed run must match them). */
const runKey = (m: Pick<Options, 'games' | 'control' | 'seed' | 'profile' | 'duel'>) => JSON.stringify([m.games, m.control, m.seed, m.profile, m.duel]);

async function runMain(o: Options): Promise<void> {
  const file = o.results;
  const { worker: _w, report: _r, resume: _s, compare: _c, compareLabel: _l, ...options } = o;
  let meta: Meta = { options, profile: o.duel ? null : parseProfile(o.profile), started: new Date().toISOString() };
  let done = 0;
  const log = (line: string) => process.stdout.write(line + '\n');
  if (o.resume && existsSync(file)) {
    const prev = readResults(file);
    if (!prev.meta || runKey(prev.meta.options) !== runKey(o)) throw new Error(`A(z) ${file} más beállításokkal készült – indítsd újra --resume nélkül.`);
    meta = prev.meta;
    done = prev.records.length;
    // rewrite without a half-written last line
    writeFileSync(file, [JSON.stringify({ meta }), ...prev.records.map((r) => JSON.stringify(r))].join('\n') + '\n');
    log(`Folytatás: ${done} játszma már kész.`);
  } else writeFileSync(file, JSON.stringify({ meta }) + '\n');
  const total = plans(o).length;
  const t0 = Date.now();
  const startDone = done;
  log(`${total} játszma, ${o.jobs} szálon → ${file}`);
  const script = fileURLToPath(import.meta.url);
  await Promise.all(
    Array.from({ length: o.jobs }, (_, k) =>
      new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, [...process.execArgv, script, ...process.argv.slice(2), '--worker', `${k}/${o.jobs}`], {
          stdio: ['ignore', 'pipe', 'inherit'],
        });
        createInterface({ input: child.stdout! }).on('line', (line) => {
          if (!line.startsWith('{')) return;
          appendFileSync(file, line + '\n');
          done++;
          if (done % 10 === 0 || done === total) {
            const el = (Date.now() - t0) / 1000;
            const per = el / Math.max(1, done - startDone);
            log(`[${done}/${total}] ${((100 * done) / total).toFixed(0)}% · ${per.toFixed(1)} s/játszma · hátra ~${Math.ceil((per * (total - done)) / 60)} perc`);
          }
        });
        child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`A(z) ${k}. szál hibával állt le (${code}).`))));
      }),
    ),
  );
  const { records } = readResults(file);
  if (o.duel) log(duelSummary(records, o.duel));
  else {
    writeFileSync(o.out, buildReport(records, meta, earlier(o)));
    log(`Kész: ${o.out}`);
  }
}

/** The earlier run named by --compare, if any. */
const earlier = (o: Options): { file: string; records: GameRecord[] } | undefined =>
  o.compare ? { file: o.compareLabel ?? `\`${o.compare}\``, records: readResults(o.compare).records } : undefined;

function readResults(file: string): { meta: Meta | null; records: GameRecord[] } {
  let meta: Meta | null = null;
  const byIndex = new Map<number, GameRecord>();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let obj: { meta?: Meta } & Partial<GameRecord>;
    try {
      obj = JSON.parse(line);
    } catch {
      continue; // a line cut short by an interrupted run
    }
    if (obj.meta) meta = obj.meta;
    else if (typeof obj.i === 'number' && !byIndex.has(obj.i)) byIndex.set(obj.i, obj as GameRecord);
  }
  return { meta, records: [...byIndex.values()].sort((a, b) => a.i - b.i) };
}

// ── Statistics ───────────────────────────────────────────────────────────────
const scoreOf = (r: GameRecord, c: Color): number => (r.winner === null ? 0.5 : r.winner === c ? 1 : 0);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
function meanCi(xs: number[]): { m: number; ci: number; se: number } {
  const m = mean(xs);
  if (xs.length < 2) return { m, ci: NaN, se: NaN };
  const v = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
  const se = Math.sqrt(v / xs.length);
  return { m, ci: 1.96 * se, se };
}
function quantile(xs: number[], q: number): number {
  if (!xs.length) return NaN;
  const a = [...xs].sort((x, y) => x - y);
  const pos = (a.length - 1) * q;
  const lo = Math.floor(pos);
  return a[lo] + (a[Math.min(a.length - 1, lo + 1)] - a[lo]) * (pos - lo);
}
const moves = (r: GameRecord) => Math.floor(r.plies / 2) + 1;

const pct = (x: number, d = 1) => (Number.isFinite(x) ? `${(100 * x).toFixed(d)}%` : '–');
const num = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '–');
/** Percentage points with a sign: +3.1 / −2.4. */
const pp = (x: number) => (Number.isFinite(x) ? `${x >= 0 ? '+' : '−'}${Math.abs(100 * x).toFixed(1)}` : '–');
const signed = (x: number, d = 2) => (Number.isFinite(x) ? `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}` : '–');

function duelSummary(records: GameRecord[], [x, y]: [string, string]): string {
  const ok = records.filter((r) => r.end !== 'error' && r.players);
  const colorOf = (r: GameRecord, name: string): Color => (r.players!.w === name ? 'w' : 'b');
  const s = meanCi(ok.map((r) => scoreOf(r, colorOf(r, x))));
  const casts = (name: string) => mean(ok.map((r) => r.casts.filter((c) => c.c === colorOf(r, name)).length));
  const errors = records.length - ok.length;
  return [
    `Párbaj: ${x} kontra ${y}, ${ok.length} játszma${errors ? ` (+${errors} hibás)` : ''}`,
    `  ${x} pontszáma: ${pct(s.m)} ± ${pct(s.ci)}`,
    `  spell / játszma: ${x} ${num(casts(x))} · ${y} ${num(casts(y))}`,
    `  átlagos hossz: ${num(mean(ok.map(moves)))} lépés, ${num(mean(ok.map((r) => r.ms)) / 1000)} s/játszma`,
  ].join('\n');
}

// ── Report (Hungarian, like the rest of the documentation) ───────────────────
const END_HU: Record<End, string> = {
  checkmate: 'Matt',
  resign: `Feladás: ${RESIGN_MARGIN}+ anyagelőny ${RESIGN_PLIES / 2} teljes lépésen át`,
  fifty: '50 lépéses szabály',
  stalemate: 'Patt',
  bareKings: 'Csak a királyok maradtak',
  cap: `Lépéslimit (${MAX_PLIES / 2} lépés)`,
  error: 'Hiba (a futás megszakadt)',
};

interface SpellRow {
  id: SpellId;
  /** Games with the card in exactly one deck. */
  n: number;
  score: number;
  delta: number;
  ci: number;
  z: number;
  /** (game, side) pairs with the card in the deck. */
  decks: number;
  used: number;
  casts: number;
  awakened: number;
  inHand: number;
  castable: number;
  firstMove: number;
  swing: number;
}

function spellRows(games: GameRecord[]): SpellRow[] {
  const exp: Record<Color, number> = { w: mean(games.map((r) => scoreOf(r, 'w'))), b: mean(games.map((r) => scoreOf(r, 'b'))) };
  return SPELL_LIST.map((sp) => {
    const dev: number[] = [];
    const scores: number[] = [];
    let decks = 0;
    let used = 0;
    let casts = 0;
    let awakened = 0;
    let inHand = 0;
    let castable = 0;
    const first: number[] = [];
    const swings: number[] = [];
    for (const r of games) {
      for (const c of ['w', 'b'] as const) {
        if (!r.decks[c].includes(sp.id)) continue;
        decks++;
        const mine = r.casts.filter((x) => x.c === c && x.id === sp.id);
        casts += mine.length;
        awakened += mine.filter((x) => x.aw).length;
        if (mine.length) {
          used++;
          first.push(Math.floor(mine[0].ply / 2) + 1);
        }
        for (const x of mine) if (x.swing !== undefined) swings.push(x.swing);
        const h = r.hand[c][sp.id];
        if (h) {
          inHand += h[0];
          castable += h[1];
        }
        const other = c === 'w' ? 'b' : 'w';
        if (r.decks[other].includes(sp.id)) continue; // both decks have it: no information on the card itself
        scores.push(scoreOf(r, c));
        dev.push(scoreOf(r, c) - exp[c]);
      }
    }
    const d = meanCi(dev);
    return {
      id: sp.id, n: dev.length, score: mean(scores), delta: d.m, ci: d.ci, z: d.se > 0 ? d.m / d.se : 0,
      decks, used, casts, awakened, inHand, castable, firstMove: mean(first), swing: mean(swings),
    };
  });
}

const mark = (r: SpellRow) => (r.z >= 2.58 ? '▲▲' : r.z >= 1.96 ? '▲' : r.z <= -2.58 ? '▼▼' : r.z <= -1.96 ? '▼' : '');
const RARE = 0.25;

function resultRow(label: string, rs: GameRecord[]): string {
  const n = rs.length;
  const w = rs.filter((r) => r.winner === 'w').length;
  const b = rs.filter((r) => r.winner === 'b').length;
  const d = n - w - b;
  const s = meanCi(rs.map((r) => scoreOf(r, 'w')));
  return `| ${label} | ${n} | ${pct(w / n)} | ${pct(d / n)} | ${pct(b / n)} | **${pct(s.m)}** ± ${num(100 * s.ci)} |`;
}

/** The same games judged strictly by the rules: adjudicated results count as draws. */
const strict = (rs: GameRecord[]): GameRecord[] => rs.map((r) => (r.adjudicated ? { ...r, winner: null } : r));

function lengthRow(label: string, rs: GameRecord[]): string {
  const m = rs.map(moves);
  return `| ${label} | ${num(mean(m))} | ${num(quantile(m, 0.5), 0)} | ${num(quantile(m, 0.1), 0)}–${num(quantile(m, 0.9), 0)} |`;
}

function histogram(groups: [string, GameRecord[]][]): string[] {
  const edges = [10, 20, 30, 40, 50, 60, 80, 100, 120];
  const label = (k: number) => (k === 0 ? `1–${edges[0]}` : k < edges.length ? `${edges[k - 1] + 1}–${edges[k]}` : `${edges[edges.length - 1]}+`);
  const bucket = (mv: number) => {
    const k = edges.findIndex((e) => mv <= e);
    return k < 0 ? edges.length : k;
  };
  const shares = groups.map(([, rs]) => {
    const c = new Array(edges.length + 1).fill(0);
    for (const r of rs) c[bucket(moves(r))]++;
    return c.map((x) => x / Math.max(1, rs.length));
  });
  const bar = (x: number) => '█'.repeat(Math.round(x * 60)) || (x > 0 ? '▏' : '');
  const out = [`| Lépés | ${groups.map(([g]) => g).join(' | ')} |`, `|---|${groups.map(() => '---').join('|')}|`];
  for (let k = 0; k <= edges.length; k++) out.push(`| ${label(k)} | ${shares.map((sh) => `${bar(sh[k])} ${pct(sh[k], 0)}`).join(' | ')} |`);
  return out;
}

function buildReport(records: GameRecord[], meta: Meta | null, before?: { file: string; records: GameRecord[] }): string {
  const mana = records.filter((r) => r.kind === 'mana' && r.end !== 'error');
  const ownControl = records.filter((r) => r.kind === 'control' && r.end !== 'error');
  // a run without control games borrows the earlier run's: spell changes cannot touch games without spells
  const borrowed = !ownControl.length && !!before?.records.some((r) => r.kind === 'control');
  const control = borrowed ? before!.records.filter((r) => r.kind === 'control' && r.end !== 'error') : ownControl;
  const oldMana = before?.records.filter((r) => r.kind === 'mana' && r.end !== 'error') ?? [];
  const old = before ? new Map(spellRows(oldMana).map((r) => [r.id, r])) : null;
  /** " (előtte …)" after a figure when an earlier run is compared. */
  const was = (text: string) => (before ? ` (előtte ${text})` : '');
  const errors = records.filter((r) => r.end === 'error');
  const rows = spellRows(mana).sort((a, b) => b.delta - a.delta);
  const L: string[] = [];
  const p = meta?.profile;
  const whiteMana = meanCi(mana.map((r) => scoreOf(r, 'w')));
  const whiteCtrl = meanCi(control.map((r) => scoreOf(r, 'w')));
  const castsPerGame = mean(mana.map((r) => r.casts.length));
  const spentPerGame = mean(mana.map((r) => r.casts.reduce((a, c) => a + c.cost, 0)));
  const wastedPerSide = mean(mana.flatMap((r) => [r.wasted.w, r.wasted.b]));
  const strong = rows.filter((r) => r.z >= 1.96);
  const weak = rows.filter((r) => r.z <= -1.96).reverse();
  const TOP = 10;
  const more = (rs: SpellRow[]) => (rs.length > TOP ? ` … és még ${rs.length - TOP}` : '');
  const rare = [...rows].sort((a, b) => a.used / a.decks - b.used / b.decks).filter((r) => r.used / r.decks < RARE);
  const most = [...rows].sort((a, b) => b.casts / b.decks - a.casts / a.decks).slice(0, 6);
  const name = (r: SpellRow) => `${SPELLS[r.id].name} (${SPELLS[r.id].manaCost})`;
  const list = (rs: SpellRow[], f: (r: SpellRow) => string) => (rs.length ? rs.map(f).join(', ') : 'nincs');
  const date = (meta?.started ?? new Date().toISOString()).slice(0, 10);

  L.push('# Mana Chess – egyensúly-teszt');
  L.push('');
  L.push(`> Generált fájl (\`npm run balance\`, ${date}). A beépített AI játszik saját maga ellen, a játék szabályai szerint, véletlen (szabályos) paklikkal – ugyanazzal a generátorral, mint a menü „Véletlen pakli” gombja. Minden paklipár kétszer játszik, egyszer-egyszer mindkét színnel.`);
  L.push('');
  const cpuMinutes = records.reduce((a, r) => a + r.ms, 0) / 60000;
  const wall = cpuMinutes ? `, gépidő ${Math.round(cpuMinutes)} perc (${meta?.options.jobs ?? 1} szálon ~${Math.round(cpuMinutes / (meta?.options.jobs ?? 1))} perc)` : '';
  L.push(`**Minta:** ${mana.length} mana-játszma (${mana.length / 2} paklipár) · ${control.length} tiszta sakk kontrolljátszma (üres paklik, ugyanaz az AI${borrowed ? '; az összehasonlított futásból – spellek nélkül a szabályváltozások nem hatnak rájuk' : ''})${errors.length ? ` · ${errors.length} hibás, kihagyva` : ''} · seed ${meta?.options.seed ?? '?'}${wall}.`);
  if (meta) {
    const o = meta.options;
    L.push('');
    L.push(`Megismétlés: \`npm run balance -- --games ${o.games} --control ${o.control} --seed ${o.seed}${o.profile !== 'sim' ? ` --profile ${o.profile}` : ''}\` (ugyanazok a játszmák; más seed független mintát ad).`);
  }
  if (p) {
    L.push('');
    L.push(`**AI:** a játékbeli ellenfél keresője (2 lépés mélyen), bátrabb spellhasználattal: kijátssza a lapot, ha az azonnali értékelés szerint megéri (1 mana = ${p.manaValue} gyalog${p.overflowAware ? ', a plafonon túlcsorduló kristály semmit sem ér' : ''}${p.cycleValue ? `, a kéz továbbforgatása ${p.cycleValue} gyalogot ér` : ''}; küszöb ${p.castThreshold}); lapkombinációnként ${p.comboLimit} célpont-próba${p.spreadCombos ? ', az egész táblán szétszórva' : ''}. A játékbeli ellenfél óvatosabb (1 mana = ${DEFAULT_AI.manaValue} gyalog, küszöb ${DEFAULT_AI.castThreshold}): ez a profil 40 játszmás párbajban 73.8% ± 13.1 pontot szerzett ellene, játszmánként 12 spellel az ő 2.5-ével szemben.`);
  }
  L.push('');

  if (before) {
    L.push('');
    L.push(`**Összehasonlítás:** az „előtte” számok ${before.file} futásából valók (${oldMana.length} mana-játszma). Azonos seed mellett ugyanazok a paklipárok játszanak, így a különbség a szabályváltozásokból jön (és a játszmák véletlenéből).`);
  }
  L.push('');
  L.push('## Röviden');
  L.push('');
  L.push(`- **Kezdés előnye:** Világos pontszáma ${pct(whiteMana.m)} (± ${num(100 * whiteMana.ci)})${was(pct(mean(oldMana.map((r) => scoreOf(r, 'w')))))}; ugyanez az AI tiszta sakkban: ${pct(whiteCtrl.m)} (± ${num(100 * whiteCtrl.ci)}).`);
  L.push(`- **Hossz:** átlag ${num(mean(mana.map(moves)), 0)} lépés (medián ${num(quantile(mana.map(moves), 0.5), 0)})${was(`${num(mean(oldMana.map(moves)), 0)}, medián ${num(quantile(oldMana.map(moves), 0.5), 0)}`)}; tiszta sakkban ${num(mean(control.map(moves)), 0)} (medián ${num(quantile(control.map(moves), 0.5), 0)}).`);
  const mates = mana.filter((r) => r.end === 'checkmate').length;
  L.push(`- **Vége:** ${pct(mates / mana.length, 0)} matt; döntetlen ${pct(mana.filter((r) => r.winner === null).length / mana.length, 0)}; a szimuláció anyagi szabálya döntött ${pct(mana.filter((r) => r.adjudicated).length / mana.length, 0)}-ban.`);
  L.push(`- **Spellhasználat:** játszmánként átlag ${num(castsPerGame)} kijátszás (${num(spentPerGame, 0)} mana)${was(num(mean(oldMana.map((r) => r.casts.length))))}; oldalanként ${num(wastedPerSide)} mana veszett el a 6-os plafon miatt.`);
  if (old) {
    const spread = (rs: { delta: number }[]) => Math.sqrt(mean(rs.map((r) => r.delta ** 2)));
    const noise = Math.sqrt(mean(rows.map((r) => (r.ci / 1.96) ** 2)));
    const moved = [...rows].sort((a, b) => Math.abs(b.delta - (old.get(b.id)?.delta ?? 0)) - Math.abs(a.delta - (old.get(a.id)?.delta ?? 0))).slice(0, 10);
    L.push(`- **Szórás a lapok között** (a Δ-k négyzetes átlaga, a kiegyensúlyozottság mércéje): ${num(100 * spread(rows))} százalékpont (előtte ${num(100 * spread([...old.values()]))}; tökéletes egyensúlynál is kb. ${num(100 * noise)} maradna a véletlen miatt). Kiugró lap 99%-on: ${rows.filter((r) => Math.abs(r.z) >= 2.58).length} (előtte ${[...old.values()].filter((r) => Math.abs(r.z) >= 2.58).length}).`);
    L.push(`- **Legnagyobb változások:** ${moved.map((r) => `${name(r)} ${pp(old.get(r.id)!.delta)} → ${pp(r.delta)}`).join(', ')}.`);
  }
  L.push(`- **Kiugróan erős (95%):** ${list(strong.slice(0, TOP), (r) => `${name(r)} ${pp(r.delta)}`)}${more(strong)}.`);
  L.push(`- **Kiugróan gyenge (95%):** ${list(weak.slice(0, TOP), (r) => `${name(r)} ${pp(r.delta)}`)}${more(weak)}.`);
  L.push(`- **Leggyakrabban kijátszva:** ${list(most, (r) => `${name(r)} ${num(r.casts / r.decks)}/játszma`)}.`);
  L.push(`- **Az AI ritkán használja** (a paklik kevesebb mint ${pct(RARE, 0)}-ában kerül sorra): ${list(rare, (r) => `${name(r)} ${pct(r.used / r.decks, 0)}`)}.`);
  L.push('');

  L.push('## Kezdés előnye');
  L.push('');
  L.push('Pontszám: győzelem 1, döntetlen ½. A ± a 95%-os konfidenciaintervallum fele (százalékpont).');
  L.push('');
  L.push('| | Játszma | Világos nyer | Döntetlen | Sötét nyer | Világos pontszáma |');
  L.push('|---|---:|---:|---:|---:|---:|');
  L.push(resultRow('Mana sakk', mana));
  L.push(resultRow('Mana sakk, csak a szabályok szerint¹', strict(mana)));
  L.push(resultRow('Tiszta sakk (kontroll)', control));
  L.push(resultRow('Tiszta sakk, csak a szabályok szerint¹', strict(control)));
  L.push('');
  L.push('¹ A szimuláció anyagi döntései nélkül: ami ott megítélt győzelem, itt döntetlen.');
  L.push('');

  L.push('## A játszmák hossza');
  L.push('');
  L.push('| | Átlag | Medián | 10–90% |');
  L.push('|---|---:|---:|---:|');
  L.push(lengthRow('Mana sakk', mana));
  L.push(lengthRow('Tiszta sakk', control));
  L.push('');
  L.push(...histogram([['Mana sakk', mana], ['Tiszta sakk', control]]));
  L.push('');

  L.push('## Hogyan értek véget');
  L.push('');
  L.push('| | Mana sakk | Tiszta sakk |');
  L.push('|---|---:|---:|');
  const ends: End[] = ['checkmate', 'resign', 'fifty', 'stalemate', 'bareKings', 'cap'];
  const share = (rs: GameRecord[], f: (r: GameRecord) => boolean) => `${rs.filter(f).length} (${pct(rs.filter(f).length / Math.max(1, rs.length), 0)})`;
  for (const e of ends) {
    if (e === 'fifty' || e === 'cap') {
      L.push(`| ${END_HU[e]} – anyagelőny (${ADJUDICATE_MARGIN}+) döntött | ${share(mana, (r) => r.end === e && r.adjudicated)} | ${share(control, (r) => r.end === e && r.adjudicated)} |`);
      L.push(`| ${END_HU[e]} – döntetlen | ${share(mana, (r) => r.end === e && !r.adjudicated)} | ${share(control, (r) => r.end === e && !r.adjudicated)} |`);
    } else L.push(`| ${END_HU[e]} | ${share(mana, (r) => r.end === e)} | ${share(control, (r) => r.end === e)} |`);
  }
  L.push('');
  L.push(`A beépített AI lassan mattol, ezért a szimuláció két helyen dönt a szabályok helyett: aki ${RESIGN_MARGIN}+ anyagelőnyt (≈ egy vezér) ${RESIGN_PLIES / 2} teljes lépésen át megtart, az nyer („feladás”); az 50 lépéses szabálynál és a lépéslimitnél pedig ${ADJUDICATE_MARGIN}+ anyagelőny (≈ egy könnyűtiszt) győzelmet ér. Anyag: gyalog 1, huszár/futó 3, bástya 5, vezér 9; a rabszolga (nem üt) és a klón (egy ütés után eltűnik) fél értékkel.`);
  L.push('');

  L.push('## Spellek');
  L.push('');
  L.push('Rendezés: Δ szerint, a legerősebbtől. Minden sor azokat a játszmákat nézi, ahol a lap pontosan az egyik pakliban volt.');
  L.push('');
  L.push('- **Pontszám:** a lapot tartó fél átlagos pontszáma. **Δ:** eltérés attól, amit az adott szín egyébként átlagosan elér (százalékpont) ± 95%-os intervallum. ▲/▼: 95%-os, ▲▲/▼▼: 99%-os eltérés. 71 lap mellett 95%-on 3–4 téves riasztás várható, ezért a szimpla jelzés csak gyanú.');
  L.push('- **Sorra került:** a paklik hány százalékában játszotta ki legalább egyszer. **/játszma:** kijátszások száma játszmánként.');
  L.push('- **Kijátszható:** a kézben töltött körök hány százalékában volt a kör valamely pontján elég mana és érvényes célpont; **ebből kijátszva:** ezekből hányszor élt vele az AI.');
  L.push('- **Anyag:** átlagos anyagváltozás a varázsló szemszögéből a kijátszástól a következő saját köréig, az ellenfél válaszával együtt (értékek, mint lent a játszmák végénél).');
  L.push('');
  L.push(`| Spell | Mana | Játszma | Pontszám | Δ | |${old ? ' Δ előtte |' : ''} Sorra került | /játszma | Kijátszható | ebből kijátszva | Első (lépés) | Anyag |`);
  L.push(`|---|---:|---:|---:|---:|:-:|${old ? '---:|' : ''}---:|---:|---:|---:|---:|---:|`);
  for (const r of rows) {
    const sp = SPELLS[r.id];
    const rareMark = r.used / r.decks < RARE ? ' ◌' : '';
    const aw = r.awakened ? ` (${r.awakened} felébredt)` : '';
    L.push(
      `| ${sp.icon} ${sp.name}${rareMark} | ${sp.costLabel ?? sp.manaCost} | ${r.n} | ${pct(r.score)} | ${pp(r.delta)} ± ${num(100 * r.ci)} | ${mark(r)} |${old ? ` ${pp(old.get(r.id)?.delta ?? NaN)} |` : ''} ${pct(r.used / r.decks, 0)} | ${num(r.casts / r.decks, 2)}${aw} | ${pct(r.castable / r.inHand, 0)} | ${pct(r.casts / r.castable, 0)} | ${num(r.firstMove, 0)} | ${signed(r.swing, 1)} |`,
    );
  }
  L.push('');
  L.push('◌ = az AI a paklik kevesebb mint negyedében játssza ki: az eredménye főleg azt méri, mennyit árt egy „halott” lap a kézben (a 3 kézhelyből egyet elfoglal, amíg ki nem játsszák).');
  L.push('');

  L.push('## Mana szerint');
  L.push('');
  L.push('| Mana | Spellek | Átlagos Δ | Sorra került | /játszma | Kijátszható |');
  L.push('|---:|---:|---:|---:|---:|---:|');
  const costs = [...new Set(SPELL_LIST.map((s) => s.manaCost))].sort((a, b) => a - b);
  for (const c of costs) {
    const g = rows.filter((r) => SPELLS[r.id].manaCost === c);
    const sum = (f: (r: SpellRow) => number) => g.reduce((a, r) => a + f(r), 0);
    const avgDelta = sum((r) => r.delta * r.n) / sum((r) => r.n);
    L.push(`| ${c} | ${g.length} | ${pp(avgDelta)} | ${pct(sum((r) => r.used) / sum((r) => r.decks), 0)} | ${num(sum((r) => r.casts) / sum((r) => r.decks), 2)} | ${pct(sum((r) => r.castable) / sum((r) => r.inHand), 0)} |`);
  }
  L.push('');

  L.push('## Mire jó és mire nem');
  L.push('');
  L.push('- Az eredmény **ennek az AI-nak** a játékát méri. A spelleket az azonnali (1 lépéses) értékelés alapján választja: amit rögtön anyagban vagy fenyegetésben lát, azt jól használja; a hosszabb távú, helyzeti vagy csapda-jellegű lapokat alulértékeli. Ember kezében ezek erősebbek lehetnek.');
  L.push('- A paklik véletlenek, így egy lap eredménye a többi lappal való átlagos együttélését mutatja; a célzott kombók ereje ebből nem látszik.');
  L.push('- A Δ a pakliban lévő lap hatása, nem a kijátszásé: a ritkán kijátszott lapok negatív Δ-ja főleg a kéz eltömítését jelzi.');
  L.push(`- Egy lap kb. ${num(mean(rows.map((r) => r.n)), 0)} játszmában szerepelt, ez ±${num(100 * mean(rows.map((r) => r.ci)), 0)} százalékpontos bizonytalanság: csak a nagy eltérések megbízhatók. Több játszma: \`npm run balance -- --games 2000 --jobs 4\`.`);
  L.push('');
  return L.join('\n');
}

// ── Entry point ──────────────────────────────────────────────────────────────
const opts = parseArgs(process.argv.slice(2));
if (opts.worker) runWorker(opts);
else if (opts.report) {
  const { meta, records } = readResults(opts.results);
  writeFileSync(opts.out, buildReport(records, meta, earlier(opts)));
  console.log(`Kész: ${opts.out} (${records.length} játszmából)`);
} else {
  runMain(opts).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
