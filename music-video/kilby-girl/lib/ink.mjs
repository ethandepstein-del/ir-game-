// Risograph compositor.
//
// Scenes draw continuous-tone *ink density* (0..1, stored in the red channel) onto three
// canvases, one per ink drum: yellow, fluorescent pink and blue. `composite` then screens
// each density map through a rotated halftone (fixed to the paper, like a real print),
// roughens it with a static ink texture and multiplies the inks onto the paper.

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

export const INKS = [
  { name: 'yellow', rgb: [255, 232, 0], angle: 0, cell: 9.5, seed: 11 },
  { name: 'pink', rgb: [255, 72, 176], angle: 75, cell: 9.5, seed: 23 },
  { name: 'blue', rgb: [0, 120, 191], angle: 15, cell: 9.5, seed: 37 },
];
export const PAPER = [246, 239, 224];

const gray = (d) => {
  const v = Math.round(Math.max(0, Math.min(1, d)) * 255);
  return `rgb(${v},${v},${v})`;
};

export class Painter {
  constructor(W, H) {
    this.W = W; this.H = H;
    this.canvases = INKS.map(() => createCanvas(W, H));
    this.ctx = this.canvases.map((c) => c.getContext('2d'));
    this.reg = [[0, 0], [0, 0], [0, 0]];
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
  }

  each(fn) { this.ctx.forEach(fn); return this; }
  save() { return this.each((c) => c.save()); }
  restore() { return this.each((c) => c.restore()); }
  translate(x, y) { return this.each((c) => c.translate(x, y)); }
  rotate(a) { return this.each((c) => c.rotate(a)); }
  scale(x, y = x) { return this.each((c) => c.scale(x, y)); }
  alpha(a) { return this.each((c) => { c.globalAlpha = a; }); }
  clip(path) { return this.each((c) => c.clip(path)); }

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
    return this;
  }

  text(str, x, y, font, inks, { align = 'center', baseline = 'alphabetic', spacing = 0, op } = {}) {
    this.ctx.forEach((c, i) => {
      const d = inks[i];
      if (d == null) return;
      c.font = font;
      c.textAlign = align;
      c.textBaseline = baseline;
      c.letterSpacing = `${spacing}px`;
      c.globalCompositeOperation = op || 'source-over';
      c.fillStyle = gray(d);
      c.fillText(str, x, y);
      c.globalCompositeOperation = 'source-over';
      c.letterSpacing = '0px';
    });
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

  // run arbitrary drawing on every drum with that drum's density ink
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

export class Press {
  constructor(W, H, scale = 1) {
    this.W = W; this.H = H;
    const N = W * H;
    // paper colour with fibres, mottling and a soft vignette (static, so it costs no bitrate)
    const m1 = valueNoise(W, H, 90 * scale, 5), m2 = valueNoise(W, H, 7 * scale, 6), m3 = valueNoise(W, H, 2.2 * scale, 7);
    this.paper = new Uint8Array(N * 3);
    for (let y = 0, i = 0; y < H; y++) {
      for (let x = 0; x < W; x++, i++) {
        const vx = (x / W - 0.5) * 2, vy = (y / H - 0.5) * 2;
        const vig = 1 - 0.06 * Math.pow(vx * vx * 0.7 + vy * vy, 1.4);
        const k = vig * (1 + (m1[i] - 0.5) * 0.035 + (m2[i] - 0.5) * 0.018 + (m3[i] - 0.5) * 0.02);
        for (let ch = 0; ch < 3; ch++) this.paper[i * 3 + ch] = Math.max(0, Math.min(255, PAPER[ch] * k));
      }
    }
    // per ink: halftone threshold map + ink texture
    this.screen = [];
    this.tex = [];
    for (const ink of INKS) {
      const s = new Float32Array(N);
      const a = (ink.angle * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
      const cell = ink.cell * scale;
      const rough = valueNoise(W, H, 1.6 * scale, ink.seed);
      for (let y = 0, i = 0; y < H; y++) {
        for (let x = 0; x < W; x++, i++) {
          const u = (x * ca + y * sa) / cell, v = (-x * sa + y * ca) / cell;
          s[i] = 0.5 - 0.25 * (Math.cos(2 * Math.PI * u) + Math.cos(2 * Math.PI * v)) + (rough[i] - 0.5) * 0.16;
        }
      }
      // equalise so a density of d inks ~d of the area
      const hist = new Uint32Array(1024);
      let mn = Infinity, mx = -Infinity;
      for (let i = 0; i < N; i++) { if (s[i] < mn) mn = s[i]; if (s[i] > mx) mx = s[i]; }
      for (let i = 0; i < N; i++) hist[Math.min(1023, Math.floor(((s[i] - mn) / (mx - mn)) * 1024))]++;
      const cdf = new Float32Array(1024);
      let acc = 0;
      for (let k = 0; k < 1024; k++) { acc += hist[k]; cdf[k] = acc / N; }
      const q = new Uint8Array(N);
      for (let i = 0; i < N; i++) q[i] = Math.round(cdf[Math.min(1023, Math.floor(((s[i] - mn) / (mx - mn)) * 1024))] * 255);
      this.screen.push(q);
      // ink texture: blotchy coverage + pinholes, a real riso's uneven drum
      const b1 = valueNoise(W, H, 60 * scale, ink.seed + 1), b2 = valueNoise(W, H, 3 * scale, ink.seed + 2);
      const t = new Uint8Array(N);
      for (let i = 0; i < N; i++) {
        let v = 0.9 + (b1[i] - 0.5) * 0.14 + (b2[i] - 0.5) * 0.1;
        if (b2[i] > 0.93) v -= 0.35;
        t[i] = Math.max(0, Math.min(255, v * 255));
      }
      this.tex.push(t);
    }
    // coverage LUT indexed by (density << 8) | threshold, with a ~1px anti-aliased dot edge
    this.lut = new Uint8Array(65536);
    for (let d = 0; d < 256; d++) {
      const dd = d / 255 * 1.1 - 0.03;
      for (let t = 0; t < 256; t++) {
        const c = Math.max(0, Math.min(1, (dd - t / 255) * 5 + 0.5));
        this.lut[(d << 8) | t] = d < 4 ? 0 : Math.round(c * 255);
      }
    }
    // per-ink multiplier tables: coverage (0..255) -> channel factor in 1/256ths
    this.mul = INKS.map((ink) => [0, 1, 2].map((ch) => {
      const m = new Uint16Array(256);
      for (let c = 0; c < 256; c++) m[c] = Math.round((1 - (c / 255) * (1 - ink.rgb[ch] / 255)) * 256);
      return m;
    }));
  }

  // painter -> packed RGB24 frame
  composite(painter, out = Buffer.alloc(this.W * this.H * 3)) {
    const N = this.W * this.H;
    const D = painter.ctx.map((c) => c.getImageData(0, 0, this.W, this.H).data);
    const { paper, screen, tex, lut, mul } = this;
    const [D0, D1, D2] = D, [S0, S1, S2] = screen, [T0, T1, T2] = tex;
    const [m0, m1, m2] = mul;
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
