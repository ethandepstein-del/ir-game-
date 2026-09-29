// Builds src/data/generated/hex-layout.json: a 435-cell hexagon cartogram, one cell per district.
//
// Each state becomes a compact cluster whose shape follows the state's bounding-box aspect ratio.
// Clusters are placed greedily, largest first, as close as possible to the state's real position on
// the Albers USA map, on a shared pointy-top hex grid so neighbours tessellate.
// Positions inside a state are schematic (districts are numbered top-to-bottom, left-to-right).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const geo = JSON.parse(readFileSync('src/data/generated/geo-states.json', 'utf8'));
const SEATS = {
  AL: 7, AK: 1, AZ: 9, AR: 4, CA: 52, CO: 8, CT: 5, DE: 1, FL: 28, GA: 14, HI: 2, ID: 2, IL: 17, IN: 9, IA: 4,
  KS: 4, KY: 6, LA: 6, ME: 2, MD: 8, MA: 9, MI: 13, MN: 8, MS: 4, MO: 8, MT: 2, NE: 3, NV: 4, NH: 2, NJ: 12,
  NM: 3, NY: 26, NC: 14, ND: 1, OH: 15, OK: 5, OR: 6, PA: 17, RI: 2, SC: 7, SD: 1, TN: 9, TX: 38, UT: 4, VT: 1,
  VA: 11, WA: 10, WV: 2, WI: 8, WY: 1,
};
const S = 16; // hex size (center to corner) in px
const W = Math.sqrt(3) * S;

// pixel <-> axial (pointy-top)
const toAxial = (x, y) => {
  const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / S;
  const r = ((2 / 3) * y) / S;
  return cubeRound(q, r);
};
function cubeRound(q, r) {
  const x = q;
  const z = r;
  const y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
}
const toPx = (q, r) => ({ x: S * Math.sqrt(3) * (q + r / 2), y: S * 1.5 * r });
const key = (q, r) => `${q},${r}`;
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

/** n cells nearest the origin under an ellipse with the given aspect (width/height). */
function shape(n, aspect) {
  const a = Math.min(Math.max(aspect, 0.55), 1.9);
  const ax = Math.sqrt(a);
  const ay = 1 / Math.sqrt(a);
  const cells = [];
  const R = 12;
  for (let q = -R; q <= R; q++) {
    for (let r = -R; r <= R; r++) {
      if (Math.abs(q + r) > R) continue;
      const p = toPx(q, r);
      cells.push({ q, r, d: (p.x / ax) ** 2 + (p.y / ay) ** 2 + 0.001 * (q * q + r * r) });
    }
  }
  cells.sort((u, v) => u.d - v.d);
  return cells.slice(0, n).map(({ q, r }) => ({ q, r }));
}

const taken = new Map();
const placed = {};
const order = Object.keys(SEATS).sort((a, b) => SEATS[b] - SEATS[a] || a.localeCompare(b));

// Warp space toward where the seats are: a blend of the real coordinate and its seat-weighted CDF,
// so the crowded East gets room and the empty West is compressed.
function warp(axis, alpha, span) {
  const pts = Object.keys(SEATS)
    .filter((s) => s !== 'AK' && s !== 'HI')
    .map((s) => ({ v: axis === 'x' ? geo[s].cx : geo[s].cy, w: SEATS[s] }))
    .sort((a, b) => a.v - b.v);
  const total = pts.reduce((a, p) => a + p.w, 0);
  let acc = 0;
  const knots = [{ v: axis === 'x' ? 0 : 0, c: 0 }];
  for (const p of pts) {
    knots.push({ v: p.v, c: (acc + p.w / 2) / total });
    acc += p.w;
  }
  knots.push({ v: span, c: 1 });
  return (v) => {
    let i = 0;
    while (i < knots.length - 2 && knots[i + 1].v < v) i++;
    const a = knots[i];
    const b = knots[i + 1];
    const t = b.v === a.v ? 0 : (v - a.v) / (b.v - a.v);
    const cdf = a.c + Math.min(Math.max(t, 0), 1) * (b.c - a.c);
    return alpha * v + (1 - alpha) * cdf * span;
  };
}
const wx = warp('x', 0.22, 975);
const wy = warp('y', 0.5, 610);

// Ideal centers: the state's centroid on the map (AK and HI use their inset positions).
for (const st of order) {
  const g = geo[st];
  const inset = st === 'AK' || st === 'HI';
  const gcx = inset ? g.cx : wx(g.cx);
  const gcy = inset ? g.cy : wy(g.cy);
  const [x0, y0, x1, y1] = g.bbox;
  const aspect = (x1 - x0) / Math.max(y1 - y0, 1);
  const offs = shape(SEATS[st], st === 'AK' || st === 'HI' ? 1 : aspect);
  // Recentre the shape on its own centroid so the "ideal" is the cluster's middle.
  const ideal = toAxial(gcx, gcy);
  let best = null;
  const maxRing = 26;
  for (let ring = 0; ring <= maxRing && !(best && ring > best.ring + 3); ring++) {
    const cand = [];
    if (ring === 0) cand.push({ q: ideal.q, r: ideal.r });
    else {
      let q = ideal.q + DIRS[4][0] * ring;
      let r = ideal.r + DIRS[4][1] * ring;
      for (let d = 0; d < 6; d++) {
        for (let k = 0; k < ring; k++) {
          cand.push({ q, r });
          q += DIRS[d][0];
          r += DIRS[d][1];
        }
      }
    }
    for (const c of cand) {
      let ok = true;
      for (const o of offs) {
        if (taken.has(key(c.q + o.q, c.r + o.r))) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const dist = Math.hypot(toPx(c.q, c.r).x - toPx(ideal.q, ideal.r).x, toPx(c.q, c.r).y - toPx(ideal.q, ideal.r).y);
      if (!best || dist < best.dist) best = { ...c, ring, dist };
    }
  }
  if (!best) throw new Error(`could not place ${st}`);
  const cells = offs.map((o) => ({ q: best.q + o.q, r: best.r + o.r }));
  cells.forEach((c) => taken.set(key(c.q, c.r), st));
  placed[st] = cells;
}

// Number districts top-to-bottom, left-to-right within each state.
const out = [];
for (const st of Object.keys(SEATS)) {
  const cells = placed[st].map((c) => ({ ...c, ...toPx(c.q, c.r) }));
  cells.sort((a, b) => a.y - b.y || a.x - b.x);
  cells.forEach((c, i) => out.push({ id: `${st}-${String(i + 1).padStart(2, '0')}`, st, d: i + 1, x: c.x, y: c.y, q: c.q, r: c.r }));
}
const minX = Math.min(...out.map((c) => c.x)) - W / 2;
const minY = Math.min(...out.map((c) => c.y)) - S;
const maxX = Math.max(...out.map((c) => c.x)) + W / 2;
const maxY = Math.max(...out.map((c) => c.y)) + S;
for (const c of out) {
  c.x = +(c.x - minX).toFixed(1);
  c.y = +(c.y - minY).toFixed(1);
}
const labels = {};
for (const st of Object.keys(SEATS)) {
  const cs = out.filter((c) => c.st === st);
  labels[st] = { x: +(cs.reduce((a, c) => a + c.x, 0) / cs.length).toFixed(1), y: +(cs.reduce((a, c) => a + c.y, 0) / cs.length).toFixed(1), n: cs.length };
}
mkdirSync('src/data/generated', { recursive: true });
writeFileSync(
  'src/data/generated/hex-layout.json',
  JSON.stringify({ size: S, width: +(maxX - minX).toFixed(1), height: +(maxY - minY).toFixed(1), cells: out.map(({ id, st, d, x, y }) => ({ id, st, d, x, y })), labels }),
);
console.log('cells', out.length, 'size', (maxX - minX).toFixed(0), 'x', (maxY - minY).toFixed(0));
