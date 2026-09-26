// Photos, confetti, big type, and the small props that live inside the photos.
import { blob, capsule, circle, curve, ellipse, line, poly, rect, roundRect, star } from './shapes.mjs';
import { backOut, clamp, easeOut, hash, hs, lerp, rng, TAU } from './util.mjs';
import { K, W, H } from './world.mjs';

// instant photo: content(P) draws a full 1920x1080 frame that is fitted into the print window.
// dev < 1 leaves the image partially undeveloped (fades back to bare paper).
export function photo(P, cx, cy, w, rot, content, { dev = 1, shadow = true, border = 0.06, bottom = 0.2, tint = null, pin = false } = {}) {
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
export function pit(P, t, { n = 22, seed = 5, speed = 0.5, girl = 3, bounce = 0, bf = 0 } = {}) {
  P.fill(rect(-100, -100, W + 200, H + 200), [0.1, 0.5, 0.72]);
  for (let i = 0; i < 9; i++) P.fill(rect(-100, 40 + i * 130, W + 200, 5), [0.1, 0.7, 0.88]);
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
    const b = 1 + bounce * 0.06 * Math.abs(Math.sin(t * 9 + i));
    top(x, y, a + Math.PI, 1.3 * b, [[0, 1, 1], [0.35, 1, 1], [0, 0.7, 1]][i % 3], [0, 0.85, 1], i % 3);
  }
  const people = [];
  for (let i = 0; i < n; i++) {
    const ring = 0.2 + r() * 0.8;
    const a0 = r() * TAU;
    const w = speed * (1.25 - ring * 0.5) * (0.85 + r() * 0.3);
    const rad = 300 + ring * 300;
    const a = a0 + t * w;
    people.push({ x: cx + Math.cos(a) * rad * 1.35, y: cy + Math.sin(a) * rad * 0.72, a, i, hair: Math.floor(r() * 5), s: 1.4 + r() * 0.3, style: Math.floor(r() * 3) });
  }
  people.sort((p, q) => p.y - q.y);
  for (const p of people) {
    const b = 1 + bounce * 0.08 * Math.abs(Math.sin(t * 9 + p.i));
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

export function firework(P, x, y, lt, seed, inks = [1, 0, 0]) {
  if (lt < 0 || lt > 2.2) return;
  const r = rng(seed);
  const R = 520 * easeOut(clamp(lt / 1.2));
  const fade = clamp(1 - (lt - 1.1) / 1.1);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU + r() * 0.1;
    const rr = R * (0.8 + r() * 0.3);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr + lt * lt * 40;
    P.stroke(line([[x + Math.cos(a) * rr * 0.6, y + Math.sin(a) * rr * 0.6 + lt * lt * 30], [px, py]]), inks, 10 * fade);
    P.fill(star(px, py, 22 * fade, 8 * fade, 4, a), K.paper);
  }
}
