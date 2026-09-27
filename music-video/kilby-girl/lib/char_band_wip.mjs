// The Bed Heads as characters: Noah (drums, lead vocal), Ethan (acoustic), Belle (bass), Brooks (electric).
// Drawn from the band photo and the gig clip in the three-ink riso palette.
//
// Rigs take plain numbers in a pose object (see README of each function below), so scene code can
// drive them from performance data. Every rig accepts `lag`: the same pose evaluated a few frames
// earlier; hair, shirt tails and the chain follow it, so secondary motion trails the main action.
import { boil, capsule, circle, curve, ellipse, line, poly, rect, roundRect, star } from './shapes.mjs';
import { clamp, hash, hs, lerp, TAU } from './util.mjs';
import { K } from './world.mjs';
import {
  add, alpha, arc, brow, deepen, drag, ease, eye, fist, hand, ik, INK, mix, mouth, norm3, num, spring,
} from './charkit.mjs';

const SKIN = [0.2, 0.07, 0];
const SKIN_SHADE = [0.34, 0.2, 0.04];

// ---------------------------------------------------------------- the band
export const BAND = {
  noah: {
    name: 'noah',
    hair: { style: 'curly', ink: [0.5, 0.9, 0.85], shade: [0.7, 1, 1], hi: [0.32, 0.6, 0.45] },
    skin: [0.26, 0.11, 0], skinShade: [0.14, 0.13, 0.05],
    face: { w: 55, cheek: 57, jaw: 49, jawY: 38, chinW: 25, chinY: 63, top: -62, eyeX: 20, eyeY: 2, eyeR: 4.4, browY: -15, browLen: 24, browT: 8.5, browArch: 0.05, noseY: 25, noseW: 12, mouthY: 42, mouthW: 18, earY: 6, earH: 15, stubble: 1, sideburns: 1 },
    build: { sh: 88, waist: 76, hip: 70, neck: 64, arm: 1.12, armW: 1.3, height: 1 },
    top: { kind: 'openShirt', ink: [0.13, 0.12, 0.2], inner: [0.3, 1, 1], print: 'text', short: true },
    pants: [0.2, 0.55, 0.85], shoes: K.ink, chain: true, bracelet: true,
    expr: 'grin',
  },
  ethan: {
    name: 'ethan',
    hair: { style: 'swept', ink: [0.45, 0.88, 0.9], shade: [0.62, 1, 1], hi: [0.28, 0.55, 0.5] },
    skin: [0.2, 0.08, 0], skinShade: [0.13, 0.12, 0.05],
    face: { w: 45, cheek: 44, jaw: 37, jawY: 40, chinW: 15, chinY: 64, top: -60, eyeX: 17, eyeY: 2, eyeR: 4, browY: -15, browLen: 19, browT: 6, browArch: 0.2, noseY: 24, noseW: 8, mouthY: 42, mouthW: 16, earY: 6, earH: 14, stubble: 0.35, sideburns: 0.5 },
    glasses: true,
    build: { sh: 64, waist: 52, hip: 52, neck: 40, arm: 1.02, armW: 0.92, height: 1.02 },
    top: { kind: 'openShirt', ink: [0.03, 0.26, 0.4], inner: [0.17, 0.2, 0.3], long: true },
    pants: [0.42, 0.26, 0.12], shoes: [0.02, 0.03, 0.1],
    instrument: 'acoustic', strap: [0.9, 0.95, 0.15], guitarAngle: -0.3,
    expr: 'smile',
  },
  belle: {
    name: 'belle',
    hair: { style: 'long', ink: [0.55, 0.72, 0.5], shade: [0.7, 0.9, 0.7], hi: [0.35, 0.45, 0.25] },
    skin: [0.18, 0.08, 0], skinShade: [0.12, 0.13, 0.04],
    face: { w: 44, cheek: 44, jaw: 35, jawY: 33, chinW: 14, chinY: 57, top: -58, eyeX: 17, eyeY: 3, eyeR: 4.4, browY: -14, browLen: 18, browT: 3.6, browArch: 0.45, noseY: 21, noseW: 6, mouthY: 38, mouthW: 13, earY: 6, earH: 13, stubble: 0, sideburns: 0, lash: true, lip: [0.05, 0.36, 0.12], cheekTone: [0.02, 0.1, 0], female: true },
    build: { sh: 54, waist: 40, hip: 52, neck: 32, arm: 0.95, armW: 0.78, height: 0.97, female: true },
    top: { kind: 'lace', ink: [0.03, 0.2, 0.42] },
    pants: [0.02, 0.2, 0.72], rips: true, shoes: K.ink, boots: true, earrings: true,
    instrument: 'bass', strap: [0.3, 0.9, 0.95], guitarAngle: -0.72,
    expr: 'smile',
  },
  brooks: {
    name: 'brooks',
    hair: { style: 'wavy', ink: [0.78, 0.8, 0.26], shade: [0.85, 1, 0.45], hi: [0.55, 0.45, 0.08] },
    skin: [0.2, 0.08, 0], skinShade: [0.13, 0.12, 0.05],
    face: { w: 45, cheek: 45, jaw: 39, jawY: 44, chinW: 17, chinY: 68, top: -62, eyeX: 17, eyeY: 1, eyeR: 4.1, browY: -16, browLen: 19, browT: 5.6, browArch: 0.12, noseY: 27, noseW: 9, noseLen: 1.2, mouthY: 46, mouthW: 17, earY: 5, earH: 15, stubble: 0.25, sideburns: 0.4 },
    build: { sh: 66, waist: 54, hip: 54, neck: 42, arm: 1.05, armW: 0.96, height: 1.05 },
    top: { kind: 'tee', ink: [0.3, 1, 1], print: 'portrait' },
    pants: [0.12, 0.45, 0.8], shoes: [0.02, 0.03, 0.1],
    instrument: 'electric', strap: [0.9, 0.95, 0.15], guitarAngle: -0.34,
    expr: 'grin',
  },
};

const skinOf = (spec) => spec.skin || SKIN;
const shadeOf = (spec) => add(skinOf(spec), spec.skinShade || [0.14, 0.13, 0.04]);

// ---------------------------------------------------------------- expressions
// Each preset is a set of face numbers; `expr` may be a name or {name: weight}. Explicit pose fields win.
const NEUTRAL = { smile: 0.15, grin: 0, squint: 0, lid: 0, closed: 0, browAngle: 0, browRaise: 0, open: 0, wide: 0, round: 0, pitch: 0 };
export const EXPR = {
  neutral: {},
  smile: { smile: 0.65, squint: 0.2, browRaise: 0.1 },
  grin: { smile: 1, grin: 0.55, squint: 0.65, browRaise: 0.25, wide: 0.3 },
  focused: { smile: -0.05, lid: 0.5, browAngle: -0.55, browRaise: -0.35, pitch: -0.2 },
  feel: { smile: 0.35, closed: 1, browAngle: 0.7, browRaise: 0.35, pitch: 0.15 },
  shout: { smile: 0.1, open: 0.85, wide: 0.55, squint: 0.55, browAngle: -0.9, browRaise: -0.1 },
  belt: { closed: 0.7, browAngle: 0.55, browRaise: 0.6, pitch: 0.4 },
  cool: { smile: 0.25, lid: 0.45, browRaise: -0.1 },
  surprised: { smile: 0, open: 0.35, round: 0.6, browRaise: 0.9 },
};
function exprMix(expr) {
  const out = { ...NEUTRAL };
  if (!expr) return out;
  const w = typeof expr === 'string' ? { [expr]: 1 } : expr;
  for (const [k, a] of Object.entries(w)) {
    const pr = EXPR[k];
    if (!pr) continue;
    for (const [f, v] of Object.entries(pr)) out[f] += (v - NEUTRAL[f]) * a;
  }
  return out;
}

// resolve the face numbers for head(): expression preset + legacy fields + explicit overrides
function faceState(spec, o) {
  let expr = o.expr ?? (o.happy > 0.5 ? 'grin' : spec.expr || 'smile');
  const e = exprMix(expr);
  const m = typeof o.mouth === 'object' && o.mouth ? o.mouth : o.viseme || null;
  const vis = m ? { open: num(m.open), wide: num(m.wide), round: num(m.round) } : { open: num(o.mouth), wide: 0, round: 0 };
  const singing = vis.open > 0.06;
  const belt = num(o.belt);
  const b = typeof o.brow === 'object' && o.brow ? o.brow : {};
  const f = {
    smile: num(o.smile, singing ? Math.min(e.smile, 0.3) : e.smile),
    grin: singing ? 0 : e.grin,
    squint: e.squint * (singing ? 0.5 : 1),
    lid: num(o.lid, e.lid),
    closed: Math.max(e.closed, belt * EXPR.belt.closed),
    browAngle: num(o.browAngle, num(b.angle, e.browAngle + belt * EXPR.belt.browAngle)),
    browRaise: num(o.browRaise, num(b.raise, e.browRaise + belt * EXPR.belt.browRaise)),
    open: clamp(Math.max(vis.open, e.open)),
    wide: clamp(Math.max(vis.wide, e.wide * (singing ? 0.3 : 1))),
    round: clamp(vis.round + e.round),
    pitch: clamp(num(o.pitch) + e.pitch + belt * EXPR.belt.pitch, -1, 1),
    turn: clamp(num(o.turn), -1, 1),
    blink: num(o.blink),
  };
  if (o.happy > 0.5 && o.expr == null) f.squint = Math.max(f.squint, 0.8);
  return f;
}

// ---------------------------------------------------------------- hair
// All hair is in head units around the face centre. g: {dx, dy} secondary offset, bf boil frame.
function curlBumps(P, pts, ink, rBase, seed, bf, g) {
  pts.forEach(([x, y, w], i) => {
    const r = rBase * (0.82 + hash(seed, i) * 0.4) * (w ?? 1);
    const k = 0.4 + 0.6 * Math.min(1, Math.abs(y + 40) / 50);
    P.fill(circle(x + g.dx * k + hs(bf, seed, i) * 0.8, y + g.dy * k + hs(bf, seed, i, 2) * 0.8, r), ink);
  });
}

function hairBack(P, spec, g) {
  const h = spec.hair, st = h.style, j = (pts, a = 1.3) => boil(pts, a, g.bf);
  const T = g.turn * -4;
  if (st === 'curly') {
    // a tight mop that hugs the skull; the silhouette is a ring of curl bumps, not a helmet
    P.fill(curve(j([[-58 + T, 10], [-66 + T, -18], [-64 + T, -48], [-50 + T, -74], [-26 + T, -90], [2 + T, -95], [28 + T, -90], [50 + T, -76], [64 + T, -50], [67 + T, -20], [60 + T, 10], [40, -30], [-40, -30]]), true, 0.45), h.ink);
    const ring = [];
    for (let i = 0; i < 15; i++) {
      const a = Math.PI * (0.93 + (i / 14) * 1.14);
      const rr = 1 + hs(3, i) * 0.05;
      ring.push([Math.cos(a) * 62 * rr + T, -38 + Math.sin(a) * 55 * rr, i % 3 === 1 ? 0.8 : 1]);
    }
    ring.push([-62 + T, 2, 0.85], [63 + T, 2, 0.85], [-58 + T, 12, 0.6], [59 + T, 12, 0.6]);
    curlBumps(P, ring, h.ink, 12.5, 11, g.bf, g);
  } else if (st === 'swept') {
    P.fill(curve(j([[-47 + T, 4], [-51 + T, -26], [-48 + T, -54], [-36 + T, -78], [-14 + T, -96], [10 + T, -103], [32 + T, -98], [48 + T, -82], [54 + T, -56], [52 + T, -26], [47 + T, 4], [30, -20], [-30, -20]]), true, 0.45), h.ink);
  } else if (st === 'wavy') {
    P.fill(curve(j([[-47 + T, 2], [-52 + T, -28], [-48 + T, -58], [-32 + T, -82], [-6 + T, -95], [22 + T, -96], [44 + T, -84], [55 + T, -60], [56 + T, -30], [50 + T, 2], [30, -20], [-30, -20]]), true, 0.45), h.ink);
  } else if (st === 'long') {
    const sw = g.dx * 1.6, lift = g.dy;
    P.fill(curve(j([[-50 + T, -30], [-46 + T, -66], [-24 + T, -86], [2 + T, -90], [26 + T, -86], [47 + T, -66], [51 + T, -30], [57, 40], [62 + sw * 0.5, 118], [68 + sw, 182 + lift], [34 + sw, 196 + lift], [-30 + sw, 196 + lift], [-66 + sw, 182 + lift], [-60 + sw * 0.5, 118], [-57, 40]]), true, 0.45), h.ink);
    P.fill(curve([[-40 + sw * 0.6, 120], [0 + sw, 150], [40 + sw * 0.6, 120], [30 + sw, 186 + lift], [-30 + sw, 186 + lift]], true, 0.5), deepen(h.ink, 0.12));
  }
}

function hairFront(P, spec, g) {
  const h = spec.hair, st = h.style, j = (pts, a = 1.2) => boil(pts, a, g.bf);
  const T = g.turn * 5, fdy = g.pitch * -5;
  if (st === 'curly') {
    // fringe of tight curls; one clump falls over the forehead
    P.fill(curve(j([[-58 + T, -36], [-54 + T, -64], [-26 + T, -82], [14 + T, -82], [48 + T, -68], [60 + T, -38], [50 + T, -40 + fdy], [30 + T, -44 + fdy], [8 + T, -38 + fdy], [-16 + T, -42 + fdy], [-40 + T, -40 + fdy]]), true, 0.45), h.ink);
    const fr = [[-50, -40], [-37, -37], [-24, -38], [-11, -33], [2, -35], [15, -37], [28, -40], [41, -41], [53, -40]].map(([x, y], i) => [x + T, y + fdy + hs(7, i) * 2, 0.85]);
    fr.push([-6 + T, -26 + fdy, 0.72], [8 + T, -27 + fdy, 0.6]);
    curlBumps(P, fr, h.ink, 10, 21, g.bf, { dx: g.dx * 0.6, dy: g.dy * 0.8 });
    // curl texture: little C hooks in the shadow tone, highlights up top-left
    const hooks = [[-40, -60, 0.2], [-18, -72, 1.4], [8, -78, 0.6], [32, -70, 2.1], [52, -52, 1], [-52, -20, 2.6], [56, -18, 0.3], [-30, -48, 1.8], [18, -52, 3], [-4, -88, 2.2], [42, -88, 0.9], [-44, -82, 2.8]];
    hooks.forEach(([x, y, a], i) => P.stroke(arc(x + T + g.dx * 0.5, y + (y > -60 ? fdy : 0) + g.dy * 0.5, 5.2, a, a + 3.6), h.shade, 2.6));
    [[-32, -80, 3.6], [-12, -88, 4], [-46, -66, 3.4], [12, -86, 4.2]].forEach(([x, y, a]) => P.stroke(arc(x + T + g.dx * 0.5, y + g.dy * 0.5, 4.5, a, a + 2.2), h.hi, 2.4));
  } else if (st === 'swept') {
    // swept up and back off the forehead; the hairline shows
    P.fill(curve(j([[-47 + T, -28], [-44 + T, -50], [-30 + T, -60 + fdy], [-10 + T, -57 + fdy], [12 + T, -62 + fdy], [34 + T, -58 + fdy], [46 + T, -48], [48 + T, -28], [53 + T, -60], [44 + T, -88], [22 + T, -104], [-2 + T, -107], [-24 + T, -99], [-40 + T, -82], [-49 + T, -58]]), true, 0.4), h.ink);
    for (const [x0, dx] of [[-28, 10], [-10, 12], [8, 14], [26, 12], [-38, 6]]) {
      P.stroke(curve([[x0 + T, -60 + fdy], [x0 + dx * 0.6 + T, -82], [x0 + dx * 1.6 + T, -98 + g.dy * 0.4]], false), h.shade, 2.6);
    }
    P.stroke(curve([[-20 + T, -64], [-8 + T, -88], [10 + T, -100]], false), h.hi, 3);
  } else if (st === 'wavy') {
    // short auburn waves pushed across the forehead
    const d = g.dx * 0.7, e = g.dy * 0.6;
    P.fill(curve(j([[-49 + T, -30], [-42 + T, -46 + fdy], [-30 + T, -50 + fdy], [-19 + T + d, -41 + fdy + e], [-6 + T, -51 + fdy], [8 + T, -53 + fdy], [20 + T + d, -45 + fdy + e], [33 + T, -55 + fdy], [45 + T, -52], [51 + T, -32], [56 + T, -62], [42 + T, -88], [16 + T, -100], [-12 + T, -98], [-36 + T, -86], [-51 + T, -60]]), true, 0.45), h.ink);
    for (const [x, y, s] of [[-30, -70, 1], [-4, -78, -1], [22, -76, 1], [-40, -56, -1], [38, -64, -1]]) {
      P.stroke(curve([[x - 12 + T, y + 6], [x - 4 + T, y - 3 * s], [x + 4 + T, y + 3 * s], [x + 12 + T, y - 6]], false), h.shade, 2.6);
    }
    P.stroke(curve([[-26 + T, -86], [-6 + T, -92], [14 + T, -90]], false), h.hi, 3);
  } else if (st === 'long') {
    // centre part; straight curtains down past the shoulders (screen-left side tucked behind the ear)
    const sw = g.dx, lift = g.dy * 0.5;
    P.fill(curve(j([[-2 + T, -86], [-28 + T, -80], [-46 + T, -60], [-52 + T, -24], [-49, 6], [-44, -18], [-38 + T, -44], [-24 + T, -62], [-6 + T, -70]]), true, 0.45), h.ink);
    P.fill(curve(j([[2 + T, -86], [30 + T, -80], [48 + T, -60], [54 + T, -20], [55, 40], [60 + sw * 0.5, 100], [64 + sw, 150 + lift], [48 + sw, 156 + lift], [44 + sw * 0.4, 100], [42, 40], [40 + T, -18], [34 + T, -46], [22 + T, -64], [6 + T, -70]]), true, 0.45), h.ink);
    P.stroke(line([[T, -88], [T, -68]]), skinOf(spec), 2.5);
    for (const [pts, w] of [[[[20, -76], [42, -54], [48, 20], [54, 110]], 2], [[[-20, -76], [-40, -52], [-47, -20]], 2], [[[34, -70], [46, -30], [50, 60]], 1.6]]) {
      P.stroke(curve(pts.map(([x, y]) => [x + T + (y > 40 ? sw * 0.5 : 0), y]), false), h.hi, w);
    }
  }
}

// ---------------------------------------------------------------- the head
// head(P, spec, x, y, s, o): face centre at (x, y).
// o (all optional): bf, look [x,y], blink, smile, happy, tilt, skipBack (legacy)
//   mouth: number (legacy open) or {open, wide, round}; viseme: {open, wide, round}
//   expr: 'neutral'|'smile'|'grin'|'focused'|'feel'|'shout'|'belt'|'cool'|'surprised' or {name: weight}
//   brow: {angle, raise} (or browAngle, browRaise), lid, belt 0..1 (head up, brows up, eyes shut)
//   turn -1..1 (yaw, + = toward screen right), pitch -1..1 (+ = chin up)
//   hair: {dx, dy} secondary offset (px, head units); skipFront (draw hair front yourself)
export function head(P, spec, x, y, s, o = {}) {
  const bf = o.bf ?? 0;
  const F = faceState(spec, o);
  const f = spec.face || BAND.noah.face;
  const skin = skinOf(spec), shade = shadeOf(spec);
  const look = o.look || [0, 0];
  const turn = F.turn, pitch = F.pitch;
  const hairG = { bf, dx: num(o.hair?.dx), dy: num(o.hair?.dy), turn, pitch };
  P.save();
  P.translate(x, y);
  P.rotate(num(o.tilt) - turn * 0.02);
  P.scale(s);
  const j = (pts, a = 1) => boil(pts, a, bf);
  // feature placement under yaw/pitch
  const fx = (xx, depth = 1) => xx * (1 - Math.abs(turn) * 0.14) + turn * 13 * depth;
  const fy = (yy, depth = 1) => yy - pitch * 9 * depth;
  if (!o.skipBack) hairBack(P, spec, hairG);
  // ears (behind the face): they slide against the turn
  for (const sd of [-1, 1]) {
    const ex = sd * (f.w - 3) - turn * 12, ey = f.earY + pitch * 5;
    if (sd * turn > 0.55) continue;
    P.fill(ellipse(ex + sd * 5, ey, 9.5, f.earH), skin);
    P.stroke(curve([[ex + sd * 3, ey - f.earH * 0.55], [ex + sd * 9, ey - f.earH * 0.2], [ex + sd * 7, ey + f.earH * 0.5]], false), shade, 2.4);
    if (spec.earrings && sd < 0) P.stroke(circle(ex + sd * 6, ey + f.earH + 3, 4.2), INK.gold, 2.2);
  }
  // face outline: broad cheeks and a squarer jaw for the guys; jaw drops as the mouth opens
  const jd = F.open * 9, chinUp = Math.abs(pitch) * 6;
  const w = f.w, jaw = f.jaw, ch = f.cheek ?? w;
  const oxf = (xx) => xx * (1 - Math.abs(turn) * 0.08) + turn * 4;
  const outline = [
    [-w * 0.9, f.top + 24], [-w, -6], [-ch, 16], [-jaw, f.jawY - 8], [-(jaw - (f.female ? 10 : 6)), f.jawY + (f.female ? 10 : 7) + jd * 0.6],
    [-f.chinW - 3, f.chinY - 4 + jd - chinUp], [0, f.chinY + jd - chinUp], [f.chinW + 3, f.chinY - 4 + jd - chinUp],
    [jaw - (f.female ? 10 : 6), f.jawY + (f.female ? 10 : 7) + jd * 0.6], [jaw, f.jawY - 8], [ch, 16], [w, -6], [w * 0.9, f.top + 24],
    [w * 0.55, f.top + 3], [0, f.top], [-w * 0.55, f.top + 3],
  ].map(([xx, yy]) => [oxf(xx), yy]);
  const facePath = curve(j(outline), true, f.female ? 0.5 : 0.42);
  P.fill(facePath, skin);
  P.save();
  P.clip(facePath);
  // form shadow on the far side of the light (light from upper left) + shadow under the hair
  P.fill(ellipse(oxf(w * 1.28) + turn * 8, 26, w * 0.52, 96, 0.1), spec.skinShade || [0.14, 0.13, 0.04], 'lighter');
  P.fill(ellipse(oxf(0), f.top - 12 + pitch * -6, w * 1.3, 30), spec.skinShade || [0.14, 0.13, 0.04], 'lighter');
  // stubble/jaw shadow: a blue-grey halftone over the lower face
  if (f.stubble > 0) {
    const sd = f.stubble;
    const mY = fy(f.mouthY, 1.1);
    P.fill(curve([
      [-ch - 6, 4], [-w * 0.72, 26], [fx(-f.mouthW * 1.35), mY - 12], [fx(0, 1.2), fy(f.noseY + 8, 1.2)], [fx(f.mouthW * 1.35), mY - 12], [w * 0.72, 26], [ch + 6, 4],
      [jaw + 8, f.jawY + 26], [0, f.chinY + 16 + jd], [-jaw - 8, f.jawY + 26],
    ], true, 0.4), [0.03 * sd, 0.07 * sd, 0.14 * sd], 'lighter');
  }
  if (f.cheekTone) for (const sd of [-1, 1]) P.glow(fx(sd * (f.eyeX + 8)), fy(f.eyeY + 20), 17, f.cheekTone, 'lighter', 0.2);
  P.restore();
  // sideburns
  if (f.sideburns > 0) {
    for (const sd of [-1, 1]) {
      const sx = oxf(sd * (w - 1));
      const len = 14 + f.sideburns * 16;
      P.fill(poly(j([[sx, -26], [sx - sd * (6 + f.sideburns * 3), -26], [sx - sd * (5 + f.sideburns * 2), -26 + len], [sx - sd * 1, -22 + len + 3]])), spec.hair.ink);
    }
  }
  // eyes + brows
  const ex = f.eyeX, eyY = fy(f.eyeY);
  const lookE = [clamp(look[0] + turn * 0.4, -1.2, 1.2), look[1]];
  for (const sd of [-1, 1]) {
    const sq = F.squint, cx = fx(sd * ex) - (sd * turn > 0 ? sd * turn * 3 : 0);
    const size = f.eyeR * (sd * turn > 0 ? 1 - turn * sd * 0.2 : 1);
    eye(P, cx, eyY, sd, { r: size, look: lookE, blink: F.blink, squint: sq, lid: F.lid, closed: F.closed, skin, lash: f.lash, lidW: f.female ? 2.4 : 3, lidInk: f.female ? INK.eye : INK.line });
    brow(P, cx, fy(f.browY), sd, { len: f.browLen * (sd * turn > 0 ? 1 - turn * sd * 0.25 : 1), thick: f.browT, raise: F.browRaise, angle: F.browAngle, arch: f.browArch, ink: deepen(spec.hair.ink, 0.12) });
  }
  if (spec.glasses) {
    const gi = [0.06, 0.2, 0.32];
    for (const sd of [-1, 1]) {
      const cx = fx(sd * ex), gw = 29 * (sd * turn > 0 ? 1 - turn * sd * 0.25 : 1);
      P.stroke(roundRect(cx - gw / 2, eyY - 10, gw, 20, 6), gi, 2.8);
      P.stroke(line([[cx - gw * 0.3, eyY + 6], [cx - gw * 0.05, eyY - 6]]), K.paper, 1.8);
    }
    P.stroke(curve([[fx(-ex + 14.5), eyY - 3], [fx(0), eyY - 5], [fx(ex - 14.5), eyY - 3]], false), gi, 2.6);
    for (const sd of [-1, 1]) if (sd * turn < 0.5) P.stroke(line([[fx(sd * (ex + 14.5)), eyY - 5], [oxf(sd * (w + 2)), eyY - 7]]), gi, 2.4);
  }
  // nose: bridge shade + nostril base, broader for Noah
  const nY = fy(f.noseY, 1.2), nx = fx(0, 1.5), nw = f.noseW;
  if (f.female) {
    P.stroke(curve([[nx - 3, nY - 1], [nx + 1, nY + 3], [nx + 5, nY]], false), shade, 2.4);
  } else {
    P.stroke(curve([[fx(4, 1.2), fy(-2)], [fx(5, 1.3), fy(12, 1.1)], [nx + 3, nY - 5]], false), shade, 2.4);
    P.fill(ellipse(nx + 2, nY + 3, nw * 0.75, 4), spec.skinShade || [0.14, 0.13, 0.04], 'lighter');
    P.stroke(curve([[nx - nw, nY - 1], [nx - nw * 0.55, nY + 4], [nx, nY + 2], [nx + nw * 0.55, nY + 4], [nx + nw, nY - 1]], false), shade, 2.6);
  }
  // mouth
  const mY = fy(f.mouthY, 1.1) + F.open * 3;
  mouth(P, fx(0, 1.1), mY, f.mouthW, { open: F.open, wide: F.wide, round: F.round, smile: F.smile, grin: F.grin, teeth: 0.9 }, {
    line: f.female ? [0.22, 0.75, 0.5] : INK.line, lw: f.female ? 2.8 : 3.4, lip: f.lip && F.open < 0.1 ? f.lip : null, edge: f.female ? [0.25, 0.8, 0.55] : INK.line,
  });
  // chin crease for the guys (only when the mouth is closed)
  if (!f.female && F.open < 0.2 && F.grin < 0.3) P.stroke(curve([[fx(-6), fy(f.mouthY + 13)], [fx(0), fy(f.mouthY + 15)], [fx(6), fy(f.mouthY + 13)]], false), shade, 2);
  if (!o.skipFront) hairFront(P, spec, hairG);
  if (spec.earrings) for (const sd of [1]) if (sd * turn < 0.55) P.fill(circle(oxf(sd * (w + 3)) - turn * 12, f.earY + f.earH + 2, 3.2), INK.gold);
  P.restore();
}

// ---------------------------------------------------------------- clothes
// sk: skeleton { sh: [L, R] shoulders, hip: [L, R], neck, waistY, hipY, lean, flap, chain }
function torso(P, spec, sk, bf) {
  const t = spec.top, b = spec.build;
  const j = (pts, a = 1.1) => boil(pts, a, bf);
  const [L, R] = sk.sh;
  const nx = sk.neck[0], ny = sk.neck[1];
  const nw = b.neck * 0.5;
  const wy = sk.waistY, hy = sk.hipY + 16;
  const cx = (L[0] + R[0]) / 2;
  const outline = j([
    [L[0] - 4, L[1] - 2], [lerp(L[0], nx, 0.55), ny + 2], [nx - nw, ny - 2], [nx + nw, ny - 2], [lerp(R[0], nx, 0.55), ny + 2], [R[0] + 4, R[1] - 2],
    [R[0] - 2, R[1] + 56], [cx + b.waist, wy], [cx * 0.3 + b.hip, hy], [cx * 0.3 - b.hip, hy], [cx - b.waist, wy], [L[0] + 2, L[1] + 56],
  ]);
  const body = curve(outline, true, 0.32);
  const inner = t.kind === 'openShirt' ? t.inner : t.ink;
  P.fill(body, inner);
  // neckline
  if (t.kind === 'lace') {
    P.fill(curve([[nx - nw - 14, ny - 2], [nx, ny + 34], [nx + nw + 14, ny - 2], [nx, ny - 6]], true, 0.5), skinOf(spec));
  } else {
    P.fill(ellipse(nx, ny - 1, nw + 3, 11), skinOf(spec));
    P.stroke(curve([[nx - nw - 4, ny - 2], [nx, ny + 12], [nx + nw + 4, ny - 2]], false), deepen(inner, 0.15), 4);
  }
  P.save();
  P.clip(body);
  // side shadow (light from upper left)
  P.fill(ellipse(R[0] + 26, (ny + hy) / 2, 44, (hy - ny) * 0.75), [0.06, 0.12, 0.14], 'lighter');
  if (t.print === 'text') {
    // Noah's black tee: white band + BARR
    const px = cx + 2, py = ny + 70;
    P.fill(rect(px - 42, py - 30, 84, 6), K.paper);
    P.text('BARR', px, py + 4, '30px Anton', K.paper, { spacing: 3 });
  } else if (t.print === 'portrait') {
    // Brooks' vintage portrait print: a crooner in a suit, grey halftone on black, a red sun behind
    const px = cx - 4, py = ny + 92;
    P.fill(circle(px - 16, py - 34, 26), [0.55, 0.85, 0.35]);
    P.fill(curve([[px - 36, py + 60], [px - 30, py + 6], [px - 12, py - 6], [px + 12, py - 6], [px + 30, py + 6], [px + 36, py + 60]], true, 0.3), [0.06, 0.08, 0.2]);
    P.fill(poly([[px - 8, py - 6], [px + 8, py - 6], [px + 2, py + 34], [px - 2, py + 34]]), [0.3, 1, 1]);
    P.fill(poly([[px - 5, py - 4], [px + 5, py - 4], [px, py + 4]]), K.paper);
    P.fill(ellipse(px, py - 30, 15, 19), [0.05, 0.06, 0.14]);
    P.fill(curve([[px - 16, py - 36], [px - 12, py - 54], [px + 6, py - 56], [px + 17, py - 40], [px + 8, py - 46], [px - 6, py - 44]], true, 0.4), [0.3, 1, 1]);
    P.stroke(curve([[px - 7, py - 20], [px, py - 16], [px + 7, py - 20]], false), [0.3, 1, 1], 2);
  } else if (t.kind === 'lace') {
    // lace: rows of little scallops and eyelets
    for (let r = 0; r < 9; r++) for (let c = -5; c <= 5; c++) {
      const px = cx + c * 15 + (r % 2) * 7.5, py = ny + 30 + r * 21;
      if (py > hy - 4) continue;
      P.stroke(circle(px, py, 4.2), [0, 0.06, 0.1], 1.4, 'lighter');
      P.fill(circle(px, py + 9, 1.6), K.paper);
    }
    P.stroke(curve([[cx - b.waist, wy - 6], [cx, wy + 4], [cx + b.waist, wy - 6]], false), [0.05, 0.12, 0.2], 3, 'lighter');
  }
  P.restore();
  if (t.kind === 'openShirt') {
    // open button shirt: two fronts that hang (and flap) off the shoulders; camp collar
    const flap = sk.flap || 0;
    for (const sd of [-1, 1]) {
      const S = sd < 0 ? L : R;
      const hemIn = [cx + sd * (b.waist * 0.32) + flap * (sd < 0 ? 10 : 14), hy + 6 - Math.abs(flap) * 4];
      const hemOut = [cx * 0.3 + sd * (b.hip + 8) + flap * 4, hy + 8];
      const front = j([
        [S[0] + sd * 5, S[1] - 1], [lerp(S[0], nx, 0.6), ny + 2], [nx + sd * (nw + 2), ny + 4],
        [nx + sd * (nw * 0.7 + 4), ny + 40], [lerp(nx + sd * nw * 0.7, hemIn[0], 0.5) + flap * 3, lerp(ny + 40, hemIn[1], 0.5)], hemIn, hemOut,
        [cx + sd * (b.waist + 5), wy], [S[0] + sd * 1, S[1] + 60],
      ]);
      P.fill(curve(front, true, 0.3), t.ink);
      // placket fold + a crease
      P.stroke(curve([[nx + sd * (nw * 0.7 + 6), ny + 40], [lerp(nx + sd * nw * 0.7, hemIn[0], 0.5) + sd * 5 + flap * 3, lerp(ny + 40, hemIn[1], 0.5)], [hemIn[0] + sd * 6, hemIn[1] - 4]], false), deepen(t.ink, 0.12), 3);
      P.stroke(curve([[S[0] + sd * -8, S[1] + 70], [S[0] + sd * -2, S[1] + 120], [cx + sd * (b.waist - 6), wy + 10]], false), deepen(t.ink, 0.08), 2.4);
      // collar
      P.fill(poly(j([[nx + sd * (nw - 2), ny - 8], [nx + sd * (nw + 26), ny - 2], [nx + sd * (nw + 14), ny + 36], [nx + sd * (nw * 0.7 + 3), ny + 22]])), mix(t.ink, K.paper, 0.35));
      P.stroke(poly([[nx + sd * (nw - 2), ny - 8], [nx + sd * (nw + 26), ny - 2], [nx + sd * (nw + 14), ny + 36], [nx + sd * (nw * 0.7 + 3), ny + 22]]), deepen(t.ink, 0.15), 2);
      if (sd > 0) {
        // chest pocket
        P.stroke(roundRect(nx + sd * (nw + 16), ny + 58, 26 * sd, 28, 3), deepen(t.ink, 0.1), 2.2);
      } else {
        for (let i = 0; i < 4; i++) P.fill(circle(lerp(nx - nw * 0.7 - 7, hemIn[0] - 6, i / 4 + 0.1), lerp(ny + 40, hemIn[1], i / 4 + 0.1), 2.4), deepen(t.ink, 0.2));
      }
    }
  } else if (t.kind === 'tee') {
    P.stroke(curve([[L[0] + 10, L[1] + 70], [L[0] + 16, L[1] + 130]], false), deepen(t.ink, 0.1), 3);
  }
  if (spec.chain) {
    // thin silver chain; swings with the torso's drag
    const cs = sk.chain || 0;
    const cy0 = ny + 3;
    P.stroke(curve([[nx - nw + 4, cy0], [nx - 12 + cs * 5, cy0 + 26], [nx + cs * 8, cy0 + 33], [nx + 12 + cs * 5, cy0 + 26], [nx + nw - 4, cy0]], false), [0.12, 0.14, 0.26], 3.4);
    P.stroke(curve([[nx - nw + 5, cy0 - 1], [nx - 12 + cs * 5, cy0 + 25], [nx + cs * 8, cy0 + 31.5]], false), K.paper, 1.4);
  }
}

// ---------------------------------------------------------------- arms
function armDims(spec) {
  const b = spec.build || {};
  const k = b.arm || 1, w = b.armW || 1;
  return { l1: 98 * k, l2: 92 * k, w1: 36 * w, w2: 31 * w, w3: 27 * w, hr: 14 * Math.sqrt(w) * (b.female ? 0.92 : 1.05) };
}

// pick the IK elbow nearest a preferred direction from the shoulder
function elbowFor(sh, hd, l1, l2, prefer) {
  const a = ik(sh[0], sh[1], hd[0], hd[1], l1, l2, 1), b = ik(sh[0], sh[1], hd[0], hd[1], l1, l2, -1);
  const sc = (e) => (e[0] - sh[0]) * prefer[0] + (e[1] - sh[1]) * prefer[1];
  return sc(a) >= sc(b) ? a : b;
}

// upper arm + forearm (no hand); sleeves per top kind. Returns the elbow.
function drawArm(P, spec, sh, hd, prefer, { fore = 1 } = {}) {
  const d = armDims(spec);
  const reach = Math.hypot(hd[0] - sh[0], hd[1] - sh[1]);
  const f = clamp((reach - 30) / (d.l1 + d.l2 - 30), 0.35, 1);
  const l1 = d.l1 * lerp(0.82, 1, f), l2 = d.l2 * lerp(0.62, 1, f) * fore;
  const el = elbowFor(sh, hd, l1, l2, prefer);
  const skin = skinOf(spec), t = spec.top;
  P.fill(capsule(sh[0], sh[1], el[0], el[1], d.w1, d.w2), skin);
  P.fill(capsule(el[0], el[1], hd[0], hd[1], d.w2 * 0.98, d.w3), skin);
  // forearm shadow line
  P.stroke(line([[lerp(el[0], hd[0], 0.2), lerp(el[1], hd[1], 0.2) + 3], [lerp(el[0], hd[0], 0.75), lerp(el[1], hd[1], 0.75) + 3]]), shadeOf(spec), 2);
  const sleeveInk = t.kind === 'openShirt' ? t.ink : t.ink;
  if (t.kind === 'openShirt' && t.long) {
    // long sleeves rolled to the forearm
    const r = [lerp(el[0], hd[0], 0.45), lerp(el[1], hd[1], 0.45)];
    P.fill(capsule(sh[0], sh[1], el[0], el[1], d.w1 + 8, d.w2 + 6), sleeveInk);
    P.fill(capsule(el[0], el[1], r[0], r[1], d.w2 + 6, d.w2 + 8), sleeveInk);
    P.fill(capsule(lerp(el[0], hd[0], 0.36), lerp(el[1], hd[1], 0.36), r[0], r[1], d.w2 + 10, d.w2 + 10), mix(sleeveInk, K.paper, 0.3));
  } else {
    const k = t.kind === 'openShirt' ? 0.72 : t.kind === 'lace' ? 0.45 : 0.55;
    const e = [lerp(sh[0], el[0], k), lerp(sh[1], el[1], k)];
    const wide = t.kind === 'openShirt' ? 16 : t.kind === 'lace' ? 8 : 10;
    P.fill(capsule(sh[0], sh[1], e[0], e[1], d.w1 + wide - 4, d.w1 + wide), sleeveInk);
    P.stroke(line([[lerp(sh[0], e[0], 0.35), lerp(sh[1], e[1], 0.35) + 6], [e[0], e[1] + 4]]), deepen(sleeveInk, 0.1), 2);
  }
  return el;
}

// ---------------------------------------------------------------- instruments
// local frame: origin at the strum point, +x along the neck toward the headstock
const INST = {
  acoustic: { neck0: 72, neckLen: 262, nw: 20, strings: 6 },
  electric: { neck0: 64, neckLen: 262, nw: 19, strings: 6 },
  bass: { neck0: 70, neckLen: 360, nw: 22, strings: 4 },
};

function instrument(P, kind, x, y, rot, s, { bf = 0 } = {}) {
  const I = INST[kind];
  P.save();
  P.translate(x, y);
  P.rotate(rot);
  P.scale(s);
  const j = (pts) => boil(pts, 1, bf);
  const n0 = I.neck0, n1 = I.neck0 + I.neckLen, nw = I.nw;
  // neck + fretboard + headstock
  P.fill(poly([[n0 - 10, -nw * 0.55], [n1, -nw * 0.5], [n1, nw * 0.5], [n0 - 10, nw * 0.55]]), [0.55, 0.5, 0.18]);
  P.fill(poly([[n0, -nw * 0.44], [n1, -nw * 0.4], [n1, nw * 0.4], [n0, nw * 0.44]]), kind === 'acoustic' ? [0.5, 0.75, 0.5] : [0.45, 0.62, 0.35]);
  for (let i = 1; i < 14; i++) {
    const fx = n1 - I.neckLen * (1 - Math.pow(0.944, i)) * 1.05;
    if (fx < n0 + 6) break;
    P.stroke(line([[fx, -nw * 0.42], [fx, nw * 0.42]]), [0.1, 0.12, 0.2], 1.4);
    if ([3, 5, 7, 9].includes(i)) P.fill(circle(fx + 6, 0, 2.4), K.paper);
  }
  const hs0 = n1 + 4;
  if (kind === 'acoustic') {
    P.fill(roundRect(hs0, -15, 64, 30, 7), [0.5, 0.7, 0.4]);
    for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) P.fill(circle(hs0 + 14 + i * 18, sd * 19, 4.5), [0.2, 0.25, 0.4]);
  } else if (kind === 'electric') {
    P.fill(curve([[hs0, -10], [hs0 + 30, -20], [hs0 + 74, -22], [hs0 + 78, -10], [hs0 + 50, 4], [hs0 + 20, 10], [hs0, 10]], true, 0.4), [0.55, 0.5, 0.18]);
    for (let i = 0; i < 6; i++) P.fill(circle(hs0 + 18 + i * 10, -24, 3.6), [0.15, 0.25, 0.4]);
  } else {
    P.fill(curve([[hs0, -12], [hs0 + 40, -22], [hs0 + 90, -26], [hs0 + 96, -12], [hs0 + 60, 2], [hs0 + 20, 12], [hs0, 12]], true, 0.4), K.ink);
    for (let i = 0; i < 4; i++) P.fill(circle(hs0 + 22 + i * 18, -28, 5.5), [0.15, 0.25, 0.4]);
  }
  // body
  if (kind === 'acoustic') {
    const body = curve(j([[-196, 0], [-186, -64], [-150, -98], [-100, -106], [-52, -92], [-22, -74], [10, -80], [48, -74], [70, -44], [76, 0], [70, 44], [48, 74], [10, 80], [-22, 74], [-52, 92], [-100, 106], [-150, 98], [-186, 64]]), true, 0.5);
    P.fill(body, [0.62, 0.62, 0.15]);
    P.fill(curve([[-186, 0], [-176, -58], [-146, -88], [-100, -96], [-54, -83], [-24, -65], [10, -71], [44, -65], [62, -40], [67, 0], [62, 40], [44, 65], [10, 71], [-24, 65], [-54, 83], [-100, 96], [-146, 88], [-176, 58]], true, 0.5), [0.75, 0.36, 0.04]);
    P.save();
    P.clip(body);
    P.fill(ellipse(-60, 70, 170, 60, -0.1), [0.12, 0.14, 0.02], 'lighter');
    P.restore();
    P.fill(curve([[-2, 26], [30, 30], [44, 52], [20, 62], [-10, 50]], true, 0.5), [0.5, 0.75, 0.4]);
    P.fill(circle(18, 0, 30), [0.35, 1, 0.95]);
    P.stroke(circle(18, 0, 35), [0.5, 0.75, 0.4], 3.5);
    P.fill(roundRect(-128, -30, 22, 60, 5), [0.45, 0.8, 0.5]);
    P.fill(rect(-120, -24, 5, 48), K.paper);
  } else {
    const bass = kind === 'bass';
    const bodyInk = bass ? [0, 0.5, 1] : [0.95, 0.95, 0.05];
    const k = bass ? 1.12 : 1;
    const pts = [[-150, 5], [-142, -48], [-110, -70], [-62, -64], [-22, -46], [22, -52], [62, -80], [88, -78], [80, -52], [60, -26], [60, 26], [70, 58], [50, 70], [16, 54], [-24, 64], [-80, 78], [-130, 60]].map(([a, b]) => [a * k, b * k]);
    const body = curve(j(pts), true, 0.5);
    P.fill(body, bodyInk);
    P.save();
    P.clip(body);
    P.fill(ellipse(-50, 80, 150, 50, -0.1), bass ? [0.2, 0.35, 0.1] : [0.05, 0.2, 0.35], 'lighter');
    P.restore();
    P.stroke(body, deepen(bodyInk, 0.2), 2.5);
    P.fill(curve([[-100 * k, 34], [-66 * k, -42], [0, -34], [46 * k, -26], [48 * k, 34], [12 * k, 52], [-60 * k, 58]], true, 0.4), K.paper);
    if (bass) {
      P.fill(roundRect(-8, -26, 18, 26, 4), K.ink);
      P.fill(roundRect(-26, 0, 18, 26, 4), K.ink);
      P.fill(roundRect(-96, -18, 16, 36, 3), [0.3, 0.4, 0.5]);
    } else {
      P.fill(roundRect(-12, -24, 15, 48, 4), K.ink);
      P.fill(roundRect(16, -24, 15, 48, 4), K.ink);
      P.fill(roundRect(-86, -18, 14, 36, 3), [0.3, 0.4, 0.5]);
    }
    for (const [kx, ky] of [[-92, 42], [-70, 50]]) P.fill(circle(kx * k, ky * k, 7), K.ink);
  }
  // strings
  const ns = I.strings, sp = (nw * 0.7) / (ns - 1);
  const bridgeX = kind === 'acoustic' ? -116 : kind === 'bass' ? -88 : -78;
  for (let i = 0; i < ns; i++) {
    const oy = -nw * 0.35 + i * sp;
    P.stroke(line([[bridgeX, oy * 1.35], [n0, oy * 1.05], [n1 + 2, oy]]), K.paper, kind === 'bass' ? 1.5 : 1);
  }
  P.restore();
  return I;
}

// fret hand on the neck: palm under the neck, fingers pressing on the fretboard, thumb peeking over
function fretHand(P, spec, x, y, rot, { lift = 0, chord = 0, s = 1 } = {}) {
  const skin = skinOf(spec), shade = shadeOf(spec), r = armDims(spec).hr * s;
  P.save();
  P.translate(x, y);
  P.rotate(rot);
  P.fill(ellipse(-4, r * 1.25 + lift * 4, r * 1.05, r * 0.95), skin);
  P.fill(capsule(r * 0.2, -r * 0.9 - lift * 3, r * 0.7, -r * 1.35 - lift * 3, r * 0.62, r * 0.5), skin);
  for (let i = 0; i < 4; i++) {
    const fx = -r * 1.1 + i * r * 0.72, press = ((chord * 7 + i * 3) % 5) / 5;
    const tipY = -r * 0.35 + press * r * 0.55 - lift * 6;
    P.fill(capsule(fx - 2, r * 0.9, fx + r * 0.1, tipY, r * 0.5, r * 0.42), skin);
    P.stroke(line([[fx - 2, r * 0.75], [fx - 1, r * 0.35]]), shade, 1.4);
  }
  P.restore();
}

// ---------------------------------------------------------------- standing players
// player(P, spec, x, floor, s, pose): feet at (x, floor), facing the audience, instrument across the body.
// pose (all optional, plain numbers unless noted):
//   bounce|bob 0..1 groove bounce, dip 0..1 knee dip, jump 0..1 (Brooks), lean -1..1, bang|nod 0..1 head-bang
//   strum 0..1 legacy phase; or strumDir +1 down / -1 up with strumSince (s since that stroke crossed the
//     strings), strumUntil (s to the next stroke), strumVel 0..1; or strumP -1..1 (hand across the strings)
//   fret 0..1 along the neck, fretSlide 0..1 (fingers lift mid-slide), chord (int, finger shape)
//   pluck 0..1 bass pluck pulse, pluckString 0..3
//   face: look [x,y], blink, expr, brow {angle, raise}, mouth (number or {open,wide,round}), viseme, belt,
//     turn, pitch, tilt
//   bf boil frame; micAt [x,y] (mic stand, player units); lag: the same pose a few frames earlier
function skel(spec, pose) {
  const b = spec.build, Hs = b.height || 1;
  const bounce = num(pose.bounce, num(pose.bob)), dip = num(pose.dip), jump = num(pose.jump);
  const lean = num(pose.lean), bang = Math.max(num(pose.bang), num(pose.nod) * 0.6);
  const lift = jump * 95;
  const drop = bounce * 12 + dip * 34;
  const hipY = -236 * Hs + drop - lift;
  const shY = -448 * Hs + drop * 1.08 - lift + bang * 5;
  const lx = lean * 14;
  return { bounce, dip, jump, lean, bang, lift, hipY, shY, lx, headY: shY - 78 * Hs + bang * 14, headX: lx * 1.25 + bang * 2 };
}

export function player(P, spec, x, floor, s, pose = {}) {
  const bf = pose.bf ?? 0;
  const b = spec.build || BAND.brooks.build, Hs = b.height || 1;
  const k = skel(spec, pose);
  const kl = pose.lag ? skel(spec, pose.lag) : null;
  // secondary drags (how far the followers trail)
  const hairDY = kl ? clamp(drag(k.headY, kl.headY, 0.55), -14, 14) : -k.bang * 3;
  const hairDX = kl ? clamp(drag(k.headX, kl.headX, 0.6), -12, 12) : 0;
  const bodyDY = kl ? clamp(drag(k.shY, kl.shY, 0.5), -10, 10) : 0;
  const flap = kl ? clamp(drag(k.lx, kl.lx, 0.08) + drag(k.shY, kl.shY, 0.04), -1.5, 1.5) : k.lean * 0.3;
  P.save();
  P.translate(x, floor);
  P.scale(s);
  const { hipY, shY, lx } = k;
  const hx = k.headX, hy = k.headY;
  const turn = num(pose.turn), pitchBang = -k.bang * 0.55;
  // long hair falls behind the body
  if (spec.hair.style === 'long') {
    P.save();
    P.translate(hx, hy);
    P.rotate(num(pose.tilt, lean2tilt(k)));
    hairBack(P, spec, { bf, dx: hairDX, dy: hairDY, turn, pitch: pitchBang });
    P.restore();
  }
  // legs: two-bone IK from hips to planted feet; knees push out as the hips drop
  const stance = (b.female ? 44 : 52) + b.hip * 0.3;
  const feetY = -8 - k.lift * 0.55;
  const thigh = 118 * Hs, shin = 116 * Hs;
  const legW = b.female ? 40 : 46;
  for (const sd of [-1, 1]) {
    const hp = [sd * b.hip * 0.5 + lx * 0.2, hipY + 6];
    const ft = [sd * stance, feetY];
    const kn = ik(hp[0], hp[1], ft[0], ft[1], thigh, shin, -sd);
    P.fill(capsule(hp[0], hp[1], kn[0], kn[1], legW + 6, legW), spec.pants);
    P.fill(capsule(kn[0], kn[1], ft[0], ft[1] - 10, legW, legW - 6), spec.pants);
    P.stroke(line([[kn[0] + sd * 6, kn[1] - 30], [kn[0] + sd * 8, kn[1] + 10]]), deepen(spec.pants, 0.1), 2.5);
    if (spec.rips) for (const [u, w] of [[0.45, 20], [0.52, 14]]) {
      const rx = lerp(kn[0], ft[0], u - 0.4) - 2, ry = lerp(kn[1] - 16, kn[1] + 16, u);
      P.fill(roundRect(rx - w / 2, ry, w, 4, 2), K.paper);
    }
    // shoes
    const sx = ft[0] + sd * 10;
    if (spec.boots) {
      P.fill(roundRect(sx - 28, ft[1] - 34, 56, 40, 10), spec.shoes);
      P.fill(rect(sx - 30, ft[1] + 2, 60, 8), K.ink);
      P.stroke(line([[sx - 8, ft[1] - 28], [sx + 8, ft[1] - 28]]), [0.1, 0.2, 0.3], 2);
    } else {
      P.fill(curve([[sx - 30, ft[1] + 6], [sx - 28, ft[1] - 14], [sx - 6, ft[1] - 22], [sx + 20, ft[1] - 18], [sx + 32, ft[1] - 2], [sx + 32, ft[1] + 6]], true, 0.4), spec.shoes);
      P.fill(rect(sx - 31, ft[1] + 2, 64, 7), spec.shoes === K.ink ? [0.1, 0.2, 0.3] : [0.05, 0.1, 0.25]);
      P.stroke(curve([[sx - 14, ft[1] - 16], [sx + 2, ft[1] - 20], [sx + 14, ft[1] - 16]], false), [0.1, 0.25, 0.4], 2);
    }
  }
  // hips/belt block
  P.fill(curve([[-b.hip + lx * 0.2, hipY - 4], [b.hip + lx * 0.2, hipY - 4], [b.hip * 0.9, hipY + 34], [0, hipY + 44], [-b.hip * 0.9, hipY + 34]], true, 0.3), spec.pants);
  const L = [-b.sh + lx, shY + 14 + bodyDY * 0.3], R = [b.sh + lx, shY + 14 + bodyDY * 0.3];
  const neck = [lx, shY - 6];
  const sk = { sh: [L, R], neck, waistY: lerp(shY, hipY, 0.62), hipY, flap, chain: hairDX * 0.2 };
  torso(P, spec, sk, bf);
  // neck + head
  const nw = b.neck;
  P.fill(capsule(neck[0], neck[1] + 6, hx, hy + 36, nw, nw * 0.92), skinOf(spec));
  P.fill(ellipse(hx, hy + 52, nw * 0.5, 12), spec.skinShade || [0.14, 0.13, 0.04], 'lighter');
  head(P, spec, hx, hy, Hs, {
    ...pose, bf, pitch: num(pose.pitch) + pitchBang, tilt: num(pose.tilt, lean2tilt(k)),
    hair: { dx: hairDX, dy: hairDY }, skipBack: spec.hair.style === 'long', mouth: pose.mouth, viseme: pose.viseme,
  });
  // instrument across the body (neck to screen right)
  const kind = spec.instrument;
  let strumHand = [L[0] + 10, hipY - 50], fretH = [R[0] + 40, shY + 90];
  if (kind) {
    const rot = (spec.guitarAngle ?? -0.34) + k.lean * 0.04 + bodyDY * 0.002;
    const bx = -18 + lx * 0.5, by = hipY - 42 + bodyDY * 0.6 + (kind === 'bass' ? -34 : 0);
    const I = INST[kind];
    const d = [Math.cos(rot), Math.sin(rot)], n = [-d[1], d[0]];
    // strap over the (screen-right) shoulder
    const strapInk = spec.strap || K.ink;
    const horn = [bx + d[0] * (I.neck0 + 4) - n[0] * 30, by + d[1] * (I.neck0 + 4) - n[1] * 30];
    P.stroke(curve([horn, [lerp(horn[0], R[0], 0.6) - 6, lerp(horn[1], R[1], 0.6) - 30], [R[0] - 12, R[1] - 16]], false), strapInk, 11);
    const butt = [bx - d[0] * (kind === 'acoustic' ? 190 : 150), by - d[1] * (kind === 'acoustic' ? 190 : 150)];
    P.stroke(line([butt, [butt[0] + 10, butt[1] - 40]]), strapInk, 10);
    // fretting arm behind the neck
    const fret = clamp(num(pose.fret, 0.5));
    const along = I.neck0 + 26 + fret * (I.neckLen - 70);
    const slide = clamp(num(pose.fretSlide));
    fretH = [bx + d[0] * along + n[0] * (14 + slide * 6), by + d[1] * along + n[1] * (14 + slide * 6)];
    drawArm(P, spec, R, [fretH[0] + n[0] * 12, fretH[1] + n[1] * 12], [0.35, 1]);
    instrument(P, kind, bx, by, rot, 1, { bf });
    fretHand(P, spec, fretH[0], fretH[1], rot, { lift: slide, chord: num(pose.chord) });
    // picking/strumming hand
    const sp = strumPos(pose, kind);
    const amp = kind === 'bass' ? 10 : 30;
    const sAt = kind === 'bass' ? [-40, 0] : [4, 0];
    const pick = [bx + d[0] * sAt[0] + n[0] * sp * amp, by + d[1] * sAt[0] + n[1] * sp * amp];
    if (kind === 'bass') {
      // fingers rest across the strings; pluck pulls one through toward the body
      const pl = clamp(num(pose.pluck));
      strumHand = [pick[0] - n[0] * 18, pick[1] - n[1] * 18];
      drawArm(P, spec, L, [strumHand[0] - d[0] * 16, strumHand[1] - d[1] * 16], [-0.3, 1], { fore: 0.95 });
      bassHand(P, spec, strumHand[0], strumHand[1], rot, pl, num(pose.pluckString, 1));
    } else {
      strumHand = [pick[0] - n[0] * 14 - d[0] * 8, pick[1] - n[1] * 14 - d[1] * 8];
      drawArm(P, spec, L, strumHand, [-0.55, -1]);
      const handAng = rot + Math.PI * 0.5 + sp * 0.35;
      fist(P, strumHand[0], strumHand[1], handAng, armDims(spec).hr, skinOf(spec), shadeOf(spec), { knuckleSide: 1 });
      const pt = [strumHand[0] + n[0] * 12 + d[0] * 6, strumHand[1] + n[1] * 12 + d[1] * 6];
      P.fill(poly([[pt[0] - 5, pt[1] - 3], [pt[0] + 5, pt[1] - 3], [pt[0], pt[1] + 8]]), [0.1, 0.9, 0.1]);
      // motion arc: a pale smear when the hand is moving fast
      const v = strumSpeed(pose);
      if (v > 0.3) {
        const back = -Math.sign(num(pose.strumDir, 1)) * 26 * v;
        P.fill(curve([[pick[0], pick[1]], [pick[0] + n[0] * back + d[0] * 10, pick[1] + n[1] * back + d[1] * 10], [pick[0] + n[0] * back * 0.6 - d[0] * 12, pick[1] + n[1] * back * 0.6 - d[1] * 12]], true, 0.5), [0.12, 0.05, 0]);
      }
    }
    if (spec.bracelet) P.stroke(circle(strumHand[0], strumHand[1] + 14, 12), K.paper, 3);
  } else {
    drawArm(P, spec, L, [L[0] - 20, hipY - 20], [-0.5, 0.2]);
    drawArm(P, spec, R, [R[0] + 20, hipY - 20], [0.5, 0.2]);
    hand(P, L[0] - 20, hipY - 20, Math.PI / 2, armDims(spec).hr, skinOf(spec), shadeOf(spec));
    hand(P, R[0] + 20, hipY - 20, Math.PI / 2, armDims(spec).hr, skinOf(spec), shadeOf(spec), { thumbSide: -1 });
  }
  if (pose.micAt) {
    const m = pose.micAt;
    P.fill(rect(m[0] - 5, m[1], 10, -m[1]), K.ink);
    P.fill(capsule(m[0], m[1], m[0] - 30, m[1] - 30, 12), K.ink);
    P.fill(roundRect(m[0] - 58, m[1] - 50, 36, 22, 10), [0.2, 0.3, 0.4]);
    P.fill(poly([[m[0] - 60, 0], [m[0] + 60, 0], [m[0], -24]]), K.ink);
  }
  P.restore();
}
const lean2tilt = (k) => k.lean * 0.07;

// -1..1: strum hand position across the strings (-1 above them, +1 below)
function strumPos(pose, kind) {
  if (typeof pose.strumP === 'number') return clamp(pose.strumP, -1.3, 1.3);
  if (typeof pose.strumSince === 'number' || typeof pose.strumUntil === 'number') {
    const dir = Math.sign(num(pose.strumDir, 1)) || 1;
    const since = num(pose.strumSince, 1), until = num(pose.strumUntil, 1), vel = clamp(num(pose.strumVel, 0.8));
    const T = 0.075;
    // follow-through past the strings, a small overshoot, then drift back toward centre
    let p = dir * (easeOut(since / T) * 1.0 + 0.18 * vel * alpha(since, 0.09)) * (1 - 0.35 * clamp((since - 0.25) / 0.5));
    if (until < T) {
      const nd = -dir; // next stroke is the other way
      const from = p;
      p = lerp(-nd * 1, 0, easeIn(1 - until / T));
      p = lerp(from, p, clamp(1 - until / T + 0.35));
    }
    return p;
  }
  if (typeof pose.strum === 'number') return -Math.cos(pose.strum * TAU) * (kind === 'bass' ? 0.5 : 1);
  return 0;
}
function strumSpeed(pose) {
  if (typeof pose.strumSince !== 'number') return 0;
  return clamp(1 - pose.strumSince / 0.08) * clamp(num(pose.strumVel, 0.8));
}
const easeOut = (t) => { t = clamp(t); return 1 - (1 - t) ** 3; };
const easeIn = (t) => { t = clamp(t); return t * t; };

function bassHand(P, spec, x, y, rot, pluck, str) {
  const skin = skinOf(spec), shade = shadeOf(spec), r = armDims(spec).hr;
  P.save();
  P.translate(x, y);
  P.rotate(rot);
  P.fill(roundRect(-r * 1.1, -r * 0.8, r * 2.0, r * 1.7, r * 0.7), skin);
  // index + middle across the strings; the active one pulls through
  for (let i = 0; i < 2; i++) {
    const act = i === Math.round(str) % 2 ? pluck : 0;
    const fx = -r * 0.3 + i * r * 0.75;
    P.fill(capsule(fx, 0, fx + r * 0.2 + act * 4, r * 1.9 + act * 10, r * 0.55, r * 0.46), skin);
    P.stroke(line([[fx + 2, r * 0.8], [fx + 3, r * 1.2]]), shade, 1.4);
  }
  P.fill(capsule(-r * 0.9, -r * 0.2, -r * 1.2, r * 1.2, r * 0.6, r * 0.5), skin);
  P.restore();
}

// ---------------------------------------------------------------- the drum kit (front view, right-handed)
// KIT: positions in drummer units (drummer scale 1, floor y = 0, kit centred on x = 0).
export const KIT = {
  kick: { x: 0, y: -118, r: 118 },
  tom1: { x: 52, y: -270, rx: 38, ry: 11, d: 34 },
  tom2: { x: -52, y: -270, rx: 38, ry: 11, d: 34 },
  snare: { x: 130, y: -228, rx: 46, ry: 12, d: 24 },
  hat: { x: 210, y: -272, rx: 48, ry: 8 },
  floor: { x: -160, y: -196, rx: 54, ry: 14, d: 92 },
  ride: { x: -232, y: -306, rx: 76, ry: 12 },
  crash: { x: 196, y: -404, rx: 64, ry: 11 },
};

// kit(P, x, floor, s, o): the kit alone. o: bf, kick 0..1 pulse, snare/hat/tom1/tom2/floor 0..1 hit pulses,
// crash/ride 0..1 (cymbal flash + tilt), crashSince/rideSince (s, for a ringing wobble), hatOpen 0..1,
// inks (shell colour), logo true
export function kit(P, x, floor, s, o = {}) {
  P.save();
  P.translate(x, floor);
  P.scale(s);
  drawKit(P, o);
  P.restore();
}

function cymbal(P, c, hit, since, inks, { flip = 1 } = {}) {
  const wob = typeof since === 'number' ? spring(since, 4.2, 3.5) * 0.14 : hit * 0.08;
  P.fill(rect(c.x - 3, c.y, 6, -c.y), inks);
  P.fill(poly([[c.x - 30, 0], [c.x + 30, 0], [c.x + 2, -30], [c.x - 2, -30]]), inks);
  if (hit > 0.05) P.glow(c.x, c.y, c.rx * (1.2 + hit), [hit * 0.9, 0.12 * hit, 0]);
  P.save();
  P.translate(c.x, c.y);
  P.rotate(wob * flip);
  const on = hit > 0.25;
  P.fill(ellipse(0, 0, c.rx, c.ry + 2), on ? [1, 0.25 * (1 - hit), 0] : [0.55, 0.45, 0.1]);
  P.fill(ellipse(0, -2, c.rx * 0.96, c.ry * 0.7), on ? [0.7, 0.05, 0] : [0.85, 0.35, 0.05]);
  P.fill(ellipse(0, -3, c.rx * 0.18, c.ry * 0.35), [0.4, 0.4, 0.2]);
  P.stroke(curve([[-c.rx * 0.7, -1], [0, -c.ry * 0.6], [c.rx * 0.6, -2]], false), K.paper, 1.6);
  P.restore();
}

function drum(P, d, hit, inks, head = [0.02, 0.02, 0.08]) {
  const shell = inks;
  P.fill(rect(d.x - d.rx, d.y, d.rx * 2, d.d), shell);
  P.fill(ellipse(d.x, d.y + d.d, d.rx, d.ry), shell);
  for (const u of [0.25, 0.5, 0.75]) P.fill(rect(d.x - d.rx + u * d.rx * 2 - 3, d.y + 2, 6, d.d - 2), deepen(shell, 0.15));
  P.fill(rect(d.x - d.rx, d.y + 2, d.rx * 2, 5), [0.4, 0.4, 0.5]);
  P.fill(ellipse(d.x, d.y, d.rx, d.ry), [0.4, 0.4, 0.5]);
  P.fill(ellipse(d.x, d.y, d.rx - 3, d.ry - 2), hit > 0.3 ? [0.9, 0.1, 0] : head);
}

function drawKit(P, o) {
  const inks = o.inks || [0.05, 0.95, 0.9];
  const bf = o.bf ?? 0;
  const K2 = KIT;
  // back stands
  P.stroke(line([[K2.tom1.x, K2.tom1.y + 30], [K2.tom1.x - 10, -200]]), K.ink, 5);
  // floor tom (legs), snare (stand), hi-hat (stand + pedal)
  const fl = K2.floor;
  for (const lx of [-0.8, 0.8]) P.stroke(line([[fl.x + lx * fl.rx, fl.y + fl.d], [fl.x + lx * fl.rx * 1.1, 0]]), K.ink, 5);
  drum(P, fl, num(o.floor), inks);
  const sn = K2.snare;
  P.stroke(line([[sn.x, sn.y + sn.d], [sn.x, -30]]), K.ink, 5);
  P.fill(poly([[sn.x - 30, 0], [sn.x + 30, 0], [sn.x, -34]]), K.ink);
  drum(P, sn, num(o.snare), [0.05, 0.05, 0.2], [0.02, 0.02, 0.06]);
  for (let i = 0; i < 6; i++) P.fill(rect(sn.x - sn.rx + 6 + i * 15, sn.y + 6, 4, sn.d - 8), [0.3, 0.3, 0.45]);
  const hh = K2.hat, open = clamp(num(o.hatOpen, 0.15));
  P.fill(rect(hh.x - 3, hh.y, 6, -hh.y), K.ink);
  P.fill(poly([[hh.x - 34, 0], [hh.x + 34, 0], [hh.x, -40]]), K.ink);
  P.fill(ellipse(hh.x, hh.y + 5, hh.rx, hh.ry), [0.55, 0.45, 0.1]);
  const ht = num(o.hat);
  P.fill(ellipse(hh.x, hh.y - open * 8, hh.rx, hh.ry), ht > 0.3 ? [1, 0.25, 0] : [0.8, 0.32, 0.05]);
  P.fill(ellipse(hh.x, hh.y - open * 8 - 2, hh.rx * 0.2, hh.ry * 0.5), [0.4, 0.4, 0.2]);
  // rack toms on the kick
  drum(P, K2.tom2, num(o.tom2), inks);
  drum(P, K2.tom1, num(o.tom1), inks);
  // kick drum with the logo head
  const kk = K2.kick, kick = num(o.kick);
  const kr = kk.r * (1 + kick * 0.035);
  P.fill(circle(kk.x, kk.y, kr), inks);
  P.fill(circle(kk.x, kk.y, kr - 6), [0.4, 0.4, 0.5]);
  P.fill(circle(kk.x, kk.y, kr * 0.86), [0.06, 0.04, 0.12]);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    P.fill(circle(kk.x + Math.cos(a) * (kr - 3), kk.y + Math.sin(a) * (kr - 3), 5), [0.3, 0.3, 0.45]);
  }
  if (o.logo !== false) {
    P.text('THE', kk.x, kk.y - 26, `${Math.round(26 * kr / 118)}px "Rubik Mono One"`, K.navy);
    P.text('BED HEADS', kk.x, kk.y + 14, `${Math.round(36 * kr / 118)}px Anton`, [0, 1, 0.2]);
    P.fill(star(kk.x, kk.y + 50, 12, 5), [1, 0, 0]);
  }
  P.fill(roundRect(kk.x - 34, -10, 20, 14, 3), K.ink);
  P.fill(roundRect(kk.x + 14, -10, 20, 14, 3), K.ink);
  cymbal(P, K2.ride, num(o.ride), o.rideSince, K.ink, { flip: -1 });
  cymbal(P, K2.crash, num(o.crash), o.crashSince, K.ink);
}

// ---------------------------------------------------------------- stick strokes
// Contact geometry per hand and target: tip = where the stick meets the head (drummer units),
// d = 3D direction from the hand to the tip at contact (z toward camera, so it foreshortens).
const STROKE = {
  R: {
    hat: { tip: [198, -275], d: [0.92, 0.28, 0.27] },
    snare: { tip: [116, -231], d: [0.66, 0.42, 0.62] },
    tom1: { tip: [46, -272], d: [0.5, 0.52, 0.69] },
    tom2: { tip: [-54, -272], d: [0.05, 0.62, 0.78] },
    floor: { tip: [-154, -200], d: [-0.28, 0.66, 0.7] },
    ride: { tip: [-212, -308], d: [-0.5, 0.25, 0.83] },
    crash: { tip: [180, -406], d: [0.9, -0.06, 0.43] },
  },
  L: {
    snare: { tip: [132, -232], d: [-0.18, 0.55, 0.82] },
    hat: { tip: [214, -276], d: [0.2, 0.6, 0.77] },
    tom1: { tip: [58, -273], d: [-0.42, 0.56, 0.71] },
    tom2: { tip: [-44, -273], d: [-0.72, 0.48, 0.5] },
    floor: { tip: [-144, -204], d: [-0.9, 0.36, 0.25] },
    crash: { tip: [186, -405], d: [0.28, -0.5, 0.82] },
    ride: { tip: [-208, -309], d: [-0.9, 0.0, 0.43] },
  },
};
const STICK = 112;
const UPDIR = { R: [-0.3, -0.92, -0.25], L: [0.3, -0.92, -0.25] };

// stick height h for one hand: 0 = tip on the head, ~1 = full wind-up. Plain numbers:
// since (s since this hand's last hit), until (s to its next hit), vel 0..1 of the next hit, prevVel.
// Or phase 0..1 (0 = contact, rebound, hover, wind-up, throw).
export function strokeHeight({ since, until, vel = 0.7, prevVel, phase } = {}) {
  if (typeof phase === 'number' && typeof since !== 'number') {
    const p = ((phase % 1) + 1) % 1, gap = 0.42;
    since = p * gap; until = (1 - p) * gap;
  }
  since = num(since, 1); until = num(until, 1);
  const pv = num(prevVel, vel);
  const gap = since + until;
  const quick = clamp(gap / 0.32, 0.35, 1);
  const rest = (0.18 + 0.1 * vel) * quick;
  const reb = rest * (1 - Math.exp(-since / 0.035)) + 0.3 * pv * quick * alpha(since, 0.06);
  const Td = clamp(gap * 0.3, 0.035, 0.085);
  const Tw = clamp(gap * 0.72, Td + 0.02, 0.28);
  const up = (0.4 + 0.7 * clamp(vel)) * quick;
  if (until < Td) return up * (1 - (1 - until / Td) ** 2);
  if (until < Tw) return lerp(reb, up, ease((Tw - until) / (Tw - Td)));
  return reb;
}

function handState(side, hs0) {
  const h = hs0 || {};
  const S = STROKE[side];
  const to = S[h.to] ? h.to : side === 'R' ? 'hat' : 'snare';
  const from = S[h.from] ? h.from : to;
  const since = num(h.since, typeof h.phase === 'number' ? undefined : 1);
  const until = num(h.until, 1);
  const H = strokeHeight(h);
  // travel between drums during the hover/wind-up, landing just before the throw
  const gap = Math.max(0.05, num(h.since, 0.2) + num(h.until, 0.2));
  const tr = from === to ? 1 : ease(clamp((num(h.since, 0.2) - 0.02) / Math.max(0.04, gap * 0.7)));
  const a = S[from], b = S[to];
  const tip0 = [lerp(a.tip[0], b.tip[0], tr), lerp(a.tip[1], b.tip[1], tr)];
  const dC = norm3([lerp(a.d[0], b.d[0], tr), lerp(a.d[1], b.d[1], tr), lerp(a.d[2], b.d[2], tr)]);
  return { H, tip0, dC, since: num(h.since, 1), until: num(h.until, 1), vel: clamp(num(h.vel, 0.7)), to, travel: from !== to ? Math.sin(Math.PI * tr) : 0 };
}

// hand + stick for height h (0..1+): hand lifts with the wrist, stick rotates up toward UPDIR
function stickPose(side, st, h) {
  const k = clamp(h, 0, 1.3);
  const up = UPDIR[side];
  const d = norm3([lerp(st.dC[0], up[0], ease(Math.min(1, k * 0.95))), lerp(st.dC[1], up[1], ease(Math.min(1, k * 0.95))), lerp(st.dC[2], up[2], ease(Math.min(1, k * 0.95)))]);
  const hand0 = [st.tip0[0] - st.dC[0] * STICK, st.tip0[1] - st.dC[1] * STICK];
  const sd = side === 'R' ? -1 : 1;
  const handP = [hand0[0] + sd * 8 * k, hand0[1] - 58 * k - st.travel * 14];
  const tip = [handP[0] + d[0] * STICK, handP[1] + d[1] * STICK];
  return { hand: handP, tip, d };
}

// ---------------------------------------------------------------- the drummer
// drummer(P, spec, x, floor, s, pose): the seated singing drummer with the kit, in one call.
// x, floor: kit centre on the stage floor. s: character scale (kit is sized to match).
// pose (all optional):
//   R, L: per-hand strokes {to, from, since, until, vel, prevVel} or {to, phase}; targets are
//         'snare'|'hat'|'tom1'|'tom2'|'floor'|'crash'|'ride' (R defaults to hat, L to snare)
//   kick 0..1 (1 = pedal down on the hit), kickAnt 0..1 (knee lifting before the next kick)
//   crash 0..1 recoil pulse (torso), crashSince (s, cymbal wobble), ride/snare/hat/tom1/tom2/floor 0..1
//     head flashes on the kit, hatOpen 0..1
//   bang 0..1 head-bang pulse on downbeats, bangAnt 0..1 (head lifts before it), bob 0..1, lean -1..1
//   face: mouth|viseme {open,wide,round}, belt 0..1, expr, brow, look, blink, turn, pitch
//   kit: false to skip the kit, mic: false to skip the boom mic, impact: false to skip hit ticks
//   lag: the same pose a few frames earlier (curls, shirt and chain follow it)
function dskel(spec, pose) {
  const crash = num(pose.crash), bang = num(pose.bang), ant = num(pose.bangAnt), bob = num(pose.bob);
  const shY = -333 + bob * 8 - crash * 9 + bang * 6 - ant * 3;
  const lx = num(pose.lean) * 12 + crash * 7;
  return { crash, bang, ant, bob, shY, lx, headY: shY - 80 + bang * 16 - ant * 6 - crash * 4, headX: lx * 1.2 };
}

export function drummer(P, spec, x, floor, s, pose = {}) {
  spec = spec || BAND.noah;
  const bf = pose.bf ?? 0;
  const b = spec.build;
  const k = dskel(spec, pose);
  const kl = pose.lag ? dskel(spec, pose.lag) : null;
  const hairDY = kl ? clamp(drag(k.headY, kl.headY, 0.6), -14, 14) : -k.bang * 4;
  const hairDX = kl ? clamp(drag(k.headX, kl.headX, 0.7), -12, 12) : 0;
  const flap = kl ? clamp(drag(k.shY, kl.shY, 0.12) + drag(k.lx, kl.lx, 0.1), -1.5, 1.5) : k.crash * 0.6;
  P.save();
  P.translate(x, floor);
  P.scale(s);
  const { shY, lx } = k;
  // knees above the kick's shoulders (the right one works the pedal)
  const kick = num(pose.kick), kant = num(pose.kickAnt);
  for (const sd of [-1, 1]) {
    const ky = -196 + (sd < 0 ? kick * 7 - kant * 12 : num(pose.hatOpen) * -6);
    P.fill(capsule(sd * 40, -170, sd * 92, ky, 50, 44), spec.pants);
  }
  // torso, neck, head
  const L = [-b.sh + lx, shY + 14], R = [b.sh + lx, shY + 14];
  const neck = [lx, shY - 6];
  torso(P, spec, { sh: [L, R], neck, waistY: shY + 150, hipY: shY + 190, flap, chain: hairDX * 0.25 + k.crash * 0.6 }, bf);
  const hx = k.headX, hy = k.headY;
  P.fill(capsule(neck[0], neck[1] + 6, hx, hy + 38, b.neck, b.neck * 0.92), skinOf(spec));
  P.fill(ellipse(hx, hy + 56, b.neck * 0.5, 12), spec.skinShade, 'lighter');
  const pitch = num(pose.pitch) - k.bang * 0.6 + k.ant * 0.2 + k.crash * 0.25;
  head(P, spec, hx, hy, 1, { ...pose, bf, pitch, tilt: num(pose.tilt, k.lx * 0.004 + k.crash * 0.05), hair: { dx: hairDX, dy: hairDY } });
  // boom mic from screen left, in front of his mouth
  if (pose.mic !== false) {
    P.stroke(line([[-300, 0], [-300, -470]]), K.ink, 8);
    P.stroke(line([[-300, -470], [-60, -388]]), K.ink, 7);
    P.save();
    P.translate(-50, -384);
    P.rotate(0.35);
    P.fill(roundRect(-26, -11, 40, 22, 10), [0.2, 0.3, 0.4]);
    P.fill(roundRect(-30, -8, 10, 16, 3), K.ink);
    P.restore();
  }
  if (pose.kit !== false) drawKit(P, { ...pose, bf, logo: pose.logo, inks: pose.kitInks, hat: num(pose.hat), crash: num(pose.crashFlash, num(pose.crash)) });
  // arms and sticks: left first so the right stick crosses over it to the hi-hat
  drawSticks(P, spec, L, R, pose);
  P.restore();
}

function drawSticks(P, spec, L, R, pose) {
  const skin = skinOf(spec), sh = shadeOf(spec), d = armDims(spec);
  for (const side of ['L', 'R']) {
    const st = handState(side, pose[side]);
    const sp = stickPose(side, st, st.H);
    const shoulder = side === 'R' ? L : R;
    const sd = side === 'R' ? -1 : 1;
    // smear while the stick is being thrown down
    if (st.until < 0.09 && st.H > 0.05) {
      const g = stickPose(side, st, Math.min(st.H + 0.35, 1.2));
      P.fill(poly([sp.hand, sp.tip, g.tip, g.hand]), [0.1, 0.06, 0.02]);
    }
    const el = drawArm(P, spec, shoulder, sp.hand, [sd * 0.8, 1]);
    // stick: butt behind the fist, taper to the tip bead
    const butt = [sp.hand[0] - sp.d[0] * 22, sp.hand[1] - sp.d[1] * 22];
    P.fill(capsule(butt[0], butt[1], sp.tip[0], sp.tip[1], 8, 5), INK.wood);
    P.fill(circle(sp.tip[0], sp.tip[1], 4.5), INK.stickTip);
    const ang = Math.atan2(sp.d[1], sp.d[0]);
    fist(P, sp.hand[0], sp.hand[1], ang, d.hr * 1.02, skin, sh, { knuckleSide: side === 'R' ? 1 : -1 });
    if (spec.bracelet && side === 'R') {
      const w = [lerp(el[0], sp.hand[0], 0.8), lerp(el[1], sp.hand[1], 0.8)];
      P.stroke(ellipse(w[0], w[1], 11, 14, Math.atan2(sp.hand[1] - el[1], sp.hand[0] - el[0])), K.paper, 3);
    }
    // contact ticks
    if (pose.impact !== false && st.since < 0.07) {
      const a = 1 - st.since / 0.07;
      for (let i = -1; i <= 1; i++) {
        const ang2 = -Math.PI / 2 + i * 0.7;
        P.stroke(line([[sp.tip[0] + Math.cos(ang2) * 10, sp.tip[1] + Math.sin(ang2) * 10], [sp.tip[0] + Math.cos(ang2) * (10 + 16 * a), sp.tip[1] + Math.sin(ang2) * (10 + 16 * a)]]), [0.9, 0.1, 0], 3);
      }
    }
  }
}

// ---------------------------------------------------------------- legacy drummer API (old kit geometry)
// drummerBody + drummerArms still work with lib/people.mjs drumkit(): body before the kit, arms after.
export function drummerBody(P, spec, x, y, s, { bf = 0, bob = 0, mouth = 0, look = [0, 0.2], blink = 0, lean = 0, ...rest } = {}) {
  const k = dskel(spec, { bob, lean, ...rest });
  P.save();
  P.translate(x, y + 183 * s);
  P.scale(s);
  const b = spec.build;
  const L = [-b.sh + k.lx, k.shY + 14], R = [b.sh + k.lx, k.shY + 14];
  const neck = [k.lx, k.shY - 6];
  torso(P, spec, { sh: [L, R], neck, waistY: k.shY + 150, hipY: k.shY + 190, flap: k.crash * 0.5, chain: 0 }, bf);
  P.fill(capsule(neck[0], neck[1] + 6, k.headX, k.headY + 38, b.neck, b.neck * 0.92), skinOf(spec));
  head(P, spec, k.headX, k.headY, 1, { ...rest, bf, mouth, look, blink, pitch: num(rest.pitch) - k.bang * 0.6 });
  P.stroke(line([[-300, -600], [-60, -388]]), K.ink, 7);
  P.save();
  P.translate(-50, -384);
  P.rotate(0.35);
  P.fill(roundRect(-26, -11, 40, 22, 10), [0.2, 0.3, 0.4]);
  P.restore();
  P.restore();
}

export function drummerArms(P, spec, x, y, s, { snare = 0, hat = 0, crash = 0, bob = 0, lean = 0, snareAt = [-140, 12], hatAt = [202, -112] } = {}) {
  // old kit: snare on screen left (right hand), hi-hat on screen right (left hand)
  const k = dskel(spec, { bob, lean });
  P.save();
  P.translate(x, y + 183 * s);
  P.scale(s);
  const b = spec.build;
  const L = [-b.sh + k.lx, k.shY + 14], R = [b.sh + k.lx, k.shY + 14];
  const sn = [snareAt[0], snareAt[1] - 183], hh = [hatAt[0], hatAt[1] - 183];
  const skin = skinOf(spec), sh = shadeOf(spec), d = armDims(spec);
  const sets = [
    ['R', L, { tip0: [sn[0] + 10, sn[1] - 4], dC: norm3([-0.35, 0.55, 0.75]), travel: 0 }, 1 - snare, -1],
    ['L', R, { tip0: [hh[0] - 6, hh[1] - 4], dC: norm3([0.3, 0.6, 0.75]), travel: 0 }, (1 - hat) * 0.8 + crash * 0.4, 1],
  ];
  for (const [side, shoulder, st, h, sd] of sets) {
    const sp = stickPose(side, st, clamp(h, 0, 1.2));
    drawArm(P, spec, shoulder, sp.hand, [sd * 0.8, 1]);
    const butt = [sp.hand[0] - sp.d[0] * 22, sp.hand[1] - sp.d[1] * 22];
    P.fill(capsule(butt[0], butt[1], sp.tip[0], sp.tip[1], 8, 5), INK.wood);
    P.fill(circle(sp.tip[0], sp.tip[1], 4.5), INK.stickTip);
    fist(P, sp.hand[0], sp.hand[1], Math.atan2(sp.d[1], sp.d[0]), d.hr, skin, sh, { knuckleSide: side === 'R' ? 1 : -1 });
    if (spec.bracelet && side === 'R') P.stroke(circle(sp.hand[0] - 8, sp.hand[1] + 12, 11), K.paper, 3);
  }
  P.restore();
}

// ---------------------------------------------------------------- Noah driving
// boyCar(P, spec, x, y, s, pose): driver seen through the windshield, chest up. (x, y) = chest centre.
// pose: steer -1..1 (wheel turn), glance -1..1 (head turn; - = toward his passenger, screen left),
//   look [x,y], expr, mouth|viseme, blink, bf, bob, frame true (windshield frame + dash), night 0..1,
//   lag
export function boyCar(P, spec, x, y, s, pose = {}) {
  spec = spec || BAND.noah;
  const bf = pose.bf ?? 0, b = spec.build;
  const steer = clamp(num(pose.steer), -1, 1), glance = clamp(num(pose.glance), -1, 1);
  const bob = num(pose.bob);
  P.save();
  P.translate(x, y);
  P.scale(s);
  // seat + headrest
  P.fill(roundRect(-150, -210, 300, 460, 60), [0.2, 0.55, 0.7]);
  P.fill(roundRect(-70, -310, 140, 110, 36), [0.25, 0.6, 0.75]);
  const shY = -20 + bob * 4;
  const L = [-b.sh, shY + 14], R = [b.sh, shY + 14];
  const neck = [0, shY - 6];
  torso(P, spec, { sh: [L, R], neck, waistY: shY + 170, hipY: shY + 210, flap: 0, chain: glance * 2 }, bf);
  // seatbelt over his left shoulder (screen right) to the right hip
  P.stroke(line([[R[0] - 6, R[1] - 16], [L[0] + 20, shY + 230]]), [0.25, 0.6, 0.7], 20);
  P.stroke(line([[R[0] - 6, R[1] - 16], [L[0] + 20, shY + 230]]), [0.15, 0.45, 0.6], 3);
  P.fill(capsule(neck[0], neck[1] + 6, glance * 6, shY - 48, b.neck, b.neck * 0.92), skinOf(spec));
  head(P, spec, glance * 8, shY - 86 + bob * 2, 1, { ...pose, bf, turn: glance * 0.55, look: pose.look || [glance * 1.1, 0], hair: { dx: -glance * 2, dy: 0 } });
  // steering wheel low in frame, hands at ten and two
  const wc = [0, shY + 250], wr = 150;
  const a0 = steer * 0.9;
  const hands = [a0 - Math.PI * 0.78, a0 - Math.PI * 0.22].map((a) => [wc[0] + Math.cos(a) * wr, wc[1] + Math.sin(a) * wr * 0.55]);
  drawArm(P, spec, L, hands[0], [-1, 0.6]);
  drawArm(P, spec, R, hands[1], [1, 0.6]);
  P.stroke(ellipse(wc[0], wc[1], wr, wr * 0.55, 0), K.ink, 22);
  P.stroke(line([[wc[0] - Math.cos(a0) * wr * 0.9, wc[1] - Math.sin(a0) * wr * 0.5], [wc[0] + Math.cos(a0) * wr * 0.9, wc[1] + Math.sin(a0) * wr * 0.5]]), K.ink, 16);
  P.fill(ellipse(wc[0], wc[1] + 6, 44, 26), K.ink);
  hands.forEach((hp, i) => fist(P, hp[0], hp[1], -Math.PI / 2 + (i ? 0.4 : -0.4) + a0 * 0.5, armDims(spec).hr * 1.05, skinOf(spec), shadeOf(spec), { knuckleSide: i ? -1 : 1 }));
  if (spec.bracelet) P.stroke(circle(hands[0][0] + 6, hands[0][1] + 20, 12), K.paper, 3);
  if (pose.frame !== false) {
    // windshield frame: dash, A-pillars, mirror
    P.fill(poly([[-560, shY + 300], [560, shY + 300], [560, 700], [-560, 700]]), K.ink);
    P.fill(poly([[-560, shY + 290], [560, shY + 290], [560, shY + 312], [-560, shY + 312]]), [0.2, 0.4, 0.55]);
    P.fill(poly([[-560, -560], [-470, -560], [-380, shY + 300], [-560, shY + 300]]), K.ink);
    P.fill(poly([[560, -560], [470, -560], [380, shY + 300], [560, shY + 300]]), K.ink);
    P.fill(rect(-560, -560, 1120, 70), K.ink);
    P.fill(roundRect(-230, -485, 150, 44, 10), K.ink);
    P.fill(roundRect(-222, -478, 134, 30, 7), [0.2, 0.35, 0.5]);
    // glass reflections
    P.fill(poly([[-300, -490], [-250, -490], [-420, shY + 290], [-470, shY + 290]]), [0, 0.12, 0.08], 'lighter');
    P.fill(poly([[330, -490], [350, -490], [200, shY + 290], [180, shY + 290]]), [0, 0.1, 0.06], 'lighter');
  }
  P.restore();
}

// Evaluate a pose function now and a few frames earlier, for secondary motion:
//   drummer(P, BAND.noah, x, y, s, withLag((t) => poseAt(t), t))
export function withLag(poseAt, t, dt = 0.1) {
  return { ...poseAt(t), lag: poseAt(t - dt) };
}
