// Verse 2 (1:25.6 - 2:03.0): close on her, the zine pages, the bulb and moths before hook 2.
import { bedroom, bulb, moth } from '../lib/extras.mjs';
import { typeBox } from '../lib/lyrics.mjs';
import { girlBust } from '../lib/people.mjs';
import { rect } from '../lib/shapes.mjs';
import { backOut, clamp, easeInOut, hs, inv, lerp } from '../lib/util.mjs';
import { spring } from '../lib/fx.mjs';
import { H, K, mountains, stringLights, W } from '../lib/world.mjs';
import { blinkOn, FLOODS, LY, withCam } from './common.mjs';
import { shotBust } from './girl.mjs';
import { T } from './songmap.mjs';
import { CLOSE, FRAME, shotStage, stage } from './stage.mjs';
import { still } from './stills.mjs';
import { circle, roundRect } from '../lib/shapes.mjs';

// the camera snaps to each zine panel as it lands, then pulls back to the whole page
const ZINE_AT = [[101.56, 590, 330], [107.39, 1510, 330], [113.21, 410, 840], [116.1, 1330, 840]];
// her camera's screen: she flicks through the night's photos on the beat, and they're all of him
const ROLL = [
  still((P, S) => shotStage(P, S, { cam: FRAME.noah, push: 0 }), 46.3),
  still((P, S) => shotStage(P, S, { cam: FRAME.kit, push: 0 }), 70.2),
  still((P, S) => shotStage(P, S, { cam: FRAME.noah, push: 0 }), 81.2),
];
function shotRoll(P, S, o) {
  const { t } = S;
  P.fill(rect(-400, -400, W + 800, H + 800), [0.35, 0.95, 1]);
  const x = 210, y = 90, w = 1500, h = 844;
  P.fill(roundRect(x - 36, y - 36, w + 72, h + 72, 40), [0.25, 0.6, 0.7]);
  // flick to the next photo on each downbeat
  const i = (o.first ?? 0) + (t >= (o.flip ?? Infinity) ? 1 : 0);
  const since = t - (t >= (o.flip ?? Infinity) ? o.flip : S.t0);
  const slide = (1 - clamp(since / 0.12)) * 80;
  P.save();
  P.clip(rect(x, y, w, h));
  P.translate(x + slide, y);
  P.scale(w / W);
  ROLL[i % ROLL.length](P);
  P.restore();
  P.text(`▶  ${12 + i} / 24`, x + 40, y + 60, '40px "Special Elite"', K.paper, { align: 'left' });
  P.stroke(roundRect(x + w - 150, y + 30, 90, 40, 8), K.paper, 4);
  P.fill(rect(x + w - 144, y + 36, 60, 28), K.paper);
  P.fill(circle(x + w - 70, y + h - 60, 14 * (0.7 + 0.3 * S.kick)), [1, 1, 0]);
}

function shotZine(P, S) {
  const { t } = S;
  let n = 0;
  while (n < ZINE_AT.length && ZINE_AT[n][0] <= t) n++;
  const k = n ? spring(t - ZINE_AT[n - 1][0], { freq: 2.4, damp: 8 }) : 0;
  const from = n > 1 ? ZINE_AT[n - 2].slice(1) : [W / 2, H / 2], to = n ? ZINE_AT[n - 1].slice(1) : [W / 2, H / 2];
  const back = easeInOut(clamp((t - 117.59) / 0.8));
  const zoom = lerp(1.32, 1, back);
  const hw = W / 2 / zoom, hh = H / 2 / zoom;
  const cx = lerp(clamp(lerp(from[0], to[0], k), hw, W - hw), W / 2, back);
  const cy = lerp(clamp(lerp(from[1], to[1], k), hh, H - hh), H / 2, back);
  P.save();
  P.translate(W / 2, H / 2); P.scale(zoom); P.translate(-cx, -cy);
  zinePage(P, S);
  P.restore();
}

function zinePage(P, S) {
  const { t } = S;
  // the page lies on a dark desk under the lamp
  P.fill(rect(-400, -400, W + 800, H + 800), [0.3, 0.95, 1]);
  P.glow(W * 0.45, H * 0.35, 1100, [0, 0.5, 0.55], 'knock', 0.3);
  const dim = 1 - inv(116.8, T.brk, t);
  const panels = [
    [60, 50, 1060, 560, 101.56, 'v2_2', (P2) => bedroom(P2, t, { lamp: dim })],
    [1160, 50, 700, 560, 107.39, 'v2_3', (P2) => { P2.fill(rect(0, 0, W, H), [0.1, 0.16, 0]); girlBust(P2, 960, 760, 2.6, { t, bf: S.bf, blink: blinkOn(S, 2), lookY: 0.2, lookX: -0.8, smile: 0.2 }); }],
    [60, 650, 700, 380, 113.21, 'v2_4', (P2) => { P2.linear(rect(0, 0, W, H), 0, 0, 0, H, [[0, [0, 0.55, 1]], [0.6, [0.3, 0.7, 0.4]], [1, [0.9, 0.5, 0]]]); mountains(P2, { base: 1080, amp: 480, seed: 4, inks: [0.05, 0.62, 0.85], snow: true, step: 110 }); stringLights(P2, -60, 200, 1980, 260, 200, 9, dim, { t, size: 2.4 }); }],
    [800, 650, 1060, 380, 116.1, null, (P2) => withCam(P2, CLOSE.noah[0], CLOSE.noah[1], 1.9, () => stage(P2, S, { flood: FLOODS[1], crowd: false }))],
  ];
  for (const [x, y, w, h, at, cap, fn] of panels) {
    if (t < at) continue;
    const k = backOut(clamp((t - at) / 0.2));
    P.save();
    P.translate(x + w / 2, y + h / 2);
    P.scale(lerp(0.6, 1, k));
    P.fill(rect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 20), K.ink);
    P.save();
    P.clip(rect(-w / 2, -h / 2, w, h));
    const sc = Math.max(w / W, h / H);
    P.scale(sc);
    P.translate(-W / 2, -H / 2);
    fn(P);
    P.restore();
    P.restore();
    if (cap && LY.line(cap).words.length) typeBox(P, LY.line(cap).words, t, x + 24, y + h - 70, Math.min(w - 48, 820), 32, { beatPhase: S.bp % 1, rot: hs(x) * 0.015 });
  }
}

function shotBreak(P, S) {
  const { t } = S;
  const lt = t - T.brk;
  P.fill(rect(-100, -100, W + 200, H + 200), [0.3, 1, 1]);
  const flick = lt < 0.4 ? (Math.floor(lt * 24) % 2 ? 0.2 : 1) : t > T.hook2 - 0.55 ? (Math.floor(t * 24) % 3 ? 0 : 0.5) : 0.85 + 0.15 * Math.sin(S.bp * Math.PI);
  const swing = Math.sin((S.bp - 330) * Math.PI / 4) * 0.22;
  const [bx, by] = bulb(P, 960, -40, 430, swing, flick, { size: 1.5 });
  for (let i = 0; i < 2; i++) {
    const a = S.bp * (1.4 + i * 0.5) + i * 2;
    moth(P, bx + Math.cos(a) * (150 + i * 60), by + Math.sin(a * 1.3) * 100, 1.2 - i * 0.3, S.bp * 12 + i);
  }
}

export const SHOTS = [
  [T.verse2, 88.49, shotBust, { lookY: -0.5 }],
  [88.49, T.v2b, shotRoll, { first: 0, flip: 89.94 }, { kind: 'slam', dur: 0.2 }],
  [T.v2b, 94.3, shotBust, { happy: true, s: 1.6, cy: 660 }],
  [94.3, T.v2c, shotRoll, { first: 2 }, { kind: 'slam', dur: 0.2 }],
  [T.v2c, 98.66, shotBust, { lookY: 0, smile: 1, captionWords: () => LY.line('v2_1').words }],
  [98.66, T.zine, shotBust, { lookY: 0.1, smile: 1, s: 1.4, cy: 650, captionWords: () => LY.line('v2_1').words }],
  [T.zine, T.brk, shotZine, {}, { kind: 'tear', dur: 0.35, seed: 6 }],
  [T.brk, T.hook2, shotBreak],
];
export const FLASHES = [];
