#!/usr/bin/env node
// Generates Clarity/shaders/textures/bluenoise.png: a tileable 128x128 RGBA
// blue-noise texture. Each channel is an independent void-and-cluster
// dither array (Ulichney 1993), so every channel is uniformly distributed
// (each 8-bit value appears exactly 64 times) and has almost no
// low-frequency energy. That is what lets a small blur remove it.
//
//   node tools/gen_bluenoise.cjs [size] [out.png] [--spectrum]
//
// No dependencies (plain Node + zlib). ~2-4 s per channel at 128x128.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const SPECTRUM = process.argv.includes('--spectrum');
const S = +(args[0] || 128);
const OUT = args[1] || path.join(__dirname, '..', 'Clarity', 'shaders', 'textures', 'bluenoise.png');
const N = S * S;
const SIGMA = +(process.env.VAC_SIGMA || 1.5);   // Ulichney's value

// Deterministic PRNG (mulberry32) so the texture is reproducible.
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Toroidal Gaussian over the whole tile (exact, no truncation).
const K = new Float64Array(N);
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  const dx = Math.min(x, S - x), dy = Math.min(y, S - y);
  K[y * S + x] = Math.exp(-(dx * dx + dy * dy) / (2 * SIGMA * SIGMA));
}

function splat(E, p, sign) {
  const px = p % S, py = (p / S) | 0;
  for (let y = 0; y < S; y++) {
    const ky = ((y - py + S) % S) * S;
    const row = y * S;
    for (let x = 0; x < S; x++) E[row + x] += sign * K[ky + ((x - px + S) % S)];
  }
}
function tightestCluster(E, bits) {   // max energy among ones
  let best = -1, bv = -Infinity;
  for (let i = 0; i < N; i++) if (bits[i] && E[i] > bv) { bv = E[i]; best = i; }
  return best;
}
function largestVoid(E, bits) {       // min energy among zeros
  let best = -1, bv = Infinity;
  for (let i = 0; i < N; i++) if (!bits[i] && E[i] < bv) { bv = E[i]; best = i; }
  return best;
}

function voidAndCluster(seed) {
  const rand = rng(seed);
  const bits = new Uint8Array(N);
  const E = new Float64Array(N);
  const ones = Math.floor(N / 10);
  let placed = 0;
  while (placed < ones) {
    const p = Math.floor(rand() * N);
    if (!bits[p]) { bits[p] = 1; splat(E, p, 1); placed++; }
  }
  // Relax the initial pattern: move the tightest cluster into the largest void.
  for (let iter = 0; iter < N; iter++) {
    const c = tightestCluster(E, bits);
    bits[c] = 0; splat(E, c, -1);
    const v = largestVoid(E, bits);
    bits[v] = 1; splat(E, v, 1);
    if (v === c) break;
  }
  const rank = new Int32Array(N);
  // Phase 1: ranks below the initial pattern, removing clusters.
  {
    const b = bits.slice(), e = E.slice();
    for (let r = ones - 1; r >= 0; r--) {
      const c = tightestCluster(e, b);
      b[c] = 0; splat(e, c, -1); rank[c] = r;
    }
  }
  // Phases 2 and 3: fill the largest void each time. (Past half density the
  // tightest cluster of zeros is exactly the largest void of ones, because
  // the energies of the two patterns sum to a constant.)
  for (let r = ones; r < N; r++) {
    const v = largestVoid(E, bits);
    bits[v] = 1; splat(E, v, 1); rank[v] = r;
  }
  return rank;
}

// Radially averaged power spectrum of a [0,1) field (mean removed), for a
// quick sanity check that the energy sits at high frequencies.
function spectrum(vals) {
  const re = new Float64Array(N), im = new Float64Array(N);
  let mean = 0; for (let i = 0; i < N; i++) mean += vals[i]; mean /= N;
  for (let i = 0; i < N; i++) re[i] = vals[i] - mean;
  const cos = new Float64Array(S), sin = new Float64Array(S);
  for (let k = 0; k < S; k++) { cos[k] = Math.cos(2 * Math.PI * k / S); sin[k] = -Math.sin(2 * Math.PI * k / S); }
  function dft1(r, i, stride, off) {
    const or = new Float64Array(S), oi = new Float64Array(S);
    for (let k = 0; k < S; k++) {
      let sr = 0, si = 0;
      for (let n = 0; n < S; n++) {
        const t = (k * n) % S, a = r[off + n * stride], b = i[off + n * stride];
        sr += a * cos[t] - b * sin[t]; si += a * sin[t] + b * cos[t];
      }
      or[k] = sr; oi[k] = si;
    }
    for (let k = 0; k < S; k++) { r[off + k * stride] = or[k]; i[off + k * stride] = oi[k]; }
  }
  for (let y = 0; y < S; y++) dft1(re, im, 1, y * S);
  for (let x = 0; x < S; x++) dft1(re, im, S, x);
  const bins = new Float64Array(S / 2 + 1), cnt = new Float64Array(S / 2 + 1);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const fx = Math.min(x, S - x), fy = Math.min(y, S - y);
    const r = Math.round(Math.sqrt(fx * fx + fy * fy));
    if (r > S / 2) continue;
    bins[r] += re[y * S + x] ** 2 + im[y * S + x] ** 2; cnt[r]++;
  }
  return Array.from(bins, (b, i) => (cnt[i] ? b / cnt[i] / N : 0));
}

// Minimal PNG writer (8-bit RGBA, no filtering).
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePNG(file, w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png);
}

const rgba = Buffer.alloc(N * 4);
const seeds = [0x1234567, 0x2345678, 0x3456789, 0x456789a];
for (let ch = 0; ch < 4; ch++) {
  const t0 = Date.now();
  const rank = voidAndCluster(seeds[ch]);
  for (let i = 0; i < N; i++) rgba[i * 4 + ch] = Math.floor(rank[i] * 256 / N);
  process.stderr.write(`channel ${'RGBA'[ch]}: ${((Date.now() - t0) / 1000).toFixed(1)} s\n`);
  if (SPECTRUM) {
    const vals = new Float64Array(N); for (let i = 0; i < N; i++) vals[i] = (rank[i] + 0.5) / N;
    const sp = spectrum(vals);
    // White noise of variance 1/12 would read ~0.083 in every bin.
    process.stderr.write('  radial power (low->high freq, white = 0.083): ' +
      [1, 2, 4, 8, 16, 32, 48, 64].map(r => `f${r}=${sp[r].toFixed(4)}`).join(' ') + '\n');
  }
}
writePNG(OUT, S, S, rgba);
console.log('wrote', path.relative(process.cwd(), OUT));
// lib/noise.glsl checks texel (0,0) against these to detect a loader that
// ignored texture.noise; update BLUE_NOISE_PROBE there after regenerating.
console.log(`probe texel (0,0) = vec4(${[0, 1, 2, 3].map(c => rgba[c].toFixed(1)).join(', ')})`);
