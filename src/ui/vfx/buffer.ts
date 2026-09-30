// ─────────────────────────────────────────────────────────────────────────────
// Software pixel buffer for the effect layer. Everything is drawn in whole
// "art pixels" (the board's pixel grid) and faded with ordered dithering instead
// of alpha blending, so spell effects look like hand-animated pixel art rather
// than soft vector glows.
// ─────────────────────────────────────────────────────────────────────────────

/** 4×4 Bayer thresholds in (0, 1). */
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** Packs #rrggbb into the little-endian RGBA word ImageData expects. */
export function pack(hex: string, alpha = 1): number {
  const n = parseInt(hex.slice(1, 7), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export const packRamp = (hexes: readonly string[]): number[] => hexes.map((h) => pack(h));

export interface PackedSprite {
  w: number;
  h: number;
  /** 0 = transparent. */
  px: Uint32Array;
}

/** Converts a resolved sprite (hex or null per pixel) into packed words. */
export function packSprite(src: { w: number; h: number; px: readonly (string | null)[] }): PackedSprite {
  const out = new Uint32Array(src.w * src.h);
  src.px.forEach((c, i) => {
    if (c) out[i] = pack(c);
  });
  return { w: src.w, h: src.h, px: out };
}

export const passes = (x: number, y: number, alpha: number): boolean =>
  alpha >= 1 || (alpha > 0 && alpha > BAYER4[((y & 3) << 2) | (x & 3)]);

export class PixelBuffer {
  w = 0;
  h = 0;
  data: Uint32Array = new Uint32Array(0);
  image: ImageData | null = null;

  resize(w: number, h: number): void {
    this.w = Math.max(1, w | 0);
    this.h = Math.max(1, h | 0);
    this.image = new ImageData(this.w, this.h);
    this.data = new Uint32Array(this.image.data.buffer);
  }

  clear(): void {
    this.data.fill(0);
  }

  /** One pixel; `alpha` < 1 is rendered as an ordered-dither pattern. */
  dot(x: number, y: number, c: number, alpha = 1): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    if (!passes(x, y, alpha)) return;
    this.data[y * this.w + x] = c;
  }

  rect(x: number, y: number, w: number, h: number, c: number, alpha = 1): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.floor(x + w));
    const y1 = Math.min(this.h, Math.floor(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        if (passes(xx, yy, alpha)) this.data[yy * this.w + xx] = c;
      }
    }
  }

  /** Rectangle outline, `t` pixels thick. */
  frame(x: number, y: number, w: number, h: number, c: number, alpha = 1, t = 1): void {
    this.rect(x, y, w, t, c, alpha);
    this.rect(x, y + h - t, w, t, c, alpha);
    this.rect(x, y + t, t, h - 2 * t, c, alpha);
    this.rect(x + w - t, y + t, t, h - 2 * t, c, alpha);
  }

  /** Bresenham line. */
  line(x0: number, y0: number, x1: number, y1: number, c: number, alpha = 1, thick = 1): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const off = Math.floor((thick - 1) / 2);
    for (let guard = 0; guard < 4000; guard++) {
      if (thick === 1) this.dot(x0, y0, c, alpha);
      else this.rect(x0 - off, y0 - off, thick, thick, c, alpha);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Midpoint circle outline (optionally squashed vertically for floor rings). */
  circle(cx: number, cy: number, r: number, c: number, alpha = 1, squash = 1, thick = 1): void {
    for (let t = 0; t < thick; t++) {
      const rr = Math.round(r) - t;
      if (rr < 0) return;
      if (rr === 0) {
        this.dot(cx, cy, c, alpha);
        return;
      }
      let x = rr;
      let y = 0;
      let d = 1 - rr;
      const plot = (px: number, py: number) => this.dot(cx + px, cy + py * squash, c, alpha);
      while (x >= y) {
        plot(x, y);
        plot(-x, y);
        plot(x, -y);
        plot(-x, -y);
        plot(y, x);
        plot(-y, x);
        plot(y, -x);
        plot(-y, -x);
        y++;
        if (d < 0) d += 2 * y + 1;
        else {
          x--;
          d += 2 * (y - x) + 1;
        }
      }
    }
  }

  /** Filled disc; `alphaAt(dist01)` lets glows fall off towards the rim. */
  disc(cx: number, cy: number, r: number, c: number, alpha = 1, squash = 1, alphaAt?: (d: number) => number): void {
    const ry = r * squash;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = (x + 0.5 - cx) / r;
        const dy = (y + 0.5 - cy) / (ry || 1);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 1) continue;
        this.dot(x, y, c, alphaAt ? alpha * alphaAt(d) : alpha);
      }
    }
  }

  /**
   * Draws a packed sprite. `tint` replaces every opaque pixel (hit flashes),
   * `mask(x, y)` can hide single pixels (dissolves, slices).
   */
  sprite(s: PackedSprite, x: number, y: number, alpha = 1, tint?: number, mask?: (sx: number, sy: number) => boolean, flipX = false): void {
    const ox = Math.round(x);
    const oy = Math.round(y);
    for (let sy = 0; sy < s.h; sy++) {
      for (let sx = 0; sx < s.w; sx++) {
        const c = s.px[sy * s.w + (flipX ? s.w - 1 - sx : sx)];
        if (!c) continue;
        if (mask && !mask(sx, sy)) continue;
        this.dot(ox + sx, oy + sy, tint ?? c, alpha);
      }
    }
  }

  /** Same as `sprite` but every art pixel is drawn as a k×k block (pop-in stamps). */
  spriteScaled(s: PackedSprite, x: number, y: number, k: number, alpha = 1, tint?: number): void {
    const ox = Math.round(x);
    const oy = Math.round(y);
    for (let sy = 0; sy < s.h; sy++) {
      for (let sx = 0; sx < s.w; sx++) {
        const c = s.px[sy * s.w + sx];
        if (!c) continue;
        this.rect(ox + sx * k, oy + sy * k, k, k, tint ?? c, alpha);
      }
    }
  }
}
