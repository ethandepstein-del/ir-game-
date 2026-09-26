// Finale, act two. Past the broken lens is a tunnel of mirror shards, each one carrying a moment
// from one of the worlds the ball has been through. They spiral in, lock together facet by facet
// into a faceted mirror ball (the ball, rebuilt from its own history), which spins up, winds back
// and bursts. True 3D: every shard is a triangle with position, orientation (quaternions, slerped
// from tumbling to seated), perspective projection, depth sorting, and affine texture mapping.
import { W, H, T, clamp, lerp, ease, rng, smooth, TAU } from '../core.js';

export const FOCAL = H / 2 / Math.tan((56 * Math.PI) / 360);
export const VC = { x: W / 2, y: H / 2 - 30 };             // vanishing point = mirror-ball centre
export const SPHERE = { z: 3.3, r: 1.0 };
const LIGHT = norm([-0.55, 0.62, -0.56]), RIM = norm([0.8, 0.1, 0.35]);

// ---------------------------------------------------------------- vector / quaternion helpers
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const qAxis = (ax, a) => { const n = norm(ax), s = Math.sin(a / 2); return [Math.cos(a / 2), n[0] * s, n[1] * s, n[2] * s]; };
const qMul = (a, b) => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];
function qSlerp(a, b, u) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (d < 0) { b = b.map((x) => -x); d = -d; }
  if (d > 0.9995) { const q = a.map((x, i) => lerp(x, b[i], u)); const l = Math.hypot(...q); return q.map((x) => x / l); }
  const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - u) * th) / s, wb = Math.sin(u * th) / s;
  return a.map((x, i) => x * wa + b[i] * wb);
}
function qRot(q, v) {
  const u = [q[1], q[2], q[3]], t = cross(u, v).map((x) => 2 * x), c = cross(u, t);
  return [v[0] + q[0] * t[0] + c[0], v[1] + q[0] * t[1] + c[1], v[2] + q[0] * t[2] + c[2]];
}

// ---------------------------------------------------------------- geometry
// Geodesic sphere: an icosahedron subdivided twice, 320 near-equal triangles.
function icosphere() {
  const p = (1 + Math.sqrt(5)) / 2;
  let verts = [[-1, p, 0], [1, p, 0], [-1, -p, 0], [1, -p, 0], [0, -1, p], [0, 1, p], [0, -1, -p], [0, 1, -p], [p, 0, -1], [p, 0, 1], [-p, 0, -1], [-p, 0, 1]].map(norm);
  let faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < 2; s++) {
    const cache = new Map(), next = [];
    const mid = (a, b) => {
      const k = a < b ? a + '_' + b : b + '_' + a;
      if (!cache.has(k)) { cache.set(k, verts.length); verts.push(norm(verts[a].map((x, i) => (x + verts[b][i]) / 2))); }
      return cache.get(k);
    };
    for (const [a, b, c] of faces) {
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  return faces.map((f) => f.map((i) => verts[i]));
}

let tex = [], facets = [], passers = [], streaks = [];

// Texture triangle for a shard: its own shape laid flat, centred on (cu, cv) of snapshot `ti`.
function texTri(local, n, ti, cu, cv, k) {
  const e1 = norm(Math.abs(n[1]) > 0.95 ? cross([1, 0, 0], n) : cross([0, 1, 0], n)), e2 = cross(n, e1);
  const tw = tex[ti].width, th = tex[ti].height;
  const pts = local.map((v) => [cu + dot(v, e1) * k, cv - dot(v, e2) * k]);
  // Keep the crop inside the image so no shard ever samples past its edge.
  const minX = Math.min(...pts.map((q) => q[0])), maxX = Math.max(...pts.map((q) => q[0]));
  const minY = Math.min(...pts.map((q) => q[1])), maxY = Math.max(...pts.map((q) => q[1]));
  const dx = minX < 1 ? 1 - minX : maxX > tw - 1 ? tw - 1 - maxX : 0, dy = minY < 1 ? 1 - minY : maxY > th - 1 ? th - 1 - maxY : 0;
  return pts.map(([x, y]) => [x + dx, y + dy]);
}

export function initVortex(snapshots) {
  tex = snapshots;
  const r = rng(515);
  const tris = icosphere();
  facets = tris.map((tri, i) => {
    const c = norm(tri.reduce((a, v) => a.map((x, k) => x + v[k] / 3), [0, 0, 0]));
    const local = tri.map((v) => v.map((x, k) => x - c[k]));
    // Longitude picks the world (five bands round the ball), so neighbouring facets carry
    // neighbouring pieces of the same picture and the seated ball reads as a mosaic of worlds.
    const lon = Math.atan2(c[0], c[2]) + Math.PI, lat = Math.asin(c[1]);
    const band = Math.min(4, Math.floor(lon / (TAU / 5)));
    const fu = lon / (TAU / 5) - band;
    const ti = band;
    const cu = (0.1 + 0.8 * fu) * tex[ti].width, cv = (0.5 - lat / 2.6) * tex[ti].height;
    return {
      local, n: c, ti, uv: texTri(local, c, ti, cu, cv, tex[ti].width * 0.75),
      // Tunnel state: spiralling in from far down the tunnel.
      th0: r() * TAU, rho: 0.75 + r() * 1.7, z0: 4.2 + r() * 13, om: 0.7 + r() * 0.6,
      q0: qAxis([r() - 0.5, r() - 0.5, r() - 0.5], r() * TAU), ax: [r() - 0.5, r() - 0.5, r() - 0.5], sp: (r() < 0.5 ? -1 : 1) * (1.5 + r() * 4),
      size: 1.5 + r() * 1.3,
      // Seating: staggered so the ball builds up in a sparkle of landings.
      delay: 0.45 * Math.pow(r(), 0.8), dur: 0.5 + r() * 0.22,
      // Burst
      bv: 6 + r() * 9, bax: [r() - 0.5, r() - 0.5, r() - 0.5], bsp: (r() < 0.5 ? -1 : 1) * (6 + r() * 14), bj: [r() - 0.5, r() - 0.5, r() - 0.5],
    };
  });
  passers = Array.from({ length: 80 }, () => {
    const tri = tris[Math.floor(r() * tris.length)];
    const c = norm(tri.reduce((a, v) => a.map((x, k) => x + v[k] / 3), [0, 0, 0]));
    const local = tri.map((v) => v.map((x, k) => x - c[k]));
    const ti = Math.floor(r() * tex.length);
    return {
      local, n: c, ti, uv: texTri(local, c, ti, (0.2 + 0.6 * r()) * tex[ti].width, (0.25 + 0.5 * r()) * tex[ti].height, tex[ti].width * 0.9),
      th0: r() * TAU, rho: 0.55 + r() * 1.3, zp: r() * 15, om: 0.8 + r() * 0.7,
      q0: qAxis([r() - 0.5, r() - 0.5, r() - 0.5], r() * TAU), ax: [r() - 0.5, r() - 0.5, r() - 0.5], sp: (r() < 0.5 ? -1 : 1) * (2 + r() * 5),
      size: 1.0 + r() * 1.2,
    };
  });
  streaks = Array.from({ length: 170 }, () => ({ a: r() * TAU, d0: r(), v: 0.5 + r() * 0.9, w: 0.6 + r() * 1.6, warm: r() < 0.4 }));
}

// ---------------------------------------------------------------- motion
const SPIN_AX = norm([0.28, 1, 0.16]);
// Mirror-ball spin: steady, then spinning up hard into the wind-back before the burst.
function sphereAngle(t) {
  const t0 = T.GATHER, n = 24, dt = Math.max(0, Math.min(t, T.BURST) - t0) / n;
  let a = 0;
  for (let i = 0; i < n; i++) { const u = t0 + (i + 0.5) * dt; a += (1.3 + 9 * smooth(clamp((u - 11.75) / 0.75))) * dt; }
  return a;
}
const sphereQ = (t) => qAxis(SPIN_AX, sphereAngle(t));
// Anticipation: the ball contracts as it winds up, then lets go.
export const sphereScale = (t) => 1 - 0.17 * ease.inCubic(clamp((t - 12.18) / (T.BURST - 12.18)));
// How assembled the ball is (0 → 1), for the glow and the score.
export function seated(t) {
  let s = 0;
  for (const f of facets) s += ease.inOutCubic(clamp((t - T.GATHER - f.delay) / f.dur));
  return s / facets.length;
}
export const facetLandTimes = () => facets.map((f) => T.GATHER + f.delay + f.dur);

function tunnelPos(f, t) {
  const tv = t - T.VORTEX;
  const th = f.th0 + f.om * tv + 0.35 * tv * tv;
  const z = f.z0 - 3.3 * tv;
  const rho = f.rho * (1 - 0.12 * clamp(tv / 1.4));
  return [Math.cos(th) * rho, Math.sin(th) * rho, z];
}

// World-space state of a facet: position, orientation, scale, plus extra light and fade.
function facetState(f, t) {
  const qv = qMul(qAxis(f.ax, f.sp * (t - T.VORTEX)), f.q0);
  if (t >= T.BURST) {
    const tb = t - T.BURST, qs = sphereQ(T.BURST);
    const dir = norm(qRot(qs, f.n).map((x, i) => x + f.bj[i] * 0.5));
    const k = (1 - Math.exp(-3.2 * tb)) / 3.2;
    const R0 = SPHERE.r * sphereScale(T.BURST);
    const pos = [dir[0] * (R0 + f.bv * k), dir[1] * (R0 + f.bv * k) - 1.2 * tb * tb, SPHERE.z + dir[2] * (R0 + f.bv * k)];
    return { pos, q: qMul(qAxis(f.bax, f.bsp * tb), qs), s: Math.max(0, 1 - smooth(clamp(tb / 0.55))), glow: Math.exp(-tb / 0.08) * 0.8, alpha: 1 - smooth(clamp((tb - 0.25) / 0.3)) };
  }
  const u = ease.inOutCubic(clamp((t - T.GATHER - f.delay) / f.dur));
  const pv = tunnelPos(f, t);
  if (u <= 0) return { pos: pv, q: qv, s: f.size, glow: 0, alpha: 1 };
  const qs = sphereQ(t), sc = sphereScale(t);
  const n = qRot(qs, f.n);
  const ps = [n[0] * SPHERE.r * sc, n[1] * SPHERE.r * sc, SPHERE.z + n[2] * SPHERE.r * sc];
  let pos = pv.map((x, i) => lerp(x, ps[i], u));
  // Spiral in: the approach path swings round the tunnel axis on its way to the seat.
  const sw = (1 - u) * (1 - u) * 1.8, cs = Math.cos(sw), sn = Math.sin(sw);
  pos = [pos[0] * cs - pos[1] * sn, pos[0] * sn + pos[1] * cs, pos[2]];
  const land = t - (T.GATHER + f.delay + f.dur);
  return { pos, q: qSlerp(qv, qs, u), s: lerp(f.size, sc, u), glow: land >= 0 ? 0.9 * Math.exp(-land / 0.06) : 0, alpha: 1 };
}

function passerState(p, t) {
  const tv = t - T.VORTEX;
  const z = 0.15 + ((((p.zp - 4.8 * tv) % 15) + 15) % 15);
  const th = p.th0 + p.om * tv;
  const fade = 1 - smooth(clamp((t - 11.05) / 0.5));
  return { pos: [Math.cos(th) * p.rho, Math.sin(th) * p.rho, z], q: qMul(qAxis(p.ax, p.sp * tv), p.q0), s: p.size, glow: 0, alpha: fade };
}

// ---------------------------------------------------------------- drawing
const proj = (v) => [VC.x + (FOCAL * v[0]) / v[2], VC.y - (FOCAL * v[1]) / v[2]];

function drawShard(g, sh, st) {
  if (st.s <= 0.01 || st.alpha <= 0.01) return;
  const world = sh.local.map((v) => { const w = qRot(st.q, v); return [st.pos[0] + w[0] * st.s, st.pos[1] + w[1] * st.s, st.pos[2] + w[2] * st.s]; });
  if (world.some((v) => v[2] < 0.22)) return;
  const P = world.map(proj);
  const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
  if (Math.max(...xs) < -50 || Math.min(...xs) > W + 50 || Math.max(...ys) < -50 || Math.min(...ys) > H + 50) return;
  const z = st.pos[2];
  // Lighting: glass seen from either side, key light specular, warm rim, Fresnel, depth fog.
  let n = qRot(st.q, sh.n);
  const V = norm(st.pos.map((x) => -x));
  let nv = dot(n, V);
  if (nv < 0) { n = n.map((x) => -x); nv = -nv; }
  const Rf = n.map((x, i) => 2 * nv * x - V[i]);
  const spec = Math.pow(Math.max(0, dot(Rf, LIGHT)), 36) * 1.1 + Math.pow(Math.max(0, dot(Rf, RIM)), 18) * 0.35;
  const fres = Math.pow(1 - nv, 4) * 0.3;
  const fog = clamp((z - 4.5) / 11);
  const diffuse = (0.3 + 0.7 * Math.max(0, dot(n, LIGHT))) * (1 - 0.88 * fog);
  const alpha = st.alpha * (1 - smooth(clamp((z - 13.5) / 2.5)));
  if (alpha <= 0.01) return;
  // Expand the clip a hair so seated neighbours close up without seams.
  const cx = (xs[0] + xs[1] + xs[2]) / 3, cy = (ys[0] + ys[1] + ys[2]) / 3;
  const E = P.map(([x, y]) => { const l = Math.hypot(x - cx, y - cy) || 1; return [x + ((x - cx) / l) * 0.8, y + ((y - cy) / l) * 0.8]; });
  const [[u0, v0], [u1, v1], [u2, v2]] = sh.uv;
  const du1 = u1 - u0, dv1 = v1 - v0, du2 = u2 - u0, dv2 = v2 - v0, det = du1 * dv2 - du2 * dv1;
  if (Math.abs(det) < 1e-6) return;
  const dx1 = P[1][0] - P[0][0], dy1 = P[1][1] - P[0][1], dx2 = P[2][0] - P[0][0], dy2 = P[2][1] - P[0][1];
  const a = (dx1 * dv2 - dx2 * dv1) / det, c = (dx2 * du1 - dx1 * du2) / det;
  const b = (dy1 * dv2 - dy2 * dv1) / det, d = (dy2 * du1 - dy1 * du2) / det;
  const e = P[0][0] - a * u0 - c * v0, f = P[0][1] - b * u0 - d * v0;
  g.save();
  g.globalAlpha = alpha;
  g.beginPath();
  g.moveTo(E[0][0], E[0][1]); g.lineTo(E[1][0], E[1][1]); g.lineTo(E[2][0], E[2][1]); g.closePath();
  g.save();
  g.clip();
  g.transform(a, b, c, d, e, f);
  g.drawImage(tex[sh.ti], 0, 0);
  g.restore();
  if (diffuse < 1) { g.fillStyle = `rgba(6,4,3,${Math.min(0.95, 1 - diffuse)})`; g.fill(); }
  const add = Math.min(1, spec + fres * (1 - fog) + st.glow);
  if (add > 0.015) { g.fillStyle = `rgba(255,238,215,${add})`; g.fill(); }
  g.lineJoin = 'round';
  g.strokeStyle = `rgba(255,246,232,${(0.16 + 0.6 * Math.min(1, spec + st.glow)) * (1 - fog)})`;
  g.lineWidth = Math.min(2, 0.6 + 2.2 / z);
  g.stroke();
  g.restore();
}

// Warp streaks radiating from the vanishing point: the sense of flying down the tunnel.
function drawStreaks(g, t) {
  const a = smooth(clamp((t - 9.65) / 0.4)) * (1 - smooth(clamp((t - 11.4) / 0.9)));
  if (a <= 0) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  for (const s of streaks) {
    const u = (s.d0 + s.v * (t - T.VORTEX) * 0.9) % 1;
    const d0 = 60 + Math.pow(u, 2.2) * 1400, d1 = d0 * (1.08 + 0.25 * u);
    const al = a * (0.05 + 0.3 * u) * (1 - smooth(clamp((u - 0.85) / 0.15)));
    g.strokeStyle = s.warm ? `rgba(255,190,140,${al})` : `rgba(210,225,255,${al * 0.8})`;
    g.lineWidth = s.w * (0.4 + u * 1.6);
    const c = Math.cos(s.a), sn = Math.sin(s.a);
    g.beginPath(); g.moveTo(VC.x + c * d0, VC.y + sn * d0); g.lineTo(VC.x + c * d1, VC.y + sn * d1); g.stroke();
  }
  g.restore();
}

// Halo and god rays behind the ball as it gathers light before the burst.
function drawHalo(g, t) {
  if (t < T.GATHER - 0.2 || t > T.BURST + 0.5) return;
  const s = seated(Math.min(t, T.BURST));
  const wind = ease.inCubic(clamp((t - 12.0) / (T.BURST - 12.0)));
  const after = t > T.BURST ? Math.exp(-(t - T.BURST) / 0.12) : 1;
  const R = (FOCAL * SPHERE.r) / SPHERE.z;
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gl = g.createRadialGradient(VC.x, VC.y, R * 0.3, VC.x, VC.y, R * (2.4 + 1.5 * wind));
  gl.addColorStop(0, `rgba(255,190,140,${(0.18 * s + 0.4 * wind) * after})`);
  gl.addColorStop(0.45, `rgba(217,119,87,${(0.08 * s + 0.16 * wind) * after})`);
  gl.addColorStop(1, 'rgba(217,119,87,0)');
  g.fillStyle = gl;
  g.fillRect(0, 0, W, H);
  if (wind > 0) {
    const n = 28, rot = sphereAngle(t) * 0.35;
    for (let i = 0; i < n; i++) {
      const a0 = rot + (i / n) * TAU, w = 0.035 + 0.02 * Math.sin(i * 2.7);
      const len = R * (1.4 + 3.2 * wind) * (0.6 + 0.4 * Math.sin(i * 1.9 + 1));
      const gr = g.createRadialGradient(VC.x, VC.y, R * 0.8, VC.x, VC.y, len);
      gr.addColorStop(0, `rgba(255,220,180,${0.22 * wind * after})`);
      gr.addColorStop(1, 'rgba(255,220,180,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(VC.x, VC.y); g.arc(VC.x, VC.y, len, a0 - w, a0 + w); g.closePath(); g.fill();
    }
  }
  g.restore();
}

export function drawVortex(g, t) {
  if (t < T.VORTEX - 0.05 || t > T.BURST + 0.62) return;
  drawStreaks(g, t);
  drawHalo(g, t);
  const list = [];
  if (t < 11.6) for (const p of passers) { const st = passerState(p, t); list.push([st.pos[2], p, st]); }
  for (const f of facets) { const st = facetState(f, t); list.push([st.pos[2], f, st]); }
  list.sort((a, b) => b[0] - a[0]);
  for (const [, sh, st] of list) drawShard(g, sh, st);
}

// Screen-space points on the mirror ball's surface at the moment it bursts (where the dust is born).
export function burstPoint(r) {
  const R = ((FOCAL * SPHERE.r) / SPHERE.z) * sphereScale(T.BURST);
  const a = r() * TAU, d = Math.sqrt(r()) * R;
  return [VC.x + Math.cos(a) * d, VC.y + Math.sin(a) * d, d / R];
}
export const ballScreenRadius = () => (FOCAL * SPHERE.r) / SPHERE.z;
// Times at which tunnel shards fly past the lens (for whooshes), with their screen side.
export function passBys() {
  const out = [];
  for (const p of passers) {
    for (let t = T.VORTEX; t < 11.3; t += 1 / 120) {
      const a = passerState(p, t), b = passerState(p, t + 1 / 120);
      if (b.pos[2] > a.pos[2] + 5) out.push({ t, pan: clamp(a.pos[0] / p.rho, -1, 1), rho: p.rho, alpha: a.alpha });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
