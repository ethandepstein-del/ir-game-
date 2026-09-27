// Noah's car: a boxy, beat-up 90s station wagon in blue ink with one mismatched pink door (the
// front passenger door). Owned by S1; shared by verse 1 (S1), verse 2 (S3, the hood at night) and
// the outro (S4, driving away). Every function is pure: pass time-derived numbers in, get pixels.
//
// Coordinates: every view is drawn around (x, ground): x is the car's centre line, ground is the
// y where the tyres touch the road. s scales the whole car. At s = 1:
//   side view  ~780 px long, roof 258 px above the ground (CAR.side)
//   rear view  ~440 px wide, 262 px tall (CAR.rear)
//   front view ~450 px wide, 262 px tall (CAR.front)
//
// API
//   carSide(P, x, ground, s, o)    side view. o.dir 1 faces right (you see the passenger side and
//                                  the pink door), -1 faces left (driver side, no pink door).
//     o.roll       px travelled (wheels turn roll / r), o.bounce px body lift (+ up),
//     o.pitch      rad, + dips the nose (braking), o.bf boil frame,
//     o.lights     0..1 headlights, o.tail 0..1 tail lights, o.brake 0..1, o.blink 0..1 (amber),
//     o.door       0..1 front passenger door swing (dir 1 only; opens toward camera),
//     o.inside     (P, g) => draws people/props behind the glass; g = sideGeo() in car units,
//                  already transformed (draw in car units: g.seatNear, g.seatFar, g.wheel ...),
//     o.sweep      {x, k}: an overhead light at car-unit x lighting the body (streetlight pass),
//     o.wet 0..1   beads + streaks, o.plate text on the plate (null hides it), o.shadow true.
//   carRear(P, x, ground, s, o)    rear view (driving away). o.roll, o.bounce, o.lean (rad),
//     o.tail, o.brake, o.blink (-1 left, 1 right, 0 off, or {side, k}), o.exhaust 0..1 puff,
//     o.inside (P, g) heads in the rear window, o.plate, o.bf, o.wet.
//   carFront(P, x, ground, s, o)   front view (the hood). o.lights, o.bounce, o.inside (P, g)
//     people behind the windshield, o.bf, o.wet, o.hoodRefl (P, g) extra reflection on the hood.
//   carBeams(P, x, ground, s, o)   headlight cones for the side view, drawn separately so a scene
//     can put rain or words inside them: o.dir, o.k 0..1, o.len px, o.spread rad, o.tilt rad.
//   CAR.side.hood / CAR.front.hood / CAR.side.seatNear ...: anchors in car units (multiply by s,
//     add (x, ground)); carPoint(view, x, ground, s, name, dir) does that for you.
//
// Colours are exported as CAR_INKS so other scenes can match (e.g. a blue car in a photo).
import { Path2D } from '../lib/ink.mjs';
import { boil, capsule, circle, curve, ellipse, line, poly, rect, roundRect, star } from '../lib/shapes.mjs';
import { clamp, hash, hs, lerp, TAU } from '../lib/util.mjs';
import { K } from '../lib/world.mjs';

export const CAR_INKS = {
  body: [0.06, 0.3, 1],
  shade: [0.14, 0.55, 1],
  deep: [0.25, 0.8, 1],
  hi: [0, 0.1, 0.62],
  pink: [0.04, 0.92, 0.06],
  pinkShade: [0.12, 1, 0.3],
  trim: [0.28, 0.72, 0.82],
  glass: [0.12, 0.62, 0.95],
  glassHi: [0.02, 0.3, 0.62],
  tyre: [0.35, 1, 1],
  rim: [0.12, 0.3, 0.45],
  headOn: [1, 0.06, 0],
  headOff: [0.15, 0.25, 0.4],
  tailOn: [1, 1, 0],
  tailOff: [0.45, 0.85, 0.35],
  amber: [1, 0.45, 0],
  rust: [0.55, 0.55, 0.2],
};
const C = CAR_INKS;

// anchors in car units (x right = front of the car for dir 1, y up is negative, ground = 0)
export const CAR = {
  side: {
    length: 784, roof: -258, belt: -142, hoodTop: -140, wheelR: 52, axleRear: -250, axleFront: 236,
    hood: [300, -142], roofMid: [-140, -262], seatNear: [40, -120], seatFar: [70, -126],
    doorHinge: [168, -40], plate: [-392, -80], headlight: [384, -112], tailLight: [-388, -150],
  },
  rear: { width: 440, height: 262, window: [-160, -246, 320, 92], plate: [0, -104], tailL: [-196, -140], tailR: [196, -140] },
  front: { width: 452, height: 262, hood: { y: -150, x0: -200, x1: 200, depth: 60 }, windshield: [-176, -254, 352, 96], lights: [[-160, -116], [160, -116]] },
};

export function carPoint(view, x, ground, s, name, dir = 1) {
  const a = CAR[view][name];
  if (!a) return [x, ground];
  return [x + a[0] * s * (view === 'side' ? dir : 1), ground + a[1] * s];
}

const path = (fn) => { const p = new Path2D(); fn(p); return p; };

// ------------------------------------------------------------------ side view
// body outline (car units, facing right), including wheel arches
function sideBody(bf) {
  const R = 64, ra = CAR.side.axleRear, fa = CAR.side.axleFront;
  const top = boil([
    [-392, -44], [-394, -100], [-386, -110], [-378, -246], [-362, -258], [96, -258], [118, -252],
    [188, -154], [200, -148], [370, -140], [388, -128], [392, -62], [386, -40],
  ], 0.9, bf);
  return path((p) => {
    p.moveTo(...top[0]);
    for (const q of top.slice(1)) p.lineTo(...q);
    p.lineTo(fa + R + 8, -40);
    p.arc(fa, -52, R, 0.19, Math.PI - 0.19, true);
    p.lineTo(ra + R + 8, -40);
    p.arc(ra, -52, R, 0.19, Math.PI - 0.19, true);
    p.lineTo(-392, -44);
    p.closePath();
  });
}

// window openings (car units): [x0, x1 at top, x1 at bottom...] as polygons
const WIN = {
  cargo: [[-364, -236], [-238, -236], [-238, -150], [-368, -150]],
  rearDoor: [[-222, -236], [-52, -236], [-52, -150], [-222, -150]],
  frontDoor: [[-36, -236], [96, -236], [168, -154], [-36, -152]],
};

export function sideGeo() {
  return { win: WIN, seatNear: CAR.side.seatNear, seatFar: CAR.side.seatFar, wheel: [120, -150], belt: CAR.side.belt };
}

function wheel(P, cx, cy, r, roll, cap, bf) {
  const a = roll / r;
  P.fill(circle(cx, cy, r), C.tyre);
  P.fill(circle(cx, cy, r * 0.6), cap ? C.rim : [0.22, 0.5, 0.62]);
  if (cap) {
    P.fill(circle(cx, cy, r * 0.5), [0.05, 0.12, 0.28]);
    for (let i = 0; i < 5; i++) {
      const b = a + (i / 5) * TAU;
      P.fill(circle(cx + Math.cos(b) * r * 0.34, cy + Math.sin(b) * r * 0.34, r * 0.08), C.rim);
    }
  } else {
    // missing hubcap: bare steel wheel with lug nuts
    for (let i = 0; i < 4; i++) {
      const b = a + (i / 4) * TAU;
      P.fill(circle(cx + Math.cos(b) * r * 0.36, cy + Math.sin(b) * r * 0.36, r * 0.1), [0.35, 0.8, 0.9]);
    }
  }
  P.fill(circle(cx, cy, r * 0.13), C.tyre);
  // a tread notch so the roll reads
  P.stroke(line([[cx + Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72], [cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95]]), [0.2, 0.6, 0.7], r * 0.1);
}

export function carSide(P, x, ground, s, o = {}) {
  const { dir = 1, roll = 0, bounce = 0, pitch = 0, bf = 0, lights = 0, tail = 0.5, brake = 0, blink = 0, door = 0, inside = null, sweep = null, wet = 0, plate = 'BED HDS', shadow = true } = o;
  const G = CAR.side;
  P.save();
  P.translate(x, ground);
  P.scale(s * dir, s);
  if (shadow) P.fill(ellipse(-4, 2, 430, 20), [0.2, 0.5, 0.7]);
  // wheels stay on the ground; body rides on the springs
  const wy = -G.wheelR;
  wheel(P, G.axleRear, wy, G.wheelR, roll, false, bf);
  wheel(P, G.axleFront, wy, G.wheelR, roll, true, bf);
  P.save();
  P.translate(0, -bounce);
  P.rotate(pitch);
  const body = sideBody(bf);
  // wheel wells (dark) behind the arches
  for (const ax of [G.axleRear, G.axleFront]) P.fill(circle(ax, wy, 62), [0.3, 0.85, 0.95]);
  wheel(P, G.axleRear, wy + bounce, G.wheelR, roll, false, bf);
  wheel(P, G.axleFront, wy + bounce, G.wheelR, roll, true, bf);
  P.fill(body, C.body);
  // lower body shade band + rocker
  P.save();
  P.clip(body);
  P.fill(rect(-400, -84, 800, 50), C.shade);
  P.fill(rect(-400, -52, 800, 20), C.deep);
  // roof + upper highlight
  P.fill(rect(-400, -262, 800, 10), C.hi);
  P.fill(poly([[-380, -140], [200, -148], [370, -140], [388, -128], [-392, -128]]), C.hi);
  // light sweep from an overhead lamp
  if (sweep && sweep.k > 0) {
    P.glow(sweep.x, -250, 420, [0.55 * sweep.k, 0, 0], 'lighter', 0.1);
    P.glow(sweep.x, -250, 360, [0, 0.35 * sweep.k, 0.55 * sweep.k], 'knock', 0.15);
  }
  P.restore();
  // windows (glass, then whatever is inside, then glare)
  const doorOpen = dir === 1 && door > 0.01;
  for (const [k, pts] of Object.entries(WIN)) {
    if (k === 'frontDoor' && doorOpen) continue;
    P.fill(poly(pts), C.glass);
  }
  if (inside) {
    P.save();
    const clipP = path((p) => {
      for (const [k, pts] of Object.entries(WIN)) {
        if (k === 'frontDoor' && doorOpen) continue;
        pts.forEach((q, i) => (i ? p.lineTo(...q) : p.moveTo(...q)));
        p.closePath();
      }
      if (doorOpen) p.rect(-36, -236, 204, 196);
    });
    if (doorOpen) P.fill(poly([[-36, -236], [96, -236], [168, -154], [168, -40], [-36, -40]]), [0.3, 0.8, 0.95]);
    P.clip(clipP);
    inside(P, sideGeo());
    P.restore();
  } else if (doorOpen) {
    P.fill(poly([[-36, -236], [96, -236], [168, -154], [168, -40], [-36, -40]]), [0.3, 0.8, 0.95]);
  }
  for (const [k, pts] of Object.entries(WIN)) {
    if (k === 'frontDoor' && doorOpen) continue;
    const [a, b] = [pts[0], pts[2]];
    P.save();
    P.clip(poly(pts));
    P.alpha(0.55);
    P.fill(poly([[a[0] + 20, a[1]], [a[0] + 60, a[1]], [a[0] + 10, b[1]], [a[0] - 30, b[1]]]), C.glassHi);
    P.alpha(1);
    if (wet > 0) {
      for (let i = 0; i < 9; i++) {
        const dx = lerp(a[0], b[0], hash(k.length, i, 1)), dy = lerp(a[1], b[1], hash(k.length, i, 2));
        P.fill(ellipse(dx, dy, 3, 5), K.paper);
      }
    }
    P.restore();
  }
  // pillars
  P.fill(rect(-240, -238, 14, 90), C.deep);
  P.fill(rect(-50, -238, 14, 90), C.deep);
  // doors: seams, handles, the pink front door
  if (dir === 1 && !doorOpen) {
    P.fill(poly([[-40, -150], [168, -152], [196, -148], [196, -44], [-40, -44]]), C.pink);
    P.fill(rect(-40, -80, 236, 26), C.pinkShade);
    P.stroke(poly([[-40, -240], [100, -240], [174, -152]], false), C.pink, 10);
  }
  P.stroke(line([[-44, -150], [-44, -44]]), C.deep, 3);
  P.stroke(line([[-226, -150], [-226, -44]]), C.deep, 3);
  P.stroke(line([[198, -148], [198, -44]]), C.deep, 3);
  P.fill(roundRect(-100, -132, 34, 8, 3), C.deep);
  if (dir === 1 && !doorOpen) P.fill(roundRect(96, -132, 34, 8, 3), [0.3, 1, 0.5]);
  else P.fill(roundRect(96, -132, 34, 8, 3), C.deep);
  // beat-up bits: a dent line, a rust spot, a bumper sticker
  P.stroke(curve([[-330, -110], [-300, -104], [-270, -112]], false), C.deep, 3);
  P.fill(ellipse(-150, -58, 18, 8), C.rust);
  P.fill(ellipse(-146, -60, 7, 3), [0.8, 0.7, 0.1]);
  // roof rack
  P.fill(rect(-340, -272, 420, 8), C.trim);
  for (const rx of [-320, -120, 60]) P.fill(rect(rx, -266, 12, 10), C.trim);
  // side mirror
  P.fill(poly([[176, -168], [206, -176], [212, -150], [184, -146]]), C.deep);
  // bumpers
  P.fill(roundRect(-402, -98, 40, 44, 6), C.trim);
  P.fill(roundRect(364, -92, 36, 40, 6), C.trim);
  // lights
  P.fill(rect(378, -126, 12, 26), lights > 0.05 ? C.headOn : C.headOff);
  P.fill(rect(372, -96, 16, 10), blink > 0.2 ? C.amber : [0.4, 0.4, 0.2]);
  const tl = clamp(tail + brake);
  P.fill(rect(-394, -220, 12, 96), tl > 0.05 ? C.tailOn : C.tailOff);
  P.fill(rect(-394, -122, 12, 18), blink > 0.2 ? C.amber : [0.4, 0.4, 0.2]);
  // plate
  if (plate) {
    P.fill(rect(-400, -96, 10, 34), [0, 0.05, 0.1]);
  }
  // glows
  if (lights > 0.02) {
    P.glow(392, -113, 90 * lights, [0, 0.7 * lights, 0.9 * lights], 'knock', 0.3);
    P.glow(392, -113, 50 * lights, [0.9 * lights, 0.05, 0], 'lighter', 0.2);
  }
  if (tl > 0.05) P.glow(-396, -172, 90 * tl, [0.6 * tl, 0.7 * tl, 0], 'lighter', 0.2);
  if (blink > 0.05) {
    P.glow(380, -91, 70 * blink, [0.9 * blink, 0.35 * blink, 0], 'lighter', 0.2);
    P.glow(-390, -113, 70 * blink, [0.9 * blink, 0.35 * blink, 0], 'lighter', 0.2);
  }
  // wet sheen along the roof and hood
  if (wet > 0) {
    for (let i = 0; i < 14; i++) P.fill(circle(-360 + i * 34 + hs(i, 3) * 8, -258 + hs(i, 4) * 3, 3.2), K.paper);
    P.alpha(0.5 * wet).stroke(line([[210, -146], [360, -139]]), K.paper, 4).alpha(1);
  }
  // open door: the pink door swings toward camera around its front hinge
  if (doorOpen) {
    const th = door * 1.15;
    const c = Math.cos(th), grow = 1 + 0.32 * Math.sin(th);
    const hx = 196, fx = hx - 236 * c;
    const edge = (yy) => -95 + (yy + 95) * grow;
    const outer = [[hx, -152], [hx, -44], [fx, edge(-44)], [fx, edge(-152)]];
    const winTop = [[hx - 28, -154], [lerp(hx, fx, 0.45), edge(-240)], [fx, edge(-240)], [fx, edge(-152)]];
    P.fill(poly(winTop), C.pink);
    P.fill(poly([[hx - 30 * c, -156], [lerp(hx, fx, 0.47), edge(-230)], [lerp(hx, fx, 0.93), edge(-230)], [lerp(hx, fx, 0.93), edge(-156)]]), [0.1, 0.5, 0.8]);
    P.fill(poly(outer), C.pink);
    P.fill(poly([[hx, -80], [hx, -54], [fx, edge(-54)], [fx, edge(-80)]]), C.pinkShade);
    P.fill(roundRect(lerp(hx, fx, 0.7) - 8, edge(-132), 30 * c + 6, 8 * grow, 3), [0.3, 1, 0.5]);
    // the door's thickness on its free edge
    P.fill(rect(fx - 8 * grow, edge(-240), 8 * grow, edge(-44) - edge(-240)), C.pinkShade);
  }
  P.restore();
  P.restore();
}

// headlight cones for the side view: from the headlight out ahead of the car
export function carBeams(P, x, ground, s, { dir = 1, k = 1, len = 1400, spread = 0.2, tilt = 0.06, bounce = 0, inks = null } = {}) {
  if (k <= 0) return;
  const hx = x + 392 * s * dir, hy = ground - (113 + bounce) * s;
  const a0 = tilt - spread / 2, a1 = tilt + spread / 2;
  const far = (a) => [hx + Math.cos(a) * len * dir, hy + Math.sin(a) * len];
  const cone = poly([[hx, hy - 10 * s], far(a0), far(a1), [hx, hy + 10 * s]]);
  P.save();
  P.alpha(0.5 * k).fill(cone, inks ?? [0, 0.55, 0.7], 'source-over');
  P.alpha(1);
  P.restore();
  P.alpha(0.35 * k).fill(cone, [0.55, 0, 0], 'lighter').alpha(1);
  P.glow(hx, hy, 160 * s * k, [0, 0.8 * k, 0.9 * k], 'knock', 0.3);
}

// ------------------------------------------------------------------ rear view
export function carRear(P, x, ground, s, o = {}) {
  const { roll = 0, bounce = 0, lean = 0, tail = 0.8, brake = 0, blink = 0, exhaust = 0, inside = null, plate = 'BED HDS', bf = 0, wet = 0, t = 0, shadow = true } = o;
  P.save();
  P.translate(x, ground);
  P.scale(s);
  if (shadow) P.fill(ellipse(0, 4, 250, 22), [0.2, 0.5, 0.7]);
  // tyres
  const tyreBob = (i) => Math.sin(roll / 40 + i) * 1.5;
  P.fill(roundRect(-212, -70 + tyreBob(0), 64, 72, 12), C.tyre);
  P.fill(roundRect(148, -70 + tyreBob(1), 64, 72, 12), C.tyre);
  P.save();
  P.translate(0, -bounce);
  P.rotate(lean);
  const body = curve(boil([[-220, -46], [-222, -150], [-206, -240], [-186, -258], [186, -258], [206, -240], [222, -150], [220, -46]], 1, bf), true, 0.12);
  P.fill(body, C.body);
  P.save();
  P.clip(body);
  P.fill(rect(-230, -150, 460, 106), C.shade);
  P.fill(rect(-230, -262, 460, 10), C.hi);
  // the pink passenger door shows as a sliver on the right
  P.fill(rect(210, -150, 14, 104), C.pink);
  P.restore();
  // rear window + wiper
  const [wx, wy, ww, wh] = CAR.rear.window;
  const win = roundRect(wx, wy, ww, wh, 12);
  P.fill(win, C.glass);
  if (inside) { P.save(); P.clip(win); inside(P, { window: CAR.rear.window }); P.restore(); }
  P.save(); P.clip(win); P.alpha(0.5).fill(poly([[wx + 40, wy], [wx + 90, wy], [wx + 20, wy + wh], [wx - 30, wy + wh]]), C.glassHi).alpha(1); P.restore();
  P.stroke(line([[0, wy + wh - 6], [-120, wy + 30]]), C.tyre, 5);
  // tailgate seam + handle
  P.stroke(line([[-190, -146], [190, -146]]), C.deep, 3);
  P.fill(roundRect(-40, -140, 80, 10, 4), C.deep);
  // tall 240-style tail lights
  const tl = clamp(tail + brake);
  for (const sd of [-1, 1]) {
    const bx = sd * 196;
    P.fill(rect(bx - 16, -228, 32, 120), tl > 0.05 ? C.tailOn : C.tailOff);
    const bl = typeof blink === 'object' ? (blink.side === sd ? blink.k : 0) : blink === sd || blink === 2 ? 1 : 0;
    P.fill(rect(bx - 16, -104, 32, 26), bl > 0.2 ? C.amber : [0.4, 0.45, 0.2]);
    if (tl > 0.05) P.glow(bx, -168, 150 * (0.6 + tl * 0.4), [0.7 * tl, 0.75 * tl, 0], 'lighter', 0.2);
    if (bl > 0.05) P.glow(bx, -92, 110 * bl, [0.9 * bl, 0.35 * bl, 0], 'lighter', 0.2);
  }
  // bumper + plate + sticker
  P.fill(roundRect(-230, -86, 460, 40, 8), C.trim);
  if (plate) {
    P.fill(roundRect(-62, -130, 124, 56, 5), [0.02, 0.02, 0.05]);
    P.stroke(roundRect(-62, -130, 124, 56, 5), C.deep, 3);
    P.text(plate, 0, -88, '30px Anton', K.navy);
  }
  P.fill(roundRect(90, -138, 84, 26, 4), [1, 0.1, 0]);
  P.fill(star(104, -125, 9, 4), [0, 1, 0]);
  P.fill(rect(118, -128, 48, 5), [0, 1, 0]);
  if (wet > 0) for (let i = 0; i < 16; i++) P.fill(ellipse(-200 + hash(i, 1) * 400, -250 + hash(i, 2) * 200, 3, 4), K.paper);
  P.restore();
  // exhaust
  P.fill(rect(-170, -54, 26, 12), C.tyre);
  if (exhaust > 0) {
    for (let i = 0; i < 4; i++) {
      const k = exhaust * (1 - i * 0.2);
      P.glow(-190 - i * 28 + hs(i, t | 0) * 6, -40 - i * 18, (30 + i * 26) * k, [0, 0.35 * k, 0.45 * k], 'knock', 0.4);
    }
  }
  P.restore();
}

// ------------------------------------------------------------------ front view (the hood)
export function carFront(P, x, ground, s, o = {}) {
  const { lights = 0, bounce = 0, inside = null, bf = 0, wet = 0, hoodRefl = null, shadow = true } = o;
  P.save();
  P.translate(x, ground);
  P.scale(s);
  if (shadow) P.fill(ellipse(0, 4, 260, 22), [0.2, 0.5, 0.7]);
  P.fill(roundRect(-216, -70, 62, 72, 12), C.tyre);
  P.fill(roundRect(154, -70, 62, 72, 12), C.tyre);
  P.save();
  P.translate(0, -bounce);
  // cabin + windshield
  const cabin = poly(boil([[-196, -150], [-178, -258], [178, -258], [196, -150]], 1, bf));
  P.fill(cabin, C.body);
  const [wx, wy, ww, wh] = CAR.front.windshield;
  const ws = poly([[wx + 8, wy], [wx + ww - 8, wy], [wx + ww, wy + wh], [wx, wy + wh]]);
  P.fill(ws, C.glass);
  if (inside) { P.save(); P.clip(ws); inside(P, { windshield: CAR.front.windshield }); P.restore(); }
  P.save(); P.clip(ws); P.alpha(0.5).fill(poly([[wx + 60, wy], [wx + 120, wy], [wx + 60, wy + wh], [wx, wy + wh]]), C.glassHi).alpha(1); P.restore();
  // hood (a flat plane you can sit on) and the nose
  const hood = poly(boil([[-206, -152], [206, -152], [226, -120], [-226, -120]], 1, bf));
  P.fill(hood, C.hi);
  if (hoodRefl) { P.save(); P.clip(hood); hoodRefl(P, CAR.front.hood); P.restore(); }
  P.fill(poly([[-226, -120], [226, -120], [224, -46], [-224, -46]]), C.body);
  P.fill(rect(-224, -70, 448, 24), C.shade);
  // the pink passenger door edge shows on the viewer's left
  P.fill(poly([[-196, -150], [-212, -150], [-222, -60], [-206, -60]]), C.pink);
  // grille + square lamps + indicators
  P.fill(roundRect(-92, -112, 184, 46, 5), C.deep);
  for (let i = 0; i < 6; i++) P.fill(rect(-84, -106 + i * 7, 168, 3), C.trim);
  for (const [lx, ly] of CAR.front.lights) {
    P.fill(roundRect(lx - 48, ly - 20, 96, 40, 6), lights > 0.05 ? C.headOn : C.headOff);
    P.fill(rect(lx + (lx < 0 ? -64 : 50), ly - 12, 14, 24), [0.9, 0.4, 0]);
    if (lights > 0.02) {
      P.glow(lx, ly, 200 * lights, [0, 0.75 * lights, 0.9 * lights], 'knock', 0.3);
      P.glow(lx, ly, 110 * lights, [0.9 * lights, 0.05, 0], 'lighter', 0.25);
    }
  }
  P.fill(roundRect(-236, -76, 472, 32, 8), C.trim);
  P.fill(roundRect(-50, -70, 100, 22, 4), [0.02, 0.02, 0.05]);
  // mirrors
  P.fill(roundRect(-240, -196, 34, 24, 5), C.deep);
  P.fill(roundRect(206, -196, 34, 24, 5), C.deep);
  if (wet > 0) for (let i = 0; i < 14; i++) P.fill(ellipse(-190 + hash(i, 5) * 380, -150 + hash(i, 6) * 26, 3, 2.2), K.paper);
  P.restore();
  P.restore();
}
