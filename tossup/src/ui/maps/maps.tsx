import { useMemo, type ReactNode } from 'react';
import geo from '../../data/generated/geo-states.json';
import hex from '../../data/generated/hex-layout.json';
import { useTip } from '../components/bits';

type Geo = Record<string, { d: string; cx: number; cy: number; bbox: number[] }>;
const GEO = geo as Geo;

export interface MapCommon {
  /** Fill for a key (state code or race id); undefined = no race. */
  fill: (key: string) => string | undefined;
  onSelect?: (key: string) => void;
  tip?: (key: string) => ReactNode;
  selected?: string | null;
  hatch?: (key: string) => boolean;
  /** Extra glyph drawn on top (e.g. a check for called races). */
  mark?: (key: string) => string | undefined;
  label: string;
  labels?: boolean;
}

export const HatchDefs = () => (
  <defs>
    <pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="transparent" />
      <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.75)" strokeWidth="2.6" />
    </pattern>
    <pattern id="hatch-dark" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(20,32,54,0.28)" strokeWidth="2.2" />
    </pattern>
  </defs>
);

/* ------------------------------------------------------------------ geographic state map */

const SMALL: Record<string, [number, number]> = {
  VT: [968, 104], NH: [968, 126], MA: [968, 148], RI: [968, 170], CT: [968, 192], NJ: [968, 214], DE: [968, 236], MD: [968, 258], DC: [968, 280],
};

export function StateMap({ fill, onSelect, tip, selected, hatch, mark, label, labels = true }: MapCommon) {
  const { tip: t, show, hide, ref } = useTip<string>();
  return (
    <div className="chart-wrap map-wrap" ref={ref}>
      <svg viewBox="0 0 1010 620" className="chart map" role="img" aria-label={label} onMouseLeave={hide}>
        <HatchDefs />
        {Object.entries(GEO).map(([st, g]) => {
          if (st === 'DC') return null;
          const f = fill(st);
          const isSel = selected === st;
          return (
            <g key={st} className={onSelect ? 'clickable' : ''} onClick={() => onSelect?.(st)} onMouseMove={(e) => tip && show(e, st)}>
              <path d={g.d} fill={f ?? 'var(--rt-none)'} stroke={isSel ? 'var(--ink)' : 'var(--surface)'} strokeWidth={isSel ? 3.2 : 1.6} strokeLinejoin="round" opacity={f ? 1 : 0.55} />
              {hatch?.(st) && <path d={g.d} fill="url(#hatch)" pointerEvents="none" />}
              {!f && <path d={g.d} fill="url(#hatch-dark)" opacity="0.5" pointerEvents="none" />}
            </g>
          );
        })}
        {labels &&
          Object.entries(GEO).map(([st, g]) => {
            if (st === 'DC') return null;
            const w = g.bbox[2] - g.bbox[0];
            const small = SMALL[st];
            if (small) {
              return (
                <g key={st} pointerEvents="none">
                  <line x1={g.cx} y1={g.cy} x2={small[0] - 4} y2={small[1] - 4} stroke="var(--ink-3)" strokeWidth="1" />
                  <text x={small[0]} y={small[1]} className="map-label" textAnchor="start">{st}</text>
                </g>
              );
            }
            if (w < 22) return null;
            const m = mark?.(st);
            return (
              <text key={st} x={g.cx} y={g.cy + 4} className="map-label on" textAnchor="middle" pointerEvents="none">
                {st}
                {m ? ` ${m}` : ''}
              </text>
            );
          })}
      </svg>
      {t && (
        <div className="tip" style={{ left: t.x, top: t.y }}>
          {tip?.(t.data)}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ tile grid map */

const TILES: Record<string, [number, number]> = {
  AK: [0, 0], ME: [10, 0], VT: [9, 1], NH: [10, 1],
  WA: [0, 2], ID: [1, 2], MT: [2, 2], ND: [3, 2], MN: [4, 2], IL: [5, 2], WI: [6, 2], MI: [7, 2], NY: [8, 2], RI: [9, 2], MA: [10, 2],
  OR: [0, 3], NV: [1, 3], WY: [2, 3], SD: [3, 3], IA: [4, 3], IN: [5, 3], OH: [6, 3], PA: [7, 3], NJ: [8, 3], CT: [9, 3],
  CA: [0, 4], UT: [1, 4], CO: [2, 4], NE: [3, 4], MO: [4, 4], KY: [5, 4], WV: [6, 4], VA: [7, 4], MD: [8, 4], DE: [9, 4],
  AZ: [1, 5], NM: [2, 5], KS: [3, 5], AR: [4, 5], TN: [5, 5], NC: [6, 5], SC: [7, 5],
  OK: [3, 6], LA: [4, 6], MS: [5, 6], AL: [6, 6], GA: [7, 6],
  HI: [0, 7], TX: [3, 7], FL: [7, 7],
};

export function TileMap({ fill, onSelect, tip, selected, hatch, mark, label }: MapCommon) {
  const { tip: t, show, hide, ref } = useTip<string>();
  const S = 54;
  const G = 5;
  return (
    <div className="chart-wrap map-wrap" ref={ref}>
      <svg viewBox={`0 0 ${11 * (S + G)} ${8 * (S + G)}`} className="chart map" role="img" aria-label={label} onMouseLeave={hide}>
        <HatchDefs />
        {Object.entries(TILES).map(([st, [c, r]]) => {
          const f = fill(st);
          const x = c * (S + G);
          const y = r * (S + G);
          const m = mark?.(st);
          return (
            <g key={st} className={onSelect ? 'clickable' : ''} onClick={() => onSelect?.(st)} onMouseMove={(e) => tip && show(e, st)}>
              <rect x={x} y={y} width={S} height={S} rx="9" fill={f ?? 'var(--rt-none)'} opacity={f ? 1 : 0.55} stroke={selected === st ? 'var(--ink)' : 'none'} strokeWidth="3" />
              {hatch?.(st) && <rect x={x} y={y} width={S} height={S} rx="9" fill="url(#hatch)" pointerEvents="none" />}
              <text x={x + S / 2} y={y + S / 2 + (m ? -1 : 5)} textAnchor="middle" className={`map-label ${f ? 'on' : ''}`} pointerEvents="none">
                {st}
              </text>
              {m && (
                <text x={x + S / 2} y={y + S / 2 + 14} textAnchor="middle" className="map-label on" style={{ fontSize: 11 }} pointerEvents="none">
                  {m}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {t && (
        <div className="tip" style={{ left: t.x, top: t.y }}>
          {tip?.(t.data)}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ hex cartogram */

const S = hex.size;
const HEXPTS = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i - 30);
  return [S * Math.cos(a), S * Math.sin(a)];
});
const HEXPATH = 'M' + HEXPTS.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('L') + 'Z';

/** State-border segments: edges shared with a hex of another state (or with empty space). */
const BORDERS: string = (() => {
  const W = Math.sqrt(3) * S;
  const idx = new Map<string, string>();
  const k = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
  for (const c of hex.cells) idx.set(k(c.x, c.y), c.st);
  const segs: string[] = [];
  for (const c of hex.cells) {
    for (let d = 0; d < 6; d++) {
      const th = (Math.PI / 180) * (60 * d);
      const nb = idx.get(k(c.x + W * Math.cos(th), c.y + W * Math.sin(th)));
      if (nb === c.st) continue;
      const a1 = th - Math.PI / 6;
      const a2 = th + Math.PI / 6;
      segs.push(`M${(c.x + S * Math.cos(a1)).toFixed(1)},${(c.y + S * Math.sin(a1)).toFixed(1)}L${(c.x + S * Math.cos(a2)).toFixed(1)},${(c.y + S * Math.sin(a2)).toFixed(1)}`);
    }
  }
  return segs.join('');
})();

export function HexMap({ fill, onSelect, tip, selected, hatch, mark, label, labels = true, mini = false }: MapCommon & { mini?: boolean }) {
  const { tip: t, show, hide, ref } = useTip<string>();
  const cells = useMemo(() => hex.cells, []);
  const pad = 16;
  return (
    <div className="chart-wrap map-wrap" ref={ref}>
      <svg viewBox={`${-pad} ${-pad} ${hex.width + pad * 2} ${hex.height + pad * 2}`} className="chart map" role="img" aria-label={label} onMouseLeave={hide}>
        <HatchDefs />
        {cells.map((c) => {
          const id = `house-${c.st.toLowerCase()}-${String(c.d).padStart(2, '0')}`;
          const f = fill(id);
          const isSel = selected === id;
          return (
            <g key={id} transform={`translate(${c.x},${c.y})`} className={onSelect ? 'clickable' : ''} onClick={() => onSelect?.(id)} onMouseMove={(e) => tip && !mini && show(e, id)}>
              <path d={HEXPATH} fill={f ?? 'var(--rt-none)'} stroke="var(--surface)" strokeWidth={mini ? 0.8 : 1.6} strokeLinejoin="round" transform="scale(0.98)" />
              {hatch?.(id) && <path d={HEXPATH} fill="url(#hatch)" pointerEvents="none" transform="scale(0.9)" />}
              {isSel && <path d={HEXPATH} fill="none" stroke="var(--ink)" strokeWidth="3" transform="scale(0.98)" pointerEvents="none" />}
              {mark?.(id) && <circle r="3" fill="#fff" stroke="var(--ink)" strokeWidth="1" pointerEvents="none" />}
            </g>
          );
        })}
        <path d={BORDERS} fill="none" stroke="var(--ink)" strokeOpacity="0.5" strokeWidth={mini ? 0.9 : 1.8} strokeLinecap="round" pointerEvents="none" />
        {labels &&
          !mini &&
          Object.entries(hex.labels).map(([st, p]) =>
            p.n >= 3 ? (
              <text key={st} x={p.x} y={p.y + 4} textAnchor="middle" className="hex-label" pointerEvents="none">
                {st}
              </text>
            ) : null,
          )}
      </svg>
      {t && (
        <div className="tip" style={{ left: t.x, top: t.y }}>
          {tip?.(t.data)}
        </div>
      )}
    </div>
  );
}
