// Finale, act three: the end card. "Claude" slams in. Then the ball comes back in all five of its
// styles: a beat-locked procession, half a beat apart, hopping letter to letter on true ballistic
// arcs (a real contact dwell with squash, stretch along the velocity in flight). Every letter dips
// and flashes the colour of the ball that hits it. Each ball lands in the full stop and repaints it,
// until the last turns it Claude orange and "MADE BY" slides in above.
import { W, H, T, BEAT, clamp, lerp, ease, rng, TAU, wobble } from '../core.js';
import { makeCanvas, freeCanvas } from '../fx.js';

export const FONT_PX = 300, BASE_Y = 668, SPACING = 9, BR = 30;
const IVORY = '#f0eee6', MUTED = '#a3a195', ACCENT = '#d97757', INK = '#1b1b2f';
export const STYLES = ['pencil', 'cel', 'paper', 'pixel', 'chrome'];
export const FLASH = { pencil: '220,214,198', cel: '255,209,102', paper: '255,246,232', pixel: '41,173,255', chrome: '255,196,140', final: '217,119,87' };
const GRAV = 6400, DWELL = 0.046;

export let layout = null;
let sweepCanvas, hops = [], hits = [], merges = [];

// Beat-locked schedule: ball i touches letter j at tc(i, j); j = 6 is the full stop.
const tc = (i, j) => T.PROC + j * BEAT + i * BEAT / 2;

export function buildLayout() {
  const c = makeCanvas(), g = c.getContext('2d');
  g.font = `600 ${FONT_PX}px Fraunces`;
  const word = 'Claude';
  const widths = [...word].map((ch) => g.measureText(ch).width);
  const textW = g.measureText(word).width;
  const gap = 16;
  const left = (W - (textW + gap + BR * 2)) / 2;
  const xs = [...word].map((_, i) => left + g.measureText(word.slice(0, i)).width);
  layout = { word, widths, textW, left, gap, xs, ballX: left + textW + gap + BR, ballY: BASE_Y - BR };
  g.fillStyle = '#fff';
  g.textBaseline = 'alphabetic';
  g.fillText(word, left, BASE_Y);
  const img = g.getImageData(0, 0, W, H).data;
  // Dust targets on a jittered grid inside the glyphs.
  const pts = [];
  const rr = rng(77);
  for (let y = 0; y < H; y += SPACING) for (let x = 0; x < W; x += SPACING) {
    const jx = x + Math.floor(rr() * 3), jy = y + Math.floor(rr() * 3);
    if (img[(jy * W + jx) * 4 + 3] > 128) pts.push([jx, jy]);
  }
  // Top profile of the lettering, then where a ball of radius BR can actually come to rest on each
  // letter (circle against height field), preferring the letter's middle.
  const top = new Float32Array(W).fill(Infinity);
  for (let x = 0; x < W; x++) for (let y = 150; y < BASE_Y + 4; y++) if (img[(y * W + x) * 4 + 3] > 128) { top[x] = y; break; }
  layout.rest = [...word].map((_, j) => {
    const w = widths[j], mid = xs[j] + w / 2;
    let best = null;
    for (let xc = Math.round(xs[j] + w * 0.22); xc <= xs[j] + w * 0.78; xc += 2) {
      let yc = Infinity;
      for (let dx = -BR; dx <= BR; dx++) { const tp = top[xc + dx]; if (tp < Infinity) yc = Math.min(yc, tp - Math.sqrt(BR * BR - dx * dx)); }
      if (yc === Infinity) continue;
      const score = yc + 0.25 * Math.abs(xc - mid);
      if (!best || score < best.score) best = { x: xc, y: yc, score };
    }
    return best;
  });
  freeCanvas(c);
  sweepCanvas = makeCanvas();
  buildProcession();
  return pts;
}

function buildProcession() {
  hops = []; hits = []; merges = [];
  STYLES.forEach((style, i) => {
    const pts = [{ x: -70, y: 430, t: tc(i, 0) - BEAT * 1.5 }];
    layout.rest.forEach((p, j) => pts.push({ x: p.x, y: p.y, t: tc(i, j), letter: j }));
    pts.push({ x: layout.ballX, y: layout.ballY, t: tc(i, 6), merge: true });
    hops.push({ style, i, pts });
    pts.slice(1, 7).forEach((p, j) => hits.push({ letter: j, t: p.t, style, i, x: p.x, y: p.y + BR, seed: i * 10 + j }));
    merges.push({ t: tc(i, 6), style, i });
  });
  hits.sort((a, b) => a.t - b.t);
}
export const endcardEvents = () => ({ hits, merges });

// Ball on its path: parabolic flights between contacts, and a short contact dwell at each one
// where it squashes against the letter (bottom held on the surface) and springs back.
function ballAt(h, t) {
  const P = h.pts, last = P.length - 1;
  if (t < P[0].t || t >= P[last].t) return null;
  for (let k = 1; k < last; k++) {
    const d = t - P[k].t;
    if (Math.abs(d) < DWELL / 2) {
      const u = d / DWELL + 0.5;
      const vin = flight(P, k - 1).vyLand;
      const sq = 0.42 * Math.min(1, Math.abs(vin) / 1300) * Math.sin(Math.PI * u);
      const sy = 1 - sq;
      return { x: P[k].x, y: P[k].y + BR * (1 - sy), along: sy, across: 1 / Math.pow(sy, 0.8), ang: Math.PI / 2, spin: (P[k].x - P[0].x) / BR * 0.8 };
    }
  }
  let k = 0;
  while (k < last - 1 && t >= P[k + 1].t) k++;
  const f = flight(P, k);
  const s = clamp(t - f.t0, 0, f.D);
  const x = P[k].x + f.vx * s, y = P[k].y + f.vy0 * s + 0.5 * GRAV * s * s, vy = f.vy0 + GRAV * s;
  const sp = Math.hypot(f.vx, vy), st = Math.min(0.24, sp / 9000);
  // Arriving in the full stop: squash into it over the last dwell, then gone.
  if (k === last - 1 && t > P[last].t - DWELL / 2) {
    const u = (t - (P[last].t - DWELL / 2)) / (DWELL / 2), sy = 1 - 0.4 * u;
    return { x: P[last].x, y: P[last].y + BR * (1 - sy), along: sy, across: 1 / Math.pow(sy, 0.8), ang: Math.PI / 2, spin: (P[last].x - P[0].x) / BR * 0.8 };
  }
  return { x, y, along: 1 + st, across: 1 / Math.sqrt(1 + st), ang: Math.atan2(vy, f.vx), spin: (x - P[0].x) / BR * 0.8 };
}
function flight(P, k) {
  const t0 = P[k].t + (k > 0 ? DWELL / 2 : 0), t1 = P[k + 1].t - DWELL / 2, D = t1 - t0;
  const vx = (P[k + 1].x - P[k].x) / D, vy0 = (P[k + 1].y - P[k].y - 0.5 * GRAV * D * D) / D;
  return { t0, D, vx, vy0, vyLand: vy0 + GRAV * D };
}

// ---------------------------------------------------------------- the ball, in every style
export function drawBall(g, style, x, y, r, along = 1, across = 1, ang = 0, spin = 0, t = 0) {
  g.save();
  const path = () => { g.beginPath(); g.ellipse(x, y, r * along, r * across, ang, 0, TAU); };
  if (style === 'pencil') {
    path(); g.fillStyle = IVORY; g.fill();
    g.save(); path(); g.clip();
    g.strokeStyle = 'rgba(80,120,220,0.55)'; g.lineWidth = 1.6;
    for (const a of [spin, spin + Math.PI / 2]) { g.beginPath(); g.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); }
    g.fillStyle = 'rgba(52,50,47,0.18)';
    g.beginPath(); g.ellipse(x + r * 0.3, y + r * 0.35, r * 0.9, r * 0.7, 0.4, 0, TAU); g.fill();
    g.restore();
    g.strokeStyle = '#34322f'; g.lineWidth = 3; g.lineCap = 'round';
    for (let k = 0; k < 2; k++) { g.beginPath(); g.ellipse(x + k, y - k, r * along * (1 + k * 0.05), r * across, ang + 0.1 * k, spin - 2.2, spin - 2.2 + TAU * 1.04); g.stroke(); }
  } else if (style === 'cel') {
    path(); g.fillStyle = '#ef3e36'; g.fill();
    g.save(); path(); g.clip();
    g.fillStyle = '#b3261e'; g.beginPath(); g.ellipse(x + r * 0.45, y + r * 0.5, r * 0.95, r * 0.85, 0, 0, TAU); g.fill();
    g.fillStyle = '#ef3e36'; g.beginPath(); g.ellipse(x - r * 0.12, y - r * 0.12, r * 0.86, r * 0.82, 0, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x - r * 0.38, y - r * 0.42, r * 0.28, r * 0.16, -0.6, 0, TAU); g.fill();
    g.restore();
    path(); g.strokeStyle = INK; g.lineWidth = 4; g.stroke();
  } else if (style === 'paper') {
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 8; g.shadowOffsetX = 4; g.shadowOffsetY = 5;
    path(); g.fillStyle = '#e4572e'; g.fill();
    g.restore();
    g.save(); path(); g.clip();
    g.translate(x, y); g.rotate(spin);
    g.fillStyle = '#fff6e8'; g.fillRect(-r * 0.2, -r * 1.3, r * 0.4, r * 2.6);
    g.fillStyle = '#29335c'; g.fillRect(-r * 1.3, -r * 0.09, r * 2.6, r * 0.18);
    g.restore();
    g.save(); path(); g.clip();
    const lg = g.createLinearGradient(x - r, y - r, x + r, y + r);
    lg.addColorStop(0, 'rgba(255,255,255,0.18)'); lg.addColorStop(1, 'rgba(0,0,0,0.18)');
    g.fillStyle = lg; g.fillRect(x - r * 1.5, y - r * 1.5, r * 3, r * 3);
    g.restore();
  } else if (style === 'pixel') {
    const s = 6, hz = Math.abs(Math.cos(ang)) >= Math.abs(Math.sin(ang));
    const rx = r * (hz ? along : across), ry = r * (hz ? across : along);
    const bx = Math.round(x / 3) * 3, by = Math.round(y / 3) * 3;
    for (let yy = -Math.ceil(ry / s) * s; yy < ry; yy += s) for (let xx = -Math.ceil(rx / s) * s; xx < rx; xx += s) {
      const cx = xx + s / 2, cy = yy + s / 2;
      if ((cx * cx) / (rx * rx) + (cy * cy) / (ry * ry) > 1) continue;
      const l = (-cx / rx) * 0.6 - (cy / ry) * 0.75;
      const edge = (cx * cx) / (rx * rx) + (cy * cy) / (ry * ry) > 0.72;
      g.fillStyle = l > 0.55 ? '#fff1e8' : edge ? '#7e2553' : l < -0.3 ? '#a0133f' : '#ff004d';
      g.fillRect(bx + xx, by + yy, s, s);
    }
  } else if (style === 'chrome') {
    g.save(); path(); g.clip();
    const gr = g.createLinearGradient(x, y - r, x, y + r);
    gr.addColorStop(0, '#f4f1ec'); gr.addColorStop(0.42, '#8f8a86'); gr.addColorStop(0.5, '#ffc48c');
    gr.addColorStop(0.56, '#3a302a'); gr.addColorStop(1, '#141110');
    g.fillStyle = gr; g.fillRect(x - r * 1.5, y - r * 1.5, r * 3, r * 3);
    const rg = g.createRadialGradient(x, y, r * 0.55, x, y, r * 1.05);
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = rg; g.fillRect(x - r * 1.5, y - r * 1.5, r * 3, r * 3);
    // Engraved grooves turning with the roll
    g.strokeStyle = 'rgba(20,16,14,0.55)'; g.lineWidth = 1.5;
    for (const o of [-0.35, 0.35]) { g.beginPath(); g.ellipse(x, y, r * Math.abs(Math.cos(spin + o)), r, 0, 0, TAU); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.ellipse(x - r * 0.38, y - r * 0.45, r * 0.2, r * 0.12, -0.6, 0, TAU); g.fill();
    g.restore();
    path(); g.strokeStyle = 'rgba(255,214,170,0.5)'; g.lineWidth = 1.2; g.stroke();
  } else {
    const gr = g.createRadialGradient(x - r * along * 0.35, y - r * across * 0.4, 1, x, y, Math.max(along, across) * r * 1.1);
    gr.addColorStop(0, '#f0a184'); gr.addColorStop(0.55, ACCENT); gr.addColorStop(1, '#b85c3f');
    path(); g.fillStyle = gr; g.fill();
  }
  g.restore();
}

// ---------------------------------------------------------------- letters
function letterState(j, t) {
  let dy = 0, sq = 0, flash = 0, col = null, since = Infinity;
  for (const h of hits) {
    if (h.letter !== j || t < h.t - DWELL / 2) continue;
    const d = t - h.t;
    dy += 12 * wobble(d, 3.3, 7);
    sq += 0.07 * Math.exp(-((d / 0.05) ** 2));
    if (d >= -DWELL / 2 && d < since) { since = d; col = FLASH[h.style]; flash = 0.75 * Math.exp(-Math.max(0, d) / 0.09); }
  }
  // The full stop's final bloom sends a ripple back through the word.
  const dl = T.PERIOD + (layout.word.length - 1 - j) * 0.03;
  if (t > dl) dy += 16 * wobble(t - dl, 3.4, 7);
  return { dy, sy: 1 - sq, flash, col };
}

export function drawTitle(g, t, { alpha = 1, color = '#e4e1d6', plain = false } = {}) {
  const { word, xs, widths } = layout;
  g.save();
  g.globalAlpha = alpha;
  g.font = `600 ${FONT_PX}px Fraunces`;
  g.textBaseline = 'alphabetic';
  [...word].forEach((ch, j) => {
    const s = letterState(j, t);
    const cx = xs[j] + widths[j] / 2;
    g.save();
    g.translate(cx, BASE_Y + s.dy);
    g.scale(1 / Math.sqrt(s.sy), s.sy);
    g.fillStyle = color;
    g.fillText(ch, -widths[j] / 2, 0);
    if (!plain && s.flash > 0.01) {
      g.globalAlpha = alpha * s.flash;
      g.fillStyle = `rgb(${s.col})`;
      g.fillText(ch, -widths[j] / 2, 0);
    }
    g.restore();
  });
  g.restore();
}

function drawEyebrow(g, t) {
  const d = t - (T.PERIOD + 0.1);
  if (d < 0) return;
  const text = 'MADE BY';
  g.save();
  g.font = '600 38px Inter';
  g.textBaseline = 'alphabetic';
  const track = lerp(26, 15, ease.outCubic(clamp(d / 0.6)));
  const cw = [...text].map((ch) => g.measureText(ch).width);
  const w = cw.reduce((a, c) => a + c + track, 0) - track;
  let x = W / 2 - w / 2;
  const y = BASE_Y - FONT_PX * 0.9;
  g.beginPath();
  g.rect(0, y - 44, W, 56);
  g.clip();
  [...text].forEach((ch, i) => {
    const u = ease.outCubic(clamp((d - i * 0.03) / 0.32));
    g.fillStyle = MUTED;
    g.globalAlpha = u;
    g.fillText(ch, x, y + (1 - u) * 46);
    x += cw[i] + track;
  });
  g.restore();
}

function lightSweep(g, t, t0, dur = 0.62) {
  const d = (t - t0) / dur;
  if (d < 0 || d > 1) return;
  const sg = sweepCanvas.getContext('2d');
  sg.clearRect(0, 0, W, H);
  drawTitle(sg, t, { color: '#fff', plain: true });
  sg.save();
  sg.globalCompositeOperation = 'source-in';
  const x = lerp(layout.left - 300, layout.left + layout.textW + 300, ease.inOutQuad(d));
  const gr = sg.createLinearGradient(x - 220, 0, x + 220, 0);
  gr.addColorStop(0, 'rgba(255,200,150,0)');
  gr.addColorStop(0.35, 'rgba(255,215,170,0.5)');
  gr.addColorStop(0.5, 'rgba(255,255,255,1)');
  gr.addColorStop(0.65, 'rgba(255,215,170,0.5)');
  gr.addColorStop(1, 'rgba(255,200,150,0)');
  sg.setTransform(1, 0, -0.35, 1, 0, 0);
  sg.fillStyle = gr;
  sg.fillRect(-1000, 0, W + 2000, H);
  sg.restore();
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.drawImage(sweepCanvas, 0, 0);
  g.filter = 'blur(18px)';
  g.globalAlpha = 0.8;
  g.drawImage(sweepCanvas, 0, 0);
  g.restore();
}

// ---------------------------------------------------------------- contact bursts
// Each hit throws a little spray in the style of the ball that made it.
function drawBursts(g, t) {
  const list = hits.concat(merges.map((m) => ({ ...m, x: layout.ballX, y: layout.ballY + BR, seed: 100 + m.i, merge: true })));
  for (const h of list) {
    const d = t - h.t;
    if (d < 0 || d > 0.55) continue;
    const r = rng(9000 + h.seed), n = h.merge ? 14 : 8;
    g.save();
    if (h.style === 'chrome') g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < n; k++) {
      const a = -Math.PI * (0.08 + 0.84 * r()), sp = (160 + r() * 330) * (h.merge ? 1.3 : 1), life = 0.3 + r() * 0.22;
      if (d > life) { r(); r(); continue; }
      const u = d / life, dd = h.style === 'pixel' ? Math.floor(d * 20) / 20 : d;
      const px = h.x + Math.cos(a) * sp * dd, py = h.y + Math.sin(a) * sp * dd + 0.5 * 1500 * dd * dd;
      const al = 1 - u * u, sz = 3 + r() * 4, rot = r() * TAU + d * 12;
      if (h.style === 'pencil') {
        g.strokeStyle = `rgba(214,208,192,${al})`; g.lineWidth = 2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * 12, py + Math.sin(a) * 12); g.stroke();
      } else if (h.style === 'cel') {
        g.fillStyle = k % 3 ? `rgba(255,209,102,${al})` : `rgba(255,255,255,${al})`;
        star(g, px, py, sz * 1.6, rot);
      } else if (h.style === 'paper') {
        g.fillStyle = ['#e4572e', '#f3a712', '#29335c', '#fff6e8'][k % 4];
        g.globalAlpha = al;
        g.save(); g.translate(px, py); g.rotate(rot); g.scale(1, Math.cos(d * 18 + k)); g.fillRect(-sz, -sz * 0.6, sz * 2, sz * 1.2); g.restore();
      } else if (h.style === 'pixel') {
        g.fillStyle = ['#ff004d', '#ffa300', '#29adff', '#fff1e8'][k % 4];
        g.globalAlpha = al > 0.4 ? 1 : 0;
        g.fillRect(Math.round(px / 6) * 6, Math.round(py / 6) * 6, 6, 6);
      } else {
        const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp + 1500 * dd, l = Math.hypot(vx, vy) || 1;
        g.strokeStyle = `rgba(255,217,168,${al})`; g.lineWidth = 1.8; g.lineCap = 'round';
        g.beginPath(); g.moveTo(px, py); g.lineTo(px - (vx / l) * 14, py - (vy / l) * 14); g.stroke();
      }
    }
    g.restore();
  }
}
function star(g, x, y, r, rot) {
  g.beginPath();
  for (let i = 0; i < 8; i++) { const a = rot + (i / 8) * TAU, rr = i % 2 ? r * 0.35 : r; i ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}

// ---------------------------------------------------------------- the full stop
function drawPeriod(g, t) {
  let cur = null;
  for (const m of merges) if (t >= m.t) cur = m;
  if (!cur) return;
  const { ballX: x, ballY: y } = layout;
  const final = t >= T.PERIOD;
  const style = final ? 'final' : cur.style;
  const since = t - (final ? T.PERIOD : cur.t);
  // Squash as the ball lands in it, then a springy pop; bigger for the final bloom.
  const sq = 0.38 * Math.exp(-((since / 0.045) ** 2));
  const pop = (final ? 0.3 : 0.14) * wobble(since - 0.03, 3.2, 6.5) * (since > 0.03 ? 1 : 0);
  const sy = (1 - sq) * (1 + pop), sx = (1 / Math.pow(1 - sq, 0.8)) * (1 + pop);
  const cy = y + BR * (1 - sy);
  if (final) {
    const a = 0.45 * Math.exp(-since * 2.2) + 0.08;
    const bg = g.createRadialGradient(x, y, BR * 0.6, x, y, BR * 5);
    bg.addColorStop(0, `rgba(217,119,87,${a})`);
    bg.addColorStop(1, 'rgba(217,119,87,0)');
    g.fillStyle = bg;
    g.fillRect(x - BR * 5, y - BR * 5, BR * 10, BR * 10);
  }
  // Ring flash in the colour of the ball that just landed
  if (since < 0.45) {
    const u = since / 0.45;
    g.save();
    g.strokeStyle = `rgba(${FLASH[style]},${0.8 * (1 - u) ** 2})`;
    g.lineWidth = 3 * (1 - u) + 1;
    g.beginPath(); g.arc(x, y, BR * (1.1 + (final ? 5 : 2.6) * ease.outCubic(u)), 0, TAU); g.stroke();
    g.restore();
  }
  drawBall(g, style, x, cy, BR, sx, sy, 0, 0, t);
}

export function drawEndcard(g, t) {
  drawTitle(g, t);
  drawEyebrow(g, t);
  lightSweep(g, t, T.SLAM + 0.34);
  lightSweep(g, t, T.PERIOD + 0.42, 0.7);
  drawBursts(g, t);
  drawPeriod(g, t);
  for (let i = hops.length - 1; i >= 0; i--) {
    const h = hops[i], b = ballAt(h, t);
    if (b) drawBall(g, h.style, b.x, b.y, BR, b.along, b.across, b.ang, b.spin, t);
  }
}
// The procession is on screen (for motion blur).
export const processionActive = (t) => t > T.PROC - BEAT * 1.6 && t < T.PERIOD + 0.7;
