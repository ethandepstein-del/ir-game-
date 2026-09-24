// Rasterizes Natural Earth country borders (world-atlas 110m) onto a pointy-top hex grid
// and groups countries into game territories. Output: src/data/map.generated.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { geoContains, geoCentroid } from 'd3-geo';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const world = require('world-atlas/countries-110m.json');
const countries = feature(world, world.objects.countries).features;

export const COLS = 120;
export const ROWS = 60;
const LON0 = -170; // cut through the Bering Strait so Asia sits to the right
const LAT_TOP = 76;
const LAT_BOTTOM = -50;

// [id, name, region, rule(country, lon, lat) => boolean]
const has = (...names) => (c) => names.includes(c);
const T = [
  // North America
  ['alaska', 'Alaska', 'na', (c, lon, lat) => c === 'United States of America' && lon < -140 && lat > 50],
  ['canada-w', 'Western Canada', 'na', (c, lon) => c === 'Canada' && lon < -100],
  ['canada-e', 'Eastern Canada', 'na', (c, lon) => c === 'Canada' && lon >= -100],
  ['greenland', 'Greenland & Iceland', 'na', has('Greenland', 'Iceland')],
  ['us-west', 'Western US', 'na', (c, lon, lat) => c === 'United States of America' && lon < -100 && lon >= -130 && lat > 24],
  ['us-east', 'Eastern US', 'na', (c, lon, lat) => c === 'United States of America' && lon >= -100 && lat > 24],
  ['mexico', 'Mexico', 'na', has('Mexico')],
  ['central-am', 'Central America & Caribbean', 'na', has('Guatemala', 'Belize', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama', 'Cuba', 'Haiti', 'Dominican Rep.', 'Jamaica', 'Bahamas', 'Puerto Rico')],
  // South America
  ['gran-colombia', 'Gran Colombia', 'sa', has('Colombia', 'Venezuela', 'Ecuador', 'Guyana', 'Suriname', 'Trinidad and Tobago')],
  ['brazil', 'Brazil', 'sa', (c, lon) => c === 'Brazil' || (c === 'France' && lon < -40)],
  ['andes', 'Andes', 'sa', (c, lon, lat) => has('Peru', 'Bolivia')(c) || (c === 'Chile' && lat > -28)],
  ['southern-cone', 'Southern Cone', 'sa', (c, lon, lat) => has('Argentina', 'Uruguay', 'Paraguay', 'Falkland Is.')(c) || (c === 'Chile' && lat <= -28)],
  // Europe
  ['uk', 'British Isles', 'eu', has('United Kingdom', 'Ireland')],
  ['iberia', 'Iberia', 'eu', has('Spain', 'Portugal')],
  ['france', 'France & Benelux', 'eu', (c, lon) => (c === 'France' && lon > -10) || has('Belgium', 'Netherlands', 'Luxembourg', 'Switzerland')(c)],
  ['germany', 'Germany', 'eu', has('Germany', 'Denmark', 'Austria', 'Czechia')],
  ['italy', 'Italy', 'eu', has('Italy', 'Slovenia')],
  ['scandinavia', 'Scandinavia', 'eu', (c, lon) => has('Sweden', 'Finland')(c) || (c === 'Norway' && lon < 35)],
  ['central-eu', 'Poland & Baltics', 'eu', has('Poland', 'Lithuania', 'Latvia', 'Estonia', 'Slovakia', 'Hungary')],
  ['eastern-eu', 'Ukraine & Belarus', 'eu', has('Ukraine', 'Belarus', 'Moldova')],
  ['balkans', 'Balkans', 'eu', has('Croatia', 'Bosnia and Herz.', 'Serbia', 'Montenegro', 'Kosovo', 'Albania', 'Macedonia', 'Greece', 'Bulgaria', 'Romania')],
  // Heartland
  ['moscow', 'Muscovy', 'hl', (c, lon) => c === 'Russia' && lon > 0 && lon < 50],
  ['urals', 'Urals', 'hl', (c, lon) => c === 'Russia' && lon >= 50 && lon < 80],
  ['siberia', 'Siberia', 'hl', (c, lon) => c === 'Russia' && lon >= 80 && lon < 118],
  ['far-east', 'Russian Far East', 'hl', (c, lon) => c === 'Russia' && (lon >= 118 || lon < -150)],
  ['kazakhstan', 'Kazakhstan', 'hl', has('Kazakhstan')],
  ['central-asia', 'Central Asia', 'hl', has('Uzbekistan', 'Turkmenistan', 'Kyrgyzstan', 'Tajikistan')],
  // Middle East & North Africa
  ['maghreb', 'Maghreb', 'me', has('Morocco', 'W. Sahara', 'Algeria', 'Tunisia', 'Libya')],
  ['egypt', 'Egypt & Sudan', 'me', has('Egypt', 'Sudan')],
  ['levant', 'Levant & Iraq', 'me', has('Israel', 'Palestine', 'Lebanon', 'Jordan', 'Syria', 'Iraq', 'Cyprus', 'N. Cyprus')],
  ['anatolia', 'Anatolia & Caucasus', 'me', has('Turkey', 'Georgia', 'Armenia', 'Azerbaijan')],
  ['arabia', 'Arabia', 'me', has('Saudi Arabia', 'Yemen', 'Oman', 'United Arab Emirates', 'Qatar', 'Kuwait')],
  ['persia', 'Persia', 'me', has('Iran')],
  // Sub-Saharan Africa
  ['west-africa', 'West Africa', 'af', has('Mauritania', 'Mali', 'Niger', 'Senegal', 'Gambia', 'Guinea', 'Guinea-Bissau', 'Sierra Leone', 'Liberia', "Côte d'Ivoire", 'Burkina Faso', 'Ghana', 'Togo', 'Benin', 'Nigeria', 'Chad')],
  ['horn', 'Horn of Africa', 'af', has('Ethiopia', 'Eritrea', 'Djibouti', 'Somalia', 'Somaliland', 'S. Sudan', 'Kenya', 'Uganda')],
  ['congo', 'Congo Basin', 'af', has('Dem. Rep. Congo', 'Congo', 'Gabon', 'Cameroon', 'Central African Rep.', 'Eq. Guinea', 'Rwanda', 'Burundi')],
  ['east-africa', 'East Africa', 'af', has('Tanzania', 'Zambia', 'Malawi', 'Mozambique', 'Madagascar', 'Zimbabwe')],
  ['southern-africa', 'Southern Africa', 'af', has('South Africa', 'Namibia', 'Botswana', 'Angola', 'Lesotho', 'eSwatini')],
  // South Asia
  ['hindustan', 'Hindustan', 'sa2', (c, lon, lat) => c === 'India' && lat >= 21 && lon < 81],
  ['ganges', 'Ganges Delta', 'sa2', (c, lon, lat) => (c === 'India' && lat >= 21 && lon >= 81) || has('Bangladesh', 'Nepal', 'Bhutan')(c)],
  ['deccan', 'Deccan', 'sa2', (c, lon, lat) => (c === 'India' && lat < 21) || c === 'Sri Lanka'],
  ['pakistan', 'Af-Pak', 'sa2', has('Pakistan', 'Afghanistan')],
  ['burma', 'Burma', 'sa2', has('Myanmar')],
  // East Asia
  ['north-china', 'North China', 'ea', (c, lon, lat) => c === 'China' && lon >= 100 && lat >= 31],
  ['south-china', 'South China', 'ea', (c, lon, lat) => c === 'China' && lon >= 100 && lat < 31],
  ['west-china', 'Xinjiang & Tibet', 'ea', (c, lon) => c === 'China' && lon < 100],
  ['mongolia', 'Mongolia', 'ea', has('Mongolia')],
  ['korea', 'Korea', 'ea', has('North Korea', 'South Korea')],
  ['japan', 'Japan', 'ea', has('Japan')],
  ['taiwan', 'Taiwan', 'ea', has('Taiwan')],
  // Southeast Asia
  ['indochina', 'Indochina', 'sea', has('Thailand', 'Laos', 'Cambodia', 'Vietnam')],
  ['malaya', 'Malaya & Sumatra', 'sea', (c, lon) => has('Malaysia', 'Brunei')(c) || (c === 'Indonesia' && lon < 108)],
  ['indonesia', 'Indonesia & New Guinea', 'sea', (c, lon) => (c === 'Indonesia' && lon >= 108) || has('Timor-Leste', 'Papua New Guinea', 'Solomon Is.')(c)],
  ['philippines', 'Philippines', 'sea', has('Philippines')],
  // Oceania
  ['aus-w', 'Western Australia', 'oc', (c, lon) => c === 'Australia' && lon < 135],
  ['aus-e', 'Eastern Australia', 'oc', (c, lon) => c === 'Australia' && lon >= 135],
  ['new-zealand', 'New Zealand & Pacific', 'oc', has('New Zealand', 'Fiji', 'Vanuatu', 'New Caledonia')],
];

const SEA_LANES = [
  ['alaska', 'far-east'], ['greenland', 'canada-e'], ['greenland', 'uk'], ['uk', 'france'], ['uk', 'scandinavia'],
  ['germany', 'scandinavia'], ['us-east', 'central-am'], ['us-east', 'uk'], ['brazil', 'west-africa'], ['maghreb', 'iberia'],
  ['maghreb', 'italy'], ['arabia', 'horn'], ['arabia', 'persia'], ['egypt', 'levant'], ['balkans', 'anatolia'],
  ['japan', 'korea'], ['japan', 'far-east'], ['taiwan', 'south-china'], ['taiwan', 'philippines'], ['taiwan', 'japan'],
  ['philippines', 'indonesia'], ['philippines', 'indochina'], ['malaya', 'indonesia'], ['malaya', 'indochina'],
  ['indonesia', 'aus-e'], ['indonesia', 'aus-w'], ['aus-e', 'new-zealand'], ['deccan', 'malaya'], ['horn', 'east-africa'],
  ['us-west', 'alaska'], ['us-west', 'japan'], ['greenland', 'scandinavia'], ['italy', 'balkans'], ['east-africa', 'deccan'],
];

const SQ3 = Math.sqrt(3);
function hexCenter(col, row) {
  return [col * SQ3 + (row % 2 ? SQ3 / 2 : 0) + SQ3 / 2, row * 1.5 + 1];
}
const W = COLS * SQ3 + SQ3 / 2;
const H = (ROWS - 1) * 1.5 + 2;
function lonLat(col, row) {
  const [x, y] = hexCenter(col, row);
  let lon = LON0 + (x / W) * 360;
  if (lon > 180) lon -= 360;
  const lat = LAT_TOP - (y / H) * (LAT_TOP - LAT_BOTTOM);
  return [lon, lat];
}
function neighbors(col, row) {
  const odd = row % 2;
  const d = odd
    ? [[1, 0], [-1, 0], [0, -1], [1, -1], [0, 1], [1, 1]]
    : [[1, 0], [-1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]];
  return d.map(([dc, dr]) => [col + dc, row + dr]).filter(([c, r]) => c >= 0 && c < COLS && r >= 0 && r < ROWS);
}

function classify(lon, lat) {
  for (const f of countries) {
    if (f.properties.name === 'Antarctica' || f.properties.name === 'Fr. S. Antarctic Lands') continue;
    if (geoContains(f, [lon, lat])) {
      const t = T.findIndex(([, , , rule]) => rule(f.properties.name, lon, lat));
      return t;
    }
  }
  return -1;
}

const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(-1));
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) grid[r][c] = classify(...lonLat(c, r));

// Guarantee every territory at least two hexes: seed missing ones at the nearest free hex to their centroid.
for (let t = 0; t < T.length; t++) {
  for (let pass = 0; pass < 2; pass++) {
    const count = grid.flat().filter((v) => v === t).length;
    if (count >= 2) break;
    const members = countries.filter((f) => {
      const [lon, lat] = geoCentroid(f);
      return T[t][3](f.properties.name, lon, lat);
    });
    if (!members.length) throw new Error(`no countries for ${T[t][0]}`);
    const [clon, clat] = geoCentroid(members[0]);
    let best = null;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] !== -1) continue;
        const [lon, lat] = lonLat(c, r);
        const d = (lon - clon) ** 2 + (lat - clat) ** 2;
        if (!best || d < best.d) best = { r, c, d };
      }
    grid[best.r][best.c] = t;
  }
}

const hexes = T.map(() => []);
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] >= 0) hexes[grid[r][c]].push([c, r]);

const adj = T.map(() => new Set());
for (let r = 0; r < ROWS; r++)
  for (let c = 0; c < COLS; c++) {
    const a = grid[r][c];
    if (a < 0) continue;
    for (const [nc, nr] of neighbors(c, r)) {
      const b = grid[nr][nc];
      if (b >= 0 && b !== a) adj[a].add(b);
    }
  }
const idx = (id) => {
  const i = T.findIndex((t) => t[0] === id);
  if (i < 0) throw new Error(`unknown ${id}`);
  return i;
};
const lanes = [];
for (const [a, b] of SEA_LANES) {
  const i = idx(a), j = idx(b);
  if (!adj[i].has(j)) lanes.push([i, j]);
  adj[i].add(j);
  adj[j].add(i);
}

// Label hex: member hex with the most same-territory neighbours, closest to the mean.
const labels = hexes.map((hs, t) => {
  const [mx, my] = hs.map(([c, r]) => hexCenter(c, r)).reduce((a, b) => [a[0] + b[0], a[1] + b[1]]).map((v) => v / hs.length);
  let best = hs[0], bestScore = -Infinity;
  for (const [c, r] of hs) {
    const inner = neighbors(c, r).filter(([nc, nr]) => grid[nr][nc] === t).length;
    const [x, y] = hexCenter(c, r);
    const score = inner * 2 - Math.hypot(x - mx, y - my);
    if (score > bestScore) { bestScore = score; best = [c, r]; }
  }
  return best;
});

const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const rows = grid.map((row) => row.map((v) => (v < 0 ? '.' : ALPHA[v])).join(''));

const out = `// Generated by scripts/build-map.mjs from Natural Earth (world-atlas 110m). Do not edit.
export const COLS = ${COLS};
export const ROWS = ${ROWS};
export const ALPHA = '${ALPHA}';
/** Projection used to rasterize: equirectangular, longitude starting at LON0. */
export const LON0 = ${LON0};
export const LAT_TOP = ${LAT_TOP};
export const LAT_BOTTOM = ${LAT_BOTTOM};
/** One string per hex row; each char is a territory index in ALPHA, '.' is ocean. */
export const GRID: string[] = ${JSON.stringify(rows, null, 2)};
export const TERRITORY_DEFS: { id: string; name: string; region: string; label: [number, number]; adj: number[] }[] = ${JSON.stringify(
  T.map(([id, name, region], i) => ({ id, name, region, label: labels[i], adj: [...adj[i]].sort((a, b) => a - b) })),
)};
/** Every sea crossing: attacks along these are amphibious. */
export const SEA_LANES: [number, number][] = ${JSON.stringify(SEA_LANES.map(([a, b]) => [idx(a), idx(b)]))};
/** Sea lanes that are not already hex neighbours: drawn as dashed lines. */
export const DRAWN_LANES: [number, number][] = ${JSON.stringify(lanes)};
`;
writeFileSync('src/data/map.generated.ts', out);
console.log(rows.join('\n'));
console.log(T.map(([id], i) => `${id}:${hexes[i].length}`).join(' '));

// ---------------------------------------------------------------------------
// Real borders for drawing. The hex grid above decides adjacency and rules;
// these shapes are what the player sees: Natural Earth 50m country outlines,
// cut along the same lines the territory rules use, merged per territory,
// then broken into shared border chains so neighbours simplify identically.
// Output: src/data/shapes.generated.ts
// ---------------------------------------------------------------------------
{
  const { default: pc } = await import('polygon-clipping');
  const world50 = require('world-atlas/countries-50m.json');
  const countries50 = feature(world50, world50.objects.countries).features;
  const S = 8; // SVG units per hex unit, as in src/ui/geometry.ts

  // Drawing extends past the hex grid's top row so the Arctic isn't sliced flat.
  const DRAW_TOP = 84;
  const ANY = [LON0, LON0 + 360, LAT_BOTTOM, DRAW_TOP];
  // Countries the territory rules split: [territory, [lonMin, lonMax, latMin, latMax]].
  const SPLITS = {
    'United States of America': [['alaska', [-180, -129.99, 50, 90]], ['us-west', [-130, -100, 24, 90]], ['us-east', [-100, -60, 24, 90]]],
    Canada: [['canada-w', [-141, -100, 40, 90]], ['canada-e', [-100, -50, 40, 90]]],
    Russia: [['moscow', [0, 50, 40, 90]], ['urals', [50, 80, 40, 90]], ['siberia', [80, 118, 40, 90]], ['far-east', [118, 210, 40, 90]]],
    China: [['west-china', [70, 100, 15, 55]], ['north-china', [100, 140, 31, 55]], ['south-china', [100, 140, 15, 31]]],
    India: [['hindustan', [60, 81, 21, 40]], ['ganges', [81, 100, 21, 40]], ['deccan', [60, 100, 0, 21]]],
    Chile: [['andes', [-80, -60, -28, 0]], ['southern-cone', [-80, -60, -60, -28]]],
    Indonesia: [['malaya', [90, 108, -12, 8]], ['indonesia', [108, 142, -12, 8]]],
    Australia: [['aus-w', [110, 135, -45, -9]], ['aus-e', [135, 160, -45, -9]]],
    France: [['france', [-10, 20, 40, 52]], ['brazil', [-60, -40, 0, 10]]],
    Norway: [['scandinavia', [-10, 35, 55, 90]]],
  };
  const tIndex = (id) => T.findIndex((t) => t[0] === id);

  const box = ([x0, x1, y0, y1]) => [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]];
  const polys = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
  /** Rings that cross the antimeridian jump 360° in longitude; make them continuous. */
  const unwrap = (ring) => {
    const out = [ring[0].slice()];
    for (let i = 1; i < ring.length; i++) {
      let [x, y] = ring[i];
      const px = out[i - 1][0];
      while (x - px > 180) x -= 360;
      while (x - px < -180) x += 360;
      out.push([x, y]);
    }
    return out;
  };
  /**
   * Clip to a box (in the map's longitude range, LON0..LON0+360) and the drawn
   * latitude band. The geometry is tried at three 360° offsets so pieces on
   * either side of the seam land on the right edge of the map.
   */
  function clip(geom, [x0, x1, y0, y1]) {
    if (x1 <= LON0) (x0 += 360), (x1 += 360);
    const lo = Math.max(x0, LON0);
    const hi = Math.min(x1, LON0 + 360);
    const lat = [Math.max(y0, LAT_BOTTOM), Math.min(y1, DRAW_TOP)];
    if (lo >= hi || lat[0] >= lat[1]) return [];
    const out = [];
    for (const k of [-360, 0, 360]) {
      const shifted = geom.map((p) => p.map((r) => r.map(([x, y]) => [x + k, y])));
      out.push(...pc.intersection(shifted, box([lo, hi, ...lat])));
    }
    return out;
  }

  const parts = T.map(() => []);
  const unmatched = [];
  for (const f of countries50) {
    const name = f.properties.name;
    const geom = polys(f.geometry).map((p) => p.map(unwrap));
    if (!geom.length || name === 'Antarctica') continue;
    if (SPLITS[name]) {
      for (const [id, b] of SPLITS[name]) parts[tIndex(id)].push(...clip(geom, b));
      continue;
    }
    const [lon, lat] = geoCentroid(f);
    let t = T.findIndex(([, , , rule]) => rule(name, lon, lat));
    if (t < 0) {
      // Microstates and small islands: whichever territory's hexes lie nearest.
      let best = null;
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          if (grid[r][c] < 0) continue;
          const [hl, ha] = lonLat(c, r);
          const d = (hl - lon) ** 2 + (ha - lat) ** 2;
          if (!best || d < best.d) best = { d, t: grid[r][c] };
        }
      if (best && best.d < 25) t = best.t;
      else unmatched.push(name);
    }
    if (t >= 0) parts[t].push(...clip(geom, ANY));
  }

  // Project and round, so both sides of a shared border land on identical points.
  const P = ([lon, lat]) => {
    const x = ((lon - LON0) / 360) * W * S;
    const y = ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * H * S;
    return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
  };
  const shapes = parts.map((ps) => (ps.length ? pc.union(...ps.map((p) => [p])) : []));

  // Every ring edge, keyed without direction; count which territories use it.
  const k = ([x, y]) => `${x},${y}`;
  const edges = new Map();
  shapes.forEach((mp, t) => {
    for (const poly of mp)
      for (const ringLL of poly) {
        const ring = ringLL.map(P);
        for (let i = 0; i + 1 < ring.length; i++) {
          const a = ring[i];
          const b = ring[i + 1];
          if (a[0] === b[0] && a[1] === b[1]) continue;
          const id = k(a) < k(b) ? `${k(a)}|${k(b)}` : `${k(b)}|${k(a)}`;
          if (!edges.has(id)) edges.set(id, { a, b, owners: [] });
          edges.get(id).owners.push(t);
        }
      }
  });
  // Group boundary edges by the pair they separate (-1 = sea).
  const byPair = new Map();
  for (const e of edges.values()) {
    const o = [...new Set(e.owners)];
    if (o.length === 1 && e.owners.length > 1) continue; // interior seam inside one territory
    const pair = o.length === 1 ? `${o[0]}|-1` : `${Math.min(o[0], o[1])}|${Math.max(o[0], o[1])}`;
    if (!byPair.has(pair)) byPair.set(pair, []);
    byPair.get(pair).push([e.a, e.b]);
  }

  // Chain each pair's edges; open between junctions, closed for islands.
  function simplify(pts, tol) {
    if (pts.length < 4) return pts;
    const keep = new Uint8Array(pts.length);
    keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [i, j] = stack.pop();
      const [ax, ay] = pts[i];
      const [bx, by] = pts[j];
      const len = Math.hypot(bx - ax, by - ay) || 1e-9;
      let far = -1;
      let dmax = tol;
      for (let q = i + 1; q < j; q++) {
        const d = Math.abs((bx - ax) * (ay - pts[q][1]) - (ax - pts[q][0]) * (by - ay)) / len;
        if (d > dmax) (dmax = d), (far = q);
      }
      if (far >= 0) {
        keep[far] = 1;
        stack.push([i, far], [far, j]);
      }
    }
    return pts.filter((_, i) => keep[i]);
  }
  const area = (pts) => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  const TOL = 0.45;
  const chains = [];
  for (const [pair, list] of byPair) {
    const [a, b] = pair.split('|').map(Number);
    const at = new Map();
    list.forEach(([p, q], i) => {
      for (const v of [k(p), k(q)]) {
        if (!at.has(v)) at.set(v, []);
        at.get(v).push(i);
      }
    });
    const used = new Set();
    const walk = (e0, from) => {
      const pts = [];
      let e = e0;
      let cur = from;
      const [p0, q0] = list[e];
      pts.push(k(p0) === cur ? p0 : q0);
      for (;;) {
        used.add(e);
        const [p, q] = list[e];
        const next = k(p) === cur ? q : p;
        pts.push(next);
        cur = k(next);
        const cand = (at.get(cur) ?? []).filter((i) => !used.has(i));
        if (!cand.length) return pts;
        e = cand[0];
      }
    };
    // Junctions: vertices whose degree within this pair isn't 2 start open chains.
    for (const [v, es] of at) for (const e of es) if (es.length !== 2 && !used.has(e)) chains.push({ a, b, closed: false, pts: simplify(walk(e, v), TOL) });
    for (let i = 0; i < list.length; i++) {
      if (used.has(i)) continue;
      const pts = walk(i, k(list[i][0]));
      if (k(pts[0]) === k(pts[pts.length - 1])) pts.pop();
      if (area(pts) < 5) continue; // specks of island
      let m = 1;
      for (let j = 1; j < pts.length; j++) if (Math.hypot(pts[j][0] - pts[0][0], pts[j][1] - pts[0][1]) > Math.hypot(pts[m][0] - pts[0][0], pts[m][1] - pts[0][1])) m = j;
      const first = simplify(pts.slice(0, m + 1), TOL);
      const second = simplify([...pts.slice(m), pts[0]], TOL);
      chains.push({ a, b, closed: true, pts: [...first, ...second.slice(1, -1)] });
    }
  }
  const enc = (pts) => pts.map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(' ');
  const shapesOut = `// Generated by scripts/build-map.mjs from Natural Earth (world-atlas 50m). Do not edit.
/** Territory borders as shared chains: [territory a, territory b (-1 = sea), closed loop?, "x,y x,y ..."] in SVG units. */
export const CHAINS: [number, number, boolean, string][] = ${JSON.stringify(chains.map((c) => [c.a, c.b, c.closed, enc(c.pts)]))};
`;
  writeFileSync('src/data/shapes.generated.ts', shapesOut);
  const pts = chains.reduce((s, c) => s + c.pts.length, 0);
  console.log(`shapes: ${chains.length} chains, ${pts} points, ${(shapesOut.length / 1024).toFixed(0)} KB; empty: ${T.filter((_, i) => !shapes[i].length).map((t) => t[0]).join(',') || 'none'}; unmatched: ${unmatched.join(', ') || 'none'}`);
}
