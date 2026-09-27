// The show: Kilby Court's stage with the band, lights and crowd, plus the crowd and pit shots.
// Used by several sequences; its exports keep their signatures (add options, don't break them).
import { BAND, drummer, player, withLag } from '../lib/band.mjs';
import { pump } from '../lib/fx.mjs';
import { confetti, pit } from '../lib/extras.mjs';
import { hot, stampWords } from '../lib/lyrics.mjs';
import { amp, crowd, girlSide } from '../lib/people.mjs';
import { rect } from '../lib/shapes.mjs';
import { clamp, hash, hs, lerp, TAU } from '../lib/util.mjs';
import { H, K, stringLights, W } from '../lib/world.mjs';
import { blinkOn, FLOODS, withCam } from './common.mjs';

const HOOK = [[37, 60], [123, 148]];
export const inHook = (t) => HOOK.some(([a, b]) => t >= a && t < b);

// ------------------------------------------------------------------ the band, driven by the song
// Everything below reads the measured performance (S.perf): each drum stroke, strum and bass
// pluck lands on the frame it sounds.

// per-hand drum strokes: the left hand plays the snare, the right hand keeps the hats and takes
// the crashes and rides; tom fills alternate hands down the kit
const TOMS = ['tom1', 'tom2', 'floor'];
function handTracks(perf) {
  if (perf._hands) return perf._hands;
  const ev = (k) => perf.track(k).ev;
  const R = [], L = [];
  for (const e of ev('snare')) L.push({ t: e.t, vel: e.vel, to: 'snare' });
  for (const e of ev('hat')) R.push({ t: e.t, vel: e.vel, to: 'hat' });
  for (const e of ev('crash')) R.push({ t: e.t, vel: e.vel, to: 'crash' });
  for (const e of ev('ride')) R.push({ t: e.t, vel: e.vel, to: 'ride' });
  ev('tom').forEach((e, i) => (i % 2 ? L : R).push({ t: e.t, vel: e.vel, to: TOMS[Math.min(2, Math.floor((e.pitch ?? 0.5) * 3))] }));
  const clean = (a) => {
    a.sort((x, y) => x.t - y.t);
    // one hand can't play two things 60 ms apart: keep the louder (crash beats hat)
    const out = [];
    for (const e of a) {
      const p = out[out.length - 1];
      if (p && e.t - p.t < 0.06) { if (e.to === 'crash' || e.vel > p.vel) out[out.length - 1] = e; } else out.push(e);
    }
    return { ev: out, ts: Float64Array.from(out, (e) => e.t) };
  };
  perf._hands = { R: clean(R), L: clean(L) };
  return perf._hands;
}

function stroke(tr, t) {
  let lo = 0, hi = tr.ts.length - 1, i = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (tr.ts[m] <= t + 1e-6) { i = m; lo = m + 1; } else hi = m - 1; }
  const a = tr.ev[i], b = tr.ev[i + 1];
  if (!a && !b) return undefined;
  return {
    from: a?.to ?? b.to, to: b?.to ?? a.to,
    since: a ? t - a.t : 2, until: b ? b.t - t : 2,
    vel: b?.vel ?? 0.6, prevVel: a?.vel ?? 0.6,
  };
}

function noahPoseAt(S, t) {
  const { perf, clock } = S;
  const E = S.E;
  const hands = handTracks(perf);
  const v = perf.viseme(t);
  const singing = v.open > 0.12;
  const bar = Math.floor(clock.barPos(t));
  return {
    bf: S.bf,
    R: stroke(hands.R, t), L: stroke(hands.L, t),
    kick: perf.pulse('kick', t, 0.08), kickAnt: perf.anticip('kick', t, 0.12),
    crash: perf.pulse('crash', t, 0.22) * E, crashSince: t - perf.last('crash', t).t,
    snare: perf.pulse('snare', t, 0.1), hat: perf.pulse('hat', t, 0.08),
    bang: clock.pulse('downbeats', t, 0.16) * E, bangAnt: perf.anticip('downbeat', t, 0.12) * E,
    bob: pump(clock.beatPos(t), 3) * E * 0.6,
    viseme: v, belt: singing ? clamp((S.vocal - 0.55) * 2) : 0,
    expr: singing ? (S.vocal > 0.75 ? 'belt' : 'smile') : ['grin', 'focused', 'grin', 'feel'][bar % 4],
    look: [0.35, 0.25],
    blink: blinkOn(S, 4),
  };
}

function playerPoseAt(S, who, t) {
  const { perf, clock } = S;
  const E = S.E, bp = clock.beatPos(t);
  const bar = Math.floor(clock.barPos(t));
  const base = {
    bf: S.bf,
    bounce: pump(bp + (who === 'belle' ? 0.08 : who === 'ethan' ? 0.04 : 0), 2.5) * E,
    dip: clock.pulse('downbeats', t, 0.2) * E * 0.7,
    lean: Math.sin((bar % 4) * 1.7 + who.length) * 0.4 * E,
    blink: blinkOn(S, who.length),
    look: [hs(who.length, bar) * 0.6, 0.4 + 0.3 * hash(bar, who.length)],
    expr: ['grin', 'feel', 'grin', 'focused'][(bar + who.length) % 4],
  };
  if (who === 'belle') {
    const n = perf.bassNote(t);
    return { ...base, pluck: perf.pulse('bass', t, 0.08), pluckString: n ? n.midi % 4 : 0, fret: n ? clamp((n.midi - 28) / 20) : 0.4 };
  }
  const st = perf.strum(who === 'ethan' ? 'acoustic' : 'electric', t);
  const chord = perf.chord(t);
  const fret = chord ? 0.2 + 0.6 * hash(chord.i, who.length) : 0.25 + 0.5 * hash(who.length, bar);
  return {
    ...base,
    strumDir: st.dir, strumSince: st.since, strumUntil: Number.isFinite(st.gap) ? st.gap - st.since : 1, strumVel: st.vel,
    fret, chord: chord ? chord.i % 5 : bar % 5,
    jump: who === 'brooks' ? S.acc * E : 0,
    bang: who === 'brooks' ? clock.pulse('downbeats', t, 0.18) * E : 0,
    mouth: who === 'ethan' && inHook(t) ? S.vocal * 0.5 : 0,
  };
}

// poses for the four members at S.t, with a lagged copy for hair and clothes follow-through
export function bandPose(S, who) {
  const at = (t) => (who === 'noah' ? noahPoseAt(S, t) : playerPoseAt(S, who, t));
  return withLag(at, S.t);
}

export function stage(P, S, o = {}) {
  const { t, bp, bf } = S;
  const E = o.energy ?? 1;
  const flood = o.flood || FLOODS[Math.floor(S.barPos / 2) % FLOODS.length];
  const kick = S.kick * E, snare = S.snare * E;
  P.fill(rect(-2000, -2000, W + 4000, H + 4000), flood);
  for (let x = -1000; x < W + 1000; x += 96) P.fill(rect(x, -1000, 6, 1900), flood.map((v) => clamp(v + 0.15)));
  for (const [x, y, r] of [[440, 420, 300], [690, 400, 300], [1450, 420, 300], [1010, 330, 290]]) {
    P.glow(x, y, r * (0.85 + 0.3 * kick), flood.map((v) => v * 0.55), 'knock', 0.25);
  }
  if (o.back) o.back(P, flood);
  amp(P, 250, 880, 250, 230);
  amp(P, 1680, 880, 250, 230);
  P.fill(rect(700, 700, 560, 180), K.navy);
  drummer(P, BAND.noah, 1010, o.kitFloor ?? 790, o.kitScale ?? 0.9, bandPose(S, 'noah'));
  player(P, BAND.ethan, 440, 890, 0.95, { ...bandPose(S, 'ethan'), micAt: [58, -452] });
  // in Noah's close-up Belle's bass neck would cut across his face, so she steps out of frame
  if (o.solo !== 'noah') player(P, BAND.belle, 690, 895, 0.95, bandPose(S, 'belle'));
  player(P, BAND.brooks, 1450, 890, 0.97, bandPose(S, 'brooks'));
  P.fill(rect(-2000, 880, W + 4000, 1400), K.ink);
  P.fill(rect(-2000, 880, W + 4000, 8), [0.2, 0.6, 0.7]);
  const popL = (i) => (i % 4 === Math.floor(bp) % 4 ? kick * 0.6 : 0);
  const wide = o.wideLights ? 700 : 60;
  stringLights(P, -wide, 30, W + wide, 70, 110, o.wideLights ? 22 : 15, 0.75 + 0.25 * E, { t, pop: popL, size: 1.5, glow: 0.6 });
  stringLights(P, -wide, 150, W + wide, 110, 80, o.wideLights ? 19 : 13, 0.7 + 0.3 * E, { t, seed: 3, pop: (i) => popL(i + 2), size: 1.3, glow: 0.6 });
  if (o.crowd !== false) {
    crowd(P, { y: 1010, n: 13, seed: 11, scale: 0.72, bounce: E, beatPos: bp, arms: (o.arms ?? 0.3) * 0.7, bf, inks: [0, 0.85, 0.95], t });
    crowd(P, { y: 1085, n: 10, seed: 5, scale: 1.0, bounce: E, beatPos: bp + 0.3, arms: o.arms ?? 0.3, bf, girlAt: o.girl ?? 4, phones: o.phones ?? 0, t });
  }
}

// lyric line painted big on the back wall; text is bare paper, the sung word flips to navy
export function wallWords(words, cx, cy, maxW, size) {
  return (P, S) => stampWords(P, words, S.t, cx, cy, maxW, size, { inks: K.paper, hotInks: K.navy, shadow: K.navy });
}

// close-up framings [x, y, zoom] on each member at the default stage layout
export const CLOSE = {
  noah: [1010, 440, 2.2],
  ethan: [440, 560, 2.15],
  belle: [690, 560, 2.15],
  brooks: [1450, 560, 2.15],
};

// more framings: the kit, a low wide from the crowd, Noah + Brooks, Ethan + Belle
export const FRAME = {
  wide: [960, 540, 1], low: [960, 640, 1.22], kit: [1010, 560, 1.55], duo: [1240, 520, 1.45], left: [590, 540, 1.45],
  ...CLOSE,
};

// o.push: the camera creeps in by that fraction over the shot; o.drift [dx, dy] px over the shot
export function shotStage(P, S, o = {}) {
  const cam = o.cam || [960, 540, 1];
  if (cam === CLOSE.noah) o = { solo: 'noah', ...o };
  const back = o.lyric ? (P2, flood) => { o.lyric(P2, S, flood); o.back?.(P2, flood); } : o.back;
  const u = clamp(S.lt / Math.max(0.5, S.t1 - S.t0));
  const zoom = cam[2] * (1 + (o.push ?? 0.05) * u + 0.03 * S.kick * S.E);
  const [dx, dy] = o.drift ?? [0, 0];
  withCam(P, cam[0] + dx * u, cam[1] + dy * u, zoom, () => stage(P, S, { ...o, back }));
  if (o.confetti) confetti(P, S.t, { t0: o.confetti, n: 80, seed: 4 });
  if (o.overlay) o.overlay(P, S);
}

export function shotCrowd(P, S, o) {
  const { t, bp, bf } = S;
  withCam(P, 960, 400, 0.72, () => stage(P, S, { crowd: false, wideLights: true }));
  crowd(P, { y: 1000, n: 9, seed: 21, scale: 1.1, bounce: 1, beatPos: bp + 0.5, arms: 0.4, bf, inks: [0, 0.85, 0.95], t, phones: o.phones ?? 0 });
  let phoneWords = null;
  if (o.phoneWords) phoneWords = o.phoneWords.map((w) => ({ text: w.w.replace(/[,.]/g, '').toUpperCase(), on: t >= w.t - 0.02, hot: hot(w, t) }));
  crowd(P, { y: 1180, n: phoneWords ? phoneWords.length + 1 : 5, seed: 22, scale: phoneWords ? 1.4 : 1.9, x0: phoneWords ? 40 : -80, x1: phoneWords ? W - 40 : W + 80, bounce: 1, beatPos: bp, arms: o.arms ?? 0.5, bf, girlAt: 2, t, phones: o.phones ?? 0, phoneWords });
  if (o.confetti) confetti(P, t, { t0: o.confetti, n: 70, seed: 4 });
}

// lyric painted on the floor in the empty middle of the ring
function pitFloor(words, t) {
  return (P) => stampWords(P, words, t, W / 2, H / 2 + 30, 640, 104, { inks: K.paper, hotInks: [1, 0, 0], shadow: [0, 0.6, 1], rotJitter: 0.08 });
}

export function shotPit(P, S, o) {
  const words = o.floorWords && o.floorWords.length ? o.floorWords : null;
  pit(P, S.t, { turn: S.barPos * (TAU / 8) * (o.speed || 1), speed: 1, bounce: 1, bf: S.bf, floor: words ? pitFloor(words, S.t) : null });
  if (o.confetti) confetti(P, S.t, { t0: o.confetti, n: 50, seed: 8, speed: 200 });
}

// the girl crowd-surfing across the room, u = 0..1 across
export function surfScene(P, S, u) {
  const { t, bp, bf } = S;
  withCam(P, 960, 380, 0.72, () => stage(P, S, { crowd: false, wideLights: true, flood: FLOODS[3] }));
  crowd(P, { y: 1010, n: 9, seed: 21, scale: 1.1, bounce: 1, beatPos: bp + 0.5, arms: 0.95, bf, inks: [0, 0.85, 0.95], t });
  const x = lerp(-350, 2250, u);
  const y = 500 + Math.sin(bp * Math.PI) * 14;
  P.save();
  P.translate(x, y);
  P.rotate(Math.PI / 2 + Math.sin(S.barPos * Math.PI) * 0.05);
  P.scale(-1, 1);
  girlSide(P, 0, 220, 1.45, { walk: 0.3, phase: bp * Math.PI, armUp: 0.75, bf, shadow: false, blink: blinkOn(S, 4) });
  P.restore();
  crowd(P, { y: 1170, n: 6, seed: 23, scale: 1.8, bounce: 1, beatPos: bp, arms: 0.9, bf, t });
}
