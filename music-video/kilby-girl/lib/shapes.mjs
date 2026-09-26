// Path helpers. Everything returns a Path2D so one geometry can be inked on all three drums.
import { Path2D } from './ink.mjs';
import { hs, TAU } from './util.mjs';

export const rect = (x, y, w, h) => {
  const p = new Path2D();
  p.rect(x, y, w, h);
  return p;
};

export const circle = (x, y, r) => {
  const p = new Path2D();
  p.arc(x, y, Math.max(0, r), 0, TAU);
  return p;
};

export const ellipse = (x, y, rx, ry, rot = 0) => {
  const p = new Path2D();
  p.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU);
  return p;
};

export const poly = (pts, close = true) => {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  if (close) p.closePath();
  return p;
};

// smooth closed/open curve through points (Catmull-Rom -> cubic Bezier)
export function curve(pts, close = true, tension = 0.5) {
  const p = new Path2D();
  const n = pts.length;
  const get = (i) => (close ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  p.moveTo(pts[0][0], pts[0][1]);
  const last = close ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const k = tension / 3;
    p.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k,
      p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k,
      p2[0], p2[1],
    );
  }
  if (close) p.closePath();
  return p;
}

// jitter points for hand-cut "boil" (seeded by the held 12 fps frame)
export const boil = (pts, amp, seed) => pts.map(([x, y], i) => [x + hs(seed, i, 1) * amp, y + hs(seed, i, 2) * amp]);

// a wobbly hand-cut blob around a centre
export function blob(cx, cy, r, n = 9, rough = 0.12, seed = 0, sy = 1) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (1 + hs(seed, i) * rough);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * sy]);
  }
  return curve(pts);
}

// thick limb from a to b as a closed capsule path
export function capsule(ax, ay, bx, by, wa, wb = wa) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const a = Math.atan2(dy, dx);
  const p = new Path2D();
  p.moveTo(ax + nx * wa / 2, ay + ny * wa / 2);
  p.lineTo(bx + nx * wb / 2, by + ny * wb / 2);
  p.arc(bx, by, wb / 2, a + Math.PI / 2, a - Math.PI / 2, true);
  p.lineTo(ax - nx * wa / 2, ay - ny * wa / 2);
  p.arc(ax, ay, wa / 2, a - Math.PI / 2, a + Math.PI / 2, true);
  p.closePath();
  return p;
}

export function line(pts) {
  return poly(pts, false);
}

export function star(cx, cy, r1, r2, n = 5, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = rot + (i / (n * 2)) * TAU;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return poly(pts);
}

export function roundRect(x, y, w, h, r) {
  const p = new Path2D();
  p.roundRect(x, y, w, h, r);
  return p;
}

// sagging wire between two points (quadratic approximation of a catenary)
export function sagPoint(x0, y0, x1, y1, sag, u) {
  return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + sag * 4 * u * (1 - u)];
}
export function wire(x0, y0, x1, y1, sag) {
  const p = new Path2D();
  p.moveTo(x0, y0);
  p.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2, x1, y1);
  return p;
}
