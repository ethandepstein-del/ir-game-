import polls from '../data/generated/polls.json';
import type { ApprovalPoll, Poll } from '../data/types';
import { aggregateApproval, aggregateGeneric, raceAverage, type RaceAverage } from '../engine/aggregate';
import { AS_OF } from '../engine/model';
import { GOVERNOR_RACES, SENATE_RACES } from '../data/races';
import { HOUSE_SEATS } from '../data/house';
import type { RaceMeta } from '../data/types';

export const GENERIC_POLLS = polls.generic as Poll[];
export const APPROVAL_POLLS = polls.approval as ApprovalPoll[];
export const RACE_POLLS = polls.races as Record<string, Poll[]>;
export const DATA_BUILT = (polls as { builtAt?: string }).builtAt;

export const GENERIC = aggregateGeneric(GENERIC_POLLS, AS_OF);
export const APPROVAL = aggregateApproval(APPROVAL_POLLS, AS_OF);

export const ALL_RACES: RaceMeta[] = [...SENATE_RACES, ...GOVERNOR_RACES, ...HOUSE_SEATS];
export const RACE_BY_ID: Record<string, RaceMeta> = Object.fromEntries(ALL_RACES.map((r) => [r.id, r]));

const avgCache = new Map<string, RaceAverage>();
export function pollAverageFor(id: string): RaceAverage | null {
  const list = RACE_POLLS[id];
  if (!list?.length) return null;
  let a = avgCache.get(id);
  if (!a) {
    a = raceAverage(list, AS_OF);
    avgCache.set(id, a);
  }
  return Number.isFinite(a.margin) ? a : null;
}

export const ALL_POLL_COUNT = GENERIC_POLLS.length + APPROVAL_POLLS.length + Object.values(RACE_POLLS).reduce((a, l) => a + l.length, 0);

export function raceLabel(r: RaceMeta): string {
  if (r.office === 'house') return r.title;
  return r.title;
}
