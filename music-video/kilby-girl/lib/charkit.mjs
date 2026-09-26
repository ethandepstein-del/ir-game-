// Shared character kit for lib/band.mjs and lib/people.mjs: ink helpers, two-bone IK, hands,
// eyes, brows, mouths (visemes) and the timing curves the performance rigs use.
// Every function is pure: same inputs, same drawing, so any frame renders on its own.
import { Path2D } from './ink.mjs';
import { capsule, circle, curve, ellipse, line, poly, roundRect } from './shapes.mjs';
import { clamp, lerp } from './util.mjs';

// ---------------------------------------------------------------- inks
export const add = (a, b) => a.map((v, i) => clamp(v + (b[i] ?? 0)));
export const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
export const deepen = (a, k = 0.2) => [clamp(a[0] + k * 0.45), clamp(a[1] + k), clamp(a[2] + k)];
export const lighten = (a, k = 0.3) => a.map((v) => clamp(v * (1 - k)));

export const INK = {
  eye: [0.12, 1, 1],
  line: [0.32, 0.92, 0.85], // dark feature line (male mouths, lids)
  mouth: [0.36, 1, 0.9], // mouth interior
  tongue: [0.16, 0.72, 0.25],
  teeth: [0, 0, 0.03],
  gold: [0.95, 0.32, 0.02],
  goldHi: [0.35, 0.05, 0],
  wood: [0.62, 0.42, 0.12],
  stickTip: [0.3, 0.2, 0.05],
};

// ---------------------------------------------------------------- timing curves
// alpha pulse: 0 at t=0, peaks at 1 when t = peak, decays after
export const alpha = (t, peak) => (t <= 0 ? 0 : (t / peak) * Math.exp(1 - t / peak));
// damped spring impulse response (secondary motion): starts at 0, overshoots, settles
export const spring = (t, freq = 3, damp = 5) => (t <= 0 ? 0 : Math.exp(-damp * t) * Math.sin(Math.PI * 2 * freq * t));
export const ease = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeOutQ = (t) => { t = clamp(t); return 1 - (1 - t) * (1 - t); };
export const easeInQ = (t) => { t = clamp(t); return t * t; };

// the number a pose field holds, or its default; accepts numbers only (NaN and undefined -> default)
export const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

// secondary motion: how far a follower lags its driver. cur/lag are the driver's value now and a few
// frames ago; k scales the drag. Returns (lag - cur) * k, i.e. hair/cloth trailing the motion.
export const drag = (cur, lag, k = 1) => (lag == null ? 0 : (lag - cur) * k);

// ---------------------------------------------------------------- geometry
// two-bone IK: elbow/knee position for a limb from a (root) to h (end). bend = +1/-1 picks the side.
export function ik(ax, ay, hx, hy, l1, l2, bend = 1) {
  const dx = hx - ax, dy = hy - ay;
  const d = Math.max(1e-3, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.5));
  const a = Math.atan2(dy, dx);
  const c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const b = Math.acos(c) * bend;
  return [ax + Math.cos(a + b) * l1, ay + Math.sin(a + b) * l1];
}

// tapered limb segment with rounded ends
export const seg = (P, a, b, wa, wb, ink) => P.fill(capsule(a[0], a[1], b[0], b[1], wa, wb), ink);

export const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
export const v2add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
export const v2lerp = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export const norm3 = ([x, y, z]) => { const L = Math.hypot(x, y, z) || 1; return [x / L, y / L, z / L]; };

// ---------------------------------------------------------------- hands
// Fist gripping a stick/strap that runs along angle `ang` (radians). r ~ hand half-size.
// knuckleSide +1/-1 picks which side of the grip the knuckles face (the thumb sits opposite).
export function fist(P, x, y, ang, r, skin, shade, { knuckleSide = 1, thumb = true, detail = true } = {}) {
  P.save();
  P.translate(x, y);
  P.rotate(ang);
  const k = knuckleSide;
  // palm block: slightly longer along the grip than across it
  P.fill(roundRect(-r * 1.0, -r * 0.95, r * 2.0, r * 1.9, r * 0.75), skin);
  // curled fingers: a row of rounded knuckles on one side
  P.fill(roundRect(-r * 0.95, k > 0 ? r * 0.15 : -r * 1.15, r * 1.9, r * 1.0, r * 0.5), shade);
  P.fill(roundRect(-r * 0.92, k > 0 ? r * 0.05 : -r * 1.05, r * 1.84, r * 0.9, r * 0.45), skin);
  if (detail) for (let i = 1; i < 4; i++) {
    const fx = -r * 0.95 + (i * r * 1.9) / 4;
    P.stroke(line([[fx, k > 0 ? r * 0.35 : -r * 0.35], [fx, k > 0 ? r * 0.9 : -r * 0.9]]), shade, Math.max(1.2, r * 0.13));
  }
  if (thumb) P.fill(capsule(-r * 0.7, -k * r * 0.62, r * 0.55, -k * r * 0.72, r * 0.62, r * 0.5), skin);
  if (thumb && detail) P.stroke(curve([[-r * 0.6, -k * r * 0.2], [r * 0.1, -k * r * 0.28], [r * 0.7, -k * r * 0.5]], false), shade, Math.max(1.2, r * 0.12));
  P.restore();
}

// open/relaxed hand: palm + four fingers + thumb; ang = direction the fingers point
export function hand(P, x, y, ang, r, skin, shade, { spread = 0.4, curl = 0, thumbSide = 1, point = false } = {}) {
  P.save();
  P.translate(x, y);
  P.rotate(ang);
  P.fill(roundRect(-r * 0.9, -r * 0.85, r * 1.5, r * 1.7, r * 0.6), skin);
  for (let i = 0; i < 4; i++) {
    const oy = (-0.62 + i * 0.41) * r;
    const a = (i - 1.5) * spread * 0.18;
    const len = r * (i === 0 || i === 3 ? 1.05 : 1.25) * (1 - curl * 0.55) * (point && i > 0 ? 0.55 : 1);
    const ex = r * 0.5 + Math.cos(a) * len, ey = oy + Math.sin(a) * len;
    P.fill(capsule(r * 0.4, oy, ex, ey, r * 0.42, r * 0.36), skin);
  }
  P.stroke(line([[r * 0.35, -r * 0.2], [r * 0.6, -r * 0.2]]), shade, Math.max(1, r * 0.1));
  P.stroke(line([[r * 0.35, r * 0.2], [r * 0.6, r * 0.2]]), shade, Math.max(1, r * 0.1));
  P.fill(capsule(-r * 0.3, thumbSide * r * 0.7, r * 0.45, thumbSide * r * 1.25, r * 0.48, r * 0.38), skin);
  P.restore();
}

// ---------------------------------------------------------------- face parts
// Eye at (x, y). side -1 = screen-left eye, +1 = screen-right eye.
// o: r (size), look [x,y], blink 0..1, squint 0..1 (grin cheeks push up), lid 0..1 (heavy/half lid),
// closed 0..1 (eyes shut feeling it), skin (for lids), lash (female flick), lidInk, lidW
export function eye(P, x, y, side, o = {}) {
  const r = o.r ?? 4.6, look = o.look || [0, 0], ink = o.ink || INK.eye;
  const lidInk = o.lidInk || INK.line, lidW = o.lidW ?? r * 0.6;
  const shut = Math.max(o.blink || 0, o.closed || 0);
  if (shut > 0.55) {
    // closed: a relaxed downward arc (feeling it) or a flat blink line
    const sag = (o.closed || 0) > 0.5 ? r * 0.7 : r * 0.15;
    P.stroke(curve([[x - r * 1.5, y - r * 0.1], [x, y + sag], [x + r * 1.5, y - r * 0.1]], false), lidInk, lidW);
    if (o.lash) P.stroke(line([[x + side * r * 1.45, y - r * 0.1], [x + side * r * 2.1, y - r * 0.55]]), lidInk, lidW * 0.8);
    return;
  }
  const sq = clamp(o.squint || 0), lid = clamp(Math.max(o.lid || 0, shut * 1.4));
  const ex = x + look[0] * r * 0.55, ey = y + look[1] * r * 0.45;
  if (o.white) {
    P.fill(ellipse(x, y, r * 1.55, r * 1.05), o.white);
    P.fill(ellipse(ex, ey, r * 0.9, r * 1.0), ink);
  } else P.fill(ellipse(ex, ey, r, r * 1.22), ink);
  if (o.hi !== false) P.fill(circle(ex + r * 0.3, ey - r * 0.45, Math.max(0.8, r * 0.24)), [0, 0, 0]);
  const skin = o.skin || [0.2, 0.07, 0];
  // heavy upper lid: skin drops over the top of the eye, lid line on its edge
  const lidY = y - r * 1.3 + lid * r * 1.35;
  if (lid > 0.05) P.fill(poly([[x - r * 1.9, y - r * 2.6], [x + r * 1.9, y - r * 2.6], [x + r * 1.9, lidY], [x - r * 1.9, lidY]]), skin);
  P.stroke(curve([[x - r * 1.45, lidY + r * 0.35], [x, lidY - r * 0.1], [x + r * 1.45, lidY + r * 0.35]], false), lidInk, lidW);
  if (o.lash) P.stroke(line([[x + side * r * 1.35, lidY + r * 0.25], [x + side * r * 2.1, lidY - r * 0.35]]), lidInk, lidW * 0.8);
  // grin squint: cheeks push the lower lid up into a crescent
  if (sq > 0.05) {
    const by = y + r * 1.5 - sq * r * 1.4;
    P.fill(curve([[x - r * 2.2, y + r * 2.4], [x - r * 1.8, by + r * 0.2], [x, by - r * 0.3], [x + r * 1.8, by + r * 0.2], [x + r * 2.2, y + r * 2.4]], true, 0.5), skin);
    P.stroke(curve([[x - r * 1.3, by + r * 0.1], [x, by - r * 0.3], [x + r * 1.3, by + r * 0.1]], false), o.creaseInk || lidInk, lidW * 0.55);
  }
}

// Brow at (x, y); side -1/+1 as for eye(). raise lifts it, angle > 0 lifts the inner end (worried,
// feeling it), angle < 0 drops it (focused, shouting). thick/len set weight; arch bends it.
export function brow(P, x, y, side, { len = 20, thick = 6, raise = 0, angle = 0, arch = 0.15, ink = INK.line, taper = 0.6 } = {}) {
  const inX = x - side * len * 0.5, outX = x + side * len * 0.55;
  const inY = y - raise * 6 - angle * 5, outY = y - raise * 5 + angle * 2.5 + arch * 2;
  const midX = lerp(inX, outX, 0.55), midY = lerp(inY, outY, 0.55) - arch * len * 0.35 - raise * 1.5;
  const t0 = thick, t1 = thick * taper;
  P.fill(curve([
    [inX, inY - t0 * 0.5], [midX, midY - (t0 + t1) * 0.28], [outX, outY - t1 * 0.4],
    [outX + side * 1.5, outY + t1 * 0.2], [midX, midY + (t0 + t1) * 0.3], [inX, inY + t0 * 0.5],
  ], true, 0.35), ink);
}

// Mouth centred at (x, y). w = half-width at rest.
// v: open 0..1 (jaw), wide 0..1 (spread lips: ee), round 0..1 (pursed: oo),
// smile -1..1, teeth 0..1 (upper teeth visible), tongue 0..1.
// o.line: closed-mouth line ink; o.lip: lower-lip tint or null; o.lw: line width; o.skin (for lip cover)
export function mouth(P, x, y, w, v = {}, o = {}) {
  const open = clamp(v.open ?? 0), wide = clamp(v.wide ?? 0), round = clamp(v.round ?? 0);
  const smile = clamp(v.smile ?? 0.2, -1, 1), teeth = v.teeth ?? 0.8;
  const lineInk = o.line || INK.line, lw = o.lw ?? w * 0.2;
  const hw = w * (1 + wide * 0.32 - round * 0.45 + Math.max(0, smile) * 0.18);
  const h = open * w * 1.35 * (1 + round * 0.15) + (v.grin ?? 0) * w * 0.55;
  const cy = y - Math.max(0, smile) * w * 0.12;
  if (h < w * 0.12) {
    const c = smile * w * 0.3;
    P.stroke(curve([[x - hw, y - c], [x - hw * 0.45, y + c * 0.35], [x + hw * 0.45, y + c * 0.35], [x + hw, y - c]], false, 0.5), lineInk, lw);
    if (smile > 0.3) {
      // smile creases at the corners
      for (const s of [-1, 1]) P.stroke(curve([[x + s * (hw + w * 0.05), y - c - w * 0.25], [x + s * (hw + w * 0.18), y - c + w * 0.02], [x + s * (hw + w * 0.1), y - c + w * 0.2]], false), lineInk, lw * 0.55);
    }
    if (o.lip) P.fill(ellipse(x, y + w * 0.32, hw * 0.55, w * 0.16), o.lip);
    return;
  }
  // corners lift with the smile, drop with a frown; the top lip flattens as the mouth widens
  const cornY = cy - smile * w * 0.32;
  const top = cy - h * (0.22 + round * 0.12) - Math.max(0, smile) * w * 0.05;
  const bot = cy + h * (0.78 - round * 0.1) + Math.max(0, smile) * w * 0.18;
  const pinch = round * 0.35;
  const pts = [
    [x - hw, cornY],
    [x - hw * (0.62 - pinch * 0.2), top + (1 - round) * w * 0.02],
    [x, top - round * h * 0.08],
    [x + hw * (0.62 - pinch * 0.2), top + (1 - round) * w * 0.02],
    [x + hw, cornY],
    [x + hw * (0.6 + round * 0.1), lerp(cornY, bot, 0.85)],
    [x, bot],
    [x - hw * (0.6 + round * 0.1), lerp(cornY, bot, 0.85)],
  ];
  const shape = curve(pts, true, round > 0.5 ? 0.6 : 0.45);
  P.fill(shape, INK.mouth);
  P.save();
  P.clip(shape);
  if (teeth > 0) P.fill(roundRect(x - hw * 0.8, top - w * 0.3, hw * 1.6, w * 0.3 + Math.min(h * 0.32, w * 0.42) * teeth, w * 0.12), INK.teeth);
  if ((v.tongue ?? 1) > 0 && h > w * 0.4) P.fill(ellipse(x, bot + h * 0.05, hw * 0.62, h * 0.38), INK.tongue);
  P.restore();
  P.stroke(shape, o.edge || lineInk, lw * 0.5);
  if (o.lip) P.fill(curve([[x - hw * 0.55, bot + w * 0.08], [x, bot + w * 0.3], [x + hw * 0.55, bot + w * 0.08], [x, bot + w * 0.12]], true, 0.5), o.lip);
}

// A small gold hoop (nose ring / earring) centred at (x, y)
export function hoop(P, x, y, r, w = 2.5, { gap = 0.9, start = -0.3 } = {}) {
  P.stroke(arc(x, y, r, start + gap * 0.5, start + Math.PI * 2 - gap * 0.5), INK.gold, w);
  P.fill(circle(x + r * 0.55, y + r * 0.6, w * 0.45), INK.goldHi);
}

export function arc(x, y, r, a0, a1) {
  const p = new Path2D();
  p.arc(x, y, Math.max(0, r), a0, a1);
  return p;
}
