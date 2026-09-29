import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Rating } from '../../data/types';
import { RATING_SHORT } from '../../data/ratings';
import { usePrefs } from '../../state/prefs';

export function RatingPill({ rating, est = false, title }: { rating: Rating; est?: boolean; title?: string }) {
  return (
    <span className={`rpill ${rating} ${est ? 'est' : ''}`} title={title ?? (est ? 'Estimated rating (no specific rater found)' : undefined)}>
      {RATING_SHORT[rating]}
    </span>
  );
}

/** "Under the hood" disclosure that follows the global nerd toggle. */
export function Under({ title = 'Under the hood', children, open }: { title?: string; children: ReactNode; open?: boolean }) {
  const { nerd } = usePrefs();
  const [local, setLocal] = useState<boolean | null>(null);
  const isOpen = local ?? open ?? nerd;
  return (
    <details className="under" open={isOpen} onToggle={(e) => setLocal((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>{title}</summary>
      <div className="under-body">{children}</div>
    </details>
  );
}

export function PartyBar({ d, r, i = 0, size = '' }: { d: number; r: number; i?: number; size?: 'lg' | '' }) {
  const t = d + r + i || 1;
  return (
    <div className={`pbar ${size}`} role="img" aria-label={`Democrats ${(100 * d / t).toFixed(0)} percent, Republicans ${(100 * r / t).toFixed(0)} percent`}>
      <i className="d" style={{ width: `${(100 * d) / t}%` }} />
      {i > 0 && <i className="i" style={{ width: `${(100 * i) / t}%` }} />}
      <i className="r" style={{ width: `${(100 * r) / t}%` }} />
    </div>
  );
}

/** Position-tracking tooltip for SVG/HTML charts. */
export function useTip<T>() {
  const [tip, setTip] = useState<{ x: number; y: number; data: T } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const show = (e: { clientX: number; clientY: number }, data: T) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, data });
  };
  const hide = () => setTip(null);
  return { tip, show, hide, ref };
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(t);
  }, [msg, key]);
  return {
    say: (m: string) => {
      setMsg(m);
      setKey((k) => k + 1);
    },
    node: msg ? (
      <div className="toast" role="status" key={key}>
        {msg}
      </div>
    ) : null,
  };
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'dem' | 'rep' | 'toss' }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className={`kpi sm ${tone ?? ''}`}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
