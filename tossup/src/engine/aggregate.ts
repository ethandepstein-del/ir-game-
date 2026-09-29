// Polling aggregation.
//
// Generic ballot and approval use a local-level Kalman model (a random walk observed through polls)
// with an RTS smoother, so every poll informs every day but recent, large, high-quality polls
// dominate the endpoint. Pollster house effects and population (LV/RV/adults) effects are estimated
// from the data with shrinkage toward priors and re-centred so they can't absorb the trend.

import type { ApprovalPoll, Poll, Pop } from '../data/types';
import { pollsterInfo, TIER_VAR } from '../data/pollsters';
import { clamp, dayNum, isoFromDay, marginVariance, pollDay, weightedMean } from './stats';

export interface Obs {
  id: string;
  day: number;
  y: number;
  /** Observation variance before house-effect uncertainty. */
  v: number;
  family: string;
  pop: Pop;
}

export interface TrendPoint {
  day: number;
  date: string;
  mean: number;
  sd: number;
}

export interface FitOptions {
  /** Daily random-walk variance of the true value. */
  q: number;
  asOf: number;
  /** Shrinkage strength for house effects, in "polls". */
  lambda?: number;
  popLambda?: number;
  iterations?: number;
  priorFor?: (family: string) => number;
  /** Estimate population effects (LV/RV/A). */
  popEffects?: boolean;
}

export interface FitResult {
  trend: TrendPoint[];
  houseEffects: Record<string, { effect: number; n: number; prior: number }>;
  popEffects: Record<Pop, number>;
  residual: Record<string, number>;
  adjusted: Record<string, number>;
  firstDay: number;
}

function smooth(obs: Obs[], adjY: number[], firstDay: number, lastDay: number, q: number): TrendPoint[] {
  const T = lastDay - firstDay + 1;
  const byDay: number[][] = Array.from({ length: T }, () => []);
  obs.forEach((o, i) => {
    const t = clamp(o.day - firstDay, 0, T - 1);
    byDay[t].push(i);
  });
  const mf = new Float64Array(T);
  const pf = new Float64Array(T);
  const mp = new Float64Array(T);
  const pp = new Float64Array(T);
  let m = 0;
  let p = 400;
  // Initialise at the mean of the earliest observations.
  const early = obs
    .map((o, i) => ({ d: o.day, i }))
    .sort((a, b) => a.d - b.d)
    .slice(0, Math.min(4, obs.length))
    .map((e) => adjY[e.i]);
  m = early.reduce((a, b) => a + b, 0) / Math.max(early.length, 1);
  for (let t = 0; t < T; t++) {
    const pm = m;
    const pv = p + (t === 0 ? 0 : q);
    mp[t] = pm;
    pp[t] = pv;
    m = pm;
    p = pv;
    for (const i of byDay[t]) {
      const r = obs[i].v;
      const k = p / (p + r);
      m += k * (adjY[i] - m);
      p = (1 - k) * p;
    }
    mf[t] = m;
    pf[t] = p;
  }
  const ms = new Float64Array(T);
  const ps = new Float64Array(T);
  ms[T - 1] = mf[T - 1];
  ps[T - 1] = pf[T - 1];
  for (let t = T - 2; t >= 0; t--) {
    const g = pf[t] / pp[t + 1];
    ms[t] = mf[t] + g * (ms[t + 1] - mp[t + 1]);
    ps[t] = pf[t] + g * g * (ps[t + 1] - pp[t + 1]);
  }
  const out: TrendPoint[] = [];
  for (let t = 0; t < T; t++) {
    out.push({ day: firstDay + t, date: isoFromDay(firstDay + t), mean: ms[t], sd: Math.sqrt(Math.max(ps[t], 0)) });
  }
  return out;
}

export function fitTrend(obs: Obs[], o: FitOptions): FitResult {
  const lambda = o.lambda ?? 4;
  const popLambda = o.popLambda ?? 8;
  const iterations = o.iterations ?? 10;
  const priorFor = o.priorFor ?? (() => 0);
  const firstDay = Math.min(...obs.map((x) => x.day));
  const lastDay = Math.max(o.asOf, ...obs.map((x) => x.day));

  const families = [...new Set(obs.map((x) => x.family))];
  const house: Record<string, number> = Object.fromEntries(families.map((f) => [f, priorFor(f)]));
  const pops: Record<Pop, number> = { lv: 0, rv: 0, a: 0 };
  const counts: Record<string, number> = {};
  for (const x of obs) counts[x.family] = (counts[x.family] ?? 0) + 1;
  const popCounts: Record<Pop, number> = { lv: 0, rv: 0, a: 0 };
  for (const x of obs) popCounts[x.pop]++;

  let trend: TrendPoint[] = [];
  let adj: number[] = obs.map((x) => x.y);
  for (let it = 0; it < iterations; it++) {
    adj = obs.map((x) => x.y - house[x.family] - (o.popEffects === false ? 0 : pops[x.pop]));
    trend = smooth(obs, adj, firstDay, lastDay, o.q);
    const at = (day: number) => trend[clamp(day - firstDay, 0, trend.length - 1)].mean;

    // Residuals against the smoothed trend, before removing any effects.
    const sums: Record<string, number> = {};
    const psums: Record<Pop, number> = { lv: 0, rv: 0, a: 0 };
    for (const x of obs) {
      const fit = at(x.day);
      const raw = x.y - fit;
      // Attribute the residual to house effect after subtracting the pop effect, and vice versa.
      sums[x.family] = (sums[x.family] ?? 0) + (raw - (o.popEffects === false ? 0 : pops[x.pop]));
      psums[x.pop] += raw - house[x.family];
    }
    for (const f of families) {
      const pr = priorFor(f);
      house[f] = (sums[f] + lambda * pr) / (counts[f] + lambda);
    }
    // Re-centre so the average house effect (by poll count) is zero.
    let tot = 0;
    let cnt = 0;
    for (const f of families) {
      tot += house[f] * counts[f];
      cnt += counts[f];
    }
    const shift = tot / Math.max(cnt, 1);
    for (const f of families) house[f] -= shift;

    if (o.popEffects !== false) {
      for (const p of ['lv', 'rv', 'a'] as Pop[]) pops[p] = popCounts[p] ? psums[p] / (popCounts[p] + popLambda) : 0;
      let pt = 0;
      let pc = 0;
      for (const p of ['lv', 'rv', 'a'] as Pop[]) {
        pt += pops[p] * popCounts[p];
        pc += popCounts[p];
      }
      const ps = pt / Math.max(pc, 1);
      for (const p of ['lv', 'rv', 'a'] as Pop[]) pops[p] -= ps;
    }
  }
  adj = obs.map((x) => x.y - house[x.family] - (o.popEffects === false ? 0 : pops[x.pop]));
  trend = smooth(obs, adj, firstDay, lastDay, o.q);

  const at = (day: number) => trend[clamp(day - firstDay, 0, trend.length - 1)].mean;
  const residual: Record<string, number> = {};
  const adjusted: Record<string, number> = {};
  obs.forEach((x, i) => {
    residual[x.id] = adj[i] - at(x.day);
    adjusted[x.id] = adj[i];
  });
  const houseEffects: FitResult['houseEffects'] = {};
  for (const f of families) houseEffects[f] = { effect: house[f], n: counts[f], prior: priorFor(f) };
  return { trend, houseEffects, popEffects: pops, residual, adjusted, firstDay };
}

/* ------------------------------------------------------------------ generic ballot */

export interface GenericAverage {
  asOf: string;
  margin: number;
  sd: number;
  lo: number;
  hi: number;
  d: number;
  r: number;
  /** What a likely-voter poll would show, given the estimated population effect. */
  lvMargin: number;
  trend: TrendPoint[];
  fit: FitResult;
  obs: Obs[];
  /** Approximate influence (0-1) of each poll on today's average. */
  influence: Record<string, number>;
}

/** Two-party-only margins run ~9% larger than ordinary toplines with ~9% undecided. */
export const TWO_PARTY_SCALE = 0.91;

function pollObs(p: Poll): Obs {
  const info = pollsterInfo(p.pollster);
  const n = p.n ?? 800;
  const deff = 1.6; // weighting design effect
  let v = marginVariance(n, p.d, p.r) * deff + 1.6 ** 2;
  v *= TIER_VAR[info.tier];
  if (p.approx) v *= 1.15;
  let y = p.margin * (p.twoParty ? TWO_PARTY_SCALE : 1);
  if (p.internal) {
    v *= 2;
    y += p.internal === 'D' ? -3 : 3;
  }
  return { id: p.id, day: pollDay(p.start, p.end), y, v, family: info.family, pop: p.pop };
}

export function aggregateGeneric(polls: Poll[], asOfIso: string): GenericAverage {
  const asOf = dayNum(asOfIso);
  const obs = polls.map(pollObs);
  const fit = fitTrend(obs, {
    q: 0.14 ** 2,
    asOf,
    lambda: 4,
    priorFor: (f) => {
      const hit = polls.find((p) => pollsterInfo(p.pollster).family === f);
      return hit ? pollsterInfo(hit.pollster).lean * 0.5 : 0;
    },
  });
  const cur = fit.trend[fit.trend.length - 1];
  const sd = Math.sqrt(cur.sd ** 2 + 0.6 ** 2);
  const withShares = polls.filter((p) => p.d !== null && p.r !== null && !p.internal);
  const ws = withShares.map((p) => {
    const age = asOf - pollDay(p.start, p.end);
    return Math.exp(-age / 20) / pollObs(p).v;
  });
  const total = weightedMean(withShares.map((p) => (p.d as number) + (p.r as number)), ws);

  const influence: Record<string, number> = {};
  let sumInf = 0;
  for (const o of obs) {
    const age = asOf - o.day;
    const w = Math.exp(-age / 14) / o.v;
    influence[o.id] = w;
    sumInf += w;
  }
  for (const k of Object.keys(influence)) influence[k] /= sumInf || 1;

  return {
    asOf: asOfIso,
    margin: cur.mean,
    sd,
    lo: cur.mean - 1.645 * sd,
    hi: cur.mean + 1.645 * sd,
    d: (total + cur.mean) / 2,
    r: (total - cur.mean) / 2,
    lvMargin: cur.mean + fit.popEffects.lv,
    trend: fit.trend,
    fit,
    obs,
    influence,
  };
}

/* ------------------------------------------------------------------ approval */

export interface ApprovalAverage {
  asOf: string;
  approve: number;
  disapprove: number;
  net: number;
  netSd: number;
  trendApprove: TrendPoint[];
  trendDisapprove: TrendPoint[];
  trendNet: TrendPoint[];
  fit: FitResult;
}

/** Approval-format priors (points on the approve share). Harris uses a forced-choice question. */
const APPROVE_PRIOR: Record<string, number> = { 'Harvard CAPS/Harris': 6 };

export function aggregateApproval(polls: ApprovalPoll[], asOfIso: string): ApprovalAverage {
  const asOf = dayNum(asOfIso);
  const mk = (p: ApprovalPoll, val: number): Obs => {
    const info = pollsterInfo(p.pollster);
    const n = p.n ?? 1000;
    const v = ((val * (100 - val)) / 100 / n) * 100;
    return {
      id: p.id,
      day: pollDay(p.start, p.end),
      y: val,
      v: (v * 1.6 + 1.3 ** 2) * TIER_VAR[info.tier],
      family: info.family,
      pop: p.pop ?? 'a',
    };
  };
  const apprObs = polls.map((p) => mk(p, p.approve));
  const disObs = polls.filter((p) => p.disapprove !== null).map((p) => mk(p, p.disapprove as number));
  const opt = { q: 0.16 ** 2, asOf, lambda: 4, popEffects: false as const };
  const fa = fitTrend(apprObs, { ...opt, priorFor: (f) => APPROVE_PRIOR[f] ?? 0 });
  const fd = fitTrend(disObs, opt);
  const first = Math.min(fa.firstDay, fd.firstDay);
  const last = Math.max(fa.trend[fa.trend.length - 1].day, fd.trend[fd.trend.length - 1].day);
  const at = (t: TrendPoint[], day: number) => t[clamp(day - t[0].day, 0, t.length - 1)];
  const trendNet: TrendPoint[] = [];
  for (let d = Math.max(first, fd.firstDay); d <= last; d++) {
    const a = at(fa.trend, d);
    const b = at(fd.trend, d);
    trendNet.push({ day: d, date: isoFromDay(d), mean: a.mean - b.mean, sd: Math.sqrt(a.sd ** 2 + b.sd ** 2) });
  }
  const a = fa.trend[fa.trend.length - 1];
  const n = trendNet[trendNet.length - 1];
  const dis = fd.trend[fd.trend.length - 1];
  return {
    asOf: asOfIso,
    approve: a.mean,
    disapprove: dis.mean,
    net: n.mean,
    netSd: n.sd,
    trendApprove: fa.trend,
    trendDisapprove: fd.trend,
    trendNet,
    fit: fa,
  };
}

/* ------------------------------------------------------------------ race averages */

export interface RaceAverage {
  margin: number;
  /** Standard error of the poll average as a measure of the race margin (before shared error). */
  se: number;
  n: number;
  nRecent: number;
  latest: string | null;
  d: number;
  r: number;
  weights: Record<string, number>;
  adjusted: Record<string, number>;
}

export interface RaceAvgOptions {
  halfLifeDays?: number;
  maxAgeDays?: number;
  /** How much of the pollster's prior lean to remove (0-1). */
  leanShrink?: number;
}

/** Recency-, size- and quality-weighted average of a race's polls. */
export function raceAverage(polls: Poll[], asOfIso: string, opts: RaceAvgOptions = {}): RaceAverage {
  const asOf = dayNum(asOfIso);
  const half = opts.halfLifeDays ?? 16;
  const maxAge = opts.maxAgeDays ?? 75;
  const shrink = opts.leanShrink ?? 0.8;
  const weights: Record<string, number> = {};
  const adjusted: Record<string, number> = {};
  const usable: { p: Poll; w: number; y: number; prec: number }[] = [];
  const byFamily: Record<string, number> = {};
  const sorted = [...polls].sort((a, b) => (a.end < b.end ? 1 : -1));
  for (const p of sorted) {
    const age = asOf - pollDay(p.start, p.end);
    if (age > maxAge) continue;
    const info = pollsterInfo(p.pollster);
    const k = (byFamily[info.family] = (byFamily[info.family] ?? 0) + 1);
    const n = p.n ?? 700;
    let v = (marginVariance(n, p.d, p.r) * 1.6 + 2.4 ** 2) * TIER_VAR[info.tier];
    let y = p.margin * (p.twoParty ? TWO_PARTY_SCALE : 1) - info.lean * shrink;
    if (p.internal) {
      v *= 2.2;
      y += p.internal === 'D' ? -4 : 4;
    }
    if (p.approx) v *= 1.15;
    // Repeat polls from one firm count for less each time.
    v *= Math.sqrt(k);
    const rec = Math.pow(0.5, Math.max(age, 0) / half);
    const prec = 1 / v;
    usable.push({ p, w: prec * rec, y, prec: prec * rec });
    adjusted[p.id] = y;
  }
  if (!usable.length) {
    return { margin: NaN, se: Infinity, n: polls.length, nRecent: 0, latest: null, d: NaN, r: NaN, weights, adjusted };
  }
  const sumW = usable.reduce((a, u) => a + u.w, 0);
  const margin = usable.reduce((a, u) => a + u.w * u.y, 0) / sumW;
  for (const u of usable) weights[u.p.id] = u.w / sumW;
  // Effective information: down-weighted for staleness.
  const info = usable.reduce((a, u) => a + u.prec, 0);
  const seStat = Math.sqrt(1 / info);
  const shared = 2.6; // systematic error common to all polls of the race
  const se = Math.sqrt(seStat ** 2 + shared ** 2);
  const withShares = usable.filter((u) => u.p.d !== null && u.p.r !== null);
  const dAvg = withShares.length ? withShares.reduce((a, u) => a + u.w * (u.p.d as number), 0) / withShares.reduce((a, u) => a + u.w, 0) : NaN;
  const rAvg = withShares.length ? withShares.reduce((a, u) => a + u.w * (u.p.r as number), 0) / withShares.reduce((a, u) => a + u.w, 0) : NaN;
  const latest = usable.reduce((a, u) => (u.p.end > a ? u.p.end : a), '');
  return {
    margin,
    se,
    n: polls.length,
    nRecent: usable.length,
    latest,
    d: dAvg,
    r: rAvg,
    weights,
    adjusted,
  };
}

/** Rolling weekly average for plotting a race's trend from its polls. */
export function raceTrend(polls: Poll[], fromIso: string, toIso: string, stepDays = 3): { day: number; date: string; margin: number }[] {
  const out: { day: number; date: string; margin: number }[] = [];
  const from = dayNum(fromIso);
  const to = dayNum(toIso);
  for (let d = from; d <= to; d += stepDays) {
    const upto = polls.filter((p) => pollDay(p.start, p.end) <= d);
    if (upto.length < 2) continue;
    const a = raceAverage(upto, isoFromDay(d), { maxAgeDays: 120, halfLifeDays: 20 });
    if (Number.isFinite(a.margin)) out.push({ day: d, date: isoFromDay(d), margin: a.margin });
  }
  return out;
}
