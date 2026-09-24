import type { GameState } from './types';

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Mulberry32 PRNG. Advances the state's seed in place so games replay deterministically. */
export function rand(s: GameState): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Your utility for a package (0–1). Each issue runs 0 (their ideal) to 100 (yours). */
export function yourValue(weights: number[], x: number[]): number {
  return weights.reduce((acc, w, i) => acc + (w * x[i]) / 100, 0);
}

/** Their utility for a package (0–1). */
export function theirValue(weights: number[], x: number[]): number {
  return weights.reduce((acc, v, i) => acc + (v * (100 - x[i])) / 100, 0);
}

export function normalize(ws: number[]): number[] {
  const total = ws.reduce((a, b) => a + b, 0);
  return ws.map((w) => w / total);
}

export interface FrontierPoint {
  you: number;
  them: number;
  deal: number[];
}

/**
 * Vertices of the Pareto frontier for additive linear utilities: hand issues to you
 * in order of how much more you value them than they do.
 */
export function paretoFrontier(yours: number[], theirs: number[]): FrontierPoint[] {
  const order = yours.map((_, i) => i).sort((a, b) => yours[b] / theirs[b] - yours[a] / theirs[a]);
  const deal = yours.map(() => 0);
  const pts: FrontierPoint[] = [{ you: 0, them: 1, deal: [...deal] }];
  for (const i of order) {
    deal[i] = 100;
    pts.push({ you: yourValue(yours, deal), them: theirValue(theirs, deal), deal: [...deal] });
  }
  return pts;
}

/** Best utility you could have had while leaving them at least `them`. */
export function maxYouGivenThem(frontier: FrontierPoint[], them: number): number {
  for (let k = 1; k < frontier.length; k++) {
    const a = frontier[k - 1];
    const b = frontier[k];
    if (b.them <= them) {
      const t = a.them === b.them ? 0 : (a.them - them) / (a.them - b.them);
      return a.you + t * (b.you - a.you);
    }
  }
  return frontier[frontier.length - 1].you;
}

/** Interpolated deal at parameter t ∈ [0, 1] along the frontier. */
export function frontierDealAt(frontier: FrontierPoint[], t: number): number[] {
  const segs = frontier.length - 1;
  const pos = clamp(t, 0, 1) * segs;
  const k = Math.min(segs - 1, Math.floor(pos));
  const f = pos - k;
  return frontier[k].deal.map((v, i) => Math.round(v + f * (frontier[k + 1].deal[i] - v)));
}
