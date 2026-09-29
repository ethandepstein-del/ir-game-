import { describe, expect, it } from 'vitest';
import polls from '../data/generated/polls.json';
import type { ApprovalPoll, Poll } from '../data/types';
import { aggregateApproval, aggregateGeneric, raceAverage } from './aggregate';

const ASOF = '2026-09-29';

describe('generic ballot aggregation', () => {
  const avg = aggregateGeneric(polls.generic as Poll[], ASOF);

  it('lands near published averages (D+7 to D+10)', () => {
    expect(avg.margin).toBeGreaterThan(6.5);
    expect(avg.margin).toBeLessThan(10.5);
  });

  it('has sensible uncertainty', () => {
    expect(avg.sd).toBeGreaterThan(0.4);
    expect(avg.sd).toBeLessThan(2.5);
  });

  it('house effects are centred', () => {
    const fx = Object.values(avg.fit.houseEffects);
    const tot = fx.reduce((a, f) => a + f.effect * f.n, 0) / fx.reduce((a, f) => a + f.n, 0);
    expect(Math.abs(tot)).toBeLessThan(1e-6);
  });

  it('influence sums to one', () => {
    const s = Object.values(avg.influence).reduce((a, b) => a + b, 0);
    expect(s).toBeCloseTo(1, 6);
  });

  it('shares add to about 90', () => {
    expect(avg.d + avg.r).toBeGreaterThan(80);
    expect(avg.d + avg.r).toBeLessThan(100);
  });
});

describe('approval aggregation', () => {
  const avg = aggregateApproval(polls.approval as ApprovalPoll[], ASOF);
  it('is deeply negative', () => {
    expect(avg.net).toBeLessThan(-15);
    expect(avg.net).toBeGreaterThan(-35);
    expect(avg.approve).toBeGreaterThan(30);
    expect(avg.approve).toBeLessThan(42);
  });
});

describe('race averages', () => {
  it('averages a simple case', () => {
    const rp = (polls.races as Record<string, Poll[]>)['senate-nc'];
    const a = raceAverage(rp, ASOF);
    expect(a.margin).toBeGreaterThan(6);
    expect(a.margin).toBeLessThan(15);
    expect(a.se).toBeGreaterThan(2.5);
  });
  it('ignores ancient polls', () => {
    const old: Poll = { id: 'x', race: 'r', pollster: 'Foo', start: '2025-01-01', end: '2025-01-02', pop: 'lv', d: 50, r: 40, margin: 10, source: 'x' };
    const a = raceAverage([old], ASOF);
    expect(a.nRecent).toBe(0);
  });
});
