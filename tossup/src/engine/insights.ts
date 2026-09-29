import { RACE_BY_ID } from '../state/data';
import type { RaceModel } from './model';
import type { SimResult } from './sim';

export interface Leverage {
  id: string;
  office: 'senate' | 'governor' | 'house';
  pD: number;
  /** Expected absolute change in the chamber's control probability when this race is decided. */
  swing: number;
  pCtrlIfD: number;
  pCtrlIfR: number;
  tipping: number;
  mean: number;
}

/** Rank races by how much deciding them moves the odds of chamber control. */
export function leverage(result: SimResult): Leverage[] {
  const tipIndex: Record<string, number> = {};
  const chambers = { senate: result.senate, governor: result.governor, house: result.house };
  // Tipping arrays align with the order races appear per office in `ids`.
  for (const off of ['senate', 'governor', 'house'] as const) {
    let k = 0;
    result.ids.forEach((id) => {
      if (RACE_BY_ID[id]?.office === off) tipIndex[id] = chambers[off].tipping[k++] ?? 0;
    });
  }
  const out: Leverage[] = [];
  for (const r of result.races) {
    const meta = RACE_BY_ID[r.id];
    if (!meta) continue;
    const pR = 1 - r.pD;
    const d = Number.isFinite(r.pCtrlIfD) && Number.isFinite(r.pCtrlIfR) ? Math.abs(r.pCtrlIfD - r.pCtrlIfR) : 0;
    out.push({
      id: r.id,
      office: meta.office,
      pD: r.pD,
      swing: 2 * r.pD * pR * d,
      pCtrlIfD: r.pCtrlIfD,
      pCtrlIfR: r.pCtrlIfR,
      tipping: tipIndex[r.id] ?? 0,
      mean: r.mean,
    });
  }
  return out.sort((a, b) => b.swing - a.swing);
}

/** Signal-to-noise of a race as a read on the national mood: high elasticity and low own noise. */
export function bellwetherScore(m: RaceModel, sigmaNat: number): number {
  const shared = (m.elasticity * sigmaNat) ** 2;
  return shared / (shared + m.sd ** 2);
}

export function phraseFor(p: number, thing: string): string {
  if (p >= 0.9) return `Democrats are heavy favorites to win ${thing}`;
  if (p >= 0.68) return `Democrats are favored to win ${thing}`;
  if (p >= 0.56) return `Democrats have a slight edge for ${thing}`;
  if (p > 0.44) return `${thing[0].toUpperCase()}${thing.slice(1)} is a true toss-up`;
  if (p > 0.32) return `Republicans have a slight edge for ${thing}`;
  if (p > 0.1) return `Republicans are favored to win ${thing}`;
  return `Republicans are heavy favorites to win ${thing}`;
}
