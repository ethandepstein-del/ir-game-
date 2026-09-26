// Outro (3:45.5 - end): the night's photos land on the stabs, the walk home, the end card.
import { bigType } from '../lib/extras.mjs';
import { rect } from '../lib/shapes.mjs';
import { clamp, easeOut, lerp } from '../lib/util.mjs';
import { H, K, W } from '../lib/world.mjs';
import { photoPile } from './common.mjs';
import { T } from './songmap.mjs';
import { PH } from './stills.mjs';
import { walkWorld } from './verse1.mjs';

const OUTRO_HITS = [225.52, 227.72, 231.21, 232.99, 234.76, 236.54];
const OUTRO_PHOTOS = [PH.finale, PH.crowdsurf, PH.noah, PH.selfie, PH.stage, PH.mountains];
const OUTRO_PILE = [[560, 420, 640, -0.1], [1360, 400, 640, 0.09], [960, 700, 660, 0.02], [420, 800, 560, 0.12], [1500, 820, 580, -0.12], [960, 480, 760, -0.03]];

function shotOutro(P, S) {
  photoPile(P, S, OUTRO_HITS, OUTRO_PHOTOS, OUTRO_PILE);
}

function shotRingout(P, S) {
  const { t } = S;
  const lt = t - T.ringout;
  const walkerX = lerp(700, 2150, clamp(lt / 5.2));
  walkWorld(P, S, { night: true, walkerX, scrollT: 40, girl: lt < 5.4 });
  if (t > T.endCard) {
    const k = easeOut(clamp((t - T.endCard) / 0.6));
    P.alpha(k * 0.85).fill(rect(-100, -100, W + 200, H + 200), [0.25, 1, 1]).alpha(1);
    P.alpha(k);
    bigType(P, 'THE BED HEADS', W / 2, 400, 96, [1, 0, 0], { font: '"Rubik Mono One"', shadow: [0, 1, 0], off: [6, 6] });
    bigType(P, 'KILBY GIRL', W / 2, 640, 200, [0, 1, 0], { shadow: [1, 0, 0], off: [10, 8] });
    P.text('Noah · Brooks · Belle · Ethan', W / 2, 760, '42px "Special Elite"', K.paper);
    P.text('song by The Backseat Lovers', W / 2, 830, '30px "Special Elite"', [0, 0.35, 0.3]);
    P.alpha(1);
  }
}

export const SHOTS = [
  [T.outro, T.ringout, shotOutro],
  [T.ringout, T.end + 1, shotRingout],
];
export const FLASHES = OUTRO_HITS;
