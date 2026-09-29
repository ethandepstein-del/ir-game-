// Small numeric toolkit: normal distribution, seeded RNG, dates, summary stats.

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Standard normal CDF (Abramowitz-Stegun 7.1.26 via erf). Max error ~1.5e-7. */
export function normCdf(x: number): number {
  const s = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return 0.5 * (1 + s * y);
}

/** Inverse standard normal CDF (Acklam's algorithm, relative error ~1e-9). */
export function normInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - plow) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** Mulberry32: tiny, fast, seedable. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller normal generator over a uniform source. */
export function gaussian(u: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let a = u();
    if (a < 1e-12) a = 1e-12;
    const b = u();
    const r = Math.sqrt(-2 * Math.log(a));
    spare = r * Math.sin(2 * Math.PI * b);
    return r * Math.cos(2 * Math.PI * b);
  };
}

export const DAY_MS = 86_400_000;

/** ISO date (YYYY-MM-DD) to whole days since 1970-01-01, UTC. */
export function dayNum(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function isoFromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
}

/** Midpoint day of a poll's field period. */
export function pollDay(start: string, end: string): number {
  return Math.round((dayNum(start) + dayNum(end)) / 2);
}

export function weightedMean(xs: number[], ws: number[]): number {
  let s = 0;
  let w = 0;
  for (let i = 0; i < xs.length; i++) {
    s += xs[i] * ws[i];
    w += ws[i];
  }
  return w > 0 ? s / w : NaN;
}

export function quantile(sorted: ArrayLike<number>, q: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Sampling variance of a margin (D - R, in points^2) from toplines in percent. */
export function marginVariance(n: number, d: number | null, r: number | null): number {
  const pd = clamp((d ?? 45) / 100, 0.05, 0.9);
  const pr = clamp((r ?? 42) / 100, 0.05, 0.9);
  const v = (pd + pr - (pd - pr) ** 2) / Math.max(n, 100);
  return v * 10_000;
}

export const fmtMargin = (m: number, digits = 1): string => {
  const a = Math.abs(m);
  if (a < 0.05) return 'Even';
  return `${m > 0 ? 'D' : 'R'}+${a.toFixed(digits)}`;
};

export const fmtPct = (p: number, digits = 0): string => {
  if (p > 0.995) return '>99%';
  if (p < 0.005) return '<1%';
  return `${(p * 100).toFixed(digits)}%`;
};
