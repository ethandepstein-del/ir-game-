// World 5: 3D chrome. An analytic ray tracer in a WebGL2 fragment shader. The ball is an engraved
// steel boule (true squash along the contact normal, grooves that show its spin) driven by the
// same physics as every other world. The floor is a glossy lacquer slope: gravity speeds the ball
// up while restitution bleeds its bounces, so the rhythm quickens toward the camera, which has
// been placed exactly where the ball will be. It hits the lens.
import { W, H, T, clamp, lerp, invLerp, ease, rng, smooth, shake, TAU, noise1, physics } from '../core.js';
import { ballChrome, SLOPE } from '../physics.js';
import { makeCanvas, bloom, vignette, grain } from '../fx.js';

const N = [Math.sin(SLOPE), Math.cos(SLOPE), 0];      // floor normal (plane through the origin)
const TD = [Math.cos(SLOPE), -Math.sin(SLOPE), 0];    // downhill direction along the floor

// ---------------------------------------------------------------- time remap (speed ramp)
// Real time runs 1:1 until RAMP0, then eases into slow motion (0.2×) for the lens hit at 9.5 s.
// RAMP0 is solved so the physics time at 9.5 s is exactly the moment of contact with the lens.
let RAMP0 = 9.1, T_HIT = 9.3;
function rampInt(r0, t) {
  if (t <= r0) return t;
  const n = 48, dt = (t - r0) / n;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const u = r0 + (i + 0.5) * dt;
    acc += (1 - 0.8 * smooth(clamp((u - r0) / 0.3))) * dt;
  }
  return r0 + acc;
}
export const tau = (t) => rampInt(RAMP0, t);

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
const vlerp = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

// Ball state in 3D, plus the inverse shape matrix for the shader (squash along the contact normal).
export function ball3D(tt) {
  const b = ballChrome(tt);
  const q = b.q;
  const k = clamp(1 - q * 0.55, 0.5, 1.25);   // axis scale along the normal
  const perp = 1 / Math.sqrt(k);
  const ax = [Math.cos(b.na), Math.sin(b.na), 0];
  const minv = [];
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) minv.push((r === c ? 1 / perp : 0) + (1 / k - 1 / perp) * ax[r] * ax[c]);
  // Keep the flattened side on the floor while in contact.
  const shift = b.pen > 0 ? (1 - k) - b.pen : 0;
  const p = [b.x - ax[0] * shift, b.y - ax[1] * shift, 0];
  return { p, c: [b.x, b.y, 0], v: [b.vx, b.vy, 0], minv, th: b.th, pen: b.pen };
}

// Final camera: on the ball's path, a hair beyond its surface, looking back up the slope.
let FINAL = null;
function finalCam() {
  if (FINAL) return FINAL;
  const b = ball3D(T_HIT);
  const dir = norm(b.v);
  const pos = add(b.c, mul(dir, 1.04));
  FINAL = { pos, look: mul(dir, -1) };
  return FINAL;
}

function solveRamp() {
  const P = physics();
  const ev = P.chrome.events;
  // Hit the lens during a hop late in the run (the ball is skipping fast by then).
  const late = ev.filter((e) => e.t > 9.1 && e.t < 9.4);
  const e0 = late.length ? late[0] : ev[ev.length - 1];
  const e1 = ev.find((e) => e.t > e0.t + 1e-3);
  T_HIT = e1 ? e0.t + (e1.t - e0.t) * 0.5 : e0.t + 0.05;
  let lo = 8.6, hi = 9.49;
  for (let i = 0; i < 40; i++) {
    const m = 0.5 * (lo + hi);
    if (rampInt(m, T.SHATTER) > T_HIT) hi = m; else lo = m;
  }
  RAMP0 = 0.5 * (lo + hi);
  FINAL = null;
}

export function camera3D(t, tt) {
  const b = ball3D(Math.min(tt, T_HIT));
  const t0 = T.CHROME;
  // Orbit: from the 2D side view (az 0, rolled to the slope) around to face the ball.
  const u = ease.inOutCubic(clamp((tt - t0) / 1.6));
  const az = lerp(0, 1.15, u), dist = lerp(15, 8.5, u), hgt = lerp(2.6, 1.6, u);
  const orbitTarget = add(b.c, [lerp(0, 1.2, u), lerp(1.0, 0.4, u), 0]);
  const orbitPos = add(b.c, [dist * Math.sin(az), hgt, dist * Math.cos(az)]);
  const F = finalCam();
  const w = smooth(clamp((tt - (t0 + 1.3)) / 1.4));
  const pos = vlerp(orbitPos, F.pos, w);
  const target = vlerp(orbitTarget, add(F.pos, mul(F.look, 6)), w);
  const sk = shake(t, 1);
  const p2 = [pos[0] + sk.x * 0.003 * (1 - w * 0.8), pos[1] + sk.y * 0.003 * (1 - w * 0.8), pos[2]];
  const f = norm(sub(target, p2));
  let r = norm(cross(f, [0, 1, 0]));
  let up = cross(r, f);
  const roll = lerp(-SLOPE, 0, u) + sk.rot * 2;
  const cr = Math.cos(roll), sr = Math.sin(roll);
  [r, up] = [add(mul(r, cr), mul(up, sr)), sub(mul(up, cr), mul(r, sr))];
  const fov = lerp(34, 46, w);
  return { pos: p2, f, r, u: up, tanHalf: Math.tan((fov * Math.PI) / 360) };
}
export function project(cam, p) {
  const v = sub(p, cam.pos);
  const z = dot(v, cam.f);
  if (z < 0.05) return null;
  return { x: W / 2 + (dot(v, cam.r) / z / cam.tanHalf) * (H / 2), y: H / 2 - (dot(v, cam.u) / z / cam.tanHalf) * (H / 2), z };
}

// ---------------------------------------------------------------- shader
const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 uRes;
uniform vec3 uCamPos, uCamR, uCamU, uCamF;
uniform float uTan;
uniform vec3 uBallC;
uniform mat3 uMinv;
uniform float uBallOn, uCrack, uDim, uTime, uFlash, uSpin;
uniform vec3 uN, uTD;
uniform vec4 uRings[4];

vec3 rectLight(vec3 d, vec3 C, vec2 hs, float soft) {
  float c = dot(d, C);
  if (c <= 0.0) return vec3(0.0);
  vec3 U = normalize(cross(abs(C.y) > 0.95 ? vec3(0,0,1) : vec3(0,1,0), C));
  vec3 V = cross(C, U);
  vec2 q = vec2(dot(d, U), dot(d, V)) / c;
  vec2 e = smoothstep(hs + soft, hs - soft, abs(q));
  return vec3(e.x * e.y);
}
vec3 env(vec3 d, float lights) {
  float y = d.y;
  // Night studio: warm graphite dark, a low tungsten glow at the horizon, a faint cool fill.
  vec3 col = mix(vec3(0.020, 0.016, 0.013), vec3(0.004, 0.004, 0.005), clamp(y * 1.6, 0.0, 1.0));
  col += vec3(1.0, 0.55, 0.25) * 0.16 * exp(-abs(y) * 9.0);
  col += vec3(0.30, 0.42, 0.60) * 0.05 * exp(-abs(y) * 4.0) * (0.5 - 0.5 * d.x);
  if (lights <= 0.0) return col * uDim;
  // Studio lights, seen only in reflections: a big warm key, a soft fill, a cool rim strip, and a
  // long low bar that gives the boule its horizon line.
  vec3 li = vec3(0.10, 0.09, 0.08) * smoothstep(0.0, 0.8, y);
  li += vec3(1.0, 0.90, 0.78) * 8.0 * rectLight(d, normalize(vec3(-0.25, 1.0, 0.45)), vec2(0.62, 0.30), 0.08);
  li += vec3(1.0, 0.86, 0.70) * 1.6 * rectLight(d, normalize(vec3(0.5, 0.8, -0.6)), vec2(0.3, 0.3), 0.1);
  li += vec3(0.55, 0.75, 1.0) * 4.0 * rectLight(d, normalize(vec3(-0.9, 0.3, -0.35)), vec2(0.03, 0.8), 0.015);
  li += vec3(1.0, 0.78, 0.55) * 1.3 * rectLight(d, normalize(vec3(0.15, 0.06, 1.0)), vec2(0.9, 0.025), 0.02);
  return (col + li * lights) * uDim;
}
float hitBall(vec3 ro, vec3 rd, out vec3 n) {
  vec3 o = uMinv * (ro - uBallC), d = uMinv * rd;
  float a = dot(d, d), b = dot(o, d), c = dot(o, o) - 1.0;
  float h = b * b - a * c;
  if (h < 0.0) return -1.0;
  float t = (-b - sqrt(h)) / a;
  if (t < 0.001) return -1.0;
  n = normalize(uMinv * (o + d * t));
  return t;
}
float gridLine(vec2 g, float w, float aa) {
  vec2 d = abs(fract(g + 0.5) - 0.5);
  float m = min(d.x, d.y);
  return 1.0 - smoothstep(w, w + aa, m);
}
// Floor without reflections (grid, AO, rings): used directly and inside reflections.
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
const float SPACING = 7.0, PZ = 6.5, PW = 0.45, PH = 8.0;
vec3 floorBase(vec3 p, float dist) {
  vec2 fp = vec2(dot(p, uTD), p.z);
  vec2 tile = floor(fp / 3.5);
  // Polished black stone: each slab a slightly different tone, thin dark seams between them.
  vec3 col = vec3(0.0075, 0.0068, 0.0062) * (0.8 + 0.4 * h21(tile)) * uDim;
  float aa = 0.0012 * dist + 0.004;
  float seam = gridLine(fp / 3.5, 0.004, aa * 0.3);
  col *= 1.0 - 0.7 * seam;
  // Warm pools of light thrown on the floor by the fins' strips.
  float pool = 0.0;
  float si = floor(fp.x / SPACING + 0.5);
  for (int k = -1; k <= 1; k++) {
    float sc = (si + float(k)) * SPACING;
    vec2 a = vec2(sc, -PZ + PW + 0.05), b = vec2(sc, PZ - PW - 0.05);
    pool += exp(-dot(fp - a, fp - a) * 0.35);
    if (sc >= 20.0) pool += exp(-dot(fp - b, fp - b) * 0.35);
  }
  col += vec3(1.0, 0.62, 0.32) * 0.05 * pool * uDim;
  // Contact shadow / AO under the ball
  if (uBallOn > 0.5) {
    float hgt = max(dot(uBallC, uN) - 1.0, 0.0);
    vec3 dd = p - uBallC;
    vec2 dxz = vec2(dot(dd, uTD), dd.z);
    float ao = exp(-dot(dxz, dxz) / (0.9 + hgt * 0.8)) / (1.0 + hgt * 0.5);
    col *= 1.0 - 0.9 * ao;
  }
  for (int i = 0; i < 4; i++) {
    vec4 r = uRings[i];
    if (r.w < 0.0 || r.w > 1.2) continue;
    float age = r.w;
    float rr = length(p - r.xyz);
    float rad = 0.9 + 11.0 * pow(age, 0.6);
    float w = 0.10 + age * 0.5;
    float ring = exp(-pow((rr - rad) / w, 2.0)) * exp(-age * 3.2);
    col += vec3(1.0, 0.78, 0.55) * ring * 0.38;
    col += vec3(1.0, 0.8, 0.6) * exp(-rr * rr * 2.5) * exp(-age * 18.0) * 0.8;
  }
  return col;
}
float cell(vec3 q, out float f2) {
  vec3 i = floor(q), f = fract(q);
  float f1 = 9.0; f2 = 9.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 o = vec3(x, y, z);
    vec3 h = fract(sin(vec3(dot(i + o, vec3(127.1, 311.7, 74.7)), dot(i + o, vec3(269.5, 183.3, 246.1)), dot(i + o, vec3(113.5, 271.9, 124.6)))) * 43758.5453);
    float d = length(o + h - f);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return f1;
}
// Colonnade along the slope: black glass fins with tungsten light strips on their inner faces.
// Boxes live in the slope frame (s downhill, h above the floor, z across).
float hitPillars(vec3 ro, vec3 rd, out vec3 nrm, out vec3 info) {
  vec3 o = vec3(dot(ro, uTD), dot(ro, uN), ro.z), d = vec3(dot(rd, uTD), dot(rd, uN), rd.z);
  float best = 1e9;
  for (int side = 0; side < 2; side++) {
    float zc = side == 0 ? -PZ : PZ;
    for (int i = -2; i < 13; i++) {
      float sc = float(i) * SPACING;
      if (side == 1 && sc < 20.0) continue;
      vec3 lo = vec3(sc - PW, 0.0, zc - PW), hi = vec3(sc + PW, PH, zc + PW);
      vec3 inv = 1.0 / d;
      vec3 t0 = (lo - o) * inv, t1 = (hi - o) * inv;
      vec3 tmin = min(t0, t1), tmax = max(t0, t1);
      float tn = max(max(tmin.x, tmin.y), tmin.z), tf = min(min(tmax.x, tmax.y), tmax.z);
      if (tn < tf && tn > 0.001 && tn < best) {
        best = tn;
        vec3 ln = tn == tmin.x ? vec3(-sign(d.x), 0, 0) : tn == tmin.y ? vec3(0, -sign(d.y), 0) : vec3(0, 0, -sign(d.z));
        nrm = ln.x * uTD + ln.y * uN + vec3(0, 0, ln.z);
        vec3 lp = o + d * tn;
        info = vec3(lp.x - sc, lp.y, float(i) + (side == 0 ? 0.0 : 0.5));
        if (ln.z != 0.0) info.x = 99.0 + (lp.x - sc);
      }
    }
  }
  return best < 1e8 ? best : -1.0;
}
vec3 pillarShade(vec3 p, vec3 n, vec3 rd, vec3 info) {
  vec3 rr = reflect(rd, n);
  float fres = 0.04 + 0.96 * pow(1.0 - abs(dot(rd, n)), 5.0);
  vec3 col = vec3(0.006, 0.006, 0.007) * uDim + env(rr, 0.5) * mix(0.05, 0.7, fres);
  // A thin warm strip runs up each inner face, fading out toward the top.
  bool face = info.x > 50.0;
  float u = face ? info.x - 99.0 : info.x;
  float strip = (1.0 - smoothstep(0.025, 0.06, abs(u))) * (face ? 1.0 : 0.0);
  float falloff = 0.55 + 0.45 * smoothstep(PH, 0.0, info.y);
  col += vec3(1.0, 0.72, 0.45) * strip * 3.4 * falloff * uDim;
  return col;
}
vec3 ballShade(vec3 p, vec3 n, vec3 rd) {
  vec3 rr = reflect(rd, n);
  vec3 refl;
  float dn = dot(rr, uN);
  vec3 pn, pinfo;
  float tpil = hitPillars(p, rr, pn, pinfo);
  float tfl = dn < 0.0 ? -dot(p, uN) / dn : 1e9;
  if (tpil > 0.0 && tpil < tfl) {
    refl = pillarShade(p + rr * tpil, pn, rr, pinfo);
  } else if (dn < 0.0) {
    float tf = -dot(p, uN) / dn;
    vec3 fp = p + rr * tf;
    vec3 fr = reflect(rr, uN);
    float fres = 0.04 + 0.96 * pow(1.0 - abs(dn), 5.0);
    refl = floorBase(fp, tf + 6.0) + env(fr, 1.0) * fres * 0.6;
  } else refl = env(rr, 1.0);
  float cosT = clamp(dot(-rd, n), 0.0, 1.0);
  vec3 F0 = vec3(0.90, 0.87, 0.82);
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - cosT, 5.0);
  vec3 col = refl * F;
  // Engraved grooves of a steel boule, in the ball's own (spinning) frame.
  vec3 q = normalize(uMinv * (p - uBallC));
  float cs = cos(-uSpin), sn = sin(-uSpin);
  vec3 qs = vec3(q.x * cs - q.y * sn, q.x * sn + q.y * cs, q.z);
  float gd = min(min(abs(qs.x), abs(qs.y)), abs(abs(qs.z) - 0.55));
  float groove = 1.0 - smoothstep(0.012, 0.03, gd);
  float lip = (1.0 - smoothstep(0.03, 0.045, gd)) - groove;
  col = col * (1.0 - 0.78 * groove) + refl * 0.25 * lip;
  if (uCrack > 0.0) {
    vec3 q = normalize(uMinv * (p - uBallC)) * 3.2;
    float f2; float f1 = cell(q, f2);
    float e = f2 - f1;
    float w = 0.012 + 0.045 * uCrack;
    float line = 1.0 - smoothstep(0.0, w, e);
    col *= 1.0 - 0.6 * line * uCrack;
    col += (vec3(1.0, 0.55, 0.2) * 6.0 + vec3(1.0) * 10.0 * (1.0 - smoothstep(0.0, w * 0.35, e))) * line * uCrack * uCrack;
  }
  return col;
}
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);
  vec3 rd = normalize(uCamF + uCamR * uv.x * uTan + uCamU * uv.y * uTan);
  vec3 ro = uCamPos;
  vec3 n;
  float tb = uBallOn > 0.5 ? hitBall(ro, rd, n) : -1.0;
  float den = dot(rd, uN);
  float tf = den < 0.0 ? -dot(ro, uN) / den : -1.0;
  vec3 col;
  vec3 pn, pinfo;
  float tp = hitPillars(ro, rd, pn, pinfo);
  float tbig = 1e9;
  float tbb = tb > 0.0 ? tb : tbig, tff = tf > 0.0 ? tf : tbig, tpp = tp > 0.0 ? tp : tbig;
  if (tpp < tbb && tpp < tff) {
    col = pillarShade(ro + rd * tp, pn, rd, pinfo);
  } else if (tb > 0.0 && (tf < 0.0 || tb < tf)) {
    col = ballShade(ro + rd * tb, n, rd);
  } else if (tf > 0.0) {
    vec3 p = ro + rd * tf;
    col = floorBase(p, tf);
    vec3 rr = reflect(rd, uN);
    float fres = 0.04 + 0.96 * pow(1.0 - abs(den), 5.0);
    vec3 refl;
    vec3 n2;
    float tb2 = uBallOn > 0.5 ? hitBall(p, rr, n2) : -1.0;
    vec3 pn2, pinfo2;
    float tp2 = hitPillars(p, rr, pn2, pinfo2);
    // Glossy, not mirror: reflections of nearby things stay crisp, distant ones fade out.
    if (tp2 > 0.0 && (tb2 < 0.0 || tp2 < tb2)) refl = pillarShade(p + rr * tp2, pn2, rr, pinfo2) * exp(-tp2 * 0.09);
    else if (tb2 > 0.0) refl = ballShade(p + rr * tb2, n2, rr) * 0.85 * exp(-tb2 * 0.05);
    else refl = env(rr, 0.12);
    refl *= 0.85 + 0.3 * h21(floor(vec2(dot(p, uTD), p.z) / 3.5) + 7.0);
    col += refl * mix(0.25, 1.0, fres) * 0.45;
    col = mix(col, env(normalize(vec3(rd.x, 0.02, rd.z)), 0.0) * 0.6, 1.0 - exp(-tf * 0.012));
  } else {
    col = env(rd, 0.0);
  }
  // Atmosphere: haze with soft halos around the fins' light strips.
  float tHit = min(min(tbb, tff), tpp);
  if (tHit > 1e8) tHit = 200.0;
  vec3 o2 = vec3(dot(ro, uTD), dot(ro, uN), ro.z), d2 = vec3(dot(rd, uTD), dot(rd, uN), rd.z);
  vec3 glow = vec3(0.0);
  float dxz2 = max(1e-4, d2.x * d2.x + d2.z * d2.z);
  for (int side = 0; side < 2; side++) {
    float zs = side == 0 ? -PZ + PW : PZ - PW;
    for (int i = -2; i < 13; i++) {
      float sc = float(i) * SPACING;
      if (side == 1 && sc < 20.0) continue;
      float ts = ((sc - o2.x) * d2.x + (zs - o2.z) * d2.z) / dxz2;
      if (ts <= 0.0 || ts > tHit) continue;
      vec2 q = vec2(o2.x + d2.x * ts - sc, o2.z + d2.z * ts - zs);
      float h = o2.y + d2.y * ts;
      float inside = smoothstep(-0.5, 0.3, h) * smoothstep(PH + 0.5, PH - 1.5, h);
      glow += vec3(1.0, 0.66, 0.38) * exp(-dot(q, q) * 1.6) * inside / (1.0 + ts * 0.06);
    }
  }
  col += glow * 0.06 * uDim;
  col = mix(col, vec3(0.012, 0.009, 0.007) * uDim, 1.0 - exp(-tHit * 0.009));
  col += vec3(1.0, 0.9, 0.8) * uFlash;
  col = aces(col * 1.18);
  col = pow(col, vec3(1.0 / 2.2));
  // Split-tone grade: cool, slightly lifted shadows; warm highlights.
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col * vec3(0.93, 1.0, 1.07) + vec3(0.004, 0.008, 0.012), col * vec3(1.05, 1.0, 0.9), smoothstep(0.08, 0.65, lum));
  col = clamp((col - 0.5) * 1.08 + 0.5, 0.0, 1.0);
  frag = vec4(col, 1.0);
}`;

let gl, glc, prog, U = {};
function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function initGL() {
  glc = makeCanvas(W, H);
  gl = glc.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
  prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  for (const n of ['uRes', 'uCamPos', 'uCamR', 'uCamU', 'uCamF', 'uTan', 'uBallC', 'uMinv', 'uBallOn', 'uCrack', 'uDim', 'uTime', 'uFlash', 'uRings', 'uSpin', 'uN', 'uTD']) U[n] = gl.getUniformLocation(prog, n);
}

// Render the 3D scene for a camera and ball state into the GL canvas; returns the canvas.
export function renderGL({ cam, ball, ballOn = true, crack = 0, dim = 1, flash = 0, tt = 0 }) {
  gl.viewport(0, 0, W, H);
  gl.uniform2f(U.uRes, W, H);
  gl.uniform3fv(U.uCamPos, cam.pos);
  gl.uniform3fv(U.uCamR, cam.r);
  gl.uniform3fv(U.uCamU, cam.u);
  gl.uniform3fv(U.uCamF, cam.f);
  gl.uniform1f(U.uTan, cam.tanHalf);
  gl.uniform3fv(U.uBallC, ball.p);
  gl.uniformMatrix3fv(U.uMinv, false, ball.minv);
  gl.uniform1f(U.uBallOn, ballOn ? 1 : 0);
  gl.uniform1f(U.uCrack, crack);
  gl.uniform1f(U.uDim, dim);
  gl.uniform1f(U.uFlash, flash);
  gl.uniform1f(U.uTime, tt);
  gl.uniform1f(U.uSpin, ball.th || 0);
  gl.uniform3fv(U.uN, N);
  gl.uniform3fv(U.uTD, TD);
  // Shockwave rings from the four most recent floor contacts, scaled by impact speed.
  const rings = new Float32Array(16).fill(-1);
  const ev = physics().chrome.events.filter((e) => e.t <= tt && tt - e.t < 1.2 && e.speed > 350).slice(-4);
  ev.forEach((e, i) => {
    rings[i * 4] = e.x - N[0]; rings[i * 4 + 1] = e.y - N[1]; rings[i * 4 + 2] = 0; rings[i * 4 + 3] = (tt - e.t) * (2200 / Math.max(900, e.speed));
  });
  gl.uniform4fv(U.uRings, rings);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  return glc;
}

// Impact sparks projected from 3D, drawn additively as short streaks; count scales with speed.
function sparks(g, cam, tt) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  physics().chrome.events.forEach((e, k) => {
    const d = tt - e.t;
    if (d < 0 || d > 0.7 || e.speed < 500) return;
    const r = rng(500 + k), c = [e.x - N[0], e.y - N[1], 0];
    const n = Math.round(Math.min(34, e.speed / 60));
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, sp = (3 + r() * 10) * e.speed / 1800, up = 3 + r() * 8;
      const life = 0.25 + r() * 0.4;
      if (d > life) continue;
      const pos = (s2) => add(c, add(mul(TD, Math.cos(a) * sp * s2), add(mul(N, Math.max(0.02, up * s2 - 0.5 * 30 * s2 * s2)), [0, 0, Math.sin(a) * sp * s2])));
      const p1 = project(cam, pos(d)), p0 = project(cam, pos(Math.max(0, d - 0.03)));
      if (!p1 || !p0) continue;
      const fade = 1 - d / life;
      g.strokeStyle = `rgba(255,${180 + Math.floor(60 * fade)},${120 + Math.floor(100 * fade)},${fade})`;
      g.lineWidth = Math.max(1, 14 / p1.z) * (0.6 + fade);
      g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
    }
  });
  g.restore();
}

export function crackAt(tt) { return 0; }
export const hitTime = () => T_HIT;
export const rampStart = () => RAMP0;

export default {
  async init() { initGL(); solveRamp(); },
  shutter: () => ({ samples: 2, angle: 180 }),
  draw(g, t) {
    const tt = tau(t);
    const ball = ball3D(Math.min(tt, T_HIT));
    const cam = camera3D(t, tt);
    g.drawImage(renderGL({ cam, ball, crack: 0, flash: 0, tt }), 0, 0);
    sparks(g, cam, tt);
  },
  post(g, t, out) {
    bloom(g, out, { strength: 0.75, radius: 30, cut: 1.3, streak: 0.22 });
    vignette(g, 0.55, '8,5,3', 0.45);
    grain(g, t, 0.05);
  },
};
