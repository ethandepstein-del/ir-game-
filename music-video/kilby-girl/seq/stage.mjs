// The show: Kilby Court's stage with the band, lights and crowd, plus the crowd and pit shots.
// Used by several sequences; its exports keep their signatures (add options, don't break them).
import { BAND, drummerArms, drummerBody, player } from '../lib/band.mjs';
import { confetti, pit } from '../lib/extras.mjs';
import { hot, stampWords } from '../lib/lyrics.mjs';
import { amp, crowd, drumkit, girlSide } from '../lib/people.mjs';
import { rect } from '../lib/shapes.mjs';
import { clamp, hash, hs, lerp, TAU } from '../lib/util.mjs';
import { H, K, stringLights, W } from '../lib/world.mjs';
import { blinkOn, FLOODS, withCam } from './common.mjs';

const HOOK = [[37, 60], [123, 148]];
export const inHook = (t) => HOOK.some(([a, b]) => t >= a && t < b);

export function bandPose(S, who) {
  const E = S.E;
  const bob = Math.abs(Math.sin(Math.PI * S.bp)) * E;
  const bar = Math.floor(S.barPos);
  const lean = Math.sin(Math.PI * S.barPos * 0.5 + hash(who.length) * 3) * 0.5 * E;
  return {
    bf: S.bf, bob, lean, nod: S.kick * 0.7 * E,
    strum: who === 'belle' ? S.bp % 1 : (S.bp * 2) % 1,
    fret: 0.25 + 0.5 * hash(who.length, bar),
    jump: who === 'brooks' ? S.acc * E : 0,
    blink: blinkOn(S, who.length),
    look: [hs(who.length, bar) * 0.6, 0.45 + 0.3 * hash(bar, who.length)],
    mouth: who === 'ethan' && inHook(S.t) ? S.vocal * 0.55 : 0,
  };
}

export function stage(P, S, o = {}) {
  const { t, bp, bf } = S;
  const E = o.energy ?? 1;
  const flood = o.flood || FLOODS[Math.floor(S.barPos / 2) % FLOODS.length];
  const kick = S.kick * E, snare = S.snare * E;
  P.fill(rect(-2000, -2000, W + 4000, H + 4000), flood);
  for (let x = -1000; x < W + 1000; x += 96) P.fill(rect(x, -1000, 6, 1900), flood.map((v) => clamp(v + 0.15)));
  for (const [x, y, r] of [[440, 420, 300], [760, 400, 300], [1420, 420, 300], [1010, 300, 280]]) {
    P.glow(x, y, r * (0.85 + 0.3 * kick), flood.map((v) => v * 0.55), 'knock', 0.25);
  }
  if (o.back) o.back(P, flood);
  amp(P, 250, 880, 250, 230);
  amp(P, 1680, 880, 250, 230);
  P.fill(rect(700, 700, 560, 180), K.navy);
  const noah = { ...bandPose(S, 'noah'), mouth: S.vocal };
  drummerBody(P, BAND.noah, 1010, 535, 0.9, { bf, bob: noah.bob, mouth: noah.mouth, blink: noah.blink, lean: noah.lean * 0.5, look: [0.2, 0.3] });
  drumkit(P, 1010, 700, 0.7, { bf, kick, snare, crash: S.crash * E, drummer: false });
  const hat = Math.pow(1 - ((bp * 2) % 1), 4);
  drummerArms(P, BAND.noah, 1010, 535, 0.9, { snare, hat: hat * E, crash: S.crash * E, bob: noah.bob, lean: noah.lean * 0.5 });
  player(P, BAND.ethan, 440, 890, 0.95, { ...bandPose(S, 'ethan'), micAt: [58, -452] });
  player(P, BAND.belle, 760, 895, 0.95, bandPose(S, 'belle'));
  player(P, BAND.brooks, 1420, 890, 0.97, bandPose(S, 'brooks'));
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
  noah: [1010, 420, 2.3],
  ethan: [440, 560, 2.15],
  belle: [760, 560, 2.15],
  brooks: [1420, 560, 2.15],
};

export function shotStage(P, S, o = {}) {
  const cam = o.cam || [960, 540, 1];
  const back = o.lyric ? (P2, flood) => { o.lyric(P2, S, flood); o.back?.(P2, flood); } : o.back;
  withCam(P, cam[0], cam[1], cam[2], () => stage(P, S, { ...o, back }));
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
