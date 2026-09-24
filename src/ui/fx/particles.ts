/**
 * Cut-paper stop-motion, drawn on a canvas laid over the SVG map.
 *
 * Every effect is a paper cut-out: an irregular polygon with a drop shadow, a
 * little grain and a pale cut edge. Time is quantised to 12 frames a second
 * ("on twos"), and each frame the cut-outs are re-cut slightly so their edges
 * boil, the way hand-animated paper does under a rostrum camera.
 *
 * Positions live in map (SVG) coordinates; sizes are in screen pixels so effects
 * read the same at every zoom level.
 */

export interface View {
  x: number;
  y: number;
  /** Map units per screen pixel. */
  k: number;
}

type Pt = [number, number];
type ToScreen = (x: number, y: number) => Pt;
/** `t` is time since start, quantised to whole frames; `f` is the global frame number (for boil). */
type Draw = (ctx: CanvasRenderingContext2D, t: number, P: ToScreen, f: number) => boolean;

interface Item {
  start: number;
  draw: Draw;
}

/** Screen size of one cut-out unit: bigger on desktops, where the whole world is on screen. */
let U = 1.5;

/** One stop-motion frame, in ms. */
export const FRAME = 1000 / 12;

const PAPER = {
  ink: '#2a2723',
  cream: '#f7f1e1',
  yellow: '#f6cf4f',
  orange: '#ec8a2f',
  smoke: '#b9b2a4',
  smokeDark: '#8f887b',
  wax: '#a8322a',
};

// ---------- deterministic randomness, so a frame's cut is stable while it is on screen ----------

function hash(a: number, b = 0, c = 0): number {
  const h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
let seedCounter = 1;
const newSeed = () => (seedCounter = (seedCounter * 9301 + 49297) % 233280) + 1;

/** An irregular closed shape: `n` points around a circle of radius r, each off by up to `irr`. */
function blob(n: number, r: number, irr: number, seed: number): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + (hash(seed, i, 1) - 0.5) * 0.35;
    const rr = r * (1 - irr / 2 + irr * hash(seed, i, 2));
    return [Math.cos(a) * rr, Math.sin(a) * rr];
  });
}

/** A cartoon explosion: alternating long and short spikes, none of them the same. */
function starburst(spikes: number, rOut: number, rIn: number, seed: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 + (hash(seed, i, 3) - 0.5) * 0.25;
    const r = i % 2 ? rIn * (0.85 + 0.3 * hash(seed, i, 4)) : rOut * (0.7 + 0.45 * hash(seed, i, 5));
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

/** A fat cut-paper arrow pointing along +x. */
function arrowShape(len: number, w: number): Pt[] {
  const head = w * 1.5;
  return [
    [-len / 2, -w / 2],
    [len / 2 - head, -w / 2 - 1],
    [len / 2 - head - 2, -w * 1.15],
    [len / 2, 0.5],
    [len / 2 - head + 1, w * 1.1],
    [len / 2 - head, w / 2],
    [-len / 2 + 1, w / 2 + 1],
    [-len / 2 + 5, 0],
  ];
}

/** Cloud of overlapping lobes, returned as separate blobs drawn as one cut-out. */
function cloud(r: number, seed: number): Pt[][] {
  const lobes = 5;
  return Array.from({ length: lobes }, (_, i) => {
    const a = (i / lobes) * Math.PI * 2 + hash(seed, i) * 0.6;
    const d = r * 0.55;
    const rr = r * (0.5 + 0.25 * hash(seed, i, 9));
    return blob(9, rr, 0.18, seed + i * 13).map(([x, y]) => [x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7] as Pt);
  });
}

function ellipsePts(rx: number, ry: number, n: number): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [Math.cos(a) * rx, Math.sin(a) * ry];
  });
}

// ---------- paper texture ----------

let grain: CanvasPattern | null = null;
function grainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (grain) return grain;
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d');
  if (!g) return null;
  const img = g.createImageData(96, 96);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + Math.random() * 135;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // A few fibres.
  g.strokeStyle = 'rgba(90,80,60,0.35)';
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * 96;
    const y = Math.random() * 96;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + 6, y + Math.random() * 6 - 3, x + 10 + Math.random() * 8, y + Math.random() * 6 - 3);
    g.stroke();
  }
  grain = ctx.createPattern(c, 'repeat');
  return grain;
}

interface CutOpts {
  x: number;
  y: number;
  rot?: number;
  scale?: number;
  sx?: number;
  sy?: number;
  alpha?: number;
  /** Boil amount in shape pixels. */
  boil?: number;
  seed: number;
  f: number;
  shadow?: number;
  edge?: boolean;
}

function tracePath(ctx: CanvasRenderingContext2D, pts: Pt[], seed: number, f: number, boil: number) {
  pts.forEach(([px, py], i) => {
    const jx = (hash(seed, i, f) - 0.5) * 2 * boil;
    const jy = (hash(seed + 7, i, f) - 0.5) * 2 * boil;
    if (i === 0) ctx.moveTo(px + jx, py + jy);
    else ctx.lineTo(px + jx, py + jy);
  });
  ctx.closePath();
}

/** Draw one or more polygons as a single piece of cut paper. */
function cut(ctx: CanvasRenderingContext2D, shapes: Pt[] | Pt[][], color: string, o: CutOpts) {
  const list = (Array.isArray(shapes[0][0]) ? shapes : [shapes]) as Pt[][];
  const boil = o.boil ?? 0.9;
  // Hand-placed: every frame the piece sits a hair differently.
  const wob = (hash(o.seed, o.f, 11) - 0.5) * 0.05;
  const dx = (hash(o.seed, o.f, 12) - 0.5) * 1.2;
  const dy = (hash(o.seed, o.f, 13) - 0.5) * 1.2;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(o.x + dx, o.y + dy);
  ctx.rotate((o.rot ?? 0) + wob);
  const s = (o.scale ?? 1) * U;
  ctx.scale(s * (o.sx ?? 1), s * (o.sy ?? 1));
  ctx.beginPath();
  list.forEach((pts, i) => tracePath(ctx, pts, o.seed + i * 31, o.f, boil));
  const sh = o.shadow ?? 1;
  ctx.shadowColor = `rgba(55,40,20,${0.34 * sh})`;
  ctx.shadowBlur = 3 * sh;
  ctx.shadowOffsetX = 1.5 * sh;
  ctx.shadowOffsetY = 2.5 * sh;
  ctx.fillStyle = color;
  ctx.fill('nonzero');
  ctx.shadowColor = 'transparent';
  const pat = grainPattern(ctx);
  if (pat) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = (o.alpha ?? 1) * 0.22;
    ctx.fillStyle = pat;
    ctx.fill('nonzero');
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = o.alpha ?? 1;
  }
  if (o.edge !== false) {
    // The pale edge where the scissors went through.
    ctx.strokeStyle = 'rgba(255,252,240,0.55)';
    ctx.lineWidth = 1.1 / s;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

/** A stepped keyframe lookup: holds each value for its frames, no in-betweens. */
function keys(t: number, frames: number[]): number {
  const i = Math.floor(t / FRAME);
  return frames[Math.min(i, frames.length - 1)];
}

const quad = (a: Pt, m: Pt, b: Pt, q: number): Pt => [
  (1 - q) * (1 - q) * a[0] + 2 * (1 - q) * q * m[0] + q * q * b[0],
  (1 - q) * (1 - q) * a[1] + 2 * (1 - q) * q * m[1] + q * q * b[1],
];

export class FxEngine {
  private items: Item[] = [];
  private canvas: HTMLCanvasElement | null = null;
  private raf = 0;
  private lastFrame = -1;
  private lastView = '';
  private view: () => View = () => ({ x: 0, y: 0, k: 1 });
  reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  attach(canvas: HTMLCanvasElement | null, view: () => View) {
    this.canvas = canvas;
    this.view = view;
    if (canvas) this.kick();
  }

  clear() {
    this.items = [];
  }

  private add(delayMs: number, draw: Draw) {
    this.items.push({ start: performance.now() + delayMs, draw });
    this.kick();
  }

  private kick() {
    if (!this.raf && this.canvas) this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    this.raf = 0;
    const c = this.canvas;
    if (!c) return;
    const v = this.view();
    const f = Math.floor(now / FRAME);
    const viewSig = `${v.x.toFixed(1)},${v.y.toFixed(1)},${v.k.toFixed(4)},${c.clientWidth},${c.clientHeight}`;
    // Stop-motion: only a new frame (or a pan of the map) redraws.
    if (f === this.lastFrame && viewSig === this.lastView) {
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    this.lastFrame = f;
    this.lastView = viewSig;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    U = w < 760 ? 1.15 : 1.5;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const toScreen: ToScreen = (x, y) => [(x - v.x) / v.k, (y - v.y) / v.k];
    this.items = this.items.filter((it) => {
      if (now < it.start) return true;
      const t = Math.floor((now - it.start) / FRAME) * FRAME;
      return it.draw(ctx, t, toScreen, f);
    });
    if (this.items.length) this.raf = requestAnimationFrame(this.frame);
    else {
      ctx.clearRect(0, 0, w, h);
      this.lastFrame = -1;
    }
  };

  // ---------- building blocks ----------

  /** Paper scraps flung out from a point, tumbling under gravity. */
  scraps(x: number, y: number, colors: string[], n: number, power = 1, delay = 0) {
    if (this.reduced) return;
    for (let i = 0; i < n; i++) {
      const seed = newSeed();
      const a = hash(seed, 1) * Math.PI * 2;
      const v = (50 + hash(seed, 2) * 80) * power * U;
      const life = 420 + hash(seed, 3) * 300;
      const shape = blob(4 + Math.floor(hash(seed, 4) * 3), 3 + hash(seed, 5) * 3.5, 0.6, seed);
      const color = colors[i % colors.length];
      const spin = (hash(seed, 6) - 0.5) * 14;
      this.add(delay, (ctx, t, P, f) => {
        if (t > life) return false;
        const s = t / 1000;
        const [sx, sy] = P(x, y);
        cut(ctx, shape, color, {
          x: sx + Math.cos(a) * v * s,
          y: sy + Math.sin(a) * v * s - 70 * power * U * s + 200 * U * s * s,
          rot: spin * s,
          sy: Math.cos(spin * s * 1.3) * 0.8 + 0.2,
          seed,
          f,
          shadow: 0.6,
          edge: false,
          boil: 0.4,
        });
        return true;
      });
    }
  }

  /** A grey paper cloud that bobs upward and shrinks away in steps. */
  puff(x: number, y: number, size = 1, delay = 0, dark = false) {
    const seed = newSeed();
    const shapes = cloud(12 * size, seed);
    const life = 1000 + hash(seed) * 500;
    const drift = (hash(seed, 2) - 0.5) * 18;
    this.add(delay, (ctx, t, P, f) => {
      if (t > life) return false;
      const p = t / life;
      const [sx, sy] = P(x, y);
      cut(ctx, shapes, dark ? PAPER.smokeDark : PAPER.smoke, {
        x: sx + drift * p,
        y: sy - 34 * size * U * p,
        scale: keys(t, [0.4, 0.8, 1, 1.05]) * (1 - p * 0.55),
        seed,
        f,
        shadow: 0.7,
      });
      return true;
    });
  }

  // ---------- effects (the director's vocabulary) ----------

  /** A cut-paper cartoon burst that pops in, holds, and tears away into scraps. */
  explosion(x: number, y: number, size = 1, color = PAPER.orange, delay = 0) {
    const s = this.reduced ? 0.6 : size;
    const seed = newSeed();
    const outer = starburst(9 + Math.floor(hash(seed) * 4), 26 * s, 13 * s, seed);
    const mid = starburst(8, 17 * s, 9 * s, seed + 3);
    const core = blob(8, 7 * s, 0.4, seed + 5);
    const tilt = hash(seed, 9) * Math.PI;
    const scales = [0.35, 1.18, 0.94, 1.04, 1, 1, 0.9, 0.7, 0.4];
    const life = scales.length * FRAME;
    this.add(delay, (ctx, t, P, f) => {
      if (t >= life) return false;
      const [sx, sy] = P(x, y);
      const k = keys(t, scales);
      const o = { x: sx, y: sy, rot: tilt, scale: k, seed, f };
      cut(ctx, outer, color, o);
      cut(ctx, mid, PAPER.yellow, { ...o, rot: tilt + 0.3, seed: seed + 1, shadow: 0.6 });
      cut(ctx, core, PAPER.cream, { ...o, seed: seed + 2, shadow: 0.4 });
      return true;
    });
    this.scraps(x, y, [color, PAPER.yellow, PAPER.ink], Math.round(7 * s), s, delay + FRAME * 5);
    this.puff(x + 6 * s, y - 4, 0.8 * s, delay + FRAME * 5);
    if (s > 1.2) this.puff(x - 10 * s, y + 2, s, delay + FRAME * 6, true);
  }

  /** A pencil circle drawn around a point, growing a step at a time. */
  ring(x: number, y: number, r0: number, r1: number, color: string, dur = 600, width = 2, delay = 0) {
    const seed = newSeed();
    this.add(delay, (ctx, t, P, f) => {
      if (t > dur) return false;
      const p = t / dur;
      const [sx, sy] = P(x, y);
      const r = (r0 + (r1 - r0) * Math.sqrt(p)) * U;
      ctx.save();
      ctx.globalAlpha = 1 - p * p;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const n = Math.max(16, Math.min(64, Math.round(r / 5)));
      // A loop that overshoots its start, as a hand would; smoothed through midpoints.
      const pts: Pt[] = [];
      for (let i = 0; i <= n + 3; i++) {
        const a = (i / n) * Math.PI * 2 + hash(seed) * 6;
        const rr = r * (1 + (hash(seed, i % n, f) - 0.5) * 0.07 + i * 0.003);
        pts.push([sx + Math.cos(a) * rr, sy + Math.sin(a) * rr * 0.92]);
      }
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2;
        const my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      ctx.stroke();
      ctx.restore();
      return true;
    });
  }

  /** A paper arrow that hops from one territory to another. Calls onHit on arrival. */
  projectile(x1: number, y1: number, x2: number, y2: number, color: string, delay = 0, dur = 380, onHit?: () => void) {
    const seed = newSeed();
    const bend = (0.25 + hash(seed) * 0.3) * (hash(seed, 1) < 0.5 ? -1 : 1);
    const hops = Math.max(4, Math.round(dur / FRAME));
    const shape = arrowShape(30, 9);
    let hit = false;
    this.add(delay, (ctx, t, P, f) => {
      const p = Math.min(1, t / (hops * FRAME));
      const a = P(x1, y1);
      const b = P(x2, y2);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const m: Pt = [(a[0] + b[0]) / 2 - (b[1] - a[1]) * bend, (a[1] + b[1]) / 2 + (b[0] - a[0]) * bend - len * 0.2];
      // Slow out of the gate, fast into the target.
      const q = p * p * 0.6 + p * 0.4;
      const [hx, hy] = quad(a, m, b, q);
      const [nx, ny] = quad(a, m, b, Math.min(1, q + 0.05));
      const rot = Math.atan2(ny - hy, nx - hx);
      cut(ctx, shape, color, { x: hx, y: hy, rot, scale: 0.8 + 0.3 * Math.sin(p * Math.PI), seed, f, shadow: 1.4 });
      if (p >= 1 && !hit) {
        hit = true;
        onHit?.();
      }
      return p < 1;
    });
  }

  /** A little paper star where an attack sets out. */
  muzzle(x: number, y: number, color: string, delay = 0) {
    const seed = newSeed();
    const shape = starburst(6, 11, 5, seed);
    this.add(delay, (ctx, t, P, f) => {
      if (t >= FRAME * 3) return false;
      const [sx, sy] = P(x, y);
      cut(ctx, shape, t < FRAME ? PAPER.yellow : color, { x: sx, y: sy, scale: keys(t, [0.7, 1.1, 0.6]), seed, f, shadow: 0.6 });
      return true;
    });
  }

  /** Paper chits hopping along a route, for troop movements. */
  stream(x1: number, y1: number, x2: number, y2: number, color: string, count = 6, delay = 0) {
    const hops = 7;
    for (let i = 0; i < Math.min(count, 6); i++) {
      const seed = newSeed();
      const shape = blob(6, 5, 0.35, seed);
      this.add(delay + i * FRAME * 1.5, (ctx, t, P, f) => {
        const step = Math.floor(t / FRAME);
        if (step > hops) return false;
        const a = P(x1, y1);
        const b = P(x2, y2);
        const q = step / hops;
        const hop = step % 2 ? 6 * U : 0;
        cut(ctx, shape, color, { x: a[0] + (b[0] - a[0]) * q, y: a[1] + (b[1] - a[1]) * q - hop, rot: step * 0.4, seed, f, shadow: 0.8 + hop / 8 });
        return true;
      });
    }
  }

  /** A strip of paper with a handwritten label, popped onto the board. */
  text(x: number, y: number, text: string, color: string, delay = 0, big = false) {
    const seed = newSeed();
    const dur = 1300;
    const fontSize = big ? 21 : 19;
    const rise = big ? 40 : 26;
    this.add(delay, (ctx, t, P, f) => {
      if (t > dur) return false;
      const [sx, sy] = P(x, y);
      ctx.save();
      ctx.font = `700 ${fontSize}px Caveat, "Segoe Print", cursive`;
      const w = ctx.measureText(text).width + 18;
      const h = fontSize + 8;
      const lift = keys(t, [0, 10, 14, 16, 17, 18]);
      const scale = keys(t, [0.6, 1.12, 1]);
      const y0 = sy - (rise + lift) * U;
      const strip: Pt[] = [
        [-w / 2, -h / 2 + 1],
        [-w / 4, -h / 2 - 1],
        [w / 4, -h / 2 + 1],
        [w / 2, -h / 2 - 1],
        [w / 2 - 2, 0],
        [w / 2 + 1, h / 2],
        [0, h / 2 + 1],
        [-w / 2 + 1, h / 2 - 1],
        [-w / 2 - 1, 0],
      ];
      const fade = t > dur - FRAME * 3 ? keys(t - (dur - FRAME * 3), [0.7, 0.4, 0.15]) : 1;
      const rot = (hash(seed) - 0.5) * 0.12;
      cut(ctx, strip, PAPER.cream, { x: sx, y: y0, rot, scale, seed, f, alpha: fade, boil: 0.5 });
      ctx.translate(sx, y0);
      ctx.rotate(rot);
      ctx.scale(scale * U, scale * U);
      ctx.globalAlpha = fade;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 1);
      ctx.restore();
      return true;
    });
  }

  /** Territory changes hands: a paper flag is planted, with confetti in the new colour. */
  capture(x: number, y: number, color: string, delay = 0) {
    const seed = newSeed();
    const pennant: Pt[] = [
      [0, -30],
      [20, -25],
      [15, -21],
      [22, -16],
      [0, -14],
    ];
    const pole: Pt[] = [
      [-1.5, -32],
      [1.5, -32],
      [1.8, 2],
      [-1.8, 2],
    ];
    const heights = [0.2, 1.25, 0.9, 1.06, 1];
    const life = FRAME * 16;
    this.add(delay, (ctx, t, P, f) => {
      if (t > life) return false;
      const [sx, sy] = P(x, y);
      const out = t > life - FRAME * 3;
      const sy2 = out ? keys(t - (life - FRAME * 3), [0.8, 0.5, 0.2]) : keys(t, heights);
      const base = { x: sx + 10 * U, y: sy - 2 * U, sx: 1, sy: sy2, seed, f };
      cut(ctx, pole, PAPER.ink, { ...base, shadow: 0.8, edge: false });
      // The pennant flaps: alternate frames swap its fold.
      const flap = f % 2 ? pennant : pennant.map(([px, py], i) => [px * (i === 1 || i === 3 ? 0.9 : 1), py + (i === 2 ? 2 : 0)] as Pt);
      cut(ctx, flap, color, { ...base, seed: seed + 1 });
      return true;
    });
    this.scraps(x, y, [color, color, PAPER.cream], 10, 1.1, delay + FRAME);
    this.ring(x, y, 10, 34, PAPER.ink, 520, 1.6, delay);
  }

  /** Reinforcements: paper chits fall onto the territory and land with a bounce. */
  drop(x: number, y: number, color: string, n: number) {
    const chits = Math.min(6, Math.max(1, Math.ceil(n / 2)));
    for (let i = 0; i < chits; i++) {
      const seed = newSeed();
      const shape = blob(7, 5.5, 0.3, seed);
      const ox = (hash(seed) - 0.5) * 22;
      const oy = (hash(seed, 1) - 0.5) * 12;
      const fall = [-60, -34, -12, 0, 2, 0, 0, 0];
      const squash = [1, 1, 1, 0.6, 1.15, 1, 1, 0.5];
      this.add(i * FRAME, (ctx, t, P, f) => {
        if (t >= fall.length * FRAME) return false;
        const [sx, sy] = P(x, y);
        cut(ctx, shape, color, { x: sx + ox * U, y: sy + oy * U + keys(t, fall) * U, sy: keys(t, squash), rot: hash(seed, 2) * 3, seed, f, shadow: 1.2 });
        return true;
      });
    }
    this.text(x, y, `+${n}`, color, FRAME * 3);
  }

  /** Two powers sign: a wax seal is stamped down between their capitals. */
  seal(x: number, y: number, label: string, color = PAPER.wax, delay = 0) {
    const seed = newSeed();
    const scallop: Pt[] = Array.from({ length: 28 }, (_, i) => {
      const a = (i / 28) * Math.PI * 2;
      const r = i % 2 ? 17 : 19.5;
      return [Math.cos(a) * r, Math.sin(a) * r];
    });
    const inner = ellipsePts(12, 12, 18);
    const scales = [1.9, 1.5, 0.86, 1.08, 1];
    const life = FRAME * 20;
    this.add(delay, (ctx, t, P, f) => {
      if (t > life) return false;
      const [sx, sy] = P(x, y);
      const out = t > life - FRAME * 3;
      const k = keys(t, scales);
      const alpha = out ? keys(t - (life - FRAME * 3), [0.75, 0.45, 0.15]) : t < FRAME ? 0.6 : 1;
      const o = { x: sx, y: sy, scale: k, rot: -0.15, seed, f, alpha, shadow: k > 1.2 ? 2.2 : 1 };
      cut(ctx, scallop, color, o);
      cut(ctx, inner, 'rgba(0,0,0,0.12)', { ...o, seed: seed + 1, shadow: 0, edge: false });
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-0.15);
      ctx.scale(k * U, k * U);
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = '#f4dcc8';
      ctx.font = '800 9px Archivo, "Arial Narrow", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 0.5);
      ctx.restore();
      return true;
    });
    this.scraps(x, y, [color, PAPER.cream], 5, 0.7, delay + FRAME * 2);
  }

  /** The end of the world, in cut paper: a mushroom cloud built up a layer at a time. */
  nuke(x: number, y: number) {
    const seed = newSeed();
    const stem: Pt[] = [
      [-9, 0],
      [-7, -30],
      [-11, -58],
      [11, -58],
      [7, -30],
      [9, 0],
    ];
    const cap = cloud(34, seed);
    const capHot = cloud(22, seed + 50);
    const base = blob(14, 36, 0.25, seed + 9);
    const dur = 3400;
    this.add(0, (ctx, t, P, f) => {
      if (t > dur) return false;
      const [sx, sy] = P(x, y);
      const grow = keys(t, [0.2, 0.35, 0.5, 0.62, 0.74, 0.84, 0.92, 1]);
      const fade = t > dur - FRAME * 6 ? 1 - (t - (dur - FRAME * 6)) / (FRAME * 6) : 1;
      cut(ctx, base, PAPER.smoke, { x: sx, y: sy, sy: 0.35, scale: 0.6 + grow, seed, f, alpha: fade });
      cut(ctx, stem, PAPER.smokeDark, { x: sx, y: sy, scale: 0.4 + grow * 1.4, seed: seed + 1, f, alpha: fade });
      const capY = sy - 58 * (0.4 + grow * 1.4) * U;
      cut(ctx, cap, PAPER.smoke, { x: sx, y: capY, scale: 0.5 + grow * 1.2, seed: seed + 2, f, alpha: fade });
      cut(ctx, capHot, t < 1400 ? PAPER.orange : PAPER.smokeDark, { x: sx, y: capY + 4, scale: 0.5 + grow, seed: seed + 3, f, alpha: fade, shadow: 0.5 });
      return true;
    });
    for (let i = 0; i < 3; i++) this.ring(x, y, 20, 420, PAPER.ink, 1700, 3, i * FRAME * 4);
    this.scraps(x, y, [PAPER.orange, PAPER.smoke, PAPER.yellow, PAPER.ink], 26, 2.4, FRAME * 2);
  }
}
