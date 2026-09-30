// The demo "hand": a pointing parchment glove with a brass cuff, used by the
// spell demos to show where the player clicks (13×14 art + outline = 15×16).
import type { SpriteSrc } from '../sprite';

export const POINTER: SpriteSrc = {
  outline: '0',
  rows: [
    '....99.......',
    '....98.......',
    '....98.......',
    '....98.......',
    '....98.99....',
    '....98.98.99.',
    '.99.98.98.98.',
    '.98998898897.',
    '.98888888887.',
    '..9888888887.',
    '..988888877..',
    '...98888877..',
    '...oppppppo..',
    '...onnnnnno..',
  ],
};

/** The index fingertip in sprite pixels (outline included) – the click point. */
export const POINTER_TIP = { x: 5.5, y: 1.5 };
