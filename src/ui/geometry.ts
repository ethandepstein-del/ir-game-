import { ALPHA, COLS, DRAWN_LANES, GRID, ROWS } from '../data/map.generated';
import { TERRITORIES } from '../data/world';

/** Hex size in SVG units (centre to corner). */
export const S = 8;
const SQ3 = Math.sqrt(3);
export const MAP_W = (COLS * SQ3 + SQ3 / 2) * S;
export const MAP_H = ((ROWS - 1) * 1.5 + 2) * S;

export function center(col: number, row: number): [number, number] {
  return [(col * SQ3 + (row % 2 ? SQ3 / 2 : 0) + SQ3 / 2) * S, (row * 1.5 + 1) * S];
}

function corner(cx: number, cy: number, k: number): [number, number] {
  const a = ((60 * k - 30) * Math.PI) / 180;
  return [cx + S * Math.cos(a), cy + S * Math.sin(a)];
}

const cell = (col: number, row: number): number => {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return -1;
  const ch = GRID[row][col];
  return ch === '.' ? -1 : ALPHA.indexOf(ch);
};

/** Neighbour across edge k (between corner k and k+1). */
function across(col: number, row: number, k: number): [number, number] {
  const odd = row % 2 === 1;
  switch (k) {
    case 0: return [col + 1, row];
    case 1: return odd ? [col + 1, row + 1] : [col, row + 1];
    case 2: return odd ? [col, row + 1] : [col - 1, row + 1];
    case 3: return [col - 1, row];
    case 4: return odd ? [col, row - 1] : [col - 1, row - 1];
    default: return odd ? [col + 1, row - 1] : [col, row - 1];
  }
}

const f = (n: number) => n.toFixed(1);

type P2 = [number, number];
const key = ([x, y]: P2) => `${x.toFixed(2)},${y.toFixed(2)}`;
const ring = (pts: P2[]) => `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join('L')}Z`;
const line = (pts: P2[]) => `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join('L')}`;

/**
 * Taubin smoothing (shrink-free Laplacian) then Chaikin corner cutting. Ends of an
 * open chain stay put so neighbouring chains still meet exactly at junctions.
 */
function smooth(pts: P2[], closed: boolean): P2[] {
  let p = pts.map((q) => [q[0], q[1]] as P2);
  const n = p.length;
  if (n < 3) return p;
  const pass = (w: number) => {
    const out = p.map((q) => [q[0], q[1]] as P2);
    for (let i = 0; i < n; i++) {
      if (!closed && (i === 0 || i === n - 1)) continue;
      const a = p[(i - 1 + n) % n];
      const b = p[(i + 1) % n];
      out[i] = [p[i][0] + w * ((a[0] + b[0]) / 2 - p[i][0]), p[i][1] + w * ((a[1] + b[1]) / 2 - p[i][1])];
    }
    p = out;
  };
  for (let k = 0; k < 6; k++) {
    pass(0.6);
    pass(-0.62);
  }
  for (let k = 0; k < 2; k++) {
    const out: P2[] = closed ? [] : [p[0]];
    const m = closed ? p.length : p.length - 1;
    for (let i = 0; i < m; i++) {
      const a = p[i];
      const b = p[(i + 1) % p.length];
      out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    if (!closed) out.push(p[p.length - 1]);
    p = out;
  }
  return p;
}

/** Douglas–Peucker: drop points that sit within `tol` of the line through their neighbours. */
function simplify(pts: P2[], tol: number): P2[] {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    const [ax, ay] = pts[i];
    const [bx, by] = pts[j];
    const len = Math.hypot(bx - ax, by - ay) || 1e-9;
    let far = -1;
    let dmax = tol;
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs((bx - ax) * (ay - pts[k][1]) - (ax - pts[k][0]) * (by - ay)) / len;
      if (d > dmax) (dmax = d), (far = k);
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([i, far], [far, j]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

interface Chain {
  a: number;
  b: number;
  pts: P2[];
  closed: boolean;
}

function build() {
  // 1. Every hex edge that separates two different owners (or land from sea), grouped by the pair.
  const byPair = new Map<string, [P2, P2][]>();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = cell(c, r);
      if (t < 0) continue;
      const [cx, cy] = center(c, r);
      const pts = [0, 1, 2, 3, 4, 5].map((k) => corner(cx, cy, k));
      for (let k = 0; k < 6; k++) {
        const [nc, nr] = across(c, r, k);
        const u = cell(nc, nr);
        if (u === t || (u >= 0 && u < t)) continue; // each shared edge once
        const id = `${t}|${u}`;
        if (!byPair.has(id)) byPair.set(id, []);
        byPair.get(id)!.push([pts[k], pts[(k + 1) % 6]]);
      }
    }
  }

  // 2. Link each pair's edges into chains: open between junctions, or closed loops (islands, enclaves).
  const chains: Chain[] = [];
  for (const [id, edges] of byPair) {
    const [a, b] = id.split('|').map(Number);
    const adj = new Map<string, number[]>();
    edges.forEach(([p, q], i) => {
      for (const v of [key(p), key(q)]) {
        if (!adj.has(v)) adj.set(v, []);
        adj.get(v)!.push(i);
      }
    });
    const used = new Set<number>();
    const walk = (startEdge: number, from: string): { pts: P2[]; end: string } => {
      const pts: P2[] = [];
      let e = startEdge;
      let at = from;
      const [p0, q0] = edges[e];
      pts.push(key(p0) === at ? p0 : q0);
      for (;;) {
        used.add(e);
        const [p, q] = edges[e];
        const next = key(p) === at ? q : p;
        pts.push(next);
        at = key(next);
        const cand = (adj.get(at) ?? []).filter((i) => !used.has(i));
        if (!cand.length) return { pts, end: at };
        e = cand[0];
      }
    };
    // Open chains start at vertices of degree 1 within this pair.
    for (const [v, list] of adj) {
      if (list.length !== 1 || used.has(list[0])) continue;
      const { pts } = walk(list[0], v);
      chains.push({ a, b, pts, closed: false });
    }
    // Whatever is left are closed loops.
    for (let i = 0; i < edges.length; i++) {
      if (used.has(i)) continue;
      const { pts } = walk(i, key(edges[i][0]));
      pts.pop();
      chains.push({ a, b, pts, closed: true });
    }
  }
  for (const ch of chains) {
    const sm = smooth(ch.pts, ch.closed);
    if (!ch.closed) {
      ch.pts = simplify(sm, 0.35);
      continue;
    }
    // A loop is split at its farthest point from the start, and each half simplified.
    let m = 1;
    for (let i = 1; i < sm.length; i++) if (Math.hypot(sm[i][0] - sm[0][0], sm[i][1] - sm[0][1]) > Math.hypot(sm[m][0] - sm[0][0], sm[m][1] - sm[0][1])) m = i;
    const first = simplify(sm.slice(0, m + 1), 0.35);
    const second = simplify([...sm.slice(m), sm[0]], 0.35);
    ch.pts = [...first, ...second.slice(1, -1)];
  }

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
