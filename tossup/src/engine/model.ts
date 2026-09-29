// Race models: turn polls, fundamentals and expert ratings into a mean and an uncertainty for every
// race. The Monte Carlo (sim.ts) then layers on shared error so that races move together.
//
//   margin_i = mean_i + elasticity_i * national + region(i) + office(i) + idio_i
//
// `mean_i` blends up to three ingredients (precision-weighted, each with an adjustable multiplier):
//   polls         recency/size/quality-weighted average of the race's polls
//   fundamentals  state or district partisan lean + national environment + incumbency (+ named adjustments)
//   ratings       what Cook / Sabato / Inside Elections imply, converted to a margin
// The national environment blends the generic-ballot average with a presidential-approval regression.

import polls from '../data/generated/polls.json';
import { GOVERNOR_RACES, SENATE_RACES } from '../data/races';
import { HOUSE_SEATS } from '../data/house';
import { fitMidterms } from '../data/history';
import { RATING_MARGIN, consensus } from '../data/ratings';
import { STATE_BY_CODE, stateLean } from '../data/states';
import type { ApprovalPoll, Poll, RaceMeta, RegionId } from '../data/types';
import { aggregateApproval, aggregateGeneric, raceAverage, type RaceAverage } from './aggregate';
import { clamp } from './stats';

export const AS_OF = '2026-09-29';
export const ELECTION_DAY = '2026-11-03';

export type Flavor = 'blend' | 'polls' | 'fundamentals' | 'ratings';

export const FLAVORS: { id: Flavor; name: string; blurb: string }[] = [
  { id: 'blend', name: 'Blend', blurb: 'Polls, fundamentals and expert ratings, weighted by how much each knows.' },
  { id: 'polls', name: 'Polls only', blurb: 'Only what the polls say. Races without polls fall back to fundamentals.' },
  { id: 'fundamentals', name: 'Fundamentals', blurb: 'Partisan lean, the national mood, incumbency. No race polls, no ratings.' },
  { id: 'ratings', name: 'Expert ratings', blurb: 'Only what Cook, Sabato and Inside Elections imply.' },
];

export interface ModelConfig {
  flavor: Flavor;
  /** Relative weight multipliers on each ingredient (blend flavor). */
  weights: { polls: number; fundamentals: number; ratings: number };
  /** Override the national House-vote margin (D minus R, points). null = model estimate. */
  envOverride: number | null;
  sigmaNat: number;
  sigmaRegion: number;
  sigmaOffice: number;
  /** Count independent challengers Osborn (NE) and Achilles (ID) toward Democratic control. */
  indCaucusD: boolean;
  nSims: number;
  seed: number;
  /** Polls the user added in the browser (generic ballot and race polls). */
  extraPolls: Poll[];
  extraApproval: ApprovalPoll[];
}

export const DEFAULT_CONFIG: ModelConfig = {
  flavor: 'blend',
  weights: { polls: 1, fundamentals: 1, ratings: 1 },
  envOverride: null,
  sigmaNat: 3.3,
  sigmaRegion: 1.8,
  sigmaOffice: 1.2,
  indCaucusD: false,
  nSims: 20000,
  seed: 20261103,
  extraPolls: [],
  extraApproval: [],
};

/* -------------------------------------------------------------------------- environment */

export interface Environment {
  generic: number;
  genericSd: number;
  approvalNet: number;
  /** House popular-vote margin implied by presidential approval. */
  fundamentals: number;
  fundamentalsSd: number;
  /** Blend used as the national environment. */
  blend: number;
  blendSd: number;
}

/**
 * Regression of the out-party's House popular-vote margin on the president's net approval, fit to
 * 1994-2022 midterms (8 points; approximate approvals a few weeks out). Intercept and slope in points.
 * Small sample, wide error: it is a sanity anchor for the generic ballot, not a competitor to it.
 */
const FIT = fitMidterms();
const FUND_INTERCEPT = FIT.intercept;
const FUND_SLOPE = FIT.slope;
const FUND_SD = Math.max(FIT.rmse * 1.15, 4.0);

let ENV_CACHE: Environment | null = null;
let ENV_KEY = '';
export function getEnvironment(extra: Poll[] = [], extraApproval: ApprovalPoll[] = []): Environment {
  const key = extra.map((p) => p.id).join('|') + '#' + extraApproval.map((p) => p.id).join('|');
  if (ENV_CACHE && key === ENV_KEY) return ENV_CACHE;
  ENV_KEY = key;
  const g = aggregateGeneric([...(polls.generic as Poll[]), ...extra.filter((p) => p.race === 'generic')], AS_OF);
  const a = aggregateApproval([...(polls.approval as ApprovalPoll[]), ...extraApproval], AS_OF);
  const fund = FUND_INTERCEPT + FUND_SLOPE * -a.net;
  const gSd = Math.sqrt(g.sd ** 2 + 1.8 ** 2);
  const wG = 1 / gSd ** 2;
  const wF = 1 / FUND_SD ** 2;
  const blend = (wG * g.margin + wF * fund) / (wG + wF);
  ENV_CACHE = {
    generic: g.margin,
    genericSd: gSd,
    approvalNet: a.net,
    fundamentals: fund,
    fundamentalsSd: FUND_SD,
    blend,
    blendSd: Math.sqrt(1 / (wG + wF)),
  };
  return ENV_CACHE;
}

/* -------------------------------------------------------------------------- race models */

export interface Ingredient {
  mean: number;
  /** Idiosyncratic sd of this ingredient as an estimate of the race margin. */
  sd: number;
}

export interface RaceModel {
  id: string;
  office: RaceMeta['office'];
  state: string;
  region: RegionId;
  holder: RaceMeta['holder'];
  /** True if the D-side candidate is an independent (NE, ID). */
  indepD: boolean;
  /** Final blended mean at the current environment, and idiosyncratic sd. */
  mean: number;
  sd: number;
  elasticity: number;
  polls?: Ingredient & { avg: RaceAverage };
  fundamentals: Ingredient;
  ratings: Ingredient;
  weightsUsed: { polls: number; fundamentals: number; ratings: number };
}

const INC_BONUS = { senate: 2.0, governor: 3.0, house: 2.0 } as const;
const IDIO_FUND = { senate: 6.5, governor: 6.5, house: 6.0 } as const;
const IDIO_RATING = { senate: 4.8, governor: 5.0, house: 5.2 } as const;
const LATE_MOVE = 2.0;

/**
 * The national mood that expert House ratings implicitly assume. Raters move ratings in steps and lag
 * the polls (Cook: "Democrats gain 5 to 15 seats"), so I treat them as calibrated to roughly D+5,
 * about three and a half points less Democratic than today's generic-ballot blend. This is the one
 * judgment call that matters most for the House; the Methods page says so.
 */
export const RATINGS_MOOD = 5.0;

const elasticity = (lean: number) => clamp(1 - 0.012 * Math.abs(lean), 0.72, 1.05);

/** Named, documented adjustments to fundamentals (points D). */
const ADJ: Record<string, { adj: number; note: string }> = {
  'senate-me': { adj: -9, note: 'Susan Collins has run far ahead of the presidential margin in Maine.' },
  'senate-nh': { adj: -2.5, note: 'John Sununu is a former senator with a well-known name.' },
  'senate-ak': { adj: 8, note: 'Mary Peltola has won Alaska statewide and came within three points of a Trump +13 state in 2024.' },
  'senate-ne': { adj: 12, note: 'Dan Osborn ran about 13 points ahead of the Democratic baseline in 2024.' },
  'senate-oh': { adj: 2, note: 'Sherrod Brown has a long record of outrunning the top of the ticket in Ohio.' },
  'senate-tx': { adj: 1, note: 'Talarico has raised roughly $68 million to Paxton\'s under $10 million.' },
  'senate-sd': { adj: 5, note: 'A well-funded independent challenger; the Democrat withdrew.' },
  'senate-id': { adj: 4, note: 'An independent challenger consolidating opposition to a long-serving incumbent.' },
};

function incumbencyFor(r: RaceMeta): number {
  const cands = [r.candidates.D, r.candidates.R, r.candidates.I];
  const incumbent = cands.find((c) => c?.incumbent);
  if (!incumbent) return 0;
  const size = INC_BONUS[r.office];
  const noteAppointed = incumbent.note?.toLowerCase().includes('appointed');
  const v = noteAppointed ? size * 0.5 : size;
  return incumbent.party === 'D' ? v : incumbent.party === 'R' ? -v : 0;
}

const PRIOR_SHARED = 2.6; // matches raceAverage() shared systematic error

export function mergeRacePolls(extra: Poll[]): Record<string, Poll[]> {
  const base = polls.races as Record<string, Poll[]>;
  if (!extra.length) return base;
  const out: Record<string, Poll[]> = { ...base };
  for (const p of extra) if (p.race !== 'generic') out[p.race] = [...(out[p.race] ?? []), p];
  return out;
}

export function buildRaceModels(config: ModelConfig): RaceModel[] {
  const env = getEnvironment(config.extraPolls, config.extraApproval);
  const M = config.envOverride ?? env.blend;
  const shift = M - env.blend; // what a scenario moves relative to today
  const out: RaceModel[] = [];
  const races: RaceMeta[] = [...SENATE_RACES, ...GOVERNOR_RACES, ...HOUSE_SEATS];
  const racePolls = mergeRacePolls(config.extraPolls);

  for (const r of races) {
    const st = STATE_BY_CODE[r.state];
    const cons = consensus(r);
    const idioF = IDIO_FUND[r.office];
    const idioR = IDIO_RATING[r.office];

    // ----- fundamentals
    let lean: number;
    let fundMean: number;
    if (r.office === 'house') {
      // House fundamentals: the neutral lean implied by the ratings, then today's national mood on top.
      const e = elasticity(cons.margin);
      lean = cons.margin - RATINGS_MOOD * e;
      fundMean = lean + M * e;
    } else {
      lean = stateLean(r.state);
      const adj = ADJ[r.id]?.adj ?? r.adj ?? 0;
      const e = elasticity(lean);
      fundMean = lean + env.blend * e + incumbencyFor(r) + adj + shift * e;
    }
    const el = r.office === 'house' ? elasticity(cons.margin) : elasticity(lean);

    // ----- ratings (as published, moved only by scenario changes)
    const ratingMean = cons.margin + shift * el;

    // ----- polls
    const pl = racePolls[r.id.replace('governor-', 'gov-')] ?? racePolls[r.id];
    let pollIng: (Ingredient & { avg: RaceAverage }) | undefined;
    if (pl?.length && r.office !== 'house') {
      const avg = raceAverage(pl, AS_OF);
      if (Number.isFinite(avg.margin) && avg.nRecent > 0) {
        const stat = Math.sqrt(Math.max(avg.se ** 2 - PRIOR_SHARED ** 2, 0.5));
        pollIng = { mean: avg.margin + shift * el, sd: Math.sqrt(stat ** 2 + LATE_MOVE ** 2), avg };
      }
    }

    // ----- weights per flavor
    const wt = config.weights;
    let wP = 0;
    let wF = 0;
    let wR = 0;
    switch (config.flavor) {
      case 'polls':
        if (pollIng) wP = 1;
        else wF = 1;
        break;
      case 'fundamentals':
        wF = 1;
        break;
      case 'ratings':
        wR = 1;
        break;
      default:
        wP = pollIng ? wt.polls / pollIng.sd ** 2 : 0;
        wF = wt.fundamentals / idioF ** 2;
        // Ratings partly restate polls and fundamentals, so they count for less (least for the House,
        // where the fundamentals are themselves built from the ratings).
        wR = (wt.ratings * (r.office === 'house' ? 0.35 : 0.5)) / idioR ** 2;
    }
    const total = wP + wF + wR;
    const mean = (wP * (pollIng?.mean ?? 0) + wF * fundMean + wR * ratingMean) / total;
    const varBlend = config.flavor === 'blend' ? 1.15 / total : 1 / total;
    const sdBlend =
      config.flavor === 'blend'
        ? Math.sqrt(varBlend)
        : config.flavor === 'polls' && pollIng
          ? pollIng.sd
          : config.flavor === 'ratings'
            ? idioR
            : idioF;

    out.push({
      id: r.id,
      office: r.office,
      state: r.state,
      region: st.region,
      holder: r.holder,
      indepD: r.candidates.D?.party === 'I' || Boolean(r.candidates.I && !r.candidates.D),
      mean,
      sd: Math.max(sdBlend, 2.0),
      elasticity: el,
      polls: pollIng,
      fundamentals: { mean: fundMean, sd: idioF },
      ratings: { mean: ratingMean, sd: idioR },
      weightsUsed: { polls: wP / total, fundamentals: wF / total, ratings: wR / total },
    });
    void RATING_MARGIN;
  }
  return out;
}

export const REGION_IDS: RegionId[] = ['NE', 'SE', 'GL', 'GP', 'SW', 'MT', 'PC'];

export interface FundBreakdown {
  lean: number;
  envTerm: number;
  incumbency: number;
  adj: number;
  adjNote?: string;
  total: number;
  elasticity: number;
  ratingImplied?: number;
}

/** Itemized fundamentals for a race at national mood M (for display; mirrors buildRaceModels). */
export function fundamentalsBreakdown(r: RaceMeta, M: number): FundBreakdown {
  const cons = consensus(r);
  if (r.office === 'house') {
    const e = elasticity(cons.margin);
    const lean = cons.margin - RATINGS_MOOD * e;
    return { lean, envTerm: M * e, incumbency: 0, adj: 0, total: lean + M * e, elasticity: e, ratingImplied: cons.margin };
  }
  const lean = stateLean(r.state);
  const e = elasticity(lean);
  const a = ADJ[r.id];
  const inc = incumbencyFor(r);
  const adj = a?.adj ?? r.adj ?? 0;
  return { lean, envTerm: M * e, incumbency: inc, adj, adjNote: a?.note ?? r.adjNote, total: lean + M * e + inc + adj, elasticity: e };
}
