import { useMemo, type ReactNode } from 'react';
import { navigate } from '../../router';
import { useTip } from '../components/bits';
import { probFill, prob } from '../format';
import { hemicycle, linePath, linear, ticks, useWidth } from './util';

/* ------------------------------------------------------------------ Ring */

export function Ring({ pD, size = 168, stroke = 16, children, label }: { pD: number; size?: number; stroke?: number; children?: ReactNode; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = 4;
  const dLen = Math.max(0, c * pD - gap);
  const rLen = Math.max(0, c * (1 - pD) - gap);
  return (
    <div style={{ position: 'relative', width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--dem)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${dLen} ${c}`} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--rep)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${rLen} ${c}`}
          strokeDashoffset={-(c * pD)}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ Sparkline */

export function Sparkline({ values, color = 'var(--ink)', height = 44, width = 160, fill = true }: { values: number[]; color?: string; height?: number; width?: number; fill?: boolean }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const x = linear(0, values.length - 1, 3, width - 6);
  const y = linear(lo, hi, height - 6, 6);
  const pts: [number, number][] = values.map((v, i) => [x(i), y(v)]);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {fill && <path d={`${linePath(pts)} L${x(values.length - 1)},${height} L${x(0)},${height} Z`} fill={color} opacity="0.12" />}
      <path d={linePath(pts)} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.6" fill={color} />
    </svg>
  );
}

/* ------------------------------------------------------------------ Histogram */

interface HistProps {
  hist: number[];
  threshold: number;
  /** Seats already locked in (shown in axis labels only). */
  height?: number;
  median?: number;
  label: string;
  unit?: string;
  /** Label for the majority side, e.g. "Democratic majority". */
  needLabel: string;
}

export function SeatHistogram({ hist, threshold, height = 220, median, label, unit = 'seats', needLabel }: HistProps) {
  const [ref, w] = useWidth<HTMLDivElement>(640);
  const { tip, show, hide, ref: tipRef } = useTip<{ k: number; p: number }>();
  const M = { l: 10, r: 10, t: 22, b: 30 };
  const { lo, hi } = useMemo(() => {
    let a = 0;
    let b = hist.length - 1;
    while (a < b && hist[a] < 0.0008) a++;
    while (b > a && hist[b] < 0.0008) b--;
    return { lo: Math.min(a, threshold - 6), hi: Math.max(b, threshold + 6) };
  }, [hist, threshold]);
  const n = hi - lo + 1;
  const max = Math.max(...hist.slice(lo, hi + 1));
  const x = linear(lo - 0.5, hi + 0.5, M.l, w - M.r);
  const y = linear(0, max * 1.12, height - M.b, M.t);
  const bw = Math.max(1, (w - M.l - M.r) / n - (n > 60 ? 0.6 : 1.4));
  const xt = ticks(lo, hi, w < 480 ? 5 : 8);
  const medianX = median !== undefined ? x(median) : null;
  return (
    <div className="chart-wrap" ref={(el) => { ref.current = el; tipRef.current = el; }}>
      <svg className="chart" viewBox={`0 0 ${w} ${height}`} role="img" aria-label={label} onMouseLeave={hide}>
        {Array.from({ length: n }, (_, i) => lo + i).map((k) => {
          const p = hist[k] ?? 0;
          const d = k >= threshold;
          return (
            <rect
              key={k}
              x={x(k) - bw / 2}
              y={y(p)}
              width={bw}
              height={Math.max(0, height - M.b - y(p))}
              rx={Math.min(3, bw / 2)}
              fill={d ? 'var(--dem)' : 'var(--rep)'}
              opacity={0.88}
              onMouseMove={(e) => show(e, { k, p })}
            />
          );
        })}
        <line x1={x(threshold - 0.5)} x2={x(threshold - 0.5)} y1={M.t - 8} y2={height - M.b} stroke="var(--ink)" strokeWidth="2" strokeDasharray="4 3" />
        <text x={x(threshold - 0.5)} y={M.t - 10} textAnchor="middle" style={{ fill: 'var(--ink)', fontWeight: 800, fontSize: 12 }}>
          {threshold} to win
        </text>
        {medianX !== null && <path d={`M${medianX - 5},${height - M.b + 4} L${medianX + 5},${height - M.b + 4} L${medianX},${height - M.b - 3} Z`} fill="var(--ink)" />}
        {xt.map((t) => (
          <text key={t} x={x(t)} y={height - 8} textAnchor="middle">
            {t}
          </text>
        ))}
        <line x1={M.l} x2={w - M.r} y1={height - M.b} y2={height - M.b} stroke="var(--line-2)" />
      </svg>
      {tip && (
        <div className="tip" style={{ left: Math.min(Math.max(tip.x, 80), w - 80), top: tip.y }}>
          <b>{tip.data.k} Democratic {unit}</b>
          <div className="tip-sub">{prob(tip.data.p, 1)} of simulations · {tip.data.k >= threshold ? needLabel : 'Republican side'}</div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Snake */

export interface SnakeItem {
  id: string;
  label: string;
  pD: number;
  mean: number;
  href?: string;
  sub?: string;
}

/** Races sorted from most to least Democratic, colored by win probability, with the majority line. */
export function Snake({ items, needFromTop, height = 230, title }: { items: SnakeItem[]; needFromTop: number; height?: number; title: string }) {
  const [ref, w] = useWidth<HTMLDivElement>(640);
  const { tip, show, hide, ref: tipRef } = useTip<SnakeItem>();
  const sorted = useMemo(() => [...items].sort((a, b) => b.mean - a.mean), [items]);
  const M = { l: 34, r: 8, t: 10, b: 34 };
  const n = sorted.length;
  const slot = (w - M.l - M.r) / n;
  const bw = Math.max(6, slot - 3);
  const y = linear(0, 1, height - M.b, M.t);
  const lineX = M.l + slot * needFromTop;
  return (
    <div className="chart-wrap" ref={(el) => { ref.current = el; tipRef.current = el; }}>
      <svg className="chart" viewBox={`0 0 ${w} ${height}`} role="img" aria-label={title} onMouseLeave={hide}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={M.l} x2={w - M.r} y1={y(t)} y2={y(t)} stroke={t === 0.5 ? 'var(--line-2)' : 'var(--line)'} strokeDasharray={t === 0.5 ? '' : '2 4'} />
            <text x={M.l - 6} y={y(t) + 4} textAnchor="end">{Math.round(t * 100)}%</text>
          </g>
        ))}
        {sorted.map((it, i) => {
          const cx = M.l + slot * i + slot / 2;
          return (
            <g key={it.id} style={{ cursor: it.href ? 'pointer' : 'default' }} onClick={() => it.href && navigate(it.href)} onMouseMove={(e) => show(e, it)}>
              <rect x={cx - bw / 2} y={y(it.pD)} width={bw} height={Math.max(2, height - M.b - y(it.pD))} rx={Math.min(4, bw / 2)} fill={probFill(it.pD)} stroke="var(--surface)" strokeWidth="1.5" />
              <text
                x={cx}
                y={height - M.b + 12}
                textAnchor="middle"
                transform={`rotate(${slot < 17 ? 90 : 0} ${cx} ${height - M.b + 12})`}
                style={{ fontSize: slot < 17 ? 10 : 11, fontWeight: 700 }}
              >
                {it.label}
              </text>
            </g>
          );
        })}
        <line x1={lineX} x2={lineX} y1={M.t - 4} y2={height - M.b} stroke="var(--ink)" strokeWidth="2" strokeDasharray="4 3" />
        <text x={lineX + 6} y={M.t + 6} style={{ fill: 'var(--ink)', fontWeight: 800, fontSize: 11.5 }}>majority ← tipping point</text>
      </svg>
      {tip && (
        <div className="tip" style={{ left: Math.min(Math.max(tip.x, 90), w - 90), top: tip.y }}>
          <b>{tip.data.sub ?? tip.data.label}</b>
          <div className="tip-sub">Democrats {prob(tip.data.pD)} to win</div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Hemicycle */

export interface SeatDot {
  color: string;
  title: string;
  ring?: boolean;
}

export function Hemicycle({ seats, rows = 5, label, height }: { seats: SeatDot[]; rows?: number; label: string; height?: number }) {
  const pts = useMemo(() => hemicycle(seats.length, rows), [seats.length, rows]);
  const W = 420;
  const H = height ?? 236;
  const R = 200;
  const cx = W / 2;
  const cy = H - 22;
  const dot = Math.min(14, (R * 0.5) / rows);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={label}>
      {pts.map((p, i) => (
        <circle key={i} cx={cx + p.x * R} cy={cy + p.y * R} r={dot / 2 + 1} fill={seats[i].ring ? 'var(--surface)' : seats[i].color} stroke={seats[i].ring ? seats[i].color : 'none'} strokeWidth={2}>
          <title>{seats[i].title}</title>
        </circle>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ Margin curve */

/** A bell curve of the projected D-R margin: Democratic side blue, Republican side red. */
export function MarginCurve({ mean, sd, height = 170, label, domain = 30 }: { mean: number; sd: number; height?: number; label: string; domain?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>(560);
  const M = { l: 10, r: 10, t: 14, b: 30 };
  const x = linear(-domain, domain, M.l, w - M.r);
  const pdf = (v: number) => Math.exp(-0.5 * ((v - mean) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
  const peak = pdf(mean);
  const y = linear(0, peak * 1.1, height - M.b, M.t);
  const steps = 160;
  const pts = Array.from({ length: steps + 1 }, (_, i) => -domain + (2 * domain * i) / steps);
  const area = (from: number, to: number) => {
    const sel = pts.filter((p) => p >= from && p <= to);
    if (!sel.length) return '';
    return `M${x(sel[0])},${y(0)} ` + sel.map((p) => `L${x(p).toFixed(1)},${y(pdf(p)).toFixed(1)}`).join(' ') + ` L${x(sel[sel.length - 1])},${y(0)} Z`;
  };
  const xt = [-20, -10, 0, 10, 20].filter((t) => Math.abs(t) <= domain);
  return (
    <div ref={ref}>
      <svg className="chart" viewBox={`0 0 ${w} ${height}`} role="img" aria-label={label}>
        <path d={area(-domain, 0)} fill="var(--rep)" opacity="0.8" />
        <path d={area(0, domain)} fill="var(--dem)" opacity="0.8" />
        <line x1={x(0)} x2={x(0)} y1={M.t - 4} y2={height - M.b} stroke="var(--ink)" strokeWidth="2" strokeDasharray="4 3" />
        <line x1={x(mean)} x2={x(mean)} y1={y(peak)} y2={height - M.b} stroke="var(--surface)" strokeWidth="2.5" />
        <circle cx={x(mean)} cy={y(peak)} r="5" fill="var(--ink)" stroke="var(--surface)" strokeWidth="2" />
        <line x1={M.l} x2={w - M.r} y1={height - M.b} y2={height - M.b} stroke="var(--line-2)" />
        {xt.map((t) => (
          <text key={t} x={x(t)} y={height - 10} textAnchor="middle">{t === 0 ? 'Even' : `${t > 0 ? 'D' : 'R'}+${Math.abs(t)}`}</text>
        ))}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ Range dot */

/** A point estimate with an interval on a shared D-R axis, used to compare model ingredients. */
export function RangeRow({ label, mean, sd, weight, note, domain = 30 }: { label: string; mean: number | null; sd?: number; weight?: number; note?: string; domain?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>(420);
  const H = 34;
  const x = linear(-domain, domain, 8, w - 8);
  return (
    <div className="range-row">
      <div className="range-label">
        <b>{label}</b>
        {weight !== undefined && <span className="chip" style={{ marginLeft: 8 }}>{Math.round(weight * 100)}% of the blend</span>}
        {note && <div className="faint" style={{ fontSize: 12 }}>{note}</div>}
      </div>
      <div ref={ref} style={{ flex: 1, minWidth: 180 }}>
        <svg viewBox={`0 0 ${w} ${H}`} className="chart" role="img" aria-label={mean === null ? `${label}: none` : `${label}: ${mean.toFixed(1)}`}>
          <line x1={8} x2={w - 8} y1={H / 2} y2={H / 2} stroke="var(--line-2)" />
          <line x1={x(0)} x2={x(0)} y1={4} y2={H - 4} stroke="var(--ink-3)" strokeDasharray="3 3" />
          {mean !== null && sd !== undefined && (
            <rect x={x(mean - sd)} width={Math.max(2, x(mean + sd) - x(mean - sd))} y={H / 2 - 6} height={12} rx={6} fill={mean >= 0 ? 'var(--dem)' : 'var(--rep)'} opacity="0.28" />
          )}
          {mean !== null && <circle cx={x(Math.max(-domain, Math.min(domain, mean)))} cy={H / 2} r="6.5" fill={mean >= 0 ? 'var(--dem)' : 'var(--rep)'} stroke="var(--surface)" strokeWidth="2.5" />}
        </svg>
      </div>
      <div className="num range-val">{mean === null ? <span className="faint">n/a</span> : <b className={mean >= 0 ? 'dem' : 'rep'}>{mean > 0 ? 'D+' : mean < 0 ? 'R+' : ''}{Math.abs(mean).toFixed(1)}</b>}</div>
    </div>
  );
}
