// Verse 1 (0:12.5 - 0:38.7): the walk to the show, rain, the flyer fence, her camera.
import { lyricFlyer, stampWords, typeBox, wordsOnPath, appear, hot } from '../lib/lyrics.mjs';
import { girlSide } from '../lib/people.mjs';
import { line, rect, sagPoint, wire } from '../lib/shapes.mjs';
import { clamp, hash, lerp } from '../lib/util.mjs';
import { fence, H, house, K, moon, mountains, pole, sandwichBoard, skyNight, stars, streetlight, stringLights, tree, W } from '../lib/world.mjs';
import { blinkOn, LY, withCam } from './common.mjs';
import { shotBust } from './girl.mjs';
import { T } from './songmap.mjs';

const WALK_V = 330;
const xoAt = (t) => WALK_V * (t - T.titleEnd);
const POLE0 = 200, POLE_GAP = 1150;

// the lower telephone wire, as a function of world x
function wirePoint(wx, xo) {
  const k = Math.floor((wx - POLE0) / POLE_GAP);
  const x0 = k * POLE_GAP + POLE0 - xo, x1 = x0 + POLE_GAP;
  const u = (wx - xo - x0) / POLE_GAP;
  const [x, y] = sagPoint(x0, 390, x1, 390, 50, u);
  const dy = 50 * 4 * (1 - 2 * u) / POLE_GAP;
  return [x, y, Math.atan(dy)];
}

export function walkWorld(P, S, { night = false, walkerX = 760, walk = 1, scrollT = null, girl = true, lamps = true, wireWords = null, chalk = null } = {}) {
  const { t, bp, bf } = S;
  const xo = scrollT != null ? WALK_V * scrollT : xoAt(t);
  if (night) skyNight(P); else P.linear(rect(-400, -400, W + 800, H + 800), 0, 0, 0, 760, [[0, [0, 0.5, 1]], [0.55, [0.08, 0.62, 0.72]], [1, [0.7, 0.85, 0.2]]]);
  stars(P, t, { n: night ? 90 : 40, yMax: 520, seed: 9, twinkle: 0.4 });
  moon(P, 1450, 170, 46);
  mountains(P, { base: 720, amp: 250, seed: 4, inks: [0.05, 0.62, 0.85], snow: true });
  const hx = xo * 0.55;
  for (let i = Math.floor((hx - 400) / 420); i * 420 - hx < W + 400; i++) {
    const x = i * 420 - hx;
    tree(P, x - 40, 880, 240 + hash(i, 4) * 60, i, [0, 0.9, 1]);
    house(P, x + 20, 880, 270 + hash(i) * 50, 170 + hash(i, 2) * 40, i + 20, { t, lit: night ? 0.75 : 0.45 });
  }
  P.fill(rect(-400, 872, W + 800, 30), [0.55, 0.3, 0.95]);
  P.fill(rect(-400, 900, W + 800, 90), [0.12, 0.2, 0.22]);
  for (let x = -((xo % 160) + 160) % 160 - 160; x < W + 160; x += 160) P.fill(rect(x, 900, 4, 90), [0.3, 0.45, 0.5]);
  P.fill(rect(-400, 990, W + 800, 14), [0.2, 0.4, 0.5]);
  P.fill(rect(-400, 1004, W + 800, 200), [0.1, 0.75, 0.9]);
  // chalk lyrics on the sidewalk scroll with the ground
  if (chalk) {
    const { words, s0 } = chalk;
    let s = s0;
    words.forEach((w, i) => {
      const f = '96px "Caveat Brush"';
      const ww = P.measure(w.w, f);
      const a = appear(w, t, 0.2);
      if (a > 0) {
        const x = s - xo;
        P.save();
        P.clip(rect(x - 10, 880, (ww + 20) * a, 130));
        P.text(w.w, x, 978, f, hot(w, t) ? [1, 0, 0] : [[0, 1, 0], [1, 0.1, 0], [0, 0.1, 0.9]][i % 3], { align: 'left' });
        P.restore();
      }
      s += ww + 40;
    });
  }
  // poles + wires (foreground plane moves with the ground)
  const polesAt = [];
  for (let i = Math.floor((xo - 400) / POLE_GAP); i * POLE_GAP - xo < W + 400; i++) polesAt.push(i * POLE_GAP - xo + POLE0);
  for (let k = 0; k < polesAt.length - 1; k++) {
    P.stroke(wire(polesAt[k], 350, polesAt[k + 1], 350, 50), K.ink, 3);
    P.stroke(wire(polesAt[k], 390, polesAt[k + 1], 390, 50), K.ink, 3);
  }
  for (const x of polesAt) pole(P, x, 930, 590);
  // lyric letters clipped to the lower wire like laundry
  if (wireWords) wordsOnPath(P, wireWords.words, t, (s) => wirePoint(s, xo), wireWords.s0, 64, { card: [0.02, 0.02, 0], inks: K.navy, hotInks: [0.2, 1, 0.1], hang: 0.05, spacing: 0.5 });
  if (lamps) for (let i = Math.floor((xo - 900) / 1700); i * 1700 - xo < W + 900; i++) streetlight(P, i * 1700 - xo + 850, 940, 420, night ? 1 : 0.7, t);
  if (girl) {
    const phase = Math.PI / 2 + (Math.PI / 2) * bp;
    girlSide(P, walkerX, 950, 1.08, { phase, walk, bf, hairLag: Math.sin(phase * 2) * walk, blink: blinkOn(S, 3) });
  }
}

function shotWalk(P, S, o) {
  const L0 = LY.line('v1_1');
  const wireWords = L0.words.length && { words: L0.words, s0: 820 + xoAt(L0.words[0].t) };
  if (o.close) {
    withCam(P, 800, 640, 2.1, () => walkWorld(P, S, { night: false, wireWords }));
    rain(P, S, LY.line('v1_2'));
    stampWords(P, LY.line('v1_2').words, S.t, 1480, 520, 760, 118, { inks: K.paper, hotInks: [1, 0, 0], shadow: [0, 0.8, 0.8] });
  } else if (o.night) {
    const L2 = LY.line('v1_3');
    const chalk = L2.words.length && { words: L2.words, s0: 880 + xoAt(L2.words[0].t) };
    walkWorld(P, S, { night: true, chalk, wireWords });
  } else walkWorld(P, S, { night: false, wireWords });
}

// rain that starts on the word "raining"
function rain(P, S, line2) {
  if (!line2.words.length) return;
  const t0 = line2.words[1]?.t ?? line2.start;
  const k = clamp((S.t - t0) / 0.6);
  if (k <= 0) return;
  const n = Math.floor(90 * k);
  for (let i = 0; i < n; i++) {
    const speed = 1500 + hash(i, 2) * 500;
    const x = (hash(i, 1) * (W + 400) - 200 + (S.t * speed * 0.18)) % (W + 400) - 100;
    const y = ((hash(i, 3) * (H + 300)) + S.t * speed) % (H + 300) - 150;
    P.stroke(line([[x, y], [x - 12, y + 60]]), K.paper, 3);
  }
}

// ------------------------------------------------------------------ the fence with the lyric flyers
const FLYERS = [[450, 650, 330, 420, -0.08], [880, 700, 300, 390, 0.05], [1240, 640, 330, 420, -0.04], [1620, 700, 350, 430, 0.07]];

function fenceWorld(P, S) {
  const { t, bf, bp } = S;
  skyNight(P);
  stars(P, t, { n: 80, yMax: 380, seed: 12 });
  moon(P, 1650, 150, 50);
  fence(P, -20, 1940, 430, 1000, 3);
  const L = 0.7 + 0.3 * S.kick;
  stringLights(P, -60, 250, 1980, 300, 120, 14, L, { t, size: 1.4 });
  stringLights(P, -60, 330, 1980, 360, 90, 12, L, { t, seed: 5, size: 1.2 });
  const w = LY.line('v1_4').words;
  if (w.length) {
    const chunks = [w.slice(0, 3), w.slice(3, 6), w.slice(6, 9), w.slice(9)];
    chunks.forEach((c, i) => lyricFlyer(P, c, t, ...FLYERS[i], i + 1));
  }
  P.fill(rect(-100, 1000, W + 200, 100), [0.15, 0.3, 0.4]);
  sandwichBoard(P, 170, 1050, 1.0, [['ALL AGES', 58, K.paper], ['SHOW', 66, [1, 0, 0]], ['TONIGHT', 56, K.paper]]);
  const u = clamp((t - T.fence) / 2.2);
  const x = lerp(-200, 620, u);
  const walking = u < 1 ? 1 : 0;
  const phase = Math.PI / 2 + (Math.PI / 2) * bp;
  girlSide(P, x, 1010, 1.1, { phase: walking ? phase : Math.PI, walk: walking, bf, hairLag: Math.sin(phase * 2) * walking, look: 1 - walking, blink: blinkOn(S, 5) });
}

function shotFence(P, S, o) {
  if (o.close) withCam(P, 1180, 690, 1.65, () => fenceWorld(P, S));
  else fenceWorld(P, S);
}

export const SHOTS = [
  [T.titleEnd, T.walkClose, shotWalk, {}],
  [T.walkClose, T.walkNight, shotWalk, { close: true }],
  [T.walkNight, T.fence, shotWalk, { night: true }],
  [T.fence, T.fenceClose, shotFence, {}],
  [T.fenceClose, T.bust, shotFence, { close: true }],
  [T.bust, T.stops, shotBust, { camera: [T.bust + 0.6, T.stops - 0.3], lookY: 0, s: 1.15, cy: 560, captionWords: () => LY.line('h1_1').words.filter((w) => w.t < T.stops - 0.1) }],
];
export const FLASHES = [];
