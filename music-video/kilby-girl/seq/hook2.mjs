// Hook 2 (2:03.0 - 2:27.4): two-bar cuts, each line living somewhere in the room.
import { LY } from './common.mjs';
import { T } from './songmap.mjs';
import { CLOSE, shotCrowd, shotPit, shotStage, wallWords } from './stage.mjs';

const wall = (id, ...a) => (P, S) => wallWords(LY.line(id).words, ...a)(P, S);

export const SHOTS = [
  [T.hook2, T.h2b, shotStage, { arms: 0.6, confetti: T.hook2, lyric: wall('h2_1', 960, 268, 1800, 96) }],
  [T.h2b, T.h2c, (P, S) => shotPit(P, S, { floorWords: LY.line('h2_2').words })],
  [T.h2c, T.h2d, shotStage, { cam: CLOSE.noah, lyric: wall('h2_3', 1010, 258, 820, 50) }],
  [T.h2d, T.h2e, (P, S) => shotCrowd(P, S, { arms: 0.8, phoneWords: LY.line('h2_4').words, confetti: 131 })],
  [T.h2e, T.h2f, shotStage, { cam: CLOSE.brooks, overlay: wall('h2_5', 430, 300, 640, 92) }],
  [T.h2f, T.h2g, shotStage, { cam: CLOSE.belle, overlay: wall('h2_5', 1490, 300, 640, 92) }],
  [T.h2g, T.h2h, (P, S) => shotPit(P, S, { floorWords: LY.line('h2_6').words, speed: 1.3, confetti: 140 })],
  [T.h2h, T.bridge, shotStage, { arms: 0.9, confetti: 143, lyric: wall('h2_7', 960, 268, 1800, 96) }],
];
export const FLASHES = [T.hook2];
