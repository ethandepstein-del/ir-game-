// Shared timing, math and the master ball trajectory.
// Everything is a pure function of time so any frame can be rendered in any order.

export const W = 1920, H = 1080, FPS = 60, DURATION = 20;

// Music grid: 160 bpm, bars start at 0.5s (the pencil sketch is the pickup).
export const BPM = 160, BEAT = 60 / BPM, GRID0 = 0.5;
export const beat = (k) => GRID0 + k * BEAT;

export const T = {
  CEL: 2.0,
  PAPER: 3.5,
  PIXEL: 5.0,
  CHROME: 6.5,
  SHATTER: 9.5,   // the boule hits the lens
  VORTEX: 9.6,    // the tunnel of mirror shards beyond it
  GATHER: 11.0,   // the shards lock into a mirror ball
  BURST: 12.5,    // which bursts; its dust swarms into the title
  SLAM: 14.0,     // "Claude"
  PROC: 14.75,    // the five balls' first contact on the lettering
  PERIOD: 18.125, // the full stop turns Claude orange
  END: 20.0,
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
// The ball is simulated (see physics.js). Cut times come from the simulation's impacts, so the
// world table is filled in once the physics has been solved.
import { physics, ball2D, R, FLOOR, G, X0, Y0 } from './physics.js';
export { ball2D, R, FLOOR, G, X0, Y0, physics };

export function syncTimeline() {
  const P = physics();
  [T.CEL, T.PAPER, T.PIXEL, T.CHROME] = P.cuts;
  WORLDS[0].t1 = WORLDS[1].t0 = T.CEL;
  WORLDS[1].t1 = WORLDS[2].t0 = T.PAPER;
  WORLDS[2].t1 = WORLDS[3].t0 = T.PIXEL;
  WORLDS[3].t1 = WORLDS[4].t0 = T.CHROME;
  SHAKES.length = 0;
  for (const e of P.events) {
    if (e.t > T.SHATTER) continue;
    SHAKES.push([e.t, Math.min(1.6, (e.speed / 2600) ** 1.4 * (e.cut ? 1.4 : 1))]);
  }
  SHAKES.push([T.SHATTER, 1.6], [T.BURST, 1.5], [T.SLAM, 1.8], [T.PERIOD, 0.3]);
  return P;
}
// Events of one kind, in time order (e.g. every landing on the cel floor).
export const eventsOn = (surface, stage) => physics().events.filter((e) => e.surface === surface && (!stage || e.stage === stage));

// Squash for scripted secondary objects (the full stop in the end card).
export function contactSquash(t, impacts) {
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

// Standard tracking camera shared by the 2D worlds: world point (cx, CAM_CY) at screen centre.
export const CAM_Z = 1.15, CAM_CY = 540;
// Camera operator: follows the ball with a lagged, smoothed x (a weighted look back in time).
export function camX(t) {
  let acc = 0, wsum = 0;
  for (let i = 0; i < 9; i++) {
    const w = Math.exp(-i * 0.35);
    acc += ball2D(t - i * 0.03).cx * w; wsum += w;
  }
  return acc / wsum + 60;
}
// Framing: crane up (and ease out a touch) when the ball flies high, anticipating by ~0.2 s.
export function camFrame(t) {
  const top = CAM_CY - H / 2 / CAM_Z + 70;
  let acc = 0, wsum = 0;
  for (let i = -6; i <= 6; i++) {
    const tt = t + i * 0.04;
    const w = Math.exp(-(i * i) / 18);
    acc += Math.max(0, top - (ball2D(Math.max(0, tt)).cy - R)) * w; wsum += w;
  }
  const lift = acc / wsum;
  return { x: camX(t), y: CAM_CY - lift * 0.8, z: CAM_Z / (1 + lift / 1400), lift };
}
export function applyCam(g, cx, cy, z, sk = { x: 0, y: 0, rot: 0 }) {
  g.translate(W / 2 + sk.x, H / 2 + sk.y);
  g.rotate(sk.rot);
  g.scale(z, z);
  g.translate(-cx, -cy);
}

// Camera shake from impacts: returns an offset in px and a small roll.
export const SHAKES = [];
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
