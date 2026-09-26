// Hook 1 (0:38.7 - 1:01.6): the photo pile, one photo per hit, captioned in marker.
import { captionsFor, LY, photoPile } from './common.mjs';
import { T } from './songmap.mjs';
import { PH } from './stills.mjs';

const STOP_HITS = [38.66, 40.3, 41.56, 42.99, 45.92, 47.36, 48.83, 51.74, 53.2, 54.61, 56.11, 57.54, 59.03, 60.46];
const PILE = [
  [520, 330, 560, -0.12], [1400, 300, 540, 0.1], [960, 620, 600, 0.03], [360, 780, 520, 0.14], [1560, 760, 560, -0.09],
  [860, 250, 480, 0.18], [1180, 860, 520, -0.16], [260, 380, 470, -0.2], [1680, 420, 480, 0.2], [640, 900, 520, 0.08],
  [1320, 560, 560, -0.05], [560, 560, 540, 0.11], [1720, 980, 460, -0.14], [960, 440, 720, -0.02],
];
const STOP_PHOTOS = [PH.lights, PH.flyer, PH.hand, PH.noah, PH.selfie, PH.mountains, PH.brooks, PH.board, PH.phones, PH.belle, PH.ethan, PH.moth, PH.tape, PH.stage];

function shotStops(P, S) {
  const words = LY.wordsOf('h1_1', 'h1_2', 'h1_3', 'h1_4', 'h1_5', 'h1_6', 'h1_7').filter((w) => w.t >= STOP_HITS[0] - 1.4);
  photoPile(P, S, STOP_HITS, STOP_PHOTOS, PILE, { zoomLast: [STOP_HITS[STOP_HITS.length - 1] + 0.35, T.brk1], captions: captionsFor(STOP_HITS, words) });
}

export const SHOTS = [
  [T.hook1, T.brk1, shotStops],
];
// paper-white camera-shutter flashes
export const FLASHES = STOP_HITS;
