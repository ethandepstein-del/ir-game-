// Hook 1 (0:38.7 - 1:01.6): her camera roll. A photo lands on every hit and the camera snaps to
// it; the lines are handwritten on the photos, the punch words slam, and we cut to Noah for the
// lines he sings about himself.
import { spring } from '../lib/fx.mjs';
import { clamp, easeInOut, lerp } from '../lib/util.mjs';
import { H, W } from '../lib/world.mjs';
import { captionsFor, LY, photoPile } from './common.mjs';
import { T } from './songmap.mjs';
import { FRAME, shotStage } from './stage.mjs';
import { PH } from './stills.mjs';

const STOP_HITS = [38.66, 40.3, 41.56, 42.99, 45.92, 47.36, 48.83, 51.74, 53.2, 54.61, 56.11, 57.54, 59.03, 60.46];
const PILE = [
  [520, 330, 560, -0.12], [1400, 300, 540, 0.1], [960, 620, 600, 0.03], [360, 780, 520, 0.14], [1560, 760, 560, -0.09],
  [860, 250, 480, 0.18], [1180, 860, 520, -0.16], [260, 380, 470, -0.2], [1680, 420, 480, 0.2], [640, 900, 520, 0.08],
  [1320, 560, 560, -0.05], [560, 560, 540, 0.11], [1720, 980, 460, -0.14], [960, 440, 720, -0.02],
];
const STOP_PHOTOS = [PH.lights, PH.flyer, PH.hand, PH.noah, PH.selfie, PH.mountains, PH.brooks, PH.board, PH.phones, PH.belle, PH.ethan, PH.moth, PH.tape, PH.stage];
const ZOOM_LAST = [STOP_HITS[STOP_HITS.length - 1] + 0.35, T.brk1];

function shotStops(P, S) {
  const { t } = S;
  const words = LY.wordsOf('h1_1', 'h1_2', 'h1_3', 'h1_4', 'h1_5', 'h1_6', 'h1_7').filter((w) => w.t >= STOP_HITS[0] - 1.4);
  // the camera snaps (with a little overshoot) to each photo as it lands
  let n = 0;
  while (n < STOP_HITS.length && STOP_HITS[n] <= t) n++;
  const at = (i) => (i < 0 ? [W / 2, H / 2] : PILE[i].slice(0, 2));
  const k = n ? spring(t - STOP_HITS[n - 1], { freq: 2.6, damp: 9 }) : 0;
  const [px, py] = at(n - 2), [qx, qy] = at(n - 1);
  const settle = easeInOut(clamp((t - ZOOM_LAST[0] + 0.3) / 0.3));
  const zoom = lerp(1.3 - 0.04 * clamp(k - 1, -1, 1), 1, settle);
  const half = [W / 2 / zoom, H / 2 / zoom];
  const cx = lerp(clamp(lerp(px, qx, k), half[0], W - half[0]), W / 2, settle);
  const cy = lerp(clamp(lerp(py, qy, k), half[1], H - half[1]), H / 2, settle);
  P.save();
  P.translate(W / 2, H / 2);
  P.scale(zoom);
  P.translate(-cx, -cy);
  photoPile(P, S, STOP_HITS, STOP_PHOTOS, PILE, { zoomLast: ZOOM_LAST, captions: captionsFor(STOP_HITS, words) });
  P.restore();
}

const noah = [shotStage, { cam: FRAME.noah, push: 0.1 }];
export const SHOTS = [
  [T.hook1, 45.51, shotStops, {}, { kind: 'slam', dur: 0.25 }],
  [45.51, 47.0, ...noah, { kind: 'whip', dur: 0.22, dir: -Math.PI / 2 }],
  [47.0, 57.19, shotStops, {}, { kind: 'whip', dur: 0.22, dir: Math.PI / 2 }],
  [57.19, 58.66, ...noah, { kind: 'slam', dur: 0.2 }],
  [58.66, T.brk1, shotStops, {}, { kind: 'tear', dur: 0.3, seed: 2 }],
];
// paper-white camera-shutter flashes
export const FLASHES = STOP_HITS;
