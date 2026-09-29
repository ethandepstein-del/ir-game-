import type { Party, Rating } from '../data/types';

export const signed = (n: number, d = 1) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(d);
export const pct = (n: number, d = 0) => `${n.toFixed(d)}%`;

/** "D+8.7", "R+2.1", "Even". */
export function lead(m: number, d = 1): string {
  if (!Number.isFinite(m)) return '—';
  if (Math.abs(m) < 0.05) return 'Even';
  return `${m > 0 ? 'D' : 'R'}+${Math.abs(m).toFixed(d)}`;
}

/** Probability as a whole-number percent with sensible extremes. */
export function prob(p: number, d = 0): string {
  if (!Number.isFinite(p)) return '—';
  if (p >= 0.995) return '>99%';
  if (p <= 0.005) return '<1%';
  if (d === 0 && p > 0.95 && p < 0.995) return `${Math.floor(p * 100)}%`;
  return `${(p * 100).toFixed(d)}%`;
}

export const partyClass = (p: Party | null | undefined) => (p === 'D' ? 'dem' : p === 'R' ? 'rep' : p === 'I' ? 'ind' : '');
export const partyName = (p: Party) => (p === 'D' ? 'Democrats' : p === 'R' ? 'Republicans' : 'Independents');

/** Color token for a margin (D positive), used for text and dots. */
export const marginColor = (m: number) => (m > 0.5 ? 'var(--dem)' : m < -0.5 ? 'var(--rep)' : 'var(--toss-fill)');

export const RATING_VAR: Record<Rating, string> = {
  'safe-d': 'var(--rt-sd)',
  'likely-d': 'var(--rt-ld)',
  'lean-d': 'var(--rt-nd)',
  'tilt-d': 'var(--rt-td)',
  toss: 'var(--rt-t)',
  'tilt-r': 'var(--rt-tr)',
  'lean-r': 'var(--rt-nr)',
  'likely-r': 'var(--rt-lr)',
  'safe-r': 'var(--rt-sr)',
};

/** Fill for a Democratic win probability: the same nine buckets as the ratings scale. */
export function probFill(pD: number): string {
  if (!Number.isFinite(pD)) return 'var(--rt-none)';
  if (pD >= 0.95) return RATING_VAR['safe-d'];
  if (pD >= 0.8) return RATING_VAR['likely-d'];
  if (pD >= 0.62) return RATING_VAR['lean-d'];
  if (pD >= 0.54) return RATING_VAR['tilt-d'];
  if (pD > 0.46) return RATING_VAR.toss;
  if (pD > 0.38) return RATING_VAR['tilt-r'];
  if (pD > 0.2) return RATING_VAR['lean-r'];
  if (pD > 0.05) return RATING_VAR['likely-r'];
  return RATING_VAR['safe-r'];
}

export function probBucket(pD: number): Rating {
  if (pD >= 0.95) return 'safe-d';
  if (pD >= 0.8) return 'likely-d';
  if (pD >= 0.62) return 'lean-d';
  if (pD >= 0.54) return 'tilt-d';
  if (pD > 0.46) return 'toss';
  if (pD > 0.38) return 'tilt-r';
  if (pD > 0.2) return 'lean-r';
  if (pD > 0.05) return 'likely-r';
  return 'safe-r';
}

/** Friendly translations of a probability. */
const ANALOGIES: [number, string][] = [
  [1 / 52, 'drawing the ace of spades'],
  [1 / 36, 'rolling double sixes'],
  [1 / 16, 'flipping four heads in a row'],
  [1 / 8, 'flipping three heads in a row'],
  [1 / 6, 'rolling a specific number on a die'],
  [1 / 4, 'flipping two heads in a row'],
  [1 / 3, 'rolling a 1 or 2 on a die'],
  [1 / 2, 'a coin flip'],
];
export function plainOdds(p: number): string {
  if (!Number.isFinite(p)) return '';
  const flipped = p > 0.5;
  const q = flipped ? 1 - p : p;
  if (q > 0.46) return 'about a coin flip';
  if (q > 0.4) return flipped ? 'a bit better than a coin flip' : 'a bit worse than a coin flip';
  let best = ANALOGIES[0];
  let bd = Infinity;
  for (const a of ANALOGIES) {
    const d = Math.abs(Math.log(a[0] / q));
    if (d < bd) {
      bd = d;
      best = a;
    }
  }
  const base = best[1];
  if (!flipped) return `about like ${base}`;
  // Invert the analogy: "not <event>".
  return `about like not ${base}`;
}

export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export function daysUntil(iso: string, from = '2026-09-29'): number {
  const a = Date.parse(from + 'T00:00:00Z');
  const b = Date.parse(iso + 'T00:00:00Z');
  return Math.round((b - a) / 86_400_000);
}
