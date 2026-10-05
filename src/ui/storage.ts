// Browser storage is only a convenience (saved decks, last choices). Every access
// is wrapped because storage can be unavailable (private mode, sandboxed frames).
import { deckShapeError, PRESET_DECKS, RANDOM_DECK_ID, randomDeck, REMOVED_SPELLS, SPELL_LIST, validateDeck, type DeckDef, type SpellId } from '../engine';
import { BOT_IDS, type BotId } from '../bots/roster';
import type { SoundSettings } from './audio/sound';

const DECKS_KEY = 'mana-chess.decks.v1';
const PREFS_KEY = 'mana-chess.prefs.v1';
const BOT_RECORD_KEY = 'mana-chess.bots.v1';

export interface Prefs {
  whiteDeckId: string;
  blackDeckId: string;
  /** The battle setup's mode (online play has its own screen). */
  mode: 'local' | 'ai';
  /** Spell-toborzás: the decks are drafted from a table of 32 spells (instead of the chosen decks). */
  draft: boolean;
  autoFlip: boolean;
  /** false = spells may also be cast after the normal move (turn ends with a button). */
  autoEndTurn: boolean;
  sound: SoundSettings;
  /** 'reduced' turns off ambient motion and shortens effects (also follows the OS setting). */
  motion: 'full' | 'reduced';
  /** Online: the guest name the opponent sees, the deck taken along, the colour asked for (rooms, challenges), the last backend address. */
  playerName: string;
  onlineDeckId: string;
  onlineColor: 'w' | 'b' | 'random';
  /** Online rooms and challenges with Spell-toborzás. */
  onlineDraft: boolean;
  serverAddress: string;
  /** Against the bots: the last bot chosen, the colour asked for, the deck taken along, Spell-toborzás. */
  botId: BotId;
  botColor: 'w' | 'b' | 'random';
  botDeckId: string;
  botDraft: boolean;
  /** The bots talk during the game (speech bubbles and their little voices). */
  botChat: boolean;
  /** Phones and the Android app: short vibrations on moves, captures and checks. */
  vibration: boolean;
}

const DEFAULT_PREFS: Prefs = {
  whiteDeckId: 'preset-classic',
  blackDeckId: 'preset-blitz',
  mode: 'local',
  draft: false,
  autoFlip: false,
  autoEndTurn: true,
  sound: { master: 0.7, sfx: 0.8, ambient: 0.35, muted: false },
  motion: 'full',
  playerName: '',
  onlineDeckId: 'preset-classic',
  onlineColor: 'random',
  onlineDraft: false,
  serverAddress: '',
  botId: 'kende',
  botColor: 'w',
  botDeckId: 'preset-classic',
  botDraft: false,
  botChat: true,
  vibration: true,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Saved decks may still contain spells that were removed later – swap in the documented replacement. */
function migrateDeck(d: DeckDef): DeckDef {
  const spells = [...d.spells] as string[];
  for (const r of REMOVED_SPELLS) {
    const i = spells.indexOf(r.id);
    if (i < 0) continue;
    const fallback = SPELL_LIST.find((x) => !spells.includes(x.id))?.id ?? r.replacement;
    spells[i] = spells.includes(r.replacement) ? fallback : r.replacement;
  }
  return { ...d, spells: spells as SpellId[] };
}

/**
 * Saved decks. A deck saved before a deck-building rule appeared (e.g. the one-6-mana / one-5-mana
 * limit) is kept – the deck builder flags it so it can be fixed – but it cannot be played as it is.
 */
export function loadCustomDecks(): DeckDef[] {
  const decks = read<DeckDef[]>(DECKS_KEY, []);
  if (!Array.isArray(decks)) return [];
  return decks
    .filter((d) => d && Array.isArray(d.spells))
    .map(migrateDeck)
    .filter((d) => deckShapeError(d.spells) === null);
}

/** The decks that may be taken into a game (every rule kept). */
export const playableDecks = (decks: DeckDef[]): DeckDef[] => decks.filter((d) => validateDeck(d.spells) === null);

export function saveCustomDecks(decks: DeckDef[]): boolean {
  return write(DECKS_KEY, decks);
}

export function allDecks(custom: DeckDef[]): DeckDef[] {
  return [...PRESET_DECKS, ...custom];
}

/**
 * The deck a choice stands for. „Random” deals a fresh deck; a choice that is no longer playable
 * (deleted, or saved before a deck rule appeared) also plays a random one – which is what the
 * deck picker shows for it.
 */
export function resolveDeck(playable: DeckDef[], id: string): DeckDef {
  const random = (): DeckDef => ({ id: `random-${Date.now().toString(36)}`, name: 'Véletlen pakli', description: '', spells: randomDeck() });
  return id === RANDOM_DECK_ID ? random() : playable.find((d) => d.id === id) ?? random();
}

export function loadPrefs(): Prefs {
  const saved = read<Partial<Prefs>>(PREFS_KEY, {});
  const p: Prefs = { ...DEFAULT_PREFS, ...saved, sound: { ...DEFAULT_PREFS.sound, ...(saved.sound ?? {}) } };
  if (p.mode !== 'local' && p.mode !== 'ai') p.mode = DEFAULT_PREFS.mode;
  if (!['w', 'b', 'random'].includes(p.onlineColor)) p.onlineColor = 'random';
  if (typeof p.playerName !== 'string') p.playerName = '';
  if (typeof p.serverAddress !== 'string') p.serverAddress = '';
  p.draft = p.draft === true;
  p.onlineDraft = p.onlineDraft === true;
  if (!BOT_IDS.includes(p.botId)) p.botId = DEFAULT_PREFS.botId;
  if (!['w', 'b', 'random'].includes(p.botColor)) p.botColor = 'w';
  if (typeof p.botDeckId !== 'string') p.botDeckId = DEFAULT_PREFS.botDeckId;
  p.botDraft = p.botDraft === true;
  p.botChat = p.botChat !== false;
  p.vibration = p.vibration !== false;
  // the old „Egyszerű AI” mode is the bots now
  if (p.mode !== 'local') p.mode = 'local';
  return p;
}

/** Wins, losses and draws against each bot (on this device). */
export type BotRecord = Partial<Record<BotId, { w: number; l: number; d: number }>>;

export function loadBotRecord(): BotRecord {
  const r = read<BotRecord>(BOT_RECORD_KEY, {});
  return r && typeof r === 'object' ? r : {};
}

export function addBotResult(id: BotId, result: 'w' | 'l' | 'd'): BotRecord {
  const r = loadBotRecord();
  const cur = r[id] ?? { w: 0, l: 0, d: 0 };
  r[id] = { ...cur, [result]: (cur[result] ?? 0) + 1 };
  write(BOT_RECORD_KEY, r);
  return r;
}

export function savePrefs(p: Prefs): void {
  write(PREFS_KEY, p);
}
