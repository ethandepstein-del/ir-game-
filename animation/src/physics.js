// Rigid-body simulation of the ball, shared by every world and by the soundtrack.
//
// One ball, one set of material laws: gravity, a soft spring–damper contact (its stiffness and
// damping come from each surface's coefficient of restitution, so squash depth and contact time
// fall out of the impact speed), Coulomb friction coupling spin to slip, quadratic air drag,
// and a damped shape-vibration mode after each contact. Worlds only supply surfaces. Energy is
// only ever added by visible machines (a pencil tap, latched spring launchers) and by gravity
// on the slope of the chrome world. A solver tunes each launcher's spring so the cut impacts
// land on the beat, then everything is recorded at 4800 Hz for lookup by time.

export const PX_PER_M = 700;              // the ball is 24 cm across
export const G = 9.81 * PX_PER_M;         // px/s²
export const R = 84, FLOOR = 830;
const BALL_KG = 0.35;
export const HZ = 4800;
const DT = 1 / HZ;
const TC = 0.018;                         // contact duration of the rubber ball (s), exaggerated ~2× so it reads
const KI = 0.6;                           // moment of inertia factor, I = KI·m·R² (hollow rubber ball)
const DRAG = 0.5 * 1.2 * 0.47 * Math.PI * 0.12 ** 2 / 0.35; // ½ρC_dA/m (1/m)
const JIG_W = 2 * Math.PI * 18, JIG_Z = 0.45, JIG_GAIN = 0.08;

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const MAT = { paperDesk: 0.72, cel: 0.74, plate: 0.55, paper: 0.6, pixel: 0.7, block: 0.5, chrome: 0.9 };

export function contactKC(e, tc = TC) {
  const ln = Math.log(e);
  const z = -ln / Math.sqrt(Math.PI * Math.PI + ln * ln);
  const wn = Math.PI / (tc * Math.sqrt(1 - z * z));
  return { k: wn * wn, c: 2 * z * wn };
}

// ---------------------------------------------------------------- integrator
// Surfaces are lines n·p = d (n points into free space) with an optional extent in x.
// A plate is a surface whose position is a dynamic body (a latched spring launcher).
function step(b, surfaces, env) {
  const { g, r, vEps, drag } = env;
  let fx = g[0], fy = g[1], tq = 0;
  let deepest = 0, dn = null, rate = 0;
  for (const s of surfaces) {
    if (s.x0 !== undefined && (b.x < s.x0 || b.x > s.x1)) continue;
    const d = s.plate ? s.plate.y * s.n[1] : s.d;
    const dist = b.x * s.n[0] + b.y * s.n[1] - d;
    const pen = r - dist;
    if (pen <= 0) { s.touching = false; continue; }
    const rx = -r * s.n[0], ry = -r * s.n[1];
    const svy = s.plate ? s.plate.v : 0;
    const vcx = b.vx - b.w * ry, vcy = b.vy + b.w * rx - svy;
    const vn = vcx * s.n[0] + vcy * s.n[1];
    let Fn = s.k * pen - s.c * vn;
    if (Fn < 0) Fn = 0;
    // Coulomb friction, applied as the impulse that would stop slip, capped at μ·N·dt.
    const vtx = vcx - vn * s.n[0], vty = vcy - vn * s.n[1];
    const vt = Math.hypot(vtx, vty);
    let Ftx = 0, Fty = 0;
    if (vt > 1e-9) {
      const invM = 1 + (r * r) / (KI * r * r);
      const J = Math.min(vt / invM, s.mu * Fn * DT);
      Ftx = (-vtx / vt) * J / DT; Fty = (-vty / vt) * J / DT;
    }
    fx += Fn * s.n[0] + Ftx; fy += Fn * s.n[1] + Fty;
    tq += rx * Fty - ry * Ftx;
    if (s.plate) s.plate.load += Fn;
    if (!s.touching) {
      s.touching = true;
      env.onImpact && env.onImpact(s, -vn, b);
    }
    if (pen > deepest) { deepest = pen; dn = s.n; rate = -vn; }
  }
  const sp = Math.hypot(b.vx, b.vy);
  fx -= drag * sp * b.vx; fy -= drag * sp * b.vy;
  b.vx += fx * DT; b.vy += fy * DT;
  b.w += (tq / (KI * r * r)) * DT;
  b.x += b.vx * DT; b.y += b.vy * DT;
  b.th += b.w * DT;
  // Shape: follows the contact compression exactly, then rings on its own.
  if (dn) {
    b.q = deepest / r; b.qd = rate / r; b.na = Math.atan2(dn[1], dn[0]); b.inContact = true;
  } else {
    if (b.inContact) { b.qd *= JIG_GAIN; b.inContact = false; }
    const qdd = -JIG_W * JIG_W * b.q - 2 * JIG_Z * JIG_W * b.qd;
    b.qd += qdd * DT; b.q += b.qd * DT;
  }
  b.pen = deepest;
}

function stepPlate(p, t) {
  if (!p.released) {
    if (p.triggerAt !== null && t >= p.triggerAt) p.released = true, p.releasedAt = t;
    p.load = 0;
    return;
  }
  if (p.stopped) { p.load = 0; return; }
  // Spring pushes the plate up (−y) while compressed below its stop; the ball pushes it down.
  const a = (-p.k * (p.y - p.yStop) + BALL_KG * p.load) / p.m + G;   // load is the ball's acceleration
  p.v += a * DT; p.y += p.v * DT;
  if (p.y > p.yCock) { p.y = p.yCock; if (p.v > 0) p.v = 0; } // the housing supports it from below
  if (p.y <= p.yStop && p.v < 0) { p.y = p.yStop; p.stopV = p.v; p.v = 0; p.stopped = true; p.stoppedAt = t; }
  p.load = 0;
}

function makePlate(x, k) {
  const yCock = FLOOR - 14, stroke = 110;
  return { x, k, m: 0.45, y: yCock, v: 0, yCock, yStop: yCock - stroke, released: false, triggerAt: null, stopped: false, load: 0 };
}
function plateSurface(p, e) {
  const { k, c } = contactKC(e);
  return { n: [0, -1], plate: p, x0: p.x - 78, x1: p.x + 78, k, c, mu: 0.6, id: 'plate', e };
}
function floorSurface(e, id) {
  const { k, c } = contactKC(e);
  return { n: [0, -1], d: -FLOOR, k, c, mu: 0.55, id, e };
}
function ceilSurface(yb, x0, x1, e) {
  const { k, c } = contactKC(e);
  return { n: [0, 1], d: yb, x0, x1, k, c, mu: 0.5, id: 'block', e };
}

// ---------------------------------------------------------------- 2D course
export const X0 = 560;          // where the pencil draws the ball
export const Y0 = 150;
const TAP = { vx: 720, vy: 140 };
const env2D = { g: [0, G], r: R, drag: DRAG / PX_PER_M };

function freshBall() {
  return { x: X0, y: Y0, vx: 0, vy: 0, w: 0, th: 0, q: 0, qd: 0, na: -Math.PI / 2, inContact: false, pen: 0 };
}

const clone = (o) => JSON.parse(JSON.stringify(o));

// Bracket the target on a log-spaced scan (the last crossing wins), then bisect inside it.
function solve(f, lo, hi, target, { steps = 48, last = true } = {}) {
  let prevX = null, prevF = null, bracket = null;
  for (let i = 0; i <= steps; i++) {
    const x = lo * (hi / lo) ** (i / steps);
    const fx = f(x) - target;
    if (prevF !== null && (fx > 0) !== (prevF > 0)) {
      bracket = [prevX, x, prevF];
      if (!last) break;
    }
    prevX = x; prevF = fx;
  }
  if (!bracket) throw new Error('physics solver: target not reachable');
  let [a, b, fa] = bracket;
  for (let i = 0; i < 40; i++) {
    const m = 0.5 * (a + b), fm = f(m) - target;
    if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else b = m;
  }
  return 0.5 * (a + b);
}

// Targets on the 160 bpm grid (beat k at 0.5 + 0.375k).
const bt = (k) => 0.5 + 0.375 * k;
export const TARGETS = { cut1: 2.0, celLand: bt(6), paperLand: bt(10), pixelLand: bt(12.75) };

function solveCourse() {
  const at = (spec, stopAt) => simulate({ ...spec, stopAt });
  // Pencil tap time, so the ball's third contact (on the cel launcher) lands on the downbeat.
  const tRelease = solve((tr) => at({ tRelease: tr }, 'cut1').stopT, 0.35, 1.2, TARGETS.cut1, { last: false });
  // Cel launcher spring, so the first landing after the launch falls on beat 6.
  let p = { tRelease };
  p.kCel = solve((k) => at({ ...p, kCel: k }, 'celLand').stopT, 100, 20000, TARGETS.celLand, { last: false });
  p.plate2x = at(p, 'cel2').stopX;
  p.kPaper = solve((k) => at({ ...p, kPaper: k }, 'paperLand').stopT, 100, 20000, TARGETS.paperLand, { last: false });
  p.pixelX = at(p, 'paper2').stopX;
  // Pixel spring block: stay on the branch with exactly one clean headbutt of the bonus block.
  p.kPixel = solve((k) => at({ ...p, kPixel: k }, 'pixelLand').stopT, 380, 560, TARGETS.pixelLand, { last: false });
  return p;
}

// Full deterministic run of the 2D course for a given set of solved parameters.
// With `stopAt` it halts early (used by the solver); otherwise it records everything.
function simulate(p, record = false) {
  const b = freshBall(); b.vx = TAP.vx; b.vy = TAP.vy;
  const floors = {
    pencil: floorSurface(MAT.paperDesk, 'pencil'), cel: floorSurface(MAT.cel, 'cel'),
    paper: floorSurface(MAT.paper, 'paper'), pixel: floorSurface(MAT.pixel, 'pixel'),
  };
  const events = [];
  const N = Math.ceil(7.5 * HZ);
  const rec = record ? { t0: p.tRelease, n: 0, data: new Float32Array(N * 9), plates: [] } : null;
  const push = (t, bb, plates) => {
    if (!rec || rec.n >= N) return;
    const o = rec.n * 9;
    rec.data.set([bb.x, bb.y, bb.vx, bb.vy, bb.th, bb.w, bb.q, bb.na, bb.pen], o);
    plates.forEach((pl, i) => { (rec.plates[i] ||= new Float32Array(N))[rec.n] = pl.y; });
    rec.n++;
  };
  // Stage machine
  let stage = 'pencil', stopT = null, stopX = null, cuts = [];
  const plates = [];
  let surfaces;
  const P1 = makePlate(0, p.kCel ?? 800);
  // Stage 1 needs the cel plate position: probe with the pencil floor only.
  {
    const bb = freshBall(); bb.vx = TAP.vx; bb.vy = TAP.vy;
    let n = 0, tt = p.tRelease;
    const e = { ...env2D, onImpact: () => { n++; } };
    const fl = [floorSurface(MAT.paperDesk, 'pencil')];
    while (n < 3 && tt < p.tRelease + 4) { step(bb, fl, e); tt += DT; }
    P1.x = bb.x;
  }
  const P2 = makePlate(p.plate2x ?? 0, p.kPaper ?? 800);
  const P3 = makePlate(p.pixelX ?? 0, p.kPixel ?? 800);
  const blockX = (p.pixelX ?? 0) + 110, blockY = FLOOR - 560;
  const block = ceilSurface(blockY, blockX - 154, blockX + 154, MAT.block);
  let t = p.tRelease;
  const allPlates = [P1, P2, P3];
  let counts = {};
  const env = { ...env2D, onImpact: (s, speed, bb) => {
    const ev = { t, surface: s.id, speed, x: bb.x, y: bb.y, stage };
    events.push(ev);
    counts[s.id] = (counts[s.id] || 0) + 1;
    if (s.plate && s.plate.triggerAt === null) s.plate.triggerAt = t + 0.006;
  } };
  // Plate surfaces are built once and shared across stages, so a stage change mid-contact
  // does not fire the same impact twice.
  let S1 = null, S2 = null, S3 = null;
  const setStage = (st) => {
    stage = st;
    S1 ||= plateSurface(P1, MAT.plate); S2 ||= plateSurface(P2, MAT.plate); S3 ||= plateSurface(P3, MAT.plate);
    if (st === 'pencil') surfaces = [floors.pencil, S1];
    if (st === 'cel') surfaces = [floors.cel, S1, S2];
    if (st === 'paper') surfaces = [floors.paper, S2, S3];
    if (st === 'pixel') surfaces = [floors.pixel, S3, block];
    counts = {};
  };
  setStage('pencil');
  const tEnd = 7.2;
  while (t < tEnd) {
    for (const pl of allPlates) stepPlate(pl, t);
    const nBefore = events.length;
    step(b, surfaces, env);
    t += DT;
    push(t, b, allPlates);
    if (events.length > nBefore) {
      const ev = events[events.length - 1];
      // Cuts happen on the contact that starts the next world.
      if (stage === 'pencil' && ev.surface === 'plate') { cuts.push(ev.t); ev.cut = 'cel'; setStage('cel'); }
      else if (stage === 'cel' && ev.surface === 'plate' && ev.x > P1.x + 200) { cuts.push(ev.t); ev.cut = 'paper'; setStage('paper'); }
      else if (stage === 'paper' && ev.surface === 'plate' && ev.x > P2.x + 200) { cuts.push(ev.t); ev.cut = 'pixel'; setStage('pixel'); }
      else if (stage === 'pixel' && ev.surface === 'pixel' && counts.pixel === 2) { cuts.push(ev.t); ev.cut = 'chrome'; stopT = ev.t; stopX = ev.x; if (!record) break; if (record) { rec.chromeEntry = { t: ev.t, ...clone(b) }; break; } }
      if (p.stopAt === 'cut1' && ev.cut === 'cel') { stopT = ev.t; stopX = ev.x; break; }
      if (p.stopAt === 'celLand' && ev.surface === 'cel') { stopT = ev.t; stopX = ev.x; break; }
      if (p.stopAt === 'cel2' && ev.surface === 'cel' && counts.cel === 2) { stopT = ev.t; stopX = ev.x; break; }
      if (p.stopAt === 'paperLand' && ev.surface === 'paper') { stopT = ev.t; stopX = ev.x; break; }
      if (p.stopAt === 'paper2' && ev.surface === 'paper' && counts.paper === 2) { stopT = ev.t; stopX = ev.x; break; }
      if (p.stopAt === 'pixelLand' && ev.surface === 'pixel') { stopT = ev.t; stopX = ev.x; break; }
    }
    // If the ball never reaches the next landing, report a late time so the solver backs off.
    if (p.stopAt && t > tEnd - DT) { stopT = 99; break; }
  }
  return { events, cuts, stopT, stopX, rec, plates: { P1, P2, P3 }, block: { x: blockX, y: blockY, hw: 154 } };
}

// ---------------------------------------------------------------- 3D chrome slope
// Motion stays in the x–y plane (y up), units of ball radii. The floor descends toward +x at
// SLOPE, so gravity feeds the ball speed while restitution bleeds its bounce height: the bounces
// shorten and quicken toward the camera, which is placed exactly where the ball will be.
export const SLOPE = (4.5 * Math.PI) / 180;
export const G3 = G / R;
function simulateChrome(entry, t0, tEnd) {
  const n = [Math.sin(SLOPE), Math.cos(SLOPE)];
  const { k, c } = contactKC(MAT.chrome, 0.004);   // steel on stone: a stiff, near-instant contact
  const floor = { n, d: 0, k, c, mu: 0.25, id: 'chrome', e: MAT.chrome };
  const b = {
    x: n[0], y: n[1], vx: entry.vx / R, vy: -entry.vy / R, w: -entry.w, th: 0,
    q: 0, qd: 0, na: Math.atan2(n[1], n[0]), inContact: false, pen: 0,
  };
  const events = [];
  let t = t0;
  const env = { g: [0, -G3], r: 1, drag: DRAG * R / PX_PER_M, onImpact: (s, speed, bb) => events.push({ t, surface: 'chrome', speed: speed * R, x: bb.x, y: bb.y }) };
  const N = Math.ceil((tEnd - t0) * HZ) + 2;
  const data = new Float32Array(N * 9);
  let i = 0;
  data.set([b.x, b.y, b.vx, b.vy, b.th, b.w, b.q, b.na, b.pen], 0); i++;
  while (t < tEnd && i < N) {
    step(b, [floor], env);
    t += DT;
    data.set([b.x, b.y, b.vx, b.vy, b.th, b.w, b.q, b.na, b.pen], i * 9); i++;
  }
  return { t0, n: i, data, events, normal: n };
}

// ---------------------------------------------------------------- solve once, then look up
let PHYS = null;
export function physics() {
  if (PHYS) return PHYS;
  const params = solveCourse();
  const run = simulate(params, true);
  const entry = run.rec.chromeEntry;
  const chrome = simulateChrome(entry, entry.t, 10.2);
  PHYS = { params, run, chrome, cuts: run.cuts, events: run.events.concat(chrome.events) };
  return PHYS;
}

function sample(rec, t, base, n) {
  const f = clamp((t - base) * HZ - 1, 0, n - 1.001);
  const i = Math.floor(f), a = f - i;
  const o0 = i * 9, o1 = (i + 1) * 9, d = rec;
  const out = new Array(9);
  for (let k = 0; k < 9; k++) out[k] = d[o0 + k] + (d[o1 + k] - d[o0 + k]) * a;
  return out;
}

// Ball state for drawing in 2D. Shape: squashed along the contact normal while touching, then
// ringing; `along`/`across` are the ellipse radii (×R) along the tangent and the normal.
export function ball2D(t) {
  const P = physics();
  const { rec } = P.run;
  let x, y, vx, vy, th, w, q, na, pen;
  if (t < P.params.tRelease) {
    x = X0; y = Y0; vx = vy = th = w = q = pen = 0; na = -Math.PI / 2;
  } else {
    [x, y, vx, vy, th, w, q, na, pen] = sample(rec.data, t, rec.t0, rec.n);
  }
  const squash = pen > 0 ? Math.max(0, q) : 0;
  const across = clamp(1 - (pen > 0 ? q : q * 0.5) * 0.55, 0.45, 1.3);
  const along = 1 / Math.sqrt(across);
  // While in contact, keep the flattened side on the surface.
  const nx = Math.cos(na), ny = Math.sin(na);
  const shift = pen > 0 ? R * (1 - across) - pen : 0;
  const dx = x - nx * shift, dy = y - ny * shift;
  return {
    x: dx, y: dy, cx: x, cy: y, vx, vy, spin: th, w, squash, q, na,
    along, across, angle: na + Math.PI / 2, h: FLOOR - R - y, pen,
  };
}

export function ballChrome(tt) {
  const P = physics();
  const c = P.chrome;
  const [x, y, vx, vy, th, w, q, na, pen] = sample(c.data, tt, c.t0 - 1 / HZ, c.n);
  return { x, y, vx, vy, th, w, q, na, pen };
}

export function plateY(i, t) {
  const P = physics();
  const { rec } = P.run;
  const arr = rec.plates[i];
  const p = [P.run.plates.P1, P.run.plates.P2, P.run.plates.P3][i];
  if (t < rec.t0) return p.yCock;
  const f = clamp((t - rec.t0) * HZ - 1, 0, rec.n - 1.001);
  const k = Math.floor(f);
  return arr[k] + (arr[k + 1] - arr[k]) * (f - k);
}
