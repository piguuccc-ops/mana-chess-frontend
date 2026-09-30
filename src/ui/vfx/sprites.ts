// Packed (Uint32) copies of the pixel sprites, for drawing into the effect buffer.
import type { Color, PieceType, SpellId } from '../../engine';
import { ANCHORS } from '../pixel/art/anchors';
import { PIECE_PAL, PIECE_SPRITES } from '../pixel/art/pieces';
import { REAPER, REAPER_PAL } from '../pixel/art/reaper';
import { spellSprite } from '../pixel/art/spellIcons';
import { UI_ICONS } from '../pixel/art/ui_icons';
import { resolveSprite, type SpriteSrc } from '../pixel/sprite';
import { packSprite, type PackedSprite } from './buffer';

const cache = new Map<string, PackedSprite>();

function get(key: string, src: SpriteSrc, pal?: Readonly<Record<string, string>>): PackedSprite {
  let s = cache.get(key);
  if (!s) {
    s = packSprite(resolveSprite(src, pal));
    cache.set(key, s);
  }
  return s;
}

export const pieceSpr = (type: PieceType, color: Color): PackedSprite => get(`p:${type}${color}`, PIECE_SPRITES[type], PIECE_PAL[color]);
export const spellSpr = (id: SpellId): PackedSprite => get(`s:${id}`, spellSprite(id));
export const iconSpr = (name: keyof typeof UI_ICONS): PackedSprite => get(`i:${String(name)}`, UI_ICONS[name]);
export const anchorSpr = (name: keyof typeof ANCHORS): PackedSprite => get(`a:${String(name)}`, ANCHORS[name]);

/** „Végítélet”: the Reaper chess piece. */
export const reaperSpr = (): PackedSprite => get('reaper', REAPER, REAPER_PAL);

const halos = new Map<string, PackedSprite>();

/**
 * A 1-px halo around a sprite's silhouette, one pixel larger on every side (draw it at
 * the sprite's origin − 1). Lets dark figures stand out on dark squares.
 */
export function haloOf(key: string, spr: PackedSprite, color: number): PackedSprite {
  const k = `${key}:${color}`;
  let h = halos.get(k);
  if (h) return h;
  const w = spr.w + 2;
  const hh = spr.h + 2;
  const px = new Uint32Array(w * hh);
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < spr.w && y < spr.h && spr.px[y * spr.w + x] !== 0;
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x - 1;
      const sy = y - 1;
      if (solid(sx, sy)) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) near = solid(sx + dx, sy + dy);
      if (near) px[y * w + x] = color;
    }
  }
  h = { w, h: hh, px };
  halos.set(k, h);
  return h;
}

/** Small hand-drawn effect sprites (heads of projectiles, debris…). */
const FX_SRC: Record<string, SpriteSrc> = {
  rock: {
    outline: '0',
    rows: ['..dcc..', '.decbb.', 'deccbba', 'dccbbba', '.cbbba.', '..aaa..'],
  },
  fireball: {
    rows: ['..kkj..', '.klkkj.', 'klllkkj', 'klNlkkj', 'kllkkj.', '.kkjj..', '..jj...'],
  },
  arrowhead: {
    rows: ['..f', '.ff', 'fff', '.ff', '..f'],
  },
  feather: {
    rows: ['....9', '...98', '..98.', '.98..', '98...', '8....'],
  },
  leaf: {
    rows: ['.ut', 'uts', 'ts.'],
  },
  coin: {
    outline: '0',
    rows: ['.pp.', 'pqpo', 'ppoo', '.oo.'],
  },
  shard: {
    rows: ['B.', 'AB', 'zA'],
  },
  bone: {
    rows: ['9.9', '.9.', '9.9'],
  },
  heart: {
    rows: ['.i.i.', 'ijiii', 'iiiii', '.iii.', '..i..'],
  },
  drop: {
    rows: ['.i.', 'iji', 'iii', '.h.'],
  },
};

export const fxSpr = (name: keyof typeof FX_SRC): PackedSprite => get(`f:${name}`, FX_SRC[name]);
