// ─────────────────────────────────────────────────────────────────────────────
// Tiny sprite toolkit: sprites are authored as text rows of palette keys,
// resolved to a colour grid (pure, testable) and rendered once to a PNG data URL
// that the UI shows with `image-rendering: pixelated`.
// ─────────────────────────────────────────────────────────────────────────────
import { PALETTE } from './palette';

export interface SpriteSrc {
  /** Rows, top → bottom. With `mirror`, every row is the LEFT half only. */
  rows: readonly string[];
  /** 'even': the half is mirrored completely; 'odd': the last column is the centre column. */
  mirror?: 'even' | 'odd';
  /** Colours for the row characters (default: the master palette). */
  pal?: Readonly<Record<string, string>>;
  /** Adds a 1-px outline of this key around the silhouette (orthogonal neighbours). */
  outline?: string;
  /** Automatic lighting: on the right half every key in this map becomes its (darker) value. */
  shadeRight?: Readonly<Record<string, string>>;
}

export interface ResolvedSprite {
  w: number;
  h: number;
  /** Row-major hex colours, null = transparent. */
  px: (string | null)[];
}

const EMPTY = new Set(['.', ' ']);

/** Character grid after mirroring / shading / outlining (before palette lookup). */
export function spriteGrid(src: SpriteSrc): string[][] {
  let grid = src.rows.map((r) => {
    const chars = [...r];
    if (src.mirror === 'even') return [...chars, ...[...chars].reverse()];
    if (src.mirror === 'odd') return [...chars, ...chars.slice(0, -1).reverse()];
    return chars;
  });
  const w = Math.max(...grid.map((r) => r.length));
  grid = grid.map((r) => [...r, ...Array(w - r.length).fill('.')]);
  if (src.shadeRight) {
    const from = src.mirror === 'odd' ? Math.ceil(w / 2) : w / 2;
    for (const row of grid) {
      for (let x = Math.ceil(from); x < w; x++) {
        const s = src.shadeRight[row[x]];
        if (s) row[x] = s;
      }
    }
  }
  if (src.outline) {
    const h = grid.length;
    const out: string[][] = Array.from({ length: h + 2 }, () => Array(w + 2).fill('.'));
    const filled = (x: number, y: number) => y >= 0 && y < h && x >= 0 && x < w && !EMPTY.has(grid[y][x]);
    for (let y = -1; y <= h; y++) {
      for (let x = -1; x <= w; x++) {
        if (filled(x, y)) out[y + 1][x + 1] = grid[y][x];
        else if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) out[y + 1][x + 1] = src.outline;
      }
    }
    grid = out;
  }
  return grid;
}

export function resolveSprite(src: SpriteSrc, pal?: Readonly<Record<string, string>>): ResolvedSprite {
  const grid = spriteGrid(src);
  const colours = { ...PALETTE, ...(src.pal ?? {}), ...(pal ?? {}) };
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const px: (string | null)[] = [];
  for (const row of grid) {
    for (const ch of row) {
      if (EMPTY.has(ch)) px.push(null);
      else px.push(colours[ch] ?? '#ff00ff');
    }
  }
  return { w, h, px };
}

// ── Browser rendering (cached) ───────────────────────────────────────────────

const urlCache = new WeakMap<SpriteSrc, Map<string, { url: string; w: number; h: number }>>();

function paint(r: ResolvedSprite): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, r.w);
  canvas.height = Math.max(1, r.h);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(canvas.width, canvas.height);
  r.px.forEach((hex, i) => {
    if (!hex) return;
    const n = parseInt(hex.slice(1), 16);
    img.data[i * 4] = (n >> 16) & 255;
    img.data[i * 4 + 1] = (n >> 8) & 255;
    img.data[i * 4 + 2] = n & 255;
    img.data[i * 4 + 3] = 255;
  });
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/** PNG data URL + size of a sprite (optionally with a palette override, e.g. piece colours). */
export function spriteImage(src: SpriteSrc, pal?: Readonly<Record<string, string>>, palKey = ''): { url: string; w: number; h: number } {
  let m = urlCache.get(src);
  if (!m) urlCache.set(src, (m = new Map()));
  const key = palKey || (pal ? JSON.stringify(pal) : '');
  const hit = m.get(key);
  if (hit) return hit;
  const r = resolveSprite(src, pal);
  const res = { url: paint(r), w: r.w, h: r.h };
  m.set(key, res);
  return res;
}

/** Draws a resolved sprite onto any canvas context (used by effects and generated scenes). */
export function drawSprite(ctx: CanvasRenderingContext2D, r: ResolvedSprite, x: number, y: number, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  for (let j = 0; j < r.h; j++) {
    for (let i = 0; i < r.w; i++) {
      const c = r.px[j * r.w + i];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x + i, y + j, 1, 1);
    }
  }
  ctx.restore();
}
