// Pieces shared by several sequences. Owned by the lead: sequences import from here, and ask
// before changing anything in this file.
import { photo } from '../lib/extras.mjs';
import { handwrite, Lyrics } from '../lib/lyrics.mjs';
import { circle, poly, rect } from '../lib/shapes.mjs';
import { backOut, clamp, easeIn, easeOut, hash, hs, lerp, TAU } from '../lib/util.mjs';
import { perfFrom } from '../lib/perf.mjs';
import { H, K, W } from '../lib/world.mjs';
import { energyAt } from './songmap.mjs';

// ------------------------------------------------------------------ lyrics + per-frame state
// LY is a live binding: sequences read LY.line('h1_2').words etc. (see lib/lyrics.mjs)
export let LY = new Lyrics(null);
export let CLOCK = null;
export function loadSong(clock) {
  CLOCK = clock;
  if (clock.f.lyrics && clock.f.lyrics !== LY.src) {
    LY = new Lyrics(clock.f.lyrics);
    LY.src = clock.f.lyrics;
  }
}

// S: everything a shot needs to know about song time t. Shots are pure functions of S.
//   t, E (arrangement energy), bp (beat position: index + phase), barPos, bf (boil frame, eighth
//   notes), kick/snare/acc/crash (hit pulses 0..1), high/rms (envelopes), vocal (0..1),
//   perf (lib/perf.mjs: drum limbs, strums, bass, visemes), clock (raw features).
// The timeline adds t0/t1/lt (shot start, end, local time) per shot.
export function makeS(t, clock = CLOCK) {
  const perf = perfFrom(clock);
  const bp = clock.beatPos(t);
  return {
    t, clock, perf, E: energyAt(t), bp,
    barPos: clock.barPos(t),
    bf: Math.floor(bp * 2), // linework re-cuts on the eighth notes
    kick: perf.pulse('kick', t, 0.14),
    snare: perf.pulse('snare', t, 0.12),
    acc: clock.pulse('accents', t, 0.3),
    crash: perf.pulse('crash', t, 0.35),
    high: clock.avg('high', t, 0.2),
    rms: clock.avg('rms', t, 0.3),
    vocal: clock.f.vocal ? clock.frameVal('vocal', t) : 0,
    t0: t, t1: t + 1, lt: 0,
  };
}

// ------------------------------------------------------------------ camera + timing
export function withCam(P, cx, cy, s, fn) {
  P.save();
  P.translate(W / 2, H / 2);
  P.scale(s);
  P.translate(-cx, -cy);
  fn();
  P.restore();
}

// blinks land on beats: a short blink on roughly one beat in eleven
export function blinkOn(S, seed = 0) {
  const b = Math.floor(S.bp);
  return (b * 7 + seed) % 11 === 0 && S.bp - b < 0.3 ? 1 : 0;
}

// ------------------------------------------------------------------ backdrops
export const FLOODS = [[1, 0.28, 0], [0.25, 1, 0], [1, 0.75, 0], [0, 0.22, 0.72]];

export function bokeh(P, t, { n = 16, seed = 2, level = 1, drift = 0 } = {}) {
  P.fill(rect(-100, -100, W + 200, H + 200), [0.2, 1, 1]);
  for (let i = 0; i < n; i++) {
    const x = hash(seed, i) * W + Math.sin(drift + i) * 30, y = hash(seed, i, 2) * H * 0.9 + Math.cos(drift * 0.8 + i) * 18;
    const r = 70 + hash(seed, i, 3) * 90;
    const pink = hash(seed, i, 4) > 0.55;
    const L = level * (0.6 + 0.4 * hash(seed, i, 5));
    P.glow(x, y, r * 1.15, [0, 0.85 * L, 0.9 * L], 'knock', 0.72);
    P.glow(x, y, r, pink ? [0.08 * L, 0.8 * L, 0] : [0.8 * L, 0.22 * L, 0], 'lighter', 0.7);
  }
}

export function bandPoster(P, x, y, s, rot) {
  P.save();
  P.translate(x, y);
  P.rotate(rot);
  P.scale(s);
  P.fill(rect(-230, -320, 460, 640), [1, 0.05, 0]);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    P.fill(poly([[0, -80], [Math.cos(a) * 300, -80 + Math.sin(a) * 300], [Math.cos(a + 0.26) * 300, -80 + Math.sin(a + 0.26) * 300]]), [1, 0.5, 0]);
  }
  P.fill(circle(0, -80, 120), [0, 1, 0]);
  P.fill(circle(0, -80, 80), [1, 0.05, 0]);
  P.text('THE BED HEADS', 0, -230, '62px Anton', K.navy);
  P.text('KILBY GIRL', 0, 170, '104px Anton', [0, 1, 1]);
  P.fill(rect(-190, 196, 380, 8), K.navy);
  P.text('TONIGHT · ALL AGES', 0, 262, '40px "Special Elite"', K.navy);
  P.restore();
}

// ------------------------------------------------------------------ photo piles (hook 1, outro)
export function captionsFor(hits, words) {
  const per = hits.map(() => []);
  for (const w of words) {
    let k = 0;
    for (let i = 0; i < hits.length; i++) if (hits[i] <= w.t + 0.12) k = i;
    per[k].push(w);
  }
  return per;
}

export function photoPile(P, S, hits, contents, layout, { zoomLast = null, captions = null } = {}) {
  const { t } = S;
  P.fill(rect(-200, -200, W + 400, H + 400), [0.55, 0.42, 0.2]);
  for (let i = 0; i < 40; i++) P.fill(circle(hash(i, 1) * W, hash(i, 2) * H, 3 + hash(i, 3) * 5), [0.7, 0.6, 0.35]);
  let n = 0;
  for (let i = 0; i < hits.length; i++) {
    if (t < hits[i]) break;
    n = i + 1;
  }
  const draw = () => {
    for (let i = 0; i < n; i++) {
      const [x, y, w, rot] = layout[i % layout.length];
      const k = easeOut(clamp((t - hits[i]) / 0.16));
      const s = lerp(1.4, 1, k);
      const cap = captions?.[i];
      P.save();
      P.translate(x, y);
      P.scale(s);
      photo(P, 0, 0, w, rot + (1 - k) * 0.3, contents[i % contents.length], {
        shadow: k > 0.5,
        caption: cap && cap.length ? (P2, cx, cy, cw) => handwrite(P2, cap, t, cx, cy, cw, w * 0.068, { inks: K.navy, hotInks: [0.3, 1, 0.2] }) : null,
      });
      P.restore();
    }
  };
  if (zoomLast && n === hits.length) {
    const [x, y, w, rot] = layout[(n - 1) % layout.length];
    const z = easeIn(clamp((t - zoomLast[0]) / (zoomLast[1] - zoomLast[0])));
    const iw = w * 0.88;
    const s = lerp(1, W / iw * 1.02, z);
    const cy = y - (w * 0.2 - w * 0.06) / 2;
    P.save();
    P.translate(W / 2, H / 2);
    P.scale(s);
    P.rotate(-rot * z);
    P.translate(-lerp(W / 2, x, z), -lerp(H / 2, cy, z));
    draw();
    P.restore();
  } else draw();
}

// ------------------------------------------------------------------ punch-word slams
// The words that slam full frame, as word-index groups per line id. Kept to the hooks' key words
// (and the rain): a slam on every line would stop meaning anything.
const EMPH = {
  v1_2: [[1]], h1_1: [[5]], h2_1: [[5]], h1_2: [[3, 4], [7, 8]], h2_2: [[3, 4], [7, 8]],
  h1_5: [[8]], h2_5: [[8]], h1_6: [[3], [6]], h2_6: [[3], [6]],
};

let SLAMS = null, SLAMS_SRC = null;
// every slam in the song: {t0, t1, text, seed}; t0 is the first word's onset
export function slams() {
  if (SLAMS && SLAMS_SRC === LY) return SLAMS;
  const out = [];
  LY.lines.forEach((line, li) => {
    const words = line.words ?? [];
    const id = [...LY.byId].find(([, l]) => l === line)?.[0];
    const groups = EMPH[id] ?? [];
    for (const g of groups) {
      const ws = g.map((i) => words[i]).filter(Boolean);
      if (!ws.length) continue;
      const last = ws[ws.length - 1];
      out.push({
        t0: ws[0].t - 0.03,
        t1: Math.max(ws[0].t + 0.45, (last.e ?? last.t + 0.3) + 0.2),
        text: ws.map((w) => w.w.replace(/[^\p{L}\p{N}']/gu, '').toUpperCase()).join(' '),
        seed: li * 7 + g[0],
      });
    }
  });
  SLAMS = out.sort((a, b) => a.t0 - b.t0);
  SLAMS_SRC = LY;
  return SLAMS;
}

// the active slam at t and its onset pulse (for a camera jolt), or null
export function slamAt(t) {
  for (const s of slams()) if (t >= s.t0 && t < s.t1 + 0.08) return s;
  return null;
}

// draw the active slam: lands from 190% with overshoot, holds, then snaps away
export function slamOverlay(P, S, measure) {
  const s = slamAt(S.t);
  if (!s) return;
  const dt = S.t - s.t0;
  const k = backOut(clamp(dt / 0.11), 2.4);
  const out = clamp((S.t - s.t1) / 0.08);
  const size = Math.min(340, 1560 / Math.max(1, measure(s.text, '100px Anton') / 100));
  const scale = (1 + (1 - k) * 0.9) * (1 - out);
  if (scale <= 0.01) return;
  const rot = hs(s.seed, 3) * 0.07;
  P.save();
  P.translate(W / 2 + hs(s.seed, 1) * 120, H * 0.52 + hs(s.seed, 2) * 60);
  P.scale(scale);
  P.rotate(rot);
  P.text(s.text, 16, size * 0.36 + 14, `${size}px Anton`, K.navy);
  P.text(s.text, 0, size * 0.36, `${size}px Anton`, [1, 1, 0]);
  P.restore();
}
