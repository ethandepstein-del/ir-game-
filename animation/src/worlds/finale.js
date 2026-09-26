// World 6: the chrome ball shatters (impact frames, speed ramp), ~900 tumbling shards swarm into
// the word "Claude", slam into crisp type, a light sweep, and the ball drops in as the full stop,
// flickering through every style it has been on each little bounce.
import { W, H, T, clamp, lerp, invLerp, ease, rng, smooth, shake, TAU, wobble, noise1, contactSquash } from '../core.js';
import { makeCanvas, freeCanvas, bloom, vignette, grain } from '../fx.js';
import chromeWorld, { tau, ball3D, camera3D, project, hitTime } from './chrome.js';

const BG = '#141413', IVORY = '#f0eee6', MUTED = '#a3a195', ACCENT = '#d97757', INK = '#1b1b2f';
const FONT_PX = 300, BASE_Y = 668, SPACING = 9;
const SWARM0 = 9.86;
const PERIOD_FALL = T.PERIOD - 0.39;
const CONTACTS = [0, 0.25, 0.39, 0.48, 0.54].map((d) => T.PERIOD + d);
const PG = 9250;

let layout, shards, sweepCanvas, center0, radius0, eyebrow, frozen, panes, crackEdges;

function buildLayout() {
  const c = makeCanvas(), g = c.getContext('2d');
  g.font = `600 ${FONT_PX}px Fraunces`;
  const word = 'Claude';
  const widths = [...word].map((ch) => g.measureText(ch).width);
  const textW = g.measureText(word).width;
  const r = 30, gap = 16;
  const left = (W - (textW + gap + r * 2)) / 2;
  // Per-letter x positions (using full-word kerning via prefix widths).
  const xs = [...word].map((_, i) => left + g.measureText(word.slice(0, i)).width);
  layout = { word, widths, textW, left, r, gap, xs, ballX: left + textW + gap + r, ballY: BASE_Y - r };
  // Text mask used for shard targets.
  g.fillStyle = '#fff';
  g.textBaseline = 'alphabetic';
  g.fillText(word, left, BASE_Y);
  const img = g.getImageData(0, 0, W, H).data;
  const pts = [];
  const rr = rng(77);
  for (let y = 0; y < H; y += SPACING) for (let x = 0; x < W; x += SPACING) {
    const jx = x + Math.floor(rr() * 3), jy = y + Math.floor(rr() * 3);
    if (img[(jy * W + jx) * 4 + 3] > 128) pts.push([jx, jy]);
  }
  freeCanvas(c);
  sweepCanvas = makeCanvas();
  return pts;
}

// The lens pane fractures radially from the impact: spokes, wobbly rings, big cells split in two.
function buildPanes() {
  const r = rng(271);
  const c = center0, N = 22;
  const rays = Array.from({ length: N }, (_, i) => (i / N) * TAU + (r() - 0.5) * 0.18);
  const rings = [0, 38, 95, 175, 290, 450, 660, 930, 1300, 1800];
  const R = rays.map(() => rings.map((rr, k) => (k ? rr * (0.86 + r() * 0.28) : 0)));
  const pt = (i, k) => { const ii = i % N; return [c.x + Math.cos(rays[ii]) * R[ii][k], c.y + Math.sin(rays[ii]) * R[ii][k]]; };
  panes = []; crackEdges = [];
  const onScreen = (poly) => poly.some(([x, y]) => x > -60 && x < W + 60 && y > -60 && y < H + 60);
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < rings.length - 1; k++) {
      const quad = k === 0 ? [pt(i, 0), pt(i, 1), pt(i + 1, 1)] : [pt(i, k), pt(i, k + 1), pt(i + 1, k + 1), pt(i + 1, k)];
      const pieces = k >= 4 ? (r() < 0.5 ? [[quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]] : [[quad[0], quad[1], quad[3]], [quad[1], quad[2], quad[3]]]) : [quad];
      for (const poly of pieces) {
        if (!onScreen(poly)) continue;
        const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
        const d = Math.hypot(cx - c.x, cy - c.y);
        panes.push({
          poly, cx, cy, d,
          dir: Math.atan2(cy - c.y, cx - c.x) + (r() - 0.5) * 0.4,
          sp: 120 + r() * 520 + d * 0.35, vz: 0.5 + r() * 1.6 + (1 - Math.min(1, d / 900)) * 1.2,
          axis: r() * TAU, om: (r() < 0.5 ? -1 : 1) * (2.5 + r() * 7), phase: r() * TAU, spin: (r() - 0.5) * 3,
          breakAt: 9.585 + (d / 1800) * 0.16 + r() * 0.035,
          off: [(r() - 0.5) * 5, (r() - 0.5) * 5], tone: 0.9 + r() * 0.2,
        });
      }
      // Fracture lines: jagged spokes everywhere, but only some ring cracks (real glass is
      // dominated by radial fractures), both drawn as wandering polylines.
      const jag = (A, B, amp) => {
        const pts = [A], n = 4, dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
        for (let j = 1; j < n; j++) { const u = j / n, o = (r() - 0.5) * amp; pts.push([A[0] + dx * u - (dy / L) * o, A[1] + dy * u + (dx / L) * o]); }
        pts.push(B);
        return pts;
      };
      crackEdges.push({ a: pt(i, k), b: pt(i, k + 1), pts: jag(pt(i, k), pt(i, k + 1), 14), r0: R[i][k], radial: true });
      if (k > 0 && r() < 0.6 - k * 0.06) crackEdges.push({ a: pt(i, k), b: pt(i + 1, k), pts: jag(pt(i, k), pt(i + 1, k), 8), r0: R[i][k], radial: false });
    }
  }
}

// Glass dust shed along the fracture lines; it swirls and assembles the word.
function buildShards(targets) {
  const tt = tau(T.SHATTER - 1e-3);
  const cam = camera3D(T.SHATTER - 1e-3, tt);
  const b = ball3D(hitTime());
  const pc = project(cam, b.c) || { x: W / 2, y: H / 2, z: 1 };
  center0 = { x: clamp(pc.x, 200, W - 200), y: clamp(pc.y, 150, H - 150) };
  radius0 = 1100;
  buildPanes();
  const r = rng(99);
  targets.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const minX = targets[0][0], maxX = targets[targets.length - 1][0];
  const onScreen = crackEdges.filter((e) => [e.a, e.b].some(([x, y]) => x > 0 && x < W && y > 0 && y < H));
  shards = targets.map(([tx, ty]) => {
    const e = onScreen[Math.floor(r() * onScreen.length)], u = r();
    const x0 = e.a[0] + (e.b[0] - e.a[0]) * u, y0 = e.a[1] + (e.b[1] - e.a[1]) * u;
    const d = Math.hypot(x0 - center0.x, y0 - center0.y);
    const out = Math.atan2(y0 - center0.y, x0 - center0.x) + (r() - 0.5) * 1.2;
    const sp = 250 + r() * 900 + d * 0.4;
    const nv = 3, size = 2.5 + r() * 6;
    const verts = [];
    for (let k = 0; k < nv; k++) {
      const aa = (k / nv) * TAU + (r() - 0.5) * 0.9;
      verts.push([Math.cos(aa) * size * (0.5 + r()), Math.sin(aa) * size * (0.5 + r())]);
    }
    const order = (tx - minX) / (maxX - minX);
    return {
      x0, y0, vx: Math.cos(out) * sp, vy: Math.sin(out) * sp - 150 * r(), vz: (r() - 0.3) * 1.2,
      rx: r() * TAU, ry: r() * TAU, wx: (r() - 0.5) * 30, wy: (r() - 0.5) * 30, spin: (r() - 0.5) * 14,
      verts, tx, ty, start: SWARM0 + order * 0.38 + r() * 0.12, dur: 0.5 + r() * 0.16,
      swirl: (r() < 0.5 ? -1 : 1) * (150 + r() * 350), tint: r(), born: 9.585 + (d / 1800) * 0.16,
    };
  });
}

// Shard clock: continues the slow motion briefly, then ramps back to full speed.
function shardTime(t) {
  const n = 30, dt = (t - T.SHATTER) / n;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const u = T.SHATTER + (i + 0.5) * dt;
    acc += lerp(0.2, 1.1, smooth(clamp((u - 9.56) / 0.3))) * dt;
  }
  return Math.max(0, acc);
}

function explodePos(s, st) {
  const tl = Math.max(0, st - shardTime(s.born));
  const drag = 1.6, k = (1 - Math.exp(-drag * tl)) / drag;
  return { x: s.x0 + s.vx * k, y: s.y0 + s.vy * k + 220 * tl * tl, z: 1 + s.vz * tl };
}

function drawShards(g, t, mode) {
  const st = shardTime(t);
  g.save();
  g.globalCompositeOperation = t < T.SLAM - 0.25 ? 'lighter' : 'source-over';
  for (const s of shards) {
    const e = explodePos(s, st);
    const k = clamp((t - s.start) / s.dur);
    const kk = ease.inOutCubic(k);
    let x = e.x, y = e.y, scale = Math.max(0.2, e.z), flat = 0;
    if (k > 0) {
      // Quadratic arc toward the letter target with a sideways swirl.
      const mx = (e.x + s.tx) / 2, my = (e.y + s.ty) / 2;
      const dx = s.tx - e.x, dy = s.ty - e.y, len = Math.hypot(dx, dy) || 1;
      const cx = mx - (dy / len) * s.swirl, cy = my + (dx / len) * s.swirl;
      const u = kk;
      x = (1 - u) * (1 - u) * e.x + 2 * (1 - u) * u * cx + u * u * s.tx;
      y = (1 - u) * (1 - u) * e.y + 2 * (1 - u) * u * cy + u * u * s.ty;
      scale = lerp(scale, 1, kk);
      flat = smooth(clamp((k - 0.55) / 0.45));
    }
    const rx = s.rx + s.wx * st * (1 - flat), ry = s.ry + s.wy * st * (1 - flat);
    const cxr = Math.cos(rx), cyr = Math.cos(ry);
    // Metallic glint from the tumbling normal: bright when it faces the key light.
    const nyv = Math.sin(rx) * cyr, nxv = Math.sin(ry);
    const glint = Math.pow(clamp(0.5 + 0.5 * (nyv * 0.8 - nxv * 0.4)), 4);
    if (t < s.born) continue;
    // Glass glints: mostly faint, flaring as a facet turns through the light.
    const base = lerp(60, 255, glint);
    const warm = s.tint < 0.35 ? [1.0, 0.86, 0.66] : [0.9, 0.95, 1.0];
    let col = [base * warm[0], base * warm[1], base * warm[2]];
    if (flat > 0) col = col.map((c, i) => lerp(c, [240, 238, 230][i], flat));
    const sq = lerp(1, SPACING * 0.62, flat);
    g.save();
    g.translate(x, y);
    g.rotate(s.spin * st * (1 - flat));
    g.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
    g.beginPath();
    if (flat >= 0.999) {
      g.rect(-sq, -sq, sq * 2, sq * 2);
    } else {
      s.verts.forEach(([vx, vy], i) => {
        const px = lerp(vx * cyr * scale, (vx / Math.max(1, Math.hypot(vx, vy))) * sq * 1.4, flat);
        const py = lerp(vy * cxr * scale, (vy / Math.max(1, Math.hypot(vx, vy))) * sq * 1.4, flat);
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      });
      g.closePath();
    }
    g.fill();
    g.restore();
  }
  g.restore();
}

// How far a pane has slipped out of true: nothing until the fracture front reaches it.
function offK(p, t) {
  const front = 2000 * ease.outQuart(clamp((t - T.SHATTER) / 0.085));
  return clamp((front - p.d) / 220);
}

// Pushes each vertex out from the centroid and winds the polygon counter-clockwise.
function dilate(poly, cx, cy, by) {
  let area = 0;
  poly.forEach(([x0, y0], i) => { const [x1, y1] = poly[(i + 1) % poly.length]; area += x0 * y1 - x1 * y0; });
  const out = poly.map(([x, y]) => { const l = Math.hypot(x - cx, y - cy) || 1; return [x + ((x - cx) / l) * by, y + ((y - cy) / l) * by]; });
  return area < 0 ? out.reverse() : out;
}

// Big pieces of the lens: each carries its patch of the frozen frame, cracked in place first,
// then breaking away toward the camera, tumbling in 3D (foreshortened), glinting, falling.
function drawPanes(g, t) {
  const st = shardTime(t);
  // The intact part of the lens as one sheet first: the union of slightly dilated intact panes
  // (all wound the same way, so overlaps stay filled), so the anti-aliased clip edges of
  // neighbouring panes never leave hairline seams of background between them.
  const intact = panes.filter((p) => t < p.breakAt);
  if (intact.length) {
    g.save();
    g.beginPath();
    for (const p of intact) {
      if (!p.dil) p.dil = dilate(p.poly, p.cx, p.cy, 1.6);
      const k = offK(p, t), dx = p.off[0] * k, dy = p.off[1] * k;
      p.dil.forEach(([px, py], i) => (i ? g.lineTo(px + dx, py + dy) : g.moveTo(px + dx, py + dy)));
      g.closePath();
    }
    g.clip();
    g.drawImage(frozen, 0, 0);
    g.restore();
  }
  const order = panes.filter((p) => t < p.breakAt).concat(panes.filter((p) => t >= p.breakAt));
  for (const p of order) {
    const broken = t >= p.breakAt;
    const tl = broken ? Math.max(0, st - shardTime(p.breakAt)) : 0;
    const z = Math.min(0.9, p.vz * tl * 0.8);
    const scale = 1 / (1 - z);
    if (scale > 6) continue;
    const ox = Math.cos(p.dir) * p.sp * tl, oy = Math.sin(p.dir) * p.sp * tl + 1300 * tl * tl;
    const x = center0.x + (p.cx - center0.x) * scale + ox * scale, y = center0.y + (p.cy - center0.y) * scale + oy * scale;
    if (x < -900 || x > W + 900 || y < -900 || y > H + 1200) continue;
    const th = p.om * tl, fc = Math.cos(th);
    g.save();
    const k = broken ? 0 : offK(p, t);
    g.translate(x + p.off[0] * k, y + p.off[1] * k);
    g.rotate(p.spin * tl + p.axis);
    g.scale(scale * (Math.abs(fc) < 0.05 ? 0.05 * Math.sign(fc || 1) : fc), scale);
    g.rotate(-p.axis);
    g.beginPath();
    p.poly.forEach(([px, py], i) => (i ? g.lineTo(px - p.cx, py - p.cy) : g.moveTo(px - p.cx, py - p.cy)));
    g.closePath();
    g.save();
    g.clip();
    g.drawImage(frozen, -p.cx, -p.cy);
    // Shading from the facet's tilt, plus a specular flare as it swings through the key light.
    const shade = (0.74 + 0.26 * Math.abs(fc)) * p.tone;
    if (shade < 1) { g.fillStyle = `rgba(0,0,0,${1 - shade})`; g.fillRect(-2000, -2000, 4000, 4000); }
    // Glass reflects more at grazing angles (Fresnel), so edge-on pieces catch the warm room light.
    const fres = broken ? 0.3 * (1 - Math.abs(fc)) ** 3 : 0;
    const glint = broken ? Math.pow(Math.max(0, Math.sin(th + p.phase)), 26) : 0;
    const add = fres + 0.6 * glint;
    if (add > 0.02) { g.fillStyle = `rgba(255,236,212,${Math.min(0.85, add)})`; g.fillRect(-2000, -2000, 4000, 4000); }
    g.restore();
    if (broken) {
      g.lineJoin = 'round';
      g.strokeStyle = `rgba(255,250,240,${0.22 + 0.5 * glint})`;
      g.lineWidth = 1.2 / Math.max(0.3, scale * Math.abs(fc));
      g.stroke();
    }
    g.restore();
  }
}

// Fracture front racing out from the impact across the still-intact pane.
function drawCracks(g, t) {
  const d = t - T.SHATTER;
  if (d < 0 || d > 0.4) return;
  const front = 2000 * ease.outQuart(clamp(d / 0.085));
  const fade = 1 - smooth(clamp((d - 0.12) / 0.25));
  g.save();
  g.lineCap = 'round';
  for (const e of crackEdges) {
    if (e.r0 > front) continue;
    const u = clamp((front - e.r0) / 160);
    const n = Math.max(1, Math.ceil(u * (e.pts.length - 1)));
    const near = 1 - 0.55 * Math.min(1, e.r0 / 1300);
    for (const [lw, col] of [[3, `rgba(0,0,0,${0.25 * fade * near})`], [e.radial ? 1.3 : 0.9, `rgba(255,252,245,${0.9 * fade * near})`]]) {
      g.strokeStyle = col; g.lineWidth = lw;
      g.beginPath();
      for (let j = 0; j <= n; j++) j ? g.lineTo(e.pts[j][0], e.pts[j][1]) : g.moveTo(e.pts[0][0], e.pts[0][1]);
      g.stroke();
    }
  }
  // Stress bloom at the point of impact.
  const gl = g.createRadialGradient(center0.x, center0.y, 0, center0.x, center0.y, 260);
  gl.addColorStop(0, `rgba(255,248,236,${0.9 * Math.exp(-d / 0.05)})`);
  gl.addColorStop(1, 'rgba(255,248,236,0)');
  g.fillStyle = gl;
  g.fillRect(center0.x - 260, center0.y - 260, 520, 520);
  g.restore();
}

// The title, with per-letter offsets (for the dip when the period lands) and optional scale.
function drawTitle(g, t, { alpha = 1, color = '#e4e1d6' } = {}) {
  const { word, xs } = layout;
  g.save();
  g.globalAlpha = alpha;
  g.font = `600 ${FONT_PX}px Fraunces`;
  g.textBaseline = 'alphabetic';
  g.fillStyle = color;
  [...word].forEach((ch, i) => {
    const delay = (word.length - 1 - i) * 0.028;
    const dy = 16 * wobble(t - T.PERIOD - delay, 3.4, 7) * (t > T.PERIOD ? 1 : 0);
    g.fillText(ch, xs[i], BASE_Y + dy);
  });
  g.restore();
}

function drawEyebrow(g, t) {
  const d = t - (T.SLAM + 0.08);
  if (d < 0) return;
  const text = 'MADE BY';
  g.save();
  g.font = '600 38px Inter';
  g.textBaseline = 'alphabetic';
  const track = lerp(26, 15, ease.outCubic(clamp(d / 0.6)));
  let w = 0;
  const cw = [...text].map((ch) => g.measureText(ch).width);
  cw.forEach((c) => (w += c + track));
  w -= track;
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

function lightSweep(g, t) {
  const d = (t - 11.34) / 0.62;
  if (d < 0 || d > 1) return;
  const sg = sweepCanvas.getContext('2d');
  sg.clearRect(0, 0, W, H);
  drawTitle(sg, t, { color: '#fff' });
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

// ---------------------------------------------------------------- the full stop
function periodState(t) {
  const { ballX, ballY, r } = layout;
  if (t < PERIOD_FALL) return null;
  if (t < CONTACTS[0]) {
    const s = CONTACTS[0] - t;
    return { x: ballX, y: ballY - 0.5 * PG * s * s, sx: 0.85, sy: 1.25, style: 'final' };
  }
  let h = 0, idx = CONTACTS.length - 1;
  for (let i = 0; i < CONTACTS.length - 1; i++) {
    if (t >= CONTACTS[i] && t < CONTACTS[i + 1]) {
      const s = t - CONTACTS[i], D = CONTACTS[i + 1] - CONTACTS[i];
      h = 0.5 * PG * s * (D - s);
      idx = i;
    }
  }
  const { squash } = contactSquash(t, CONTACTS);
  const amp = idx === 0 || t - CONTACTS[0] < 0.05 ? 0.5 : 0.3;
  const sy = 1 - amp * squash, sx = 1 / Math.pow(sy, 0.8);
  const styles = ['pencil', 'cel', 'paper', 'pixel', 'final'];
  const style = t > CONTACTS[4] + 0.06 ? 'final' : styles[idx];
  return { x: ballX, y: ballY + r * (1 - sy) - h, sx, sy, style };
}

function drawPeriod(g, t) {
  const p = periodState(t);
  if (!p) return;
  const { r } = layout;
  const rx = r * p.sx, ry = r * p.sy;
  g.save();
  if (p.style === 'pencil') {
    g.fillStyle = IVORY;
    g.beginPath(); g.ellipse(p.x, p.y, rx, ry, 0, 0, TAU); g.fill();
    g.strokeStyle = '#34322f'; g.lineWidth = 3;
    for (let k = 0; k < 2; k++) { g.beginPath(); g.ellipse(p.x + k, p.y - k, rx * (1 + k * 0.04), ry, 0.1 * k, -2.2, -2.2 + TAU * 1.05); g.stroke(); }
  } else if (p.style === 'cel') {
    g.fillStyle = '#ef3e36';
    g.beginPath(); g.ellipse(p.x, p.y, rx, ry, 0, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(p.x - rx * 0.35, p.y - ry * 0.4, rx * 0.28, ry * 0.16, -0.6, 0, TAU); g.fill();
    g.strokeStyle = INK; g.lineWidth = 4;
    g.beginPath(); g.ellipse(p.x, p.y, rx, ry, 0, 0, TAU); g.stroke();
  } else if (p.style === 'paper') {
    g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 8; g.shadowOffsetX = 4; g.shadowOffsetY = 5;
    g.fillStyle = '#e4572e';
    g.beginPath(); g.ellipse(p.x, p.y, rx, ry, 0, 0, TAU); g.fill();
    g.shadowColor = 'transparent';
    g.save(); g.clip();
    g.fillStyle = '#fff6e8'; g.fillRect(p.x - rx * 0.2, p.y - ry, rx * 0.4, ry * 2);
    g.restore();
  } else if (p.style === 'pixel') {
    const s = 7;
    for (let y = -ry; y < ry; y += s) for (let x = -rx; x < rx; x += s) {
      const cx = x + s / 2, cy = y + s / 2;
      if ((cx * cx) / (rx * rx) + (cy * cy) / (ry * ry) > 1) continue;
      const l = -cx / rx * 0.6 - cy / ry * 0.75;
      g.fillStyle = l > 0.55 ? '#fff1e8' : l < -0.35 ? '#7e2553' : '#ff004d';
      g.fillRect(Math.round(p.x + x), Math.round(p.y + y), s, s);
    }
  } else {
    // Warm bloom behind the settled full stop, struck by the final bell.
    const since = t - CONTACTS[4];
    if (since > 0) {
      const a = 0.45 * Math.exp(-since * 2.2) + 0.08;
      const bg = g.createRadialGradient(p.x, p.y, r * 0.6, p.x, p.y, r * 5);
      bg.addColorStop(0, `rgba(217,119,87,${a})`);
      bg.addColorStop(1, 'rgba(217,119,87,0)');
      g.fillStyle = bg;
      g.fillRect(p.x - r * 5, p.y - r * 5, r * 10, r * 10);
    }
    const gr = g.createRadialGradient(p.x - rx * 0.35, p.y - ry * 0.4, 1, p.x, p.y, Math.max(rx, ry) * 1.1);
    gr.addColorStop(0, '#f0a184'); gr.addColorStop(0.55, ACCENT); gr.addColorStop(1, '#b85c3f');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(p.x, p.y, rx, ry, 0, 0, TAU); g.fill();
  }
  g.restore();
}

export default {
  async init() {
    buildShards(buildLayout());
    // The last frame the lens saw (the boule filling it), used as the texture of the glass.
    frozen = makeCanvas();
    const fg = frozen.getContext('2d');
    chromeWorld.draw(fg, T.SHATTER - 1e-3);
    chromeWorld.post(fg, T.SHATTER - 1e-3, frozen);
  },
  // Motion blur on the flying glass; none across the slam cut, or it ghosts.
  shutter: (t) => (t < T.SHATTER + 1 / 120 ? null : t < T.SLAM - 1 / 120 ? { samples: 4, angle: 200 } : t > PERIOD_FALL && t < T.PERIOD + 0.65 ? { samples: 3, angle: 180 } : null),
  draw(g, t) {
    const sk = shake(t, 20);
    g.fillStyle = BG;
    g.fillRect(0, 0, W, H);
    // Warm glow behind the title
    const gl = g.createRadialGradient(W / 2, BASE_Y - 100, 0, W / 2, BASE_Y - 100, 900);
    const glowA = 0.1 * smooth(clamp((t - 10.2) / 0.8)) + 0.12 * Math.exp(-Math.max(0, t - T.SLAM) * 3) * (t > T.SLAM ? 1 : 0);
    gl.addColorStop(0, `rgba(217,119,87,${glowA})`);
    gl.addColorStop(1, 'rgba(217,119,87,0)');
    g.fillStyle = gl;
    g.fillRect(0, 0, W, H);

    const slam = t - T.SLAM;
    if (slam < 0) {
      g.save();
      // A touch of overscan (read as a punch-in under the flash) so the shake never bares an edge.
      g.translate(W / 2 + sk.x, H / 2 + sk.y);
      g.scale(1.045, 1.045);
      g.translate(-W / 2, -H / 2);
      drawPanes(g, t);
      drawCracks(g, t);
      g.restore();
    }
    g.save();
    // Gentle push-in over the hold, plus the slam punch.
    const push = 1 + 0.025 * smooth(clamp((t - T.SLAM) / 4));
    const punch = slam >= 0 ? 1 + 0.06 * Math.exp(-slam * 9) * Math.cos(slam * 30) : 1;
    g.translate(W / 2 + sk.x, H / 2 + sk.y);
    g.rotate(sk.rot);
    g.scale(push * punch, push * punch);
    g.translate(-W / 2, -H / 2);
    if (slam < 0) {
      drawShards(g, t, 'glass');
    } else {
      drawTitle(g, t);
      drawEyebrow(g, t);
      lightSweep(g, t);
      drawPeriod(g, t);
      // Slam shockwave ring and leftover glitter bursting out of the letters
      if (slam < 0.5) {
        const u = slam / 0.5;
        g.save();
        g.strokeStyle = `rgba(240,238,230,${0.28 * (1 - u) ** 2})`;
        g.lineWidth = 2 + 6 * (1 - u);
        g.beginPath(); g.ellipse(W / 2, BASE_Y - 100, 200 + 1100 * ease.outCubic(u), (200 + 1100 * ease.outCubic(u)) * 0.45, 0, 0, TAU); g.stroke();
        const r = rng(9);
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 120; i++) {
          const s = shards[Math.floor(r() * shards.length)];
          const a = r() * TAU, sp = 200 + r() * 700;
          const k = (1 - Math.exp(-5 * slam)) / 5;
          g.fillStyle = `rgba(255,236,210,${(1 - u) * 0.9})`;
          g.fillRect(s.tx + Math.cos(a) * sp * k, s.ty + Math.sin(a) * sp * k, 3, 3);
        }
        g.restore();
      }
    }
    g.restore();
    const imp = t - T.SHATTER;
    if (imp >= 0 && imp < 0.06) {
      g.fillStyle = `rgba(255,250,242,${0.32 * Math.exp(-imp / 0.014)})`;
      g.fillRect(0, 0, W, H);
    }
    // White pop on the slam
    if (slam >= 0 && slam < 0.15) {
      g.fillStyle = `rgba(255,250,240,${0.55 * Math.exp(-slam / 0.035)})`;
      g.fillRect(0, 0, W, H);
    }
  },
  post(g, t, out) {
    const s = t < T.SLAM ? 0.8 : 0.35 + 0.4 * Math.exp(-(t - T.SLAM) * 4);
    bloom(g, out, { strength: s, radius: 24, cut: t < T.SLAM ? 1.3 : 1.8, streak: t < T.SLAM ? 0.45 : 0.15 });
    vignette(g, 0.55, '0,0,0', 0.45);
    grain(g, t, 0.05);
  },
};
