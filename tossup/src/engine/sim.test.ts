import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, buildRaceModels, getEnvironment } from './model';
import { simulate } from './sim';

const cfg = { ...DEFAULT_CONFIG, nSims: 8000 };
const env = getEnvironment();
const models = buildRaceModels(cfg);
const base = simulate(models, cfg, env.blend);

describe('forecast model', () => {
  it('has a plausible national environment', () => {
    expect(env.blend).toBeGreaterThan(6);
    expect(env.blend).toBeLessThan(11);
  });

  it('chamber histograms sum to one', () => {
    for (const ch of [base.senate, base.house, base.governor]) {
      const s = ch.hist.reduce((a, b) => a + b, 0);
      expect(s).toBeCloseTo(1, 6);
    }
  });

  it('gives plausible control odds in this environment', () => {
    console.log('P(D House)', base.house.pControl.toFixed(3), 'mean', base.house.mean.toFixed(1));
    console.log('P(D Senate)', base.senate.pControl.toFixed(3), 'mean', base.senate.mean.toFixed(1));
    console.log('P(D Gov majority)', base.governor.pControl.toFixed(3), 'mean', base.governor.mean.toFixed(1));
    console.log('joint', base.joint, 'national', base.national);
    expect(base.house.pControl).toBeGreaterThan(0.6);
    expect(base.house.pControl).toBeLessThan(0.98);
    expect(base.senate.pControl).toBeGreaterThan(0.25);
    expect(base.senate.pControl).toBeLessThan(0.8);
  });

  it('joint probabilities add to one and match the marginals', () => {
    const j = base.joint;
    expect(j.dd + j.dr + j.rd + j.rr).toBeCloseTo(1, 6);
    expect(j.dd + j.dr).toBeCloseTo(base.house.pControl, 6);
    expect(j.dd + j.rd).toBeCloseTo(base.senate.pControl, 6);
  });

  it('tipping-point probabilities sum to one', () => {
    for (const ch of [base.senate, base.house, base.governor]) {
      expect(ch.tipping.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    }
  });

  it('a more Democratic environment raises Democratic odds', () => {
    const hot = simulate(buildRaceModels({ ...cfg, envOverride: env.blend + 4 }), cfg, env.blend + 4);
    const cold = simulate(buildRaceModels({ ...cfg, envOverride: env.blend - 4 }), cfg, env.blend - 4);
    expect(hot.senate.pControl).toBeGreaterThan(base.senate.pControl);
    expect(cold.senate.pControl).toBeLessThan(base.senate.pControl);
    expect(hot.house.pControl).toBeGreaterThan(cold.house.pControl);
  });

  it('forcing a race outcome moves that race to certainty and shifts chamber odds', () => {
    const tx = 'senate-tx';
    const forcedD = simulate(models, cfg, env.blend, { forced: { [tx]: 'D' } });
    const forcedR = simulate(models, cfg, env.blend, { forced: { [tx]: 'R' } });
    const pd = (r: typeof base) => r.races.find((x) => x.id === tx)!.pD;
    expect(pd(forcedD)).toBeCloseTo(1, 6);
    expect(pd(forcedR)).toBeCloseTo(0, 6);
    expect(forcedD.senate.pControl).toBeGreaterThan(forcedR.senate.pControl);
    expect(forcedD.ess).toBeGreaterThan(500);
  });

  it('observations pull a race toward the observed margin and update related races', () => {
    const obs = simulate(models, cfg, env.blend, { observed: { 'senate-nc': { y: -6, s: 2 } } });
    const before = base.races.find((x) => x.id === 'senate-nc')!;
    const after = obs.races.find((x) => x.id === 'senate-nc')!;
    expect(after.mean).toBeLessThan(before.mean);
    const ga0 = base.races.find((x) => x.id === 'senate-ga')!.pD;
    const ga1 = obs.races.find((x) => x.id === 'senate-ga')!.pD;
    expect(ga1).toBeLessThan(ga0);
  });

  it('is reproducible for a given seed', () => {
    const again = simulate(models, cfg, env.blend);
    expect(again.senate.pControl).toBe(base.senate.pControl);
  });
});
