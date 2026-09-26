// Instrumental break 1 (1:01.6 - 1:25.6): the band, one of them at a time.
import { bigType } from '../lib/extras.mjs';
import { K } from '../lib/world.mjs';
import { T } from './songmap.mjs';
import { CLOSE, shotStage } from './stage.mjs';

export const SHOTS = [
  [T.brk1, T.noahC, shotStage, { arms: 0.35, back: (P) => bigType(P, 'KILBY GIRL', 960, 300, 200, [0, 0, 0], { shadow: K.navy, off: [8, 7] }) }],
  [T.noahC, T.brooksC, shotStage, { cam: CLOSE.noah }],
  [T.brooksC, T.belleC, shotStage, { cam: CLOSE.brooks }],
  [T.belleC, T.ethanC, shotStage, { cam: CLOSE.belle }],
  [T.ethanC, T.verse2, shotStage, { cam: CLOSE.ethan }],
];
export const FLASHES = [T.brk1];
