// Spell id → pixel icon. The icons live in three hand-drawn sets (spells_a/b/c);
// a rune stone stands in for any spell that has no icon yet.
import type { SpellId } from '../../../engine';
import type { SpriteSrc } from '../sprite';
import { ANCHORS } from './anchors';
import { SPELL_ICONS_A } from './spells_a';
import { SPELL_ICONS_B } from './spells_b';
import { SPELL_ICONS_C } from './spells_c';
import { UI_ICONS } from './ui_icons';

const ALL: Record<string, SpriteSrc> = {
  meteor: ANCHORS.meteor,
  mine: ANCHORS.bomb,
  timeStop: ANCHORS.hourglass,
  ...SPELL_ICONS_A,
  ...SPELL_ICONS_B,
  ...SPELL_ICONS_C,
};

export const spellSprite = (id: SpellId): SpriteSrc => ALL[id] ?? UI_ICONS.rune;
export const hasSpellIcon = (id: SpellId): boolean => id in ALL;
