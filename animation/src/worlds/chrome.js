// World 5: 3D chrome. An analytic ray tracer in a WebGL2 fragment shader: chrome ellipsoid ball
// (true squash & stretch), glossy lacquer floor with a grid, studio softboxes, impact shockwaves,
// glowing cracks before the shatter. The camera swings from the 2D side view into 3D.
import { W, H, T, clamp, lerp, invLerp, ease, rng, smooth, contactSquash, shake, TAU, noise1 } from '../core.js';
import { makeCanvas, bloom, vignette, grain } from '../fx.js';

// ---------------------------------------------------------------- time remap (speed ramp)
const RAMP0 = 9.18;
export function tau(t) {
  if (t <= RAMP0) return t;
  // Integrate a speed curve that eases from 1 down to 0.22 (slow motion into the shatter).
  const n = 40, dt = (t - RAMP0) / n;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const u = RAMP0 + (i + 0.5) * dt;
    acc += (1 - 0.78 * smooth(clamp((u - RAMP0) / 0.28))) * dt;
  }
  return RAMP0 + acc;
}

// ---------------------------------------------------------------- ball in 3D (units: ball radius)
const G3 = 4150 / 84;
const IMP3 = [T.CHROME, 7.25, 8.0, 8.75];
const V3 = 290 / 84;
const LAUNCH = 8.75, LAUNCH_V = G3 * 0.45;
export function ball3D(tt) {
  let h = 0, v = 0;
  if (tt < LAUNCH) {
    for (let i = 0; i < 3; i++) {
      const a = IMP3[i], b = IMP3[i + 1];
      if (tt >= a && tt < b) { const s = tt - a, D = b - a; h = 0.5 * G3 * s * (D - s); v = G3 * (D / 2 - s); }
    }
  } else {
    const s = tt - LAUNCH;
    h = LAUNCH_V * s - 0.5 * G3 * s * s; v = LAUNCH_V - G3 * s;
  }
  const x = tt < LAUNCH ? V3 * (tt - T.CHROME) : V3 * (LAUNCH - T.CHROME) + 7.5 * (tt - LAUNCH);
  const vx = tt < LAUNCH ? V3 : 7.5;
  const { squash, ring } = contactSquash(tt, IMP3);
  // Axis + scale: squash along world up, otherwise stretch along velocity.
  let axis, k;
  if (squash > 0.02) { axis = [0, 1, 0]; k = 1 - 0.45 * squash + 0.05 * ring; }
  else {
    const sp = Math.hypot(vx, v);
    axis = [vx / sp, v / sp, 0];
    k = 1 + clamp((sp - 8) / 28) * 0.3;
  }
  const perp = 1 / Math.sqrt(k);
  const y = squash > 0.02 ? k : 1 + h;
  // M = perp*I + (k - perp) * a a^T ; Minv = (1/perp) I + (1/k - 1/perp) a a^T
  const minv = [];
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) minv.push((r === c ? 1 / perp : 0) + (1 / k - 1 / perp) * axis[r] * axis[c]);
  return { p: [x, y, 0], v: [vx, v, 0], minv, h };
}

// ---------------------------------------------------------------- camera
// [tau, azimuth, distance, camHeight, lookHeight, fovDeg, roll]
const KEYS = [
  [6.30, 0.00, 16.3, 3.23, 3.23, 35, 0.0],
  [6.50, 0.00, 16.3, 3.23, 3.23, 35, 0.0],
  [6.95, 0.30, 12.5, 2.3, 2.3, 38, 0.035],
  [7.55, 0.80, 9.4, 1.35, 1.8, 41, 0.05],
  [8.20, 1.12, 8.0, 0.85, 1.7, 43, 0.02],
  [8.85, 1.36, 7.2, 0.8, 2.0, 45, -0.03],
  [9.40, 1.50, 3.6, 3.2, 3.6, 50, -0.07],
  [9.80, 1.54, 3.4, 3.3, 3.6, 52, -0.08],
];
function catmull(p0, p1, p2, p3, u) {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}
function keyAt(tt) {
  let i = KEYS.findIndex((k) => k[0] > tt) - 1;
  if (i < 0) i = tt < KEYS[0][0] ? 0 : KEYS.length - 2;
  i = clamp(i, 0, KEYS.length - 2);
  const a = KEYS[Math.max(0, i - 1)], b = KEYS[i], c = KEYS[i + 1], d = KEYS[Math.min(KEYS.length - 1, i + 2)];
  const u = clamp((tt - b[0]) / (c[0] - b[0]));
  return b.map((_, j) => catmull(a[j], b[j], c[j], d[j], u));
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };

export function camera3D(t, tt, ballOverride) {
  const [, az, dist, ch, lookY, fov, roll] = keyAt(tt);
  const b = ballOverride || ball3D(Math.min(tt, 9.36));
  // Track the ball; in the final launch, tilt up to follow it.
  const follow = smooth(clamp((tt - 8.85) / 0.45));
  const bx = b.p[0];
  const target = [bx, lerp(lookY, b.p[1], 0.45 + 0.4 * follow), 0];
  const sk = shake(t, 1);
  const pos = [bx + dist * Math.sin(az) + sk.x * 0.004, ch + sk.y * 0.004, dist * Math.cos(az)];
  const f = norm(sub(target, pos));
  let r = norm(cross(f, [0, 1, 0]));
  let u = cross(r, f);
  const rr = roll + sk.rot * 2;
  const cr = Math.cos(rr), sr = Math.sin(rr);
  [r, u] = [[r[0] * cr + u[0] * sr, r[1] * cr + u[1] * sr, r[2] * cr + u[2] * sr], [u[0] * cr - r[0] * sr, u[1] * cr - r[1] * sr, u[2] * cr - r[2] * sr]];
  const tanHalf = Math.tan((fov * Math.PI) / 360);
  return { pos, f, r, u, tanHalf };
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
uniform float uBallOn, uCrack, uDim, uTime, uFlash;
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
  vec3 col = mix(vec3(0.030, 0.034, 0.048), vec3(0.006, 0.007, 0.011), clamp(y * 1.4, 0.0, 1.0));
  col += vec3(1.0, 0.42, 0.16) * 0.55 * exp(-abs(y) * 10.0) * (0.55 + 0.45 * d.x);
  col += vec3(0.20, 0.45, 0.95) * 0.35 * exp(-abs(y) * 7.0) * (0.55 - 0.45 * d.x);
  if (lights <= 0.0) return col * uDim;
  // Studio lights: only seen in reflections, never directly by the camera.
  vec3 li = vec3(0.16, 0.20, 0.28) * smoothstep(0.0, 0.7, y) + vec3(0.55, 0.46, 0.38) * exp(-abs(y - 0.03) * 16.0) * 0.8;
  li += vec3(1.0, 0.97, 0.93) * 7.0 * rectLight(d, normalize(vec3(-0.25, 1.0, 0.45)), vec2(0.62, 0.30), 0.05);
  li += vec3(1.0, 0.95, 0.9) * 3.0 * rectLight(d, normalize(vec3(0.5, 0.8, -0.6)), vec2(0.25, 0.25), 0.04);
  li += vec3(1.0, 0.60, 0.30) * 6.0 * rectLight(d, normalize(vec3(1.0, 0.15, -0.30)), vec2(0.05, 0.9), 0.02);
  li += vec3(0.35, 0.72, 1.0) * 5.0 * rectLight(d, normalize(vec3(-1.0, 0.22, -0.25)), vec2(0.045, 0.85), 0.02);
  li += vec3(0.9, 0.9, 1.0) * 2.0 * rectLight(d, normalize(vec3(0.2, 0.25, 1.0)), vec2(0.5, 0.03), 0.02);
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
vec3 floorBase(vec3 p, float dist) {
  vec3 col = vec3(0.010, 0.011, 0.014) * uDim;
  float aa = 0.0012 * dist + 0.004;
  float fade = exp(-dist * 0.045);
  col += vec3(0.25, 0.55, 1.0) * 0.10 * gridLine(p.xz / 2.0, 0.012, aa) * fade * uDim;
  col += vec3(0.35, 0.65, 1.0) * 0.16 * gridLine(p.xz / 10.0, 0.004, aa * 0.2) * fade * uDim;
  // Contact shadow / AO under the ball
  if (uBallOn > 0.5) {
    float hgt = max(uBallC.y - 1.0, 0.0);
    vec2 dxz = p.xz - uBallC.xz;
    float ao = exp(-dot(dxz, dxz) / (0.9 + hgt * 0.8)) / (1.0 + hgt * 0.5);
    col *= 1.0 - 0.9 * ao;
  }
  for (int i = 0; i < 4; i++) {
    vec4 r = uRings[i];
    if (r.w < 0.0 || r.w > 1.2) continue;
    float age = r.w;
    float rr = length(p.xz - r.xz);
    float rad = 0.9 + 11.0 * pow(age, 0.6);
    float w = 0.10 + age * 0.5;
    float ring = exp(-pow((rr - rad) / w, 2.0)) * exp(-age * 3.2);
    col += vec3(0.55, 0.85, 1.0) * ring * 1.6;
    col += vec3(1.0, 0.8, 0.6) * exp(-rr * rr * 1.5) * exp(-age * 14.0) * 3.0;
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
vec3 ballShade(vec3 p, vec3 n, vec3 rd) {
  vec3 rr = reflect(rd, n);
  vec3 refl;
  if (rr.y < 0.0) {
    float tf = -p.y / rr.y;
    vec3 fp = p + rr * tf;
    vec3 fr = vec3(rr.x, -rr.y, rr.z);
    float fres = 0.04 + 0.96 * pow(1.0 - abs(rr.y), 5.0);
    refl = floorBase(fp, tf + 6.0) + env(fr, 1.0) * fres * 0.6;
  } else refl = env(rr, 1.0);
  float cosT = clamp(dot(-rd, n), 0.0, 1.0);
  vec3 F0 = vec3(0.97, 0.95, 0.92);
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - cosT, 5.0);
  vec3 col = refl * F;
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
  float tf = rd.y < 0.0 ? -ro.y / rd.y : -1.0;
  vec3 col;
  if (tb > 0.0 && (tf < 0.0 || tb < tf)) {
    col = ballShade(ro + rd * tb, n, rd);
  } else if (tf > 0.0) {
    vec3 p = ro + rd * tf;
    col = floorBase(p, tf);
    vec3 rr = vec3(rd.x, -rd.y, rd.z);
    float fres = 0.04 + 0.96 * pow(1.0 - abs(rd.y), 5.0);
    vec3 refl;
    vec3 n2;
    float tb2 = uBallOn > 0.5 ? hitBall(p, rr, n2) : -1.0;
    if (tb2 > 0.0) refl = ballShade(p + rr * tb2, n2, rr) * 0.85;
    else refl = env(rr, 0.3);
    col += refl * mix(0.25, 1.0, fres) * 0.45;
    col = mix(col, env(normalize(vec3(rd.x, 0.02, rd.z)), 0.0) * 0.6, 1.0 - exp(-tf * 0.012));
  } else {
    col = env(rd, 0.0);
  }
  col += vec3(1.0, 0.9, 0.8) * uFlash;
  col = aces(col * 1.05);
  col = pow(col, vec3(1.0 / 2.2));
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
  for (const n of ['uRes', 'uCamPos', 'uCamR', 'uCamU', 'uCamF', 'uTan', 'uBallC', 'uMinv', 'uBallOn', 'uCrack', 'uDim', 'uTime', 'uFlash', 'uRings']) U[n] = gl.getUniformLocation(prog, n);
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
  const rings = new Float32Array(16).fill(-1);
  IMP3.forEach((ti, i) => {
    const b = ball3D(ti);
    rings[i * 4] = b.p[0]; rings[i * 4 + 1] = 0; rings[i * 4 + 2] = 0; rings[i * 4 + 3] = tt - ti;
  });
  gl.uniform4fv(U.uRings, rings);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  return glc;
}

// Impact sparks projected from 3D, drawn additively as short streaks.
function sparks(g, cam, tt) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  IMP3.forEach((ti, k) => {
    const d = tt - ti;
    if (d < 0 || d > 0.7) return;
    const r = rng(500 + k), c = ball3D(ti).p;
    const n = k === 0 ? 70 : 36;
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, sp = 4 + r() * (k === 0 ? 12 : 8), up = 3 + r() * 9;
      const life = 0.3 + r() * 0.4;
      if (d > life) continue;
      const pos = (s) => [c[0] + Math.cos(a) * sp * s, Math.max(0.02, up * s - 0.5 * 30 * s * s), Math.sin(a) * sp * s];
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

export function crackAt(tt) { return smooth(clamp((tt - 9.24) / 0.1)); }

export default {
  async init() { initGL(); },
  shutter: () => ({ samples: 5, angle: 200 }),
  draw(g, t) {
    const tt = tau(t);
    const ball = ball3D(tt);
    const cam = camera3D(t, tt);
    const flash = 0.15 * Math.exp(-(t - T.CHROME) / 0.012);
    g.drawImage(renderGL({ cam, ball, crack: crackAt(tt), flash, tt }), 0, 0);
    sparks(g, cam, tt);
  },
  post(g, t, out) {
    const tt = tau(t);
    bloom(g, out, { strength: 0.85, radius: 26, cut: 1.35, streak: 0.55 });
    vignette(g, 0.5, '0,0,0', 0.5);
    grain(g, t, 0.05);
    void tt;
  },
};
