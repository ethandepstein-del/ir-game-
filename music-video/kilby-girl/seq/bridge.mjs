// Bridge + build (2:27.4 - 3:06.8): the darkroom, then the sky and the first fireworks.
import { comet, confetti, photo, shell } from '../lib/extras.mjs';
import { crowd } from '../lib/people.mjs';
import { circle, curve, line, rect } from '../lib/shapes.mjs';
import { clamp, easeInOut, easeOut, inv, lerp } from '../lib/util.mjs';
import { H, K, skyNight, stars, stringLights, W } from '../lib/world.mjs';
import { T } from './songmap.mjs';
import { PH } from './stills.mjs';

const DARK_HITS = [150.5, 151.92, 153.54, 159.38, 161.59, 168.12];

function shotDarkroom(P, S) {
  const { t } = S;
  const pan = (t - T.darkroom) * 26;
  P.fill(rect(-100, -100, W + 200, H + 200), [0.3, 1, 0.05]);
  P.linear(rect(-100, -100, W + 200, 460), 0, -100, 0, 360, [[0, [0.3, 1, 0.8]], [1, [0.3, 1, 0.05]]]);
  P.linear(rect(-100, 760, W + 200, 440), 0, 760, 0, 1180, [[0, [0.3, 1, 0.05]], [1, [0.3, 1, 0.8]]]);
  P.glow(W - 200, 120, 260, [0.9, 0, 0]);
  P.fill(circle(W - 200, 120, 40), [1, 0.4, 0]);
  const lines = [[250, 50], [640, 30]];
  P.save();
  P.translate(-pan, 0);
  for (const [y, sag] of lines) P.stroke(curve([[-200, y], [W / 2 + pan, y + sag], [W + 400 + pan * 2, y]], false), K.ink, 4);
  const contents = [PH.selfie, PH.stage, PH.noah, PH.cat, PH.belle, PH.hand];
  DARK_HITS.forEach((th, i) => {
    if (t < th) return;
    const lt = t - th;
    const x = 360 + i * 420 + (i % 2) * 90;
    const [ly, sag] = lines[i % 2];
    const y = ly + sag * 0.9;
    const drop = easeOut(clamp(lt / 0.25));
    const rot = Math.sin(lt * 5) * 0.25 * Math.exp(-lt * 1.6);
    P.save();
    P.translate(x, lerp(y - 500, y, drop));
    P.rotate(rot);
    photo(P, 0, 250, 440, 0, contents[i], { dev: clamp((lt - 0.4) / 2.5), shadow: false });
    P.fill(rect(-14, -10, 28, 60), K.ink);
    P.restore();
  });
  P.restore();
}

const FIREWORKS = [
  { t0: 183.59, x: 960, y: 400, seed: 3, inks: [1, 0, 0], inks2: [1, 1, 0], n: 96, R: 560, rise: 0.001, life: 2.8 },
  { t0: 184.14, x: 470, y: 290, seed: 5, inks: [0, 1, 0], n: 64, R: 380, kind: 'crackle' },
  { t0: 185.03, x: 1450, y: 330, seed: 7, inks: [1, 0, 0], n: 56, R: 430, kind: 'willow', life: 3.4 },
  { t0: 185.93, x: 760, y: 240, seed: 9, inks: [0, 1, 0], inks2: [1, 0, 0], n: 50, R: 340, kind: 'ring' },
  { t0: 186.38, x: 1230, y: 200, seed: 11, inks: [1, 1, 0], n: 60, R: 360 },
];

function shotSky(P, S) {
  const { t, bf } = S;
  const up = easeInOut(inv(T.buildUp, T.buildUp + 3.5, t));
  skyNight(P, { top: [0, 0.75, 1], mid: [0, 0.5, 1], low: [0.1, 0.55, 0.8] });
  stars(P, S.bp * 0.36, { n: 160, yMax: 1200, seed: 17, twinkle: 1 });
  const off = up * 1200;
  P.save();
  P.translate(0, off);
  const spin = (S.barPos - 117) * 0.03;
  P.translate(W / 2, H / 2);
  P.rotate(spin);
  P.translate(-W / 2, -H / 2);
  const L = 0.8 + 0.2 * S.kick;
  stringLights(P, -300, -200, 2200, 1300, 150, 16, L, { t, size: 1.8 });
  stringLights(P, 2200, -200, -300, 1300, 150, 16, L, { t, seed: 3, size: 1.8 });
  stringLights(P, -300, 540, 2200, 540, 200, 16, L, { t, seed: 6, size: 2.0 });
  P.restore();
  if (t > 179.79 && t < 180.6) {
    const k = (t - 179.79) / 0.8;
    const x = lerp(1500, 700, k), y = lerp(80, 300, k);
    P.stroke(line([[x, y], [x + 220, y - 60]]), K.paper, 6 * (1 - k));
  }
  if (t >= T.final) {
    for (const f of FIREWORKS) shell(P, t, f);
    confetti(P, t, { t0: T.final, n: 60, seed: 21, burst: [960, 400] });
  } else if (t > 180.9) {
    const k = easeInOut(inv(180.9, T.final, t));
    comet(P, lerp(1850, 960, k), lerp(60, 420, k), Math.atan2(360, -890), 520 * (0.5 + k), 0.9 + k * 0.9);
  }
  P.save();
  P.translate(0, lerp(500, 0, up));
  crowd(P, { y: 1200, n: 8, seed: 41, scale: 1.4, bounce: 0.2, beatPos: S.bp, bf, girlAt: 4, t });
  P.restore();
}

export const SHOTS = [
  [T.darkroom, T.build, shotDarkroom],
  [T.build, T.montage, shotSky],
];
export const FLASHES = [T.final];
