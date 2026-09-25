// Shared drawing helpers and post effects.
import { W, H, rng, clamp } from './core.js';

export function makeCanvas(w = W, h = H) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// ---------------------------------------------------------------- film grain
const GRAIN_FRAMES = 6;
let grainTiles = null;
function buildGrain() {
  grainTiles = [];
  const gw = 960, gh = 540;
  for (let f = 0; f < GRAIN_FRAMES; f++) {
    const c = makeCanvas(gw, gh), g = c.getContext('2d');
    const img = g.createImageData(gw, gh), r = rng(1000 + f);
    for (let i = 0; i < img.data.length; i += 4) {
      // Roughly gaussian luma noise around mid grey.
      const n = (r() + r() + r() - 1.5) * 110 + 128;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grainTiles.push(c);
  }
}
export function grain(ctx, t, amount = 0.08) {
  if (amount <= 0) return;
  if (!grainTiles) buildGrain();
  const tile = grainTiles[Math.floor(t * 24) % GRAIN_FRAMES];
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = amount;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tile, 0, 0, W, H);
  ctx.restore();
}

export function vignette(ctx, strength = 0.4, color = '0,0,0', inner = 0.45) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * inner, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, `rgba(${color},0)`);
  g.addColorStop(1, `rgba(${color},${strength})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// Cheap bloom: isolate brights at quarter res, blur, screen back on.
let bloomA = null, bloomB = null;
export function bloom(ctx, src, { strength = 0.8, radius = 18, cut = 1.6, streak = 0 } = {}) {
  if (!bloomA) { bloomA = makeCanvas(W / 4, H / 4); bloomB = makeCanvas(W / 4, H / 4); }
  const a = bloomA.getContext('2d'), b = bloomB.getContext('2d');
  a.save();
  a.clearRect(0, 0, W / 4, H / 4);
  a.filter = `brightness(${1 / cut}) contrast(${2.2 + cut}) saturate(1.2)`;
  a.drawImage(src, 0, 0, W / 4, H / 4);
  a.restore();
  b.save();
  b.clearRect(0, 0, W / 4, H / 4);
  b.filter = `blur(${radius / 4}px)`;
  b.drawImage(bloomA, 0, 0);
  b.filter = `blur(${radius / 2}px)`;
  b.globalCompositeOperation = 'lighter';
  b.drawImage(bloomA, 0, 0);
  b.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = clamp(strength, 0, 1);
  ctx.drawImage(bloomB, 0, 0, W, H);
  if (strength > 1) { ctx.globalAlpha = strength - 1; ctx.drawImage(bloomB, 0, 0, W, H); }
  if (streak > 0) {
    // Anamorphic streak: squash vertically, blur, stretch back so the blur is horizontal.
    const s = makeStreakCanvas();
    const sg = s.getContext('2d');
    sg.save();
    sg.clearRect(0, 0, s.width, s.height);
    sg.filter = 'blur(10px)';
    sg.drawImage(bloomA, 0, 0, s.width, s.height);
    sg.restore();
    ctx.globalAlpha = streak;
    ctx.filter = 'hue-rotate(-20deg) saturate(1.6)';
    ctx.drawImage(s, 0, 0, W, H);
    ctx.filter = 'none';
  }
  ctx.restore();
}
let streakC = null;
function makeStreakCanvas() {
  if (!streakC) streakC = makeCanvas(W / 8, H / 32);
  return streakC;
}

// Chromatic aberration: offset red/blue copies of the frame outward from centre.
let caC = null;
export function chromatic(ctx, src, amount = 4) {
  if (amount < 0.3) return;
  if (!caC) caC = makeCanvas();
  const g = caC.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.drawImage(src, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.5;
  // Tint copies using multiply over solid colour on a temp canvas would cost more; instead we
  // draw scaled copies with a colour filter which reads as fringing on edges.
  ctx.filter = 'sepia(1) saturate(8) hue-rotate(-50deg) brightness(0.5)';
  ctx.drawImage(caC, -amount, -amount * 0.5, W + amount * 2, H + amount);
  ctx.filter = 'sepia(1) saturate(8) hue-rotate(160deg) brightness(0.5)';
  ctx.drawImage(caC, amount, amount * 0.5, W - amount * 2, H - amount);
  ctx.restore();
}

// ---------------------------------------------------------------- textures
// Paper: base colour, soft blotches and fibres.
export function paperTexture(w, h, seed, base = [244, 240, 230], { fibers = 1400, blotch = 0.05, dark = 0.07, wrap = false } = {}) {
  const c = makeCanvas(w, h), g = c.getContext('2d'), r = rng(seed);
  // With wrap, every mark is also drawn shifted by ±w/±h so the texture tiles without seams.
  const offs = wrap ? [-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j) => [i * w, j * h])) : [[0, 0]];
  g.fillStyle = `rgb(${base.join(',')})`;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    const x0 = r() * w, y0 = r() * h, rad = 60 + r() * 260;
    const lum = r() < 0.5 ? '255,255,255' : '120,100,70';
    const a = blotch * r();
    for (const [ox, oy] of offs) {
      const x = x0 + ox, y = y0 + oy;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(${lum},${a})`);
      gr.addColorStop(1, `rgba(${lum},0)`);
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }
  g.lineCap = 'round';
  for (let i = 0; i < fibers; i++) {
    const x0 = r() * w, y0 = r() * h, len = 4 + r() * 18, a = r() * Math.PI;
    g.strokeStyle = r() < 0.6 ? `rgba(90,70,50,${dark * r()})` : `rgba(255,255,255,${0.25 * r()})`;
    g.lineWidth = 0.6 + r() * 0.8;
    const jx = (r() - 0.5) * 4, jy = (r() - 0.5) * 4;
    for (const [ox, oy] of offs) {
      const x = x0 + ox, y = y0 + oy;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + jx, y + Math.sin(a) * len * 0.5 + jy, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
  }
  // Fine speckle.
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 10;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// ---------------------------------------------------------------- fonts
export const FONTS = {
  fraunces: 'Fraunces',
  inter: 'Inter',
  caveat: 'Caveat',
  luckiest: 'Luckiest Guy',
};
export async function loadFonts(base = 'fonts/') {
  const src = (typeof window !== 'undefined' && window.__FONT_DATA__) || {};
  const list = [
    ['Fraunces', 'fraunces', { weight: '600' }],
    ['Inter', 'inter', { weight: '600' }],
    ['Caveat', 'caveat', { weight: '600' }],
    ['Luckiest Guy', 'luckiest', {}],
  ];
  await Promise.all(list.map(async ([family, file, desc]) => {
    const url = src[file] || `${base}${file}.woff2`;
    const f = new FontFace(family, `url(${url})`, desc);
    await f.load();
    document.fonts.add(f);
  }));
}

// Draw an ellipse path with rotation (helper used everywhere for squash/stretch).
export function ballPath(g, x, y, r, b) {
  g.beginPath();
  g.ellipse(x, y, r * b.along, r * b.across, b.angle, 0, Math.PI * 2);
}

// Ball silhouette with a real contact patch: the side against the surface flattens (a squarer
// superellipse, flatter the harder it is pressed) while the free side stays round. `b.angle` is the
// tangent direction; the surface is on the +y side of that frame (screen "down" for a floor).
export function ballShape(g, x, y, r, b, { move = true } = {}) {
  const rx = r * b.along, ry = r * b.across;
  const q = Math.max(0, b.q || 0), touching = (b.pen || 0) > 0;
  const pFlat = touching ? 2 + Math.min(10, q * 26) : 2;
  const c = Math.cos(b.angle), s = Math.sin(b.angle);
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * Math.PI * 2;
    const ct = Math.cos(th), st = Math.sin(th);
    const p = st > 0 ? pFlat : 2;
    const ex = Math.sign(ct) * Math.pow(Math.abs(ct), 2 / p) * rx;
    const ey = Math.sign(st) * Math.pow(Math.abs(st), 2 / p) * ry;
    const px = x + ex * c - ey * s, py = y + ex * s + ey * c;
    if (i === 0 && move) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
}
