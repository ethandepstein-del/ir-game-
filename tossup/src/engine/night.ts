// Election night engine: a practice-night simulator, feed parsing, and conversion of results into
// constraints for the simulation (the "needle").

import { STATE_BY_CODE } from '../data/states';
import { SENATE_NOT_UP, GOVERNORS_NOT_UP } from '../data/races';
import type { RaceMeta } from '../data/types';
import type { Constraints } from './sim';
import { REGION_IDS, type ModelConfig, type RaceModel } from './model';
import { gaussian, normInv, rng } from './stats';

export interface RaceResult {
  /** Fraction of the expected vote counted, 0-1. */
  reporting: number;
  /** Current D minus R margin in percentage points of the vote counted so far. */
  margin: number | null;
  called?: 'D' | 'R' | 'I';
  /** Minutes after 6 pm ET when the race was called (practice night only). */
  calledAt?: number;
}
export type Results = Record<string, RaceResult>;

/** Clock: minutes since 6:00 pm Eastern on election night. */
export const NIGHT_START_HOUR = 18;
export const NIGHT_END_MIN = 600; // 4:00 am

export function clockLabel(min: number): string {
  const total = NIGHT_START_HOUR * 60 + Math.round(min);
  const h24 = Math.floor(total / 60) % 24;
  const m = total % 60;
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${h24 >= 12 ? 'pm' : 'am'}`;
}

/** Deterministic hash to [0,1). */
export function hashUnit(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
function hashNormal(s: string): number {
  const u1 = Math.max(hashUnit(s + 'a'), 1e-9);
  const u2 = hashUnit(s + 'b');
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Standard deviation of what a partial count says about the final margin. */
export const partialSd = (f: number) => 3 + 14 * Math.pow(Math.max(0, 1 - f), 1.3);

export interface NightWorld {
  seed: number;
  truth: Record<string, number>;
  national: number;
  callTime: Record<string, number>;
  start: Record<string, number>;
  duration: Record<string, number>;
  skew: Record<string, number>;
}

const PACE = { fast: { delay: 8, dur: 150 }, medium: { delay: 25, dur: 320 }, slow: { delay: 60, dur: 900 } } as const;
const SKEW_OVERRIDE: Record<string, number> = { CA: -5, WA: -4, OR: -4, NV: -3.5, AZ: -3.5, PA: -3, AK: -3 };

const smooth = (p: number) => p * p * (3 - 2 * p);

/** Reported margin of a race at minute t, given the world. */
function reported(w: NightWorld, id: string, t: number): { f: number; y: number } {
  const p = Math.min(1, Math.max(0, (t - w.start[id]) / w.duration[id]));
  const f = p >= 1 ? 1 : smooth(p);
  if (f <= 0) return { f: 0, y: NaN };
  const noise = hashNormal(`${id}#${Math.floor(t / 20)}`) * 5.5 * Math.pow(1 - f, 1.1);
  return { f, y: w.truth[id] + w.skew[id] * (1 - f) + noise };
}

export function makeWorld(models: RaceModel[], config: ModelConfig, envMean: number, seed: number): NightWorld {
  const u = rng(seed);
  const z = gaussian(u);
  const nat = z() * config.sigmaNat;
  const reg = REGION_IDS.map(() => z() * config.sigmaRegion);
  const off = [z() * config.sigmaOffice, z() * config.sigmaOffice, z() * config.sigmaOffice];
  const w: NightWorld = { seed, truth: {}, national: envMean + nat, callTime: {}, start: {}, duration: {}, skew: {} };
  for (const m of models) {
    const o = m.office === 'senate' ? 0 : m.office === 'governor' ? 1 : 2;
    w.truth[m.id] = m.mean + m.elasticity * nat + reg[REGION_IDS.indexOf(m.region)] + off[o] + m.sd * z();
  }
  for (const m of models) {
    const st = STATE_BY_CODE[m.state];
    const pace = PACE[st.pace];
    const j = 0.8 + 0.4 * hashUnit(m.id + 'dur');
    const close = (st.close - NIGHT_START_HOUR) * 60;
    const closeCol = m.office === 'house' ? 1 : 0; // House counts start a touch later than statewide
    w.start[m.id] = close + pace.delay * (0.7 + 0.6 * hashUnit(m.id + 'st')) + closeCol * 6;
    const closeRace = Math.abs(w.truth[m.id]) < 1.5 ? 1.5 : Math.abs(w.truth[m.id]) < 4 ? 1.2 : 1;
    w.duration[m.id] = pace.dur * j * closeRace;
    const base = (hashUnit(m.state + 'skew') - 0.5) * 8 * (st.pace === 'slow' ? 1.3 : st.pace === 'fast' ? 0.7 : 1);
    w.skew[m.id] = SKEW_OVERRIDE[m.state] !== undefined ? SKEW_OVERRIDE[m.state] + (hashUnit(m.id + 'sk') - 0.5) * 2 : base;
  }
  // Call times: scan the night at five-minute steps.
  for (const m of models) {
    const truth = w.truth[m.id];
    const close = (STATE_BY_CODE[m.state].close - NIGHT_START_HOUR) * 60;
    if (Math.abs(m.mean) > 22 && Math.abs(truth) > 8) {
      w.callTime[m.id] = close + 1 + Math.floor(hashUnit(m.id + 'c') * 4);
      continue;
    }
    w.callTime[m.id] = Infinity;
    for (let t = Math.max(0, Math.floor(w.start[m.id])); t <= NIGHT_END_MIN; t += 5) {
      const { f, y } = reported(w, m.id, t);
      if (f < 0.12) continue;
      const se = 2.0 + 12 * Math.pow(1 - f, 1.5);
      if (Math.abs(y) / se > 2.7 && Math.sign(y) === Math.sign(truth) && (f >= 0.25 || Math.abs(y) > 20)) {
        w.callTime[m.id] = t;
        break;
      }
      if (f >= 0.999 && Math.abs(truth) > 0.6) {
        w.callTime[m.id] = t + 10;
        break;
      }
    }
  }
  return w;
}

export function resultsAt(w: NightWorld, models: RaceModel[], indepD: Record<string, boolean>, t: number): Results {
  const out: Results = {};
  for (const m of models) {
    const { f, y } = reported(w, m.id, t);
    const called = t >= w.callTime[m.id];
    if (f <= 0 && !called) continue;
    const truth = w.truth[m.id];
    const r: RaceResult = {
      reporting: Math.max(f, called ? 0.02 : 0),
      margin: f > 0 ? y : called ? truth : null,
    };
    if (called) {
      r.called = truth > 0 ? (indepD[m.id] ? 'I' : 'D') : 'R';
      r.calledAt = w.callTime[m.id];
    }
    out[m.id] = r;
  }
  return out;
}

/** Turn results into simulation constraints for the needle. */
export function constraintsFrom(results: Results, indepD: Record<string, boolean>): Constraints {
  const forced: Record<string, 'D' | 'R'> = {};
  const observed: Record<string, { y: number; s: number }> = {};
  for (const [id, r] of Object.entries(results)) {
    if (r.called === 'D' || r.called === 'I') forced[id] = 'D';
    else if (r.called === 'R') forced[id] = 'R';
    else if (r.margin !== null && r.reporting > 0.03) observed[id] = { y: r.margin, s: partialSd(r.reporting) };
  }
  void indepD;
  return { forced, observed };
}

export interface Tally {
  D: number;
  R: number;
  I: number;
  /** Races on the ballot not yet called. */
  pending: number;
  needed: number;
  /** Seats where a call has not been made. */
  total: number;
}

export function tally(results: Results, races: RaceMeta[], office: RaceMeta['office']): Tally {
  const rs = races.filter((r) => r.office === office);
  let D = office === 'senate' ? SENATE_NOT_UP.D : office === 'governor' ? GOVERNORS_NOT_UP.D : 0;
  let R = office === 'senate' ? SENATE_NOT_UP.R : office === 'governor' ? GOVERNORS_NOT_UP.R : 0;
  let I = 0;
  let pending = 0;
  for (const r of rs) {
    const c = results[r.id]?.called;
    if (c === 'D') D++;
    else if (c === 'R') R++;
    else if (c === 'I') I++;
    else pending++;
  }
  return { D, R, I, pending, needed: office === 'senate' ? 51 : office === 'governor' ? 26 : 218, total: rs.length };
}

/** Average of (reported margin minus what we expected), weighted by how much of the count is in. */
export function swingVsModel(results: Results, models: Record<string, RaceModel>, minReport = 0.25): { swing: number; n: number } | null {
  let s = 0;
  let w = 0;
  let n = 0;
  for (const [id, r] of Object.entries(results)) {
    const m = models[id];
    if (!m || r.margin === null || r.reporting < minReport || m.office === 'house' && Math.abs(m.mean) > 20) continue;
    if (Math.abs(m.mean) > 25) continue;
    const wt = r.reporting / (1 + (m.sd / 5) ** 2);
    s += wt * (r.margin - m.mean);
    w += wt;
    n++;
  }
  return w > 0 ? { swing: s / w, n } : null;
}

/* ------------------------------------------------------------------ live feed */

export interface FeedParse {
  results: Results;
  problems: string[];
  updated?: string;
}

/**
 * Accepts { updated?, races: { [raceId]: { reporting: 0-100 | 0-1, d, r, dPct?, rPct?, called? } } }.
 * `d` and `r` may be vote counts or percentages: only their ratio matters.
 */
export function parseFeed(json: unknown, known: Set<string>): FeedParse {
  const problems: string[] = [];
  const results: Results = {};
  if (!json || typeof json !== 'object') return { results, problems: ['The feed is not a JSON object.'] };
  const obj = json as { updated?: string; races?: Record<string, Record<string, unknown>> };
  if (!obj.races || typeof obj.races !== 'object') return { results, problems: ['Missing "races" object.'], updated: obj.updated };
  for (const [id, r] of Object.entries(obj.races)) {
    if (!known.has(id)) {
      problems.push(`Unknown race id "${id}"`);
      continue;
    }
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
    let rep = num(r.reporting);
    if (rep !== null && rep > 1) rep /= 100;
    const d = num(r.d ?? r.dPct);
    const rr = num(r.r ?? r.rPct);
    const called = r.called === 'D' || r.called === 'R' || r.called === 'I' ? (r.called as 'D' | 'R' | 'I') : undefined;
    let margin: number | null = null;
    if (d !== null && rr !== null && d + rr > 0) margin = (100 * (d - rr)) / (d + rr);
    else if (num(r.margin) !== null) margin = num(r.margin);
    if (rep === null && !called) {
      problems.push(`${id}: needs "reporting" or "called"`);
      continue;
    }
    results[id] = { reporting: rep ?? (called ? 1 : 0), margin, called };
  }
  return { results, problems, updated: obj.updated };
}

export function sampleFeed(ids: string[], seed = 7): string {
  const races: Record<string, unknown> = {};
  ids.slice(0, 6).forEach((id, i) => {
    races[id] = { reporting: 20 + i * 12, d: 1000 + Math.round(hashUnit(id + seed) * 500), r: 1000 + Math.round(hashUnit(id + 'r') * 500), called: null };
  });
  return JSON.stringify({ updated: '2026-11-03T21:15:00-05:00', races }, null, 2);
}

export { normInv };
