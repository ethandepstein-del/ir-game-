// The Bed Heads as characters: Noah (drums, vocals), Ethan (acoustic), Belle (bass), Brooks (electric).
// Drawn from a reference photo and gig clip, in the same three-ink riso palette as the rest.
import { boil, capsule, circle, curve, ellipse, line, poly, rect, roundRect, star } from './shapes.mjs';
import { clamp, hash, hs, lerp, TAU } from './util.mjs';
import { K } from './world.mjs';

const SKIN = [0.2, 0.07, 0];
const SKIN_SHADE = [0.34, 0.2, 0.04];

export const BAND = {
  noah: {
    hair: { style: 'curly', ink: [0.42, 0.85, 0.95] },
    top: { kind: 'openShirt', ink: [0.04, 0.06, 0.18], inner: [0.25, 1, 1], print: 'text' },
    pants: [0.2, 0.55, 0.85], shoes: K.ink, chain: true, bracelet: true,
  },
  ethan: {
    hair: { style: 'swept', ink: [0.4, 0.9, 1] },
    glasses: true,
    top: { kind: 'buttonShirt', ink: [0, 0.1, 0.42] },
    pants: [0.38, 0.28, 0.1], shoes: [0, 0, 0.08],
    instrument: 'acoustic',
  },
  belle: {
    hair: { style: 'long', ink: [0.55, 0.75, 0.62] },
    top: { kind: 'lace', ink: [0, 0.18, 0.4] },
    pants: [0, 0.12, 0.45], rips: true, shoes: K.ink, earrings: true,
    instrument: 'bass',
  },
  brooks: {
    hair: { style: 'wavy', ink: [0.75, 0.85, 0.35] },
    top: { kind: 'tee', ink: [0.25, 1, 1], print: 'portrait' },
    pants: [0.1, 0.55, 0.95], shoes: [0, 0, 0.1],
    instrument: 'electric',
  },
};

// ---------------------------------------------------------------- heads
// head centre at (0,0), face ~92 x 112 at scale 1
function hairBack(P, st, ink, bf) {
  const j = (pts, a = 1.4) => boil(pts, a, bf);
  if (st === 'curly') {
    P.fill(ellipse(0, -20, 60, 54), ink);
    for (let i = 0; i < 13; i++) {
      const a = Math.PI * (0.92 + (i / 12) * 1.16);
      const r = 54 + hash(i, 3) * 8;
      P.fill(circle(Math.cos(a) * r, -12 + Math.sin(a) * r * 0.95, 19 + hash(i, 4) * 7), ink);
    }
    P.fill(circle(-56, 16, 18), ink);
    P.fill(circle(56, 16, 18), ink);
  } else if (st === 'swept') {
    P.fill(ellipse(0, -24, 52, 46), ink);
  } else if (st === 'wavy') {
    P.fill(ellipse(0, -22, 53, 46), ink);
    P.fill(ellipse(-44, 0, 14, 26), ink);
    P.fill(ellipse(44, 0, 14, 26), ink);
  } else if (st === 'long') {
    P.fill(curve(j([[-50, -30], [-40, -66], [0, -76], [40, -66], [50, -30], [58, 60], [66, 170], [30, 186], [-30, 186], [-66, 170], [-58, 60]]), true, 0.45), ink);
  }
}

function hairFront(P, st, ink, bf) {
  const j = (pts, a = 1.4) => boil(pts, a, bf);
  if (st === 'curly') {
    for (let i = 0; i < 6; i++) P.fill(circle(-38 + i * 15, -44 + Math.abs(i - 2.5) * 3 + hash(i, 7) * 4, 14 + hash(i, 8) * 4), ink);
  } else if (st === 'swept') {
    P.fill(curve(j([[-48, -16], [-44, -50], [-18, -76], [22, -80], [50, -58], [50, -30], [30, -44], [4, -48], [-24, -40]]), true, 0.45), ink);
  } else if (st === 'wavy') {
    const pts = [[-50, -12], [-46, -52], [-10, -70], [30, -66], [52, -40], [50, -14]];
    for (let i = 0; i <= 6; i++) pts.push([48 - i * 16, -30 - (i % 2 ? 10 : 0)]);
    P.fill(curve(j(pts), true, 0.4), ink);
  } else if (st === 'long') {
    // centre part and front locks falling past the shoulders
    P.fill(curve(j([[-4, -70], [-40, -60], [-54, -20], [-56, 40], [-60, 120], [-44, 150], [-38, 80], [-40, 10], [-30, -40]]), true, 0.45), ink);
    P.fill(curve(j([[4, -70], [40, -60], [54, -20], [56, 40], [60, 120], [44, 150], [38, 80], [40, 10], [30, -40]]), true, 0.45), ink);
    P.stroke(line([[0, -72], [0, -58]]), SKIN, 3);
  }
}

export function head(P, spec, x, y, s, { bf = 0, mouth = 0, look = [0, 0], blink = 0, smile = 0.6, tilt = 0, happy = 0, skipBack = false } = {}) {
  P.save();
  P.translate(x, y);
  P.rotate(tilt);
  P.scale(s);
  const j = (pts, a = 1.2) => boil(pts, a, bf);
  if (!skipBack) hairBack(P, spec.hair.style, spec.hair.ink, bf);
  // ears
  P.fill(ellipse(-45, 8, 9, 15), SKIN_SHADE);
  P.fill(ellipse(45, 8, 9, 15), SKIN_SHADE);
  if (spec.earrings) { P.stroke(circle(-46, 26, 6), K.yellow, 2.5); P.stroke(circle(46, 26, 6), K.yellow, 2.5); }
  // face
  P.fill(curve(j([[-44, -26], [-42, 18], [-30, 44], [-14, 56], [0, 59], [14, 56], [30, 44], [42, 18], [44, -26], [30, -50], [0, -58], [-30, -50]]), true, 0.5), SKIN);
  P.fill(circle(-26, 22, 9), [0.15, 0.28, 0]);
  P.fill(circle(26, 22, 9), [0.15, 0.28, 0]);
  // eyes and brows
  const ex = look[0] * 3, ey = look[1] * 2.5;
  for (const sx of [-1, 1]) {
    const cx = sx * 17, cy = 2;
    if (happy > 0.5) P.stroke(curve([[cx - 7, cy + 2], [cx, cy - 4], [cx + 7, cy + 2]], false), K.navy, 3.2);
    else if (blink > 0.5) P.stroke(line([[cx - 7, cy + 1], [cx + 7, cy + 1]]), K.navy, 3.2);
    else P.fill(ellipse(cx + ex, cy + ey, 4.2, 5.6), K.navy);
    P.stroke(curve([[cx - 9, -14 + sx * 0], [cx, -18], [cx + 9, -15]], false), spec.hair.ink.map((v) => clamp(v + 0.1)), 3.4);
  }
  if (spec.glasses) {
    for (const sx of [-1, 1]) P.stroke(roundRect(sx * 17 - 14, -9, 28, 22, 7), [0.1, 0.4, 0.55], 3);
    P.stroke(line([[-3, 0], [3, 0]]), [0.1, 0.4, 0.55], 3);
    for (const sx of [-1, 1]) P.stroke(line([[sx * 31, -2], [sx * 44, -4]]), [0.1, 0.4, 0.55], 2.5);
  }
  // nose + mouth
  P.stroke(curve([[2, 8], [5, 22], [-1, 26]], false), [0.18, 0.5, 0.12], 3);
  if (mouth > 0.08) {
    P.fill(ellipse(0, 40, 10 + mouth * 3, 3 + mouth * 10), [0.3, 1, 0.8]);
    P.fill(ellipse(0, 43 + mouth * 3, 6, 1.5 + mouth * 3), [0.35, 1, 0.2]);
  } else {
    P.stroke(curve([[-11, 37 - smile * 2], [0, 40 + smile * 4], [11, 37 - smile * 2]], false), [0.3, 1, 0.3], 3.4);
  }
  hairFront(P, spec.hair.style, spec.hair.ink, bf);
  P.restore();
}

// ---------------------------------------------------------------- bodies
function torso(P, spec, shY, hipY, lean, bf) {
  const t = spec.top;
  const j = (pts, a = 1.2) => boil(pts, a, bf);
  const L = lean * 10;
  const shape = j([[-66 + L, shY + 10], [-40 + L, shY - 6], [40 + L, shY - 6], [66 + L, shY + 10], [62 + L * 0.6, shY + 80], [54, hipY + 12], [-54, hipY + 12], [-62 + L * 0.6, shY + 80]]);
  if (t.kind === 'openShirt') {
    P.fill(curve(shape, true, 0.3), t.inner);
    if (t.print === 'text') {
      P.text('BARR', L * 0.8, shY + 110, '30px Anton', [0, 0, 0], { spacing: 2 });
      P.fill(rect(-30 + L * 0.8, shY + 118, 60, 5), [0, 0, 0]);
    }
    for (const sd of [-1, 1]) {
      P.fill(poly(j([[sd * 66 + L, shY + 10], [sd * 40 + L, shY - 6], [sd * 18 + L, shY + 6], [sd * 26 + L * 0.7, shY + 70], [sd * 24, hipY + 14], [sd * 56, hipY + 14], [sd * 62 + L * 0.6, shY + 80]])), t.ink);
      P.fill(poly([[sd * 40 + L, shY - 6], [sd * 16 + L, shY + 4], [sd * 30 + L, shY + 36]]), t.ink.map((v, i) => clamp(v + (i === 2 ? 0.15 : 0.05))));
    }
    if (spec.chain) P.stroke(curve([[-22 + L, shY + 2], [0 + L, shY + 34], [22 + L, shY + 2]], false), K.paper, 3);
  } else if (t.kind === 'buttonShirt') {
    P.fill(curve(shape, true, 0.3), t.ink);
    P.stroke(line([[L * 0.8, shY + 4], [0, hipY + 10]]), t.ink.map((v) => clamp(v + 0.2)), 3);
    for (let i = 0; i < 5; i++) P.fill(circle(lerp(L * 0.8, 0, i / 5) + 5, lerp(shY + 26, hipY, i / 5), 3), K.paper);
    for (const sd of [-1, 1]) P.fill(poly([[sd * 4 + L, shY - 4], [sd * 28 + L, shY - 8], [sd * 20 + L, shY + 22]]), t.ink.map((v, i) => clamp(v + (i === 2 ? 0.2 : 0.05))));
    P.fill(poly([[-12 + L, shY - 4], [12 + L, shY - 4], [0 + L, shY + 12]]), K.paper);
  } else if (t.kind === 'lace') {
    P.fill(curve(shape, true, 0.3), t.ink);
    for (let r = 0; r < 7; r++) for (let c = 0; c < 6; c++) {
      const px = -45 + c * 18 + (r % 2) * 9, py = shY + 24 + r * 26;
      if (py < hipY) P.stroke(circle(px + L * 0.5, py, 5), K.paper, 1.6);
    }
    P.fill(ellipse(L, shY + 2, 26, 12), SKIN);
  } else {
    P.fill(curve(shape, true, 0.3), t.ink);
    P.fill(ellipse(L, shY - 1, 20, 8), SKIN);
    if (t.print === 'portrait') {
      const px = L * 0.8, py = shY + 100;
      P.fill(roundRect(px - 34, py - 40, 68, 82, 6), [0.05, 0.1, 0.25]);
      P.fill(ellipse(px, py - 12, 14, 18), [0.25, 1, 1]);
      P.fill(poly([[px - 26, py + 38], [px - 18, py + 8], [px + 18, py + 8], [px + 26, py + 38]]), [0.25, 1, 1]);
      P.fill(poly([[px - 4, py + 8], [px + 4, py + 8], [px, py + 30]]), [0.05, 0.1, 0.25]);
    }
  }
}

function sleeve(P, spec, ax, ay, bx, by) {
  const t = spec.top;
  const long = t.kind === 'openShirt';
  const ink = t.kind === 'openShirt' ? t.ink : t.ink;
  const k = long ? 0.85 : 0.42;
  P.fill(capsule(ax, ay, lerp(ax, bx, k), lerp(ay, by, k), 40, 34), ink);
}

// two-bone arm from shoulder to a hand target
function armIK(ax, ay, hx, hy, l1, l2, bend = 1) {
  const dx = hx - ax, dy = hy - ay;
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 1);
  const a = Math.atan2(dy, dx);
  const c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const b = Math.acos(c) * bend;
  return [ax + Math.cos(a + b) * l1, ay + Math.sin(a + b) * l1];
}

function drawArm(P, spec, sh, hand, bend) {
  const el = armIK(sh[0], sh[1], hand[0], hand[1], 96, 92, bend);
  P.fill(capsule(sh[0], sh[1], el[0], el[1], 34, 30), SKIN);
  P.fill(capsule(el[0], el[1], hand[0], hand[1], 30, 26), SKIN);
  sleeve(P, spec, sh[0], sh[1], el[0], el[1]);
  if (spec.top.kind === 'openShirt') P.fill(capsule(el[0], el[1], lerp(el[0], hand[0], 0.25), lerp(el[1], hand[1], 0.25), 34, 32), spec.top.ink);
  P.fill(circle(hand[0], hand[1], 17), SKIN);
  return el;
}

// ---------------------------------------------------------------- instruments
function instrument(P, kind, x, y, rot, s) {
  P.save();
  P.translate(x, y);
  P.rotate(rot);
  P.scale(s);
  if (kind === 'acoustic') {
    P.fill(rect(40, -10, 300, 20), [0.55, 0.6, 0.2]);
    P.fill(roundRect(330, -17, 70, 34, 8), [0.45, 0.65, 0.35]);
    const body = curve([[-150, 0], [-140, -78], [-70, -96], [-20, -64], [30, -80], [80, -56], [96, 0], [80, 56], [30, 80], [-20, 64], [-70, 96], [-140, 78]], true, 0.5);
    P.fill(body, [0.5, 0.75, 0.3]);
    P.fill(curve([[-140, 0], [-130, -68], [-70, -84], [-20, -54], [30, -68], [72, -48], [86, 0], [72, 48], [30, 68], [-20, 54], [-70, 84], [-130, 68]], true, 0.5), [0.72, 0.34, 0.04]);
    P.fill(circle(10, 0, 30), K.ink);
    P.fill(roundRect(-104, -26, 22, 52, 5), [0.4, 0.7, 0.4]);
    for (let i = 0; i < 6; i++) P.stroke(line([[-94, -15 + i * 6], [400, -15 + i * 6 * 0.55 + 6.5]]), K.paper, 1);
  } else {
    const bass = kind === 'bass';
    const neck = bass ? 380 : 290;
    P.fill(rect(40, -10, neck, 20), [0.5, 0.5, 0.15]);
    P.fill(poly([[neck + 30, -16], [neck + 100, -24], [neck + 104, 16], [neck + 30, 12]]), bass ? K.ink : [0.4, 0.5, 0.2]);
    const col = bass ? [0, 0.45, 1] : [1, 1, 0];
    P.fill(curve([[-120, 0], [-104, -64], [-40, -60], [10, -40], [60, -74], [96, -52], [70, -14], [80, 26], [40, 70], [-50, 70], [-110, 50]], true, 0.5), col);
    P.fill(curve([[-80, -30], [-20, -40], [30, -20], [40, 30], [-40, 46], [-90, 20]], true, 0.5), K.paper);
    P.fill(roundRect(-30, -24, 16, 46, 4), K.ink);
    if (!bass) P.fill(roundRect(8, -24, 16, 46, 4), K.ink);
    P.fill(roundRect(-78, -16, 14, 32, 3), [0.4, 0.6, 0.6]);
    for (let i = 0; i < (bass ? 4 : 6); i++) P.stroke(line([[-72, -9 + i * (bass ? 6 : 3.6)], [neck + 30, -9 + i * (bass ? 6 : 3.6)]]), K.paper, bass ? 1.4 : 1);
  }
  P.restore();
}

// ---------------------------------------------------------------- standing players
// feet at (x, floor). pose: bob 0..1, nod, lean, strum (0..1 phase), fret (0..1 along the neck), jump, mouth
export function player(P, spec, x, floor, s, pose = {}) {
  const { bf = 0, bob = 0, nod = 0, lean = 0, strum = 0, fret = 0.5, jump = 0, mouth = 0, look = [0, 0.4], blink = 0, micAt = null } = pose;
  P.save();
  P.translate(x, floor - jump * 70 * s);
  P.scale(s);
  const hipY = -236 + bob * 12, shY = -448 + bob * 16;
  // back hair falls behind the body
  const hx = lean * 14, hy = shY - 78 + nod * 8;
  if (spec.hair.style === 'long') { P.save(); P.translate(hx, hy); hairBack(P, 'long', spec.hair.ink, bf); P.restore(); }
  // legs
  const legInk = spec.pants;
  P.fill(capsule(-26, hipY, -46, -16, 50, 42), legInk);
  P.fill(capsule(26, hipY, 46, -16, 50, 42), legInk);
  if (spec.rips) for (const [lx, ly] of [[-40, -110], [42, -150], [-34, -170]]) P.fill(roundRect(lx - 12, ly, 24, 5, 2), K.paper);
  P.fill(roundRect(-78, -24, 60, 26, 10), spec.shoes);
  P.fill(roundRect(18, -24, 60, 26, 10), spec.shoes);
  P.fill(rect(-78, -4, 60, 6), K.paper);
  P.fill(rect(18, -4, 60, 6), K.paper);
  torso(P, spec, shY, hipY, lean, bf);
  // neck + head
  P.fill(capsule(hx * 0.6, shY + 4, hx, hy + 40, 30), SKIN_SHADE);
  // instrument across the body, neck to screen right
  const kind = spec.instrument;
  let strumHand = [-30, hipY - 40], fretHand = [150, shY + 60];
  if (kind) {
    const bx = -40 + lean * 6, by = hipY - 46, rot = -0.36;
    instrument(P, kind, bx, by, rot, 1);
    const d = [Math.cos(rot), Math.sin(rot)], n = [-d[1], d[0]];
    const neckLen = kind === 'bass' ? 380 : 290;
    const along = 70 + fret * (neckLen - 60);
    fretHand = [bx + d[0] * along + n[0] * 18, by + d[1] * along + n[1] * 18];
    const sw = Math.sin(strum * TAU) * 22;
    strumHand = [bx + d[0] * 6 + n[0] * sw, by + d[1] * 6 + n[1] * sw - 6];
  }
  if (micAt) {
    P.fill(rect(micAt[0] - 5, micAt[1], 10, -micAt[1]), K.ink);
    P.fill(capsule(micAt[0], micAt[1], micAt[0] - 30, micAt[1] - 30, 12), K.ink);
    P.fill(ellipse(micAt[0] - 38, micAt[1] - 38, 18, 12, -0.7), [0.2, 0.3, 0.4]);
  }
  drawArm(P, spec, [-62 + lean * 10, shY + 18], strumHand, -1);
  drawArm(P, spec, [62 + lean * 10, shY + 18], fretHand, 1);
  if (spec.bracelet) P.stroke(circle(strumHand[0], strumHand[1] + 14, 12), K.paper, 3);
  head(P, spec, hx, hy, 1, { bf, mouth, look, blink, tilt: lean * 0.08 + nod * 0.05, skipBack: spec.hair.style === 'long' });
  P.restore();
}

// ---------------------------------------------------------------- the drummer (sits behind the kit)
// draw order: drummerBody (before the kit), then drummerArms (after the kit)
export function drummerBody(P, spec, x, y, s, { bf = 0, bob = 0, mouth = 0, look = [0, 0.2], blink = 0, lean = 0 } = {}) {
  P.save();
  P.translate(x, y);
  P.scale(s);
  const shY = -150 + bob * 10;
  torso(P, spec, shY, 60, lean, bf);
  P.fill(capsule(lean * 8, shY + 4, lean * 14, shY - 40, 30), SKIN_SHADE);
  head(P, spec, lean * 14, shY - 80 + bob * 6, 1, { bf, mouth, look, blink, tilt: lean * 0.1 });
  // boom mic swinging in from the left
  P.fill(capsule(-300, -420, -60 + lean * 14, shY - 64, 10), K.ink);
  P.fill(ellipse(-44 + lean * 14, shY - 56, 20, 12, 0.5), [0.2, 0.3, 0.4]);
  P.restore();
}

export function drummerArms(P, spec, x, y, s, { snare = 0, hat = 0, crash = 0, bob = 0, lean = 0, snareAt = [-140, 12], hatAt = [202, -112] } = {}) {
  P.save();
  P.translate(x, y);
  P.scale(s);
  const shY = -150 + bob * 10;
  // right hand (screen left) plays the snare, left hand (screen right) keeps time on the hi-hat
  const sUp = 1 - snare, hUp = 1 - hat;
  const R = [snareAt[0] + 20, snareAt[1] - 40 - sUp * 70];
  const L = [hatAt[0] - 40, hatAt[1] + 30 - hUp * 40 - crash * 40];
  const shR = [-62 + lean * 10, shY + 18], shL = [62 + lean * 10, shY + 18];
  for (const [sh, h, bend] of [[shR, R, 1], [shL, L, -1]]) {
    const el = armIK(sh[0], sh[1], h[0], h[1], 90, 88, bend);
    P.fill(capsule(sh[0], sh[1], el[0], el[1], 34, 30), SKIN);
    sleeve(P, spec, sh[0], sh[1], el[0], el[1]);
    P.fill(capsule(el[0], el[1], h[0], h[1], 30, 26), SKIN);
    P.fill(circle(h[0], h[1], 16), SKIN);
  }
  // sticks reach for the drum heads
  const tipR = [lerp(R[0], snareAt[0], 1.1) - 10, lerp(R[1], snareAt[1], 1) + sUp * 20];
  const tipL = [lerp(L[0], hatAt[0], 1) + 10, lerp(L[1], hatAt[1], 1) + hUp * 10];
  P.stroke(line([R, tipR]), [0.65, 0.4, 0.1], 7);
  P.stroke(line([L, tipL]), [0.65, 0.4, 0.1], 7);
  if (spec.bracelet) P.stroke(circle(R[0], R[1] + 12, 11), K.paper, 3);
  P.restore();
}
