// World 1: the pencil test. Animation paper, blue construction lines, a timing chart,
// onion skins, and a real pencil that draws the ball and taps it into motion. On 24s, boiling on 12s.
import { W, H, T, R, FLOOR, X0, DROP, DROP_H, ARCS, CAM_Z, CAM_CY, applyCam, clamp, lerp, invLerp, ease, rng, hold, noise1, shake, ball2D, beat, TAU } from '../core.js';
import { paperTexture, grain, vignette, makeCanvas } from '../fx.js';

const GRAPHITE = [52, 50, 48];
const BLUE = [92, 150, 214];
const RED = [206, 72, 60];
const Y0 = FLOOR - R - DROP_H; // where the ball is drawn before it drops

let paper, sheet; // paper texture and a pre-drawn sheet (paper + static notes)

function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

// A pencil stroke: polyline with pressure variation and a slight double line.
function stroke(g, pts, { color = GRAPHITE, width = 3, alpha = 0.85, seed = 1, jitter = 0.8, taper = true } = {}) {
  if (pts.length < 2) return;
  const r = rng(seed);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    const off = pass ? (r() - 0.5) * 1.6 : 0;
    for (let i = 1; i < pts.length; i++) {
      const u = i / (pts.length - 1);
      const press = taper ? Math.sin(Math.PI * clamp(u * 1.08, 0, 1)) * 0.55 + 0.45 : 1;
      g.strokeStyle = rgba(color, alpha * (pass ? 0.45 : 1) * (0.75 + 0.25 * r()));
      g.lineWidth = width * press * (pass ? 0.55 : 1);
      g.beginPath();
      g.moveTo(pts[i - 1][0] + off + (r() - 0.5) * jitter, pts[i - 1][1] + off + (r() - 0.5) * jitter);
      g.lineTo(pts[i][0] + off + (r() - 0.5) * jitter, pts[i][1] + off + (r() - 0.5) * jitter);
      g.stroke();
    }
  }
}

function line(x0, y0, x1, y1, n = 12, wob = 1.5, seed = 3) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push([lerp(x0, x1, u) + noise1(seed + u * 4) * wob, lerp(y0, y1, u) + noise1(seed * 2 + u * 4) * wob]);
  }
  return pts;
}

// Ellipse points from angle a0 → a1 with a wobbly radius (the hand never draws a perfect circle).
function ellipsePts(cx, cy, rx, ry, rot, a0, a1, seed, wob = 0.035) {
  const pts = [], n = Math.max(4, Math.ceil(Math.abs(a1 - a0) / 0.09));
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i <= n; i++) {
    const a = lerp(a0, a1, i / n);
    const k = 1 + noise1(seed + a * 1.3) * wob;
    const ex = Math.cos(a) * rx * k, ey = Math.sin(a) * ry * k;
    pts.push([cx + ex * c - ey * s, cy + ex * s + ey * c]);
  }
  return pts;
}

// The drawn ball. `draw` in [0,1] reveals the outline, `hatch` in [0,1] reveals shading.
function drawBall(g, x, y, b, seed, { draw = 1, hatch = 1, ghost = null } = {}) {
  const rx = R * b.along, ry = R * b.across, rot = b.angle;
  if (ghost) {
    stroke(g, ellipsePts(x, y, rx, ry, rot, 0, TAU, seed), { color: ghost.color, width: 2.4, alpha: ghost.alpha, seed, taper: false });
    return;
  }
  // Blue construction: centre cross and a loose guide circle.
  if (draw > 0.05) {
    const a = clamp(draw * 1.5) * 0.55;
    stroke(g, line(x - rx - 16, y, x + rx + 16, y, 6, 1, seed + 1), { color: BLUE, width: 1.4, alpha: a, seed: seed + 2, taper: false });
    stroke(g, line(x, y - ry - 16, x, y + ry + 16, 6, 1, seed + 3), { color: BLUE, width: 1.4, alpha: a, seed: seed + 4, taper: false });
    stroke(g, ellipsePts(x + 3, y - 2, rx * 1.04, ry * 1.04, rot, 0, TAU, seed + 5, 0.06), { color: BLUE, width: 1.3, alpha: a * 0.8, seed: seed + 6, taper: false });
  }
  // Graphite outline: starts upper-left, overshoots the join like a real hand.
  const a0 = -2.2, total = TAU + 0.5;
  const end = a0 + total * ease.inOutQuad(clamp(draw));
  if (draw > 0) stroke(g, ellipsePts(x, y, rx, ry, rot, a0, end, seed + 7), { width: 4.6, alpha: 0.92, seed: seed + 8 });
  if (draw > 0.9) stroke(g, ellipsePts(x, y, rx * 0.985, ry * 0.985, rot, a0 + 0.3, a0 + 0.3 + TAU * 0.6, seed + 9), { width: 1.8, alpha: 0.45, seed: seed + 10 });
  // Crescent hatching on the lower right, clipped to the ball.
  if (hatch > 0) {
    g.save();
    g.beginPath();
    g.ellipse(x, y, rx * 0.97, ry * 0.97, rot, 0, TAU);
    g.clip();
    g.beginPath();
    g.rect(x - rx * 2, y - ry * 2, rx * 4, ry * 4);
    g.ellipse(x - rx * 0.28, y - ry * 0.3, rx * 0.95, ry * 0.95, rot, 0, TAU, true);
    g.clip('evenodd');
    const r = rng(seed + 11), n = Math.floor(14 * hatch);
    for (let i = 0; i < n; i++) {
      const u = i / 13;
      const cx = x - rx + u * rx * 2.2, cy = y + ry * 0.9 - u * ry * 0.2;
      stroke(g, [[cx - 30, cy + 40], [cx + 36 + r() * 8, cy - 60 - r() * 8]], { width: 1.7, alpha: 0.5, seed: seed + 20 + i, jitter: 0.6 });
    }
    g.restore();
  }
}

// A yellow pencil: tip at (x,y), body pointing along `ang`, `lift` in px above the paper (for the shadow).
function drawPencil(g, x, y, ang, lift) {
  const L = 560, w = 34;
  const drawBody = (ctx, shadow) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    if (shadow) {
      ctx.fillStyle = 'rgba(40,30,20,1)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(64, -w / 2); ctx.lineTo(L, -w / 2); ctx.lineTo(L, w / 2); ctx.lineTo(64, w / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }
    // Wood cone
    ctx.fillStyle = '#e9c79c';
    ctx.beginPath(); ctx.moveTo(14, -3.2); ctx.lineTo(64, -w / 2); ctx.lineTo(64, w / 2); ctx.lineTo(14, 3.2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(150,100,60,0.25)';
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(64, 4); ctx.lineTo(64, w / 2); ctx.lineTo(14, 3.2); ctx.closePath(); ctx.fill();
    // Graphite tip
    ctx.fillStyle = '#2f2e2c';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(14, -3.4); ctx.lineTo(14, 3.4); ctx.closePath(); ctx.fill();
    // Painted hex body: three facets
    const facets = ['#f7d04a', '#f0b82a', '#d99a1c'];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = facets[i];
      ctx.fillRect(64, -w / 2 + (i * w) / 3, L - 64 - 78, w / 3 + 0.5);
    }
    // Scalloped paint edge at the cone
    ctx.fillStyle = '#f0b82a';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(64, -w / 2 + (i + 0.5) * (w / 3), 6, w / 6, 0, -Math.PI / 2, Math.PI / 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(70, -w / 2 + 3, L - 160, 3);
    // Ferrule and eraser
    const fx = L - 78;
    const fg = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
    fg.addColorStop(0, '#e8e8e2'); fg.addColorStop(0.35, '#b7b6b0'); fg.addColorStop(0.7, '#8d8c86'); fg.addColorStop(1, '#c9c8c2');
    ctx.fillStyle = fg;
    ctx.fillRect(fx, -w / 2 - 1, 44, w + 2);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < 4; i++) ctx.fillRect(fx + 6 + i * 9, -w / 2 - 1, 2, w + 2);
    const eg = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
    eg.addColorStop(0, '#f2a3a0'); eg.addColorStop(0.5, '#e07f7c'); eg.addColorStop(1, '#c86663');
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.moveTo(fx + 44, -w / 2); ctx.lineTo(L - 6, -w / 2); ctx.quadraticCurveTo(L + 2, 0, L - 6, w / 2); ctx.lineTo(fx + 44, w / 2);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  // Soft shadow: offset grows with lift and along the body (the eraser end is higher).
  g.save();
  g.globalAlpha = 0.22;
  g.filter = `blur(${6 + lift * 0.08}px)`;
  g.translate(18 + lift * 0.35, 26 + lift * 0.5);
  g.transform(1, 0, 0.12, 1, 0, 0);
  drawBody(g, true);
  g.restore();
  drawBody(g, false);
}

// Pencil choreography: returns tip position, body angle and lift.
function pencilPose(t) {
  const ang0 = -0.95;
  if (t < 0.06) {
    const u = ease.outCubic(t / 0.06);
    return { x: lerp(X0 + 520, X0 + Math.cos(-2.2) * R, u), y: lerp(Y0 - 380, Y0 + Math.sin(-2.2) * R, u), ang: ang0 - 0.2 * (1 - u), lift: 60 * (1 - u) };
  }
  if (t < 0.42) {
    const d = ease.inOutQuad(invLerp(0.06, 0.42, t));
    const a = -2.2 + (TAU + 0.5) * d;
    return { x: X0 + Math.cos(a) * R, y: Y0 + Math.sin(a) * R, ang: ang0 + 0.08 * Math.sin(a), lift: 0 };
  }
  if (t < 0.58) {
    const u = invLerp(0.42, 0.58, t);
    const zig = Math.abs(((u * 7) % 2) - 1);
    const cx = X0 - R * 0.6 + u * R * 1.3;
    return { x: cx + 30 * zig, y: Y0 + R * 0.55 - u * R * 0.25 - 70 * zig, ang: ang0, lift: 2 };
  }
  if (t < 0.72) {
    // Lift and wind up above the ball (anticipation)
    const u = ease.inOutCubic(invLerp(0.58, 0.72, t));
    return { x: lerp(X0 + R * 0.6, X0 + 30, u), y: lerp(Y0 + R * 0.3, Y0 - R - 150, u), ang: ang0 + 0.35 * u, lift: 140 * u };
  }
  if (t < 0.76) {
    const u = ease.inQuad(invLerp(0.72, 0.76, t));
    return { x: lerp(X0 + 30, X0 + 8, u), y: lerp(Y0 - R - 150, Y0 - R + 4, u), ang: ang0 + 0.35 - 0.2 * u, lift: 140 * (1 - u) };
  }
  // Recoil and exit up-right
  const u = ease.outCubic(invLerp(0.76, 1.15, t));
  return { x: lerp(X0 + 8, X0 + 760, u), y: lerp(Y0 - R + 4, Y0 - 620, u), ang: ang0 + 0.15 + 0.5 * u, lift: 30 + 200 * u };
}

function buildSheet() {
  sheet = makeCanvas(W + 240, H + 160);
  const g = sheet.getContext('2d');
  g.drawImage(paper, 0, 0);
  g.translate(120, 80);
  // Peg holes (Acme): punched through to the dark desk.
  const hole = (x, y, w, h) => {
    g.save();
    g.fillStyle = '#26211d';
    g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, h / 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; g.stroke();
    g.restore();
  };
  hole(960, 38, 120, 26); hole(960 - 330, 38, 30, 30); hole(960 + 330, 38, 30, 30);
  // Field guide
  const fr = { x: 150, y: 110, w: 1620, h: 860 };
  stroke(g, line(fr.x, fr.y, fr.x + fr.w, fr.y, 20, 1.2, 11), { color: BLUE, width: 1.5, alpha: 0.4, seed: 12, taper: false });
  stroke(g, line(fr.x + fr.w, fr.y, fr.x + fr.w, fr.y + fr.h, 20, 1.2, 13), { color: BLUE, width: 1.5, alpha: 0.4, seed: 14, taper: false });
  stroke(g, line(fr.x, fr.y + fr.h, fr.x + fr.w, fr.y + fr.h, 20, 1.2, 15), { color: BLUE, width: 1.5, alpha: 0.4, seed: 16, taper: false });
  stroke(g, line(fr.x, fr.y, fr.x, fr.y + fr.h, 20, 1.2, 17), { color: BLUE, width: 1.5, alpha: 0.4, seed: 18, taper: false });
  stroke(g, line(960 - 26, 540, 960 + 26, 540, 4, 0.5, 19), { color: BLUE, width: 1.5, alpha: 0.45, seed: 20, taper: false });
  stroke(g, line(960, 540 - 26, 960, 540 + 26, 4, 0.5, 21), { color: BLUE, width: 1.5, alpha: 0.45, seed: 22, taper: false });
  g.fillStyle = rgba(BLUE, 0.55);
  g.font = '600 30px Caveat';
  g.fillText('12 FLD', fr.x + 12, fr.y + fr.h - 14);
  // Floor line + ground ticks
  stroke(g, line(40, FLOOR + 1, W - 40, FLOOR - 1, 40, 1.8, 31), { width: 3.4, alpha: 0.88, seed: 32 });
  stroke(g, line(60, FLOOR + 3, W - 90, FLOOR + 2, 40, 2.2, 33), { width: 1.6, alpha: 0.4, seed: 34 });
  const r = rng(40);
  for (let x = 70; x < W - 60; x += 34 + r() * 20) {
    stroke(g, [[x, FLOOR + 12 + r() * 4], [x - 22, FLOOR + 38 + r() * 10]], { width: 1.5, alpha: 0.3, seed: 41 + x });
  }
  // Title block
  g.fillStyle = rgba(GRAPHITE, 0.9);
  g.font = '600 76px Caveat';
  g.fillText('Ball test', 880, 215);
  stroke(g, line(876, 232, 1120, 226, 10, 2, 51), { width: 2.4, alpha: 0.7, seed: 52 });
  g.font = '600 38px Caveat';
  g.fillStyle = rgba(GRAPHITE, 0.7);
  g.fillText('sc. 01 · on 1s @ 24', 882, 276);
  // Frame counter box
  stroke(g, line(1480, 880, 1660, 880, 8, 1.4, 61), { width: 2, alpha: 0.6, seed: 62 });
  stroke(g, line(1480, 950, 1660, 952, 8, 1.4, 63), { width: 2, alpha: 0.6, seed: 64 });
  stroke(g, line(1480, 878, 1482, 952, 6, 1.4, 65), { width: 2, alpha: 0.6, seed: 66 });
  stroke(g, line(1660, 878, 1658, 954, 6, 1.4, 67), { width: 2, alpha: 0.6, seed: 68 });
}

// Timing chart (top right): ease-in spacing, drawn progressively.
function drawChart(g, t) {
  const p = clamp(invLerp(0.7, 1.3, t));
  if (p <= 0) return;
  const x0 = 1260, x1 = 1640, y = 206;
  const n = Math.floor(p * 40);
  stroke(g, line(x0, y, lerp(x0, x1, p), y, 14, 0.8, 71), { width: 2.2, alpha: 0.8, seed: 72 });
  const ticks = 9;
  for (let i = 0; i < ticks; i++) {
    const u = (i / (ticks - 1)) ** 2; // ease in: spacing widens toward contact
    const tx = lerp(x0, x1, u);
    if (tx > lerp(x0, x1, p)) break;
    const tall = i === 0 || i === ticks - 1;
    stroke(g, [[tx, y - (tall ? 20 : 12)], [tx + 1, y + (tall ? 20 : 12)]], { width: 2, alpha: 0.8, seed: 80 + i });
    g.fillStyle = rgba(GRAPHITE, 0.75);
    g.font = '600 26px Caveat';
    if (i % 2 === 0) g.fillText(String(i * 2 + 1), tx - 6, y - 28);
    if (tall) {
      g.strokeStyle = rgba(RED, 0.8);
      g.lineWidth = 2;
      g.beginPath(); g.ellipse(tx, y - 36, 18, 18, 0, 0, TAU * clamp(p * 1.6)); g.stroke();
    }
  }
  if (n > 30) {
    g.fillStyle = rgba(RED, 0.85 * clamp((p - 0.75) * 5));
    g.font = '600 32px Caveat';
    g.fillText('slow out  →  fast in', 1320, 262);
  }
}

// Planned path in blue (dashed), revealed along its length.
function drawPlan(g, t) {
  const p = clamp(invLerp(0.4, 0.78, t));
  if (p <= 0) return;
  const tEnd = lerp(DROP, T.CEL + 0.35, ease.outCubic(p));
  const pts = [];
  for (let tt = DROP; tt <= tEnd; tt += 1 / 90) {
    const b = ball2D(tt);
    pts.push([b.x, FLOOR - R - b.h]);
  }
  g.save();
  g.setLineDash([10, 12]);
  g.lineDashOffset = 0;
  g.strokeStyle = rgba(BLUE, 0.55);
  g.lineWidth = 2;
  g.lineCap = 'round';
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
  g.restore();
  // Contact keys marked with an X.
  for (const a of ARCS.slice(0, 3)) {
    if (a.t1 > tEnd) break;
    const b = ball2D(a.t1 - 1e-4);
    const x = b.x, y = FLOOR;
    stroke(g, [[x - 12, y - 12], [x + 12, y + 12]], { color: BLUE, width: 2.2, alpha: 0.7, seed: 90 + a.t1 * 10 });
    stroke(g, [[x + 12, y - 12], [x - 12, y + 12]], { color: BLUE, width: 2.2, alpha: 0.7, seed: 95 + a.t1 * 10 });
  }
}

export default {
  async init() {
    paper = paperTexture(W + 240, H + 160, 7, [246, 243, 234], { fibers: 2200, blotch: 0.06, dark: 0.08 });
    buildSheet();
  },
  draw(g, t) {
    const tq = hold(t, 24);
    const boil = Math.floor(t * 12);
    const sk = shake(t, 14);
    // Start close on the pencil, pull back to the full sheet by the cut.
    const u = ease.inOutCubic(invLerp(0.45, 1.92, t));
    const zoom = lerp(1.95, CAM_Z, u) + 0.02 * (1 - u) * noise1(t * 0.9);
    const cx = lerp(X0 + 70, 960, u), cy = lerp(Y0 + 110, CAM_CY, u);
    g.fillStyle = '#26211d';
    g.fillRect(0, 0, W, H);
    g.save();
    applyCam(g, cx, cy, zoom, { x: sk.x, y: sk.y, rot: sk.rot + 0.006 * noise1(t * 0.7) * (1 - u) });
    // Paper sheet (slightly jittered per drawing, like sheets on pegs)
    const jr = rng(boil * 7 + 1);
    g.drawImage(sheet, -120 + (jr() - 0.5) * 1.2, -80 + (jr() - 0.5) * 1.2);

    drawChart(g, t);
    drawPlan(g, t);

    // Frame counter
    g.fillStyle = rgba(GRAPHITE, 0.85);
    g.font = '600 50px Caveat';
    g.fillText(`fr ${String(Math.floor(t * 24) + 1).padStart(3, '0')}`, 1502, 934);

    const b = ball2D(tq);
    // Tap squash from the pencil
    if (tq >= 0.75 && tq < 0.82) { b.across = 0.9; b.along = 1.08; b.angle = 0; }
    const drawP = clamp(invLerp(0.06, 0.42, t));
    const hatchP = clamp(invLerp(0.42, 0.58, t));
    const bx = b.x, by = t < DROP ? Y0 : b.y;

    // Contact shadow smudge
    const hNorm = clamp(b.h / DROP_H);
    if (drawP > 0.95) {
      const sg = g.createRadialGradient(bx, FLOOR + 4, 0, bx, FLOOR + 4, R * (1.3 - 0.5 * hNorm));
      sg.addColorStop(0, rgba(GRAPHITE, 0.22 * (1 - hNorm * 0.8)));
      sg.addColorStop(1, rgba(GRAPHITE, 0));
      g.fillStyle = sg;
      g.beginPath(); g.ellipse(bx, FLOOR + 4, R * 1.4, 16, 0, 0, TAU); g.fill();
    }
    // Onion skins: the previous two drawings, in blue and red.
    if (tq > DROP + 0.05) {
      const g2 = ball2D(tq - 2 / 24), g1 = ball2D(tq - 1 / 24);
      drawBall(g, g2.x, g2.y, g2, boil * 13 + 5, { ghost: { color: RED, alpha: 0.22 } });
      drawBall(g, g1.x, g1.y, g1, boil * 13 + 9, { ghost: { color: BLUE, alpha: 0.35 } });
    }
    drawBall(g, bx, by, b, boil * 31 + 3, { draw: drawP, hatch: hatchP });

    // Impact accents at the first contact
    const since = tq - beat(2);
    const ix = ball2D(beat(2)).x;
    if (since >= 0 && since < 0.2) {
      const a = 1 - since / 0.2;
      for (let i = 0; i < 3; i++) {
        const side = i - 1;
        stroke(g, [[ix + side * (R + 22), FLOOR - 10 - Math.abs(side) * 4], [ix + side * (R + 62), FLOOR - 36 - Math.abs(side) * 14]], { width: 2.6, alpha: 0.8 * a, seed: 300 + i + boil });
      }
    }
    // "squash!" note in red pencil, pops on at contact and stays.
    const nt = t - beat(2);
    if (nt >= 0) {
      const s = ease.outBack(clamp(nt / 0.16));
      g.save();
      g.translate(ix - 240, FLOOR - 200);
      g.rotate(-0.08);
      g.scale(s, s);
      g.fillStyle = rgba(RED, 0.9);
      g.font = '600 54px Caveat';
      g.fillText('squash!', -60, 0);
      g.restore();
      const ap = clamp((nt - 0.06) / 0.14);
      if (ap > 0) {
        const pts = [];
        for (let i = 0; i <= 10 * ap; i++) {
          const u = i / 10;
          pts.push([lerp(ix - 200, ix - R - 18, u), lerp(FLOOR - 186, FLOOR - 44, u) - Math.sin(u * Math.PI) * 40]);
        }
        stroke(g, pts, { color: RED, width: 3, alpha: 0.85, seed: 400 });
      }
    }
    // The pencil itself
    if (t < 1.15) {
      const p = pencilPose(t);
      drawPencil(g, p.x, p.y, p.ang, p.lift);
    }
    g.restore();
    vignette(g, 0.32, '60,40,20');
    grain(g, t, 0.07);
  },
};
