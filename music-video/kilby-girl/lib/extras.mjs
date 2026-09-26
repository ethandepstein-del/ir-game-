// Photos, confetti, big type, and the small props that live inside the photos.
import { blob, capsule, circle, curve, ellipse, line, poly, rect, roundRect, star } from './shapes.mjs';
import { backOut, clamp, easeOut, hash, hs, lerp, rng, TAU } from './util.mjs';
import { K, W, H } from './world.mjs';

// instant photo: content(P) draws a full 1920x1080 frame that is fitted into the print window.
// dev < 1 leaves the image partially undeveloped (fades back to bare paper).
export function photo(P, cx, cy, w, rot, content, { dev = 1, shadow = true, border = 0.06, bottom = 0.2, tint = null, pin = false, caption = null } = {}) {
  const iw = w * (1 - border * 2), ih = iw * (H / W);
  const h = ih + w * border + w * bottom;
  P.save();
  P.translate(cx, cy);
  P.rotate(rot);
  if (shadow) P.fill(rect(-w / 2 + 14, -h / 2 + 18, w, h), [0, 0.35, 0.55]);
  P.fill(rect(-w / 2, -h / 2, w, h), tint || K.paper);
  const x0 = -iw / 2, y0 = -h / 2 + w * border;
  P.save();
  P.clip(rect(x0, y0, iw, ih));
  P.translate(x0, y0);
  P.scale(iw / W);
  content(P);
  P.restore();
  if (dev < 1) P.alpha(1 - clamp(dev)).fill(rect(x0, y0, iw, ih), K.paper).alpha(1);
  if (caption) caption(P, x0 + w * 0.01, y0 + ih + w * 0.105, iw);
  if (pin) P.fill(circle(0, -h / 2 + 12, 10), K.red);
  P.restore();
  return h;
}

export function confetti(P, t, { n = 60, seed = 1, t0 = 0, x0 = 0, x1 = W, y0 = -100, speed = 260, burst = null } = {}) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = r(), b = r(), c = r(), d = r(), e = r();
    const lt = t - t0 - a * 1.2;
    if (lt < 0) continue;
    let x, y;
    if (burst) {
      const ang = b * TAU, v = 500 + c * 900;
      x = burst[0] + Math.cos(ang) * v * (1 - Math.exp(-lt * 2.2)) / 2.2 + Math.sin(lt * 3 + i) * 20;
      y = burst[1] + Math.sin(ang) * v * (1 - Math.exp(-lt * 2.2)) / 2.2 + lt * lt * 90;
    } else {
      x = lerp(x0, x1, b) + Math.sin(lt * (1.5 + c * 2) + i) * 40;
      y = y0 + lt * speed * (0.7 + c * 0.6);
    }
    if (y > H + 60) continue;
    const rot = lt * (2 + d * 5) + i;
    const inks = [[1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [0, 0, 0]][Math.floor(e * 5)];
    P.save();
    P.translate(x, y);
    P.rotate(rot);
    P.scale(1, Math.abs(Math.cos(lt * 4 + i)) * 0.8 + 0.2);
    if (i % 3 === 0) P.fill(star(0, 0, 18, 8), inks);
    else P.fill(rect(-14, -7, 28, 14), inks);
    P.restore();
  }
}

// chunky poster type with a misregistered second ink
export function bigType(P, str, x, y, size, inks, { font = 'Anton', shadow = null, off = [10, 8], rot = 0, spacing = 0, knock = true, align = 'center' } = {}) {
  P.save();
  P.translate(x, y);
  P.rotate(rot);
  if (shadow) P.text(str, off[0], off[1], `${size}px ${font}`, shadow, { spacing, align });
  P.text(str, 0, 0, `${size}px ${font}`, knock ? inks.map((v) => v ?? 0) : inks, { spacing, align });
  P.restore();
}

export function marquee(P, y, str, size, offset, inks, { font = 'Anton', band = null, h = null, gap = 60 } = {}) {
  const w = P.measure(str, `${size}px ${font}`) + gap;
  if (band) P.fill(rect(-50, y - (h || size) * 0.9, W + 100, (h || size) * 1.15), band);
  let x = -((offset % w) + w) % w - w;
  while (x < W + w) {
    P.text(str, x, y, `${size}px ${font}`, inks, { align: 'left' });
    x += w;
  }
}

// hand-lettered sound effect
export function sfx(P, str, x, y, size, rot, inks = K.red, outline = K.paper) {
  P.save();
  P.translate(x, y);
  P.rotate(rot);
  for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4], [3, 3], [-3, -3], [3, -3], [-3, 3]]) P.text(str, dx, dy, `${size}px "Permanent Marker"`, outline);
  P.text(str, 0, 0, `${size}px "Permanent Marker"`, inks);
  P.restore();
}

// ---------------------------------------------------------------- photo subjects
export function handX(P, cx, cy, s, inks = K.skin) {
  P.save();
  P.translate(cx, cy);
  P.scale(s);
  P.fill(capsule(0, 520, 0, 150, 190, 170), [0, 0.25, 0.9]);
  P.fill(roundRect(-150, -170, 300, 340, 120), inks);
  for (let i = 0; i < 4; i++) P.fill(capsule(-105 + i * 70, -150, -115 + i * 76, -420 + Math.abs(i - 1.5) * 50, 62), inks);
  P.fill(capsule(140, 40, 290, -120, 70), inks);
  P.stroke(line([[-80, -80], [80, 80]]), K.ink, 34);
  P.stroke(line([[80, -80], [-80, 80]]), K.ink, 34);
  P.restore();
}

export function cat(P, x, y, s, blink = 0) {
  P.save();
  P.translate(x, y);
  P.scale(s);
  P.fill(ellipse(0, 0, 150, 110), K.ink);
  P.fill(circle(-110, -110, 80), K.ink);
  P.fill(poly([[-175, -150], [-165, -240], [-120, -175]]), K.ink);
  P.fill(poly([[-100, -180], [-50, -235], [-50, -150]]), K.ink);
  P.stroke(curve([[130, 40], [230, 0], [250, -120], [210, -200]], false), K.ink, 34);
  if (blink < 0.5) {
    P.fill(ellipse(-140, -115, 18, 22), K.yellow);
    P.fill(ellipse(-85, -115, 18, 22), K.yellow);
    P.fill(ellipse(-140, -115, 5, 18), K.ink);
    P.fill(ellipse(-85, -115, 5, 18), K.ink);
  } else {
    P.stroke(line([[-158, -112], [-122, -112]]), K.yellow, 6);
    P.stroke(line([[-103, -112], [-67, -112]]), K.yellow, 6);
  }
  P.restore();
}

export function moth(P, x, y, s, flap) {
  P.save();
  P.translate(x, y);
  P.scale(s);
  const f = 0.35 + Math.abs(Math.sin(flap)) * 0.65;
  for (const sd of [-1, 1]) {
    P.fill(ellipse(sd * 28 * f, -8, 30 * f, 22, sd * 0.4), [0.2, 0.3, 0.35]);
    P.fill(ellipse(sd * 22 * f, 18, 20 * f, 14, -sd * 0.4), [0.2, 0.3, 0.35]);
  }
  P.fill(ellipse(0, 4, 6, 22), K.ink);
  P.restore();
}

export function cassette(P, x, y, s, rot, label = 'KILBY GIRL', spin = 0) {
  P.save();
  P.translate(x, y);
  P.rotate(rot);
  P.scale(s);
  P.fill(roundRect(-400, -250, 800, 500, 30), K.ink);
  P.fill(roundRect(-360, -220, 720, 280, 16), [0.9, 0.05, 0]);
  P.fill(rect(-360, -120, 720, 40), [0, 1, 0]);
  P.text(label, 0, -150, '86px "Permanent Marker"', K.navy);
  P.fill(roundRect(-230, -70, 460, 120, 60), K.paper);
  for (const sx of [-1, 1]) {
    P.fill(circle(sx * 150, -10, 48), K.ink);
    P.save();
    P.translate(sx * 150, -10);
    P.rotate(spin);
    for (let i = 0; i < 6; i++) { P.rotate(TAU / 6); P.fill(rect(-7, -44, 14, 20), K.paper); }
    P.restore();
  }
  P.fill(poly([[-260, 250], [-220, 140], [220, 140], [260, 250]]), [0, 0.6, 0.8]);
  P.restore();
}

export function boots(P, x, y, s) {
  P.save();
  P.translate(x, y);
  P.scale(s);
  for (const [dx, rot] of [[-220, -0.12], [200, 0.1]]) {
    P.save();
    P.translate(dx, 0);
    P.rotate(rot);
    P.fill(capsule(0, -600, 0, -170, 210, 200), K.denim);
    P.fill(curve([[-120, -260], [110, -260], [130, -80], [320, -40], [340, 40], [-130, 40]], true, 0.35), K.ink);
    P.fill(rect(-130, 20, 470, 26), [0.2, 0.45, 0.5]);
    for (let k = 0; k < 4; k++) P.stroke(line([[-40, -220 + k * 40], [40, -200 + k * 40]]), K.yellow, 8);
    P.restore();
  }
  P.restore();
}

export function bulb(P, x, y, len, swing, level, { size = 1 } = {}) {
  const bx = x + Math.sin(swing) * len, by = y + Math.cos(swing) * len;
  P.stroke(line([[x, y], [bx, by]]), K.ink, 5);
  if (level > 0.02) {
    P.glow(bx, by + 30 * size, 560 * size * (0.6 + 0.4 * level), [0, 0.95 * level, 1 * level], 'destination-out');
    P.glow(bx, by + 30 * size, 420 * size * (0.5 + 0.5 * level), [0.75 * level, 0.18 * level, 0]);
  }
  P.fill(rect(bx - 14 * size, by, 28 * size, 26 * size), K.ink);
  P.fill(ellipse(bx, by + 50 * size, 30 * size, 38 * size), level > 0.05 ? [1, 0.08, 0] : [0.15, 0.45, 0.6]);
  return [bx, by + 50 * size];
}

// overhead view of a circle pit: runners loop the ring, a wall of people stands around it
// `turn` is the ring's rotation (radians), so the scene can lock the running to the bar; `floor`
// draws on the floor under everyone (painted lyrics)
export function pit(P, t, { n = 22, seed = 5, turn = null, speed = 0.5, girl = 3, bounce = 0, bf = 0, floor = null } = {}) {
  P.fill(rect(-100, -100, W + 200, H + 200), [0.1, 0.5, 0.72]);
  for (let i = 0; i < 9; i++) P.fill(rect(-100, 40 + i * 130, W + 200, 5), [0.1, 0.7, 0.88]);
  if (floor) floor(P);
  const rot = turn ?? t * speed;
  const cx = W / 2, cy = H / 2 + 20;
  const r = rng(seed);
  const top = (x, y, dir, s, hair, body, style) => {
    P.save();
    P.translate(x, y);
    P.rotate(dir);
    P.scale(s);
    P.fill(ellipse(-6, 0, 34, 66), body);
    P.fill(circle(14, -58, 17), body);
    P.fill(circle(14, 58, 17), body);
    if (style === 1) P.fill(circle(-40, 0, 16), hair); // ponytail
    P.fill(circle(2, 0, 36), hair);
    if (style === 2) P.fill(ellipse(34, 0, 16, 30), hair); // cap brim
    P.restore();
  };
  // standing wall around the pit
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * TAU + hs(seed, i) * 0.05;
    const rr = 1 + hash(seed, i, 2) * 0.08;
    const x = cx + Math.cos(a) * 900 * rr, y = cy + Math.sin(a) * 500 * rr;
    const b = 1 + bounce * 0.06 * Math.abs(Math.sin(rot * 6 + i));
    top(x, y, a + Math.PI, 1.3 * b, [[0, 1, 1], [0.35, 1, 1], [0, 0.7, 1]][i % 3], [0, 0.85, 1], i % 3);
  }
  const people = [];
  for (let i = 0; i < n; i++) {
    const ring = 0.2 + r() * 0.8;
    const a0 = r() * TAU;
    const w = speed * (1.25 - ring * 0.5) * (0.85 + r() * 0.3);
    const rad = 300 + ring * 300;
    const a = a0 + rot * w / speed;
    people.push({ x: cx + Math.cos(a) * rad * 1.35, y: cy + Math.sin(a) * rad * 0.72, a, i, hair: Math.floor(r() * 5), s: 1.4 + r() * 0.3, style: Math.floor(r() * 3) });
  }
  people.sort((p, q) => p.y - q.y);
  for (const p of people) {
    const b = 1 + bounce * 0.08 * Math.abs(Math.sin(rot * 9 + p.i));
    const dir = p.a + Math.PI / 2;
    const isG = p.i === girl;
    // motion streaks
    for (const off of [-30, 30]) {
      const ox = -Math.sin(dir) * off, oy = Math.cos(dir) * off;
      P.stroke(line([[p.x + ox - Math.cos(dir) * 100, p.y + oy - Math.sin(dir) * 100], [p.x + ox - Math.cos(dir) * 210, p.y + oy - Math.sin(dir) * 210]]), K.paper, 6);
    }
    const hair = isG ? K.hair : [[0, 1, 1], [1, 0.6, 0], [0.35, 1, 1], [0, 0.35, 1], [0.55, 0.12, 0]][p.hair];
    top(p.x, p.y, dir, p.s * b, hair, isG ? [1, 0.06, 0] : K.navy, isG ? 0 : p.style);
    if (isG) P.fill(rect(p.x - 8, p.y - 30, 16, 30), K.yellow);
  }
}

export function comet(P, x, y, ang, len, level) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  P.glow(x, y, 180 * level, [0, 0.9, 1], 'destination-out');
  P.glow(x, y, 120 * level, [0.8, 0.3, 0]);
  for (let k = 0; k < 3; k++) {
    const w = (30 - k * 9) * level;
    P.stroke(line([[x, y], [x - dx * len * (1 - k * 0.2), y - dy * len * (1 - k * 0.2)]]), [[1, 0.2, 0], [0, 0, 0], [1, 0, 0]][k], w);
  }
  P.fill(star(x, y, 46 * level, 16 * level, 4, ang), K.paper);
}

// A firework shell. The rocket rises for `rise` seconds and bursts exactly at t0 (so bursts can sit on
// beats); stars fly out with drag and gravity, drawing tapered trails, then twinkle and crackle out.
export function shell(P, t, { t0, x, y, seed = 1, inks = [1, 0, 0], inks2 = null, n = 72, R = 480, rise = 0.6, life = 2.4, lx = null, kind = 'peony' }) {
  const lt = t - t0;
  if (lt < -rise || lt > life) return;
  const r = rng(seed);
  const launchX = lx ?? x + (r() - 0.5) * 240;
  if (lt < 0) {
    const k = 1 + lt / rise;
    const at = (kk) => {
      const e = 1 - (1 - clamp(kk)) ** 2;
      return [lerp(launchX, x, e) + Math.sin(kk * 18 + seed) * 6 * (1 - kk), lerp(H + 60, y, e)];
    };
    for (let j = 7; j >= 0; j--) {
      const [px, py] = at(k - j * 0.03);
      P.fill(circle(px, py, 7 - j * 0.8), j < 2 ? K.paper : [1, 0.35 * (j / 7), 0]);
    }
    return;
  }
  // burst flash lifts the night off the sky
  if (lt < 0.35) {
    const f = 1 - lt / 0.35;
    P.glow(x, y, 180 + 320 * f, [0, 0.9 * f, 1 * f], 'knock', 0.25);
    P.glow(x, y, 90 + 160 * f, [0.9 * f, 0.25 * f, 0], 'lighter', 0.2);
  }
  const willow = kind === 'willow';
  const drag = willow ? 1.6 : 2.6, g = willow ? 260 : 150;
  const pos = (vx, vy, tt) => {
    const k = (1 - Math.exp(-drag * tt)) / drag;
    return [x + vx * k, y + vy * k + 0.5 * g * tt * tt];
  };
  const fade = clamp(1 - (lt - life * 0.5) / (life * 0.5));
  const trailLen = willow ? 12 : 7, dt = willow ? 0.05 : 0.03;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r() * 0.12;
    const sp = R * drag * (kind === 'ring' ? 1 : 0.7 + r() * 0.45);
    const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp * (kind === 'ring' ? 0.55 : 1);
    const col = inks2 && i % 2 ? inks2 : inks;
    let prev = pos(vx, vy, lt);
    for (let j = 1; j <= trailLen; j++) {
      const tt = lt - j * dt;
      if (tt < 0) break;
      const p = pos(vx, vy, tt);
      const w = (willow ? 6 : 8) * (1 - j / (trailLen + 1)) * (0.4 + 0.6 * fade);
      if (w > 0.4) P.stroke(line([prev, p]), col, w);
      prev = p;
    }
    const [hx, hy] = pos(vx, vy, lt);
    const twinkleOff = lt > life * 0.45 && hash(seed, i, Math.floor(lt * 18)) > 0.55;
    if (!twinkleOff && fade > 0.05) {
      P.fill(circle(hx, hy, 6.5 * fade + 1.5), K.paper);
      if (lt < 0.6) P.glow(hx, hy, 26, col.map((v) => v * 0.6), 'lighter');
    }
    // crackle: stars split into flickering sparks near the end
    if ((kind === 'crackle' || kind === 'peony') && lt > life * 0.55 && hash(seed, i, 9) > (kind === 'crackle' ? 0.2 : 0.7)) {
      for (let s = 0; s < 4; s++) {
        if (hash(seed, i, s, Math.floor(lt * 24)) < 0.5) continue;
        const ox = hs(seed, i, s, 1) * 34 * (lt - life * 0.55) * 2, oy = hs(seed, i, s, 2) * 34 * (lt - life * 0.55) * 2;
        P.fill(star(hx + ox, hy + oy, 7, 2.5, 4, hash(i, s) * 3), K.paper);
      }
    }
  }
}

// kept for older call sites: a single peony at (x, y) bursting at lt = 0
export function firework(P, x, y, lt, seed, inks = [1, 0, 0]) {
  shell(P, lt, { t0: 0, x, y, seed, inks, rise: 0.001 });
}

// a wrecked teenage bedroom: unmade bed, flyers on the wall, clothes everywhere (for the zine)
export function bedroom(P, t, { lamp = 1 } = {}) {
  P.fill(rect(-100, -100, W + 200, H + 200), [0.1, 0.55, 0.05]);
  // window with the night outside
  P.fill(rect(1180, 120, 520, 420), K.ink);
  P.fill(rect(1200, 140, 480, 380), [0, 0.6, 1]);
  P.fill(circle(1580, 230, 46), [0.12, 0, 0]);
  for (let i = 0; i < 12; i++) P.fill(circle(1220 + hash(i, 1) * 440, 160 + hash(i, 2) * 300, 3), K.paper);
  P.fill(rect(1436, 140, 10, 380), K.ink);
  P.fill(rect(1200, 326, 480, 10), K.ink);
  // flyers taped up
  const fl = [[260, 200, 200, 260, -0.06, [1, 0, 0]], [520, 160, 170, 230, 0.05, [0, 0, 0.9]], [760, 230, 190, 250, -0.03, [0, 1, 0]], [980, 170, 150, 200, 0.08, [1, 1, 0]]];
  for (const [x, y, w, h, r, ink] of fl) {
    P.save(); P.translate(x, y); P.rotate(r);
    P.fill(rect(-w / 2, -h / 2, w, h), ink);
    P.fill(circle(0, -h * 0.1, w * 0.28), K.paper);
    P.fill(rect(-w * 0.35, h * 0.28, w * 0.7, 10), K.paper);
    P.fill(rect(-18, -h / 2 - 10, 36, 18), [0.25, 0.18, 0.05]);
    P.restore();
  }
  // floor
  P.fill(rect(-100, 780, W + 200, 400), [0.4, 0.55, 0.3]);
  for (let i = 0; i < 6; i++) P.fill(rect(-100, 800 + i * 60, W + 200, 4), [0.5, 0.7, 0.4]);
  // bed with a rumpled blanket and two pillows
  P.fill(rect(120, 560, 980, 300), K.ink);
  P.fill(roundRect(90, 420, 60, 460, 12), K.ink);
  P.fill(roundRect(160, 520, 250, 110, 40), K.paper);
  P.fill(curve([[180, 640], [360, 590], [520, 650], [700, 580], [900, 640], [1100, 610], [1110, 820], [170, 830]], true, 0.5), [0, 1, 0.1]);
  for (let i = 0; i < 5; i++) P.stroke(curve([[260 + i * 160, 660], [320 + i * 160, 700], [300 + i * 160, 790]], false), [0.1, 1, 0.5], 6);
  // guitar on a stand, clothes piles, a lamp
  P.save(); P.translate(1300, 760); P.rotate(-0.12);
  P.fill(rect(-8, -420, 16, 300), [0.5, 0.5, 0.15]);
  P.fill(curve([[-80, -60], [-70, -170], [-20, -200], [0, -150], [30, -200], [80, -170], [90, -60], [40, 10], [-30, 10]], true, 0.5), [0.72, 0.34, 0.04]);
  P.fill(circle(5, -110, 22), K.ink);
  P.restore();
  for (const [x, y, ink] of [[620, 880, [1, 0.1, 0]], [760, 900, [0, 0.2, 0.9]], [1520, 880, [0, 0, 0]], [1640, 910, [1, 1, 0]]]) {
    P.fill(curve([[x - 110, y + 40], [x - 70, y - 30], [x, y - 50], [x + 80, y - 20], [x + 120, y + 40]], true, 0.5), ink);
  }
  P.fill(rect(1760, 520, 16, 300), K.ink);
  P.fill(poly([[1710, 520], [1830, 520], [1800, 440], [1740, 440]]), [1, 0.1, 0]);
  if (lamp > 0) {
    P.glow(1768, 560, 330, [0, 0.6 * lamp, 0.4 * lamp], 'knock', 0.3);
    P.glow(1768, 560, 220, [0.6 * lamp, 0, 0], 'lighter', 0.3);
  }
}
