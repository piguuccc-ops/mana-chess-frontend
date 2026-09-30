// Words for the effect canvas, set in the game's own pixel fonts (the bitmaps the TrueType
// fonts were built from), so a title can shine, glitch or fall apart pixel by pixel.
import fontData from '../pixel/fontData.json';
import type { PackedSprite } from './buffer';

type Glyph = { top: number; rows: string[] };
const FONTS = fontData as unknown as {
  pixel: Record<string, Glyph>;
  gothic: Record<string, Glyph>;
  space: { pixel: number; gothic: number };
};

/**
 * A line of text as a packed sprite. `colorAt(k)` colours each pixel by its height in the
 * line (k = 0 at the lowest pixel, 1 at the highest); `outline` wraps it in a 1-px border.
 */
export function textSprite(text: string, font: 'pixel' | 'gothic', colorAt: (k: number) => number, outline?: number): PackedSprite {
  const glyphs = FONTS[font];
  const pts: { x: number; h: number }[] = [];
  let x = 0;
  for (const ch of text) {
    if (ch === ' ') {
      x += FONTS.space[font] + 1;
      continue;
    }
    const g = glyphs[ch];
    if (!g) continue;
    g.rows.forEach((row, i) => {
      for (let j = 0; j < row.length; j++) if (row[j] === '#') pts.push({ x: x + j, h: g.top - i });
    });
    x += Math.max(...g.rows.map((r) => r.length)) + 1;
  }
  if (!pts.length) return { w: 1, h: 1, px: new Uint32Array(1) };
  let maxH = -Infinity;
  let minH = Infinity;
  for (const p of pts) {
    maxH = Math.max(maxH, p.h);
    minH = Math.min(minH, p.h);
  }
  const pad = outline ? 1 : 0;
  const w = x - 1 + pad * 2;
  const h = maxH - minH + 1 + pad * 2;
  const px = new Uint32Array(w * h);
  const span = Math.max(1, maxH - minH);
  for (const p of pts) px[(maxH - p.h + pad) * w + p.x + pad] = colorAt((p.h - minH) / span);
  if (outline) {
    const ink = px.slice();
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        if (ink[yy * w + xx]) continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) {
          for (let dx = -1; dx <= 1 && !near; dx++) {
            const nx = xx + dx;
            const ny = yy + dy;
            near = nx >= 0 && ny >= 0 && nx < w && ny < h && ink[ny * w + nx] !== 0;
          }
        }
        if (near) px[yy * w + xx] = outline;
      }
    }
  }
  return { w, h, px };
}
