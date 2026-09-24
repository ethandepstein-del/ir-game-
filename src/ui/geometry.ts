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

function build() {
  const paths: string[] = TERRITORIES.map(() => '');
  const outlines: string[] = TERRITORIES.map(() => '');
  let borders = '';
  let regionBorders = '';
  let coast = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = cell(c, r);
      if (t < 0) continue;
      const [cx, cy] = center(c, r);
      const pts = [0, 1, 2, 3, 4, 5].map((k) => corner(cx, cy, k));
      paths[t] += `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join('L')}Z`;
      for (let k = 0; k < 6; k++) {
        const [nc, nr] = across(c, r, k);
        const u = cell(nc, nr);
        if (u === t) continue;
        const [x1, y1] = pts[k];
        const [x2, y2] = pts[(k + 1) % 6];
        const seg = `M${f(x1)},${f(y1)}L${f(x2)},${f(y2)}`;
        outlines[t] += seg;
        if (u < 0) coast += seg;
        else if (u > t) {
          if (TERRITORIES[u].region !== TERRITORIES[t].region) regionBorders += seg;
          else borders += seg;
        }
      }
    }
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
  return { paths, outlines, borders, regionBorders, coast, labels, lanes };
}

export const GEO = build();

