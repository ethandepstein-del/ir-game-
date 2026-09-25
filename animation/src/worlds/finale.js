// World 6: the chrome ball shatters (impact frames, speed ramp), ~900 tumbling shards swarm into
// the word "Claude", slam into crisp type, a light sweep, and the ball drops in as the full stop,
// flickering through every style it has been on each little bounce.
import { W, H, T, clamp, lerp, invLerp, ease, rng, smooth, shake, TAU, wobble, noise1, contactSquash } from '../core.js';
import { makeCanvas, bloom, vignette, grain } from '../fx.js';
import { tau, ball3D, camera3D, project, renderGL } from './chrome.js';

const BG = '#141413', IVORY = '#f0eee6', MUTED = '#a3a195', ACCENT = '#d97757', INK = '#1b1b2f';
const FONT_PX = 300, BASE_Y = 668, SPACING = 9;
const SWARM0 = 9.86, DIM1 = 10.7;
const PERIOD_FALL = 12.86;
const CONTACTS = [T.PERIOD, 13.5, 13.64, 13.73, 13.79];
const PG = 9250;

let layout, shards, textCanvas, sweepCanvas, center0, radius0, eyebrow;

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
  textCanvas = makeCanvas();
  sweepCanvas = makeCanvas();
  return pts;
}

function buildShards(targets) {
  // Shatter origin: where the ball was on screen at the moment of the break.
  const tt = tau(T.SHATTER - 1e-3);
  const cam = camera3D(T.SHATTER - 1e-3, tt);
  const b = ball3D(Math.min(tt, 9.36));
  const pc = project(cam, b.p);
  const pe = project(cam, [b.p[0] + cam.r[0], b.p[1] + cam.r[1], b.p[2] + cam.r[2]]);
  center0 = { x: pc.x, y: pc.y };
  radius0 = Math.hypot(pe.x - pc.x, pe.y - pc.y);
  const r = rng(99);
  targets.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const minX = targets[0][0], maxX = targets[targets.length - 1][0];
  shards = targets.map(([tx, ty]) => {
    const a = r() * TAU, d = Math.sqrt(r()) * radius0 * 0.95;
    const x0 = center0.x + Math.cos(a) * d, y0 = center0.y + Math.sin(a) * d;
    const out = Math.atan2(y0 - center0.y, x0 - center0.x) + (r() - 0.5) * 0.5;
    const sp = (380 + r() * 1300) * (0.5 + d / radius0);
    const nv = 3 + Math.floor(r() * 3), size = radius0 * (0.045 + r() * 0.1);
    const verts = [];
    for (let k = 0; k < nv; k++) {
      const aa = (k / nv) * TAU + (r() - 0.5) * 0.9;
      verts.push([Math.cos(aa) * size * (0.6 + r() * 0.6), Math.sin(aa) * size * (0.6 + r() * 0.6)]);
    }
    const order = (tx - minX) / (maxX - minX);
    return {
      x0, y0, vx: Math.cos(out) * sp, vy: Math.sin(out) * sp - 200 * r(), vz: (r() - 0.35) * 1.6,
      rx: r() * TAU, ry: r() * TAU, wx: (r() - 0.5) * 22, wy: (r() - 0.5) * 22, spin: (r() - 0.5) * 10,
      verts, tx, ty, start: SWARM0 + order * 0.38 + r() * 0.12, dur: 0.5 + r() * 0.16,
      swirl: (r() < 0.5 ? -1 : 1) * (150 + r() * 350), tint: r(),
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
  const drag = 1.6, k = (1 - Math.exp(-drag * st)) / drag;
  return { x: s.x0 + s.vx * k, y: s.y0 + s.vy * k + 180 * st * st, z: 1 + s.vz * st };
}

function drawShards(g, t, mode) {
  const st = shardTime(t);
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
    let col;
    if (mode === 'white') col = [0, 0, 0];
    else if (mode === 'black') col = [255, 255, 255];
    else {
      const base = lerp(22, 255, glint);
      const warm = s.tint < 0.15 ? [1.08, 0.95, 0.85] : s.tint > 0.7 ? [0.82, 0.92, 1.12] : [0.95, 0.97, 1.0];
      col = [base * warm[0], base * warm[1], base * warm[2]];
      if (flat > 0) col = col.map((c, i) => lerp(c, [240, 238, 230][i], flat));
    }
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
    if (mode === 'chrome' && flat < 0.5 && glint > 0.15) {
      g.strokeStyle = `rgba(255,250,240,${Math.min(1, glint * 1.4) * (1 - flat * 2)})`;
      g.lineWidth = 1.5;
      g.stroke();
    }
    g.restore();
  }
}

function embers(g, t) {
  const st = shardTime(t);
  if (st > 1.2) return;
  const r = rng(123);
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 160; i++) {
    const a = r() * TAU, sp = 300 + r() * 1400, life = 0.4 + r() * 0.8;
    if (st > life) { r(); continue; }
    const k = (1 - Math.exp(-2 * st)) / 2;
    const x = center0.x + Math.cos(a) * (radius0 * 0.6 + sp * k), y = center0.y + Math.sin(a) * (radius0 * 0.6 + sp * k) + 120 * st * st;
    const f = 1 - st / life;
    g.fillStyle = `rgba(255,${150 + (100 * f) | 0},${60 + (120 * f) | 0},${f})`;
    g.beginPath(); g.arc(x, y, 1.5 + 3 * f * r(), 0, TAU); g.fill();
  }
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
  const d = (t - 11.62) / 0.62;
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
  },
  // No blur across the two stark impact frames (and the frame after), or they average to grey.
  shutter: (t) => (t < T.SHATTER + 3 / 60 ? null : t < T.SLAM + 0.3 ? { samples: 5, angle: 220 } : t > PERIOD_FALL && t < 13.9 ? { samples: 3, angle: 180 } : null),
  draw(g, t) {
    const sk = shake(t, 20);
    const imp = t - T.SHATTER;
    // Impact frames: two frames of stark black/white silhouettes right at the break.
    if (imp < 1 / 60) {
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      g.save(); g.translate(sk.x, sk.y); drawShards(g, t, 'white'); g.restore();
      return;
    }
    if (imp < 2 / 60) {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      g.save(); g.translate(sk.x, sk.y); drawShards(g, t, 'black'); g.restore();
      return;
    }
    // Background: the chrome studio keeps drifting, dimming to the title black.
    const dim = 1 - smooth(clamp((t - 9.75) / (DIM1 - 9.75)));
    if (dim > 0.001) {
      const tt = tau(t);
      const cam = camera3D(t, tt);
      g.drawImage(renderGL({ cam, ball: ball3D(9.36), ballOn: false, dim, tt }), 0, 0);
      g.fillStyle = BG;
      g.globalAlpha = 1 - dim;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    } else {
      g.fillStyle = BG;
      g.fillRect(0, 0, W, H);
    }
    // Warm glow behind the title
    const gl = g.createRadialGradient(W / 2, BASE_Y - 100, 0, W / 2, BASE_Y - 100, 900);
    const glowA = 0.1 * smooth(clamp((t - 10.2) / 0.8)) + 0.12 * Math.exp(-Math.max(0, t - T.SLAM) * 3) * (t > T.SLAM ? 1 : 0);
    gl.addColorStop(0, `rgba(217,119,87,${glowA})`);
    gl.addColorStop(1, 'rgba(217,119,87,0)');
    g.fillStyle = gl;
    g.fillRect(0, 0, W, H);

    const slam = t - T.SLAM;
    g.save();
    // Gentle push-in over the hold, plus the slam punch.
    const push = 1 + 0.025 * smooth(clamp((t - T.SLAM) / 4));
    const punch = slam >= 0 ? 1 + 0.06 * Math.exp(-slam * 9) * Math.cos(slam * 30) : 1;
    g.translate(W / 2 + sk.x, H / 2 + sk.y);
    g.rotate(sk.rot);
    g.scale(push * punch, push * punch);
    g.translate(-W / 2, -H / 2);
    if (slam < 0) {
      drawShards(g, t, 'chrome');
      embers(g, t);
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
    // White pop on the slam
    if (slam >= 0 && slam < 0.15) {
      g.fillStyle = `rgba(255,250,240,${0.55 * Math.exp(-slam / 0.035)})`;
      g.fillRect(0, 0, W, H);
    }
  },
  post(g, t, out) {
    if (t - T.SHATTER < 2 / 60) return;
    const s = t < T.SLAM ? 0.8 : 0.35 + 0.4 * Math.exp(-(t - T.SLAM) * 4);
    bloom(g, out, { strength: s, radius: 24, cut: t < T.SLAM ? 1.3 : 1.8, streak: t < T.SLAM ? 0.45 : 0.15 });
    vignette(g, 0.55, '0,0,0', 0.45);
    grain(g, t, 0.05);
  },
};
