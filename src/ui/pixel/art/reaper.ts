// „Végítélet”: the Reaper, carved like a chess piece – a hooded skull with glowing
// eyes, a crimson collar and base ring like the dark pieces, a shadow-violet robe.
// Front-facing and symmetric (drawn as the left half, like the other pieces); the
// scythe is drawn by the effect code so it can swing.
// 18×24 art + automatic 1-px outline = 20×26.
import type { SpriteSrc } from '../sprite';

export const REAPER_PAL: Readonly<Record<string, string>> = {
  '0': '#07060a',
  // robe: shadow-violet ramp (dark → light)
  '1': '#141019',
  '2': '#241d2e',
  '3': '#352b43',
  '4': '#4d3f5f',
  '5': '#75658a',
  // collar and base ring: crimson, like the dark pieces' trim
  '6': '#4a1316',
  '7': '#8f2a26',
  '8': '#d0543f',
  // bone (skull, hands)
  a: '#a08664',
  b: '#e6d3ac',
  c: '#fff8e6',
  // eyes
  k: '#ff4a2e',
};

export const REAPER: SpriteSrc = {
  mirror: 'even',
  outline: '0',
  shadeRight: { '5': '4', '4': '3', '3': '2', '8': '7', '7': '6' },
  rows: [
    '........3',
    '.......34',
    '......345',
    '.....3455',
    '....34511',
    '...3451bc',
    '...341bcc',
    '...341bkb',
    '...341ab1',
    '...3411bb',
    '...34411a',
    '....34411',
    '.....6777',
    '......344',
    '.....3445',
    '.....3454',
    '....34544',
    '....34544',
    '...345444',
    '...344544',
    '..3454444',
    '..6777777',
    '..3444444',
    '..2222222',
  ],
};

/**
 * Where the bony hands grip the scythe (sprite pixels, outline included): at the side of
 * the robe that faces the victim, `side` px from the centre line.
 */
export const REAPER_GRIP = { x: 10, y: 16.5, side: 5 };
