// World 3: cut-paper stop-motion diorama. Layered paper with real drop shadows, shallow depth
// of field, a paper-puppet ball on a brass split pin, pop-up flowers and confetti. Shot on 12s.
import { W, H, T, R, FLOOR, CAM_Z, CAM_CY, camFrame, applyCam, physics, eventsOn, clamp, lerp, invLerp, ease, rng, shake, ball2D, TAU, noise1, wobble } from '../core.js';
import { plateY } from '../physics.js';
import { makeCanvas, freeCanvas, paperTexture, grain, vignette, ballShape } from '../fx.js';

const P = {
  sky: [150, 214, 232], sun: '#f6c445', sunIn: '#f9dc7a', ray: '#f29e4c',
  far: '#a4d094', mid: '#62b06c', near: '#3f9158', grass: '#52a862', soil: '#cf8a4a',
  ball: '#e4572e', ballD: '#b83a22', stripe: '#fff6e8', pin: '#c9a13b',
  confetti: ['#f28ca8', '#f6d55c', '#5bc0eb', '#fff6e8', '#9bc53d', '#e4572e'],
};
const LAYER_W = 3400;
let tex, sky, layers = [], ground, fg, texPattern;

function deckled(g, pts, rough, seed) {
  // Path along pts with a torn/deckled edge.
  const r = rng(seed);
  g.beginPath();
  pts.forEach(([x, y], i) => {
    const jx = x + (r() - 0.5) * rough, jy = y + (r() - 0.5) * rough;
    i ? g.lineTo(jx, jy) : g.moveTo(jx, jy);
  });
}

function textured(g, fill, alpha = 0.32) {
  g.fillStyle = fill;
  g.fill();
  g.save();
  g.clip();
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = alpha;
  g.fillStyle = texPattern(g);
  g.fillRect(-4000, -4000, 12000, 12000);
  g.restore();
}

function hillLayer(color, baseY, amp, seed, blur, shadow) {
  const c = makeCanvas(LAYER_W, H), g = c.getContext('2d'), r = rng(seed);
  const pts = [[-20, H + 20]];
  let x = -20;
  while (x < LAYER_W + 40) {
    const w = 300 + r() * 260, h = amp * (0.5 + r() * 0.7);
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      pts.push([x + u * w, baseY - Math.sin(u * Math.PI) ** 1.3 * h]);
    }
    x += w;
  }
  pts.push([LAYER_W + 40, H + 20]);
  g.save();
  g.shadowColor = 'rgba(40,50,30,0.35)';
  g.shadowBlur = shadow;
  g.shadowOffsetX = shadow * 0.3;
  g.shadowOffsetY = shadow * 0.45;
  deckled(g, pts, 2.2, seed + 1);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.restore();
  deckled(g, pts, 2.2, seed + 1);
  g.closePath();
  textured(g, color, 0.5);
  if (blur > 0) {
    const b = makeCanvas(LAYER_W, H), bg = b.getContext('2d');
    bg.filter = `blur(${blur}px)`;
    bg.drawImage(c, 0, 0);
    freeCanvas(c);
    return b;
  }
  return c;
}

function cloudShape(g, s) {
  g.beginPath();
  g.moveTo(-120 * s, 20 * s);
  g.bezierCurveTo(-150 * s, -30 * s, -80 * s, -60 * s, -50 * s, -40 * s);
  g.bezierCurveTo(-40 * s, -95 * s, 40 * s, -100 * s, 55 * s, -50 * s);
  g.bezierCurveTo(100 * s, -70 * s, 150 * s, -20 * s, 125 * s, 20 * s);
  g.closePath();
}

function flower(g, x, groundY, u, seed, t = 0) {
  // u: 0 folded flat → 1 fully popped (pop-up book hinge).
  if (u <= 0) return;
  const r = rng(seed);
  const h = (110 + r() * 70) * u;
  const col = P.confetti[Math.floor(r() * 3)];
  const lean = (r() - 0.5) * 0.3;
  g.save();
  g.translate(x, groundY);
  g.rotate(lean * u + Math.sin(t * 2.2 + seed) * 0.04 * u);
  g.scale(1, clamp(u * 1.15, 0, 1.15));
  g.shadowColor = 'rgba(30,40,20,0.35)';
  g.shadowBlur = 10; g.shadowOffsetX = 5; g.shadowOffsetY = 6;
  g.fillStyle = P.grass;
  g.fillRect(-5, -h, 10, h);
  g.beginPath(); g.ellipse(14, -h * 0.45, 20, 9, -0.6, 0, TAU); g.fill();
  g.translate(0, -h);
  for (let i = 0; i < 6; i++) {
    g.save();
    g.rotate((i / 6) * TAU);
    g.beginPath(); g.ellipse(0, -24, 13, 24, 0, 0, TAU);
    textured(g, col, 0.4);
    g.restore();
  }
  g.beginPath(); g.arc(0, 0, 13, 0, TAU);
  textured(g, P.sun, 0.4);
  g.restore();
}

function paperBall(g, b, x, y, spin) {
  const rx = R * b.along, ry = R * b.across;
  g.save();
  // Drop shadow onto the backdrop (the ball is a card standing in front of it).
  g.shadowColor = 'rgba(30,30,20,0.38)';
  g.shadowBlur = 18; g.shadowOffsetX = 12; g.shadowOffsetY = 16;
  g.beginPath(); ballShape(g, x, y, R, b);
  g.fillStyle = P.ball; g.fill();
  g.restore();
  g.save();
  g.beginPath(); ballShape(g, x, y, R, b);
  textured(g, P.ball, 0.55);
  g.clip();
  // Two stripes that turn with the ball, each a separate glued-on piece with a tiny shadow.
  g.translate(x, y);
  g.rotate(spin);
  for (const off of [-0.42, 0.42]) {
    g.save();
    g.shadowColor = 'rgba(60,20,10,0.35)'; g.shadowBlur = 4; g.shadowOffsetX = 2; g.shadowOffsetY = 3;
    g.beginPath();
    g.ellipse(off * R * 2.2, 0, R * 1.35, R * 1.6, 0, 0, TAU);
    g.ellipse(off * R * 2.2 - Math.sign(off) * R * 0.34, 0, R * 1.2, R * 1.6, 0, 0, TAU, true);
    g.fillStyle = P.stripe;
    g.fill('evenodd');
    g.restore();
  }
  g.restore();
  // Lighting: warm key from top-left, falloff to the lower right.
  g.save();
  g.beginPath(); ballShape(g, x, y, R, b);
  g.clip();
  const lg = g.createRadialGradient(x - R * 0.45, y - R * 0.5, R * 0.1, x, y, R * 1.3);
  lg.addColorStop(0, 'rgba(255,240,210,0.35)');
  lg.addColorStop(0.55, 'rgba(255,240,210,0)');
  lg.addColorStop(1, 'rgba(60,10,0,0.35)');
  g.fillStyle = lg;
  g.fillRect(x - 200, y - 200, 400, 400);
  g.restore();
  // Brass split pin
  g.save();
  const pg = g.createRadialGradient(x - 3, y - 3, 1, x, y, 11);
  pg.addColorStop(0, '#fff2bf'); pg.addColorStop(0.5, P.pin); pg.addColorStop(1, '#7d5f1b');
  g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 4; g.shadowOffsetX = 2; g.shadowOffsetY = 2;
  g.fillStyle = pg;
  g.beginPath(); g.arc(x, y, 10, 0, TAU); g.fill();
  g.restore();
}

function confetti(g, x, y, d, seed, n = 34) {
  if (d < 0 || d > 1.3) return;
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.2;
    const sp = 700 + r() * 800;
    const drag = 3.2;
    const k = (1 - Math.exp(-drag * d)) / drag;
    const px = x + Math.cos(a) * sp * k + Math.sin(d * 6 + i) * 20 * d;
    const py = y + Math.sin(a) * sp * k + 260 * d * d * 1.4;
    const flip = Math.cos(d * (8 + r() * 10) + i);
    const w = 16 + r() * 14, h = 10 + r() * 8;
    g.save();
    g.translate(px, py);
    g.rotate(d * (4 + r() * 6) * (r() < 0.5 ? -1 : 1) + i);
    g.scale(flip, 1);
    g.shadowColor = 'rgba(30,30,20,0.3)'; g.shadowBlur = 5; g.shadowOffsetX = 4; g.shadowOffsetY = 6;
    g.fillStyle = P.confetti[i % P.confetti.length];
    if (i % 3 === 0) { g.beginPath(); g.moveTo(-w / 2, h / 2); g.lineTo(0, -h / 2); g.lineTo(w / 2, h / 2); g.fill(); }
    else g.fillRect(-w / 2, -h / 2, w, h);
    g.restore();
  }
}

// Pop-up launcher: an accordion-folded paper spring in a slot, under a card platform.
function paperLauncher(g, t) {
  const pl = physics().run.plates.P2;
  const x = pl.x, y = plateY(1, t);
  const pitBot = FLOOR + 110, hw = 96;
  g.save();
  g.fillStyle = '#6b4424';
  g.fillRect(x - hw, FLOOR - 2, hw * 2, pitBot - FLOOR);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(x - hw, FLOOR - 2, hw * 2, 18);
  const top = y + 14, n = 7, w = 70;
  const since = pl.stoppedAt ? t - pl.stoppedAt : -1;
  const sway = since >= 0 ? 12 * wobble(since, 7, 4.5) : 0;
  for (let i = 0; i < n; i++) {
    const y0 = lerp(pitBot, top, i / n), y1 = lerp(pitBot, top, (i + 1) / n);
    const o0 = sway * Math.sin((i / n) * Math.PI), o1 = sway * Math.sin(((i + 1) / n) * Math.PI);
    const k0 = i % 2 ? 1 : -1;
    g.beginPath();
    g.moveTo(x - w + o0 + k0 * 10, y0); g.lineTo(x + w + o0 + k0 * 10, y0);
    g.lineTo(x + w + o1 - k0 * 10, y1); g.lineTo(x - w + o1 - k0 * 10, y1);
    g.closePath();
    textured(g, i % 2 ? '#e9d8b4' : '#cdb88f', 0.4);
  }
  g.shadowColor = 'rgba(30,30,20,0.4)'; g.shadowBlur = 12; g.shadowOffsetX = 6; g.shadowOffsetY = 8;
  g.beginPath(); g.roundRect(x - 92, y, 184, 16, 3);
  textured(g, '#f6d55c', 0.35);
  g.restore();
}

export default {
  async init() {
    tex = paperTexture(512, 512, 21, [236, 232, 222], { fibers: 900, blotch: 0.12, dark: 0.18, wrap: true });
    texPattern = (g) => g.createPattern(tex, 'repeat');
    // Sky backdrop
    sky = makeCanvas(W, H);
    const sg = sky.getContext('2d');
    sg.fillStyle = `rgb(${P.sky.join(',')})`;
    sg.fillRect(0, 0, W, H);
    sg.globalCompositeOperation = 'multiply';
    { const pt = paperTexture(W, H, 22, [255, 255, 255], { fibers: 1500, blotch: 0.1, dark: 0.12 }); sg.drawImage(pt, 0, 0); freeCanvas(pt); }
    sg.globalCompositeOperation = 'source-over';
    const lg = sg.createLinearGradient(0, 0, 0, H);
    lg.addColorStop(0, 'rgba(90,170,215,0.35)'); lg.addColorStop(0.55, 'rgba(255,255,255,0)'); lg.addColorStop(0.85, 'rgba(255,226,180,0.75)'); lg.addColorStop(1, 'rgba(255,214,160,0.9)');
    sg.fillStyle = lg; sg.fillRect(0, 0, W, H);
    layers = [
      { c: hillLayer(P.far, 760, 170, 31, 3.5, 14), par: 0.3 },
      { c: hillLayer(P.mid, 830, 150, 41, 2, 18), par: 0.55 },
      { c: hillLayer(P.near, 885, 110, 51, 0.8, 22), par: 0.8 },
    ];
    // Ground strip in world space: pinking-shears zigzag top edge.
    ground = makeCanvas(LAYER_W, 360);
    const gg = ground.getContext('2d');
    const zig = [];
    for (let x = -10; x <= LAYER_W + 10; x += 22) zig.push([x, 30 + ((x / 22) % 2 ? -9 : 9)]);
    gg.save();
    gg.shadowColor = 'rgba(30,40,20,0.4)'; gg.shadowBlur = 20; gg.shadowOffsetY = -6;
    gg.beginPath(); zig.forEach(([x, y], i) => (i ? gg.lineTo(x, y) : gg.moveTo(x, y)));
    gg.lineTo(LAYER_W + 10, 400); gg.lineTo(-10, 400); gg.closePath();
    gg.fillStyle = P.grass; gg.fill();
    gg.restore();
    gg.beginPath(); zig.forEach(([x, y], i) => (i ? gg.lineTo(x, y) : gg.moveTo(x, y)));
    gg.lineTo(LAYER_W + 10, 400); gg.lineTo(-10, 400); gg.closePath();
    textured(gg, P.grass, 0.5);
    gg.save();
    gg.shadowColor = 'rgba(30,40,20,0.35)'; gg.shadowBlur = 12; gg.shadowOffsetY = -4;
    deckled(gg, [[-10, 150], ...Array.from({ length: 60 }, (_, i) => [i * 60, 140 + Math.sin(i * 1.3) * 10]), [LAYER_W + 10, 150], [LAYER_W + 10, 400], [-10, 400]], 3, 61);
    gg.closePath();
    textured(gg, P.soil, 0.5);
    gg.restore();
    // Foreground grass blades (out of focus, in front of everything)
    fg = makeCanvas(LAYER_W, 420);
    const fgg = fg.getContext('2d'), fr = rng(71);
    for (let i = 0; i < 70; i++) {
      const x = fr() * LAYER_W;
      if ((x % 1400) > 300 && (x % 1400) < 1300) continue; // keep the middle clear
      const h = 100 + fr() * 160, w = 26 + fr() * 20, lean = (fr() - 0.5) * 120;
      fgg.beginPath();
      fgg.moveTo(x - w / 2, 430); fgg.quadraticCurveTo(x + lean * 0.3, 430 - h * 0.6, x + lean, 430 - h);
      fgg.quadraticCurveTo(x + lean * 0.3 + w * 0.2, 430 - h * 0.5, x + w / 2, 430);
      fgg.closePath();
      fgg.fillStyle = fr() < 0.5 ? '#3f7f4f' : '#4f9460';
      fgg.fill();
    }
    const fb = makeCanvas(LAYER_W, 420), fbg = fb.getContext('2d');
    fbg.filter = 'blur(7px)';
    fbg.drawImage(fg, 0, 0);
    freeCanvas(fg);
    fg = fb;
  },
  // Speed-adaptive motion blur: enough sub-frames that copies of the ball stay within ~5 px.
  shutter: (t) => { const b = ball2D(t); return { samples: Math.min(6, Math.max(2, Math.ceil(Math.hypot(b.vx, b.vy) * 0.0048 / 5) + 1)), angle: 180 }; },
  draw(g, t) {
    // Cut-paper pieces keep a faint hand-placed tremble (24 Hz, sub-pixel to 1 px); motion is smooth.
    const hi = Math.floor(t * 24 + 1e-6);
    const jit = (k, a = 1) => { const r = rng(hi * 97 + k * 13); return [(r() - 0.5) * a * 0.6, (r() - 0.5) * a * 0.6]; };
    const b = ball2D(t);
    const sk = shake(t, 14);
    const fr = camFrame(t);
    const cx = fr.x, z = fr.z;
    const land = eventsOn('paper')[0];
    const d1 = t - T.PAPER, d2 = t - land.t;

    g.drawImage(sky, 0, 0);
    g.save();
    const [sjx, sjy] = jit(1);
    g.translate(1480 - cx * 0.05 + sjx, 230 + sjy + fr.lift * 0.15);
    g.rotate(t * 0.6);
    g.shadowColor = 'rgba(120,80,20,0.35)'; g.shadowBlur = 16; g.shadowOffsetX = 8; g.shadowOffsetY = 10;
    for (let i = 0; i < 12; i++) {
      g.save(); g.rotate((i / 12) * TAU);
      g.beginPath(); g.moveTo(-22, -118); g.lineTo(0, -178); g.lineTo(22, -118); g.closePath();
      textured(g, P.ray, 0.45);
      g.restore();
    }
    g.beginPath(); g.arc(0, 0, 118, 0, TAU); textured(g, P.sun, 0.45);
    g.shadowColor = 'transparent';
    g.beginPath(); g.arc(-8, -8, 84, 0, TAU); textured(g, P.sunIn, 0.35);
    g.restore();
    const clouds = [[380, 250, 1.1, 0], [1060, 170, 0.8, 1], [1900, 280, 1.0, 2], [2500, 200, 0.9, 3], [3200, 230, 1.0, 4]];
    for (const [x0, y0, s2, k] of clouds) {
      const x = x0 - ((cx * 0.3 * z) % 2600) + 300;
      if (x < -300 || x > W + 300) continue;
      const sway = Math.sin(t * 2.4 + k * 1.7) * 0.05;
      g.save();
      g.translate(x, -20 + fr.lift * 0.3);
      g.rotate(sway);
      g.strokeStyle = 'rgba(80,80,80,0.5)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, -400); g.lineTo(0, y0 - 60 * s2 + 20); g.stroke();
      g.translate(0, y0 + 20);
      g.shadowColor = 'rgba(40,70,100,0.35)'; g.shadowBlur = 18; g.shadowOffsetX = 10; g.shadowOffsetY = 14;
      cloudShape(g, s2 * 1.3);
      textured(g, '#ffffff', 0.25);
      g.restore();
    }
    for (let i = 0; i < layers.length; i++) {
      const L = layers[i];
      const [jx, jy] = jit(10 + i, 1);
      const ox = -(cx * L.par * z) % (LAYER_W - W) - 200;
      g.drawImage(L.c, ox + jx, 60 + jy + sk.y * L.par + fr.lift * z * (0.3 + L.par * 0.7));
    }

    g.save();
    applyCam(g, cx, fr.y, z, sk);
    const [gjx, gjy] = jit(20, 1);
    const gx0 = Math.floor((cx - 1600) / 1000) * 1000;
    g.drawImage(ground, gx0 + gjx, FLOOR - 30 + gjy);
    g.drawImage(ground, gx0 + gjx + LAYER_W - 40, FLOOR - 30 + gjy);
    paperLauncher(g, t);
    const ix1 = physics().run.plates.P2.x, ix2 = land.x;
    const pop = (d, delay) => ease.outBack(clamp((d - delay) / 0.2), 2.4);
    [[-200, 0, 1], [180, 0.08, 2], [310, 0.16, 3]].forEach(([dx, dl, sd]) => flower(g, ix1 + dx, FLOOR + 6, pop(d1, dl), sd, t));
    [[-150, 0.04, 4], [210, 0.1, 5], [330, 0.15, 6]].forEach(([dx, dl, sd]) => flower(g, ix2 + dx, FLOOR + 6, pop(d2, dl), sd + 10, t));
    const hN = clamp(b.h / 600);
    const sg = g.createRadialGradient(b.cx + 10, FLOOR + 6, 0, b.cx + 10, FLOOR + 6, R * 1.4);
    sg.addColorStop(0, `rgba(20,40,20,${0.45 * (1 - hN * 0.7)})`);
    sg.addColorStop(1, 'rgba(20,40,20,0)');
    g.fillStyle = sg;
    g.beginPath(); g.ellipse(b.cx + 10, FLOOR + 6, R * (1.4 - 0.5 * hN), 20, 0, 0, TAU); g.fill();

    const [bjx, bjy] = jit(30, 1);
    paperBall(g, b, b.cx + bjx, b.cy + bjy, b.spin);
    confetti(g, ix1, FLOOR - 40, d1, 5);
    confetti(g, ix2, FLOOR - 20, d2, 6, 18);
    g.restore();
    const fx = -(cx * 1.3 * z) % 1000 - 1000;
    g.drawImage(fg, fx, H - 250 + sk.y * 1.3);
    vignette(g, 0.3, '40,30,20', 0.5);
    grain(g, t, 0.05);
  },
};
