// Characters: the Kilby girl (walking profile + close-up), the band and the crowd.
import { blob, boil, capsule, circle, curve, ellipse, line, poly, rect, roundRect, star } from './shapes.mjs';
import { clamp, hash, hs, lerp, TAU } from './util.mjs';
import { K } from './world.mjs';

const darker = (inks, k = 0.25) => inks.map((v, i) => (i === 2 ? clamp(v + k) : clamp(v + k * 0.4)));

// ---------------------------------------------------------------- the girl, walking profile
// feet at (x, y), facing right. phase: walk cycle (heel strike of the near leg at PI/2)
export function girlSide(P, x, y, s, { phase = 0, walk = 1, bf = 0, hairLag = 0, armUp = 0, look = 0, blink = 0, face = 1, shadow = true } = {}) {
  P.save();
  P.translate(x, y);
  P.scale(s * face, s);
  if (shadow) P.fill(ellipse(10, 0, 120, 16), [0, 0.3, 0.45]);
  const bob = -7 * Math.cos(2 * phase) * walk;
  const hip = [0, -196 + bob];
  const sh = [8, -326 + bob];
  const jit = (pts, a = 1.3) => boil(pts, a, bf);

  const leg = (ph, far) => {
    const th = 0.42 * Math.sin(ph) * walk;
    const flex = (0.95 * Math.max(0, Math.cos(ph)) ** 1.5 + 0.1) * walk;
    const knee = [hip[0] + Math.sin(th) * 98, hip[1] + Math.cos(th) * 98];
    const sa = th - flex;
    const ank = [knee[0] + Math.sin(sa) * 94, knee[1] + Math.cos(sa) * 94];
    const denim = far ? [0, 0.45, 1] : K.denim;
    P.fill(capsule(hip[0], hip[1], knee[0], knee[1], 44, 36), denim);
    P.fill(capsule(knee[0], knee[1], ank[0], ank[1], 36, 32), denim);
    // chunky boot
    const fa = -sa * 0.35 + (Math.cos(ph) > 0 ? 0.25 * Math.max(0, Math.sin(ph)) : 0) * walk;
    P.save();
    P.translate(ank[0], ank[1]);
    P.rotate(fa);
    const boot = curve(jit([[-18, -26], [16, -26], [22, -8], [50, -2], [56, 10], [52, 18], [-22, 18], [-24, 0]]));
    P.fill(boot, K.ink);
    P.fill(rect(-22, 12, 76, 6), [0.1, 0.35, 0.45]);
    P.restore();
  };
  const arm = (ph, far) => {
    const a = (-0.38 * Math.sin(ph) * walk) * (1 - armUp) + armUp * 2.4;
    const el = [sh[0] + Math.sin(a) * 82, sh[1] + Math.cos(a) * 82];
    const fa2 = a + 0.28 - armUp * 0.2;
    const hand = [el[0] + Math.sin(fa2) * 74, el[1] + Math.cos(fa2) * 74];
    const knit = far ? [1, 0.32, 0.12] : [1, 0.06, 0];
    P.fill(capsule(sh[0], sh[1], el[0], el[1], 42, 40), knit);
    P.fill(capsule(el[0], el[1], hand[0], hand[1], 40, 36), knit);
    const cx = lerp(el[0], hand[0], 0.9), cy = lerp(el[1], hand[1], 0.9);
    P.fill(capsule(lerp(el[0], hand[0], 0.8), lerp(el[1], hand[1], 0.8), cx, cy, 38, 38), [0.4, 1, 0.1]);
    P.fill(circle(hand[0] + Math.sin(fa2) * 12, hand[1] + Math.cos(fa2) * 12, 15), far ? K.skinShade : K.skin);
  };

  // tote bag hanging behind
  const swing = Math.sin(phase * 2 - 0.8) * 0.12 * walk;
  P.save();
  P.translate(sh[0] - 24, sh[1] + 8);
  P.rotate(swing);
  P.stroke(line([[0, 0], [-6, 100]]), [0, 0.3, 0.7], 5);
  P.fill(roundRect(-58, 96, 70, 84, 8), [0.08, 0.05, 0.15]);
  P.fill(star(-23, 138, 18, 8), K.pink);
  P.restore();

  const ph2 = phase + Math.PI;
  arm(ph2, true);
  leg(ph2, true);
  // torso: oversized yellow cardigan over a navy tee
  const torso = curve(jit([[sh[0] - 36, sh[1] - 6], [sh[0] + 26, sh[1] - 10], [sh[0] + 40, sh[1] + 40], [hip[0] + 44, hip[1] + 10], [hip[0] + 30, hip[1] + 34], [hip[0] - 44, hip[1] + 36], [hip[0] - 50, hip[1] + 4], [sh[0] - 46, sh[1] + 50]]), true, 0.4);
  P.fill(torso, [1, 0.06, 0]);
  P.fill(poly(jit([[sh[0] + 22, sh[1] - 6], [sh[0] + 36, sh[1] + 34], [hip[0] + 40, hip[1] + 20], [hip[0] + 30, hip[1] + 20], [sh[0] + 16, sh[1] + 20]])), K.navy);
  for (const k of [0.35, 0.62]) P.fill(rect(lerp(sh[0], hip[0], k) - 44, lerp(sh[1], hip[1], k), 30, 7), [0.4, 1, 0.1]);
  leg(phase, false);
  // camera on its strap
  P.stroke(line([[sh[0] - 30, sh[1] + 4], [hip[0] + 30, hip[1] - 26]]), K.ink, 5);
  P.fill(roundRect(hip[0] + 14, hip[1] - 44, 50, 34, 5), K.ink);
  P.fill(circle(hip[0] + 58, hip[1] - 27, 13), [0.2, 0.3, 0.5]);
  P.fill(circle(hip[0] + 58, hip[1] - 27, 7), K.ink);
  arm(phase, false);

  // head
  const hx = sh[0] + 14, hy = sh[1] - 62 + (look ? -2 : 0);
  P.fill(capsule(sh[0] + 4, sh[1] + 6, hx - 4, hy + 30, 30, 26), K.skinShade);
  // hair back (bob), lags behind the step
  const lag = hairLag * 14;
  P.fill(curve(jit([[hx - 50, hy - 20], [hx - 20, hy - 58], [hx + 26, hy - 54], [hx + 40, hy - 30], [hx - 2, hy + 10], [hx - 12, hy + 48 + lag * 0.3], [hx - 48 - lag, hy + 50 + lag * 0.5], [hx - 60 - lag, hy + 22]]), true, 0.5), K.hair);
  // face profile
  const prof = curve(jit([[hx - 14, hy - 42], [hx + 26, hy - 42], [hx + 42, hy - 18], [hx + 44, hy - 6], [hx + 56, hy + 6], [hx + 44, hy + 12], [hx + 44, hy + 22], [hx + 38, hy + 30], [hx + 36, hy + 38], [hx + 16, hy + 46], [hx - 6, hy + 34]], 0.8), true, 0.45);
  P.fill(prof, K.skin);
  P.fill(circle(hx + 22, hy + 20, 12), [0, 0.38, 0]);
  if (blink) P.stroke(line([[hx + 22, hy - 2], [hx + 34, hy - 2]]), K.navy, 4);
  else {
    P.fill(ellipse(hx + 28, hy - 3 - look * 3, 5, 7), K.navy);
    P.stroke(line([[hx + 30, hy - 10], [hx + 37, hy - 15]]), K.navy, 3);
  }
  P.stroke(line([[hx + 38, hy + 26], [hx + 44, hy + 26]]), [0.3, 1, 0.3], 4);
  // bangs + crown over the face
  P.fill(curve(jit([[hx - 30, hy - 44], [hx + 6, hy - 62], [hx + 40, hy - 46], [hx + 48, hy - 20], [hx + 40, hy - 12], [hx + 20, hy - 16], [hx + 4, hy - 12], [hx - 10, hy + 6], [hx - 26, hy - 2]]), true, 0.5), K.hair);
  // hair clip
  P.fill(rect(hx + 8, hy - 36, 20, 7), K.yellow);
  P.restore();
}

// ---------------------------------------------------------------- the girl, close-up (front)
export function girlBust(P, cx, cy, s, { t = 0, bf = 0, blink = 0, lookX = 0, lookY = 0, smile = 0.5, sway = 0, camera = 0, happy = 0, mouth = 0, glowRim = 0 } = {}) {
  P.save();
  P.translate(cx, cy);
  P.scale(s);
  const jit = (pts, a = 1.6) => boil(pts, a, bf);
  const sw = sway * 22;
  // back hair
  P.fill(curve(jit([[-160, -40], [-150, -150], [-60, -205], [60, -205], [150, -150], [165, -40], [180, 90 + sw * 0.3], [150 + sw, 135], [100, 120], [-100, 120], [-150 + sw, 135], [-182, 90 - sw * 0.3]]), true, 0.5), K.hair);
  // shoulders & cardigan
  P.fill(curve(jit([[-330, 420], [-300, 250], [-180, 190], [-60, 175], [60, 175], [180, 190], [300, 250], [330, 420]]), true, 0.35), [1, 0.06, 0]);
  for (let i = 0; i < 5; i++) {
    P.fill(poly([[-300 + i * 8, 262 + i * 34], [-150, 240 + i * 34], [-150, 250 + i * 34], [-302 + i * 8, 274 + i * 34]]), [0.3, 0.85, 0.08]);
    P.fill(poly([[300 - i * 8, 262 + i * 34], [150, 240 + i * 34], [150, 250 + i * 34], [302 - i * 8, 274 + i * 34]]), [0.3, 0.85, 0.08]);
  }
  // navy tee in the V of the cardigan
  P.fill(poly(jit([[-100, 180], [100, 180], [70, 420], [-70, 420]])), K.navy);
  P.fill(star(0, 320, 40, 16), K.yellow);
  // camera strap
  P.stroke(line([[-150, 200], [-110, 420]]), K.ink, 10);
  P.stroke(line([[150, 200], [110, 420]]), K.ink, 10);
  // neck
  P.fill(poly(jit([[-52, 90], [52, 90], [60, 190], [0, 214], [-60, 190]])), K.skin);
  P.fill(poly([[-52, 100], [52, 100], [48, 140], [-48, 140]]), K.skinShade);
  // ears + earrings
  for (const sx of [-1, 1]) {
    P.fill(ellipse(sx * 128, 20, 22, 34), K.skinShade);
    P.stroke(circle(sx * 132, 70, 14), K.yellow, 5);
  }
  // face
  const face = curve(jit([[-125, -60], [-118, 40], [-86, 105], [-40, 138], [0, 146], [40, 138], [86, 105], [118, 40], [125, -60], [90, -130], [0, -150], [-90, -130]]), true, 0.5);
  P.fill(face, K.skin);
  // blush + freckles
  P.fill(circle(-72, 58, 30), [0.05, 0.4, 0]);
  P.fill(circle(72, 58, 30), [0.05, 0.4, 0]);
  for (let i = 0; i < 7; i++) P.fill(circle(-34 + i * 11 + hs(i, 3) * 3, 40 + hs(i, 4) * 6, 2.6), [0.3, 0.6, 0.35]);
  // eyes
  const ex = lookX * 8, ey = lookY * 6;
  for (const sx of [-1, 1]) {
    const x0 = sx * 52, y0 = 8;
    if (happy > 0.5) {
      P.stroke(curve([[x0 - 22, y0 + 6], [x0, y0 - 12], [x0 + 22, y0 + 6]], false), K.navy, 7);
    } else if (blink > 0.5) {
      P.stroke(curve([[x0 - 22, y0 + 2], [x0, y0 + 8], [x0 + 22, y0 + 2]], false), K.navy, 6);
    } else {
      P.fill(ellipse(x0, y0, 24, 17), [0, 0.02, 0.04]);
      P.fill(ellipse(x0 + ex, y0 + ey, 12, 14), K.navy);
      P.fill(circle(x0 + ex + 4, y0 + ey - 5, 4.5), K.paper);
      P.stroke(line([[x0 + sx * 20, y0 - 12], [x0 + sx * 32, y0 - 22]]), K.navy, 5);
      P.stroke(curve([[x0 - 26, y0 - 4], [x0, y0 - 20], [x0 + 26, y0 - 4]], false), K.navy, 5);
    }
  }
  // nose
  P.stroke(curve([[4, 26], [12, 52], [0, 60]], false), [0.2, 0.55, 0.15], 5);
  // mouth
  if (mouth > 0.05) {
    P.fill(ellipse(0, 94, 22, 8 + mouth * 16), [0.3, 1, 0.8]);
    P.fill(ellipse(0, 100 + mouth * 6, 12, 4 + mouth * 5), [0.4, 1, 0.2]);
  } else {
    P.stroke(curve([[-24, 88 - smile * 2], [0, 94 + smile * 8], [24, 88 - smile * 2]], false), [0.35, 1, 0.3], 6);
  }
  // bangs + side locks
  P.fill(curve(jit([[-150, -30], [-140, -140], [-60, -196], [60, -196], [140, -140], [150, -30], [128, -40], [110, -52], [70, -44], [40, -54], [0, -46], [-40, -54], [-70, -44], [-110, -52], [-128, -40]]), true, 0.4), K.hair);
  for (const sx of [-1, 1]) {
    P.fill(curve(jit([[sx * 150, -60], [sx * 130, 20], [sx * (116 + sw * sx * 0.4), 110], [sx * (140 + sw * sx * 0.2), 130], [sx * 170, 60], [sx * 168, -40]]), true, 0.5), K.hair);
  }
  // hair clip + highlight
  P.fill(roundRect(64, -128, 58, 16, 6), K.yellow);
  P.stroke(curve([[-90, -150], [-40, -176], [10, -178]], false), [0, 0.55, 0], 8);
  if (glowRim > 0) P.glow(0, -120, 260, [glowRim * 0.35, 0, 0]);
  // film camera up to the eye
  if (camera > 0) {
    P.save();
    P.translate(lerp(0, 40, 1 - camera), lerp(420, 0, camera));
    P.fill(roundRect(-190, -95, 380, 180, 24), K.ink);
    P.fill(rect(-190, -95, 380, 36), [0.2, 0.3, 0.45]);
    P.fill(roundRect(-150, -130, 80, 40, 8), K.ink);
    P.fill(circle(0, 8, 76), [0.2, 0.3, 0.45]);
    P.fill(circle(0, 8, 56), K.ink);
    P.fill(circle(0, 8, 36), [0, 0.5, 0.8]);
    P.fill(circle(-12, -6, 10), K.paper);
    P.fill(rect(120, -80, 44, 24), [0.9, 0.1, 0]);
    // fingers
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) P.fill(capsule(sx * 196, -40 + i * 34, sx * 150, -30 + i * 34, 28), K.skin);
    P.restore();
  }
  P.restore();
}

// ---------------------------------------------------------------- band (backlit silhouettes)
function bedhead(P, x, y, r, seed, bf, inks, sway = 0) {
  // messy "bed head" hair: a few uneven tufts rather than spikes
  const pts = [];
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = Math.PI * 0.92 + (i / (n - 1)) * Math.PI * 1.16;
    const tuft = i % 2 ? 1.02 : 1.14 + hash(seed, i) * 0.2;
    const lean = sway * 7 * (i / n);
    pts.push([x + Math.cos(a) * r * tuft + lean + hs(bf, seed, i) * 1.5, y + Math.sin(a) * r * tuft]);
  }
  P.fill(curve(pts, true, 0.35), inks);
  P.fill(circle(x, y + r * 0.12, r * 0.98), inks);
}

export function guitarShape(P, x, y, s, rot, inks, { bass = false, neckInks } = {}) {
  P.save();
  P.translate(x, y);
  P.rotate(rot);
  P.scale(s);
  const L = bass ? 330 : 250;
  P.fill(rect(10, -9, L, 18), neckInks || inks);
  P.fill(poly([[L + 5, -14], [L + 60, -22], [L + 64, 16], [L + 5, 12]]), neckInks || inks);
  P.fill(curve([[-70, -60], [-10, -44], [30, -52], [50, -20], [52, 22], [30, 56], [-20, 46], [-80, 62], [-120, 30], [-122, -30]], true, 0.5), inks);
  P.restore();
}

// musician standing on the stage floor at (x, floor); pose parameters drive a simple rig
export function musician(P, x, floor, s, { seed = 0, bf = 0, bob = 0, lean = 0, strum = 0, jump = 0, inks = K.navy, instrument = 'guitar', mic = false, headbang = 0, wide = 1 } = {}) {
  P.save();
  P.translate(x, floor - jump * 60);
  P.scale(s);
  const hipY = -230 + bob * 10;
  const shY = -440 + bob * 16;
  const sx = lean * 30;
  // legs
  P.fill(capsule(-24 * wide, hipY, -60 * wide, -8, 44, 36), inks);
  P.fill(capsule(24 * wide, hipY, 58 * wide, -8, 44, 36), inks);
  P.fill(ellipse(-68 * wide, -6, 36, 14), inks);
  P.fill(ellipse(66 * wide, -6, 36, 14), inks);
  // torso
  P.fill(curve([[-40 + sx, shY - 14], [40 + sx, shY - 14], [76 + sx, shY + 10], [72 + sx * 0.6, shY + 90], [58, hipY + 24], [-58, hipY + 24], [-72 + sx * 0.6, shY + 90], [-76 + sx, shY + 10]], true, 0.45), inks);
  // head
  const hy = shY - 70 + headbang * 30;
  P.fill(capsule(sx, shY, sx * 1.2, hy + 20, 34), inks);
  bedhead(P, sx * 1.3 + headbang * 6, hy, 50, seed, bf, inks, lean + headbang);
  // instrument
  if (instrument) {
    guitarShape(P, 0 + sx * 0.5, hipY - 40, 1, -0.38 + lean * 0.1, inks, { bass: instrument === 'bass' });
    // fret hand
    P.fill(capsule(60 + sx, shY + 30, instrument === 'bass' ? 250 : 190, hipY - 140, 30), inks);
    // strum hand
    const sa = strum * 0.9;
    P.fill(capsule(-60 + sx, shY + 30, -60, hipY - 60 + sa * 30, 30), inks);
    P.fill(capsule(-60, hipY - 60 + sa * 30, 10, hipY - 30 + sa * 40, 28), inks);
  } else {
    P.fill(capsule(-60 + sx, shY + 30, -110, hipY - 20, 30), inks);
    P.fill(capsule(60 + sx, shY + 30, 110, hipY - 20, 30), inks);
  }
  P.restore();
  if (mic) {
    // mic stand in front of the singer's mouth
    P.save();
    P.translate(x, floor);
    P.scale(s);
    P.fill(rect(-6, -490, 12, 490), inks);
    P.fill(poly([[-70, 0], [70, 0], [0, -30]]), inks);
    P.fill(capsule(0, -490, 30, -520, 12), inks);
    P.fill(ellipse(38, -526, 20, 13, -0.5), inks);
    P.restore();
  }
}

export function drumkit(P, x, floor, s, { bf = 0, kick = 0, snare = 0, crash = 0, t = 0, inks = K.navy, logo = true, drummer = true } = {}) {
  P.save();
  P.translate(x, floor);
  P.scale(s);
  // drummer behind the kit
  if (drummer) {
    const up = 1 - snare;
    P.fill(curve([[-80, -420], [80, -420], [70, -200], [-70, -200]], true, 0.2), inks);
    bedhead(P, 0, -500 + kick * 8, 48, 77, bf, inks, kick);
    P.fill(capsule(0, -420, 0, -470, 30), inks);
    // arms with sticks
    const la = -0.9 - up * 0.9, ra = -2.2 + (1 - crash) * 0.9;
    const L = [-70 + Math.cos(la) * 110, -400 + Math.sin(la) * 110];
    const R = [70 + Math.cos(ra + Math.PI) * -110, -400 + Math.sin(ra) * 110];
    P.fill(capsule(-70, -400, L[0], L[1], 30), inks);
    P.fill(capsule(70, -400, R[0], R[1], 30), inks);
    P.stroke(line([L, [L[0] - 60 - up * 20, L[1] - 70 + up * 30]]), inks, 9);
    P.stroke(line([R, [R[0] + 70, R[1] - 60 + crash * 50]]), inks, 9);
  }
  // cymbals
  const cym = (cx, cy, rx, hit) => {
    P.fill(rect(cx - 4, cy, 8, -cy), inks);
    if (hit > 0.05) P.glow(cx, cy, rx * 1.9 * (0.6 + hit), [hit * 0.9, 0.1, 0]);
    P.fill(ellipse(cx, cy, rx, 12, hit * 0.1), hit > 0.3 ? [1, 0.2 * (1 - hit), 0] : inks);
  };
  cym(-250, -420, 110, crash);
  cym(260, -380, 90, snare * 0.6);
  // toms, snare, kick
  P.fill(roundRect(-150, -330, 110, 80, 10), inks);
  P.fill(roundRect(40, -330, 110, 80, 10), inks);
  P.fill(roundRect(-240, -250, 120, 60, 8), inks);
  const kr = 150 * (1 + kick * 0.04);
  P.fill(circle(0, -kr, kr), inks);
  if (logo) {
    P.fill(circle(0, -kr, kr * 0.84), [0.08, 0.05, 0.12]);
    P.text('THE', 0, -kr - 34, '34px "Rubik Mono One"', K.navy);
    P.text('BED HEADS', 0, -kr + 16, '44px Anton', [0, 1, 0.2]);
    P.fill(star(0, -kr + 60, 16, 7), [1, 0, 0]);
  }
  P.restore();
}

export function amp(P, x, floor, w, h, inks = K.navy) {
  P.fill(roundRect(x - w / 2, floor - h, w, h, 8), inks);
  P.fill(rect(x - w / 2 + 14, floor - h + 40, w - 28, h - 56), [0.1, 0.55, 0.65]);
  P.fill(rect(x - w / 2 + 14, floor - h + 14, w - 28, 16), [0.6, 0.2, 0.2]);
}

// ---------------------------------------------------------------- crowd
// a row of backlit heads & shoulders. arms: 0..1 fraction of people with hands up
export function crowd(P, { y = 1000, n = 12, seed = 1, x0 = -80, x1 = W_ + 80, scale = 1, bounce = 0, beatPos = 0, arms = 0, bf = 0, inks = K.navy, girlAt = -1, phones = 0, t = 0, clap = 0 } = {}) {
  const people = [];
  for (let i = 0; i < n; i++) {
    const x = lerp(x0, x1, (i + 0.5 + hs(seed, i) * 0.3) / n);
    const s = scale * (0.9 + hash(seed, i, 2) * 0.25);
    const ph = hash(seed, i, 3);
    const b = Math.abs(Math.sin(Math.PI * (beatPos + ph * 0.25))) * bounce * 26 * s;
    people.push({ x, s, b, i, up: hash(seed, i, 4) < arms, ph });
  }
  for (const p of people) {
    const { x, s, b, i } = p;
    const yy = y - b;
    const isGirl = i === girlAt;
    const body = isGirl ? [0.95, 0.35, 0.25] : inks;
    // raised arms behind the head
    if (p.up) {
      const wave = Math.sin(t * 5 + i) * 0.15 + clap * 0.2;
      for (const sd of [-1, 1]) {
        if (hash(seed, i, 5) < 0.4 && sd === 1) continue;
        const ax = x + sd * 60 * s, ay = yy - 120 * s;
        const hx = ax + sd * (30 + wave * 80) * s, hy = ay - 190 * s + b * 0.5;
        P.fill(capsule(ax, ay, hx, hy, 34 * s, 28 * s), body);
        if (phones && hash(seed, i, 6) < phones && sd === 1) {
          P.glow(hx, hy - 30 * s, 120 * s, [0, 0.6, 0.8], 'destination-out');
          P.fill(roundRect(hx - 22 * s, hy - 70 * s, 44 * s, 70 * s, 6 * s), [0.9, 0.2, 0]);
        } else P.fill(circle(hx, hy - 6 * s, 22 * s), body);
      }
    }
    P.fill(curve([[x - 110 * s, yy + 200 * s], [x - 100 * s, yy - 60 * s], [x - 40 * s, yy - 110 * s], [x + 40 * s, yy - 110 * s], [x + 100 * s, yy - 60 * s], [x + 110 * s, yy + 200 * s]], true, 0.4), body);
    P.fill(capsule(x, yy - 110 * s, x, yy - 150 * s, 50 * s), isGirl ? K.skinShade : inks);
    const style = Math.floor(hash(seed, i, 7) * 5);
    const hy = yy - 185 * s;
    if (isGirl) {
      P.fill(curve(boil([[x - 72 * s, hy], [x - 60 * s, hy - 60 * s], [x, hy - 80 * s], [x + 60 * s, hy - 60 * s], [x + 72 * s, hy], [x + 76 * s, hy + 60 * s], [x - 76 * s, hy + 60 * s]], 2, bf)), K.hair);
      P.fill(roundRect(x + 30 * s, hy - 40 * s, 30 * s, 10 * s, 3 * s), K.yellow);
    } else {
      P.fill(circle(x, hy, 58 * s), inks);
      if (style === 0) P.fill(circle(x, hy - 60 * s, 28 * s), inks); // bun
      else if (style === 1) P.fill(curve([[x - 64 * s, hy], [x - 50 * s, hy - 70 * s], [x + 70 * s, hy - 60 * s], [x + 68 * s, hy + 90 * s], [x + 40 * s, hy + 80 * s], [x - 70 * s, hy + 90 * s]]), inks); // long hair
      else if (style === 2) { P.fill(ellipse(x, hy - 20 * s, 64 * s, 44 * s), inks); P.fill(ellipse(x + 50 * s, hy - 14 * s, 50 * s, 12 * s), inks); } // cap
      else if (style === 3) for (let k = 0; k < 6; k++) P.fill(circle(x + Math.cos(k) * 50 * s, hy - 20 * s + Math.sin(k * 2) * 30 * s, 24 * s), inks); // curls
    }
  }
}
const W_ = 1920;
