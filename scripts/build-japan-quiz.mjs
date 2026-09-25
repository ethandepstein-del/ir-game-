// Builds the Japan geography quiz page from Natural Earth (world-atlas 10m) borders.
// Projects two views (East Asia region, Japan close-up), splits Japan into its main
// islands, and inlines everything into quiz/japan-geography.html from the template.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { geoConicConformal, geoPath, geoGraticule, geoArea } from 'd3-geo';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const world = require('world-atlas/countries-10m.json');
const countries = feature(world, world.objects.countries).features;
const byName = (n) => countries.find((c) => c.properties.name === n);

// ---- Split Japan into islands ------------------------------------------------
const japan = byName('Japan');
const japanPolys = japan.geometry.coordinates.map((p) => ({
  poly: p,
  area: geoArea({ type: 'Polygon', coordinates: p }),
  lon: p[0].reduce((s, q) => s + q[0], 0) / p[0].length,
  lat: p[0].reduce((s, q) => s + q[1], 0) / p[0].length,
}));
const biggest = (pred) => japanPolys.filter(pred).sort((a, b) => b.area - a.area)[0];
const hokkaido = biggest((p) => p.lat > 41.5);
const honshu = biggest(() => true);
const shikoku = biggest((p) => p.lat > 32.6 && p.lat < 34.5 && p.lon > 132.3 && p.lon < 134.9);
const kyushu = biggest((p) => p.lat > 30.9 && p.lat < 34 && p.lon > 129.4 && p.lon < 132.2);
const okinawa = biggest((p) => p.lat > 26 && p.lat < 27 && p.lon > 127.5 && p.lon < 128.5);
const groups = { hokkaido: [], honshu: [], shikoku: [], kyushu: [], okinawa: [], ryukyu: [], japan: [] };
for (const p of japanPolys) {
  if (p === hokkaido) groups.hokkaido.push(p.poly);
  else if (p === honshu) groups.honshu.push(p.poly);
  else if (p === shikoku) groups.shikoku.push(p.poly);
  else if (p === kyushu) groups.kyushu.push(p.poly);
  else if (p === okinawa) groups.okinawa.push(p.poly);
  else if (p.lat < 30.5 && p.lat > 24 && p.lon > 122.8 && p.lon < 131.5) groups.ryukyu.push(p.poly);
  else groups.japan.push(p.poly);
}
const mp = (polys) => ({ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: polys } });

const land = [
  ['mongolia', byName('Mongolia')],
  ['russia', byName('Russia')],
  ['china', byName('China')],
  ['nkorea', byName('North Korea')],
  ['skorea', byName('South Korea')],
  ['taiwan', byName('Taiwan')],
  ['japan', mp(groups.japan)],
  ['ryukyu', mp(groups.ryukyu)],
  ['okinawa', mp(groups.okinawa)],
  ['hokkaido', mp(groups.hokkaido)],
  ['honshu', mp(groups.honshu)],
  ['shikoku', mp(groups.shikoku)],
  ['kyushu', mp(groups.kyushu)],
];

// Rough water outlines [lon, lat] used as tap targets under the land.
const seas = {
  okhotsk: [[137.5, 54.2], [138, 55.8], [143, 59.8], [150, 60], [155.5, 58], [156.8, 51], [153, 48.5], [148, 45.3], [145.8, 43.5], [144.5, 43.6], [142.5, 44.3], [142.8, 46.8], [142.5, 49.5], [142.8, 53], [141, 53.8]],
  japan: [[127.5, 39.6], [128.8, 36.5], [129, 35.2], [129.3, 34.6], [131, 34], [133, 35], [136, 35.3], [139.5, 37.5], [140.5, 40], [140.3, 42.5], [141.2, 43], [142, 45.5], [142.3, 48.5], [140.5, 49], [138.5, 47], [136.5, 45], [133, 43.5], [131, 43.3], [129.8, 41.2]],
  yellow: [[118.5, 36.8], [117.5, 38.8], [119.5, 40.6], [122, 41.2], [124.5, 40.3], [125.6, 38.5], [127, 37.3], [126.6, 34.5], [125, 33.5], [123, 33.1], [121, 33.3], [119.8, 34.3]],
  ecs: [[120.8, 33.2], [123, 33.1], [125, 33.5], [127, 34], [129.3, 34.6], [130, 33.2], [130.5, 31], [130.8, 30.2], [129.2, 28.3], [127.5, 26.3], [125.5, 24.8], [123, 24.3], [121.9, 25.1], [120.3, 26.5], [121.2, 28.6], [121.5, 30.3], [120.8, 31.8]],
};

const cities = {
  sendai: [140.87, 38.27], tokyo: [139.69, 35.69], yokohama: [139.64, 35.44], kamakura: [139.55, 35.32],
  nagoya: [136.91, 35.18], kyoto: [135.77, 35.01], nara: [135.8, 34.69], osaka: [135.5, 34.69],
  hiroshima: [132.46, 34.39], nagasaki: [129.87, 32.75],
};

// Where study-mode labels sit [lon, lat].
const labelAt = {
  hokkaido: [142.8, 43.4], honshu: [138.9, 37.2], shikoku: [133.5, 33.7], kyushu: [130.8, 32.4],
  ryukyu: [129.4, 28.4], okinawa: [128.4, 26.1],
  okhotsk: [149, 53.5], japan: [135.3, 41.6], yellow: [122.9, 35.4], ecs: [124.6, 30.4],
  russia: [131.5, 49.5], china: [113.5, 33], nkorea: [126.4, 40.3], skorea: [128.1, 36.6], taiwan: [121, 23.6],
  mongolia: [111, 45],
};

// ---- Projection + path helpers ----------------------------------------------
function view({ w, lon0, lon1, lat0, lat1, minArea }) {
  const edge = [];
  for (let i = 0; i <= 20; i++) {
    const lon = lon0 + ((lon1 - lon0) * i) / 20, lat = lat0 + ((lat1 - lat0) * i) / 20;
    edge.push([lon, lat0], [lon, lat1], [lon0, lat], [lon1, lat]);
  }
  const proj = geoConicConformal().parallels([30, 45]).rotate([-(lon0 + lon1) / 2, 0])
    .fitWidth(w, { type: 'MultiPoint', coordinates: edge });
  const ys = edge.map((p) => proj(p)[1]);
  const h = Math.round(Math.max(...ys) - Math.min(...ys));
  proj.fitExtent([[0, 0], [w, h]], { type: 'MultiPoint', coordinates: edge }).clipExtent([[-2, -2], [w + 2, h + 2]]);

  const toD = (geo, min = minArea) => {
    const rings = [];
    let cur = null;
    geoPath(proj, {
      moveTo(x, y) { cur = [[x, y]]; },
      lineTo(x, y) {
        const [px, py] = cur[cur.length - 1];
        if (Math.hypot(x - px, y - py) >= 0.7) cur.push([x, y]);
      },
      closePath() { rings.push({ pts: cur, closed: true }); cur = null; },
      lineEnd() {},
      arc() {},
    })(geo);
    if (cur) rings.push({ pts: cur, closed: false });
    return rings
      .filter((r) => {
        if (!r.closed) return r.pts.length > 1;
        let a = 0;
        for (let i = 0, n = r.pts.length; i < n; i++) {
          const [x1, y1] = r.pts[i], [x2, y2] = r.pts[(i + 1) % n];
          a += x1 * y2 - x2 * y1;
        }
        return Math.abs(a / 2) >= min && r.pts.length > 2;
      })
      .map((r) => 'M' + r.pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + (r.closed ? 'Z' : ''))
      .join('');
  };
  const pt = (ll) => proj(ll).map((v) => +v.toFixed(1));
  return { w, h, proj, toD, pt };
}

function build(cfg) {
  const v = view(cfg);
  return {
    w: v.w,
    h: v.h,
    grid: v.toD(geoGraticule().step([5, 5])(), 0),
    land: land.map(([id, f]) => ({ id, d: v.toD(f, ['ryukyu', 'okinawa'].includes(id) ? 0.3 : cfg.minArea) })).filter((s) => s.d),
    seas: Object.entries(seas).map(([id, ring]) => {
      // d3 wants small polygons wound clockwise; flip any ring that came out as "the whole globe minus a hole".
      let poly = { type: 'Polygon', coordinates: [[...ring, ring[0]]] };
      if (geoArea(poly) > 2 * Math.PI) poly = { type: 'Polygon', coordinates: [[...ring, ring[0]].reverse()] };
      return { id, d: v.toD(poly, 0) };
    }).filter((s) => s.d),
    cities: Object.entries(cities).map(([id, ll]) => ({ id, p: v.pt(ll) })),
    labels: Object.fromEntries(Object.entries(labelAt).map(([id, ll]) => [id, v.pt(ll)])),
  };
}

const data = {
  region: build({ w: 1000, lon0: 110, lon1: 157, lat0: 20.5, lat1: 56.5, minArea: 1.5 }),
  japan: build({ w: 900, lon0: 128.4, lon1: 146.2, lat0: 30.6, lat1: 45.8, minArea: 2 }),
};

const tpl = readFileSync(new URL('../quiz/template.html', import.meta.url), 'utf8');
const out = tpl.replace('/*__MAP_DATA__*/null', JSON.stringify(data));
writeFileSync(new URL('../quiz/japan-geography.html', import.meta.url), out);
console.log(`wrote quiz/japan-geography.html (${(out.length / 1024).toFixed(0)} KB)`);
