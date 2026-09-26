// "Kilby Girl" — shot list and timeline.
//
// Every shot is a pure function of time and the song's analysed events, so any frame can be
// rendered on its own (the renderer farms frames out to several processes).
import { amp, crowd, drumkit, girlBust, girlSide, guitarShape, musician } from './lib/people.mjs';
import { boots, bigType, bulb, cassette, cat, comet, confetti, firework, handX, marquee, moth, photo, pit, sfx } from './lib/extras.mjs';
import { capsule, circle, curve, ellipse, line, poly, rect, roundRect, star } from './lib/shapes.mjs';
import { backOut, boilFrame, clamp, easeIn, easeInOut, easeOut, hash, hs, inv, lerp, noise1, smooth, TAU } from './lib/util.mjs';
import { fence, flyer, house, K, H, W, moon, mountains, pole, sandwichBoard, skyNight, stars, streetlight, stringLights, tree } from './lib/world.mjs';

// ------------------------------------------------------------------ song map (seconds)
const T = {
  titleEnd: 12.48,
  walkClose: 18.3,
  walkNight: 24.1,
  fence: 30.0,
  fenceClose: 33.01,
  bust: 35.74,
  stops: 38.66,
  chorus1: 61.59,
  verse2: 85.58,
  verse2b: 91.4,
  verse2c: 97.2,
  zine: 102.0,
  brk: 118.67,
  chorus2: 123.03,
  darkroom: 147.39,
  build: 169.56,
  buildUp: 176.5,
  final: 183.59,
  finale: 197.49,
  surf: 209.7,
  pitEnd: 220.9,
  outro: 225.52,
  ringout: 237.6,
  endCard: 242.4,
  end: 247.52,
};
const STOP_HITS = [38.66, 40.3, 41.56, 42.99, 45.92, 47.36, 48.83, 51.74, 53.2, 54.61, 56.11, 57.54, 59.03, 60.46];
const DARK_HITS = [150.5, 151.92, 153.54, 159.38, 161.59, 168.12];
const OUTRO_HITS = [225.52, 227.72, 231.21, 232.99, 234.76, 236.54];
const ENERGY = [[0, 0.25], [T.stops, 0.55], [T.chorus1, 1], [T.verse2, 0.35], [T.brk, 0], [T.chorus2, 1], [T.darkroom, 0.3], [T.build, 0.6], [T.final, 1], [T.outro, 0.6], [T.ringout, 0.15]];
const energyAt = (t) => ENERGY.filter(([a]) => t >= a).pop()[1];

// ------------------------------------------------------------------ shared scene pieces
const FLOODS = [[1, 0.28, 0], [0.25, 1, 0], [1, 0.75, 0], [0, 0.22, 0.72]];

function stage(P, S, o = {}) {
  const { t, bp, bf } = S;
  const E = o.energy ?? 1;
  const flood = o.flood || FLOODS[Math.floor(bp / 8) % FLOODS.length];
  const kick = S.kick * E, snare = S.snare * E;
  P.fill(rect(-2000, -2000, W + 4000, H + 4000), flood);
  for (let x = -1000; x < W + 1000; x += 96) P.fill(rect(x, -1000, 6, 1900), flood.map((v) => clamp(v + 0.15)));
  // backlights behind each player
  for (const [x, y, r] of [[520, 420, 300], [900, 380, 340], [1380, 420, 300], [1000, 300, 260]]) {
    P.glow(x, y, r * (0.85 + 0.3 * kick), flood.map((v) => v * 0.55), 'knock', 0.25);
  }
  if (o.back) o.back(P);
  amp(P, 300, 880, 250, 230);
  amp(P, 1620, 880, 250, 230);
  P.fill(rect(700, 700, 560, 180), K.navy);
  drumkit(P, 1010, 712, 0.78, { bf, kick, snare, crash: S.crash * E });
  const bob = Math.abs(Math.sin(Math.PI * bp));
  const strum = (bp * 2) % 1;
  musician(P, 520, 890, 0.98, { seed: 1, bf, instrument: 'bass', bob: bob * E, lean: Math.sin(bp * Math.PI / 4) * 0.4 * E, strum });
  musician(P, 880, 905, 1.04, { seed: 2, bf, mic: true, bob: bob * E * 0.6, strum, headbang: S.snare * 0.4 * E, lean: 0.15 });
  musician(P, 1390, 890, 0.98, { seed: 3, bf, bob: bob * E, strum, jump: S.acc * E * 0.9, lean: -0.2 });
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

function withCam(P, cx, cy, s, fn) {
  P.save();
  P.translate(W / 2, H / 2);
  P.scale(s);
  P.translate(-cx, -cy);
  fn();
  P.restore();
}

function bokeh(P, t, { n = 16, seed = 2, level = 1, drift = 0 } = {}) {
  P.fill(rect(-100, -100, W + 200, H + 200), [0.2, 1, 1]);
  for (let i = 0; i < n; i++) {
    const x = hash(seed, i) * W + Math.sin(t * 0.3 + i) * drift, y = hash(seed, i, 2) * H * 0.9 + Math.cos(t * 0.25 + i) * drift * 0.5;
    const r = 70 + hash(seed, i, 3) * 90;
    const pink = hash(seed, i, 4) > 0.55;
    const L = level * (0.6 + 0.4 * hash(seed, i, 5));
    P.glow(x, y, r * 1.15, [0, 0.85 * L, 0.9 * L], 'knock', 0.72);
    P.glow(x, y, r, pink ? [0.08 * L, 0.8 * L, 0] : [0.8 * L, 0.22 * L, 0], 'lighter', 0.7);
  }
}

function blinkAt(t, seed = 0) {
  const u = (t * 0.41 + seed) % 1;
  return u < 0.045 ? 1 : 0;
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
const still = (fn, t) => (P) => fn(P, { t, bp: t * 2.78, bf: 3, kick: 0.4, snare: 0.3, crash: 0.2, acc: 0, high: 0.5 });
const PH = {
  lights: still((P, S) => {
    skyNight(P); stars(P, 2, { n: 60 }); moon(P, 1500, 220, 70);
    stringLights(P, -60, 120, 1980, 300, 220, 12, 1, { size: 2.2 });
    stringLights(P, -60, 520, 1980, 380, 200, 12, 1, { size: 2.6, seed: 4 });
  }, 1),
  flyer: still((P) => { fence(P, -20, 1940, 0, 1100, 7); bandPoster(P, 960, 560, 1.4, 0.05); }, 1),
  hand: still((P) => { P.fill(rect(0, 0, W, H), [0.9, 0.2, 0]); handX(P, 960, 640, 1.2); }, 1),
  drums: still((P, S) => { P.fill(rect(0, 0, W, H), [0.25, 1, 0]); P.glow(960, 400, 700, [0, 0.8, 0], 'destination-out'); drumkit(P, 960, 1100, 2.0, { bf: 2, crash: 1 }); }, 1),
  selfie: still((P) => { bokeh(P, 3); girlBust(P, 960, 600, 1.55, { happy: 1, smile: 1 }); }, 3),
  mountains: still((P) => { skyNight(P); stars(P, 1, { n: 90 }); moon(P, 1400, 260, 90); mountains(P, { base: 1080, amp: 520, seed: 4, inks: [0.05, 0.62, 0.85], snow: true, step: 110 }); }, 1),
  guitar: still((P) => { P.fill(rect(0, 0, W, H), [0, 1, 0]); amp(P, 1450, 1100, 600, 700); guitarShape(P, 700, 700, 2.4, -0.5, K.navy); }, 1),
  board: still((P) => { skyNight(P); stars(P, 4, { n: 50 }); sandwichBoard(P, 960, 1180, 3.2, [['ALL AGES', 64, K.paper], ['SHOW', 70, [1, 0, 0]], ['TONIGHT', 60, K.paper]]); }, 1),
  phones: still((P, S) => { P.fill(rect(0, 0, W, H), [1, 0.4, 0]); crowd(P, { y: 1150, n: 7, seed: 9, scale: 1.7, arms: 0.9, phones: 0.8, t: 1 }); }, 1),
  cat: still((P) => { skyNight(P); stars(P, 5, { n: 60 }); moon(P, 1450, 300, 110); P.fill(rect(0, 760, W, 400), [0.35, 0.55, 0.55]); cat(P, 900, 650, 2.1); }, 1),
  singer: still((P, S) => { P.fill(rect(0, 0, W, H), [0.15, 1, 0]); P.glow(960, 380, 600, [0, 0.7, 0], 'destination-out'); musician(P, 900, 1500, 2.4, { seed: 2, mic: true, bf: 1 }); }, 1),
  moth: still((P) => { P.fill(rect(0, 0, W, H), [0.3, 1, 1]); bulb(P, 960, -60, 420, 0, 1, { size: 2 }); moth(P, 1250, 300, 2.5, 1); moth(P, 700, 520, 1.8, 2); }, 1),
  tape: still((P) => { P.fill(rect(0, 0, W, H), [0, 0.1, 0.8]); cassette(P, 960, 560, 1.4, -0.08); }, 1),
  boots: still((P) => { P.fill(rect(0, 0, W, H), [0.2, 0.3, 0.25]); P.fill(rect(0, 820, W, 300), [0.35, 0.4, 0.4]); boots(P, 960, 900, 1.3); }, 1),
  stage: still((P, S) => stage(P, S, { flood: FLOODS[0], arms: 0.5 }), 62.5),
  crowdsurf: still((P, S) => surfScene(P, S, 0.45), 212),
  pit: still((P, S) => pit(P, S.t, { speed: 0.6 }), 130),
  finale: still((P, S) => stage(P, S, { flood: FLOODS[1], arms: 0.8, back: (P2) => bigType(P2, 'KILBY GIRL', 960, 470, 300, [1, 0, 0], { shadow: [0, 0, 1] }) }), 200),
};

// ------------------------------------------------------------------ shots
function shotTitle(P, S) {
  const { t } = S;
  skyNight(P);
  stars(P, t, { n: 120, twinkle: 0.4 + S.high, seed: 3 });
  moon(P, 1560, 190, 58);
  mountains(P, { base: 900, amp: 330, seed: 4, inks: [0.05, 0.62, 0.85], snow: true });
  mountains(P, { base: 1010, amp: 170, seed: 8, inks: K.navy, step: 55 });
  // THE BED HEADS stamps in on the first accent
  const tb = 1.2;
  if (t >= tb) {
    const k = backOut(clamp((t - tb) / 0.25), 2.2);
    P.save();
    P.translate(W / 2, 300);
    P.scale(lerp(1.5, 1, k));
    bigType(P, 'THE BED HEADS', 0, 0, 92, [1, 0, 0], { font: '"Rubik Mono One"', shadow: [0, 1, 0], off: [6, 6] });
    P.restore();
  }
  // KILBY GIRL, one letter per beat
  const word = 'KILBY GIRL';
  const font = '330px Anton';
  const total = P.measure(word, font, 6);
  let x = W / 2 - total / 2;
  const beats = S.clock.f.beats.filter((b) => b >= 3.9);
  let bi = 0;
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    const w = P.measure(ch, font) + 6;
    if (ch !== ' ') {
      const ta = beats[bi++] - 0.05;
      if (t >= ta) {
        const k = easeOut(clamp((t - ta) / 0.12));
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
  // brush underline on the big accent
  const tu = 6.85;
  if (t >= tu) {
    const k = easeOut(clamp((t - tu) / 0.35));
    const x0 = W / 2 - total / 2, x1 = lerp(x0, W / 2 + total / 2, k);
    P.stroke(curve([[x0, 760], [lerp(x0, x1, 0.5), 772], [x1, 758]], false), [1, 0, 0], 24);
    for (let i = 0; i < 5; i++) {
      const lt = t - tu - i * 0.08;
      if (lt > 0) P.fill(star(x0 - 60 + i * (total + 120) / 4, 820 + hs(i) * 40, 22 * clamp(lt * 4), 8 * clamp(lt * 4), 4), K.paper);
    }
  }
  if (t >= 9.74) {
    const k = clamp((t - 9.74) / 0.3);
    P.alpha(k).text('a riso music video', W / 2, 930, '44px "Special Elite"', [0, 0, 0]).alpha(1);
  }
}

function walkWorld(P, S, { night = false, walkerX = 760, walk = 1, scrollT = null, girl = true, lamps = true } = {}) {
  const { t, bp, bf } = S;
  const st = scrollT ?? (t - T.titleEnd);
  const v = 330;
  const xo = v * st;
  if (night) skyNight(P); else P.linear(rect(-400, -400, W + 800, H + 800), 0, 0, 0, 760, [[0, [0, 0.5, 1]], [0.55, [0.08, 0.62, 0.72]], [1, [0.7, 0.85, 0.2]]]);
  stars(P, t, { n: night ? 90 : 40, yMax: 520, seed: 9, twinkle: 0.4 });
  moon(P, 1450, 170, 46);
  mountains(P, { base: 720, amp: 250, seed: 4, inks: [0.05, 0.62, 0.85], snow: true });
  // houses + trees (mid ground)
  const hx = xo * 0.55;
  for (let i = Math.floor((hx - 400) / 420); i * 420 - hx < W + 400; i++) {
    const x = i * 420 - hx;
    tree(P, x - 40, 880, 240 + hash(i, 4) * 60, i, [0, 0.9, 1]);
    house(P, x + 20, 880, 270 + hash(i) * 50, 170 + hash(i, 2) * 40, i + 20, { t, lit: night ? 0.75 : 0.45 });
  }
  // lawn, sidewalk, curb, street
  P.fill(rect(-400, 872, W + 800, 30), [0.55, 0.3, 0.95]);
  P.fill(rect(-400, 900, W + 800, 90), [0.12, 0.2, 0.22]);
  for (let x = -((xo % 160) + 160) % 160 - 160; x < W + 160; x += 160) P.fill(rect(x, 900, 4, 90), [0.3, 0.45, 0.5]);
  P.fill(rect(-400, 990, W + 800, 14), [0.2, 0.4, 0.5]);
  P.fill(rect(-400, 1004, W + 800, 200), [0.1, 0.75, 0.9]);
  // poles + wires (foreground plane moves with the ground)
  const polesAt = [];
  for (let i = Math.floor((xo - 400) / 1150); i * 1150 - xo < W + 400; i++) polesAt.push(i * 1150 - xo + 200);
  for (let k = 0; k < polesAt.length - 1; k++) {
    for (const dy of [0, 40]) P.stroke(curve([[polesAt[k], 470 + dy], [(polesAt[k] + polesAt[k + 1]) / 2, 520 + dy], [polesAt[k + 1], 470 + dy]], false), K.ink, 3);
  }
  for (const x of polesAt) pole(P, x, 930, 470);
  if (lamps) for (let i = Math.floor((xo - 900) / 1700); i * 1700 - xo < W + 900; i++) streetlight(P, i * 1700 - xo + 850, 940, 420, night ? 1 : 0.7, t);
  if (girl) {
    const phase = Math.PI / 2 + (Math.PI / 2) * bp;
    girlSide(P, walkerX, 950, 1.08, { phase, walk, bf, hairLag: Math.sin(phase * 2) * walk, blink: blinkAt(t, 0.3) });
  }
}

function shotWalk(P, S, o) {
  if (o.close) withCam(P, 800, 640, 2.1, () => walkWorld(P, S, { night: false }));
  else walkWorld(P, S, { night: o.night });
}

function shotFence(P, S, o) {
  const { t, bf, bp } = S;
  if (o.close) {
    withCam(P, 960, 560, 1.25, () => {
      fence(P, -200, 2120, 60, 1200, 3);
      const k = backOut(clamp((t - T.fenceClose) / 0.22), 1.8);
      if (t >= T.fenceClose) bandPoster(P, 980, 600, lerp(1.35, 1.05, k), lerp(-0.2, 0.04, k));
    });
    if (t >= T.fenceClose) sfx(P, 'SLAP!', 1470, 300, 120 * clamp((t - T.fenceClose) * 6), -0.2);
    return;
  }
  skyNight(P);
  stars(P, t, { n: 80, yMax: 380, seed: 12 });
  moon(P, 1650, 150, 50);
  fence(P, -20, 1940, 430, 1000, 3);
  const L = 0.7 + 0.3 * S.kick;
  stringLights(P, -60, 250, 1980, 300, 120, 14, L, { t, size: 1.4 });
  stringLights(P, -60, 330, 1980, 360, 90, 12, L, { t, seed: 5, size: 1.2 });
  P.fill(rect(-100, 1000, W + 200, 100), [0.15, 0.3, 0.4]);
  sandwichBoard(P, 1560, 1050, 1.15, [['ALL AGES', 58, K.paper], ['SHOW', 66, [1, 0, 0]], ['TONIGHT', 56, K.paper]]);
  const u = clamp((t - T.fence) / 2.6);
  const x = lerp(-200, 720, u);
  const walking = u < 1 ? 1 : 0;
  const phase = Math.PI / 2 + (Math.PI / 2) * bp;
  girlSide(P, x, 1010, 1.1, { phase: walking ? phase : Math.PI, walk: walking, bf, hairLag: Math.sin(phase * 2) * walking, look: 1 - walking, blink: blinkAt(t, 0.7) });
}

function shotBust(P, S, o) {
  const { t, bf } = S;
  bokeh(P, t, { level: 0.75 + 0.25 * S.kick });
  const sway = Math.sin((S.bp * Math.PI) / 4);
  const s = o.s || 1.05, cy = o.cy || 560;
  const camera = o.camera ? easeInOut(clamp((t - o.camera[0]) / (o.camera[1] - o.camera[0]))) : 0;
  P.save();
  P.translate(960 + sway * 10, cy);
  P.rotate(sway * 0.03);
  girlBust(P, 0, 0, s, { t, bf, sway, blink: o.happy ? 0 : blinkAt(t), lookY: o.lookY ?? -0.4, lookX: o.lookX ?? 0, happy: o.happy ? 1 : 0, smile: o.smile ?? 0.6, camera });
  P.restore();
}

// layout for the photo pile (x, y, width, rotation)
const PILE = [
  [520, 330, 560, -0.12], [1400, 300, 540, 0.1], [960, 620, 600, 0.03], [360, 780, 520, 0.14], [1560, 760, 560, -0.09],
  [860, 250, 480, 0.18], [1180, 860, 520, -0.16], [260, 380, 470, -0.2], [1680, 420, 480, 0.2], [640, 900, 520, 0.08],
  [1320, 560, 560, -0.05], [560, 560, 540, 0.11], [1720, 980, 460, -0.14], [960, 440, 720, -0.02],
];
const STOP_PHOTOS = [PH.lights, PH.flyer, PH.hand, PH.drums, PH.selfie, PH.mountains, PH.guitar, PH.board, PH.phones, PH.cat, PH.singer, PH.moth, PH.tape, PH.stage];

function photoPile(P, S, hits, contents, layout, { zoomLast = null } = {}) {
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
      P.save();
      P.translate(x, y);
      P.scale(s);
      photo(P, 0, 0, w, rot + (1 - k) * 0.3, contents[i % contents.length], { shadow: k > 0.5 });
      P.restore();
    }
  };
  if (zoomLast && n === hits.length) {
    const [x, y, w, rot] = layout[(n - 1) % layout.length];
    const z = easeIn(clamp((t - zoomLast[0]) / (zoomLast[1] - zoomLast[0])));
    const iw = w * 0.88;
    const s = lerp(1, W / iw * 1.02, z);
    const cy = y - (w * 0.2 - w * 0.06) / 2 * (1);
    P.save();
    P.translate(W / 2, H / 2);
    P.scale(s);
    P.rotate(-rot * z);
    P.translate(-lerp(W / 2, x, z), -lerp(H / 2, cy, z));
    draw();
    P.restore();
  } else draw();
  // CLICK! lettering next to the newest print
  if (n > 0) {
    const lt = t - hits[n - 1];
    if (lt < 0.5) {
      const [x, y] = layout[(n - 1) % layout.length];
      sfx(P, n % 2 ? 'CLICK!' : 'SNAP!', clamp(x + (n % 2 ? 230 : -230), 200, W - 200), clamp(y - 170, 120, H - 100), 96 * backOut(clamp(lt / 0.12)), hs(n) * 0.2, [1, 1, 0]);
    }
  }
}

function shotStops(P, S) {
  photoPile(P, S, STOP_HITS, STOP_PHOTOS, PILE, { zoomLast: [STOP_HITS[STOP_HITS.length - 1] + 0.35, T.chorus1] });
}

function shotStage(P, S, o) {
  const cam = o.cam || [960, 540, 1];
  withCam(P, cam[0], cam[1], cam[2], () => stage(P, S, o));
}

function shotCrowd(P, S, o) {
  const { t, bp, bf } = S;
  withCam(P, 960, 400, 0.72, () => stage(P, S, { crowd: false, wideLights: true }));
  crowd(P, { y: 1000, n: 9, seed: 21, scale: 1.1, bounce: 1, beatPos: bp + 0.5, arms: 0.4, bf, inks: [0, 0.85, 0.95], t, phones: o.phones ?? 0 });
  crowd(P, { y: 1180, n: 5, seed: 22, scale: 1.9, bounce: 1, beatPos: bp, arms: o.arms ?? 0.5, bf, girlAt: 2, t, phones: o.phones ?? 0 });
  if (o.confetti) confetti(P, t, { t0: o.confetti, n: 70, seed: 4 });
}

function shotPit(P, S, o) {
  pit(P, S.t, { speed: o.speed || 0.55, bounce: 1, bf: S.bf });
  if (o.confetti) confetti(P, S.t, { t0: o.confetti, n: 50, seed: 8, speed: 200 });
}

function shotZine(P, S) {
  const { t } = S;
  const lt = t - T.zine;
  P.fill(rect(-100, -100, W + 200, H + 200), [0.08, 0.04, 0]);
  const dim = 1 - inv(116.2, T.brk, t);
  const panels = [
    [60, 50, 1060, 560, 0, (P2) => { P2.fill(rect(0, 0, W, H), [0.3, 1, 1]); stringLights(P2, -60, 200, 1980, 300, 260, 9, dim * (0.7 + 0.3 * S.kick), { t, size: 3 }); }],
    [1160, 50, 700, 560, 2.88, (P2) => { P2.fill(rect(0, 0, W, H), [0.15, 1, 0]); P2.glow(960, 380, 700, [0, 0.7 * dim, 0], 'destination-out'); musician(P2, 900, 1500, 2.4, { seed: 2, mic: true, bf: S.bf, bob: Math.abs(Math.sin(Math.PI * S.bp)), headbang: S.snare * 0.5 }); }],
    [60, 650, 700, 380, 5.76, (P2) => { P2.fill(rect(0, 0, W, H), [0.1, 0.16, 0]); girlBust(P2, 960, 700, 3.4, { t, bf: S.bf, blink: blinkAt(t, 0.5), lookY: -0.8, lookX: 0.4 }); }],
    [800, 650, 1060, 380, 8.64, (P2) => { P2.fill(rect(0, 0, W, H), [1, 0.35, 0]); P2.glow(960, 300, 900, [0, 0.35, 0], 'destination-out'); crowd(P2, { y: 1250, n: 7, seed: 31, scale: 1.8, arms: 0.9, bounce: 1, beatPos: S.bp, bf: S.bf, t, clap: 1 }); }],
  ];
  for (const [x, y, w, h, at, fn] of panels) {
    if (lt < at) continue;
    const k = backOut(clamp((lt - at) / 0.2));
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
  }
  // caption boxes
  if (lt > 0.3) {
    P.save();
    P.translate(130, 95);
    P.rotate(-0.02);
    P.fill(rect(0, -44, 380, 64), [1, 0, 0]);
    P.stroke(rect(0, -44, 380, 64), K.ink, 5);
    P.text('meanwhile...', 190, 0, '40px "Special Elite"', K.ink);
    P.restore();
  }
  if (lt > 11.6) {
    P.save();
    P.translate(1500, 990);
    P.rotate(0.03);
    P.fill(rect(-230, -46, 460, 66), [1, 0, 0]);
    P.stroke(rect(-230, -46, 460, 66), K.ink, 5);
    P.text('and then the lights went out', 0, 0, '30px "Special Elite"', K.ink);
    P.restore();
  }
}

function shotBreak(P, S) {
  const { t } = S;
  const lt = t - T.brk;
  P.fill(rect(-100, -100, W + 200, H + 200), [0.3, 1, 1]);
  const flick = lt < 0.4 ? (Math.floor(lt * 24) % 2 ? 0.2 : 1) : t > T.chorus2 - 0.55 ? (Math.floor(t * 24) % 3 ? 0 : 0.5) : 0.8 + 0.2 * Math.sin(t * 17) * Math.sin(t * 5);
  const swing = Math.sin(lt * 1.6) * 0.22;
  const [bx, by] = bulb(P, 960, -40, 430, swing, flick, { size: 1.5 });
  for (let i = 0; i < 2; i++) {
    const a = t * (2.2 + i) + i * 2;
    moth(P, bx + Math.cos(a) * (150 + i * 60), by + Math.sin(a * 1.3) * 100, 1.2 - i * 0.3, t * 30 + i);
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
  const contents = [PH.selfie, PH.stage, PH.flyer, PH.cat, PH.lights, PH.hand];
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

function shotSky(P, S) {
  const { t, bf } = S;
  const up = easeInOut(inv(T.buildUp, T.buildUp + 3.5, t));
  skyNight(P, { top: [0, 0.75, 1], mid: [0, 0.5, 1], low: [0.1, 0.55, 0.8] });
  stars(P, t, { n: 160, yMax: 1200, seed: 17, twinkle: 1 });
  // string lights overhead, sliding away as we tilt up
  const off = up * 1200;
  P.save();
  P.translate(0, off);
  const spin = (t - T.build) * 0.02;
  P.translate(W / 2, H / 2);
  P.rotate(spin);
  P.translate(-W / 2, -H / 2);
  const L = 0.8 + 0.2 * S.kick;
  stringLights(P, -300, -200, 2200, 1300, 150, 16, L, { t, size: 1.8 });
  stringLights(P, 2200, -200, -300, 1300, 150, 16, L, { t, seed: 3, size: 1.8 });
  stringLights(P, -300, 540, 2200, 540, 200, 16, L, { t, seed: 6, size: 2.0 });
  P.restore();
  // shooting star, then the comet that rides the riser
  if (t > 179.78 && t < 180.6) {
    const k = (t - 179.78) / 0.8;
    const x = lerp(1500, 700, k), y = lerp(80, 300, k);
    P.stroke(line([[x, y], [x + 220, y - 60]]), K.paper, 6 * (1 - k));
  }
  if (t >= T.final) {
    // the comet bursts on the downbeat of the last section
    const lt = t - T.final;
    firework(P, 960, 420, lt, 3, [1, 0, 0]);
    firework(P, 520, 300, lt - 0.36, 5, [0, 1, 0]);
    firework(P, 1420, 320, lt - 0.72, 7, [1, 1, 0]);
    confetti(P, t, { t0: T.final, n: 80, seed: 21, burst: [960, 420] });
  } else if (t > 180.9) {
    const k = easeInOut(inv(180.9, T.final, t));
    comet(P, lerp(1850, 960, k), lerp(60, 420, k), Math.atan2(360, -890), 520 * (0.5 + k), 0.9 + k * 0.9);
  }
  // crowd looking up
  P.save();
  P.translate(0, lerp(500, 0, up));
  crowd(P, { y: 1200, n: 8, seed: 41, scale: 1.4, bounce: 0.2, beatPos: S.bp, bf, girlAt: 4, t });
  P.restore();
}

function surfScene(P, S, u) {
  const { t, bp, bf } = S;
  withCam(P, 960, 380, 0.72, () => stage(P, S, { crowd: false, wideLights: true, flood: FLOODS[3] }));
  crowd(P, { y: 1010, n: 9, seed: 21, scale: 1.1, bounce: 1, beatPos: bp + 0.5, arms: 0.95, bf, inks: [0, 0.85, 0.95], t });
  const x = lerp(-350, 2250, u);
  const y = 500 + Math.sin(t * 5) * 14;
  P.save();
  P.translate(x, y);
  P.rotate(Math.PI / 2 + Math.sin(t * 3) * 0.05);
  P.scale(-1, 1);
  girlSide(P, 0, 220, 1.45, { walk: 0.3, phase: t * 4, armUp: 0.75, bf, shadow: false, blink: blinkAt(t) });
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
      marquee(P2, 300, 'KILBY GIRL • THE BED HEADS • ', 150, (t - T.finale) * 260, [0, 0, 1], { band: [1, 0.06, 0], h: 150 });
      marquee(P2, 520, 'ALL AGES • KILBY GIRL • TONIGHT • ', 110, -(t - T.finale) * 200, [1, 0, 0], { band: [0, 1, 0.9], h: 110 });
    },
  });
  confetti(P, t, { t0: T.finale - 1.5, n: 90, seed: 7, speed: 230 });
}

const MONTAGE = [
  (P, S) => shotStage(P, S, { flood: FLOODS[1], arms: 0.7 }),
  (P, S) => shotStage(P, S, { cam: [1010, 520, 2.0], flood: FLOODS[2] }),
  (P, S) => shotPit(P, S, { speed: 0.9 }),
  (P, S) => shotBust(P, S, { happy: true, s: 1.4, cy: 620 }),
  (P, S) => shotCrowd(P, S, { arms: 0.9 }),
  (P, S) => { P.fill(rect(-100, -100, W + 200, H + 200), [0, 0, 1]); bigType(P, 'KILBY', W / 2, 520, 420, [1, 0, 0], { shadow: [0, 1, 0], off: [16, 14] }); bigType(P, 'GIRL', W / 2, 960, 420, [0, 1, 0], { shadow: [1, 0, 0], off: [16, 14] }); },
  (P, S) => shotStage(P, S, { cam: [880, 420, 2.1], flood: FLOODS[3] }),
  (P, S) => { P.fill(rect(-100, -100, W + 200, H + 200), [1, 0.06, 0]); cassette(P, 960, 560, 1.5, Math.sin(S.t * 3) * 0.1, 'KILBY GIRL', S.t * 6); },
];

function shotMontage(P, S) {
  const acc = S.clock.last('accents', S.t);
  const idx = Math.max(0, acc.i) % MONTAGE.length;
  MONTAGE[(idx * 5) % MONTAGE.length](P, S);
}

const OUTRO_PHOTOS = [PH.finale, PH.crowdsurf, PH.pit, PH.selfie, PH.stage, PH.mountains];
const OUTRO_PILE = [[560, 420, 640, -0.1], [1360, 400, 640, 0.09], [960, 700, 660, 0.02], [420, 800, 560, 0.12], [1500, 820, 580, -0.12], [960, 480, 760, -0.03]];

function shotOutro(P, S) {
  photoPile(P, S, OUTRO_HITS, OUTRO_PHOTOS, OUTRO_PILE);
}

function shotRingout(P, S) {
  const { t, bp, bf } = S;
  const lt = t - T.ringout;
  const walkerX = lerp(700, 2150, clamp(lt / 5.2));
  walkWorld(P, S, { night: true, walkerX, scrollT: 40, girl: lt < 5.4 });
  if (t > T.endCard) {
    const k = easeOut(clamp((t - T.endCard) / 0.6));
    P.alpha(k * 0.85).fill(rect(-100, -100, W + 200, H + 200), [0.25, 1, 1]).alpha(1);
    P.alpha(k);
    bigType(P, 'THE BED HEADS', W / 2, 470, 96, [1, 0, 0], { font: '"Rubik Mono One"', shadow: [0, 1, 0], off: [6, 6] });
    bigType(P, 'KILBY GIRL', W / 2, 700, 200, [0, 1, 0], { shadow: [1, 0, 0], off: [10, 8] });
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
  [T.bust, T.stops, shotBust, { camera: [T.bust + 0.6, T.stops - 0.3], lookY: 0, s: 1.15, cy: 600 }],
  [T.stops, T.chorus1, shotStops],
  // chorus 1: four 4-bar shots
  [T.chorus1, 67.35, shotStage, { arms: 0.35 }],
  [67.35, 73.11, shotStage, { cam: [1010, 520, 2.0] }],
  [73.11, 78.87, shotCrowd, { arms: 0.6 }],
  [78.87, T.verse2, shotStage, { arms: 0.5, back: (P) => bigType(P, 'KILBY GIRL', 960, 470, 280, [1, 0, 0], { shadow: [0, 0, 1] }) }],
  // verse 2
  [T.verse2, T.verse2b, shotBust, { lookY: -0.5 }],
  [T.verse2b, T.verse2c, shotBust, { happy: true, s: 1.6, cy: 660 }],
  [T.verse2c, T.zine, shotBust, { lookY: 0, smile: 1 }],
  [T.zine, T.brk, shotZine],
  [T.brk, T.chorus2, shotBreak],
  // chorus 2: 2-bar cuts
  [T.chorus2, 125.91, shotStage, { arms: 0.6, confetti: T.chorus2 }],
  [125.91, 128.79, shotPit, { speed: 0.6 }],
  [128.79, 131.67, shotStage, { cam: [1010, 520, 2.0] }],
  [131.67, 134.55, shotCrowd, { arms: 0.8, confetti: 131 }],
  [134.55, 137.43, shotStage, { cam: [880, 420, 2.1], back: (P) => bigType(P, 'KILBY GIRL', 960, 520, 230, [1, 0, 0], { shadow: [0, 0, 1] }) }],
  [137.43, 140.31, shotPit, { speed: 0.9, confetti: 137 }],
  [140.31, 143.19, shotStage, { arms: 0.8, back: (P) => bigType(P, 'KILBY GIRL', 960, 470, 280, [0, 0, 1], { shadow: [1, 0, 0] }) }],
  [143.19, T.darkroom, shotCrowd, { arms: 0.9, phones: 0.6, confetti: 142 }],
  [T.darkroom, T.build, shotDarkroom],
  [T.build, T.final, shotSky],
  [T.final, 185.03, shotSky],
  [185.03, T.finale, shotMontage],
  [T.finale, T.surf, shotFinale, {}],
  [T.surf, T.pitEnd, shotSurf],
  [T.pitEnd, T.outro, shotPit, { speed: 1.1, confetti: 220 }],
  [T.outro, T.ringout, shotOutro],
  [T.ringout, T.end + 1, shotRingout],
];

// paper-white flashes: camera shutters, the big drops
const FLASHES = [...STOP_HITS, T.chorus1, T.chorus2, T.final, ...OUTRO_HITS];

function flashAt(t) {
  let f = 0;
  for (const e of FLASHES) {
    const d = t - e;
    if (d >= -1 / 24 && d < 0.6) f = Math.max(f, d < 1 / 12 ? 0.92 : 0.92 * Math.exp(-(d - 1 / 12) / 0.09));
  }
  return f;
}

export function drawFrame(P, clock, t, scale = 1) {
  const shot = SHOTS.find(([a, b]) => t >= a && t < b) || SHOTS[SHOTS.length - 1];
  const E = energyAt(t);
  const S = {
    t, clock, bf: boilFrame(t), E,
    bp: clock.beatPos(t),
    kick: clock.pulse('kicks', t, 0.14),
    snare: clock.pulse('snares', t, 0.12),
    acc: clock.pulse('accents', t, 0.3),
    crash: clock.pulse('accents', t, 0.35),
    high: clock.avg('high', t, 0.2),
    rms: clock.avg('rms', t, 0.3),
  };
  // misregistration: a base offset, kicked around by hits in the loud sections
  const sn = clock.last('snares', t).i, ac = clock.last('accents', t).i;
  const jolt = E * (S.snare * 1.5 + S.acc * 6);
  const reg = [[0, 0], [2, -1.5], [-2, 1.5]].map(([x, y], k) => [
    Math.round((x + hs(sn, ac, k, 1) * jolt) * scale),
    Math.round((y + hs(sn, ac, k, 2) * jolt) * scale),
  ]);
  P.begin(reg);
  P.save();
  P.scale(scale);
  shot[2](P, S, shot[3] || {});
  // title print-in and final fade to bare paper
  const fade = Math.max(1 - clamp(t / 0.8), inv(T.end - 2.2, T.end - 0.2, t), flashAt(t));
  if (fade > 0) P.alpha(fade).fill(rect(-100, -100, W + 200, H + 200), K.paper).alpha(1);
  P.restore();
}

export { T };
