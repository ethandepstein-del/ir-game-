import { ALPHA, COLS, DRAWN_LANES, GRID, ROWS } from '../data/map.generated';
import { CHAINS } from '../data/shapes.generated';
import { TERRITORIES } from '../data/world';

/** Hex size in SVG units (centre to corner). */
export const S = 8;
const SQ3 = Math.sqrt(3);
export const MAP_W = (COLS * SQ3 + SQ3 / 2) * S;
export const MAP_H = ((ROWS - 1) * 1.5 + 2) * S;

export function center(col: number, row: number): [number, number] {
  return [(col * SQ3 + (row % 2 ? SQ3 / 2 : 0) + SQ3 / 2) * S, (row * 1.5 + 1) * S];
}


const cell = (col: number, row: number): number => {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return -1;
  const ch = GRID[row][col];
  return ch === '.' ? -1 : ALPHA.indexOf(ch);
};


const f = (n: number) => n.toFixed(1);

type P2 = [number, number];
const key = ([x, y]: P2) => `${x.toFixed(2)},${y.toFixed(2)}`;
const ring = (pts: P2[]) => `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join('L')}Z`;
const line = (pts: P2[]) => `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join('L')}`;

interface Chain {
  a: number;
  b: number;
  pts: P2[];
  closed: boolean;
}

function build() {
  // Real borders (Natural Earth, cut and merged per territory by scripts/build-map.mjs),
  // stored as shared chains so neighbouring territories meet exactly.
  const chains: Chain[] = CHAINS.map(([a, b, closed, d]) => ({
    a,
    b,
    closed,
    pts: d.split(' ').map((xy) => xy.split(',').map(Number) as P2),
  }));

  // 3. Assemble each territory's rings from its chains, end to end.
  const paths: string[] = TERRITORIES.map(() => '');
  const outlines: string[] = TERRITORIES.map(() => '');
  const mine: Chain[][] = TERRITORIES.map(() => []);
  for (const ch of chains) {
    if (ch.a >= 0) mine[ch.a].push(ch);
    if (ch.b >= 0) mine[ch.b].push(ch);
  }
  mine.forEach((list, t) => {
    const left = new Set(list.map((_, i) => i));
    let d = '';
    for (const i of list.keys()) {
      if (!left.has(i)) continue;
      left.delete(i);
      const first = list[i];
      if (first.closed) {
        d += ring(first.pts);
        continue;
      }
      const pts = first.pts.slice();
      const startKey = key(pts[0]);
      for (let guard = 0; guard < 500 && key(pts[pts.length - 1]) !== startKey; guard++) {
        const endKey = key(pts[pts.length - 1]);
        let found = -1;
        let rev = false;
        for (const j of left) {
          if (list[j].closed) continue;
          if (key(list[j].pts[0]) === endKey) found = j;
          else if (key(list[j].pts[list[j].pts.length - 1]) === endKey) (found = j), (rev = true);
          if (found >= 0) break;
        }
        if (found < 0) break;
        left.delete(found);
        const seg = rev ? list[found].pts.slice().reverse() : list[found].pts;
        pts.push(...seg.slice(1));
      }
      d += ring(pts);
    }
    paths[t] = d;
    outlines[t] = d;
  });

  // 4. Line work: coasts, borders inside a region, borders between regions.
  let borders = '';
  let regionBorders = '';
  let coast = '';
  for (const ch of chains) {
    const d = ch.closed ? ring(ch.pts) : line(ch.pts);
    if (ch.b < 0) coast += d;
    else if (TERRITORIES[ch.a].region !== TERRITORIES[ch.b].region) regionBorders += d;
    else borders += d;
  }

  const labels = TERRITORIES.map((t) => center(t.label[0], t.label[1]));
  const lanes = DRAWN_LANES.map(([a, b]) => {
    const [x1, y1] = labels[a];
    const [x2, y2] = labels[b];
    if (Math.abs(x1 - x2) > MAP_W / 2) {
      // Wraps around the map edge (Bering Strait).
      const [lx, ly, rx, ry] = x1 < x2 ? [x1, y1, x2, y2] : [x2, y2, x1, y1];
      const my = (ly + ry) / 2;
      return `M${f(lx)},${f(ly)}L0,${f(my)}M${f(rx)},${f(ry)}L${f(MAP_W)},${f(my)}`;
    }
    return `M${f(x1)},${f(y1)}L${f(x2)},${f(y2)}`;
  }).join('');
  /** All land as one shape, for the shadow the paper pieces cast on the sea. */
  const land = paths.join('');
  return { paths, outlines, borders, regionBorders, coast, labels, lanes, land };
}

export const GEO = build();


/** Nudge every vertex by a small, repeatable amount so a ruled line reads as drawn by hand. */
export function wobble(d: string, amp: number, salt = 0): string {
  return d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, xs: string, ys: string) => {
    const x = Number(xs);
    const y = Number(ys);
    const h = Math.sin(x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453;
    const g = Math.sin(x * 39.3468 + y * 11.135 + salt * 91.123) * 24634.6345;
    return `${f(x + (h - Math.floor(h) - 0.5) * 2 * amp)},${f(y + (g - Math.floor(g) - 0.5) * 2 * amp)}`;
  });
}

/** Hand-inked versions of the static lines, computed once. */
export const INKED = {
  regionBorders: wobble(GEO.regionBorders, 0.9, 1),
  regionBorders2: wobble(GEO.regionBorders, 1.1, 2),
  coast: wobble(GEO.coast, 0.7, 3),
};

/** Open-ocean cells at least three hexes from any land: where the whales live. */
export const OCEAN_SPOTS: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let r = 4; r < ROWS - 4; r += 3) {
    for (let c = 3; c < COLS - 3; c += 3) {
      let open = true;
      for (let dr = -3; dr <= 3 && open; dr++) for (let dc = -3; dc <= 3 && open; dc++) if (cell(c + dc, r + dr) >= 0) open = false;
      if (open) out.push(center(c, r));
    }
  }
  return out;
})();

/** Sea lanes that don't wrap the map edge, as pairs of label points: where the paper boats sail. */
export const LANE_ENDS: [[number, number], [number, number]][] = DRAWN_LANES.map(([a, b]) => [GEO.labels[a], GEO.labels[b]] as [[number, number], [number, number]]).filter(
  ([p, q]) => Math.abs(p[0] - q[0]) < MAP_W / 2,
);
