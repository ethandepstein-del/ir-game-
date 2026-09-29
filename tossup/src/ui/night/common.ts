import { useMemo } from 'react';
import { HOUSE_INDEX } from '../../data/house';
import { STATE_BY_CODE } from '../../data/states';
import { leverage } from '../../engine/insights';
import { useForecast } from '../../state/forecast';
import { ALL_RACES, RACE_BY_ID } from '../../state/data';
import type { RaceMeta } from '../../data/types';

export const closeKey = (h: number) => Math.round(h * 60);

export interface WatchRow {
  meta: RaceMeta;
  close: number;
  pace: 'fast' | 'medium' | 'slow';
  swing: number;
  pD: number;
  mean: number;
  beta: number;
  pCtrlIfD: number;
  pCtrlIfR: number;
  call: string;
  chamber: string;
}

/** How soon a race is likely to be called, from its closeness and its state's counting pace. */
export function callEstimate(mean: number, pace: 'fast' | 'medium' | 'slow'): string {
  const a = Math.abs(mean);
  if (a > 20) return 'At poll close';
  if (pace === 'fast') return a > 8 ? 'Within about an hour or two' : a > 3 ? 'Late evening' : 'Late night, maybe later';
  if (pace === 'medium') return a > 10 ? 'Late evening' : a > 4 ? 'Late night' : 'Could slip to the next day';
  return a > 15 ? 'Late night' : 'Possibly days';
}

/** Rows for the watch list: each race with leverage, timing and how well it reads the national mood. */
export function useWatchRows(): WatchRow[] {
  const { result, modelById, config } = useForecast();
  return useMemo(() => {
    if (!result) return [];
    const lev = leverage(result);
    const s2 = config.sigmaNat ** 2;
    return lev
      .map((l) => {
        const meta = RACE_BY_ID[l.id];
        const model = modelById[l.id];
        const st = STATE_BY_CODE[meta.state];
        const shared = model.elasticity ** 2 * s2 + config.sigmaRegion ** 2 + config.sigmaOffice ** 2;
        const beta = (model.elasticity * s2) / (shared + model.sd ** 2);
        return {
          meta,
          close: st.close,
          pace: st.pace,
          swing: l.swing,
          pD: l.pD,
          mean: l.mean,
          beta,
          pCtrlIfD: l.pCtrlIfD,
          pCtrlIfR: l.pCtrlIfR,
          call: callEstimate(l.mean, st.pace),
          chamber: meta.office === 'senate' ? 'Senate' : meta.office === 'governor' ? 'Governor' : 'House',
        };
      })
      .filter((r) => !!r.meta);
  }, [result, modelById, config]);
}

export const nameOf = (id: string) => RACE_BY_ID[id]?.title ?? id;
export { ALL_RACES, HOUSE_INDEX };
