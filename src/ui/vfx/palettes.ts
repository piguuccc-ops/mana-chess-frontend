// Colour ramps for effects (bright → dark), taken from the master pixel palette.
import type { Color } from '../../engine';
import { pack, packRamp } from './buffer';

export const RAMP = {
  fire: packRamp(['#fff0a0', '#fbc254', '#f28c38', '#e05a33', '#b3322c', '#7d1f22', '#4a1316']),
  ember: packRamp(['#fbc254', '#f28c38', '#e05a33', '#b3322c', '#7d1f22']),
  smoke: packRamp(['#8a8590', '#77727d', '#524e58', '#35323b', '#211f25']),
  dust: packRamp(['#d9b98c', '#bf915e', '#98693f', '#77503a', '#58392a']),
  stone: packRamp(['#d8d4da', '#a6a1aa', '#77727d', '#524e58', '#35323b']),
  steel: packRamp(['#ffffff', '#d8d4da', '#a6a1aa', '#77727d', '#524e58']),
  gold: packRamp(['#fff0a0', '#e6bf4c', '#b78a2b', '#7c5a1c', '#4d3413']),
  holy: packRamp(['#ffffff', '#fff4d9', '#fff0a0', '#e6bf4c', '#b78a2b']),
  ice: packRamp(['#ffffff', '#dff8ff', '#8fd8f5', '#4fa0e0', '#3569b8']),
  mana: packRamp(['#dff8ff', '#8fd8f5', '#4fa0e0', '#3569b8', '#23407a']),
  arcane: packRamp(['#f3e6ff', '#b184dc', '#7b48b0', '#4f2a78', '#2a1540']),
  teal: packRamp(['#dff8ff', '#7fd3c4', '#34948a', '#20615e', '#12383a']),
  nature: packRamp(['#d6f09a', '#b6e07a', '#71b24e', '#3e7f3a', '#24512b', '#16301c']),
  curse: packRamp(['#e8a0b0', '#9a3b54', '#5b2338', '#2a1540', '#140d0b']),
  blood: packRamp(['#e05a33', '#b3322c', '#7d1f22', '#4a1316']),
  time: packRamp(['#ffffff', '#dff8ff', '#9fe0f8', '#56a8c8', '#2d6f8f']),
  shadow: packRamp(['#524e58', '#35323b', '#211f25', '#140d0b']),
  bone: packRamp(['#fff4d9', '#efdcb2', '#dcbd8a', '#a57b4c']),
  wood: packRamp(['#bf915e', '#98693f', '#77503a', '#58392a', '#3d2a1f']),
  spark: packRamp(['#ffffff', '#fff0a0', '#fbc254', '#f28c38']),
  /** „Üvegátok”: pale glass, light to dark (the last one is the rim). */
  glass: packRamp(['#ffffff', '#dff8ff', '#b8ecfb', '#8fd8f5', '#4fa0e0', '#3569b8', '#23407a']),
} as const;

export type RampName = keyof typeof RAMP;

/** Mana belongs to a side: Világos = azure, Sötét = crimson (matches the crystals). */
export const MANA_RAMP: Record<Color, readonly number[]> = {
  w: packRamp(['#e9fbff', '#9fe0f8', '#4fa0e0', '#3569b8', '#23407a']),
  b: packRamp(['#ffd9d2', '#f08a7a', '#d0453a', '#9b2a2a', '#5c1719']),
};

export const PX = {
  white: pack('#ffffff'),
  ivory: pack('#fff4d9'),
  outline: pack('#140d0b'),
  black: pack('#000000'),
  shadow: pack('#000000', 0.35),
  gold: pack('#e6bf4c'),
  glint: pack('#fff0a0'),
  red: pack('#b3322c'),
  darkRed: pack('#7d1f22'),
  ember: pack('#e05a33'),
  ice: pack('#dff8ff'),
  sky: pack('#8fd8f5'),
  teal: pack('#7fd3c4'),
  arcane: pack('#b184dc'),
  violet: pack('#7b48b0'),
  green: pack('#71b24e'),
  steel: pack('#d8d4da'),
  iron: pack('#77727d'),
  wood: pack('#77503a'),
  dust: pack('#98693f'),
} as const;

/** Soft light (partially transparent pixels) for glows under the dithered cores. */
export const glowOf = (hex: string, a = 0.35): number => pack(hex, a);
