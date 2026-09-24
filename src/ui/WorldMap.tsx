import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { POWER, REGIONS, TERRITORIES } from '../data/world';
import { capitalOf } from '../engine/game';
import type { GameState } from '../engine/types';
import type { FxEngine } from './fx/particles';
import { GEO, MAP_H, MAP_W, S } from './geometry';

export const NEUTRAL = '#f3f0e6';
const SQ3 = Math.sqrt(3);

export interface Highlight {
  selected: number | null;
  targets: Set<number>;
  mode: 'attack' | 'fortify' | 'card' | 'deploy' | 'none';
  /** Committed target (attack/fortify), if any. */
  aimTo?: number | null;
}

interface Props {
  game: GameState;
  highlight: Highlight;
  onPick: (t: number) => void;
  fx: FxEngine;
  /** Attack odds for the arrow label. */
  odds?: (from: number, to: number) => number;
  overlay?: ReactNode;
  shakeKey?: number;
  shakeLevel?: number;
  /** Screen-space insets (px) the HUD covers, so "fit" frames the world inside them. */
  insets?: { top: number; right: number; bottom: number; left: number };
}

type Box = { x: number; y: number; w: number };


export function WorldMap({ game, highlight, onPick, fx, odds, overlay, shakeKey = 0, shakeLevel = 1, insets }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const view = useRef({ x: 0, y: 0, k: 1 });
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [box, setBox] = useState<Box>({ x: 0, y: 0, w: MAP_W });
  const [hoverT, setHoverT] = useState<number | null>(null);
  const drag = useRef<{ x: number; y: number; box: Box; moved: boolean } | null>(null);
  const pinch = useRef<{ d: number; box: Box; cx: number; cy: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const aspect = size.h / size.w;
  const px = size.w;
  const k = box.w / px;
  const h = box.w * aspect;
  view.current = { x: box.x, y: box.y, k };

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth || 1200, h: el.clientHeight || 800 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clampBox = useCallback(
    (b: Box): Box => {
      const w = Math.min(MAP_W * 1.2, Math.max(MAP_W / 7, b.w));
      const vh = w * aspect;
      const padX = w * 0.2;
      const padY = vh * 0.2;
      const x = Math.min(Math.max(MAP_W - w, 0) + padX, Math.max(Math.min(0, MAP_W - w) - padX, b.x));
      const y = Math.min(Math.max(MAP_H - vh, 0) + padY, Math.max(Math.min(0, MAP_H - vh) - padY, b.y));
      return { w, x, y };
    },
    [aspect],
  );

  const fit = useCallback(() => {
    const ins = insets ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const availW = Math.max(200, size.w - ins.left - ins.right);
    const availH = Math.max(200, size.h - ins.top - ins.bottom);
    // Units per pixel so the whole world fits in the free area.
    const kFit = Math.max(MAP_W / availW, MAP_H / availH) * 1.02;
    const phone = size.w < 760;
    const kk = phone ? kFit / 2.6 : kFit;
    const home = GEO.labels[TERRITORIES.findIndex((t) => t.id === POWER[game.player].capital)];
    const cx = phone ? home[0] : MAP_W / 2;
    const cy = phone ? home[1] : MAP_H / 2;
    // Centre the target in the free area rather than the full canvas.
    const x = cx - (ins.left + availW / 2) * kk;
    const y = cy - (ins.top + availH / 2) * kk;
    setBox(clampBox({ w: size.w * kk, x, y }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h, insets?.top, insets?.right, insets?.bottom, insets?.left, clampBox, game.player]);

  useEffect(() => {
    fit();
  }, [fit]);

  const zoomAt = useCallback(
    (factor: number, sx?: number, sy?: number) => {
      setBox((b) => {
        const k0 = b.w / size.w;
        const fx0 = b.x + (sx ?? size.w / 2) * k0;
        const fy0 = b.y + (sy ?? size.h / 2) * k0;
        const w = b.w * factor;
        const k1 = w / size.w;
        return clampBox({ w, x: fx0 - (sx ?? size.w / 2) * k1, y: fy0 - (sy ?? size.h / 2) * k1 });
      });
    },
    [size.w, size.h, clampBox],
  );

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.deltaY > 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  useEffect(() => {
    fx.attach(canvas.current, () => view.current);
    return () => fx.attach(null, () => view.current);
  }, [fx]);

  useEffect(() => {
    if (!shakeKey || !wrap.current || fx.reduced) return;
    const a = 3 * shakeLevel;
    wrap.current.animate(
      [
        { transform: 'translate(0,0)' },
        { transform: `translate(${-a}px,${a * 0.6}px)` },
        { transform: `translate(${a}px,${-a * 0.4}px)` },
        { transform: `translate(${-a * 0.6}px,${-a * 0.6}px)` },
        { transform: `translate(${a * 0.4}px,${a * 0.3}px)` },
        { transform: 'translate(0,0)' },
      ],
      { duration: 380 + shakeLevel * 120, easing: 'ease-out' },
    );
  }, [shakeKey, shakeLevel, fx]);

  // ---------- pointer handling (drag to pan, pinch to zoom, tap to pick) ----------

  const onDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const r = wrap.current!.getBoundingClientRect();
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), box, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top };
      if (drag.current) drag.current.moved = true;
      return;
    }
    drag.current = { x: e.clientX, y: e.clientY, box, moved: false };
  };

  const onMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = wrap.current!.getBoundingClientRect();
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const p = pinch.current;
      const k0 = p.box.w / size.w;
      const w = p.box.w * (p.d / Math.max(20, d));
      const k1 = w / size.w;
      const fx0 = p.box.x + p.cx * k0;
      const fy0 = p.box.y + p.cy * k0;
      setBox(clampBox({ w, x: fx0 - p.cx * k1, y: fy0 - p.cy * k1 }));
      return;
    }
    const d = drag.current;
    if (e.pointerType === 'mouse') {
      const el = (e.target as Element).closest('[data-t]');
      const next = el && !d?.moved ? Number(el.getAttribute('data-t')) : null;
      if (next !== hoverT) setHoverT(next);
      if (tip.current) {
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        const flip = x > r.width - 260;
        tip.current.style.left = `${flip ? x - 16 : x + 16}px`;
        tip.current.style.top = `${y + 16}px`;
        tip.current.style.transform = flip ? 'translateX(-100%)' : '';
      }
    }
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    setBox(clampBox({ w: d.box.w, x: d.box.x - dx * k, y: d.box.y - dy * k }));
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    setTimeout(() => {
      if (pointers.current.size === 0) drag.current = null;
    }, 0);
  };

  const pick = (t: number) => {
    if (drag.current?.moved) return;
    onPick(t);
  };

  // ---------- derived visuals ----------

  const tokenPx = px < 760 ? 26 : k > 1.3 ? 26 : 30;
  const aimTo =
    highlight.aimTo ??
    (hoverT !== null && highlight.targets.has(hoverT) && (highlight.mode === 'attack' || highlight.mode === 'fortify') ? hoverT : null);
  const aimOdds = useMemo(
    () => (highlight.mode === 'attack' && highlight.selected !== null && aimTo !== null && odds ? odds(highlight.selected, aimTo) : null),
    [highlight.mode, highlight.selected, aimTo, odds],
  );

  return (
    <div className="map-wrap" ref={wrap}>
      <svg
        className="map"
        viewBox={`${box.x} ${box.y} ${box.w} ${h}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={(e) => {
          onUp(e);
          setHoverT(null);
        }}
        role="img"
        aria-label="World map"
      >
        <StaticDefs />
        <rect x={-MAP_W} y={-MAP_H} width={MAP_W * 3} height={MAP_H * 3} className="ocean" />
        <rect x={-MAP_W} y={-MAP_H} width={MAP_W * 3} height={MAP_H * 3} fill="url(#waves)" />
        <StaticUnderlay k={k} />
        <Territories game={game} highlight={highlight} onPick={pick} />
        <StaticOverlay k={k} />
        {[...highlight.targets].map((t) => (
          <path key={t} d={GEO.outlines[t]} className={`target-outline target-${highlight.mode}`} style={{ strokeWidth: 2.2 * k }} />
        ))}
        {highlight.selected !== null && (
          <path d={GEO.outlines[highlight.selected]} className="sel-outline" style={{ strokeWidth: 3 * k }} />
        )}
        {highlight.selected !== null && aimTo !== null && (
          <AimArrow from={highlight.selected} to={aimTo} k={k} mode={highlight.mode} odds={aimOdds} />
        )}
        {game.territories.map((t, i) => (
          <Token
            key={i}
            i={i}
            armies={t.armies}
            owner={t.owner}
            size={tokenPx * k}
            mine={t.owner === game.player}
            dim={
              (highlight.mode === 'attack' || highlight.mode === 'fortify' || highlight.mode === 'card') &&
              highlight.targets.size > 0 &&
              !highlight.targets.has(i) &&
              highlight.selected !== i
            }
            onPick={pick}
          />
        ))}
      </svg>
      <canvas ref={canvas} className="fx-canvas" aria-hidden="true" />
      <div className="map-vignette" aria-hidden="true" />
      <div className="map-tip" ref={tip} hidden={hoverT === null}>
        {hoverT !== null && <TipBody game={game} t={hoverT} />}
      </div>
      {overlay}
      <div className="map-zoom">
        <button type="button" onClick={() => zoomAt(1 / 1.35)} aria-label="Zoom in">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" onClick={() => zoomAt(1.35)} aria-label="Zoom out">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" onClick={fit} aria-label="Fit the world">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ---------- static layers (memoised: they never change) ----------

const StaticDefs = memo(function StaticDefs() {
  const w = SQ3 * S;
  return (
    <defs>
      {/* Ocean: flat printed blue with engraved wave hatching. */}
      <pattern id="waves" width={24} height={10} patternUnits="userSpaceOnUse">
        <path d="M0 6 Q6 3 12 6 T24 6" fill="none" stroke="#a9c3d3" strokeWidth="0.7" />
      </pattern>
      {/* Neutral land: halftone dots on paper. */}
      <pattern id="halftone" width={w / 2} height={w / 2} patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
        <circle cx={w / 4} cy={w / 4} r={0.75} fill="#c9c3b1" />
      </pattern>
      <marker id="arrow-attack" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#111" />
      </marker>
      <marker id="arrow-fortify" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#111" />
      </marker>
    </defs>
  );
});

const StaticUnderlay = memo(function StaticUnderlay({ k }: { k: number }) {
  return (
    <g pointerEvents="none">
      <path d={GEO.coast} className="coast-halo" style={{ strokeWidth: Math.max(6, 8 * k) }} />
      <path d={GEO.lanes} className="lanes" style={{ strokeWidth: 1.4 * k }} />
    </g>
  );
});

const StaticOverlay = memo(function StaticOverlay({ k }: { k: number }) {
  return (
    <g pointerEvents="none">
      <path d={GEO.borders} className="borders" style={{ strokeWidth: Math.max(1.1, 1.5 * k) }} />
      <path d={GEO.regionBorders} className="region-borders" style={{ strokeWidth: Math.max(1.8, 2.6 * k) }} />
      <path d={GEO.coast} className="coast" />
    </g>
  );
});

const Territories = memo(function Territories({
  game,
  highlight,
  onPick,
}: {
  game: GameState;
  highlight: Highlight;
  onPick: (t: number) => void;
}) {
  return (
    <g>
      {GEO.paths.map((d, i) => {
        const o = game.territories[i].owner;
        const target = highlight.targets.has(i);
        const cls = `terr ${target ? `target t-${highlight.mode}` : ''} ${highlight.selected === i ? 'selected' : ''}`;
        return (
          <g key={i}>
            <path d={d} data-t={i} fill={o ? POWER[o].color : NEUTRAL} className={cls} onClick={() => onPick(i)} />
            {!o && <path d={d} fill="url(#halftone)" pointerEvents="none" />}
          </g>
        );
      })}
    </g>
  );
});

// ---------- tokens ----------

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(Math.max(0, Math.min(255, v * f))));
  return `rgb(${c.join(',')})`;
}

const Token = memo(function Token({
  i,
  armies,
  owner,
  size,
  mine,
  dim,
  onPick,
}: {
  i: number;
  armies: number;
  owner: GameState['territories'][number]['owner'];
  size: number;
  mine: boolean;
  dim: boolean;
  onPick: (t: number) => void;
}) {
  const [x, y] = GEO.labels[i];
  const color = owner ? POWER[owner].color : '#ffffff';
  const r = size / 2;
  const depth = r * 0.28;
  const cap = capitalOf(i);
  const light = !owner || owner === 'eu';
  return (
    <g className={`token ${dim ? 'dim' : ''}`} data-t={i} onClick={() => onPick(i)}>
      {/* A wooden disc: edge, face, printed number. */}
      <ellipse cx={x} cy={y + depth} rx={r} ry={r * 0.82} fill={owner ? shade(color, 0.6) : '#b9b4a6'} stroke="#111" strokeWidth={r * 0.1} />
      <ellipse
        key={`f${owner}`}
        cx={x}
        cy={y}
        rx={r}
        ry={r * 0.82}
        fill={color}
        stroke="#111"
        strokeWidth={r * 0.1}
        className="token-face"
      />
      {mine && <ellipse cx={x} cy={y} rx={r * 0.78} ry={r * 0.62} fill="none" stroke={light ? '#111' : '#fff'} strokeWidth={r * 0.07} strokeDasharray={`${r * 0.18} ${r * 0.14}`} />}
      <text key={`n${armies}`} x={x} y={y + r * 0.34} textAnchor="middle" className={`token-num ${light ? 'dark' : ''}`} style={{ fontSize: r * 0.98 }}>
        {armies}
      </text>
      {cap && <path d={star(x + r * 0.95, y - r * 0.75, r * 0.5)} className="token-star" style={{ strokeWidth: r * 0.08 }} />}
    </g>
  );
});

function AimArrow({ from, to, k, mode, odds }: { from: number; to: number; k: number; mode: Highlight['mode']; odds: number | null }) {
  const [x1, y1] = GEO.labels[from];
  const [x2, y2] = GEO.labels[to];
  if (Math.abs(x1 - x2) > MAP_W / 2) return null;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const trim = 16 * k;
  const sx = x1 + (dx / len) * trim;
  const sy = y1 + (dy / len) * trim;
  const ex = x2 - (dx / len) * trim * 1.2;
  const ey = y2 - (dy / len) * trim * 1.2;
  const mx = (sx + ex) / 2 + (-dy / len) * len * 0.18;
  const my = (sy + ey) / 2 + (dx / len) * len * 0.18 - len * 0.1;
  const lx = 0.25 * sx + 0.5 * mx + 0.25 * ex;
  const ly = 0.25 * sy + 0.5 * my + 0.25 * ey;
  const attack = mode === 'attack';
  const pct = odds !== null ? Math.round(odds * 100) : null;
  const tone = pct === null ? '' : pct >= 65 ? 'good' : pct >= 40 ? 'even' : 'bad';
  const d = `M${sx},${sy} Q${mx},${my} ${ex},${ey}`;
  return (
    <g className={`aim ${attack ? 'aim-attack' : 'aim-fortify'}`} pointerEvents="none">
      <path d={d} className="aim-under" style={{ strokeWidth: 9 * k }} />
      <path d={d} className="aim-line" style={{ strokeWidth: 4.5 * k }} markerEnd={`url(#arrow-${attack ? 'attack' : 'fortify'})`} />
      {pct !== null && (
        <g transform={`translate(${lx} ${ly})`}>
          <rect x={-27 * k} y={-13 * k} width={54 * k} height={25 * k} className={`aim-chip ${tone}`} style={{ strokeWidth: 2 * k }} />
          <text y={5.5 * k} textAnchor="middle" className="aim-text" style={{ fontSize: 16 * k }}>
            {pct}%
          </text>
        </g>
      )}
    </g>
  );
}

function TipBody({ game, t }: { game: GameState; t: number }) {
  const def = TERRITORIES[t];
  const st = game.territories[t];
  const region = REGIONS.find((r) => r.id === def.region)!;
  const cap = capitalOf(t);
  return (
    <>
      <span className="tip-region">
        {region.name} · +{region.bonus}
      </span>
      <span className="tip-name">{def.name}</span>
      <span className="tip-meta">
        <i className="pdot" style={{ background: st.owner ? POWER[st.owner].color : NEUTRAL }} />
        {st.owner ? POWER[st.owner].name : 'Minor state'}
        <b>{st.armies}</b>
      </span>
      {cap && <span className="tip-cap">★ Capital of {POWER[cap].name}</span>}
    </>
  );
}

function star(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}
