import { describe, expect, it } from 'vitest';
import { ALL_RACES } from '../state/data';
import { DEFAULT_CONFIG, buildRaceModels, getEnvironment } from './model';
import { constraintsFrom, makeWorld, parseFeed, resultsAt, tally, clockLabel } from './night';
import { simulate } from './sim';

const cfg = { ...DEFAULT_CONFIG, nSims: 4000 };
const env = getEnvironment();
const models = buildRaceModels(cfg);
const indep = Object.fromEntries(models.map((m) => [m.id, m.indepD]));

describe('election night practice world', () => {
  const world = makeWorld(models, cfg, env.blend, 42);

  it('nothing reports before the first polls close', () => {
    expect(Object.keys(resultsAt(world, models, indep, -10)).length).toBe(0);
  });

  it('safe races are called shortly after their polls close, and correctly', () => {
    const r = resultsAt(world, models, indep, 240);
    const called = Object.entries(r).filter(([, x]) => x.called);
    expect(called.length).toBeGreaterThan(150);
    for (const [id, x] of called) {
      const truth = world.truth[id];
      expect(x.called === 'R' ? truth < 0 : truth > 0).toBe(true);
    }
  });

  it('by 4 am most, but not all, races are called; slow states lag', () => {
    const r = resultsAt(world, models, indep, 600);
    const n = Object.values(r).filter((x) => x.called).length;
    expect(n).toBeGreaterThan(models.length * 0.7);
    expect(n).toBeLessThan(models.length);
  });

  it('reporting is monotone', () => {
    let last = 0;
    const id = 'senate-pa' in world.truth ? 'senate-nc' : models[0].id;
    for (let t = 0; t <= 600; t += 30) {
      const f = resultsAt(world, models, indep, t)[id]?.reporting ?? 0;
      expect(f).toBeGreaterThanOrEqual(last - 1e-9);
      last = f;
    }
  });

  it('the needle converges toward the truth as calls arrive', () => {
    const truthSenateD = 34 + models.filter((m) => m.office === 'senate' && world.truth[m.id] > 0).length;
    const finalOutcomeD = truthSenateD >= 51;
    const late = simulate(models, cfg, env.blend, constraintsFrom(resultsAt(world, models, indep, 600), indep));
    const early = simulate(models, cfg, env.blend, constraintsFrom(resultsAt(world, models, indep, 120), indep));
    const err = (p: number) => Math.abs(p - (finalOutcomeD ? 1 : 0));
    console.log('senate truth D?', finalOutcomeD, 'early', early.senate.pControl.toFixed(2), 'late', late.senate.pControl.toFixed(2), 'ess', early.ess.toFixed(0), late.ess.toFixed(0));
    expect(err(late.senate.pControl)).toBeLessThanOrEqual(err(early.senate.pControl) + 0.15);
    expect(late.ess).toBeGreaterThan(50);
  });

  it('tallies count not-up seats', () => {
    const t = tally({}, ALL_RACES, 'senate');
    expect(t.D).toBe(34);
    expect(t.R).toBe(31);
    expect(t.pending).toBe(35);
  });

  it('formats the clock', () => {
    expect(clockLabel(0)).toBe('6:00 pm');
    expect(clockLabel(360)).toBe('12:00 am');
    expect(clockLabel(90)).toBe('7:30 pm');
  });
});

describe('feed parsing', () => {
  const known = new Set(['senate-nc', 'house-pa-07']);
  it('parses counts and percentages', () => {
    const p = parseFeed({ races: { 'senate-nc': { reporting: 40, d: 600, r: 400 }, 'house-pa-07': { reporting: 0.5, dPct: 48, rPct: 52, called: 'R' } } }, known);
    expect(p.problems.length).toBe(0);
    expect(p.results['senate-nc'].margin).toBeCloseTo(20, 5);
    expect(p.results['senate-nc'].reporting).toBeCloseTo(0.4, 5);
    expect(p.results['house-pa-07'].called).toBe('R');
  });
  it('reports unknown ids and bad shapes', () => {
    expect(parseFeed({ races: { nope: { reporting: 1 } } }, known).problems[0]).toMatch(/Unknown/);
    expect(parseFeed(null, known).problems.length).toBe(1);
    expect(parseFeed({}, known).problems[0]).toMatch(/races/);
  });
});
