// Monte Carlo simulation of Election Day.
//
// Each sim draws shared shocks (national, regional, per-office), then each race's own error.
// Constraints from a scenario or from election night are folded in without discarding sims:
//   forced outcome   weight the sim by P(outcome | shared shocks), then draw the race's own error from
//                    the truncated normal that respects the outcome.
//   observed margin  weight by the normal likelihood of the observation given the shared shocks, then
//                    draw the race's own error from its exact Gaussian posterior.
// Both are exact for a normal model and keep the effective sample size healthy (it depends on the ~11
// shared factors, not on the number of races).

import { SENATE_NOT_UP, GOVERNORS_NOT_UP } from '../data/races';
import { gaussian, normCdf, normInv, quantile, rng } from './stats';
import { REGION_IDS, type ModelConfig, type RaceModel } from './model';

export interface Constraints {
  /** Race id -> called winner ('D' also covers a D-aligned independent). */
  forced?: Record<string, 'D' | 'R'>;
  /** Race id -> observed final-margin estimate with its standard deviation. */
  observed?: Record<string, { y: number; s: number }>;
}

export interface ChamberSummary {
  pControl: number;
  pTie: number;
  mean: number;
  median: number;
  p10: number;
  p90: number;
  /** Probability of each D seat count, index = seats. */
  hist: number[];
  /** Ids of the races in this chamber, aligned with `tipping`. */
  tipping: number[];
}

export interface RaceSim {
  id: string;
  pD: number;
  /** Weighted mean of the simulated final margin (D - R). */
  mean: number;
  sd: number;
  pCtrlIfD: number;
  pCtrlIfR: number;
}

export interface SimResult {
  n: number;
  ess: number;
  senate: ChamberSummary;
  house: ChamberSummary;
  governor: ChamberSummary;
  ids: string[];
  races: RaceSim[];
  /** Joint chamber control: House D / R by Senate D / R. */
  joint: { dd: number; dr: number; rd: number; rr: number };
  national: { mean: number; sd: number; pDwins: number };
  scatter: { nat: number; sen: number; house: number; w: number }[];
  senateNeeded: number;
  houseNeeded: number;
  governorNeeded: number;
}

export const SENATE_NEEDED = 51;
export const HOUSE_NEEDED = 218;
export const GOVERNOR_NEEDED = 26;

export function simulate(models: RaceModel[], config: ModelConfig, envMean: number, c: Constraints = {}): SimResult {
  const N = config.nSims;
  const R = models.length;
  const u = rng(config.seed);
  const z = gaussian(u);

  const mu = new Float64Array(R);
  const sd = new Float64Array(R);
  const el = new Float64Array(R);
  const reg = new Int8Array(R);
  const off = new Int8Array(R);
  const kind = new Int8Array(R); // 0 none, 1 forced D, 2 forced R, 3 observed
  const oy = new Float64Array(R);
  const os = new Float64Array(R);
  const indep = new Uint8Array(R);
  const idxOf: Record<string, number> = {};
  const sen: number[] = [];
  const gov: number[] = [];
  const hou: number[] = [];

  models.forEach((m, i) => {
    idxOf[m.id] = i;
    mu[i] = m.mean;
    sd[i] = m.sd;
    el[i] = m.elasticity;
    reg[i] = REGION_IDS.indexOf(m.region);
    off[i] = m.office === 'senate' ? 0 : m.office === 'governor' ? 1 : 2;
    indep[i] = m.indepD ? 1 : 0;
    (m.office === 'senate' ? sen : m.office === 'governor' ? gov : hou).push(i);
  });
  for (const [id, w] of Object.entries(c.forced ?? {})) {
    const i = idxOf[id];
    if (i !== undefined) kind[i] = w === 'D' ? 1 : 2;
  }
  for (const [id, o] of Object.entries(c.observed ?? {})) {
    const i = idxOf[id];
    if (i !== undefined && kind[i] === 0) {
      kind[i] = 3;
      oy[i] = o.y;
      os[i] = Math.max(o.s, 0.05);
    }
  }
  // Races whose outcome can't be in doubt skip their own random draw.
  const certain = new Uint8Array(R);
  for (let i = 0; i < R; i++) {
    const shared = Math.sqrt((el[i] * config.sigmaNat) ** 2 + config.sigmaRegion ** 2 + config.sigmaOffice ** 2 + sd[i] ** 2);
    if (kind[i] === 0 && Math.abs(mu[i]) > 6.5 * shared) certain[i] = 1;
  }

  const nSen = sen.length;
  const nGov = gov.length;
  const nHou = hou.length;
  const histSen = new Float64Array(101);
  const histHou = new Float64Array(436);
  const histGov = new Float64Array(51);
  const tipSen = new Float64Array(nSen);
  const tipGov = new Float64Array(nGov);
  const tipHou = new Float64Array(nHou);
  const sumD = new Float64Array(R);
  const sumDCtrl = new Float64Array(R);
  const sumM = new Float64Array(R);
  const sumM2 = new Float64Array(R);
  let W = 0;
  let W2 = 0;
  let ctrlSen = 0;
  let ctrlHou = 0;
  let ctrlGov = 0;
  let tieGov = 0;
  let tieSen = 0;
  let tieHou = 0;
  const joint = { dd: 0, dr: 0, rd: 0, rr: 0 };
  let sumNat = 0;
  let sumNat2 = 0;
  let pWins = 0;
  const scatter: SimResult['scatter'] = [];
  const scatterEvery = Math.max(1, Math.floor(N / 1600));

  const margin = new Float64Array(R);
  const winD = new Uint8Array(R);
  const regionShock = new Float64Array(REGION_IDS.length);
  const officeShock = new Float64Array(3);
  const keysSen = new Float64Array(nSen);
  const keysGov = new Float64Array(nGov);
  const keysHou = new Float64Array(nHou);
  const KEY_BASE = 1024;

  for (let s = 0; s < N; s++) {
    const nat = z() * config.sigmaNat;
    for (let k = 0; k < regionShock.length; k++) regionShock[k] = z() * config.sigmaRegion;
    for (let k = 0; k < 3; k++) officeShock[k] = z() * config.sigmaOffice;
    let w = 1;
    for (let i = 0; i < R; i++) {
      const a = mu[i] + el[i] * nat + regionShock[reg[i]] + officeShock[off[i]];
      const kd = kind[i];
      if (certain[i]) {
        margin[i] = a;
      } else if (kd === 0) {
        margin[i] = a + sd[i] * z();
      } else if (kd === 1 || kd === 2) {
        const p0 = normCdf(-a / sd[i]); // P(D loses | shared)
        let e: number;
        if (kd === 1) {
          w *= 1 - p0;
          const uu = p0 + u() * (1 - p0);
          e = sd[i] * normInv(Math.min(Math.max(uu, 1e-12), 1 - 1e-12));
        } else {
          w *= p0;
          const uu = u() * p0;
          e = sd[i] * normInv(Math.min(Math.max(uu, 1e-12), 1 - 1e-12));
        }
        margin[i] = a + e;
        // Numeric guard: keep the forced side.
        if (kd === 1 && margin[i] <= 0) margin[i] = 1e-6;
        if (kd === 2 && margin[i] >= 0) margin[i] = -1e-6;
      } else {
        const v = sd[i] ** 2 + os[i] ** 2;
        const d = oy[i] - a;
        w *= Math.exp((-d * d) / (2 * v)) / Math.sqrt(v);
        const k = sd[i] ** 2 / v;
        margin[i] = a + k * d + Math.sqrt((sd[i] ** 2 * os[i] ** 2) / v) * z();
      }
      winD[i] = margin[i] > 0 ? 1 : 0;
    }
    if (!(w > 0)) continue;

    // ---- chamber counts
    let senD: number = SENATE_NOT_UP.D;
    for (let k = 0; k < nSen; k++) {
      const i = sen[k];
      if (winD[i]) {
        if (!indep[i] || config.indCaucusD) senD++;
      }
      keysSen[k] = Math.round((margin[i] + 200) * 1000) * KEY_BASE + k;
    }
    let govD: number = GOVERNORS_NOT_UP.D;
    for (let k = 0; k < nGov; k++) {
      const i = gov[k];
      if (winD[i]) govD++;
      keysGov[k] = Math.round((margin[i] + 200) * 1000) * KEY_BASE + k;
    }
    let houD = 0;
    for (let k = 0; k < nHou; k++) {
      const i = hou[k];
      if (winD[i]) houD++;
      keysHou[k] = Math.round((margin[i] + 200) * 1000) * KEY_BASE + k;
    }
    const cS = senD >= SENATE_NEEDED;
    const cH = houD >= HOUSE_NEEDED;
    const cG = govD >= GOVERNOR_NEEDED;

    W += w;
    W2 += w * w;
    histSen[senD] += w;
    histHou[houD] += w;
    histGov[govD] += w;
    if (cS) ctrlSen += w;
    if (senD === 50) tieSen += w;
    if (cH) ctrlHou += w;
    if (houD === 217) tieHou += w;
    if (cG) ctrlGov += w;
    if (govD === 25) tieGov += w;
    if (cH) (cS ? (joint.dd += w) : (joint.dr += w));
    else cS ? (joint.rd += w) : (joint.rr += w);
    const nm = envMean + nat;
    sumNat += w * nm;
    sumNat2 += w * nm * nm;
    if (nm > 0) pWins += w;

    // ---- tipping points: sort ascending; the tipping race is the one that delivers the majority seat.
    keysSen.sort();
    keysGov.sort();
    keysHou.sort();
    const needS = SENATE_NEEDED - SENATE_NOT_UP.D; // 17 of 35
    tipSen[keysSen[nSen - needS] % KEY_BASE] += w;
    const needG = GOVERNOR_NEEDED - GOVERNORS_NOT_UP.D; // 20 of 36
    tipGov[keysGov[nGov - needG] % KEY_BASE] += w;
    tipHou[keysHou[nHou - HOUSE_NEEDED] % KEY_BASE] += w;

    for (let i = 0; i < R; i++) {
      const m = margin[i];
      sumM[i] += w * m;
      sumM2[i] += w * m * m;
      if (winD[i]) {
        sumD[i] += w;
        const o = off[i];
        if (o === 0 ? cS : o === 1 ? cG : cH) sumDCtrl[i] += w;
      }
    }
    if (s % scatterEvery === 0) scatter.push({ nat: nm, sen: senD, house: houD, w });
  }

  const totalCtrl = { s: ctrlSen, h: ctrlHou, g: ctrlGov };
  const races: RaceSim[] = models.map((m, i) => {
    const o = off[i];
    const tc = o === 0 ? totalCtrl.s : o === 1 ? totalCtrl.g : totalCtrl.h;
    const pd = sumD[i] / W;
    const mean = sumM[i] / W;
    const variance = Math.max(sumM2[i] / W - mean * mean, 0);
    const dCtrl = sumD[i] > 0 ? sumDCtrl[i] / sumD[i] : NaN;
    const rW = W - sumD[i];
    const rCtrl = rW > 1e-9 ? (tc - sumDCtrl[i]) / rW : NaN;
    return { id: m.id, pD: pd, mean, sd: Math.sqrt(variance), pCtrlIfD: dCtrl, pCtrlIfR: rCtrl };
  });

  const summarize = (hist: Float64Array, ctrl: number, tie: number, tip: Float64Array): ChamberSummary => {
    const h = Array.from(hist, (x) => x / W);
    let mean = 0;
    h.forEach((p, k) => (mean += p * k));
    const cdf = (q: number) => {
      let acc = 0;
      for (let k = 0; k < h.length; k++) {
        acc += h[k];
        if (acc >= q) return k;
      }
      return h.length - 1;
    };
    void quantile;
    return {
      pControl: ctrl / W,
      pTie: tie / W,
      mean,
      median: cdf(0.5),
      p10: cdf(0.1),
      p90: cdf(0.9),
      hist: h,
      tipping: Array.from(tip, (x) => x / W),
    };
  };

  return {
    n: N,
    ess: (W * W) / W2,
    senate: summarize(histSen, ctrlSen, tieSen, tipSen),
    house: summarize(histHou, ctrlHou, tieHou, tipHou),
    governor: summarize(histGov, ctrlGov, tieGov, tipGov),
    ids: models.map((m) => m.id),
    races,
    joint: { dd: joint.dd / W, dr: joint.dr / W, rd: joint.rd / W, rr: joint.rr / W },
    national: {
      mean: sumNat / W,
      sd: Math.sqrt(Math.max(sumNat2 / W - (sumNat / W) ** 2, 0)),
      pDwins: pWins / W,
    },
    scatter,
    senateNeeded: SENATE_NEEDED,
    houseNeeded: HOUSE_NEEDED,
    governorNeeded: GOVERNOR_NEEDED,
  };
}
