// Hook 2 (2:03.0 - 2:27.4): a new framing on every bar; each line lives somewhere in the room
// (the back wall, the pit floor, the crowd's phones), and the punch words slam on top.
import { LY } from './common.mjs';
import { T } from './songmap.mjs';
import { FRAME, shotCrowd, shotPit, shotStage, wallWords } from './stage.mjs';

const wall = (id, ...a) => (P, S) => wallWords(LY.line(id).words, ...a)(P, S);
const stage = (f, o = {}) => [shotStage, { cam: FRAME[f], ...o }];
const pit = (id, o = {}) => [(P, S) => shotPit(P, S, { floorWords: LY.line(id).words, ...o }), {}];

// [downbeat, shot, opts, transition in]
const CUTS = [
  [123.03, ...stage('wide', { arms: 0.7, confetti: T.hook2, lyric: wall('h2_1', 960, 268, 1800, 96) }), { kind: 'slam', dur: 0.3 }],
  [124.48, ...stage('noah', { lyric: wall('h2_1', 1010, 318, 700, 46) })],
  [125.92, ...pit('h2_2'), { kind: 'tear', dur: 0.3, seed: 3 }],
  [127.39, ...pit('h2_2', { speed: 1.6 })],
  [128.84, ...stage('noah', { lyric: wall('h2_3', 1010, 318, 700, 46) })],
  [130.32, ...stage('wide', { arms: 0.8, push: 0, lyric: wall('h2_3', 960, 240, 1800, 90) })],
  [131.77, (P, S) => shotCrowd(P, S, { arms: 0.8, phoneWords: LY.line('h2_4').words, confetti: 131 }), {}, { kind: 'whip', dur: 0.24, dir: 0 }],
  [133.21, ...stage('noah', { push: 0.12 })],
  [134.66, ...stage('brooks', { overlay: wall('h2_5', 420, 190, 640, 88) })],
  [136.1, ...stage('wide', { arms: 0.9, lyric: wall('h2_5', 960, 268, 1800, 96) })],
  [137.58, ...stage('belle', { overlay: wall('h2_5', 1500, 190, 640, 88) })],
  [139.02, ...stage('kit')],
  [140.5, ...pit('h2_6', { speed: 1.3, confetti: 140 }), { kind: 'whip', dur: 0.24, dir: Math.PI }],
  [141.94, ...pit('h2_6', { speed: 1.8 })],
  [143.4, ...stage('wide', { arms: 0.9, confetti: 143, lyric: wall('h2_7', 960, 268, 1800, 96) }), { kind: 'slam', dur: 0.25 }],
  [144.83, ...stage('noah', { push: 0.1 })],
  [146.29, ...stage('duo', { arms: 0.9 })],
];

export const SHOTS = CUTS.map(([t0, fn, o, tr], i) => [t0, i + 1 < CUTS.length ? CUTS[i + 1][0] : T.bridge, fn, o, tr]);
export const FLASHES = [T.hook2];
