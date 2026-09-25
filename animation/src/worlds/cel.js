// World 2: flat cel animation. Bold 1950s palette, sunburst sky, thick ink lines, cel-shaded
// ball, smear frames on the fast takeoff, dust puffs, and kinetic "BOING!" lettering.
import { W, H, T, R, FLOOR, CAM_Z, CAM_CY, camX, applyCam, clamp, lerp, invLerp, ease, rng, shake, ball2D, beat, TAU, wobble, noise1 } from '../core.js';
import { grain, vignette } from '../fx.js';

const INK = '#1b1b2f';
const C = {
  ray1: '#ffd166', ray2: '#ffc145', glow: '#fff1c1',
  far: '#ffab5e', hill: '#2ec4b6', hillD: '#1f9e92',
  ground: '#3d348b', groundL: '#5249a8', shadow: '#29236a',
  ball: '#ef3e36', ballD: '#b3202a', cream: '#fff4d6', cloud: '#fffaf0',
};
const IMPACT_BIG = T.CEL, IMPACT_SMALL = beat(6);

// World → screen helpers for the current camera (set each draw).
let cam = { x: 0, y: CAM_CY, z: CAM_Z };

function sunburst(g, t, pulse) {
  const cx = W / 2, cy = 700;
  g.fillStyle = C.ray1;
  g.fillRect(0, 0, W, H);
  const n = 20, rot = t * 0.35;
  g.fillStyle = C.ray2;
  for (let i = 0; i < n; i++) {
    const a0 = rot + (i / n) * TAU, a1 = a0 + TAU / n / 2;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a0) * 2400, cy + Math.sin(a0) * 2400);
    g.lineTo(cx + Math.cos(a1) * 2400, cy + Math.sin(a1) * 2400);
    g.closePath();
    g.fill();
  }
  const gl = g.createRadialGradient(cx, cy, 0, cx, cy, 700 + pulse * 200);
  gl.addColorStop(0, `rgba(255,248,220,${0.9})`);
  gl.addColorStop(0.35, 'rgba(255,241,193,0.5)');
  gl.addColorStop(1, 'rgba(255,241,193,0)');
  g.fillStyle = gl;
  g.fillRect(0, 0, W, H);
}

function cloud(g, x, y, s) {
  const puffs = [[0, 0, 1], [-0.9, 0.25, 0.7], [0.95, 0.2, 0.75], [0.4, -0.35, 0.72], [-0.4, -0.25, 0.6]];
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.lineWidth = 9;
  g.strokeStyle = INK;
  for (const [px, py, pr] of puffs) { g.beginPath(); g.arc(px * 60, py * 60, pr * 62, 0, TAU); g.stroke(); }
  g.fillStyle = C.cloud;
  for (const [px, py, pr] of puffs) { g.beginPath(); g.arc(px * 60, py * 60, pr * 62, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(255,209,102,0.35)';
  g.beginPath(); g.ellipse(10, 38, 110, 16, 0, 0, TAU); g.fill();
  g.restore();
}

function hills(g, offset, baseY, amp, color, dark, seed, stroke = true) {
  const r = rng(seed);
  const bumps = [];
  for (let i = 0; i < 12; i++) bumps.push({ w: 260 + r() * 220, h: amp * (0.6 + r() * 0.6) });
  g.beginPath();
  let x = -((offset % 3600) + 3600) % 3600 - 400;
  g.moveTo(x, H + 10);
  for (let k = 0; k < 3; k++) for (const b of bumps) {
    g.lineTo(x, baseY);
    g.quadraticCurveTo(x + b.w / 2, baseY - b.h * 2, x + b.w, baseY);
    x += b.w;
    if (x > W + 400) break;
  }
  g.lineTo(W + 400, H + 10);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  if (stroke) { g.lineWidth = 7; g.strokeStyle = INK; g.stroke(); }
  if (dark) {
    g.save();
    g.clip();
    g.fillStyle = dark;
    g.fillRect(0, baseY - 20, W, H);
    g.restore();
  }
}

function tree(g, x, groundY, s, seed) {
  const r = rng(seed);
  const h = (170 + r() * 90) * s, rad = (70 + r() * 30) * s;
  g.lineWidth = 7;
  g.strokeStyle = INK;
  g.fillStyle = '#6b3f2a';
  g.beginPath(); g.roundRect(x - 9 * s, groundY - h, 18 * s, h, 6); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(x, groundY - h - rad * 0.7, rad * 0.85, rad * 1.15, 0, 0, TAU);
  g.fillStyle = C.hill; g.fill(); g.stroke();
  g.save(); g.clip();
  g.fillStyle = C.hillD;
  g.beginPath(); g.ellipse(x + rad * 0.45, groundY - h - rad * 0.45, rad * 0.8, rad * 1.1, 0, 0, TAU); g.fill();
  g.restore();
  g.beginPath(); g.ellipse(x, groundY - h - rad * 0.7, rad * 0.85, rad * 1.15, 0, 0, TAU); g.stroke();
}

// Cel-shaded ball: shading is lit from the top-left in screen space, clipped to the squashed shape.
function celBall(g, b, x, y) {
  const rx = R * b.along, ry = R * b.across;
  g.save();
  g.beginPath(); g.ellipse(x, y, rx, ry, b.angle, 0, TAU);
  g.fillStyle = C.ball; g.fill();
  g.save();
  g.clip();
  g.fillStyle = C.ballD;
  g.beginPath();
  g.rect(x - 300, y - 300, 600, 600);
  g.ellipse(x - R * 0.2, y - R * 0.24, R * 1.02, R * 1.0, 0, 0, TAU, true);
  g.fill('evenodd');
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath(); g.ellipse(x - R * 0.36 * b.along, y - R * 0.42 * b.across, R * 0.26, R * 0.15, -0.65, 0, TAU); g.fill();
  g.beginPath(); g.arc(x - R * 0.08 * b.along, y - R * 0.6 * b.across, R * 0.07, 0, TAU); g.fill();
  g.restore();
  g.lineWidth = 8;
  g.strokeStyle = INK;
  g.beginPath(); g.ellipse(x, y, rx, ry, b.angle, 0, TAU); g.stroke();
  g.restore();
}

// Smear: sweep of circles along the recent path, outlined as one silhouette.
function smear(g, t) {
  const pts = [];
  for (let i = 5; i >= 1; i--) {
    const bb = ball2D(t - i * 0.012);
    if (bb.x < 0) continue;
    pts.push({ x: bb.x, y: bb.y, r: R * (1 - i * 0.13) });
  }
  g.lineWidth = 16;
  g.strokeStyle = INK;
  for (const p of pts) { g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.stroke(); }
  g.fillStyle = C.ball;
  for (const p of pts) { g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill(); }
}

function speedLines(g, b, t) {
  const sp = Math.abs(b.vy);
  if (sp < 700 || b.squash > 0.05 || b.h < 40) return;
  const a = clamp((sp - 700) / 900);
  const dir = Math.sign(b.vy); // +1 moving up
  const r = rng(Math.floor(t * 30));
  g.strokeStyle = INK;
  g.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const ox = (i - 2) * R * 0.42 + (r() - 0.5) * 10;
    const len = (120 + r() * 140) * a;
    const y0 = b.y + dir * (R * 1.1 + r() * 30);
    const yEnd = Math.min(FLOOR - 14, y0 + dir * len);
    g.lineWidth = 5 + r() * 3;
    g.globalAlpha = 0.85 * a;
    if ((yEnd - y0) * dir > 8) { g.beginPath(); g.moveTo(b.x + ox, y0); g.lineTo(b.x + ox, yEnd); g.stroke(); }
  }
  g.globalAlpha = 1;
}

function impactStar(g, x, y, d, scale) {
  if (d < 0 || d > 0.2) return;
  const s = lerp(0.65, 1, ease.outBack(clamp(d / 0.06))) * (1 - ease.inQuad(clamp((d - 0.1) / 0.1))) * scale;
  if (s <= 0) return;
  g.save();
  g.translate(x, y);
  g.rotate(0.2);
  g.scale(s, s * 0.7);
  g.beginPath();
  const n = 12;
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? 110 : 230 + (i % 4 === 0 ? 40 : 0);
    const a = (i / (n * 2)) * TAU;
    i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = C.cream;
  g.fill();
  g.lineWidth = 9;
  g.strokeStyle = INK;
  g.stroke();
  g.restore();
}

function dust(g, x, groundY, d, scale, seed) {
  if (d < 0 || d > 0.45) return;
  const r = rng(seed);
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1;
    const sp = (180 + r() * 220) * scale;
    const life = 0.28 + r() * 0.15;
    const u = clamp(d / life);
    if (u >= 1 || u < 0.06) continue;
    const px = x + side * (R * 1.2 + ease.outCubic(u) * sp);
    const py = groundY - 10 - ease.outCubic(u) * (20 + r() * 50) * scale;
    const rad = (26 + r() * 22) * scale * (u < 0.5 ? 0.55 + 0.9 * u : 1 - ease.inQuad((u - 0.5) / 0.5));
    if (rad <= 2) continue;
    g.lineWidth = Math.min(7, rad * 0.2);
    g.strokeStyle = INK;
    g.fillStyle = C.cream;
    g.beginPath(); g.arc(px, py, rad, 0, TAU); g.fill(); g.stroke();
  }
}

// "BOING!" with per-letter pop, ink outline and a red extrusion.
function boing(g, x, y, d) {
  if (d < 0 || d > 0.62) return;
  const word = 'BOING!';
  g.save();
  g.translate(x, y);
  g.rotate(-0.12);
  const out = ease.inBack(clamp((d - 0.5) / 0.12));
  g.font = '150px "Luckiest Guy"';
  g.textBaseline = 'alphabetic';
  let cx = 0;
  const widths = [...word].map((ch) => g.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0);
  cx = -total / 2;
  [...word].forEach((ch, i) => {
    const li = d - i * 0.025;
    const s = ease.outBack(clamp(li / 0.12), 3) * (1 - out);
    const bob = Math.sin((d * 18) - i * 0.9) * 10 * Math.exp(-d * 4);
    if (s > 0.01) {
      g.save();
      g.translate(cx + widths[i] / 2, bob);
      g.rotate(Math.sin(i * 1.7) * 0.08);
      g.scale(s, s);
      for (let k = 8; k >= 1; k--) { g.fillStyle = k > 1 ? C.ballD : INK; g.fillText(ch, -widths[i] / 2 + k * 1.2, k * 1.6); }
      g.lineJoin = 'round';
      g.lineWidth = 16;
      g.strokeStyle = INK;
      g.strokeText(ch, -widths[i] / 2, 0);
      g.fillStyle = C.cream;
      g.fillText(ch, -widths[i] / 2, 0);
      g.restore();
    }
    cx += widths[i];
  });
  g.restore();
}

export default {
  draw(g, t) {
    const b = ball2D(t);
    const sk = shake(t, 16);
    const dBig = t - IMPACT_BIG, dSmall = t - IMPACT_SMALL;
    const punch = 0.1 * Math.exp(-Math.max(0, dBig) * 7) + 0.03 * (dSmall > 0 ? Math.exp(-dSmall * 9) : 0);
    cam = { x: camX(t), y: CAM_CY, z: CAM_Z * (1 + punch) };
    const tilt = 0.05 * wobble(dBig, 1.6, 4) + sk.rot;

    // Sky and far layers in screen space with parallax.
    sunburst(g, t, Math.exp(-Math.max(0, dBig) * 5));
    const groundScreen = (FLOOR - cam.y) * cam.z + H / 2;
    g.save();
    g.translate(W / 2, H / 2); g.rotate(tilt * 0.5); g.translate(-W / 2, -H / 2);
    cloud(g, 360 - cam.x * 0.25 % 2400 + 600, 250, 1.1);
    cloud(g, 1500 - cam.x * 0.25 + 400, 170, 0.8);
    cloud(g, 2400 - cam.x * 0.25 + 400, 300, 0.95);
    hills(g, cam.x * 0.35, groundScreen - 60, 70, C.far, null, 5, false);
    hills(g, cam.x * 0.6, groundScreen - 10, 95, C.hill, null, 9, true);
    g.restore();

    g.save();
    applyCam(g, cam.x * 0.8 + 192, cam.y, cam.z, { x: sk.x * 0.8, y: sk.y * 0.8, rot: tilt });
    for (let i = -2; i < 9; i++) tree(g, 380 + i * 380 + (i % 2) * 70, FLOOR + 4, 0.62 + (i % 3) * 0.07, 30 + i);
    g.restore();
    g.save();
    applyCam(g, cam.x, cam.y, cam.z, { x: sk.x, y: sk.y, rot: tilt });
    // Ground
    g.fillStyle = C.ground;
    g.fillRect(cam.x - 2000, FLOOR, 4000, 800);
    g.fillStyle = C.groundL;
    for (let x = Math.floor((cam.x - 1200) / 120) * 120; x < cam.x + 1200; x += 120) {
      g.beginPath(); g.roundRect(x, FLOOR + 40 + ((x / 120) % 2) * 50, 56, 12, 6); g.fill();
    }
    g.lineWidth = 9;
    g.strokeStyle = INK;
    g.beginPath(); g.moveTo(cam.x - 2000, FLOOR); g.lineTo(cam.x + 2000, FLOOR); g.stroke();

    // Contact shadow
    const hN = clamp(b.h / 500);
    g.fillStyle = C.shadow;
    g.beginPath(); g.ellipse(b.x, FLOOR + 10, R * (1.15 - 0.55 * hN) * (b.squash > 0.1 ? b.along : 1), 13 * (1 - 0.5 * hN), 0, 0, TAU); g.fill();

    const ix1 = ball2D(IMPACT_BIG).x, ix2 = ball2D(IMPACT_SMALL).x;
    impactStar(g, ix1, FLOOR - 10, dBig, 1);
    dust(g, ix1, FLOOR, dBig, 1.2, 11);
    dust(g, ix2, FLOOR, dSmall, 0.7, 12);

    speedLines(g, b, t);
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 1250 && b.squash < 0.2) smear(g, t);
    celBall(g, b, b.x, b.y);
    boing(g, ix1 + 500, FLOOR - 530, dBig);
    g.restore();
    vignette(g, 0.22, '120,40,0', 0.55);
    grain(g, t, 0.035);
  },
};
