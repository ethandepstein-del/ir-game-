// Rhythm, camera and transition helpers shared by every sequence.
//
// Motion in this video is hit-shaped, not sine-shaped: things snap on the event and settle,
// the way a drummer's stick or a stamped letter moves. Every helper is a pure function of time,
// so any frame renders on its own.
import { circle, curve, line, poly, rect } from './shapes.mjs';
import { backOut, clamp, easeIn, easeOut, hash, hs, lerp, noise1, TAU } from './util.mjs';
import { H, K, W } from './world.mjs';

// ------------------------------------------------------------------ envelopes
// instant attack, exponential decay; 0 before the event
export const hit = (dt, tau = 0.12) => (dt < 0 ? 0 : Math.exp(-dt / tau));

// anticipation into an event: dips to -a over `lead` seconds before it, then snaps to 1 and
// decays. Use for squash/stretch and wind-ups (a stick lifting before it lands).
export function antic(dt, { lead = 0.09, tau = 0.12, a = 0.3 } = {}) {
  if (dt < -lead) return 0;
  if (dt < 0) return -a * Math.sin(((dt + lead) / lead) * (Math.PI / 2));
  return Math.exp(-dt / tau);
}

// damped spring 0 -> 1 with overshoot, dt seconds after the trigger
export function spring(dt, { freq = 3.2, damp = 8 } = {}) {
  if (dt <= 0) return 0;
  return 1 - Math.exp(-damp * dt) * Math.cos(TAU * freq * dt);
}

// pop-in scale: overshoots past 1 and settles (use for stamps, cards, photos)
export const pop = (dt, dur = 0.16, s = 2.4) => (dt <= 0 ? 0 : backOut(clamp(dt / dur), s));

// a beat-shaped bounce from a continuous beat position: 1 on the beat, falling fast
export const pump = (bp, sharp = 3) => Math.pow(1 - (bp - Math.floor(bp)), sharp);

// held on n fps ("on twos" at 12) for a stop-motion snap
export const hold = (t, fps = 12) => Math.floor(t * fps + 1e-6) / fps;

// eased progress through [t0, t0 + dur]
export const snap = (t, t0, dur, ease = easeOut) => ease(clamp((t - t0) / dur));

// progress through a list of event times: index of the last event and eased phase to the next
export function stepper(t, times, ease = easeOut, dur = null) {
  let i = -1;
  for (let k = 0; k < times.length; k++) if (times[k] <= t + 1e-6) i = k;
  if (i < 0) return { i: -1, k: 0 };
  const span = dur ?? (i + 1 < times.length ? times[i + 1] - times[i] : 0.3);
  return { i, k: ease(clamp((t - times[i]) / Math.max(1e-3, span))) };
}

// ------------------------------------------------------------------ camera
// shake offset [dx, dy, rot] from smooth noise; amp in px
export function shakeAt(t, amp, seed = 0, freq = 22) {
  return [noise1(t * freq, seed) * amp, noise1(t * freq, seed + 7) * amp, noise1(t * freq, seed + 13) * amp * 0.0009];
}

// draw fn through a camera looking at (x, y) with zoom and roll, plus optional shake
export function camera(P, { x = W / 2, y = H / 2, zoom = 1, rot = 0, shake = 0, t = 0, seed = 0 } = {}, fn) {
  const [sx, sy, sr] = shake ? shakeAt(t, shake, seed) : [0, 0, 0];
  P.save();
  P.translate(W / 2 + sx, H / 2 + sy);
  P.rotate(rot + sr);
  P.scale(zoom);
  P.translate(-x, -y);
  fn();
  P.restore();
}

// ------------------------------------------------------------------ graphic overlays
// speed lines: parallel streaks along `dir` (radians), or radial from (cx, cy)
export function speedLines(P, { n = 36, dir = 0, inks = K.paper, seed = 1, width = 7, len = 520, cx = W / 2, cy = H / 2, radial = false, inner = 380, k = 1 } = {}) {
  if (k <= 0) return;
  for (let i = 0; i < n; i++) {
    const w = width * (0.5 + hash(seed, i, 1)) * k;
    if (radial) {
      const a = hash(seed, i, 2) * TAU;
      const r0 = inner + hash(seed, i, 3) * 200, r1 = r0 + len * (0.4 + hash(seed, i, 4)) * k;
      P.stroke(line([[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]]), inks, w);
    } else {
      const c = Math.cos(dir), s = Math.sin(dir);
      const along = hs(seed, i, 2) * W * 0.8, across = hs(seed, i, 3) * H * 0.75;
      const x = W / 2 + c * along - s * across, y = H / 2 + s * along + c * across;
      const L = len * (0.4 + hash(seed, i, 4)) * k;
      P.stroke(line([[x - c * L / 2, y - s * L / 2], [x + c * L / 2, y + s * L / 2]]), inks, w);
    }
  }
}

// a jagged torn-paper edge from (x0, y0) to (x1, y1): returns the point list
export function tearPath(x0, y0, x1, y1, seed = 1, rough = 26, step = 34) {
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.ceil(len / step));
  const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, j = i === 0 || i === n ? 0 : hs(seed, i) * rough;
    pts.push([lerp(x0, x1, u) + nx * j, lerp(y0, y1, u) + ny * j]);
  }
  return pts;
}

// ------------------------------------------------------------------ transitions
// A transition blends the outgoing shot `a` and the incoming shot `b` (each a () => void that
// draws a full frame) at progress u in [0, 1]. The cut point, where `b` owns the frame, is u = 0.5
// for whips and u = 0 for reveals. `o` carries kind-specific options.
export const TRANSITIONS = {
  // whip pan: one continuous pan from a to b laid side by side along dir, fastest at the cut,
  // with streaks at the peak
  whip(P, u, a, b, o = {}) {
    const dir = o.dir ?? 0, c = Math.cos(dir), s = Math.sin(dir), D = W * 1.1;
    const k = u < 0.5 ? 0.5 * easeIn(u / 0.5) : 0.5 + 0.5 * easeOut((u - 0.5) / 0.5);
    const off = k * D;
    // the seam between the two frames, in screen space
    const sx = W / 2 + c * (D / 2 - off), sy = H / 2 + s * (D / 2 - off);
    const half = (sign) => {
      // the half-plane on the `sign` side of the seam line (perpendicular to dir)
      const px = -s, py = c, L = 4000;
      const ax = sx + px * L, ay = sy + py * L, bx = sx - px * L, by = sy - py * L;
      return poly([[ax, ay], [bx, by], [bx + sign * c * L, by + sign * s * L], [ax + sign * c * L, ay + sign * s * L]]);
    };
    P.save(); P.clip(half(-1)); P.translate(-c * off, -s * off); a(); P.restore();
    P.save(); P.clip(half(1)); P.translate(c * (D - off), s * (D - off)); b(); P.restore();
    speedLines(P, { dir, inks: o.inks ?? K.paper, k: Math.sin(u * Math.PI) ** 2, n: 44, width: 10, len: 900, seed: o.seed ?? 3 });
  },
  // torn paper: b is revealed through a tear sweeping across; a white paper edge rides the tear
  tear(P, u, a, b, o = {}) {
    a();
    const k = easeOut(clamp(u));
    const x = lerp(-300, W + 300, k);
    const edge = tearPath(x + 120, -60, x - 120, H + 60, o.seed ?? 5);
    const reg = [...edge, [-400, H + 60], [-400, -60]];
    P.save(); P.clip(poly(reg)); b(); P.restore();
    const lip = edge.map(([px, py], i) => [px + 16 + hs(o.seed ?? 5, i, 9) * 8, py]);
    P.fill(poly([...edge, ...lip.reverse()]), K.paper);
  },
  // iris: b grows from a point inside a hard circle with an ink ring
  iris(P, u, a, b, o = {}) {
    a();
    const [cx, cy] = o.at ?? [W / 2, H / 2];
    const r = easeIn(clamp(u)) * Math.hypot(W, H);
    if (r <= 0) return;
    P.save(); P.clip(circle(cx, cy, r)); b(); P.restore();
    P.stroke(circle(cx, cy, r), o.inks ?? K.ink, 18);
  },
  // slam: hard cut to b, which lands from 112% scale with a paper flash
  slam(P, u, a, b, o = {}) {
    const k = backOut(clamp(u), 1.6);
    P.save(); P.translate(W / 2, H / 2); P.scale(lerp(1.12, 1, k)); P.translate(-W / 2, -H / 2); b(); P.restore();
    const f = 1 - clamp(u * 4);
    if (f > 0) P.alpha(f * 0.6).fill(rect(-200, -200, W + 400, H + 400), K.paper).alpha(1);
  },
  // wipe: a hard-edged ink bar sweeps across, b behind it
  wipe(P, u, a, b, o = {}) {
    const dir = o.dir ?? 1;
    const k = easeOut(clamp(u));
    const x = dir > 0 ? lerp(-200, W + 200, k) : lerp(W + 200, -200, k);
    P.save(); P.clip(dir > 0 ? rect(x, -200, W + 600, H + 400) : rect(-600, -200, x + 600, H + 400)); a(); P.restore();
    P.save(); P.clip(dir > 0 ? rect(-600, -200, x + 600, H + 400) : rect(x, -200, W + 600, H + 400)); b(); P.restore();
    P.fill(rect(x - 40, -200, 80, H + 400), o.inks ?? [1, 0, 0]);
  },
};

// ------------------------------------------------------------------ small drawing helpers
// a stamped, slightly rotated rubber-stamp frame around a region
export function stampBox(P, x, y, w, h, inks, width = 10, seed = 1) {
  const j = (i) => hs(seed, i) * 4;
  P.stroke(poly([[x + j(1), y + j(2)], [x + w + j(3), y + j(4)], [x + w + j(5), y + h + j(6)], [x + j(7), y + h + j(8)]]), inks, width);
}

// wobbly underline swipe revealed by k
export function swipe(P, x0, x1, y, k, inks, width = 16, seed = 2) {
  if (k <= 0) return;
  const xe = lerp(x0, x1, clamp(k));
  P.stroke(curve([[x0, y + hs(seed, 1) * 4], [lerp(x0, xe, 0.5), y + 6 + hs(seed, 2) * 4], [xe, y + hs(seed, 3) * 4]], false), inks, width);
}
