// ─────────────────────────────────────────────────────────────────────────────
// The bots' chatter: what just happened at the board (`chatEvents`), and the line a bot says
// about it (`pickLine`). Pure – the game screen decides when and how often (useBotChat).
// ─────────────────────────────────────────────────────────────────────────────
import { bestCaptureGain, evaluate, VAL } from '../ai/simpleAI';
import { opposite, SPELLS } from '../engine';
import type { Action, Color, GameState, PieceType } from '../engine';
import { aron } from './lines/aron';
import { boss } from './lines/boss';
import { erika } from './lines/erika';
import { istvan } from './lines/istvan';
import { kende } from './lines/kende';
import { madar } from './lines/madar';
import { magnum } from './lines/magnum';
import { misu } from './lines/misu';
import { nadi } from './lines/nadi';
import { oli } from './lines/oli';
import { peter } from './lines/peter';
import type { BotPersona, ChatTrigger } from './persona';
import type { BotId } from './strength';

export const PERSONAS: Record<BotId, BotPersona> = { kende, erika, nadi, peter, misu, madar, aron, istvan, magnum, boss, oli };

/** The forms of the piece names the lines need (Hungarian has endings, not articles). */
const FORMS: Record<PieceType, Record<'p' | 'pacc' | 'pert' | 'yn' | 'pd' | 'pn' | 'pm', string>> = {
  P: { p: 'gyalog', pacc: 'gyalogot', pert: 'gyalogért', yn: 'gyalogod', pd: 'gyalogodat', pn: 'gyalogom', pm: 'gyalogomat' },
  N: { p: 'huszár', pacc: 'huszárt', pert: 'huszárért', yn: 'huszárod', pd: 'huszárodat', pn: 'huszárom', pm: 'huszáromat' },
  B: { p: 'futó', pacc: 'futót', pert: 'futóért', yn: 'futód', pd: 'futódat', pn: 'futóm', pm: 'futómat' },
  R: { p: 'bástya', pacc: 'bástyát', pert: 'bástyáért', yn: 'bástyád', pd: 'bástyádat', pn: 'bástyám', pm: 'bástyámat' },
  Q: { p: 'vezér', pacc: 'vezért', pert: 'vezérért', yn: 'vezéred', pd: 'vezéredet', pn: 'vezérem', pm: 'vezéremet' },
  K: { p: 'király', pacc: 'királyt', pert: 'királyért', yn: 'királyod', pd: 'királyodat', pn: 'királyom', pm: 'királyomat' },
  S: { p: 'rabszolga', pacc: 'rabszolgát', pert: 'rabszolgáért', yn: 'rabszolgád', pd: 'rabszolgádat', pn: 'rabszolgám', pm: 'rabszolgámat' },
};

export interface ChatEvent {
  trigger: ChatTrigger;
  /** The piece a capture was about (the most valuable one). */
  piece?: PieceType;
  spell?: string;
}

/** Who did `action` (the side to move before it, a promotion's owner, a resigner). */
function actorOf(before: GameState, action: Action): Color | null {
  if (action.type === 'RESIGN') return action.color;
  if (action.type === 'AGREE_DRAW') return null;
  if (action.type === 'PROMOTE') return before.pendingPromotion?.color ?? before.turn;
  return before.turn;
}

/** The most valuable of `color`'s pieces that this action took off the board. */
function lost(after: GameState, color: Color): PieceType | null {
  let best: PieceType | null = null;
  for (const e of after.events) {
    if (e.type !== 'capture' && e.type !== 'destroy' && e.type !== 'shatter' && e.type !== 'erase') continue;
    if (e.piece.color !== color || e.piece.clone) continue;
    if (!best || VAL[e.piece.type] > VAL[best]) best = e.piece.type;
  }
  return best;
}

/**
 * What a bot playing `bot` could comment on after `action` took `before` to `after` – most
 * interesting first. The caller picks the first one the bot feels like talking about.
 */
export function chatEvents(before: GameState, after: GameState, action: Action, bot: Color): ChatEvent[] {
  const out: ChatEvent[] = [];
  const st = after.status;
  if (st.kind !== 'playing') {
    if (before.status.kind === 'playing') out.push({ trigger: st.kind === 'checkmate' || st.kind === 'resigned' ? (st.winner === bot ? 'win' : 'lose') : 'draw' });
    return out;
  }
  const by = actorOf(before, action);
  if (!by) return out;
  const me = by === bot;
  const player = opposite(bot);
  const turnPassed = before.turn !== after.turn;
  if (after.inCheck && turnPassed) out.push({ trigger: after.turn === player ? 'check' : 'inCheck' });
  // the player's turn is over and something of theirs hangs
  if (!me && turnPassed && after.turn === bot && bestCaptureGain(after) >= 3) out.push({ trigger: 'blunder' });
  const taken = lost(after, me ? player : bot);
  if (taken) {
    if (!me && VAL[taken] >= 5) out.push({ trigger: 'brilliant', piece: taken });
    out.push({ trigger: me ? 'botCapture' : 'playerCapture', piece: taken });
  }
  if (action.type === 'CAST') out.push({ trigger: me ? 'botSpell' : 'playerSpell', spell: SPELLS[action.spellId].name });
  if (action.type === 'PROMOTE' || (action.type === 'MOVE' && action.promotion)) out.push({ trigger: 'promotion' });
  if (turnPassed) {
    const lead = evaluate(after, bot);
    if (lead >= 6) out.push({ trigger: 'winning' });
    else if (lead <= -6) out.push({ trigger: 'losing' });
  }
  if (action.type === 'MOVE') out.push({ trigger: me ? 'botMove' : 'playerMove' });
  return out;
}

/** How likely a bot is to speak about each kind of event (times its `talk`). */
export const TALK_CHANCE: Record<ChatTrigger, number> = {
  intro: 1,
  win: 1,
  lose: 1,
  draw: 1,
  check: 0.9,
  inCheck: 0.85,
  blunder: 0.9,
  brilliant: 0.8,
  playerCapture: 0.85,
  botCapture: 0.75,
  playerSpell: 0.75,
  botSpell: 0.6,
  promotion: 0.85,
  winning: 0.3,
  losing: 0.35,
  playerMove: 0.5,
  botMove: 0.22,
  idle: 1,
  chatter: 1,
  moodSwing: 1,
};

/** What a bot remembers between lines: its mood (moody bots) and what it said lately. */
export interface ChatMemory {
  mood: string | null;
  recent: string[];
}

export const freshMemory = (p: BotPersona): ChatMemory => ({ mood: p.moods?.[0] ?? null, recent: [] });

export interface Said {
  text: string;
  /** The line came with a change of mood. */
  mood?: string;
}

const FINAL = new Set<ChatTrigger>(['intro', 'win', 'lose', 'draw']);

/** The lines for a trigger: the most specific variant that exists (mood, then device, then plain). */
export function linesFor(p: BotPersona, trigger: ChatTrigger, mood: string | null, phone: boolean): readonly string[] {
  const device = phone ? 'phone' : 'desktop';
  const keys = [mood ? `${trigger}@${mood}` : null, `${trigger}@${device}`, trigger].filter((k): k is string => !!k);
  for (const k of keys) {
    const l = p.lines[k];
    if (l?.length) return l;
  }
  return [];
}

/** Fills in {p}, {pd}, {spell}, {br} … */
export function fill(text: string, ev: Partial<ChatEvent>, p: BotPersona, rand: () => number): string {
  const forms = FORMS[ev.piece ?? 'P'];
  return text.replace(/\{(\w+)\}/g, (m, key: string) => {
    if (key === 'spell') return ev.spell ?? 'varázslat';
    if (key === 'br') return p.words?.length ? p.words[Math.floor(rand() * p.words.length)] : '';
    return (forms as Record<string, string>)[key] ?? m;
  });
}

/**
 * A line for `ev` (or null if the bot has nothing for it). Updates `mem`: the mood may swing, and
 * recently said lines are avoided while others are left.
 */
export function pickLine(p: BotPersona, ev: ChatEvent, mem: ChatMemory, phone: boolean, rand: () => number = Math.random): Said | null {
  // a moody bot sometimes changes its mood – and says so
  if (p.moods && p.moods.length > 1 && !FINAL.has(ev.trigger) && rand() < (p.swing ?? 0)) {
    const next = p.moods.filter((m) => m !== mem.mood)[Math.floor(rand() * (p.moods.length - 1))];
    const swing = linesFor(p, 'moodSwing', next, phone);
    if (next && swing.length) {
      mem.mood = next;
      const text = choose(swing, mem, rand);
      return { text: fill(text, ev, p, rand), mood: next };
    }
  }
  const lines = linesFor(p, ev.trigger, mem.mood, phone);
  if (!lines.length) return null;
  return { text: fill(choose(lines, mem, rand), ev, p, rand) };
}

function choose(lines: readonly string[], mem: ChatMemory, rand: () => number): string {
  const fresh = lines.filter((l) => !mem.recent.includes(l));
  const pool = fresh.length ? fresh : lines;
  const text = pool[Math.floor(rand() * pool.length)];
  mem.recent.push(text);
  if (mem.recent.length > 14) mem.recent.shift();
  return text;
}
