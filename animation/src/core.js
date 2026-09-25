// Shared timing, math and the master ball trajectory.
// Everything is a pure function of time so any frame can be rendered in any order.

export const W = 1920, H = 1080, FPS = 60, DURATION = 15;

// Music grid: 160 bpm, bars start at 0.5s (the pencil sketch is the pickup).
export const BPM = 160, BEAT = 60 / BPM, GRID0 = 0.5;
export const beat = (k) => GRID0 + k * BEAT;

export const T = {
  CEL: 2.0,
  PAPER: 3.5,
  PIXEL: 5.0,
  CHROME: 6.5,
  SHATTER: 9.5,
  SLAM: 11.0,
  PERIOD: 13.25,
  END: 15.0,
};

export const WORLDS = [
  { id: 'pencil', t0: 0, t1: T.CEL },
  { id: 'cel', t0: T.CEL, t1: T.PAPER },
  { id: 'paper', t0: T.PAPER, t1: T.PIXEL },
  { id: 'pixel', t0: T.PIXEL, t1: T.CHROME },
  { id: 'chrome', t0: T.CHROME, t1: T.SHATTER },
  { id: 'finale', t0: T.SHATTER, t1: T.END },
];
export const worldAt = (t) => WORLDS.find((w) => t >= w.t0 && t < w.t1) || WORLDS[WORLDS.length - 1];

// ---------------------------------------------------------------- math
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const remap = (x, a, b, c, d) => lerp(c, d, invLerp(a, b, x));
export const smooth = (t) => t * t * (3 - 2 * t);
export const TAU = Math.PI * 2;

export const ease = {
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outQuart: (t) => 1 - (1 - t) ** 4,
  inQuart: (t) => t ** 4,
  inOutQuart: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
  outExpo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  inExpo: (t) => (t <= 0 ? 0 : 2 ** (10 * t - 10)),
  inOutExpo: (t) =>
    t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2,
  outBack: (t, s = 1.70158) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
  inBack: (t, s = 1.70158) => (s + 1) * t ** 3 - s * t * t,
  outElastic: (t) =>
    t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1,
};

// Damped spring response to a unit step at time 0 (0 → 1 with overshoot).
export const spring = (t, freq = 3, damp = 0.35) => {
  if (t <= 0) return 0;
  const w = TAU * freq;
  return 1 - Math.exp(-damp * w * t) * Math.cos(w * Math.sqrt(1 - damp * damp) * t);
};
// Decaying wobble: kick of amplitude 1 at t=0 that rings out.
export const wobble = (t, freq = 4, decay = 6) =>
  t < 0 ? 0 : Math.exp(-decay * t) * Math.sin(TAU * freq * t);

// Deterministic PRNG.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
// Smooth 1D value noise in [-1, 1].
export const noise1 = (x) => {
  const i = Math.floor(x), f = x - i;
  return lerp(hash(i), hash(i + 1), smooth(f)) * 2 - 1;
};
export const fbm1 = (x) => noise1(x) * 0.6 + noise1(x * 2.1 + 17) * 0.3 + noise1(x * 4.3 + 41) * 0.1;

// Hold time on a lower frame rate (animating "on twos" etc).
export const hold = (t, fps) => Math.floor(t * fps + 1e-6) / fps;

// ---------------------------------------------------------------- ball
// 2D world units are screen pixels at zoom 1. Floor line at FLOOR; the ball rests with its
// centre R above it. All arcs share one gravity so the motion reads as a single object.
export const R = 84;
export const FLOOR = 830;
export const G = 4150;
export const VX = 290;
export const DROP = 0.78;
export const X0 = 960 - VX * (T.CEL - DROP);
const BLOCK_V0 = 1750;

export const ARCS = [
  { kind: 'drop', t0: DROP, t1: beat(2) },
  { kind: 'arc', t0: beat(2), t1: T.CEL },
  { kind: 'arc', t0: T.CEL, t1: beat(6) },
  { kind: 'arc', t0: beat(6), t1: T.PAPER },
  { kind: 'arc', t0: T.PAPER, t1: beat(10) },
  { kind: 'arc', t0: beat(10), t1: T.PIXEL },
  { kind: 'block', t0: T.PIXEL, t1: beat(14), tHit: beat(13) },
  { kind: 'arc', t0: beat(14), t1: T.CHROME },
];
export const DROP_H = 0.5 * G * (beat(2) - DROP) ** 2;
export const BLOCK_HIT_H = BLOCK_V0 * BEAT - 0.5 * G * BEAT * BEAT;
export const IMPACTS = ARCS.map((a) => a.t0).filter((t) => t > DROP).concat([T.CHROME]);

// Height of the ball centre above its resting height, and vertical velocity (up +).
export function arcHeight(t) {
  if (t < DROP) return { h: DROP_H, v: 0, arc: null };
  for (const a of ARCS) {
    if (t < a.t0 || t >= a.t1) continue;
    const s = t - a.t0, D = a.t1 - a.t0;
    if (a.kind === 'drop') return { h: DROP_H - 0.5 * G * s * s, v: -G * s, arc: a };
    if (a.kind === 'arc') return { h: 0.5 * G * s * (D - s), v: G * (D / 2 - s), arc: a };
    if (a.kind === 'block') {
      const up = a.tHit - a.t0;
      if (s < up) return { h: BLOCK_V0 * s - 0.5 * G * s * s, v: BLOCK_V0 - G * s, arc: a };
      const s2 = s - up, u = BLOCK_V0 - G * up;
      return { h: BLOCK_HIT_H - u * s2 - 0.5 * G * s2 * s2, v: -u - G * s2, arc: a };
    }
  }
  return { h: 0, v: 0, arc: null };
}

// Squash on contact: strongest on the impact frame, gone ~4 frames later, then a small ring.
export function contactSquash(t, impacts = IMPACTS) {
  let best = Infinity;
  for (const ti of impacts) {
    const d = t - ti;
    if (d >= 0 && d < best) best = d;
  }
  if (best === Infinity) return { squash: 0, ring: 0, since: Infinity };
  const squash = Math.exp(-((best / 0.034) ** 2));
  const ring = wobble(best - 0.05, 7, 9) * (best > 0.05 ? 1 : 0);
  return { squash, ring, since: best };
}

// Full ball state in 2D world space.
export function ball2D(t) {
  const { h, v, arc } = arcHeight(t);
  const x = t < DROP ? X0 : X0 + VX * (t - DROP);
  const vx = t < DROP ? 0 : VX;
  const { squash, ring } = contactSquash(t);
  // Velocity stretch (along motion) fades out while the ball is squashed on the floor.
  const speed = Math.hypot(vx, v);
  const k = 1 + clamp((speed - 500) / 2400) * 0.34 * (1 - squash);
  let along = k, across = 1 / Math.pow(k, 0.75);
  let angle = Math.atan2(-v, vx); // screen space: up is -y
  // Squash is vertical, so blend the stretch axis toward vertical as it takes over.
  const sq = 1 - 0.46 * squash + 0.05 * ring;
  let sx, sy;
  if (squash > 0.02) {
    sy = sq; sx = 1 / Math.pow(sq, 0.8);
    angle = 0; along = sx; across = sy;
  } else {
    sx = along; sy = across;
  }
  const y = FLOOR - R * (squash > 0.02 ? sy : 1) - h;
  return { x, y, h, vx, vy: v, angle, along, across, squash, ring, arc, spin: (x - X0) / R };
}

// Standard tracking camera shared by the 2D worlds: world point (cx, CAM_CY) at screen centre.
export const CAM_Z = 1.25, CAM_CY = 558;
export const camX = (t) => (t < T.CEL ? 960 : X0 + VX * (t - DROP) - 18 * Math.sin(Math.min(1, (t - T.CEL) * 3)));
export function applyCam(g, cx, cy, z, sk = { x: 0, y: 0, rot: 0 }) {
  g.translate(W / 2 + sk.x, H / 2 + sk.y);
  g.rotate(sk.rot);
  g.scale(z, z);
  g.translate(-cx, -cy);
}

// Camera shake from impacts: returns an offset in px and a small roll.
export const SHAKES = [
  [beat(2), 0.35], [T.CEL, 1], [beat(6), 0.4], [T.PAPER, 0.9], [beat(10), 0.4], [T.PIXEL, 0.9],
  [beat(13), 0.6], [beat(14), 0.4], [T.CHROME, 1.5], [beat(18), 0.6], [beat(20), 0.6], [beat(22), 0.8],
  [T.SHATTER, 1.6], [T.SLAM, 1.8], [T.PERIOD, 0.25],
];
export function shake(t, amp = 22) {
  let e = 0;
  for (const [ti, a] of SHAKES) {
    const d = t - ti;
    if (d >= 0 && d < 0.6) e += a * Math.exp(-d * 9);
  }
  e = Math.min(e, 2);
  const s = e * e * amp;
  return {
    x: s * noise1(t * 38 + 3.1),
    y: s * noise1(t * 41 + 9.7),
    rot: e * e * 0.012 * noise1(t * 29 + 5.5),
    energy: e,
  };
}
