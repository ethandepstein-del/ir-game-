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
