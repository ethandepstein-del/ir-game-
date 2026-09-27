// Risograph compositor.
//
// Scenes draw continuous-tone *ink density* (0..1, stored in the red channel) onto three
// canvases, one per ink drum: yellow, fluorescent pink and blue. `composite` then prints each
// density map through a rotated halftone screen fixed to the paper, roughens it with a static
// ink texture and multiplies the inks onto the paper.
//
// How much of the halftone shows is the *screen amount* (0 = flat tint, 1 = full dots). It is
// set per ink by the look, per region by the tone of the art (smooth ramps and glows get dots,
// flat fields print as tints with a faint screen), and per draw call by `P.screen(k)`.
// The v3 look (hard dots everywhere) is kept as `new Press(W, H, scale, { look: 'v3' })`.

import { createCanvas, GlobalFonts, Path2D } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import { hash, rng } from './util.mjs';

export { Path2D };

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
for (const [file, fam] of [
  ['Anton-Regular.ttf', 'Anton'],
  ['RubikMonoOne-Regular.ttf', 'Rubik Mono One'],
  ['PermanentMarker-Regular.ttf', 'Permanent Marker'],
  ['CaveatBrush-Regular.ttf', 'Caveat Brush'],
  ['SpecialElite-Regular.ttf', 'Special Elite'],
]) GlobalFonts.registerFromPath(here('../fonts/' + file), fam);

// v3 screens (angle/cell per ink); the newer looks set their own in LOOKS
export const INKS = [
  { name: 'yellow', rgb: [255, 232, 0], angle: 0, cell: 6.5, seed: 11 },
  { name: 'pink', rgb: [255, 72, 176], angle: 75, cell: 6.5, seed: 23 },
  { name: 'blue', rgb: [0, 120, 191], angle: 15, cell: 6.5, seed: 37 },
];
export const PAPER = [246, 239, 224];

// Print looks. Units are 1080p pixels; `amount` is the per-ink dot strength [yellow, pink, blue].
//   cell/angles  screen ruling and angles        edge   dot-edge hardness (v3 was 6)
//   rough        dot-shape irregularity          solid  density that prints fully solid
//   auto         find smooth tone (ramps, glows) and give it full dots
//   flat         screen amount on flat fields (and everywhere when auto is off)
//   text         default screen amount for P.text (null: same as any other draw)
//   blotch/grain/pin  ink texture: slow mottling, fine grain, pinholes
export const LOOKS = {
  v3: { legacy: true },
  // A: same screen everywhere, but finer and softer, yellow nearly invisible, de-moired angles
  fine: { cell: 5, angles: [15, 75, 45], edge: 2.6, rough: 0.05, amount: [0.45, 0.9, 1], solid: 0.86, auto: false, flat: 1, light: 0, text: null, blotch: 0.07, grain: 0.03, pin: 0.18 },
  // B: v3-sized dots blended half-way with the flat tint, so they read as texture, not holes
  blend: { cell: 6, angles: [15, 75, 45], edge: 3.2, rough: 0.06, amount: [0.5, 0.9, 1], solid: 0.86, auto: false, flat: 0.5, light: 0, text: null, blotch: 0.07, grain: 0.035, pin: 0.18 },
  // C: dots only where the art has tone (gradients, glows); flat fields print as grainy tints
  tonal: { cell: 5.5, angles: [15, 75, 45], edge: 3, rough: 0.05, amount: [0.55, 0.95, 1], solid: 0.86, auto: true, slope: [0.15, 0.7], flat: 0.12, light: 0, text: null, blotch: 0.08, grain: 0.05, pin: 0.2 },
  // D: tonal, with a visible screen kept on mid-tint fields, light tints (skin) and text clean
  studio: { cell: 5.5, angles: [15, 75, 45], edge: 3, rough: 0.05, amount: [0.5, 0.9, 1], solid: 0.86, auto: true, slope: [0.15, 0.7], flat: 0.38, light: 1.2, text: 0.08, blotch: 0.08, grain: 0.045, pin: 0.2 },
};
export const DEFAULT_LOOK = 'studio';

const gray = (d) => {
  const v = Math.round(Math.max(0, Math.min(1, d)) * 255);
  return `rgb(${v},${v},${v})`;
};
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export class Painter {
  // default screen amount for text when no P.screen() is in effect (set by the Press's look)
  static textScreen = null;

  constructor(W, H) {
    this.W = W; this.H = H;
    this.canvases = INKS.map(() => createCanvas(W, H));
    this.ctx = this.canvases.map((c) => c.getContext('2d'));
    this.reg = [[0, 0], [0, 0], [0, 0]];
    // screen-amount mask: R = explicit amount (premultiplied by G), G = coverage of explicit draws
    this.maskCanvas = createCanvas(W, H);
    this.mctx = this.maskCanvas.getContext('2d');
    this.maskOn = false; // any explicit screen() draw this frame?
    this._maskDirty = false;
    this._scr = null;
    this._scrStack = [];
  }

  // start a frame: wipe densities and set the per-ink registration offsets
  begin(reg = [[0, 0], [0, 0], [0, 0]]) {
    this.reg = reg;
    this.ctx.forEach((c, i) => {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#000';
      c.fillRect(0, 0, this.W, this.H);
      c.setTransform(1, 0, 0, 1, reg[i][0], reg[i][1]);
      c.lineCap = 'round';
      c.lineJoin = 'round';
    });
    const m = this.mctx;
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.globalAlpha = 1;
    m.globalCompositeOperation = 'source-over';
    if (this._maskDirty) { m.fillStyle = '#000'; m.fillRect(0, 0, this.W, this.H); }
    m.lineCap = 'round';
    m.lineJoin = 'round';
    this.maskOn = false;
    this._maskDirty = false;
    this._scr = null;
    this._scrStack = [];
  }

  each(fn) { this.ctx.forEach(fn); return this; }
  _all(fn) { this.ctx.forEach(fn); fn(this.mctx, 3); return this; }
  save() { this._scrStack.push(this._scr); return this._all((c) => c.save()); }
  restore() { if (this._scrStack.length) this._scr = this._scrStack.pop(); return this._all((c) => c.restore()); }
  translate(x, y) { return this._all((c) => c.translate(x, y)); }
  rotate(a) { return this._all((c) => c.rotate(a)); }
  scale(x, y = x) { return this._all((c) => c.scale(x, y)); }
  alpha(a) { return this._all((c) => { c.globalAlpha = a; }); }
  clip(path) { return this._all((c) => c.clip(path)); }

  // screen amount for the following draws: 0 = flat tint, 1 = full halftone, null = automatic
  // (the look decides from the art's tone). Saved and restored with save()/restore().
  screen(k = null) { this._scr = k == null ? null : clamp01(+k); return this; }

  // paint this draw's footprint into the screen mask. Explicit draws record their amount; automatic
  // opaque draws reset what they cover back to automatic (so they are not dotted/clean by accident).
  _mask(k, op, draw) {
    if (k == null) { if (!this.maskOn || (op && op !== 'source-over')) return; }
    else this.maskOn = true;
    const m = this.mctx;
    this._maskDirty = true;
    m.globalCompositeOperation = 'source-over';
    m.fillStyle = m.strokeStyle = k == null ? '#000' : `rgb(${Math.round(k * 255)},255,0)`;
    draw(m);
  }

  // inks: [yellow, pink, blue] densities; null leaves that drum untouched
  fill(path, inks, op = 'source-over') {
    this.ctx.forEach((c, i) => {
      const d = inks[i];
      if (d == null) return;
      c.globalCompositeOperation = op;
      c.fillStyle = gray(d);
      c.fill(path);
      c.globalCompositeOperation = 'source-over';
    });
    if (inks.some((d) => d != null)) this._mask(this._scr, op, (m) => m.fill(path));
    return this;
  }

  stroke(path, inks, width, op = 'source-over') {
    this.ctx.forEach((c, i) => {
      const d = inks[i];
      if (d == null) return;
      c.globalCompositeOperation = op;
      c.strokeStyle = gray(d);
      c.lineWidth = width;
      c.stroke(path);
      c.globalCompositeOperation = 'source-over';
    });
    if (inks.some((d) => d != null)) this._mask(this._scr, op, (m) => { m.lineWidth = width; m.stroke(path); });
    return this;
  }

  // linear density ramp: stops = [[offset, [y, p, b]], ...]
  linear(path, x0, y0, x1, y1, stops) {
    this.ctx.forEach((c, i) => {
      if (stops.every(([, v]) => v[i] == null)) return;
      const g = c.createLinearGradient(x0, y0, x1, y1);
      for (const [o, v] of stops) g.addColorStop(o, gray(v[i] ?? 0));
      c.fillStyle = g;
      c.fill(path);
    });
    this._mask(this._scr, 'source-over', (m) => m.fill(path));
    return this;
  }

  // soft radial glow. 'lighter' adds ink density; 'knock' (alias 'destination-out') lifts ink back
  // toward bare paper. The drums are opaque, so knocking out means painting "no ink" over the top.
  // plateau keeps the centre at full strength out to that fraction of the radius.
  glow(x, y, r, inks, op = 'lighter', plateau = 0) {
    const knock = op === 'knock' || op === 'destination-out';
    this.ctx.forEach((c, i) => {
      const d = inks[i];
      if (!d || r <= 0) return;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      if (knock) {
        g.addColorStop(0, `rgba(0,0,0,${d})`);
        if (plateau) g.addColorStop(plateau, `rgba(0,0,0,${d})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
      } else {
        g.addColorStop(0, gray(d));
        if (plateau) g.addColorStop(plateau, gray(d));
        g.addColorStop(plateau ? Math.min(0.95, plateau + 0.25) : 0.4, gray(d * 0.45));
        g.addColorStop(1, 'rgb(0,0,0)');
      }
      c.globalCompositeOperation = knock ? 'source-over' : op;
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
      c.globalCompositeOperation = 'source-over';
    });
    // glows are additive: only an explicit screen() marks them, fading with the glow
    const k = this._scr;
    if (k != null && r > 0 && inks.some((d) => d)) {
      this._mask(k, null, (m) => {
        const v = Math.round(k * 255), g = m.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${v},255,0,1)`);
        if (plateau) g.addColorStop(plateau, `rgba(${v},255,0,1)`);
        g.addColorStop(1, `rgba(${v},255,0,0)`);
        m.fillStyle = g;
        m.beginPath();
        m.arc(x, y, r, 0, Math.PI * 2);
        m.fill();
      });
    }
    return this;
  }

  text(str, x, y, font, inks, { align = 'center', baseline = 'alphabetic', spacing = 0, op } = {}) {
    const set = (c) => {
      c.font = font;
      c.textAlign = align;
      c.textBaseline = baseline;
      c.letterSpacing = `${spacing}px`;
    };
    this.ctx.forEach((c, i) => {
      const d = inks[i];
      if (d == null) return;
      set(c);
      c.globalCompositeOperation = op || 'source-over';
      c.fillStyle = gray(d);
      c.fillText(str, x, y);
      c.globalCompositeOperation = 'source-over';
      c.letterSpacing = '0px';
    });
    if (inks.some((d) => d != null)) {
      this._mask(this._scr ?? Painter.textScreen, op || 'source-over', (m) => {
        set(m);
        m.fillText(str, x, y);
        m.letterSpacing = '0px';
      });
    }
    return this;
  }

  measure(str, font, spacing = 0) {
    const c = this.ctx[0];
    c.font = font;
    c.letterSpacing = `${spacing}px`;
    const w = c.measureText(str).width;
    c.letterSpacing = '0px';
    return w;
  }

  // run arbitrary drawing on every drum with that drum's density ink (the screen mask is not touched)
  raw(fn) {
    this.ctx.forEach((c, i) => fn(c, i, gray));
    return this;
  }
}

// ---- screening & compositing ------------------------------------------------

function valueNoise(W, H, scale, seed) {
  const gw = Math.ceil(W / scale) + 2, gh = Math.ceil(H / scale) + 2;
  const r = rng(seed);
  const g = new Float32Array(gw * gh).map(() => r());
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const fy = y / scale, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < W; x++) {
      const fx = x / scale, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx);
      const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
      out[y * W + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
    }
  }
  return out;
}

// rotated cosine spot function, equalised so that threshold t covers ~t of the area
function makeScreen(W, H, angle, cell, rough, roughScale, seed) {
  const N = W * H;
  const s = new Float32Array(N);
  const a = (angle * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const rn = valueNoise(W, H, roughScale, seed);
  for (let y = 0, i = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i++) {
      const u = (x * ca + y * sa) / cell, v = (-x * sa + y * ca) / cell;
      s[i] = 0.5 - 0.25 * (Math.cos(2 * Math.PI * u) + Math.cos(2 * Math.PI * v)) + (rn[i] - 0.5) * rough;
    }
  }
  const hist = new Uint32Array(1024);
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < N; i++) { if (s[i] < mn) mn = s[i]; if (s[i] > mx) mx = s[i]; }
  for (let i = 0; i < N; i++) hist[Math.min(1023, Math.floor(((s[i] - mn) / (mx - mn)) * 1024))]++;
  const cdf = new Float32Array(1024);
  let acc = 0;
  for (let k = 0; k < 1024; k++) { acc += hist[k]; cdf[k] = acc / N; }
  const q = new Uint8Array(N);
  for (let i = 0; i < N; i++) q[i] = Math.round(cdf[Math.min(1023, Math.floor(((s[i] - mn) / (mx - mn)) * 1024))] * 255);
  return q;
}

// ink texture: blotchy coverage, fine grain and pinholes (a real riso's uneven drum)
function makeTexture(W, H, scale, seed, blotch, grain, pin) {
  const N = W * H;
  const b1 = valueNoise(W, H, 60 * scale, seed + 1), b2 = valueNoise(W, H, 3 * scale, seed + 2);
  const t = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    let v = 0.95 + (b1[i] - 0.5) * blotch + (b2[i] - 0.5) * grain;
    if (b2[i] > 0.975) v -= pin;
    t[i] = Math.max(0, Math.min(255, v * 255));
  }
  return t;
}

function makePaper(W, H, scale) {
  const N = W * H;
  const m1 = valueNoise(W, H, 90 * scale, 5), m2 = valueNoise(W, H, 7 * scale, 6), m3 = valueNoise(W, H, 2.2 * scale, 7);
  const paper = new Uint8Array(N * 3);
  for (let y = 0, i = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i++) {
      const vx = (x / W - 0.5) * 2, vy = (y / H - 0.5) * 2;
      const vig = 1 - 0.06 * Math.pow(vx * vx * 0.7 + vy * vy, 1.4);
      const k = vig * (1 + (m1[i] - 0.5) * 0.03 + (m2[i] - 0.5) * 0.01 + (m3[i] - 0.5) * 0.008);
      for (let ch = 0; ch < 3; ch++) paper[i * 3 + ch] = Math.max(0, Math.min(255, PAPER[ch] * k));
    }
  }
  return paper;
}

// density -> printed area: the v3 dot gain curve, rolling into a full solid at `solid`
function tone(d, solid) {
  let f = clamp01(d * 1.15 - 0.03);
  const s0 = solid - 0.08;
  if (solid < 1 && d > s0) { const u = clamp01((d - s0) / (solid - s0)); f += (1 - f) * u * u * (3 - 2 * u); }
  return f;
}

const NA = 16; // screen-amount levels in the coverage LUT

export class Press {
  // look: a name from LOOKS or an object of overrides on the default look
  // smooth: print each ink as a flat tint instead of a halftone screen (for heavily compressed copies)
  constructor(W, H, scale = 1, { smooth = false, look = process.env.INK_LOOK || DEFAULT_LOOK } = {}) {
    this.W = W; this.H = H; this.scale = scale; this.smooth = smooth;
    const L = typeof look === 'string'
      ? LOOKS[look] || (() => { throw new Error(`unknown look '${look}' (have ${Object.keys(LOOKS).join(', ')})`); })()
      : { ...LOOKS[DEFAULT_LOOK], ...look };
    this.look = L;
    this.lookName = typeof look === 'string' ? look : 'custom';
    Painter.textScreen = L.legacy ? null : L.text ?? null;
    const N = W * H;
    this.paper = makePaper(W, H, scale);
    if (L.legacy) return this._initV3(W, H, scale, smooth);

    this.screen = [];
    this.tex = [];
    INKS.forEach((ink, k) => {
      this.screen.push(makeScreen(W, H, L.angles[k], L.cell * scale, L.rough, 1.2 * scale, ink.seed));
      this.tex.push(makeTexture(W, H, scale, ink.seed, L.blotch, L.grain, L.pin));
    });
    // coverage LUT indexed by (amount << 16) | (density << 8) | threshold. For each density the dot
    // edge offset is solved so the screened coverage averages exactly the flat tone; the amount
    // level then blends flat tint (0) -> soft-edged dot (NA-1).
    this.lut = new Uint8Array(NA * 65536);
    const h = new Float32Array(256);
    for (let d = 0; d < 256; d++) {
      const f = d < 4 ? 0 : tone(d / 255, L.solid);
      const dot = (tau) => { let m = 0; for (let t = 0; t < 256; t++) { h[t] = clamp01((tau - (t + 0.5) / 256) * L.edge + 0.5); m += h[t]; } return m / 256; };
      let lo = -1, hi = 2;
      for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; if (dot(mid) < f) lo = mid; else hi = mid; }
      dot((lo + hi) / 2);
      // light tints (skin, pale fills) print cleaner: amount A becomes A^(1+light) there
      const u = clamp01((d / 255 - 0.18) / 0.27), gam = 1 + (L.light || 0) * (1 - u * u * (3 - 2 * u));
      for (let a = 0; a < NA; a++) {
        const A = Math.pow(a / (NA - 1), gam);
        for (let t = 0; t < 256; t++) this.lut[(a << 16) | (d << 8) | t] = Math.round((f + A * (h[t] - f)) * 255);
      }
    }
    // per ink: region value (0..255) -> amount level, folding in the ink's dot strength
    this.qa = L.amount.map((b) => {
      const q = new Uint8Array(256);
      for (let r = 0; r < 256; r++) q[r] = smooth ? 0 : Math.round((r / 255) * b * (NA - 1));
      return q;
    });
    this.mul = INKS.map((ink) => [0, 1, 2].map((ch) => {
      const m = new Uint16Array(256);
      for (let c = 0; c < 256; c++) m[c] = Math.round((1 - (c / 255) * (1 - ink.rgb[ch] / 255)) * 256);
      return m;
    }));
    // tone detector grid: blocks of B px; per-row interpolation tables
    const B = this.B = Math.max(4, Math.round(16 * scale));
    this.gw = Math.ceil(W / B); this.gh = Math.ceil(H / B);
    this.cnt = new Float32Array(this.gw * this.gh);
    this.tmp = new Float32Array(this.gw * this.gh);
    this.grid = [0, 1, 2].map(() => new Uint8Array(this.gw * this.gh));
    this.bx = new Uint16Array(W);
    for (let x = 0; x < W; x++) this.bx[x] = Math.min(this.gw - 1, Math.floor(x / B));
    // bilinear upsampling taps (block centres)
    this.ix0 = new Uint16Array(W); this.ix1 = new Uint16Array(W); this.fx = new Uint16Array(W);
    for (let x = 0; x < W; x++) {
      const g = Math.max(0, Math.min(this.gw - 1, (x + 0.5) / B - 0.5)), i0 = Math.floor(g);
      this.ix0[x] = i0; this.ix1[x] = Math.min(this.gw - 1, i0 + 1); this.fx[x] = Math.round((g - i0) * 256);
    }
    this.rowv = new Uint16Array(this.gw);
    this.arow = [0, 1, 2].map(() => new Uint8Array(W));
    this.flat255 = Math.round(clamp01(L.flat) * 255);
  }

  _initV3(W, H, scale, smooth) {
    const N = W * H;
    this.screen = [];
    this.tex = [];
    for (const ink of INKS) {
      this.screen.push(makeScreen(W, H, ink.angle, ink.cell * scale, 0.07, 1.2 * scale, ink.seed));
      this.tex.push(makeTexture(W, H, scale, ink.seed, 0.07, 0.03, 0.18));
    }
    this.lut = new Uint8Array(65536);
    for (let d = 0; d < 256; d++) {
      const dd = d / 255 * 1.15 - 0.03;
      for (let t = 0; t < 256; t++) {
        const c = smooth ? d / 255 : Math.max(0, Math.min(1, (dd - t / 255) * 6 + 0.5));
        this.lut[(d << 8) | t] = d < 4 ? 0 : Math.round(c * 255);
      }
    }
    this.mul = INKS.map((ink) => [0, 1, 2].map((ch) => {
      const m = new Uint16Array(256);
      for (let c = 0; c < 256; c++) m[c] = Math.round((1 - (c / 255) * (1 - ink.rgb[ch] / 255)) * 256);
      return m;
    }));
  }

  // find smooth tone (ramps, glows): per block, sum the small signed steps between neighbours.
  // Dither noise telescopes away, flat fills add nothing and steps beside a hard edge (its
  // anti-aliasing) are skipped, so what is left is the slope of the art's shading in levels/px.
  _tone(D, grid) {
    const { W, H, B, gw, gh, cnt, tmp, bx } = this;
    const sx = cnt, sy = tmp;
    sx.fill(0); sy.fill(0);
    const W4 = W * 4, T = 8;
    for (let y = 2; y < H - 2; y += 2) {
      const go = Math.floor(y / B) * gw;
      for (let x = 2, j = y * W4 + 8; x < W - 2; x++, j += 4) {
        const v = D[j], p = D[j - 4], d1 = v - p;
        if (d1 !== 0 && d1 <= T && d1 >= -T) {
          const d0 = p - D[j - 8], d2 = D[j + 4] - v;
          if (d0 <= T && d0 >= -T && d2 <= T && d2 >= -T) sx[go + bx[x]] += d1;
        }
        const u = D[j + W4], e1 = u - v;
        if (e1 !== 0 && e1 <= T && e1 >= -T) {
          const e0 = v - D[j - W4], e2 = D[j + W4 + W4] - u;
          if (e0 <= T && e0 >= -T && e2 <= T && e2 >= -T) sy[go + bx[x]] += e1;
        }
      }
    }
    const samples = (B / 2) * B;
    for (let i = 0; i < gw * gh; i++) cnt[i] = Math.sqrt(sx[i] * sx[i] + sy[i] * sy[i]) / samples;
    // box blur 3x3, twice
    for (let pass = 0; pass < 2; pass++) {
      for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
        let s = 0;
        for (let k = -1; k <= 1; k++) s += cnt[gy * gw + Math.max(0, Math.min(gw - 1, gx + k))];
        tmp[gy * gw + gx] = s / 3;
      }
      for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
        let s = 0;
        for (let k = -1; k <= 1; k++) s += tmp[Math.max(0, Math.min(gh - 1, gy + k)) * gw + gx];
        cnt[gy * gw + gx] = s / 3;
      }
    }
    const lo = this.look.slope[0], hi = this.look.slope[1], f = this.flat255;
    for (let i = 0; i < gw * gh; i++) {
      const u = Math.max(0, Math.min(1, (cnt[i] - lo) / (hi - lo)));
      grid[i] = f + Math.round((255 - f) * u * u * (3 - 2 * u));
    }
  }

  // painter -> packed RGB24 frame
  composite(painter, out) {
    const W = this.W, H = this.H, N = W * H;
    out = out || Buffer.allocUnsafe(N * 3);
    // canvas.data() is a zero-copy view of the drum (valid until the next draw on it)
    const D = painter.canvases.map((c) => c.data());
    if (this.look.legacy) return this._compositeV3(D, out);
    const { paper, lut, grid, arow, rowv, ix0, ix1, fx, qa, gw, gh, B } = this;
    const [S0, S1, S2] = this.screen, [T0, T1, T2] = this.tex;
    const [m0, m1, m2] = this.mul;
    const m00 = m0[0], m01 = m0[1], m02 = m0[2], m10 = m1[0], m11 = m1[1], m12 = m1[2], m20 = m2[0], m21 = m2[1], m22 = m2[2];
    const [D0, D1, D2] = D;
    const auto = this.look.auto && !this.smooth;
    const M = painter.maskOn && !this.smooth ? painter.maskCanvas.data() : null;
    const reg = painter.reg || [[0, 0], [0, 0], [0, 0]];
    if (auto) { this._tone(D0, grid[0]); this._tone(D1, grid[1]); this._tone(D2, grid[2]); }
    else for (const g of grid) g.fill(this.flat255);
    const [A0, A1, A2] = arow;
    let rowsConst = !auto && !M;
    if (rowsConst) for (let k = 0; k < 3; k++) arow[k].fill(qa[k][this.flat255]);
    for (let y = 0; y < H; y++) {
      if (!rowsConst) {
        const gy = Math.max(0, Math.min(gh - 1, (y + 0.5) / B - 0.5)), iy = Math.floor(gy), iy1 = Math.min(gh - 1, iy + 1);
        const fy = Math.round((gy - iy) * 256);
        for (let k = 0; k < 3; k++) {
          const g = grid[k], q = qa[k], A = arow[k];
          let lo = 255, hi = 0;
          for (let gx = 0; gx < gw; gx++) {
            const v = (g[iy * gw + gx] * (256 - fy) + g[iy1 * gw + gx] * fy) >> 8;
            rowv[gx] = v; if (v < lo) lo = v; if (v > hi) hi = v;
          }
          if (!M) {
            if (lo === hi) A.fill(q[lo]);
            else for (let x = 0; x < W; x++) A[x] = q[(rowv[ix0[x]] * (256 - fx[x]) + rowv[ix1[x]] * fx[x]) >> 8];
            continue;
          }
          // explicit screen() draws: region = auto * (1 - G) + R, read where this ink's art was drawn
          const [rx, ry] = reg[k];
          const mrow = Math.max(0, Math.min(H - 1, y - ry)) * W * 4;
          for (let x = 0; x < W; x++) {
            let v = lo === hi ? lo : (rowv[ix0[x]] * (256 - fx[x]) + rowv[ix1[x]] * fx[x]) >> 8;
            const mx = x - rx, mj = mrow + (mx < 0 ? 0 : mx >= W ? W - 1 : mx) * 4, G = M[mj + 1];
            if (G) v = ((v * (255 - G) + M[mj] * 255 + 127) / 255) | 0;
            A[x] = q[v];
          }
        }
      }
      const base = y * W;
      for (let x = 0, i = base, j = base * 4, o = base * 3; x < W; x++, i++, j += 4, o += 3) {
        let r = paper[o] << 8, g = paper[o + 1] << 8, b = paper[o + 2] << 8;
        let d = D0[j];
        if (d) {
          const c = (lut[(A0[x] << 16) | (d << 8) | S0[i]] * T0[i]) >> 8;
          r = (r * m00[c]) >> 8; g = (g * m01[c]) >> 8; b = (b * m02[c]) >> 8;
        }
        d = D1[j];
        if (d) {
          const c = (lut[(A1[x] << 16) | (d << 8) | S1[i]] * T1[i]) >> 8;
          r = (r * m10[c]) >> 8; g = (g * m11[c]) >> 8; b = (b * m12[c]) >> 8;
        }
        d = D2[j];
        if (d) {
          const c = (lut[(A2[x] << 16) | (d << 8) | S2[i]] * T2[i]) >> 8;
          r = (r * m20[c]) >> 8; g = (g * m21[c]) >> 8; b = (b * m22[c]) >> 8;
        }
        out[o] = r >> 8; out[o + 1] = g >> 8; out[o + 2] = b >> 8;
      }
    }
    return out;
  }

  _compositeV3([D0, D1, D2], out) {
    const N = this.W * this.H;
    const { paper, lut } = this;
    const [S0, S1, S2] = this.screen, [T0, T1, T2] = this.tex;
    const [m0, m1, m2] = this.mul;
    for (let i = 0, j = 0, o = 0; i < N; i++, j += 4, o += 3) {
      let r = paper[o] << 8, g = paper[o + 1] << 8, b = paper[o + 2] << 8;
      let d = D0[j];
      if (d) {
        const c = (lut[(d << 8) | S0[i]] * T0[i]) >> 8;
        r = (r * m0[0][c]) >> 8; g = (g * m0[1][c]) >> 8; b = (b * m0[2][c]) >> 8;
      }
      d = D1[j];
      if (d) {
        const c = (lut[(d << 8) | S1[i]] * T1[i]) >> 8;
        r = (r * m1[0][c]) >> 8; g = (g * m1[1][c]) >> 8; b = (b * m1[2][c]) >> 8;
      }
      d = D2[j];
      if (d) {
        const c = (lut[(d << 8) | S2[i]] * T2[i]) >> 8;
        r = (r * m2[0][c]) >> 8; g = (g * m2[1][c]) >> 8; b = (b * m2[2][c]) >> 8;
      }
      out[o] = r >> 8; out[o + 1] = g >> 8; out[o + 2] = b >> 8;
    }
    return out;
  }
}

export function toPNG(W, H, rgb) {
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let i = 0, j = 0; i < W * H; i++, j += 3) {
    img.data[i * 4] = rgb[j]; img.data[i * 4 + 1] = rgb[j + 1]; img.data[i * 4 + 2] = rgb[j + 2]; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c.encode('png');
}

export { createCanvas, hash };
