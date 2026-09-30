import { COLOR_NAME_HU, PIECE_NAME_HU, SPELLS, squareName } from '../engine';
import type { Effect, EffectKind, GameState, Spell, SpellCategory } from '../engine';

export const CATEGORY_COLOR: Record<SpellCategory, string> = {
  Mozgás: 'var(--cat-move)',
  Védelem: 'var(--cat-guard)',
  Irányítás: 'var(--cat-control)',
  Taktika: 'var(--cat-tactic)',
  Terep: 'var(--cat-terrain)',
  Idő: 'var(--cat-time)',
  Mana: 'var(--cat-mana)',
  Pusztítás: 'var(--cat-doom)',
};

const EFFECT_TEXT: Record<EffectKind, string> = {
  pawnRush: 'két mezőt rohamozhat',
  bishopBlessing: 'egyszer átugorhat egy saját bábut',
  queenGrace: 'huszárként is léphet',
  kingStride: 'a király 2 mezőt léphet',
  immune: 'nem üthető',
  fortified: 'túléli a következő ütést',
  doubleMove: 'bónuszlépés a normál lépés után',
  royalGuard: 'a királyának nem adható sakk',
  deathMark: 'a következő ütés garantált',
  weakened: 'nem mozoghat',
  rooted: 'csak üthet',
  blinded: 'nem üthet',
  disarmed: 'nem üthet, nem támad',
  glassCursed: 'ha leüt valamit, maga is darabokra törik',
  frozen: 'nem mozoghat',
  silenced: 'nem használhat spellt',
  wall: 'blokkolt mező',
  gravity: 'a huszárok nem ugorhatnak',
  timeStop: 'nincs normál lépés, max. 1 spell',
  discount: 'a következő spell 2-vel olcsóbb',
  manaCap: 'maximális mana: 4',
  dimensionZone: 'a zónában mindenki huszárként lép',
  realityBreak: 'a bábuk átsiklanak a saját bábuikon',
  frenchCheese: 'en passant üthet bármely mellette álló ellenséges bábut',
  sniper: 'távolról lő – ütéskor a helyén marad',
  manaMage: '+1 mana körönként és ütésenként; aki spellel öli meg: −1 mana',
  mine: 'akna – a mezőn álló bábu elpusztul, ha felrobban',
  outOfWay: 'félreállt, a kör végén visszatér',
  pawnVault: 'átugorhatja az előtte álló bábut',
  scout: 'oldalra is léphet',
  provoked: 'a következő normál lépést ezzel kell megtenni',
  spellWard: 'az ellenfél spelljei nem célozhatják',
  manaDeposit: 'a következő saját kör elején +3 mana',
  manaThirst: 'az első ütés a leütött bábu értékét adja manában',
  manaFamine: 'nincs alap mana',
};

export function remainingText(e: Effect, state: GameState): string {
  if (e.expiresAfterTurn === null) return 'amíg el nem használódik';
  if (e.kind === 'mine') return e.expiresAfterTurn <= state.turnIndex ? 'e kör végén robban!' : 'az ellenfél körének végén robban';
  if (e.kind === 'manaMage') {
    const left = Math.max(0, Math.ceil((e.expiresAfterTurn - state.turnIndex) / 2));
    return left > 0 ? `még ${left}× +1 mana` : 'e kör végéig';
  }
  const turns = e.expiresAfterTurn - state.turnIndex + 1;
  if (turns <= 1) return 'e kör végéig';
  return `még ${turns} kör`;
}

export const effectText = (k: EffectKind): string => EFFECT_TEXT[k];

export function describeEffect(e: Effect, state: GameState): { title: string; text: string; who: string; target: string } {
  const spell = SPELLS[e.source];
  let target = '';
  if (e.pieceId) {
    const idx = state.board.findIndex((p) => p?.id === e.pieceId);
    const p = state.board[idx];
    if (p) target = `${PIECE_NAME_HU[p.type]} (${squareName(idx)})`;
  } else if (e.color) target = COLOR_NAME_HU[e.color];
  else if (e.squares?.length) target = e.squares.map(squareName).join(', ');
  else target = 'mindenki';
  return {
    title: spell?.name ?? e.kind,
    text: EFFECT_TEXT[e.kind],
    target,
    who: COLOR_NAME_HU[e.owner],
  };
}

// Soft hyphens at Hungarian compound boundaries so long names wrap nicely on small cards.
const HYPHENATED = [
  'Gyalog|roham', 'Huszár|ugrás', 'Futó|áldás', 'Bástya|töltés', 'Király|lépés', 'Gyalog|pajzs', 'Huszár|pajzs',
  'Meg|erősítés', 'Erőltetett menet', 'Azonnali át|változás', 'Király|védelem', 'Sakk|meg|szakító', 'Újra|sáncolás',
  'Halál|bélyeg', 'Mana|elszívás', 'Hatás|talanítás', 'Gyalog|fagyasztás', 'Gravi|táció',
  'Idő|megállítás', 'Vissza|tekerés', 'Vissza|lépés', 'Föld|rengés', 'Dimenzió|váltás', 'Túl|töltés', 'Nekro|mancia',
  'Valóság|törés', 'Vész|csere', 'Gyen|gítés', 'Ki|végzés', 'Futó|lövész',
  'Pajzs|romboló', 'Láthatat|lanság', 'Provo|káció', 'Sárkány|tűz', 'Vég|ítélet', 'Gyalog|ugrás', 'Gyors|sánc',
  'Át|képzés', 'Cser|kész', 'Gravitá|ciós kút', 'Üveg|átok',
];
const HYPH_MAP = new Map(HYPHENATED.map((h) => [h.replace(/\|/g, ''), h.replace(/\|/g, '\u00AD')]));
export const displayName = (spell: Spell): string => HYPH_MAP.get(spell.name) ?? spell.name;

/** Cost text for cards and lists: variable-cost spells (e.g. „Klón”) show their range. */
export const costText = (spell: Spell): string => spell.costLabel ?? String(spell.manaCost);

/** Engine texts may carry an emoji marker (e.g. the mine); the UI shows pixel icons instead. */
export const stripEmoji = (text: string): string =>
  text
    .replace(/\p{Extended_Pictographic}\uFE0F?/gu, '')
    .replace(/\(\s+/g, '(')
    .replace(/\s{2,}/g, ' ')
    .trim();

/** Move-list notation without emoji: the king's mine defusal „K(💣f7)” reads „K×akna f7”. */
export const cleanSan = (san: string): string => san.replace(/\(\p{Extended_Pictographic}\uFE0F?([a-h][1-8])\)/u, '×akna $1');
