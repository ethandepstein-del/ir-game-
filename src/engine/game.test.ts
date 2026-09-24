import { describe, expect, it } from 'vitest';
import { SCENARIOS, getScenario } from '../data/scenarios';
import { act, adjustToward, aspiration, newGame, previewDeal, reservation, resolveEvent, result } from './game';
import { maxYouGivenThem, paretoFrontier, theirValue, yourValue } from './math';
import type { Action, GameState } from './types';

function play(s: GameState, a: Action): GameState {
  let next = act(s, a);
  while (next.pendingEvent) next = resolveEvent(next, 0);
  return next;
}

describe('utilities', () => {
  it('scores your ideal as 1 and theirs as 0', () => {
    expect(yourValue([0.5, 0.5], [100, 100])).toBeCloseTo(1);
    expect(theirValue([0.5, 0.5], [100, 100])).toBeCloseTo(0);
  });

  it('builds a monotone Pareto frontier', () => {
    const f = paretoFrontier([0.6, 0.4], [0.2, 0.8]);
    for (let k = 1; k < f.length; k++) {
      expect(f[k].you).toBeGreaterThanOrEqual(f[k - 1].you);
      expect(f[k].them).toBeLessThanOrEqual(f[k - 1].them);
    }
    // Giving you issue 0 (you value it 3x more) costs them only 0.2.
    expect(maxYouGivenThem(f, 0.8)).toBeCloseTo(0.6);
  });
});

describe('game engine', () => {
  it('is deterministic for a seed', () => {
    const a = newGame('veyra', 42);
    const b = newGame('veyra', 42);
    expect(a.opp).toEqual(b.opp);
    expect(play(a, { kind: 'mobilize' })).toEqual(play(b, { kind: 'mobilize' }));
  });

  it('opens with a standing offer that meets their aspiration', () => {
    for (const sc of SCENARIOS) {
      const s = newGame(sc.id, 7);
      expect(theirValue(s.opp.weights, s.opp.standingOffer)).toBeGreaterThanOrEqual(aspiration(s, sc) - 0.02);
    }
  });

  it('adjustToward hits its target from either side', () => {
    const s = newGame('tariff', 3);
    const up = adjustToward(s, [100, 100, 100, 100], 0.6);
    expect(theirValue(s.opp.weights, up)).toBeGreaterThanOrEqual(0.6);
    const down = adjustToward(s, [0, 0, 0, 0], 0.5);
    expect(theirValue(s.opp.weights, down)).toBeGreaterThanOrEqual(0.5);
    expect(theirValue(s.opp.weights, down)).toBeLessThan(0.52);
  });

  it('accepts a generous offer and ratifies when it clears the threshold', () => {
    const s = newGame('veyra', 11);
    const sc = getScenario('veyra');
    const x = adjustToward(s, [100, 100, 100, 100], aspiration(s, sc) + 0.01);
    const out = play(s, { kind: 'propose', values: x });
    const pre = previewDeal(s, x);
    expect(out.status === 'deal').toBe(pre.passes);
  });

  it('refuses to sign arms deals without trust (commitment problem)', () => {
    const s = newGame('kessel', 5);
    const out = act(s, { kind: 'propose', values: [0, 0, 0, 0] });
    expect(out.status).toBe('playing');
    expect(out.concepts).toContain('commitment-problem');
  });

  it('red lines cause ratification failure when crossed', () => {
    let s = newGame('veyra', 9);
    s = play(s, { kind: 'tieHands', issue: 0, min: 80 });
    const pre = previewDeal(s, [10, 50, 50, 50]);
    expect(pre.brokenRedLines).toEqual([0]);
    expect(pre.passes).toBe(false);
  });

  it('mobilization lowers an opportunist\'s reservation but raises an insecure one\'s', () => {
    const findType = (t: string) => {
      for (let seed = 1; seed < 500; seed++) {
        const g = newGame('veyra', seed);
        if (g.opp.type === t) return g;
      }
      throw new Error('no seed');
    };
    const sc = getScenario('veyra');
    const opp = findType('opportunist');
    expect(reservation(act(opp, { kind: 'mobilize' }), sc)).toBeLessThan(reservation(opp, sc));
    const ins = findType('insecure');
    expect(reservation(act(ins, { kind: 'mobilize' }), sc)).toBeGreaterThan(reservation(ins, sc));
  });

  it('every game terminates and scores within 0–100', () => {
    const kinds: Action['kind'][] = ['propose', 'mobilize', 'warning', 'goodwill', 'backchannel', 'mediator'];
    for (const sc of SCENARIOS) {
      for (let seed = 1; seed <= 40; seed++) {
        let s = newGame(sc.id, seed);
        let guard = 0;
        while (s.status === 'playing' && guard++ < 50) {
          const k = kinds[(seed + guard) % kinds.length];
          const a: Action = k === 'propose' ? { kind: 'propose', values: s.opp.standingOffer.map((v) => Math.min(100, v + 10)) } : ({ kind: k } as Action);
          const next = play(s, a);
          s = next === s ? play(s, { kind: 'warning' }) : next;
        }
        expect(s.status).not.toBe('playing');
        const r = result(s);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
      }
    }
  });
});
