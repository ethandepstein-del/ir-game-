// Final section (3:06.8 - 3:45.5, 134.7 BPM): half-bar montage, the marquee finale, crowd surf, pit.
import { bigType, cassette, confetti, marquee } from '../lib/extras.mjs';
import { rect } from '../lib/shapes.mjs';
import { inv } from '../lib/util.mjs';
import { H, W } from '../lib/world.mjs';
import { FLOODS } from './common.mjs';
import { shotBust } from './girl.mjs';
import { T } from './songmap.mjs';
import { CLOSE, shotCrowd, shotPit, shotStage, surfScene } from './stage.mjs';

function shotSurf(P, S) {
  surfScene(P, S, inv(T.surf, T.pitEnd, S.t));
  confetti(P, S.t, { t0: T.surf - 1, n: 60, seed: 12, speed: 180 });
}

function shotFinale(P, S, o) {
  const { t } = S;
  shotStage(P, S, {
    ...o,
    arms: 0.8,
    back: (P2) => {
      marquee(P2, 300, 'KILBY GIRL • THE BED HEADS • ', 150, S.bp * 70, [0, 0, 1], { band: [1, 0.06, 0], h: 150 });
      marquee(P2, 520, 'NOAH • BROOKS • BELLE • ETHAN • ', 110, -S.bp * 55, [1, 0, 0], { band: [0, 1, 0.9], h: 110 });
    },
  });
  confetti(P, t, { t0: T.finale - 1.5, n: 90, seed: 7, speed: 230 });
}

const MONTAGE = [
  (P, S) => shotStage(P, S, { flood: FLOODS[1], arms: 0.7 }),
  (P, S) => shotStage(P, S, { cam: CLOSE.noah, flood: FLOODS[2] }),
  (P, S) => shotPit(P, S, { speed: 1.5 }),
  (P, S) => shotStage(P, S, { cam: CLOSE.brooks, flood: FLOODS[3] }),
  (P, S) => shotBust(P, S, { happy: true, s: 1.4, cy: 620 }),
  (P, S) => shotStage(P, S, { cam: CLOSE.belle, flood: FLOODS[0] }),
  (P, S) => { P.fill(rect(-100, -100, W + 200, H + 200), [0, 0, 1]); bigType(P, 'KILBY', W / 2, 520, 420, [1, 0, 0], { shadow: [0, 1, 0], off: [16, 14] }); bigType(P, 'GIRL', W / 2, 960, 420, [0, 1, 0], { shadow: [1, 0, 0], off: [16, 14] }); },
  (P, S) => shotStage(P, S, { cam: CLOSE.ethan, flood: FLOODS[1] }),
  (P, S) => shotCrowd(P, S, { arms: 0.9 }),
  (P, S) => { P.fill(rect(-100, -100, W + 200, H + 200), [1, 0.06, 0]); cassette(P, 960, 560, 1.5, Math.sin(S.bp * Math.PI / 2) * 0.1, 'KILBY GIRL', S.bp * 2); },
];

// cuts on every half bar (where the finale's stabs land)
function shotMontage(P, S) {
  const idx = Math.floor(S.barPos * 2 + 1e-3);
  MONTAGE[((idx * 7) % MONTAGE.length + MONTAGE.length) % MONTAGE.length](P, S);
}

export const SHOTS = [
  [T.montage, T.finale, shotMontage],
  [T.finale, T.surf, shotFinale, {}],
  [T.surf, T.pitEnd, shotSurf],
  [T.pitEnd, T.outro, (P, S) => shotPit(P, S, { speed: 1.6, confetti: 219 })],
];
export const FLASHES = [];
