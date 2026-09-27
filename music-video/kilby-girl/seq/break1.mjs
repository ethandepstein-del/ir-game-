// Instrumental break 1 (1:01.6 - 1:25.6): the band at full tilt, a new framing on every bar.
import { bigType } from '../lib/extras.mjs';
import { K } from '../lib/world.mjs';
import { T } from './songmap.mjs';
import { FRAME, shotCrowd, shotStage } from './stage.mjs';

const title = (P) => bigType(P, 'KILBY GIRL', 960, 300, 200, [0, 0, 0], { shadow: K.navy, off: [8, 7] });
const cam = (f, o = {}) => [shotStage, { cam: FRAME[f], ...o }];

// [downbeat, shot, opts, transition in]
const CUTS = [
  [61.59, ...cam('wide', { arms: 0.5, back: title }), { kind: 'slam', dur: 0.3 }],
  [63.02, ...cam('noah')],
  [64.48, ...cam('low', { arms: 0.6, drift: [-60, 0] })],
  [65.94, ...cam('brooks')],
  [67.42, ...cam('noah', { push: 0.08 })],
  [68.87, ...cam('left', { drift: [40, 0] })],
  [70.3, ...cam('kit')],
  [71.74, (P, S) => shotCrowd(P, S, { arms: 0.8 }), {}, { kind: 'whip', dur: 0.24, dir: 0 }],
  [73.2, ...cam('brooks', { push: 0.1 })],
  [74.62, ...cam('belle')],
  [76.06, ...cam('duo'), { kind: 'whip', dur: 0.24, dir: Math.PI }],
  [77.52, ...cam('ethan')],
  [78.99, ...cam('noah', { push: 0.08 })],
  [80.48, ...cam('kit', { drift: [0, -30] })],
  [81.95, ...cam('noah')],
  [83.41, ...cam('wide', { arms: 0.8, back: title })],
  [84.86, ...cam('noah', { push: 0.14 })],
];

export const SHOTS = CUTS.map(([t0, fn, o, tr], i) => [t0, i + 1 < CUTS.length ? CUTS[i + 1][0] : T.verse2, fn, o, tr]);
export const FLASHES = [T.brk1];
