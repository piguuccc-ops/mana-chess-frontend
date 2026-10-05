// How strongly each bot plays (see src/ai/botSearch.ts for what the knobs do). The Elo numbers
// are the bots' labels; the ladder test (scripts/bot-ladder.ts) checks that every bot really beats
// the ones below it.
import type { BotStrength } from '../ai/botSearch';
import { DEFAULT_AI } from '../ai/simpleAI';

export type BotId = 'kende' | 'erika' | 'nadi' | 'peter' | 'misu' | 'madar' | 'aron' | 'istvan' | 'magnum' | 'boss' | 'oli';

const base = (over: Partial<BotStrength>): BotStrength => ({
  depth: 2,
  quiescence: false,
  randomMove: 0,
  noise: 0,
  shortSighted: 0,
  spellChance: 1,
  wildSpell: 0,
  spellNoise: 0,
  spellLook: 0,
  profile: DEFAULT_AI,
  timeMs: 1500,
  ...over,
});

export const BOT_STRENGTH: Record<BotId, BotStrength> = {
  kende: base({ depth: 1, randomMove: 0.6, noise: 1, shortSighted: 1, spellChance: 0.3, wildSpell: 0.3, spellNoise: 1.5, timeMs: 300 }),
  erika: base({ depth: 1, randomMove: 0.32, noise: 0.6, shortSighted: 1, spellChance: 0.45, wildSpell: 0.15, spellNoise: 1, timeMs: 300 }),
  nadi: base({ depth: 1, quiescence: true, randomMove: 0.16, noise: 0.4, shortSighted: 0.6, spellChance: 0.6, wildSpell: 0.06, spellNoise: 0.7, timeMs: 400 }),
  peter: base({ depth: 1, quiescence: true, randomMove: 0.1, noise: 0.35, shortSighted: 0.45, spellChance: 0.7, wildSpell: 0.03, spellNoise: 0.55, timeMs: 500 }),
  misu: base({ depth: 2, quiescence: true, randomMove: 0.03, noise: 0.3, shortSighted: 0.2, spellChance: 0.85, spellNoise: 0.5, timeMs: 800 }),
  madar: base({ depth: 2, quiescence: true, randomMove: 0.01, noise: 0.2, shortSighted: 0.1, spellChance: 0.95, spellNoise: 0.25, timeMs: 1000 }),
  aron: base({ depth: 2, quiescence: true, noise: 0.12, shortSighted: 0.03, spellNoise: 0.15, timeMs: 1200 }),
  istvan: base({ depth: 2, quiescence: true, noise: 0.08, spellNoise: 0.08, spellLook: 1, profile: { ...DEFAULT_AI, comboLimit: 32 }, timeMs: 1400 }),
  magnum: base({ depth: 2, quiescence: true, noise: 0.04, spellNoise: 0.04, spellLook: 2, profile: { ...DEFAULT_AI, comboLimit: 40 }, timeMs: 1600 }),
  boss: base({ depth: 3, width: 12, quiescence: true, noise: 0.02, spellLook: 3, profile: { ...DEFAULT_AI, comboLimit: 40 }, timeMs: 2500 }),
  oli: base({ depth: 3, width: 16, quiescence: true, noise: 0, spellLook: 4, profile: { ...DEFAULT_AI, comboLimit: 48, spreadCombos: true }, timeMs: 3500 }),
};
