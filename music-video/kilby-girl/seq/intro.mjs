// Intro (0:00 - 0:12.5): the title over the Wasatch, letters stamped on the beat.
import { bigType } from '../lib/extras.mjs';
import { curve, star } from '../lib/shapes.mjs';
import { backOut, clamp, easeOut, hs, lerp } from '../lib/util.mjs';
import { H, K, moon, mountains, skyNight, stars, W } from '../lib/world.mjs';
import { T } from './songmap.mjs';

function shotTitle(P, S) {
  const { t } = S;
  skyNight(P);
  stars(P, t, { n: 120, twinkle: 0.4 + S.high, seed: 3 });
  moon(P, 1560, 190, 58);
  mountains(P, { base: 900, amp: 330, seed: 4, inks: [0.05, 0.62, 0.85], snow: true });
  mountains(P, { base: 1010, amp: 170, seed: 8, inks: K.navy, step: 55 });
  const tb = 0.85;
  if (t >= tb) {
    const k = backOut(clamp((t - tb) / 0.25), 2.2);
    P.save();
    P.translate(W / 2, 300);
    P.scale(lerp(1.5, 1, k));
    bigType(P, 'THE BED HEADS', 0, 0, 92, [1, 0, 0], { font: '"Rubik Mono One"', shadow: [0, 1, 0], off: [6, 6] });
    P.restore();
  }
  // KILBY GIRL, one letter per beat from the second bar line of the intro
  const word = 'KILBY GIRL';
  const font = '330px Anton';
  const total = P.measure(word, font, 6);
  let x = W / 2 - total / 2;
  const beats = S.clock.f.beats.filter((b) => b >= 3.7);
  let bi = 0;
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    const w = P.measure(ch, font) + 6;
    if (ch !== ' ') {
      const ta = beats[bi++] - 0.02;
      if (t >= ta) {
        const k = easeOut(clamp((t - ta) / 0.1));
        P.save();
        P.translate(x + w / 2, 700);
        P.scale(lerp(2.2, 1, k));
        P.rotate(hs(i, 5) * 0.06);
        bigType(P, ch, 0, 0, 330, [0, 1, 0], { shadow: [1, 0, 0], off: [12, 10] });
        P.restore();
      }
    }
    x += w;
  }
  // brush underline on the downbeat after the last letter
  const tu = 8.12;
  if (t >= tu) {
    const k = easeOut(clamp((t - tu) / 0.35));
    const x0 = W / 2 - total / 2, x1 = lerp(x0, W / 2 + total / 2, k);
    P.stroke(curve([[x0, 760], [lerp(x0, x1, 0.5), 772], [x1, 758]], false), [1, 0, 0], 24);
    for (let i = 0; i < 5; i++) {
      const lt = t - tu - i * 0.09;
      if (lt > 0) P.fill(star(x0 - 60 + i * (total + 120) / 4, 820 + hs(i) * 40, 22 * clamp(lt * 4), 8 * clamp(lt * 4), 4), K.paper);
    }
  }
  if (t >= 9.55) {
    const k = clamp((t - 9.55) / 0.3);
    P.alpha(k).text('Noah · Brooks · Belle · Ethan', W / 2, 930, '40px "Special Elite"', [0, 0, 0]).alpha(1);
  }
}

// [start, end, shot, options, transition-in]
export const SHOTS = [
  [T.intro, T.verse1, shotTitle],
];
export const FLASHES = [];
