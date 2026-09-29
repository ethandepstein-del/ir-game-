import type { RaceMeta, Rating } from './types';
import { RATINGS } from './types';

/** Expected D margin implied by an expert rating in today's environment (points). */
export const RATING_MARGIN: Record<Rating, number> = {
  'safe-d': 24,
  'likely-d': 12,
  'lean-d': 6,
  'tilt-d': 3,
  toss: 0,
  'tilt-r': -3,
  'lean-r': -6,
  'likely-r': -12,
  'safe-r': -24,
};

export const RATING_LABEL: Record<Rating, string> = {
  'safe-d': 'Safe D',
  'likely-d': 'Likely D',
  'lean-d': 'Lean D',
  'tilt-d': 'Tilt D',
  toss: 'Toss-up',
  'tilt-r': 'Tilt R',
  'lean-r': 'Lean R',
  'likely-r': 'Likely R',
  'safe-r': 'Safe R',
};

export const RATING_SHORT: Record<Rating, string> = {
  'safe-d': 'Safe D',
  'likely-d': 'Likely D',
  'lean-d': 'Lean D',
  'tilt-d': 'Tilt D',
  toss: 'Toss-up',
  'tilt-r': 'Tilt R',
  'lean-r': 'Lean R',
  'likely-r': 'Likely R',
  'safe-r': 'Safe R',
};

export function ratingFromMargin(m: number): Rating {
  let best: Rating = 'toss';
  let bd = Infinity;
  for (const r of RATINGS) {
    const d = Math.abs(RATING_MARGIN[r] - m);
    if (d < bd) {
      bd = d;
      best = r;
    }
  }
  return best;
}

export interface Consensus {
  rating: Rating;
  margin: number;
  source: 'cited' | 'estimated' | 'default';
  raters: number;
}

/** Average of the raters' ratings that were found; otherwise the stated estimate; otherwise Safe for the holder. */
export function consensus(r: RaceMeta): Consensus {
  const vals = Object.values(r.ratings).filter(Boolean) as Rating[];
  if (vals.length) {
    const m = vals.reduce((a, v) => a + RATING_MARGIN[v], 0) / vals.length;
    return { rating: ratingFromMargin(m), margin: m, source: 'cited', raters: vals.length };
  }
  if (r.estRating) return { rating: r.estRating, margin: RATING_MARGIN[r.estRating], source: 'estimated', raters: 0 };
  const dflt: Rating = r.holder === 'D' ? 'safe-d' : 'safe-r';
  return { rating: dflt, margin: RATING_MARGIN[dflt], source: 'default', raters: 0 };
}

export const isCompetitive = (rt: Rating) => rt !== 'safe-d' && rt !== 'safe-r';
export const isTossupish = (rt: Rating) => rt === 'toss' || rt === 'tilt-d' || rt === 'tilt-r';
export const leansD = (rt: Rating) => RATING_MARGIN[rt] > 0;
export const leansR = (rt: Rating) => RATING_MARGIN[rt] < 0;
