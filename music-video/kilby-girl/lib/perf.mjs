// Performance data for the band rigs: drum limbs, strum and fret hands, bass plucks, lip-sync.
//
// `perf.py` measures the song and writes perf.json, which is merged into features.json under
// "perf". Every query takes the song time t in seconds and is pure (no per-frame state), so any
// frame can be rendered on its own. When perf is absent, or a field of it is missing, the answers
// are derived from the older features.json fields (kicks, snares, accents, beats, vocal, lyrics)
// so callers never need to branch.
//
//   const perf = perfFrom(clock);
//   perf.pulse('kick', t)          1 at a kick, decaying (times the hit's velocity)
//   perf.anticip('snare', t, 0.1)  0 -> 1 over the 0.1 s before the next snare (stick wind-up)
//   perf.strum('acoustic', t)      { phase, dir, vel } for the strumming hand
//   perf.bassNote(t)               the bass note sounding now, or null
//   perf.viseme(t)                 { open, wide, round } for Noah's mouth
//
// Kinds: kick snare hat tom crash ride (drums), strumA strumE (acoustic / electric strums),
// bass (bass note onsets), noteE (electric lead notes), beat, downbeat, accent.

import { clamp, hash } from './util.mjs';

const DRUMS = ['kick', 'snare', 'hat', 'tom', 'crash', 'ride'];
const INST = { acoustic: 'strumA', a: 'strumA', A: 'strumA', strumA: 'strumA', electric: 'strumE', e: 'strumE', E: 'strumE', strumE: 'strumE' };
const NONE_LAST = Object.freeze({ t: -Infinity, vel: 0, i: -1 });
const EMPTY = Object.freeze({ ev: [], ts: new Float64Array(0) });

// ---------------------------------------------------------------- small helpers

// sorted Float64Array of times + parallel event objects
function track(events) {
  const ev = events.filter((e) => e && Number.isFinite(e.t)).sort((a, b) => a.t - b.t);
  ev.forEach((e, i) => { e.i = i; Object.freeze(e); });
  return { ev, ts: Float64Array.from(ev, (e) => e.t) };
}

// index of the last time <= t, or -1
function lastIdx(ts, t) {
  let lo = 0, hi = ts.length - 1, r = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (ts[m] <= t + 1e-6) { r = m; lo = m + 1; } else hi = m - 1;
  }
  return r;
}

// linear interpolation into a frame array sampled at fps
function sample(arr, fps, t) {
  if (!arr || !arr.length) return 0;
  const x = t * fps;
  if (x <= 0) return arr[0];
  const i = Math.floor(x);
  if (i >= arr.length - 1) return arr[arr.length - 1];
  const f = x - i;
  return arr[i] * (1 - f) + arr[i + 1] * f;
}

// mean of a frame array over [t - win, t]
function windowAvg(arr, fps, t, win) {
  if (!arr || !arr.length) return 0;
  const i0 = clamp(Math.round((t - win) * fps), 0, arr.length - 1);
  const i1 = clamp(Math.round(t * fps), 0, arr.length - 1);
  let s = 0;
  for (let i = i0; i <= i1; i++) s += arr[i];
  return s / (i1 - i0 + 1);
}

// rough vowel class of a written word: wide (ee, i, e, ay), round (oo, o, ou, w) or open (a, u)
export function vowelShape(word) {
  const w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return { wide: 0.2, round: 0.1 };
  const m = w.match(/[aeiouy]+/g) || [];
  // the stressed vowel is usually the first vowel group of short sung words
  const v = m.length ? m[0] : '';
  if (/^(oo|ou|ow|o|oa|ue|ew|u)$/.test(v) && /(oo|ou|ow|oa|o|ue|ew)/.test(w)) return { wide: 0.05, round: 0.85 };
  if (/^(ee|ea|ie|i|ei|ey|ay|ai|e|y)$/.test(v)) return { wide: 0.8, round: 0.05 };
  if (/^(a|au|aw|u)$/.test(v)) return { wide: 0.3, round: 0.15 };
  return { wide: 0.35, round: 0.25 };
}

// ---------------------------------------------------------------- Perf

export class Perf {
  constructor(perfJson, features) {
    const p = perfJson || {};
    const f = features || {};
    this.p = p;
    this.f = f;
    this.fromPerf = !!perfJson;
    this.fps = p.fps || 60;
    this.duration = p.duration || f.duration || 0;
    this.tracks = {};
    const d = p.drums || {};
    const fb = new Fallback(f);

    const drumEv = (kind, extra) => (Array.isArray(d[kind]) && d[kind].length
      ? d[kind].map((r) => ({ t: r[0], vel: r[1] ?? 1, ...(extra ? extra(r) : {}) }))
      : null);
    this.tracks.kick = track(drumEv('kick') || fb.kick());
    this.tracks.snare = track(drumEv('snare') || fb.snare());
    this.tracks.hat = track(drumEv('hat', (r) => ({ open: r[2] ?? 0 })) || fb.hat());
    this.tracks.tom = track(drumEv('tom', (r) => ({ pitch: r[2] ?? 0.5 })) || []);
    this.tracks.crash = track(drumEv('crash') || fb.crash());
    this.tracks.ride = track(drumEv('ride') || []);

    const strums = (rows) => rows.map((r) => ({ t: r[0], vel: r[1] ?? 1, dir: r[2] ?? 1 }));
    const aS = p.acoustic && p.acoustic.strums, eS = p.electric && p.electric.strums;
    this.tracks.strumA = track(aS && aS.length ? strums(aS) : fb.strums(false));
    this.tracks.strumE = track(eS && eS.length ? strums(eS) : fb.strums(true));

    const notes = (rows) => rows.map((r) => ({ t: r[0], t0: r[0], t1: r[1], midi: r[2], vel: r[3] ?? 1 }));
    const bN = p.bass && p.bass.notes, eN = p.electric && p.electric.notes;
    this.tracks.bass = track(bN && bN.length ? notes(bN) : fb.bass());
    this.tracks.noteE = track(eN && eN.length ? notes(eN) : []);

    this.tracks.beat = track((f.beats || []).map((t) => ({ t, vel: 1 })));
    this.tracks.downbeat = track((f.downbeats || []).map((t) => ({ t, vel: 1 })));
    this.tracks.accent = track((f.accents || []).map((t) => ({ t, vel: 1 })));

    this.fills = (p.fills || []).map(([t0, t1]) => ({ t0, t1 })).sort((a, b) => a.t0 - b.t0);
    this.fillTs = Float64Array.from(this.fills, (x) => x.t0);
    this.chords = track((p.acoustic && p.acoustic.chords || []).map(([t, name]) => ({ t, vel: 1, name })));
    this.sections = track((p.sections || []).map(([t, name]) => ({ t, vel: 1, name })));

    // frame arrays (perf at its own fps, or features at theirs)
    const v = p.vocal || {};
    this.vis = v.env && v.env.length ? { fps: this.fps, env: v.env, open: v.open || v.env, wide: v.wide, round: v.round } : null;
    this.energyArr = p.energy && p.energy.length ? { fps: this.fps, a: p.energy } : null;
    this.fb = fb;
  }

  // ---- event queries

  // the event track for a kind (see the list at the top); unknown kinds are empty
  track(kind) {
    return this.tracks[kind] || this.tracks[INST[kind]] || EMPTY;
  }

  // most recent hit at or before t: {t, vel, i, ...extras} (extras: open, pitch, dir, t1, midi)
  last(kind, t) {
    const tr = this.track(kind);
    const i = lastIdx(tr.ts, t);
    return i < 0 ? NONE_LAST : tr.ev[i];
  }

  // first hit after t: {t, vel, i, ...}; {t: Infinity, vel: 0, i: n} when there is none
  next(kind, t) {
    const tr = this.track(kind);
    const i = lastIdx(tr.ts, t) + 1;
    return i < tr.ev.length ? tr.ev[i] : { t: Infinity, vel: 0, i: tr.ev.length };
  }

  // hits in [a, b)
  hits(kind, a, b) {
    const tr = this.track(kind);
    const i0 = lastIdx(tr.ts, a - 1e-6) + 1;
    const out = [];
    for (let i = i0; i < tr.ev.length && tr.ev[i].t < b; i++) out.push(tr.ev[i]);
    return out;
  }

  // exp decay from the last hit, times its velocity: vel at the hit, vel/e after tau seconds
  pulse(kind, t, tau = 0.12) {
    const l = this.last(kind, t);
    return l.i < 0 ? 0 : l.vel * Math.exp(-(t - l.t) / tau);
  }

  // 0..1 rising (eased) over the `lead` seconds before the next hit, 0 right after each hit.
  // The ramp never starts before the previous hit, so fast rolls still reach 1 on every stroke.
  anticip(kind, t, lead = 0.1) {
    const n = this.next(kind, t);
    if (!Number.isFinite(n.t)) return 0;
    const l = this.last(kind, t);
    const span = Math.max(1e-3, Math.min(lead, l.i < 0 ? lead : n.t - l.t));
    const x = clamp(1 - (n.t - t) / span);
    return x * x * (3 - 2 * x);
  }

  // ---- instruments

  // strumming hand: phase 0..1 from the last strum to the next, its direction (+1 down, -1 up)
  // and velocity. `since` is seconds since the last strum, `gap` the time between the two.
  strum(inst, t) {
    const k = INST[inst] || inst;
    const l = this.last(k, t), n = this.next(k, t);
    if (l.i < 0) return { phase: 0, dir: n.dir || 1, vel: 0, since: Infinity, gap: Infinity, nextDir: n.dir || 1 };
    const gap = Number.isFinite(n.t) ? n.t - l.t : Infinity;
    return {
      phase: Number.isFinite(gap) ? clamp((t - l.t) / gap) : 1,
      dir: l.dir, vel: l.vel, since: t - l.t, gap, nextDir: n.dir ?? -l.dir,
    };
  }

  // bass note sounding at t: {midi, t0, t1, vel} or null
  bassNote(t) {
    const l = this.last('bass', t);
    if (l.i < 0 || t > l.t1) return null;
    return { midi: l.midi, t0: l.t0, t1: l.t1, vel: l.vel, i: l.i };
  }

  // electric lead note sounding at t, or null
  leadNote(t) {
    const l = this.last('noteE', t);
    if (l.i < 0 || t > l.t1) return null;
    return { midi: l.midi, t0: l.t0, t1: l.t1, vel: l.vel, i: l.i };
  }

  // current chord for the fret hand: {name, t, i} (name like "G:maj"), or null
  chord(t) {
    const l = this.chords.ev.length ? this.chords.ev[lastIdx(this.chords.ts, t)] : null;
    return l ? { name: l.name, t: l.t, i: l.i } : null;
  }

  // ---- drums: fills and song sections

  inFill(t) {
    return this.fill(t) !== null;
  }

  // the fill around t: {t0, t1, phase} or null
  fill(t) {
    const i = lastIdx(this.fillTs, t);
    if (i < 0) return null;
    const x = this.fills[i];
    return t <= x.t1 ? { t0: x.t0, t1: x.t1, phase: clamp((t - x.t0) / Math.max(1e-3, x.t1 - x.t0)), i } : null;
  }

  // song section at t: {name, t, i} or null
  section(t) {
    const i = lastIdx(this.sections.ts, t);
    return i < 0 ? null : { name: this.sections.ev[i].name, t: this.sections.ev[i].t, i };
  }

  // ---- continuous signals

  // Noah's mouth: open (jaw), wide (spread lips), round (pursed lips), each 0..1
  viseme(t) {
    if (this.vis) {
      const s = (a) => clamp(sample(a, this.vis.fps, t));
      return { open: s(this.vis.open), wide: this.vis.wide ? s(this.vis.wide) : 0, round: this.vis.round ? s(this.vis.round) : 0 };
    }
    return this.fb.viseme(t);
  }

  // 0..1 smoothed loudness intensity
  energy(t) {
    if (this.energyArr) return clamp(sample(this.energyArr.a, this.energyArr.fps, t));
    return this.fb.energy(t);
  }
}

// ---------------------------------------------------------------- features.json fallback

class Fallback {
  constructor(f) {
    this.f = f;
    this.fps = f.fps || 24;
    const words = [];
    for (const line of (f.lyrics && f.lyrics.lines) || []) for (const w of line.words || []) if (Number.isFinite(w.t)) words.push({ t: w.t, e: Number.isFinite(w.e) ? w.e : w.t + 0.25, shape: vowelShape(w.w) });
    words.sort((a, b) => a.t - b.t);
    this.words = words;
    this.wordTs = Float64Array.from(words, (w) => w.t);
  }

  env(name, t) {
    return sample(this.f[name], this.fps, t);
  }

  hitsFrom(name, envName, lo = 0.35) {
    return (this.f[name] || []).map((t) => ({ t, vel: clamp(lo + (1 - lo) * this.env(envName, t)) }));
  }

  kick() { return this.hitsFrom('kicks', 'low'); }
  snare() { return this.hitsFrom('snares', 'mid'); }
  crash() { return (this.f.accents || []).map((t) => ({ t, vel: 1 })); }

  // eighth-note grid from the beats (down on the beat, up on the "and")
  eighths() {
    const b = this.f.beats || [];
    const out = [];
    for (let i = 0; i < b.length; i++) {
      const len = i + 1 < b.length ? b[i + 1] - b[i] : i > 0 ? b[i] - b[i - 1] : 0.36;
      out.push({ t: b[i], dir: 1, on: true });
      if (len < 1) out.push({ t: b[i] + len / 2, dir: -1, on: false });
    }
    return out;
  }

  hat() {
    return this.eighths()
      .filter((e) => this.env('rms', e.t) > 0.2)
      .map((e) => ({ t: e.t, vel: clamp(0.3 + 0.6 * this.env('high', e.t) * (e.on ? 1 : 0.75)), open: 0 }));
  }

  strums(electric) {
    return this.eighths()
      .filter((e) => this.env('rms', e.t) > 0.2 && (!electric || e.on))
      .map((e) => ({ t: e.t, dir: e.dir, vel: clamp((electric ? 0.35 : 0.25) + 0.6 * this.env('mid', e.t) * (e.on ? 1 : 0.7)) }));
  }

  bass() {
    const b = this.f.beats || [];
    const down = Float64Array.from(this.f.downbeats || []);
    const roots = [40, 45, 43, 38, 40, 47, 45, 43];
    const out = [];
    for (let i = 0; i + 1 < b.length; i++) {
      if (this.env('low', b[i]) < 0.25) continue;
      const bar = lastIdx(down, b[i]);
      out.push({ t: b[i], t0: b[i], t1: b[i + 1] - 0.03, midi: roots[Math.floor(hash(bar, 7) * roots.length)], vel: clamp(0.3 + 0.7 * this.env('low', b[i])) });
    }
    return out;
  }

  energy(t) {
    return clamp(windowAvg(this.f.rms, this.fps, t, 0.4));
  }

  viseme(t) {
    const env = clamp(this.f.vocal ? sample(this.f.vocal, this.fps, t) : 0);
    if (!this.words.length) return { open: env, wide: env * 0.3, round: env * 0.2 };
    const i = lastIdx(this.wordTs, t);
    const w = i >= 0 ? this.words[i] : null;
    // gate: open inside a word, closing over 60 ms after it ends
    const g = w ? (t <= w.e ? 1 : clamp(1 - (t - w.e) / 0.06)) : 0;
    const open = clamp(env * 1.2) * g;
    const shape = w ? w.shape : { wide: 0, round: 0 };
    return { open, wide: shape.wide * (0.3 + 0.7 * open) * g, round: shape.round * (0.3 + 0.7 * open) * g };
  }
}

// ---------------------------------------------------------------- entry point

const cache = new WeakMap();

// A Perf for this clock's features: from clock.f.perf when present, else from features.json alone.
export function perfFrom(clock) {
  const f = (clock && clock.f) || clock || {};
  const c = cache.get(f);
  if (c && c.src === f.perf) return c.perf;
  const perf = new Perf(f.perf || null, f);
  cache.set(f, { src: f.perf, perf });
  return perf;
}
