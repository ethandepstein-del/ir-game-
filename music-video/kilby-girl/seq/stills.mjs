// Photo subjects: frozen moments of the night, drawn inside polaroids (her camera roll).
// Each is (P) => void drawing a full 1920x1080 frame at a fixed moment.
import { cassette, bulb, cat, handX, moth, pit, bigType } from '../lib/extras.mjs';
import { crowd, girlBust } from '../lib/people.mjs';
import { rect } from '../lib/shapes.mjs';
import { fence, H, K, moon, mountains, sandwichBoard, skyNight, stars, stringLights, W } from '../lib/world.mjs';
import { bandPoster, bokeh, FLOODS, makeS, withCam } from './common.mjs';
import { CLOSE, stage, surfScene } from './stage.mjs';

// a frozen moment: the shot drawn at song time t, whatever time the photo appears
const still = (fn, t) => (P) => fn(P, { ...makeS(t), frozen: true });

export const PH = {
  lights: still((P) => {
    skyNight(P); stars(P, 2, { n: 60 }); moon(P, 1500, 220, 70);
    stringLights(P, -60, 120, 1980, 300, 220, 12, 1, { size: 2.2 });
    stringLights(P, -60, 520, 1980, 380, 200, 12, 1, { size: 2.6, seed: 4 });
  }, 1),
  flyer: still((P) => { fence(P, -20, 1940, 0, 1100, 7); bandPoster(P, 960, 560, 1.4, 0.05); }, 1),
  hand: still((P) => { P.fill(rect(0, 0, W, H), [0.9, 0.2, 0]); handX(P, 960, 640, 1.2); }, 1),
  noah: still((P, S) => withCam(P, ...CLOSE.noah.slice(0, 2), 2.0, () => stage(P, S, { flood: FLOODS[1], crowd: false })), 70),
  selfie: still((P) => { bokeh(P, 3); girlBust(P, 960, 600, 1.55, { happy: 1, smile: 1 }); }, 3),
  mountains: still((P) => { skyNight(P); stars(P, 1, { n: 90 }); moon(P, 1400, 260, 90); mountains(P, { base: 1080, amp: 520, seed: 4, inks: [0.05, 0.62, 0.85], snow: true, step: 110 }); }, 1),
  brooks: still((P, S) => withCam(P, ...CLOSE.brooks.slice(0, 2), 2.0, () => stage(P, S, { flood: FLOODS[1], crowd: false })), 74),
  board: still((P) => { skyNight(P); stars(P, 4, { n: 50 }); sandwichBoard(P, 960, 1180, 3.2, [['ALL AGES', 64, K.paper], ['SHOW', 70, [1, 0, 0]], ['TONIGHT', 60, K.paper]]); }, 1),
  phones: still((P) => { P.fill(rect(0, 0, W, H), [1, 0.4, 0]); crowd(P, { y: 1150, n: 7, seed: 9, scale: 1.7, arms: 0.9, phones: 0.8, t: 1 }); }, 1),
  cat: still((P) => { skyNight(P); stars(P, 5, { n: 60 }); moon(P, 1450, 300, 110); P.fill(rect(0, 760, W, 400), [0.35, 0.55, 0.55]); cat(P, 900, 650, 2.1); }, 1),
  belle: still((P, S) => withCam(P, ...CLOSE.belle.slice(0, 2), 2.0, () => stage(P, S, { flood: FLOODS[3], crowd: false })), 80),
  moth: still((P) => { P.fill(rect(0, 0, W, H), [0.3, 1, 1]); bulb(P, 960, -60, 420, 0, 1, { size: 2 }); moth(P, 1250, 300, 2.5, 1); moth(P, 700, 520, 1.8, 2); }, 1),
  ethan: still((P, S) => withCam(P, ...CLOSE.ethan.slice(0, 2), 2.0, () => stage(P, S, { flood: FLOODS[0], crowd: false })), 83),
  tape: still((P) => { P.fill(rect(0, 0, W, H), [0, 0.1, 0.8]); cassette(P, 960, 560, 1.4, -0.08); }, 1),
  stage: still((P, S) => stage(P, S, { flood: FLOODS[0], arms: 0.5 }), 62.5),
  crowdsurf: still((P, S) => surfScene(P, S, 0.45), 212),
  pit: still((P, S) => pit(P, S.t, { turn: 1.2 }), 130),
  finale: still((P, S) => stage(P, S, { flood: FLOODS[1], arms: 0.8, back: (P2) => bigType(P2, 'KILBY GIRL', 960, 470, 300, [1, 0, 0], { shadow: [0, 0, 1] }) }), 200),
};

// build a still from any shot function at a fixed song time (for new photo subjects)
export { still };
