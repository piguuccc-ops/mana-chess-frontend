// ─────────────────────────────────────────────────────────────────────────────
// The AI's picks in Spell-toborzás: the spells it plays best (the balance test's scores), a sane
// mana curve (two cheap cards, something castable from 3 mana in the opening hand), a little
// randomness – and never a card it cannot use.
// ─────────────────────────────────────────────────────────────────────────────
import { DECK_SIZE, draftTurn, pickBlockReason, SPELLS, type Color, type Draft, type SpellId } from '../engine';

/**
 * How a deck holding the spell did in the balance test (BALANCE.md, AI vs AI: percentage points
 * above or below the average) – a measure of what this AI plays well.
 */
export const DRAFT_VALUE: Record<SpellId, number> = {
  pawnRush: 0.5, knightLeap: 2, bishopBlessing: -5.7, rookCharge: 3.4, queenGrace: 0, kingStride: -6.7, pawnShield: -1.8,
  knightShield: -2.8, fortify: -6.1, sacrifice: -8.4, forcedMarch: 1.8, teleport: 4.9, swap: 12.3, emergencySwap: -1.4,
  stepBack: -3.1, doubleMove: -14.9, instantPromotion: -1.9, royalGuard: -1.8, checkBreaker: -7.5, recastle: -3.9,
  deathMark: -3, weaken: -6.5, root: -1.1, blindSpot: 1.2, silence: 0, manaDrain: 0.3, disarm: 4.3, pawnFreeze: 1,
  wall: -2.1, barricade: -5.9, gravity: -3.9, chaos: -6, mirror: -6.9, timeStop: 3.5, rewind: 4.9, earthquake: -0.9,
  dimensionShift: 5.8, bloodPrice: -1.8, overcharge: 4, arcaneSurge: 5.1, gambit: 0.6, lastChance: -2.6, execution: 3.6,
  meteor: 10.7, necromancy: 4.5, realityBreak: 9.2, brigade: -29.1, clone: 9.6, frenchCheese: 9, bishopSniper: -7.2,
  manaMage: 1, mine: 6.1, outOfWay: -3, quickCastle: -4.8, pawnVault: -7.5, provoke: 10.7, invisibility: -0.3,
  magnet: 7.6, repulse: 0, manaDeposit: 4.3, scout: 5, manaThirst: -1.1, retrain: 2, storm: -2.4, shieldBreaker: 6.6,
  gravityWell: 6.1, manaArmageddon: 2.3, dragonFire: 13.8, doomsday: -5.2, glassCurse: -3.2, doom: 6.1,
} as Record<SpellId, number>;
const VALUE = DRAFT_VALUE;

/** Spells the AI almost never manages to cast: a dead card in its hand. */
const AVOID = new Set<SpellId>(['doubleMove', 'manaThirst', 'fortify', 'lastChance', 'brigade'] as SpellId[]);

const cost = (id: SpellId) => SPELLS[id].manaCost;

/** The AI's pick for `me`, or null when it is not its turn. */
export function aiDraftPick(d: Draft, me: Color, random: () => number = Math.random): SpellId | null {
  if (draftTurn(d) !== me) return null;
  const mine = d.picks[me];
  const left = DECK_SIZE - mine.length;
  const cheapNeeded = Math.max(0, 2 - mine.filter((id) => cost(id) <= 2).length);
  // the opening hand (the first three picks) needs something castable from the starting 3 mana
  const handNeedsCheap = mine.length === 2 && !mine.some((id) => cost(id) <= 3);
  let best: SpellId | null = null;
  let bestScore = -Infinity;
  for (const id of d.pool) {
    if (pickBlockReason(d, me, id) !== null) continue;
    const c = cost(id);
    let score = VALUE[id] ?? 0;
    if (AVOID.has(id)) score -= 15;
    if (cheapNeeded > 0 && left <= cheapNeeded) score += c <= 2 ? 100 : -100;
    if (handNeedsCheap) score += c <= 3 ? 100 : -100;
    if (mine.length < 3 && c <= 3) score += 2; // a quick start
    // taking away what the opponent would want counts a little
    score += Math.max(0, VALUE[id] ?? 0) * 0.15;
    score += (random() - 0.5) * 6;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}
