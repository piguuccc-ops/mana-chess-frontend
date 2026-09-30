// ─────────────────────────────────────────────────────────────────────────────
// Effect engine: one full-screen canvas at the board's art-pixel resolution.
// Particles, rings, beams and piece fragments are simulated on a small clock of
// their own and drawn into a PixelBuffer; the loop only runs while something
// is alive, so an idle board costs nothing.
// ─────────────────────────────────────────────────────────────────────────────
import type { Square } from '../../engine';
import { PixelBuffer } from './buffer';
import type { PackedSprite } from './buffer';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  /** Velocity damping per second (0 = none). */
  drag: number;
  /** Lifetime (ms). */
  life: number;
  /** Negative = not born yet (delay). */
  age: number;
  size: number;
  /** Packed colours from birth to death. */
  ramp: readonly number[];
  /** Dither out over the last part of the life. */
  fade: boolean;
  /** 0 square, 1 plus, 2 streak (line along the velocity), 3 sprite. */
  shape: 0 | 1 | 2 | 3;
  spr?: PackedSprite;
  /** Bounce/settle on this y (shards landing on the board). */
  floor?: number;
  /** Random twinkle (skips frames). */
  flicker?: number;
}

export interface Item {
  /** Engine time (ms) when the item starts drawing. */
  start: number;
  dur: number;
  /** 0 = below particles, 1 = above. */
  layer?: 0 | 1;
  /** p = progress 0..1, ms = elapsed. */
  draw: (b: PixelBuffer, p: number, ms: number) => void;
  /** Called once when the item expires. */
  done?: () => void;
}

export interface XY {
  x: number;
  y: number;
}

/** Board art: 8 squares of 20 art pixels. */
export const SQ = 20;

/** A slow push-in towards `focus` (art pixels), a hold, and a pull back. */
export interface CameraMove {
  focus: XY;
  zoom: number;
  inMs: number;
  holdMs: number;
  outMs: number;
}

export class VfxEngine {
  readonly buf = new PixelBuffer();
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  /** CSS px per art pixel. */
  scale = 3;
  /** Canvas top-left inside the host (CSS px). */
  private ox = 0;
  private oy = 0;
  private hostLeft = 0;
  private hostTop = 0;
  /** Board top-left in art pixels and orientation. */
  board = { x: 0, y: 0, flipped: false, ready: false };
  reduced = false;
  /** Silences the sounds that effects schedule (e.g. the looping card demos). */
  muted = false;
  /** Where effects look up their DOM anchors such as the mana crystals (default: the page). */
  scope: ParentNode | null = null;
  onShake: ((strength: number, dur: number) => void) | null = null;
  /**
   * Cinematic hooks the game screen provides (the card demos leave them unset): a camera move
   * towards a point of the board, and a hard cut of the background music.
   */
  onCamera: ((move: CameraMove) => void) | null = null;
  onSilence: ((ms: number) => void) | null = null;

  private t = 0;
  private last = 0;
  private raf = 0;
  private items: Item[] = [];
  private parts: Particle[] = [];
  private timers: { at: number; fn: () => void }[] = [];

  attach(canvas: HTMLCanvasElement | null): void {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    if (!canvas) this.stop();
  }

  /**
   * Aligns the art-pixel grid with the board: `boardRect` is the client rect of
   * the 8×8 squares, `hostRect` the client rect of the element holding the canvas.
   */
  layout(hostRect: DOMRect, boardRect: DOMRect, flipped: boolean): void {
    const c = this.canvas;
    if (!c) return;
    const s = boardRect.width / (8 * SQ);
    if (!(s > 0)) return;
    this.scale = s;
    this.hostLeft = hostRect.left;
    this.hostTop = hostRect.top;
    const bl = boardRect.left - hostRect.left;
    const bt = boardRect.top - hostRect.top;
    const mod = (a: number) => ((a % s) + s) % s;
    this.ox = mod(bl) - s;
    this.oy = mod(bt) - s;
    const w = Math.ceil((hostRect.width - this.ox) / s) + 1;
    const h = Math.ceil((hostRect.height - this.oy) / s) + 1;
    if (w !== this.buf.w || h !== this.buf.h) {
      this.buf.resize(w, h);
      c.width = w;
      c.height = h;
    }
    c.style.left = `${this.ox}px`;
    c.style.top = `${this.oy}px`;
    c.style.width = `${w * s}px`;
    c.style.height = `${h * s}px`;
    this.board = { x: Math.round((bl - this.ox) / s), y: Math.round((bt - this.oy) / s), flipped, ready: true };
  }

  /** Art pixels → client coordinates. */
  toClient(p: XY): XY {
    return { x: p.x * this.scale + this.ox + this.hostLeft, y: p.y * this.scale + this.oy + this.hostTop };
  }

  /** Client coordinates → art pixels. */
  fromClient(x: number, y: number): XY {
    return { x: (x - this.hostLeft - this.ox) / this.scale, y: (y - this.hostTop - this.oy) / this.scale };
  }

  /** First element matching `selector` inside the engine's scope. */
  query(selector: string): Element | null {
    const root = this.scope ?? (typeof document !== 'undefined' ? document : null);
    return root ? root.querySelector(selector) : null;
  }

  /** Centre of a DOM element in art pixels (or null when it is not rendered). */
  elementCenter(el: Element | null): XY | null {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    return this.fromClient(r.left + r.width / 2, r.top + r.height / 2);
  }

  /** Top-left art pixel of a square. */
  sq(s: Square): XY {
    const f = s % 8;
    const r = Math.floor(s / 8);
    const col = this.board.flipped ? 7 - f : f;
    const row = this.board.flipped ? r : 7 - r;
    return { x: this.board.x + col * SQ, y: this.board.y + row * SQ };
  }

  /** Centre of a square. */
  c(s: Square): XY {
    const p = this.sq(s);
    return { x: p.x + SQ / 2, y: p.y + SQ / 2 };
  }

  /** Board rectangle in art pixels. */
  boardRect(): { x: number; y: number; w: number; h: number } {
    return { x: this.board.x, y: this.board.y, w: SQ * 8, h: SQ * 8 };
  }

  now(): number {
    return this.t;
  }

  /** Runs `fn` after `ms` of effect time. */
  at(ms: number, fn: () => void): void {
    if (ms <= 0) {
      fn();
      return;
    }
    this.timers.push({ at: this.t + ms, fn });
    this.kick();
  }

  add(item: Omit<Item, 'start'> & { delay?: number }): void {
    this.items.push({ ...item, start: this.t + (item.delay ?? 0) });
    this.kick();
  }

  spawn(p: Particle): void {
    this.parts.push(p);
    this.kick();
  }

  shake(strength: number, dur = 260): void {
    if (this.reduced) return;
    this.onShake?.(strength, dur);
  }

  /** Drops everything (new game, screen change). */
  reset(): void {
    this.stop();
    this.items = [];
    this.parts = [];
    this.timers = [];
    this.buf.clear();
    if (this.ctx && this.buf.image) this.ctx.putImageData(this.buf.image, 0, 0);
  }

  get busy(): boolean {
    return this.items.length > 0 || this.parts.length > 0 || this.timers.length > 0;
  }

  private kick(): void {
    if (this.raf || !this.canvas) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private stop(): void {
    if (this.raf > 0) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private frame = (now: number): void => {
    // stays truthy while the frame runs so spawns during the frame don't queue extra callbacks
    this.raf = -1;
    const dt = Math.min(50, Math.max(0, now - this.last));
    this.last = now;
    this.t += dt;

    if (this.timers.length) {
      const due = this.timers.filter((x) => x.at <= this.t);
      if (due.length) {
        this.timers = this.timers.filter((x) => x.at > this.t);
        for (const d of due) d.fn();
      }
    }

    const b = this.buf;
    b.clear();
    const live: Item[] = [];
    const drawItems = (layer: 0 | 1) => {
      for (const it of this.items) {
        if ((it.layer ?? 1) !== layer) continue;
        const e = this.t - it.start;
        if (e < 0) continue;
        if (e <= it.dur) it.draw(b, it.dur > 0 ? e / it.dur : 1, e);
      }
    };
    drawItems(0);
    this.stepParticles(dt / 1000);
    drawItems(1);
    for (const it of this.items) {
      if (this.t - it.start <= it.dur) live.push(it);
      else it.done?.();
    }
    this.items = live;

    if (this.ctx && b.image) this.ctx.putImageData(b.image, 0, 0);
    this.raf = this.busy && this.canvas ? requestAnimationFrame(this.frame) : 0;
  };

  private stepParticles(dt: number): void {
    const b = this.buf;
    const alive: Particle[] = [];
    for (const p of this.parts) {
      p.age += dt * 1000;
      if (p.age < 0) {
        alive.push(p);
        continue;
      }
      if (p.age >= p.life) continue;
      p.vx += p.ax * dt;
      p.vy += p.ay * dt;
      if (p.drag) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.floor !== undefined && p.y > p.floor) {
        p.y = p.floor;
        p.vy = -p.vy * 0.3;
        p.vx *= 0.55;
        if (Math.abs(p.vy) < 6) p.vy = 0;
      }
      alive.push(p);
      const k = p.age / p.life;
      if (p.flicker && Math.random() < p.flicker) continue;
      const c = p.ramp[Math.min(p.ramp.length - 1, Math.floor(k * p.ramp.length))];
      const a = p.fade ? (k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45) : 1;
      switch (p.shape) {
        case 0:
          b.rect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size, c, a);
          break;
        case 1: {
          const x = Math.round(p.x);
          const y = Math.round(p.y);
          b.dot(x, y, c, a);
          b.dot(x - 1, y, c, a * 0.8);
          b.dot(x + 1, y, c, a * 0.8);
          b.dot(x, y - 1, c, a * 0.8);
          b.dot(x, y + 1, c, a * 0.8);
          break;
        }
        case 2: {
          const len = 0.045;
          b.line(p.x - p.vx * len, p.y - p.vy * len, p.x, p.y, c, a, p.size);
          break;
        }
        case 3:
          if (p.spr) b.sprite(p.spr, p.x - p.spr.w / 2, p.y - p.spr.h / 2, a);
          break;
      }
    }
    this.parts = alive;
  }
}
