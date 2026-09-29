import { useMemo } from 'react';
import { consensus, type Consensus } from '../data/ratings';
import type { RaceMeta } from '../data/types';
import type { RaceModel } from '../engine/model';
import type { RaceSim } from '../engine/sim';
import { useForecast } from '../state/forecast';
import { ALL_RACES } from '../state/data';
import { AS_OF, mergeRacePolls } from '../engine/model';
import { raceAverage } from '../engine/aggregate';
import type { RaceAverage } from '../engine/aggregate';
import type { Poll } from '../data/types';

export interface Row {
  meta: RaceMeta;
  model: RaceModel;
  sim: RaceSim | undefined;
  cons: Consensus;
  avg: RaceAverage | null;
  polls: Poll[];
  pD: number | undefined;
  /** Projected D margin (simulation mean when available, else the model mean). */
  margin: number;
  tipping: number;
  flips: 'D' | 'R' | null;
}

/** Join race metadata, polls, model and simulation results for one office. */
export function useRows(office: RaceMeta['office']): Row[] {
  const { result, modelById, config } = useForecast();
  return useMemo(() => {
    const tipIndex: Record<string, number> = {};
    if (result) {
      const ch = office === 'senate' ? result.senate : office === 'governor' ? result.governor : result.house;
      let k = 0;
      result.ids.forEach((id) => {
        if (id.startsWith(office === 'governor' ? 'gov-' : office + '-')) tipIndex[id] = ch.tipping[k++] ?? 0;
      });
    }
    const merged = mergeRacePolls(config.extraPolls);
    const simById = result ? Object.fromEntries(result.races.map((r) => [r.id, r])) : {};
    return ALL_RACES.filter((r) => r.office === office).map((meta) => {
      const model = modelById[meta.id];
      const sim: RaceSim | undefined = simById[meta.id];
      const pD = sim?.pD;
      const margin = sim?.mean ?? model.mean;
      const projected = margin > 0 ? 'D' : 'R';
      const holderIsD = meta.holder === 'D';
      const flips: 'D' | 'R' | null = pD === undefined ? null : holderIsD && pD < 0.5 ? 'R' : !holderIsD && pD > 0.5 ? 'D' : null;
      void projected;
      return {
        meta,
        model,
        sim,
        cons: consensus(meta),
        avg: avgOf(merged[meta.id]),
        polls: merged[meta.id] ?? [],
        pD,
        margin,
        tipping: tipIndex[meta.id] ?? 0,
        flips,
      };
    });
  }, [office, result, modelById, config.extraPolls]);
}

function avgOf(list: Poll[] | undefined): RaceAverage | null {
  if (!list?.length) return null;
  const a = raceAverage(list, AS_OF);
  return Number.isFinite(a.margin) ? a : null;
}
