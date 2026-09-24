import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { POWER, TERRITORIES } from '../data/world';
import { capitalOf } from '../engine/game';
import type { GameState } from '../engine/types';
import type { FxEngine } from './fx/particles';
import { GEO, MAP_H, MAP_W } from './geometry';

const NEUTRAL = '#56606d';

export interface Highlight {
  selected: number | null;
  targets: Set<number>;
  mode: 'attack' | 'fortify' | 'card' | 'deploy' | 'none';
}

interface Props {
  game: GameState;
  highlight: Highlight;
  onPick: (t: number) => void;
  fx: FxEngine;
  overlay?: ReactNode;
  shakeClass?: string;
  shakeKey?: number;
}

type Box = { x: number; y: number; w: number };
const FULL: Box = { x: 0, y: 0, w: MAP_W };

export function WorldMap({ game, highlight, onPick, fx, overlay, shakeClass = '', shakeKey = 0 }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef({ x: 0, y: 0, k: 1 });
  const [box, setBox] = useState<Box>(FULL);
  const [size, setSize] = useState({ w: 1000, h: 1000 * (MAP_H / MAP_W) });
  const drag = useRef<{ x: number; y: number; box: Box; moved: boolean } | null>(null);
  const px = size.w;
  const aspect = size.h / size.w;
  const h = box.w * aspect;
  const home = GEO.labels[TERRITORIES.findIndex((t) => t.id === POWER[game.player].capital)];

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth || 1000, h: el.clientHeight || 600 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clampBox = useCallback(
    (b: Box): Box => {
      const maxW = Math.min(MAP_W, MAP_H / aspect);
      const w = Math.min(maxW, Math.max(MAP_W / 6, b.w));
      const vh = w * aspect;
      const y = vh >= MAP_H ? (MAP_H - vh) / 2 : Math.min(MAP_H - vh, Math.max(0, b.y));
      return { w, x: Math.min(MAP_W - w, Math.max(0, b.x)), y };
    },
    [aspect],
  );

  const fit = useCallback(() => {
    // Phones start zoomed in on your capital; wide screens see the whole world.
    const w = px < 700 ? MAP_W / 3 : MAP_W;
    setBox(clampBox({ w, x: home[0] - w / 2, y: home[1] - (w * aspect) / 2 }));
  }, [px, aspect, clampBox, home]);

  useEffect(() => {
    fit();
    // Refit only when the container changes shape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [px, aspect]);

  const zoom = useCallback(
    (factor: number, cx?: number, cy?: number) => {
      setBox((b) => {
        const fx = cx ?? b.x + b.w / 2;
        const fy = cy ?? b.y + (b.w * aspect) / 2;
        const w = b.w * factor;
        return clampBox({ w, x: fx - ((fx - b.x) / b.w) * w, y: fy - ((fy - b.y) / (b.w * aspect)) * w * aspect });
      });
    },
    [aspect, clampBox],
  );

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setBox((b) => {
        const k = b.w / r.width;
        const cx = b.x + (e.clientX - r.left) * k;
        const cy = b.y + (e.clientY - r.top) * k;
        const w = b.w * (e.deltaY > 0 ? 1.15 : 1 / 1.15);
        return clampBox({ w, x: cx - ((cx - b.x) / b.w) * w, y: cy - ((cy - b.y) / b.w) * w });
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clampBox]);

  const k = box.w / px; // SVG units per screen pixel
  const r = (px < 700 ? 11 : 9.5) * k;
  view.current = { x: box.x, y: box.y, k };

  useEffect(() => {
    fx.attach(canvas.current, () => view.current);
    return () => fx.attach(null, () => view.current);
  }, [fx]);

  useEffect(() => {
    if (!shakeKey || !wrap.current || fx.reduced) return;
    const level = Number(shakeClass.replace('shake-', '')) || 1;
    const a = 3 * level;
    wrap.current.animate(
      [
        { transform: 'translate(0,0)' },
        { transform: `translate(${-a}px,${a * 0.6}px)` },
        { transform: `translate(${a}px,${-a * 0.4}px)` },
        { transform: `translate(${-a * 0.6}px,${-a * 0.6}px)` },
        { transform: `translate(${a * 0.4}px,${a * 0.3}px)` },
        { transform: 'translate(0,0)' },
      ],
      { duration: 380 + level * 120, easing: 'ease-out' },
    );
  }, [shakeKey, shakeClass, fx]);

  const radar = { left: (home[0] - box.x) / k, top: (home[1] - box.y) / k };

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, box, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setBox(clampBox({ w: d.box.w, x: d.box.x - dx * k, y: d.box.y - dy * k }));
  };
  const onUp = () => {
    setTimeout(() => (drag.current = null), 0);
  };
  const pick = (t: number) => {
    if (drag.current?.moved) return;
    onPick(t);
  };

  return (
    <div className="map-wrap" ref={wrap}>
      <svg
        className="map"
        viewBox={`${box.x} ${box.y} ${box.w} ${h}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        role="img"
        aria-label="World map"
      >
        <rect x={0} y={0} width={MAP_W} height={MAP_H} className="ocean" />
        <Graticule />
        <path d={GEO.lanes} className="lanes" style={{ strokeWidth: 1.4 * k }} />
        <Territories game={game} highlight={highlight} onPick={pick} />
        <path d={GEO.borders} className="borders" />
        <path d={GEO.coast} className="coast" />
        <path d={GEO.regionBorders} className="region-borders" style={{ strokeWidth: Math.max(2.2, 2.6 * k) }} />
        {[...highlight.targets].map((t) => (
          <path key={t} d={GEO.outlines[t]} className={`target-outline target-${highlight.mode}`} style={{ strokeWidth: 2 * k }} />
        ))}
        {highlight.selected !== null && <path d={GEO.outlines[highlight.selected]} className="sel-outline" style={{ strokeWidth: 2.5 * k }} />}
        {game.territories.map((t, i) => {
          const [x, y] = GEO.labels[i];
          const color = t.owner ? POWER[t.owner].color : NEUTRAL;
          const cap = capitalOf(i);
          return (
            <g key={i} className="badge" onClick={() => pick(i)}>
              <circle key={`o${t.owner}`} cx={x} cy={y} r={r} fill="#0b1520" stroke={color} strokeWidth={2 * k} className="badge-ring" />
              <text key={`n${t.armies}`} x={x} y={y + 3.8 * k} textAnchor="middle" style={{ fontSize: 11 * k }} className="badge-num">
                {t.armies}
              </text>
              {cap && (
                <path
                  d={star(x + r * 0.85, y - r * 0.85, 5 * k)}
                  fill={POWER[cap].color}
                  stroke="#0b1520"
                  strokeWidth={0.8 * k}
                />
              )}
              <title>{`${TERRITORIES[i].name}: ${t.owner ? POWER[t.owner].name : 'minor state'}, ${t.armies} armies`}</title>
            </g>
          );
        })}
      </svg>
      <div className="radar" style={{ left: radar.left, top: radar.top }} aria-hidden="true" />
      <canvas ref={canvas} className="fx-canvas" aria-hidden="true" />
      <div className="map-vignette" aria-hidden="true" />
      {overlay}
      <div className="map-zoom">
        <button type="button" onClick={() => zoom(1 / 1.4)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => zoom(1.4)} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={fit} aria-label="Reset view">
          ⤢
        </button>
      </div>
    </div>
  );
}

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
        const cls = `terr ${target ? 'target' : ''} ${highlight.selected === i ? 'selected' : ''}`;
        return <path key={i} d={d} fill={o ? POWER[o].color : NEUTRAL} className={cls} onClick={() => onPick(i)} />;
      })}
    </g>
  );
});

const Graticule = memo(function Graticule() {
  const lines: string[] = [];
  for (let i = 1; i < 12; i++) lines.push(`M${(MAP_W / 12) * i},0V${MAP_H}`);
  for (let i = 1; i < 6; i++) lines.push(`M0,${(MAP_H / 6) * i}H${MAP_W}`);
  return <path d={lines.join('')} className="graticule" />;
});

function star(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}
