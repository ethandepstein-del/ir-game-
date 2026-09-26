// Scenery: night sky, the Wasatch, bungalows, telephone poles, string lights, the flyer fence.
import { circle, curve, ellipse, line, poly, rect, roundRect, sagPoint, star, wire } from './shapes.mjs';
import { clamp, hash, hs, lerp, noise1, rng, TAU } from './util.mjs';

export const W = 1920, H = 1080;

// ink recipes [yellow, pink, blue]
export const K = {
  paper: [0, 0, 0],
  navy: [0, 1, 1],
  ink: [0.35, 1, 1], // darkest
  blue: [0, 0, 1],
  pink: [0, 1, 0],
  yellow: [1, 0, 0],
  red: [1, 1, 0],
  green: [1, 0, 1],
  purple: [0, 1, 0.55],
  skin: [0.1, 0.16, 0],
  skinShade: [0.18, 0.34, 0.05],
  hair: [0, 1, 0],
  denim: [0, 0.12, 0.85],
};

export function skyNight(P, { top = [0, 0.62, 1], mid = [0, 0.34, 1], low = [0.14, 0.5, 0.75], y0 = 0, y1 = H } = {}) {
  P.linear(rect(-400, -400, W + 800, H + 800), 0, y0, 0, y1, [[0, top], [0.62, mid], [1, low]]);
}

export function skyDusk(P) {
  P.linear(rect(-400, -400, W + 800, H + 800), 0, 0, 0, H * 0.75, [
    [0, [0, 0.55, 0.75]], [0.45, [0.25, 0.75, 0.35]], [0.8, [0.75, 0.6, 0.05]], [1, [0.95, 0.35, 0]],
  ]);
}

// stars are knocked out of every drum so they read as bare paper
export function stars(P, t, { n = 80, seed = 3, yMax = 620, twinkle = 0, x0 = -200, x1 = W + 200 } = {}) {
  for (let i = 0; i < n; i++) {
    const x = lerp(x0, x1, hash(seed, i, 1));
    const y = hash(seed, i, 2) ** 1.3 * yMax - 100;
    const big = hash(seed, i, 3) > 0.9;
    const tw = 0.6 + 0.4 * Math.sin(t * (2 + hash(seed, i, 4) * 5) + i) * twinkle;
    const r = (big ? 4.2 : 2.3) * tw;
    if (big && tw > 0.8) P.fill(star(x, y, r * 3, r * 0.9, 4, 0), K.paper);
    else P.fill(circle(x, y, r), K.paper);
  }
}

export function moon(P, x, y, r) {
  P.glow(x, y, r * 2.6, [0, 0.4, 0.5], 'knock', 0.3);
  P.fill(circle(x, y, r), [0.12, 0, 0]);
  P.fill(circle(x - r * 0.35, y - r * 0.2, r * 0.18), [0.25, 0.05, 0.1]);
  P.fill(circle(x + r * 0.3, y + r * 0.35, r * 0.12), [0.25, 0.05, 0.1]);
}

// jagged ridge; returns the path. snow=true knocks paper caps onto the highest peaks
export function mountains(P, { base = 760, amp = 260, seed = 1, inks = K.navy, snow = false, x0 = -300, x1 = W + 300, step = 70, scroll = 0 } = {}) {
  const pts = [[x0, H + 50]];
  const peaks = [];
  const s0 = Math.floor((x0 + scroll) / step) - 1;
  for (let k = s0; k * step - scroll < x1 + step; k++) {
    const x = k * step - scroll;
    const big = noise1(k * 0.23, seed) * 0.55 + noise1(k * 0.071, seed + 9) * 0.45;
    const y = base - (0.5 + big) * amp * 0.9 - hs(seed, k) * amp * 0.12;
    pts.push([x, y]);
    peaks.push([x, y]);
  }
  pts.push([x1 + step, H + 50]);
  P.fill(poly(pts), inks);
  if (snow) {
    const top = Math.min(...peaks.map((p) => p[1]));
    for (let i = 1; i < peaks.length - 1; i++) {
      const [x, y] = peaks[i];
      if (y < top + amp * 0.32 && y < peaks[i - 1][1] && y < peaks[i + 1][1]) {
        const d = amp * 0.16;
        const [lx, ly] = peaks[i - 1], [rx, ry] = peaks[i + 1];
        const a = [lerp(x, lx, d / (ly - y + 1e-3) * 0.9), y + d], b = [lerp(x, rx, d / (ry - y + 1e-3) * 0.9), y + d];
        P.fill(poly([[x, y], [b[0], b[1]], [lerp(x, b[0], 0.5), y + d * 0.65], [x, y + d * 0.9], [lerp(x, a[0], 0.5), y + d * 0.7], a]), K.paper);
      }
    }
  }
}

// craftsman bungalow silhouette with lit windows; returns nothing
export function house(P, x, ground, w, h, seed, { lit = 0.6, inks = K.navy, t = 0 } = {}) {
  const roof = h * (0.35 + hash(seed, 1) * 0.2);
  const pts = [[x, ground], [x, ground - h], [x + w * 0.5, ground - h - roof], [x + w, ground - h], [x + w, ground]];
  P.fill(poly(pts), inks);
  // porch roof
  P.fill(poly([[x - 12, ground - h * 0.45], [x + w * 0.55, ground - h * 0.45], [x + w * 0.55, ground - h * 0.38], [x - 12, ground - h * 0.38]]), inks);
  // chimney
  if (hash(seed, 2) > 0.4) P.fill(rect(x + w * 0.72, ground - h - roof * 0.9, w * 0.07, roof * 0.7), inks);
  const nwin = 2 + Math.floor(hash(seed, 3) * 2);
  for (let i = 0; i < nwin; i++) {
    const wx = x + w * (0.15 + i * 0.7 / nwin), wy = ground - h * 0.8, ww = w * 0.14, wh = h * 0.28;
    const on = hash(seed, i, 7) < lit;
    if (on) {
      const flick = 0.85 + 0.15 * Math.sin(t * 3 + i * 9 + seed);
      P.fill(rect(wx, wy, ww, wh), [1 * flick, 0.25, 0]);
      P.fill(rect(wx + ww / 2 - 2, wy, 4, wh), inks);
      P.fill(rect(wx, wy + wh / 2 - 2, ww, 4), inks);
    }
  }
  // attic window
  const lit2 = hash(seed, 9) < lit * 0.6;
  P.fill(circle(x + w * 0.5, ground - h - roof * 0.45, roof * 0.16), lit2 ? [1, 0.5, 0] : [0, 0.6, 0.6]);
}

export function tree(P, x, ground, h, seed, inks = [0, 0.85, 1]) {
  P.fill(rect(x - h * 0.03, ground - h * 0.45, h * 0.06, h * 0.45), inks);
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash(seed, i);
    P.fill(circle(x + Math.cos(a) * h * 0.18, ground - h * 0.62 + Math.sin(a) * h * 0.15, h * (0.22 + hash(seed, i, 2) * 0.08)), inks);
  }
  P.fill(circle(x, ground - h * 0.7, h * 0.26), inks);
}

export function pole(P, x, ground, h, inks = K.ink) {
  P.fill(rect(x - 9, ground - h, 18, h), inks);
  P.fill(rect(x - 70, ground - h + 40, 140, 12), inks);
  P.fill(rect(x - 50, ground - h + 80, 100, 10), inks);
  for (const dx of [-60, -30, 30, 60]) P.fill(rect(x + dx - 4, ground - h + 28, 8, 14), inks);
}

export function streetlight(P, x, ground, h, on, t) {
  const lx = x + 60, ly = ground - h + 26;
  if (on > 0) {
    P.save();
    P.translate(lx, ground);
    P.scale(1, 0.18);
    P.glow(0, 0, 300, [0, 0.8 * on, 0.9 * on], 'knock', 0.35);
    P.glow(0, 0, 220, [0.55 * on, 0.05, 0], 'lighter', 0.3);
    P.restore();
    P.glow(lx, ly, 150, [0, 0.8 * on, 0.95 * on], 'knock', 0.25);
    P.glow(lx, ly, 80, [0.7 * on, 0.05, 0], 'lighter', 0.2);
  }
  P.fill(rect(x - 7, ground - h, 14, h), K.ink);
  P.fill(poly([[x, ground - h], [x + 60, ground - h - 10], [x + 80, ground - h + 10], [x + 70, ground - h + 22], [x + 50, ground - h + 22]]), K.ink);
  P.fill(ellipse(lx, ly, 16, 7), on > 0 ? [1, 0.1, 0] : [0.3, 0.3, 0.4]);
}

// one strand of bulbs. level 0..1 brightness, pulse adds per-bulb pops
export function stringLights(P, x0, y0, x1, y1, sag, n, level, { t = 0, seed = 0, pop = null, wireInks = K.ink, size = 1, glow = 1 } = {}) {
  P.stroke(wire(x0, y0, x1, y1, sag), wireInks, 3 * size);
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const [x, y] = sagPoint(x0, y0, x1, y1, sag, u);
    const flick = pop ? pop(i) : 0;
    const L = clamp(level * (0.82 + 0.18 * Math.sin(t * 2.3 + i * 1.7 + seed)) + flick);
    const by = y + 14 * size;
    if (L > 0.02 && glow > 0) {
      const R = 80 * size * (0.6 + L * 0.5) * glow;
      P.glow(x, by, R, [0, 0.75 * L, 0.95 * L], 'knock', 0.3);
      P.glow(x, by, R * 0.55, [0.7 * L, 0.08 * L, 0], 'lighter', 0.2);
    }
    P.fill(rect(x - 4 * size, y, 8 * size, 9 * size), wireInks);
    P.fill(ellipse(x, by + 4 * size, 9 * size, 12 * size), L > 0.05 ? [lerp(0.35, 1, L), lerp(0.2, 0.05, L), 0] : [0.2, 0.3, 0.55]);
  }
}

// wooden fence covered in wheat-pasted flyers
export function fence(P, x0, x1, top, ground, seed = 1, { t = 0 } = {}) {
  P.fill(rect(x0, top, x1 - x0, ground - top), [0.35, 0.55, 0.55]);
  for (let x = x0; x < x1; x += 46) {
    P.fill(rect(x, top - 10 - (hash(seed, x) * 14), 3, ground - top + 10), [0.4, 0.8, 0.9]);
    P.fill(poly([[x + 4, top], [x + 23, top - 16 - hash(seed, x, 2) * 8], [x + 42, top], [x + 42, top + 4], [x + 4, top + 4]]), [0.35, 0.55, 0.55]);
  }
  const r = rng(seed * 77 + 5);
  const flyers = [];
  for (let i = 0; i < 26; i++) {
    const w = 110 + r() * 110, h = w * (1.2 + r() * 0.35);
    flyers.push([x0 + r() * (x1 - x0 - w), top + 20 + r() * (ground - top - h - 30), w, h, (r() - 0.5) * 0.22, i + seed * 100]);
  }
  for (const [x, y, w, h, rot, s] of flyers) flyer(P, x, y, w, h, rot, s);
}

const BANDS = ['THE BED HEADS', 'ALL AGES', 'TONIGHT', 'NO BIG DEAL', 'MOTH CLUB', 'DOORS 7PM', 'SOCK HOP', 'LOUD!', 'SALT CITY', 'PARKING LOT', 'VAN TOUR', 'FREE SHOW'];

export function flyer(P, x, y, w, h, rot, seed, { font = 'Anton' } = {}) {
  P.save();
  P.translate(x + w / 2, y + h / 2);
  P.rotate(rot);
  const r = rng(seed * 31 + 7);
  const style = Math.floor(r() * 5);
  const bg = [[0.95, 0, 0], [0, 0.9, 0], [0, 0, 0.8], [0, 0, 0], [0.9, 0.9, 0]][Math.floor(r() * 5)];
  P.fill(rect(-w / 2, -h / 2, w, h), bg);
  const fg = bg[2] > 0.5 ? [0, 0, 0] : bg[1] > 0.5 && bg[0] < 0.5 ? K.navy : bg[0] > 0.5 && bg[1] > 0.5 ? [0, 0, 0] : [0, 1, 0.9];
  if (style === 0) {
    for (let i = 0; i < 4; i++) P.fill(circle(0, -h * 0.08, w * (0.42 - i * 0.1)), i % 2 ? bg : fg);
  } else if (style === 1) {
    for (let i = 0; i < 6; i++) P.fill(rect(-w / 2, -h / 2 + i * h / 10, w, h / 22), fg);
  } else if (style === 2) {
    P.fill(star(0, -h * 0.1, w * 0.36, w * 0.15, 5 + Math.floor(r() * 4)), fg);
  } else if (style === 3) {
    P.fill(poly([[-w / 2, h * 0.1], [0, -h / 2], [w / 2, h * 0.1]]), fg);
    P.fill(circle(0, -h * 0.1, w * 0.12), bg);
  } else {
    P.fill(ellipse(0, -h * 0.12, w * 0.3, h * 0.26), fg);
    P.fill(ellipse(-w * 0.1, -h * 0.16, w * 0.05, h * 0.05), bg);
    P.fill(ellipse(w * 0.1, -h * 0.16, w * 0.05, h * 0.05), bg);
  }
  const txt = BANDS[Math.floor(r() * BANDS.length)];
  const fs = Math.min(w / (txt.length * 0.42), h * 0.16);
  P.text(txt, 0, h * 0.36, `${fs}px ${font}`, fg);
  P.fill(rect(-w * 0.35, h * 0.4, w * 0.7, 3), fg);
  P.restore();
}

export function sandwichBoard(P, x, ground, s, lines) {
  P.save();
  P.translate(x, ground);
  P.scale(s);
  P.fill(poly([[-170, 0], [-130, -380], [130, -380], [170, 0], [150, 0], [116, -362], [-116, -362], [-150, 0]]), K.ink);
  P.fill(poly([[-146, -10], [-114, -360], [114, -360], [146, -10]]), [0, 0.7, 0.85]);
  lines.forEach(([txt, size, inks], i) => P.text(txt, 0, -280 + i * 92, `${size * 0.72}px "Permanent Marker"`, inks));
  P.restore();
}

// generic "light pops": returns per-bulb extra brightness from a pulse
export const chase = (pulse, n, offset = 0) => (i) => (Math.round(offset) % n === i % n ? pulse : pulse * 0.35);

export { circle, curve, ellipse, line, poly, rect, roundRect, star };
