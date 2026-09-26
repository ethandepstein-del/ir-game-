// "Kilby Girl" (The Bed Heads) — shot list and timeline.
//
// Every shot is a pure function of time and the song's measured events (beats, downbeats, drum
// hits, accents, the vocal envelope and word-timed lyrics), so any frame renders on its own.
// Cuts sit on downbeats or hits; motion is phrased in beats and bars.
import { BAND, drummerArms, drummerBody, player } from './lib/band.mjs';
import { bedroom, bigType, bulb, cassette, cat, comet, confetti, handX, marquee, moth, photo, pit, shell } from './lib/extras.mjs';
import { appear, handwrite, hot, lyricFlyer, Lyrics, stampWords, typeBox, wordsOnPath } from './lib/lyrics.mjs';
import { amp, crowd, drumkit, girlBust, girlSide } from './lib/people.mjs';
import { circle, curve, line, poly, rect, sagPoint, star, wire } from './lib/shapes.mjs';
import { backOut, clamp, easeIn, easeInOut, easeOut, hash, hs, inv, lerp, TAU } from './lib/util.mjs';
import { fence, K, H, W, moon, mountains, pole, sandwichBoard, skyNight, stars, streetlight, stringLights, tree, house } from './lib/world.mjs';

// ------------------------------------------------------------------ song map (seconds, on downbeats/hits)
const T = {
  titleEnd: 12.48, walkClose: 18.3, walkNight: 22.65, fence: 28.46, fenceClose: 31.36, bust: 35.74, stops: 38.66,
  brk1: 61.59, noahC: 67.42, brooksC: 73.2, belleC: 78.99, ethanC: 81.95,
  verse2: 85.58, v2b: 91.39, v2c: 95.77, zine: 101.56, brk: 118.67,
  chorus2: 123.03, h2b: 125.92, h2c: 128.84, h2d: 131.77, h2e: 134.66, h2f: 137.58, h2g: 140.5, h2h: 143.4,
  darkroom: 147.39, build: 169.56, buildUp: 176.5, final: 183.59, montage: 186.83, finale: 197.49,
  surf: 209.08, pitEnd: 219.78, outro: 225.52, ringout: 238.31, endCard: 241.86, end: 247.52,
};
const STOP_HITS = [38.66, 40.3, 41.56, 42.99, 45.92, 47.36, 48.83, 51.74, 53.2, 54.61, 56.11, 57.54, 59.03, 60.46];
const DARK_HITS = [150.5, 151.92, 153.54, 159.38, 161.59, 168.12];
const OUTRO_HITS = [225.52, 227.72, 231.21, 232.99, 234.76, 236.54];
const ENERGY = [[0, 0.25], [T.stops, 0.55], [T.brk1, 1], [T.verse2, 0.35], [T.brk, 0], [T.chorus2, 1], [T.darkroom, 0.3], [T.build, 0.6], [T.final, 1], [T.outro, 0.6], [T.ringout, 0.15]];
const energyAt = (t) => ENERGY.filter(([a]) => t >= a).pop()[1];
const HOOK = [[37, 60], [123, 148]];
const inHook = (t) => HOOK.some(([a, b]) => t >= a && t < b);

let LY = new Lyrics(null);

// ------------------------------------------------------------------ shared pieces
const FLOODS = [[1, 0.28, 0], [0.25, 1, 0], [1, 0.75, 0], [0, 0.22, 0.72]];

function withCam(P, cx, cy, s, fn) {
  P.save();
  P.translate(W / 2, H / 2);
  P.scale(s);
  P.translate(-cx, -cy);
  fn();
  P.restore();
}

// blinks land on beats: a short blink on roughly one beat in eleven
function blinkOn(S, seed = 0) {
  const b = Math.floor(S.bp);
  return (b * 7 + seed) % 11 === 0 && S.bp - b < 0.3 ? 1 : 0;
}

function bandPose(S, who) {
  const E = S.E;
  const bob = Math.abs(Math.sin(Math.PI * S.bp)) * E;
  const bar = Math.floor(S.barPos);
  const lean = Math.sin(Math.PI * S.barPos * 0.5 + hash(who.length) * 3) * 0.5 * E;
  return {
    bf: S.bf, bob, lean, nod: S.kick * 0.7 * E,
    strum: who === 'belle' ? S.bp % 1 : (S.bp * 2) % 1,
    fret: 0.25 + 0.5 * hash(who.length, bar),
    jump: who === 'brooks' ? S.acc * E : 0,
    blink: blinkOn(S, who.length),
    look: [hs(who.length, bar) * 0.6, 0.45 + 0.3 * hash(bar, who.length)],
    mouth: who === 'ethan' && inHook(S.t) ? S.vocal * 0.55 : 0,
  };
}

function stage(P, S, o = {}) {
  const { t, bp, bf } = S;
  const E = o.energy ?? 1;
  const flood = o.flood || FLOODS[Math.floor(S.barPos / 2) % FLOODS.length];
  const kick = S.kick * E, snare = S.snare * E;
  P.fill(rect(-2000, -2000, W + 4000, H + 4000), flood);
  for (let x = -1000; x < W + 1000; x += 96) P.fill(rect(x, -1000, 6, 1900), flood.map((v) => clamp(v + 0.15)));
  for (const [x, y, r] of [[440, 420, 300], [760, 400, 300], [1420, 420, 300], [1010, 300, 280]]) {
    P.glow(x, y, r * (0.85 + 0.3 * kick), flood.map((v) => v * 0.55), 'knock', 0.25);
  }
  if (o.back) o.back(P, flood);
  amp(P, 250, 880, 250, 230);
  amp(P, 1680, 880, 250, 230);
  P.fill(rect(700, 700, 560, 180), K.navy);
  const noah = { ...bandPose(S, 'noah'), mouth: S.vocal };
  drummerBody(P, BAND.noah, 1010, 535, 0.9, { bf, bob: noah.bob, mouth: noah.mouth, blink: noah.blink, lean: noah.lean * 0.5, look: [0.2, 0.3] });
  drumkit(P, 1010, 700, 0.7, { bf, kick, snare, crash: S.crash * E, drummer: false });
  const hat = Math.pow(1 - ((bp * 2) % 1), 4);
  drummerArms(P, BAND.noah, 1010, 535, 0.9, { snare, hat: hat * E, crash: S.crash * E, bob: noah.bob, lean: noah.lean * 0.5 });
  player(P, BAND.ethan, 440, 890, 0.95, { ...bandPose(S, 'ethan'), micAt: [58, -452] });
  player(P, BAND.belle, 760, 895, 0.95, bandPose(S, 'belle'));
  player(P, BAND.brooks, 1420, 890, 0.97, bandPose(S, 'brooks'));
  P.fill(rect(-2000, 880, W + 4000, 1400), K.ink);
  P.fill(rect(-2000, 880, W + 4000, 8), [0.2, 0.6, 0.7]);
  const pop = (i) => (i % 4 === Math.floor(bp) % 4 ? kick * 0.6 : 0);
  const wide = o.wideLights ? 700 : 60;
  stringLights(P, -wide, 30, W + wide, 70, 110, o.wideLights ? 22 : 15, 0.75 + 0.25 * E, { t, pop, size: 1.5, glow: 0.6 });
  stringLights(P, -wide, 150, W + wide, 110, 80, o.wideLights ? 19 : 13, 0.7 + 0.3 * E, { t, seed: 3, pop: (i) => pop(i + 2), size: 1.3, glow: 0.6 });
  if (o.crowd !== false) {
    crowd(P, { y: 1010, n: 13, seed: 11, scale: 0.72, bounce: E, beatPos: bp, arms: (o.arms ?? 0.3) * 0.7, bf, inks: [0, 0.85, 0.95], t });
    crowd(P, { y: 1085, n: 10, seed: 5, scale: 1.0, bounce: E, beatPos: bp + 0.3, arms: o.arms ?? 0.3, bf, girlAt: o.girl ?? 4, phones: o.phones ?? 0, t });
  }
}

// lyric line painted big on the back wall; text is bare paper, the sung word flips to navy
function wallWords(words, cx, cy, maxW, size) {
  return (P, S) => stampWords(P, words, S.t, cx, cy, maxW, size, { inks: K.paper, hotInks: K.navy, shadow: K.navy });
}

const CLOSE = {
  noah: [1010, 420, 2.3],
  ethan: [440, 560, 2.15],
  belle: [760, 560, 2.15],
  brooks: [1420, 560, 2.15],
};

function shotStage(P, S, o = {}) {
  const cam = o.cam || [960, 540, 1];
  const back = o.lyric ? (P2, flood) => { o.lyric(P2, S, flood); o.back?.(P2, flood); } : o.back;
  withCam(P, cam[0], cam[1], cam[2], () => stage(P, S, { ...o, back }));
  if (o.confetti) confetti(P, S.t, { t0: o.confetti, n: 80, seed: 4 });
  if (o.overlay) o.overlay(P, S);
}

function bokeh(P, t, { n = 16, seed = 2, level = 1, drift = 0 } = {}) {
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

function bandPoster(P, x, y, s, rot) {
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

// ------------------------------------------------------------------ photo subjects (stills)
const still = (fn, t) => (P) => fn(P, { t, bp: t * 2.78, barPos: t * 0.69, bf: 3, kick: 0.4, snare: 0.3, crash: 0.2, acc: 0, high: 0.5, vocal: 0.6, E: 1 });
const PH = {
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

// ------------------------------------------------------------------ intro
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

// ------------------------------------------------------------------ verse 1: the walk
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

function walkWorld(P, S, { night = false, walkerX = 760, walk = 1, scrollT = null, girl = true, lamps = true, wireWords = null, chalk = null } = {}) {
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
  const L0 = LY.lines[0];
  const wireWords = L0 && { words: L0.words, s0: 820 + xoAt(L0.words[0].t) };
  if (o.close) {
    withCam(P, 800, 640, 2.1, () => walkWorld(P, S, { night: false, wireWords }));
    rain(P, S, LY.lines[1]);
    if (LY.lines[1]) stampWords(P, LY.lines[1].words, S.t, 1480, 520, 760, 118, { inks: K.paper, hotInks: [1, 0, 0], shadow: [0, 0.8, 0.8] });
  } else if (o.night) {
    const L2 = LY.lines[2];
    const chalk = L2 && { words: L2.words, s0: 880 + xoAt(L2.words[0].t) };
    walkWorld(P, S, { night: true, chalk, wireWords });
  } else walkWorld(P, S, { night: false, wireWords });
}

// rain that starts on the word "raining"
function rain(P, S, line2) {
  if (!line2) return;
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
  const L3 = LY.lines[3];
  if (L3) {
    const w = L3.words;
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

// ------------------------------------------------------------------ close-ups of the girl
function shotBust(P, S, o) {
  const { t, bf } = S;
  bokeh(P, t, { level: 0.75 + 0.25 * S.kick, drift: S.barPos * 0.4 });
  const sway = Math.sin((S.barPos * Math.PI) / 2);
  const s = o.s || 1.05, cy = o.cy || 560;
  const camera = o.camera ? easeInOut(clamp((t - o.camera[0]) / (o.camera[1] - o.camera[0]))) : 0;
  P.save();
  P.translate(960 + sway * 10, cy);
  P.rotate(sway * 0.03);
  girlBust(P, 0, 0, s, { t, bf, sway, blink: o.happy ? 0 : blinkOn(S, 1), lookY: o.lookY ?? -0.4, lookX: o.lookX ?? 0, happy: o.happy ? 1 : 0, smile: o.smile ?? 0.6, camera });
  P.restore();
  if (o.caption != null && LY.lines[o.caption]) {
    const words = o.captionWords ? o.captionWords(LY) : LY.lines[o.caption].words;
    typeBox(P, words, t, 120, 880, 1000, 46, { beatPhase: S.bp % 1, rot: -0.01 });
  }
}

// ------------------------------------------------------------------ hook 1: the photo pile, captioned in marker
const PILE = [
  [520, 330, 560, -0.12], [1400, 300, 540, 0.1], [960, 620, 600, 0.03], [360, 780, 520, 0.14], [1560, 760, 560, -0.09],
  [860, 250, 480, 0.18], [1180, 860, 520, -0.16], [260, 380, 470, -0.2], [1680, 420, 480, 0.2], [640, 900, 520, 0.08],
  [1320, 560, 560, -0.05], [560, 560, 540, 0.11], [1720, 980, 460, -0.14], [960, 440, 720, -0.02],
];
const STOP_PHOTOS = [PH.lights, PH.flyer, PH.hand, PH.noah, PH.selfie, PH.mountains, PH.brooks, PH.board, PH.phones, PH.belle, PH.ethan, PH.moth, PH.tape, PH.stage];

function captionsFor(hits, words) {
  const per = hits.map(() => []);
  for (const w of words) {
    let k = 0;
    for (let i = 0; i < hits.length; i++) if (hits[i] <= w.t + 0.12) k = i;
    per[k].push(w);
  }
  return per;
}

function photoPile(P, S, hits, contents, layout, { zoomLast = null, captions = null } = {}) {
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

function shotStops(P, S) {
  const words = LY.words(4, 10).filter((w) => w.t >= STOP_HITS[0] - 1.4);
  photoPile(P, S, STOP_HITS, STOP_PHOTOS, PILE, { zoomLast: [STOP_HITS[STOP_HITS.length - 1] + 0.35, T.brk1], captions: captionsFor(STOP_HITS, words) });
}

// ------------------------------------------------------------------ crowd, pit
function shotCrowd(P, S, o) {
  const { t, bp, bf } = S;
  withCam(P, 960, 400, 0.72, () => stage(P, S, { crowd: false, wideLights: true }));
  crowd(P, { y: 1000, n: 9, seed: 21, scale: 1.1, bounce: 1, beatPos: bp + 0.5, arms: 0.4, bf, inks: [0, 0.85, 0.95], t, phones: o.phones ?? 0 });
  let phoneWords = null;
  if (o.phoneLine != null && LY.lines[o.phoneLine]) phoneWords = LY.lines[o.phoneLine].words.map((w) => ({ text: w.w.replace(/[,.]/g, '').toUpperCase(), on: t >= w.t - 0.02, hot: hot(w, t) }));
  crowd(P, { y: 1180, n: phoneWords ? phoneWords.length + 1 : 5, seed: 22, scale: phoneWords ? 1.4 : 1.9, x0: phoneWords ? 40 : -80, x1: phoneWords ? W - 40 : W + 80, bounce: 1, beatPos: bp, arms: o.arms ?? 0.5, bf, girlAt: 2, t, phones: o.phones ?? 0, phoneWords });
  if (o.confetti) confetti(P, t, { t0: o.confetti, n: 70, seed: 4 });
}

// lyric painted on the floor in the empty middle of the ring
function pitFloor(words, t) {
  return (P) => stampWords(P, words, t, W / 2, H / 2 + 30, 640, 104, { inks: K.paper, hotInks: [1, 0, 0], shadow: [0, 0.6, 1], rotJitter: 0.08 });
}

function shotPit(P, S, o) {
  const words = o.floorLine != null && LY.lines[o.floorLine] ? LY.lines[o.floorLine].words : null;
  pit(P, S.t, { turn: S.barPos * (TAU / 8) * (o.speed || 1), speed: 1, bounce: 1, bf: S.bf, floor: words ? pitFloor(words, S.t) : null });
  if (o.confetti) confetti(P, S.t, { t0: o.confetti, n: 50, seed: 8, speed: 200 });
}

// ------------------------------------------------------------------ verse 2: zine panels with typed captions
function shotZine(P, S) {
  const { t } = S;
  P.fill(rect(-100, -100, W + 200, H + 200), [0.08, 0.04, 0]);
  const dim = 1 - inv(116.8, T.brk, t);
  const panels = [
    [60, 50, 1060, 560, 101.56, 12, (P2) => bedroom(P2, t, { lamp: dim })],
    [1160, 50, 700, 560, 107.39, 13, (P2) => { P2.fill(rect(0, 0, W, H), [0.1, 0.16, 0]); girlBust(P2, 960, 760, 2.6, { t, bf: S.bf, blink: blinkOn(S, 2), lookY: 0.2, lookX: -0.8, smile: 0.2 }); }],
    [60, 650, 700, 380, 113.21, 14, (P2) => { P2.linear(rect(0, 0, W, H), 0, 0, 0, H, [[0, [0, 0.55, 1]], [0.6, [0.3, 0.7, 0.4]], [1, [0.9, 0.5, 0]]]); mountains(P2, { base: 1080, amp: 480, seed: 4, inks: [0.05, 0.62, 0.85], snow: true, step: 110 }); stringLights(P2, -60, 200, 1980, 260, 200, 9, dim, { t, size: 2.4 }); }],
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
    if (cap != null && LY.lines[cap]) typeBox(P, LY.lines[cap].words, t, x + 24, y + h - 70, Math.min(w - 48, 820), 32, { beatPhase: S.bp % 1, rot: hs(cap) * 0.015 });
  }
}

function shotBreak(P, S) {
  const { t } = S;
  const lt = t - T.brk;
  P.fill(rect(-100, -100, W + 200, H + 200), [0.3, 1, 1]);
  const flick = lt < 0.4 ? (Math.floor(lt * 24) % 2 ? 0.2 : 1) : t > T.chorus2 - 0.55 ? (Math.floor(t * 24) % 3 ? 0 : 0.5) : 0.85 + 0.15 * Math.sin(S.bp * Math.PI);
  const swing = Math.sin((S.bp - 330) * Math.PI / 4) * 0.22;
  const [bx, by] = bulb(P, 960, -40, 430, swing, flick, { size: 1.5 });
  for (let i = 0; i < 2; i++) {
    const a = S.bp * (1.4 + i * 0.5) + i * 2;
    moth(P, bx + Math.cos(a) * (150 + i * 60), by + Math.sin(a * 1.3) * 100, 1.2 - i * 0.3, S.bp * 12 + i);
  }
}

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

// ------------------------------------------------------------------ build, drop
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

// ------------------------------------------------------------------ finale
function surfScene(P, S, u) {
  const { t, bp, bf } = S;
  withCam(P, 960, 380, 0.72, () => stage(P, S, { crowd: false, wideLights: true, flood: FLOODS[3] }));
  crowd(P, { y: 1010, n: 9, seed: 21, scale: 1.1, bounce: 1, beatPos: bp + 0.5, arms: 0.95, bf, inks: [0, 0.85, 0.95], t });
  const x = lerp(-350, 2250, u);
  const y = 500 + Math.sin(bp * Math.PI) * 14;
  P.save();
  P.translate(x, y);
  P.rotate(Math.PI / 2 + Math.sin(S.barPos * Math.PI) * 0.05);
  P.scale(-1, 1);
  girlSide(P, 0, 220, 1.45, { walk: 0.3, phase: bp * Math.PI, armUp: 0.75, bf, shadow: false, blink: blinkOn(S, 4) });
  P.restore();
  crowd(P, { y: 1170, n: 6, seed: 23, scale: 1.8, bounce: 1, beatPos: bp, arms: 0.9, bf, t });
}

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

// ------------------------------------------------------------------ timeline
const SHOTS = [
  [0, T.titleEnd, shotTitle],
  [T.titleEnd, T.walkClose, shotWalk, {}],
  [T.walkClose, T.walkNight, shotWalk, { close: true }],
  [T.walkNight, T.fence, shotWalk, { night: true }],
  [T.fence, T.fenceClose, shotFence, {}],
  [T.fenceClose, T.bust, shotFence, { close: true }],
  [T.bust, T.stops, shotBust, { camera: [T.bust + 0.6, T.stops - 0.3], lookY: 0, s: 1.15, cy: 560, caption: 4, captionWords: (L) => L.lines[4].words.filter((w) => w.t < T.stops - 0.1) }],
  [T.stops, T.brk1, shotStops],
  // instrumental break: the band, one of you at a time
  [T.brk1, T.noahC, shotStage, { arms: 0.35, back: (P) => bigType(P, 'KILBY GIRL', 960, 300, 200, [0, 0, 0], { shadow: K.navy, off: [8, 7] }) }],
  [T.noahC, T.brooksC, shotStage, { cam: CLOSE.noah }],
  [T.brooksC, T.belleC, shotStage, { cam: CLOSE.brooks }],
  [T.belleC, T.ethanC, shotStage, { cam: CLOSE.belle }],
  [T.ethanC, T.verse2, shotStage, { cam: CLOSE.ethan }],
  // verse 2
  [T.verse2, T.v2b, shotBust, { lookY: -0.5 }],
  [T.v2b, T.v2c, shotBust, { happy: true, s: 1.6, cy: 660 }],
  [T.v2c, T.zine, shotBust, { lookY: 0, smile: 1, caption: 11 }],
  [T.zine, T.brk, shotZine],
  [T.brk, T.chorus2, shotBreak],
  // hook 2: two-bar cuts, each line living somewhere in the room
  [T.chorus2, T.h2b, shotStage, { arms: 0.6, confetti: T.chorus2, lyric: (P, S) => LY.lines[15] && wallWords(LY.lines[15].words, 960, 268, 1800, 96)(P, S) }],
  [T.h2b, T.h2c, shotPit, { floorLine: 16 }],
  [T.h2c, T.h2d, shotStage, { cam: CLOSE.noah, lyric: (P, S) => LY.lines[17] && wallWords(LY.lines[17].words, 1010, 258, 820, 50)(P, S) }],
  [T.h2d, T.h2e, shotCrowd, { arms: 0.8, phoneLine: 18, confetti: 131 }],
  [T.h2e, T.h2f, shotStage, { cam: CLOSE.brooks, overlay: (P, S) => LY.lines[19] && wallWords(LY.lines[19].words, 430, 300, 640, 92)(P, S) }],
  [T.h2f, T.h2g, shotStage, { cam: CLOSE.belle, overlay: (P, S) => LY.lines[19] && wallWords(LY.lines[19].words, 1490, 300, 640, 92)(P, S) }],
  [T.h2g, T.h2h, shotPit, { floorLine: 20, speed: 1.3, confetti: 140 }],
  [T.h2h, T.darkroom, shotStage, { arms: 0.9, confetti: 143, lyric: (P, S) => LY.lines[21] && wallWords(LY.lines[21].words, 960, 268, 1800, 96)(P, S) }],
  [T.darkroom, T.build, shotDarkroom],
  [T.build, T.montage, shotSky],
  [T.montage, T.finale, shotMontage],
  [T.finale, T.surf, shotFinale, {}],
  [T.surf, T.pitEnd, shotSurf],
  [T.pitEnd, T.outro, shotPit, { speed: 1.6, confetti: 219 }],
  [T.outro, T.ringout, shotOutro],
  [T.ringout, T.end + 1, shotRingout],
];

// paper-white flashes: camera shutters and the big drops
const FLASHES = [...STOP_HITS, T.brk1, T.chorus2, T.final, ...OUTRO_HITS];

function flashAt(t) {
  let f = 0;
  for (const e of FLASHES) {
    const d = t - e;
    if (d >= -1 / 60 && d < 0.6) f = Math.max(f, d < 1 / 15 ? 0.92 : 0.92 * Math.exp(-(d - 1 / 15) / 0.09));
  }
  return f;
}

export function drawFrame(P, clock, t, scale = 1) {
  if (clock.f.lyrics && LY.lines.length === 0) LY = new Lyrics(clock.f.lyrics);
  const shot = SHOTS.find(([a, b]) => t >= a && t < b) || SHOTS[SHOTS.length - 1];
  const E = energyAt(t);
  const bp = clock.beatPos(t);
  const S = {
    t, clock, E, bp,
    barPos: clock.barPos(t),
    bf: Math.floor(bp * 2), // linework re-cuts on the eighth notes
    kick: clock.pulse('kicks', t, 0.14),
    snare: clock.pulse('snares', t, 0.12),
    acc: clock.pulse('accents', t, 0.3),
    crash: clock.pulse('accents', t, 0.35),
    high: clock.avg('high', t, 0.2),
    rms: clock.avg('rms', t, 0.3),
    vocal: clock.f.vocal ? clock.frameVal('vocal', t) : 0,
  };
  // misregistration: a base offset, kicked around by hits in the loud sections
  const sn = clock.last('snares', t).i, ac = clock.last('accents', t).i;
  const jolt = E * (S.snare * 1.2 + S.acc * 5);
  const reg = [[0, 0], [1.5, -1], [-1.5, 1]].map(([x, y], k) => [
    Math.round((x + hs(sn, ac, k, 1) * jolt) * scale),
    Math.round((y + hs(sn, ac, k, 2) * jolt) * scale),
  ]);
  P.begin(reg);
  P.save();
  P.scale(scale);
  // camera punch on every downbeat in the loud sections
  const punch = 1 + 0.022 * E * clock.pulse('downbeats', t, 0.22);
  P.translate(W / 2, H / 2);
  P.scale(punch);
  P.translate(-W / 2, -H / 2);
  shot[2](P, S, shot[3] || {});
  const fade = Math.max(1 - clamp(t / 0.8), inv(T.end - 2.2, T.end - 0.2, t), flashAt(t));
  if (fade > 0) P.alpha(fade).fill(rect(-200, -200, W + 400, H + 400), K.paper).alpha(1);
  P.restore();
}

export { T };
