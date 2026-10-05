// ─────────────────────────────────────────────────────────────────────────────
// The bots' portraits: 32 × 32 pixel busts drawn in code (no image files), in the same
// palette-and-outline style as the pieces. Each is built on a little canvas of palette keys –
// shapes for the head and the shoulders, stamps for eyes, mouths and props – and comes out as a
// SpriteSrc like every other sprite of the game.
//
// Keys: 0 outline · s S t skin (base, shade, light) · a A b hair · c C d clothes · e E N eyes
// (white, pupil, shine) · m M mouth (lips, teeth) · r blush · the rest is each portrait's own.
// ─────────────────────────────────────────────────────────────────────────────
import type { BotId } from '../../../bots/strength';
import type { SpriteSrc } from '../sprite';

const W = 32;
const H = 32;

/** A canvas of palette keys ('.' = transparent). */
class Pix {
  g: string[][] = Array.from({ length: H }, () => Array(W).fill('.'));
  set(x: number, y: number, c: string): this {
    if (x >= 0 && x < W && y >= 0 && y < H) this.g[y][x] = c;
    return this;
  }
  get(x: number, y: number): string {
    return x >= 0 && x < W && y >= 0 && y < H ? this.g[y][x] : '.';
  }
  rect(x0: number, y0: number, x1: number, y1: number, c: string): this {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c);
    return this;
  }
  /** A filled ellipse (centre and radii in pixels); `only` limits what it may paint over. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string, only?: (k: string, x: number, y: number) => boolean): this {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1 && (!only || only(this.g[y][x], x, y))) this.g[y][x] = c;
      }
    }
    return this;
  }
  /** Draws text rows at (x, y); '.' leaves what is under it. */
  stamp(rows: readonly string[], x: number, y: number): this {
    rows.forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && this.set(x + i, y + j, ch)));
    return this;
  }
  /** The rows at (x, y) and their mirror image on the other side of the centre line. */
  pair(rows: readonly string[], x: number, y: number): this {
    this.stamp(rows, x, y);
    const w = Math.max(...rows.map((r) => r.length));
    return this.stamp(
      rows.map((r) => [...r.padEnd(w, '.')].reverse().join('')),
      W - x - w,
      y,
    );
  }
  /** Every `from` pixel right of `x0` (rows y0..y1) becomes `to` – the light comes from the left. */
  shade(from: string, to: string, x0: number, y0 = 0, y1 = H - 1): this {
    for (let y = y0; y <= y1; y++) for (let x = x0; x < W; x++) if (this.g[y][x] === from) this.g[y][x] = to;
    return this;
  }
  /** The `only` keys inside the rectangle become `c`. */
  recolor(x0: number, y0: number, x1: number, y1: number, only: string, c: string): this {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.get(x, y) === only) this.set(x, y, c);
    return this;
  }
  /** A 1-px outline (`key`) around everything drawn so far. */
  outline(key = '0'): this {
    const out = this.g.map((r) => [...r]);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (this.g[y][x] !== '.') continue;
        const n = [this.get(x - 1, y), this.get(x + 1, y), this.get(x, y - 1), this.get(x, y + 1)];
        if (n.some((k) => k !== '.' && k !== key)) out[y][x] = key;
      }
    }
    this.g = out;
    return this;
  }
  rows(): string[] {
    return this.g.map((r) => r.join(''));
  }
}


/** Shoulders in the clothes' colours (c, shaded C on the right). */
function shoulders(p: Pix, rx = 13.5, top = 24.5): Pix {
  p.ellipse(15.5, top + 9, rx, 9.2, 'c');
  return p.shade('c', 'C', 21);
}

/** Neck, head and ears (s, shaded S on the right, t light on the left cheek). */
function head(p: Pix, o: { rx?: number; ry?: number; cy?: number; ears?: boolean } = {}): Pix {
  const cy = o.cy ?? 14;
  const rx = o.rx ?? 8.8;
  p.rect(13, 20, 18, 25, 's');
  p.ellipse(15.5, cy, rx, o.ry ?? 9.4, 's');
  if (o.ears !== false) {
    // right against the face on both sides, however wide it is
    const l = Math.ceil(15 - rx) - 1;
    const r = Math.floor(15 + rx) + 1;
    p.rect(l, cy, l, cy + 3, 's').rect(r, cy, r, cy + 3, 's');
    p.set(l, cy + 1, 'S').set(r, cy + 1, 'S');
  }
  p.shade('s', 'S', 20, 0, 25);
  // the jaw's shadow on the neck, a little light on the left cheek
  for (let x = 12; x <= 19; x++) if (p.get(x, cy + 10) === 's' || p.get(x, cy + 10) === 'S') p.set(x, cy + 10, 'S');
  p.set(9, cy + 4, 't').set(10, cy + 4, 't').set(9, cy + 3, 't');
  return p;
}

/** Eyes at row `y` (2 tall): white outside, pupil and a shine – looking `look` (-1 left, 0, 1 right). */
function eyes(p: Pix, y: number, look: -1 | 0 | 1 = 0): Pix {
  const L = look < 0 ? ['NE.', 'EEe'] : look > 0 ? ['eNE', 'eEE'] : ['eNE', 'eEE'];
  const R = look < 0 ? ['NEe', 'EEe'] : look > 0 ? ['.NE', 'eEE'] : ['NEe', 'EEe'];
  return p.stamp(L, 10, y).stamp(R, 19, y);
}

/** A palette with the shared keys filled in. */
const pal = (own: Record<string, string>): Record<string, string> => ({
  '0': '#1a1012',
  e: '#fff6ea',
  E: '#1a1012',
  N: '#ffffff',
  m: '#6b2626',
  M: '#fff6ea',
  r: '#ec8f84',
  ...own,
});
const LIGHT = { s: '#f6d4b4', S: '#dfa985', t: '#fde7d2' };
const WARM = { s: '#f0c39a', S: '#d39b72', t: '#f9dcc0' };

type Build = () => SpriteSrc;

// ── 1. Kende the genius – szőke, oldalra fésült haj, kék szem, magabiztos mosoly, ing és pulóver,
//       fényképezőgép, és egy csillanás, mert nagyon jóképű ──
const kende: Build = () => {
  const p = new Pix();
  shoulders(p);
  // a crisp shirt collar over the sweater
  p.stamp(['dd......dd', '.ddd..ddd.', '..dd..dd..'], 11, 24);
  head(p, { rx: 8.4, ry: 9.8 });
  // blond hair: volume on top, parted on the left and swept right over the forehead
  p.ellipse(15.5, 10.4, 9.9, 7.4, 'a', (k, _x, y) => y <= 10 && (k !== '.' || y >= 3));
  p.ellipse(14.5, 4, 7.6, 3.6, 'a');
  p.stamp(['aaaaaaaaaaaaaaaa', '......aaaaaaaaaa', '..........aaaaa.', '.............a..'], 8, 10);
  p.stamp(['a', 'a', 'a'], 7, 10).stamp(['a', 'a'], 24, 10);
  p.shade('a', 'A', 21, 0, 13);
  // the parting and the shine of a good hair day
  p.stamp(['A', 'A'], 11, 4).set(12, 6, 'A');
  p.stamp(['..bbbbb', '.bb....', 'bb.....'], 13, 1).stamp(['bbbb', '....bb'], 14, 7).set(20, 9, 'b').set(9, 9, 'b');
  // calm, confident brows, blue eyes and a winning smile
  p.stamp(['.000'], 9, 13).stamp(['000.'], 19, 13);
  eyes(p, 15, 0);
  p.set(16, 18, 'S');
  p.stamp(['0......0', '.0MMMM0.', '..0000..'], 12, 19);
  // the camera on its strap: a photographer, after all
  p.stamp(['k........k', '.k......k.'], 11, 26);
  p.stamp(['.KKKKKK.', 'KkkzzkkK', 'KkzwzzkK', 'KKkkkkKK'], 12, 28);
  p.outline();
  // the sparkle – drawn after the outline so it stays light
  p.stamp(['..N..', '..N..', 'NNNNN', '..N..', '..N..'], 25, 1).set(27, 3, 'y');
  p.set(4, 6, 'N');
  return { rows: p.rows(), pal: pal({ ...LIGHT, E: '#2a5d9c', a: '#ecc85a', A: '#c49a3c', b: '#fff3b0', c: '#3e7f3a', C: '#2b5a29', d: '#f4f1ea', k: '#2b2a31', K: '#4c4a55', z: '#2e5c9e', w: '#9fe0f8', y: '#fff3b0' }) };
};

// ── 2. Erika the English teacher – kócos, szétálló vörösesbarna haj, ceruza a kontyba szúrva,
//       ferdén csúszott piros szemüveg, egyik szemöldöke az égben, „hö?” száj, kérdőjel a feje fölött,
//       piros toll ──
const erika: Build = () => {
  const p = new Pix();
  shoulders(p, 13);
  p.stamp(['dd....dd', '.dd..dd.', '..dddd..'], 12, 24);
  // frizzy hair behind the head, down to the shoulders – a bad hair day, every day
  p.ellipse(15.5, 15, 11.2, 10.8, 'A', (k, _x, y) => y <= 25 && (k === '.' || k === 'c' || k === 'C'));
  p.stamp(['A.', '.A'], 3, 9).stamp(['A', '.', 'A'], 3, 14).stamp(['.A', 'A.'], 27, 8).stamp(['A', '.', 'A'], 28, 13).stamp(['A.', '.A'], 3, 20).stamp(['.A', 'A.'], 27, 20);
  head(p, { rx: 8.2, ears: false });
  // the hair on top, a fringe that gave up, the messy bun
  p.ellipse(15.5, 10.6, 9.6, 7.4, 'a', (k, _x, y) => y <= 9 && k !== '.');
  p.stamp(['aaaaaaa', 'aaaaa..', 'aaa....', 'aa.....', 'a......', 'a......', 'a......', 'a......'], 7, 9);
  p.stamp(['....aa', '.....a', '.....a', '.....a', '.....a'], 19, 9);
  p.ellipse(15.5, 3.2, 4, 3, 'a');
  p.stamp(['a.', '.a'], 9, 4).stamp(['.a', 'a.'], 21, 4).set(11, 0, 'a').set(20, 1, 'a').set(6, 7, 'a').set(25, 7, 'a');
  p.shade('a', 'A', 20, 0, 24);
  p.stamp(['bb.', '.bb'], 13, 2).stamp(['.bbb', 'bb..'], 10, 6);
  // the pencil she stuck in the bun – and has been looking for since
  p.stamp(['........hx', '......hh..', '....hh....', '..hh......', 'kh........'], 11, 1);
  // one brow up in the sky, the glasses slid down on one side
  p.stamp(['.00.', '0..0'], 9, 11).stamp(['.000'], 19, 13);
  eyes(p, 15, 0);
  p.stamp(['gggggg', 'g....g', 'g....g', 'gggggg'], 8, 14).stamp(['gggggg', 'g....g', 'g....g', 'gggggg'], 18, 15);
  p.stamp(['gg..', '..gg'], 14, 15);
  p.recolor(9, 15, 12, 16, 'e', 'G').recolor(19, 16, 22, 17, 'e', 'G');
  // a puzzled, wobbly mouth in red lipstick, pearl earrings
  p.stamp(['.l..l.', 'l.ll.l'], 13, 20);
  p.set(7, 19, 'M').set(24, 19, 'M');
  // the question mark over her head
  p.stamp(['.qqq.', 'q...q', '...q.', '..q..', '.....', '..q..'], 2, 1);
  // the red pen she points with
  p.stamp(['....i', '...i.', '..i..', '.i...', 'h....'], 25, 21);
  p.stamp(['jj', 'jj', 'jj'], 24, 26);
  p.outline();
  return { rows: p.rows(), pal: pal({ ...LIGHT, a: '#9a4527', A: '#6b2c18', b: '#c4643f', c: '#2b3a6b', C: '#1d284d', d: '#f2ead8', g: '#c0282c', G: '#e9f5ff', l: '#c8323a', i: '#d1342c', h: '#f2d27a', x: '#f08aa0', k: '#3a3436', q: '#fff6ea', j: '#f0c39a' }) };
};

// ── 3. Nádi the normal – alacsony (kicsi és lejjebb ül a képen), tál-frizura égnek álló tinccsel,
//       óriási kerek szemüveg, fogszabályzós vigyor, lila fejhallgató, két számmal nagyobb kapucnis
//       pulóver, telefon ──
const nadi: Build = () => {
  const p = new Pix();
  // the hoodie, two sizes too big
  shoulders(p, 14.8, 25.5);
  p.stamp(['d............d', '.dd........dd.', '...dddddddd...'], 9, 25);
  p.rect(13, 23, 18, 26, 's');
  head(p, { cy: 18, rx: 8.2, ry: 8.2 });
  // the bowl cut: a round cap, bangs cut dead straight, and the strand that never lies down
  p.ellipse(15.5, 16, 9.6, 7.4, 'a', (k, _x, y) => y <= 15 && (k !== '.' || y >= 9));
  p.rect(7, 15, 8, 18, 'a').rect(23, 15, 24, 18, 'a');
  p.stamp(['..a', '.a.', '.a.', 'a..'], 17, 5);
  p.shade('a', 'A', 20, 0, 18);
  p.stamp(['.bbbb', 'bb...'], 10, 10).stamp(['bbb'], 15, 9);
  // headphones over it all
  p.ellipse(15.5, 17, 10.6, 8.6, 'h', (k, _x, y) => y <= 9 && k !== '.');
  p.stamp(['hh', 'HH', 'HH', 'HH', 'hh'], 5, 15).stamp(['hh', 'HH', 'HH', 'HH', 'hh'], 25, 15);
  // enormous round glasses, eyes swimming in them, a grin full of braces
  eyes(p, 18, 1);
  p.stamp(['.ggggg.', 'gg...gg', 'g.....g', 'g.....g', 'gg...gg', '.ggggg.'], 7, 16).stamp(['.ggggg.', 'gg...gg', 'g.....g', 'g.....g', 'gg...gg', '.ggggg.'], 18, 16);
  p.rect(14, 18, 17, 18, 'g');
  p.recolor(8, 17, 12, 20, 's', 'G').recolor(8, 17, 12, 20, 'S', 'G').recolor(8, 17, 12, 20, 't', 'G').recolor(8, 17, 12, 20, 'e', 'G');
  p.recolor(19, 17, 23, 20, 's', 'G').recolor(19, 17, 23, 20, 'S', 'G').recolor(19, 17, 23, 20, 't', 'G').recolor(19, 17, 23, 20, 'e', 'G');
  p.stamp(['0......0', '.0MxMxM0', '..00000.'], 12, 22);
  // the phone in his hand, screen glowing
  p.stamp(['kkkk', 'kzwk', 'kwzk', 'kzwk', 'kkkk'], 22, 25);
  p.stamp(['jjj', 'jjj'], 21, 29);
  p.outline();
  return { rows: p.rows(), pal: pal({ ...WARM, a: '#1d1a24', A: '#0f0d14', b: '#3c3650', c: '#7b48b0', C: '#55307d', d: '#b184dc', h: '#34948a', H: '#1f625c', g: '#2b2a31', G: '#dff1ff', x: '#8d99a6', k: '#24232b', z: '#e8456f', w: '#5be3e0', j: WARM.s }) };
};

// ── 4. Magyar Péter the man – szakáll, napszemüveg, öltöny, vörös nyakkendő, arany aura ──
const peter: Build = () => {
  const p = new Pix();
  // the aura: a golden glow around the whole bust
  p.ellipse(15.5, 13.5, 13.5, 13, 'q').ellipse(15.5, 35, 16, 11, 'q');
  p.ellipse(15.5, 13.5, 12.5, 12, '.', (k) => k === 'q').ellipse(15.5, 35, 15, 10, '.', (k) => k === 'q');
  shoulders(p, 13.8);
  p.stamp(['dd....dd', '.dd..dd.', '..dddd..', '...ii...', '...ii...', '..iiii..', '...ii...'], 12, 24);
  head(p, { rx: 9 });
  // slicked-back dark hair
  p.ellipse(15.5, 10, 9.8, 7, 'a', (k, _x, y) => y <= 8 && (k !== '.' || y >= 3));
  p.stamp(['a......a', 'a......a'], 12, 8).shade('a', 'A', 20, 0, 12);
  p.stamp(['.bbbb', 'bb...'], 10, 4);
  // sunglasses, a full beard and a confident smile
  p.stamp(['0000', '000.'], 9, 13).stamp(['0000', '.000'], 19, 13);
  p.stamp(['kkkkkk', 'kKkkkk', '.kkkk.'], 8, 15).stamp(['kkkkkk', 'kKkkkk', '.kkkk.'], 18, 15).rect(14, 15, 17, 15, 'k');
  p.ellipse(15.5, 20, 8.6, 5.2, 'a', (k, _x, y) => (k === 's' || k === 'S' || k === 't') && y >= 18);
  p.stamp(['aaaaaaaa'], 12, 18);
  p.stamp(['.MMMMM.', '..mmm..'], 12, 20);
  p.shade('a', 'A', 20, 13, 26);
  p.outline();
  return { rows: p.rows(), pal: pal({ ...WARM, a: '#2a1d16', A: '#170f0b', b: '#4d382b', c: '#23324f', C: '#151f35', d: '#f4f1ea', i: '#b3322c', k: '#16151a', K: '#7d8ba3', q: '#f7d15a' }) };
};

// ── 5. Misi the pro – fésült fekete haj, arany pilótaszemüveg, aranylánc, motoros dzseki, bukósisak a hóna alatt ──
const misu: Build = () => {
  const p = new Pix();
  shoulders(p, 14);
  // the motocross jacket: black with orange stripes, a white tee under it
  p.recolor(6, 25, 9, 31, 'c', 'o').recolor(22, 25, 25, 31, 'C', 'O');
  p.stamp(['dddddddd', '.dddddd.', '..dddd..'], 12, 24);
  head(p);
  // a styled quiff
  p.ellipse(15.5, 10, 9.8, 7, 'a', (k, _x, y) => y <= 9 && (k !== '.' || y >= 3));
  p.ellipse(13, 4, 6.5, 3.2, 'a');
  p.stamp(['aa......aa', 'a........a'], 11, 10);
  p.shade('a', 'A', 20, 0, 12);
  p.stamp(['.bbbb', 'bbb..'], 9, 2).set(9, 5, 'b');
  // gold aviator sunglasses and a confident grin
  p.stamp(['qqqqqq', 'qkkkkq', 'qkKkkq', '.kkkk.'], 8, 13).stamp(['qqqqqq', 'qkkkkq', 'qkKkkq', '.kkkk.'], 18, 13).rect(14, 13, 17, 13, 'q');
  p.stamp(['0......0', '.0MMMM0.', '..0000..'], 12, 19);
  // the gold chain
  p.stamp(['q.q.q.q.q', '.Q.Q.Q.Q.'], 11, 23).set(15, 25, 'Q').set(16, 25, 'q');
  // the helmet under his arm: orange shell, dark visor
  p.stamp(['..hhhhh..', '.hhhhhhh.', 'hhkkkkkhh', 'hkkKkkkkh', 'hhkkkkkhh', 'hhhhhhhhh', '.HHHHHHH.', '..HHHHH..'], 22, 22);
  p.outline();
  return { rows: p.rows(), pal: pal({ ...LIGHT, a: '#24212a', A: '#141217', b: '#56525f', c: '#1d1c22', C: '#121116', o: '#f28c38', O: '#c25f1c', d: '#f4f1ea', q: '#e6bf4c', Q: '#fff0a0', k: '#16151a', K: '#8fa3c0', h: '#f28c38', H: '#c25f1c' }) };
};

// ── 6. Madár the master – alacsony (lejjebb ül a képen), menő barna frizura: középen elválasztott,
//       két oldalra hulló tincsek, felnyírt oldal; kék madárka a fején, headset, lehajtott kapucni,
//       áthúzott paradicsom a pulóveren ──
const madar: Build = () => {
  const p = new Pix();
  shoulders(p, 13.2, 26.5);
  // the hood, down: rolled up behind the neck, and its strings
  p.ellipse(15.5, 27.6, 10, 3.4, 'h', (k) => k === '.' || k === 'c' || k === 'C');
  p.ellipse(15.5, 28.4, 6.6, 2.2, 'c', (k) => k === 'h');
  p.rect(13, 22, 18, 27, 's');
  head(p, { cy: 17, rx: 8.5, ry: 8.6 });
  p.shade('h', 'H', 21);
  p.stamp(['w....w', 'w....w', 'w....w'], 13, 28);
  // the faded sides: hair cut short above the ears
  p.rect(7, 11, 8, 15, 'f').rect(23, 11, 24, 15, 'F');
  // the top: parted in the middle, two curtains falling to the brows
  p.stamp([
    '....aaaaaaaa....',
    '..aaaaaaaaaaaa..',
    '.aaaaaaaaaaaaaa.',
    'aaaaaaaAAaaaaaaa',
    'aaaaaaa..aaaaaaa',
    'aaaaaa....aaaaaa',
    'aaaaa......aaaaa',
    '.aaa........aaa.',
    '..aa........aa..',
  ], 8, 6);
  p.shade('a', 'A', 21, 0, 15);
  p.stamp(['...bbb', '.bb...', 'b.....'], 9, 7).stamp(['bb', '..b', '...b'], 17, 7).stamp(['b', 'b'], 9, 11);
  // the blue bird, perched on the hair
  p.stamp(['...zzz..', '..zzzzz.', '.zzNEzzl', 'zzzzzzz.', '.ZZzzZZ.', '..k..k..'], 11, 0);
  // relaxed brows, a sideways look and a smirk, the headset with its microphone
  p.stamp(['.000'], 9, 15).stamp(['000.'], 19, 15);
  eyes(p, 16, -1);
  p.stamp(['...00', '0000.'], 13, 21);
  p.stamp(['gg', 'gg', 'gg'], 5, 16).stamp(['gg', 'gg', 'gg'], 25, 16).stamp(['g.', '.g', '.gG'], 7, 19);
  // the badge: a tomato, crossed out
  p.stamp(['..uu.', '.iui.', 'iiNii', 'iiiii', '.iii.'], 20, 26);
  p.stamp(['....k', '...k.', '..k..', '.k...', 'k....'], 20, 26);
  p.outline();
  return { rows: p.rows(), pal: pal({ ...LIGHT, c: '#23407a', C: '#14213d', h: '#2e5294', H: '#1c3366', a: '#6b4226', A: '#4a2c18', b: '#9a6a40', f: '#a57c5c', F: '#8a6448', w: '#e8e4dc', z: '#4fa0e0', Z: '#2e6fb0', l: '#f28c38', k: '#1a1012', g: '#2b2a31', G: '#e05a33', i: '#d63a2c', u: '#3e7f3a' }) };
};

// ── 7. Áron the cheater – szőke haj, fejpánt, csíkos mez, kacsintás, ász az ujjai közt ──
const aron: Build = () => {
  const p = new Pix();
  shoulders(p);
  // red-and-white striped football shirt
  for (let x = 4; x < 28; x += 4) p.recolor(x, 24, x + 1, 31, 'c', 'd').recolor(x, 24, x + 1, 31, 'C', 'D');
  p.stamp(['kk....kk', '.kk..kk.', '..kkkk..'], 12, 24);
  head(p);
  // short blond hair and a sweatband
  p.ellipse(15.5, 9.8, 9.6, 6.6, 'a', (k, _x, y) => y <= 9 && (k !== '.' || y >= 3));
  p.stamp(['.a.a.a..a.a.a.'], 9, 3);
  p.rect(7, 10, 24, 11, 'i').shade('i', 'I', 20, 10, 11);
  p.shade('a', 'A', 20, 0, 9);
  p.stamp(['bbb', '..bb'], 10, 4);
  // one brow up, a wink, a sly smile
  p.stamp(['.000', '0...'], 9, 12).stamp(['.00.', '0..0'], 19, 12);
  eyes(p, 15, 1);
  p.rect(10, 15, 12, 16, 's').stamp(['000'], 10, 16);
  p.stamp(['......0', '00000M.', '.mmmm..'], 12, 19);
  // the ace up his sleeve
  p.stamp(['NNNNN', 'NiNNN', 'NNiNN', 'NiiiN', 'NNiNN', 'NNNNN'], 23, 23).stamp(['jj', 'jj'], 22, 28);
  p.outline();
  return { rows: p.rows(), pal: pal({ ...WARM, a: '#e6c35a', A: '#b8913a', b: '#fff0a0', c: '#c23b30', C: '#8e2620', d: '#f4f1ea', D: '#c9c4bb', i: '#c23b30', I: '#8e2620', k: '#1a1012', j: WARM.s }) };
};

// ── 8. István the hacker – fekete kapucni, árnyékos arc, zölden világító szemüveg, mini kecskeszakáll,
//       és egy rikító, hülye széldzseki a derekára kötve (ezért látszik deréktól felfelé) ──
const istvan: Build = () => {
  const p = new Pix();
  // a little more of him than of the others: down to the waist, where the jacket is tied
  shoulders(p, 14.2, 21.5);
  p.rect(13, 19, 18, 22, 's');
  head(p, { cy: 12, ry: 9, ears: false });
  // the hood, deep
  p.ellipse(15.5, 12, 11.8, 11.2, 'c', (k, _x, y) => k === '.' && y <= 23);
  p.ellipse(15.5, 10, 10, 8.2, 'c', (_k, _x, y) => y <= 7);
  p.stamp(['c..............c', 'cc............cc'], 8, 8);
  // the arms hang at the sides, the torso narrows to the waist
  p.rect(7, 25, 7, 31, '0').rect(24, 25, 24, 31, '0');
  p.shade('c', 'C', 21);
  // the face in shadow under the hood's rim
  p.recolor(7, 8, 24, 12, 's', 'S').recolor(7, 8, 24, 12, 't', 'S');
  // glasses glowing green with code
  p.stamp(['gggggggggggggg', 'gzyzggggzyzzgg', 'gyzzg....gzyzg'.replace(/\./g, 'g'), 'gggggggggggggg'], 9, 12);
  p.recolor(9, 13, 22, 14, 'g', 'z');
  p.stamp(['g', 'g'], 15, 13).stamp(['g', 'g'], 16, 13);
  // a straight mouth and the mini goatee under it
  p.stamp(['00000'], 13, 18);
  p.stamp(['.bbbb.', '..bb..'], 13, 19);
  // green ones and zeros on the hoodie
  p.stamp(['y.y', '.yy', 'y.y'], 9, 22).stamp(['yy.', 'y.y', '.yy'], 20, 22);
  // the jacket tied around the waist: loud pink and yellow, sleeves knotted in front, jeans below
  p.rect(8, 27, 23, 28, 'p').rect(8, 29, 23, 29, 'u').rect(8, 30, 23, 31, 'n');
  p.stamp(['..pppp..', '.pPPPPp.', 'pPppppPp', '.pPPPPp.', 'uu....uu', 'uu....uu'], 12, 26);
  p.shade('p', 'P', 21, 26, 31).shade('n', 'N', 20, 30, 31);
  // the hands at the ends of the sleeves
  p.rect(3, 30, 6, 31, 's').rect(25, 30, 28, 31, 'S');
  p.outline();
  return { rows: p.rows(), pal: pal({ ...WARM, s: '#b88a6a', S: '#8f6650', t: '#c99a78', b: '#3a281e', c: '#212027', C: '#141318', g: '#121116', z: '#7dff8f', y: '#3fbf55', p: '#ff4fa3', P: '#c9307a', u: '#ffd23f', n: '#34507e', N: '#243a5e' }) };
};

// ── 9. Magnum ice cream – csokibevonatos jégkrém pálcikán, harapásnyom, napszemüveg, svéd sál ──
const magnum: Build = () => {
  const p = new Pix();
  // the stick
  p.rect(14, 24, 17, 31, 'w').rect(16, 24, 17, 31, 'W');
  // the bar: rounded chocolate block
  p.ellipse(15.5, 13, 9, 12.5, 'c');
  p.rect(7, 12, 24, 24, 'c');
  p.ellipse(15.5, 23, 9, 2.5, 'c');
  p.shade('c', 'C', 20);
  // the bite: vanilla shows where the corner is gone
  p.ellipse(25, 4, 5, 5, '.', (k) => k === 'c' || k === 'C');
  p.ellipse(25, 4, 6, 6, 'v', (k, x, y) => (k === 'c' || k === 'C') && Math.hypot(x + 0.5 - 25, y + 0.5 - 4) > 4.6);
  // chocolate drips and a shine
  p.stamp(['d', 'd', 'd.', 'dd'], 9, 6).set(10, 8, 'd');
  p.stamp(['c', 'c'], 11, 25).stamp(['C', 'C', 'C'], 21, 25);
  // cool sunglasses and a happy face
  p.stamp(['kkkkkk..kkkkkk', 'kKkkkk..kKkkkk', '.kkkk....kkkk.'], 9, 11).rect(15, 11, 16, 11, 'k');
  p.stamp(['0......0', '.0mmmm0.', '..0000..'], 12, 16);
  p.set(10, 15, 'r').set(21, 15, 'r');
  // a scarf in blue and yellow
  p.rect(6, 20, 25, 22, 'x').rect(6, 21, 25, 21, 'y').stamp(['xx', 'yy', 'xx', 'x.'], 21, 23);
  p.outline();
  return { rows: p.rows(), pal: pal({ c: '#4a2716', C: '#33190d', d: '#75452a', v: '#fdf3d6', w: '#e8c48f', W: '#c49a62', k: '#16151a', K: '#7d8ba3', x: '#2c5aa0', y: '#f2c933' }) };
};

// ── 10. Boss the boss – mélyen húzott fekete sapka, árnyék, vörösen izzó szem, szendvics ──
const boss: Build = () => {
  const p = new Pix();
  shoulders(p, 14);
  p.stamp(['dd........dd', '.dd......dd.', '..dddddddd..'], 10, 24);
  head(p);
  // the cap pulled low, its shadow over the eyes
  p.ellipse(15.5, 9.5, 10, 6.8, 'h', (k, _x, y) => y <= 11 && (k !== '.' || y >= 3));
  p.rect(5, 11, 27, 12, 'h').rect(3, 12, 10, 12, 'h');
  p.shade('h', 'H', 20, 0, 12);
  p.stamp(['jj', 'j.'], 11, 5);
  p.recolor(6, 13, 25, 16, 's', 'x').recolor(6, 13, 25, 16, 'S', 'x').recolor(6, 13, 25, 16, 't', 'x');
  p.stamp(['ii.', '.I.'], 10, 14).stamp(['.ii', '.I.'], 19, 14);
  p.stamp(['0000'], 14, 20);
  // the sandwich, still the breakfast one
  p.stamp(['.oooooo.', 'oOOOOOOo', 'uuuuuuuu', 'iiiiiiii', 'oOOOOOOo', '.oooooo.'], 21, 25);
  p.stamp(['ss', 'ss'], 20, 29);
  p.outline();
  return { rows: p.rows(), pal: pal({ ...LIGHT, h: '#1e1d24', H: '#121116', j: '#3a3846', x: '#3d2a24', i: '#ff3b30', I: '#9b1d17', c: '#2a1b15', C: '#1d140f', d: '#58392a', o: '#d9a35b', O: '#b37d3e', u: '#71b24e' }) };
};

// ── 11. Oli the phone taker – nagy szőke tanár hawaii ingben, szemüveg (sasszem-csillanás),
//        elkobzott telefon ──
const oli: Build = () => {
  const p = new Pix();
  // radar rings behind him
  for (const r of [14.5, 12]) p.ellipse(15.5, 14, r, r, 'R', (k, x, y) => k === '.' && Math.hypot(x + 0.5 - 15.5, y + 0.5 - 14) > r - 1);
  shoulders(p, 15, 23.5);
  // the Hawaiian shirt: hibiscus flowers and leaves on turquoise, the collar open
  for (const [x, y] of [[5, 26], [10, 29], [20, 26], [23, 30], [15, 30]] as const) p.stamp(['.f.', 'fyf', '.f.'], x, y);
  for (const [x, y] of [[8, 26], [13, 27], [18, 29], [26, 27], [3, 29], [21, 29]] as const) p.stamp(['l.', '.l'], x, y);
  for (const [x, y] of [[9, 25], [17, 27], [7, 30], [25, 25], [12, 31]] as const) p.set(x, y, 'W');
  head(p, { rx: 9.4, ry: 9.8 });
  p.stamp(['ssssss', '.ssss.', '..ss..'], 13, 24);
  p.stamp(['L......L', '.L....L.', '..L..L..', '...LL...'], 12, 24);
  // blond hair, neatly parted
  p.ellipse(15.5, 9.8, 10.2, 7, 'a', (k, _x, y) => y <= 9 && (k !== '.' || y >= 3));
  p.stamp(['aaaaa..', 'aaaa...', 'aa.....'], 8, 10).stamp(['..aaaaa', '...aaaa', '.....aa'], 17, 10);
  p.shade('a', 'A', 20, 0, 12);
  p.stamp(['bbbb.', '.bbbb'], 10, 4);
  // rectangular glasses with the eagle-eye glint, a strict-but-kind smile
  p.stamp(['000.'], 9, 13).stamp(['.000'], 19, 13);
  eyes(p, 15, 0);
  p.stamp(['gggggg', 'g....g', 'g....g', 'gggggg'], 8, 14).stamp(['gggggg', 'g....g', 'g....g', 'gggggg'], 18, 14).rect(14, 15, 17, 15, 'g');
  p.recolor(9, 15, 12, 16, 'e', 'G').recolor(19, 15, 22, 16, 'e', 'G');
  p.stamp(['N.', '.N'], 21, 12).set(23, 11, 'N');
  p.stamp(['0......0', '.000000.'], 12, 20);
  // the confiscated phone, held up
  p.stamp(['kkkkk', 'kzwzk', 'kwzwk', 'kzwzk', 'kzzzk', 'kkkkk'], 24, 21).stamp(['ss', 'ss', 'ss'], 24, 27);
  p.outline();
  return { rows: p.rows(), pal: pal({ ...LIGHT, a: '#ead27a', A: '#c4a64c', b: '#fff3b0', c: '#1fa3b5', C: '#167785', L: '#8fe3ec', f: '#ff5f7e', y: '#ffd23f', l: '#2f8f4e', W: '#fff6ea', g: '#2b2a31', G: '#e4f4ff', k: '#24232b', z: '#3569b8', w: '#8fd8f5', R: '#e6bf4c' }) };
};

const BUILDS: Record<BotId, Build> = { kende, erika, nadi, peter, misu, madar, aron, istvan, magnum, boss, oli };
const cache = new Map<BotId, SpriteSrc>();

/** The portrait of a bot (built once). */
export function portrait(id: BotId): SpriteSrc {
  let s = cache.get(id);
  if (!s) cache.set(id, (s = BUILDS[id]()));
  return s;
}

/** For the preview and the tests: every builder. */
export const PORTRAITS: Record<BotId, () => SpriteSrc> = BUILDS;
