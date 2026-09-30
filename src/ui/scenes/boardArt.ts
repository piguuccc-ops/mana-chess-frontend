// Things that stand on the board squares: stone wall blocks („Fal”, „Barikád”)
// and the dirt mound a mine is buried in („Akna”).
// Painted procedurally at the board's art resolution (20 px per square).
import { makeCanvas, once, px, rect, rng, toURL } from './paint';

/** A raised block of mortared stone filling one square. */
function paintWall(): string {
  const p = makeCanvas(20, 20);
  const r = rng(77);
  // contact shadow
  rect(p, 1, 18, 19, 2, 'rgba(0,0,0,0.45)');
  // outline
  rect(p, 0, 1, 20, 18, '#140d0b');
  // top face
  rect(p, 1, 2, 18, 4, '#a6a1aa');
  rect(p, 1, 2, 18, 1, '#d8d4da');
  for (let x = 1; x < 19; x++) if (r() < 0.25) px(p, x, 3 + Math.floor(r() * 2), '#8a8590');
  px(p, 3, 3, '#d8d4da');
  px(p, 12, 4, '#d8d4da');
  // front face: three courses of bricks
  rect(p, 1, 6, 18, 12, '#211f25');
  const courses = [6, 10, 14];
  courses.forEach((y0, ci) => {
    const off = ci % 2 === 0 ? 0 : 4;
    for (let bx = -8 + off; bx < 19; bx += 8) {
      const x0 = Math.max(1, bx + 1);
      const x1 = Math.min(18, bx + 7);
      if (x1 <= x0) continue;
      const tone = ['#6b6671', '#77727d', '#5f5a66'][Math.floor(r() * 3)];
      rect(p, x0, y0 + 1, x1 - x0 + 1, 3, tone);
      rect(p, x0, y0 + 1, x1 - x0 + 1, 1, '#8f8a95');
      px(p, x0, y0 + 2, '#8f8a95');
      rect(p, x0, y0 + 3, x1 - x0 + 1, 1, '#524e58');
      if (r() < 0.5) px(p, x0 + 2 + Math.floor(r() * 3), y0 + 2, '#524e58');
    }
  });
  // right-side shade for volume
  for (let y = 6; y < 18; y++) px(p, 18, y, '#35323b');
  // moss
  px(p, 2, 17, '#3e7f3a');
  px(p, 3, 17, '#24512b');
  px(p, 15, 13, '#3e7f3a');
  return toURL(p);
}

/** Freshly dug earth around a buried mine. */
function paintMound(): string {
  const p = makeCanvas(20, 8);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 20; x++) {
      const d = Math.hypot((x - 9.5) / 9.5, (y - 4.5) / 3.6);
      if (d > 1) continue;
      const c = y < 3 ? '#98693f' : d > 0.8 ? '#3d2a1f' : y < 5 ? '#77503a' : '#58392a';
      px(p, x, y, c);
    }
  }
  px(p, 6, 2, '#bf915e');
  px(p, 12, 2, '#bf915e');
  px(p, 4, 4, '#3d2a1f');
  px(p, 15, 5, '#3d2a1f');
  return toURL(p);
}

export const boardArt = once(() => ({
  wall: paintWall(),
  mound: paintMound(),
}));
