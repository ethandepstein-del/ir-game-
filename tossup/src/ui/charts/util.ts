import { useEffect, useRef, useState } from 'react';

/** Measure an element's width so charts render crisp text at any size. */
export function useWidth<T extends HTMLElement>(initial = 640): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setW(Math.max(200, Math.round(el.getBoundingClientRect().width)));
    set();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export const linear = (d0: number, d1: number, r0: number, r1: number) => {
  const k = (r1 - r0) / (d1 - d0 || 1);
  return (x: number) => r0 + (x - d0) * k;
};

/** Round-number ticks between lo and hi. */
export function ticks(lo: number, hi: number, target = 6): number[] {
  const span = hi - lo;
  if (span <= 0) return [lo];
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2.5 ? 5 : norm >= 1.4 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(+t.toFixed(10));
  return out;
}

export function areaPath(pts: [number, number][], base: number): string {
  if (!pts.length) return '';
  return `M${pts[0][0]},${base} ` + pts.map((p) => `L${p[0]},${p[1]}`).join(' ') + ` L${pts[pts.length - 1][0]},${base} Z`;
}
export function linePath(pts: [number, number][]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}
export function bandPath(top: [number, number][], bottom: [number, number][]): string {
  return (
    top.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') +
    ' ' +
    [...bottom].reverse().map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') +
    ' Z'
  );
}

/** Seat positions for a parliament-style hemicycle. Returns points ordered left to right. */
export function hemicycle(n: number, rows: number, innerR = 0.42): { x: number; y: number; a: number }[] {
  const radii = Array.from({ length: rows }, (_, i) => innerR + ((1 - innerR) * i) / Math.max(rows - 1, 1));
  const totalR = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.round((n * r) / totalR));
  let diff = n - counts.reduce((a, b) => a + b, 0);
  for (let i = counts.length - 1; diff !== 0; i = (i - 1 + counts.length) % counts.length) {
    counts[i] += Math.sign(diff);
    diff -= Math.sign(diff);
  }
  const pts: { x: number; y: number; a: number }[] = [];
  radii.forEach((r, i) => {
    const c = counts[i];
    for (let k = 0; k < c; k++) {
      const a = Math.PI - (Math.PI * (c === 1 ? 0.5 : k / (c - 1)));
      pts.push({ x: Math.cos(a) * r, y: -Math.sin(a) * r, a });
    }
  });
  return pts.sort((p, q) => q.a - p.a || p.y - q.y);
}
