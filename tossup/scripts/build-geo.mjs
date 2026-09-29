// Builds src/data/generated/geo-states.json: one SVG path per state (Albers USA, 975x610),
// plus a label anchor. Source: us-atlas (Census cartographic boundaries).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { feature } from 'topojson-client';
import { geoPath } from 'd3-geo';

const topo = JSON.parse(readFileSync('node_modules/us-atlas/states-albers-10m.json', 'utf8'));
const fc = feature(topo, topo.objects.states);
const path = geoPath().digits(1);

const FIPS = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC',
  '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY',
  '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT',
  '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH',
  '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY',
};

const out = {};
for (const f of fc.features) {
  const id = String(f.id).padStart(2, '0');
  const st = FIPS[id];
  if (!st) continue;
  const c = path.centroid(f);
  const b = path.bounds(f);
  out[st] = { d: path(f), cx: +c[0].toFixed(1), cy: +c[1].toFixed(1), bbox: b.flat().map((n) => +n.toFixed(1)) };
}
mkdirSync('src/data/generated', { recursive: true });
writeFileSync('src/data/generated/geo-states.json', JSON.stringify(out));
console.log('states:', Object.keys(out).length, 'bytes:', JSON.stringify(out).length);
