// Small math/timing helpers shared by the scenes.

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, v) => clamp((v - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeOut = (t) => 1 - (1 - t) ** 3;
export const easeIn = (t) => t ** 3;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const backOut = (t, s = 1.7) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;
export const TAU = Math.PI * 2;

// Deterministic hash noise: same inputs -> same value, so any frame can be rendered in isolation.
export function hash(...n) {
  let h = 2166136261 >>> 0;
  for (const v of n) {
    h ^= Math.floor(v * 1000) | 0;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995) >>> 0;
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
}
export const hs = (...n) => hash(...n) * 2 - 1;

export function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// 1D smooth value noise
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  return lerp(hs(i, seed), hs(i + 1, seed), smooth(f));
}

// Timing against the song's analysed events.
export class Clock {
  constructor(feat) {
    this.f = feat;
    this.fps = feat.fps;
  }
  frameVal(name, t) {
    const a = this.f[name];
    const i = clamp(Math.round(t * this.fps), 0, a.length - 1);
    return a[i];
  }
  // average of a feature over a short window, for smoother motion
  avg(name, t, win = 0.25) {
    const a = this.f[name];
    const i0 = clamp(Math.round((t - win) * this.fps), 0, a.length - 1);
    const i1 = clamp(Math.round(t * this.fps), 0, a.length - 1);
    let s = 0;
    for (let i = i0; i <= i1; i++) s += a[i];
    return s / (i1 - i0 + 1);
  }
  last(name, t) {
    // most recent event time <= t (binary search), or -Infinity
    const a = this.f[name];
    let lo = 0, hi = a.length - 1, r = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (a[m] <= t + 1e-6) { r = m; lo = m + 1; } else hi = m - 1;
    }
    return r < 0 ? { i: -1, t: -Infinity } : { i: r, t: a[r] };
  }
  next(name, t) {
    const l = this.last(name, t);
    const a = this.f[name];
    return l.i + 1 < a.length ? { i: l.i + 1, t: a[l.i + 1] } : { i: a.length, t: Infinity };
  }
  // exponential pulse from the latest event: 1 at the hit, decaying with time constant tau
  pulse(name, t, tau = 0.15) {
    const l = this.last(name, t);
    return l.t === -Infinity ? 0 : Math.exp(-(t - l.t) / tau);
  }
  beat(t) {
    const b = this.f.beats;
    const l = this.last('beats', t);
    if (l.i < 0) return { i: -1, phase: 0, len: 0.36 };
    const nx = l.i + 1 < b.length ? b[l.i + 1] : l.t + 0.36;
    const len = nx - l.t;
    return { i: l.i, phase: clamp((t - l.t) / len), len };
  }
  // continuous position along any sorted event list (beats, downbeats): index + phase
  posIn(name, t, fallback = 0.36) {
    const a = this.f[name];
    const l = this.last(name, t);
    if (l.i < 0) return (t - a[0]) / fallback;
    const nx = l.i + 1 < a.length ? a[l.i + 1] : l.t + (l.i > 0 ? l.t - a[l.i - 1] : fallback);
    return l.i + clamp((t - l.t) / (nx - l.t));
  }
  // continuous beat position (beat index + phase)
  beatPos(t) {
    return this.posIn('beats', t, 0.36);
  }
  barPos(t) {
    return this.posIn('downbeats', t, 1.44);
  }
  // events inside [a, b)
  between(name, a, b) {
    return this.f[name].filter((v) => v >= a && v < b);
  }
}

// Hand-drawn "boil": held on twos (12 fps) so linework re-cuts like stop-motion
export const boilFrame = (t) => Math.floor(t * 12);
