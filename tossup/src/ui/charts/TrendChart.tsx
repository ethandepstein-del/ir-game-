import { useMemo, useState } from 'react';
import { fmtDate, isoFromDay } from '../../engine/stats';
import { useTip } from '../components/bits';
import { areaPath, bandPath, linePath, linear, ticks, useWidth } from './util';

export interface TrendPointIn {
  day: number;
  mean: number;
  sd: number;
}
export interface DotIn {
  id: string;
  day: number;
  value: number;
  pollster: string;
  pop?: 'lv' | 'rv' | 'a';
  detail?: string;
  faded?: boolean;
}
export interface RefSeries {
  name: string;
  color: string;
  points: { day: number; value: number; note?: string }[];
}

interface Props {
  series: TrendPointIn[];
  dots?: DotIn[];
  refs?: RefSeries[];
  /** Positive means Democratic: colors the line and band by the current sign. */
  partisan?: boolean;
  color?: string;
  yFormat: (v: number) => string;
  valueFormat?: (v: number) => string;
  yDomain?: [number, number];
  zero?: boolean;
  height?: number;
  endLabel?: string;
  vlines?: { day: number; label: string }[];
  /** Shade everything before this day as sparse data. */
  sparseBefore?: { day: number; label: string };
  label: string;
}

const M = { l: 46, r: 64, t: 14, b: 28 };

export function TrendChart({ series, dots = [], refs = [], partisan = false, color, yFormat, valueFormat, yDomain, zero = false, height = 340, endLabel, vlines = [], sparseBefore, label }: Props) {
  const [ref, w] = useWidth<HTMLDivElement>(700);
  const { tip, show, hide, ref: tipRef } = useTip<{ day: number; dot?: DotIn }>();
  const [hover, setHover] = useState<number | null>(null);
  const fmt = valueFormat ?? yFormat;
  const h = w < 520 ? Math.min(height, 280) : height;

  const geo = useMemo(() => {
    const d0 = series[0].day;
    const d1 = series[series.length - 1].day;
    const lo = series.map((s) => s.mean - 1.645 * s.sd);
    const hi = series.map((s) => s.mean + 1.645 * s.sd);
    const allVals = [...lo, ...hi, ...dots.map((d) => d.value), ...refs.flatMap((r) => r.points.map((p) => p.value))];
    let y0 = yDomain?.[0] ?? Math.min(...allVals);
    let y1 = yDomain?.[1] ?? Math.max(...allVals);
    if (!yDomain) {
      const pad = (y1 - y0) * 0.08 || 1;
      y0 -= pad;
      y1 += pad;
      if (zero) {
        y0 = Math.min(y0, 0);
        y1 = Math.max(y1, 0);
      }
    }
    return { d0, d1, y0, y1 };
  }, [series, dots, refs, yDomain, zero]);

  const x = linear(geo.d0, geo.d1 + 1, M.l, w - M.r);
  const y = linear(geo.y0, geo.y1, h - M.b, M.t);
  const last = series[series.length - 1];
  const tone = color ?? (partisan ? (last.mean >= 0 ? 'var(--dem)' : 'var(--rep)') : 'var(--ink)');

  const top: [number, number][] = series.map((s) => [x(s.day), y(s.mean + 1.645 * s.sd)]);
  const bot: [number, number][] = series.map((s) => [x(s.day), y(s.mean - 1.645 * s.sd)]);
  const mid: [number, number][] = series.map((s) => [x(s.day), y(s.mean)]);
  const yTicks = ticks(geo.y0, geo.y1, h < 300 ? 4 : 6);
  const xTicks = useMemo(() => {
    const out: number[] = [];
    const span = geo.d1 - geo.d0;
    const step = span > 200 ? 30.4 : span > 100 ? 14 : span > 45 ? 7 : 3;
    for (let d = geo.d0; d <= geo.d1; d += step) out.push(Math.round(d));
    return out;
  }, [geo]);

  const nearest = (px: number) => {
    const day = Math.round(geo.d0 + ((px - M.l) / (w - M.r - M.l)) * (geo.d1 + 1 - geo.d0));
    return Math.min(geo.d1, Math.max(geo.d0, day));
  };

  const hoverSeries = hover !== null ? series[hover - geo.d0] : null;
  const dotSize = w < 520 ? 3 : 3.8;

  return (
    <div className="chart-wrap" ref={(el) => { ref.current = el; tipRef.current = el; }}>
      <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} onMouseLeave={() => { setHover(null); hide(); }}>
        <g className="grid">
          {yTicks.map((t) => (
            <line key={t} x1={M.l} x2={w - M.r} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        {zero && geo.y0 < 0 && geo.y1 > 0 && <line className="zero" x1={M.l} x2={w - M.r} y1={y(0)} y2={y(0)} />}
        {yTicks.map((t) => (
          <text key={t} x={M.l - 8} y={y(t) + 4} textAnchor="end">
            {yFormat(t)}
          </text>
        ))}
        {xTicks.map((d) => (
          <text key={d} x={x(d)} y={h - 8} textAnchor="middle">
            {fmtDate(isoFromDay(d))}
          </text>
        ))}
        {sparseBefore && sparseBefore.day > geo.d0 && (
          <g>
            <rect x={M.l} y={M.t} width={Math.max(0, x(sparseBefore.day) - M.l)} height={h - M.t - M.b} fill="var(--surface-3)" opacity="0.6" />
            <text x={M.l + 6} y={h - M.b - 8} style={{ fontWeight: 700 }}>{sparseBefore.label}</text>
          </g>
        )}
        {vlines.map((v) => (
          <g key={v.label}>
            <line x1={x(v.day)} x2={x(v.day)} y1={M.t} y2={h - M.b} stroke="var(--line-2)" strokeDasharray="3 4" />
            <text x={x(v.day) - 4} y={M.t + 10} textAnchor="end">{v.label}</text>
          </g>
        ))}
        <path d={bandPath(top, bot)} fill={tone} opacity="0.14" />
        <path d={linePath(mid)} fill="none" stroke={tone} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {refs.map((r) => (
          <g key={r.name}>
            {r.points.map((p) => (
              <g
                key={p.day + r.name}
                transform={`translate(${x(p.day)},${y(p.value)}) rotate(45)`}
                onMouseMove={(e) => show(e, { day: p.day })}
              >
                <rect x={-4.5} y={-4.5} width={9} height={9} fill="var(--surface)" stroke={r.color} strokeWidth="2" />
                <title>{`${r.name}: ${fmt(p.value)}${p.note ? ` (${p.note})` : ''}`}</title>
              </g>
            ))}
          </g>
        ))}
        {dots.map((d) => (
          <circle
            key={d.id}
            cx={x(d.day)}
            cy={y(d.value)}
            r={dotSize}
            fill={d.pop === 'lv' || !d.pop ? tone : 'var(--surface)'}
            stroke={tone}
            strokeWidth={d.pop === 'lv' || !d.pop ? 0 : 1.6}
            opacity={d.faded ? 0.3 : 0.62}
            onMouseMove={(e) => show(e, { day: d.day, dot: d })}
            onMouseLeave={hide}
          />
        ))}
        {hoverSeries && <line x1={x(hoverSeries.day)} x2={x(hoverSeries.day)} y1={M.t} y2={h - M.b} stroke="var(--ink-3)" strokeDasharray="2 3" />}
        {hoverSeries && <circle cx={x(hoverSeries.day)} cy={y(hoverSeries.mean)} r="5.5" fill={tone} stroke="var(--surface)" strokeWidth="2.5" />}
        <circle cx={x(last.day)} cy={y(last.mean)} r="6" fill={tone} stroke="var(--surface)" strokeWidth="3" />
        {endLabel && (
          <text x={x(last.day) + 12} y={y(last.mean) + 5} style={{ fill: tone, fontWeight: 800, fontSize: 15, fontFamily: 'var(--font-display)' }}>
            {endLabel}
          </text>
        )}
        <rect
          x={M.l}
          y={M.t}
          width={w - M.l - M.r}
          height={h - M.t - M.b}
          fill="transparent"
          onMouseMove={(e) => {
            const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
            const day = nearest(e.clientX - box.left);
            setHover(day);
            show(e, { day });
          }}
        />
      </svg>
      {tip && (
        <div className="tip" style={{ left: Math.min(Math.max(tip.x, 90), w - 90), top: tip.y }}>
          {tip.data.dot ? (
            <>
              <b>{tip.data.dot.pollster}</b>
              <div>{fmt(tip.data.dot.value)}</div>
              <div className="tip-sub">{tip.data.dot.detail}</div>
            </>
          ) : (
            <>
              <b>{fmtDate(isoFromDay(tip.data.day), { month: 'short', day: 'numeric', year: 'numeric' })}</b>
              {series[tip.data.day - geo.d0] && (
                <div>
                  Average {fmt(series[tip.data.day - geo.d0].mean)}
                  <span className="tip-sub"> · 90% range {fmt(series[tip.data.day - geo.d0].mean - 1.645 * series[tip.data.day - geo.d0].sd)} to {fmt(series[tip.data.day - geo.d0].mean + 1.645 * series[tip.data.day - geo.d0].sd)}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export { areaPath };
