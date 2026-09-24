import { describe, expect, it } from 'vitest';
import { TERRITORIES, T } from '../data/world';
import { aiStep } from './ai';
import { apply, attackDice, current, income, isOver, newGame, ownedBy } from './game';
import type { GameState } from './types';

export function autoplay(s: GameState, maxSteps = 20000): GameState {
  let steps = 0;
  while (!isOver(s) && steps++ < maxSteps) {
    if (s.offer) {
      s = apply(s, { kind: 'answerOffer', accept: true });
      continue;
    }
    const next = apply(s, aiStep(s));
    s = next === s ? apply(s, s.phase === 'attack' ? { kind: 'endAttack' } : { kind: 'endTurn' }) : next;
  }
  return s;
}

describe('map', () => {
  it('has symmetric adjacency and every territory connected', () => {
    for (const t of TERRITORIES) {
      expect(t.adj.length).toBeGreaterThan(0);
      for (const u of t.adj) expect(TERRITORIES[u].adj).toContain(t.index);
    }
    const seen = new Set([0]);
    const q = [0];
    while (q.length) for (const u of TERRITORIES[q.pop()!].adj) if (!seen.has(u)) (seen.add(u), q.push(u));
    expect(seen.size).toBe(TERRITORIES.length);
  });
});

describe('rules', () => {
  it('gives each great power three core territories and income', () => {
    const s = newGame('eu', 1);
    expect(ownedBy(s, 'usa')).toHaveLength(3);
    expect(income(s, 'usa').total).toBeGreaterThanOrEqual(3);
    expect(current(s)).toBe('usa');
  });

  it('limits amphibious attacks to 2 dice except for the US', () => {
    const s = newGame('eu', 2);
    s.territories[T('uk')] = { owner: 'eu', armies: 10 };
    s.territories[T('france')].armies = 10;
    expect(attackDice(s, T('france'), T('uk')).a).toBe(2);
    s.territories[T('us-east')].armies = 10;
    s.territories[T('uk')] = { owner: null, armies: 3 };
    expect(attackDice(s, T('us-east'), T('uk')).a).toBe(3);
  });

  it('ticks the Doomsday Clock when a homeland is struck', () => {
    let s = newGame('rus', 3);
    s = apply(s, { kind: 'deploy', t: T('us-east'), n: s.reinforcements });
    s.territories[T('kazakhstan')] = { owner: 'usa', armies: 20 };
    const before = s.clock;
    s = apply(s, { kind: 'attack', from: T('kazakhstan'), to: T('urals'), blitz: false });
    expect(s.clock).toBe(before - 1);
    expect(s.learned).toContain('mad');
  });

  it('breaking a pact costs reputation', () => {
    let s = newGame('usa', 4);
    s.pacts.push({ a: 'usa', b: 'eu', until: 9 });
    s.territories[T('uk')] = { owner: 'eu', armies: 1 };
    s = apply(s, { kind: 'deploy', t: T('us-east'), n: s.reinforcements });
    const rep = s.powers.usa.reputation;
    s = apply(s, { kind: 'attack', from: T('us-east'), to: T('uk'), blitz: true });
    expect(s.powers.usa.reputation).toBe(rep - 30);
    expect(s.pacts).toHaveLength(0);
  });
});

describe('full games', () => {
  it('AI-only games always terminate', () => {
    const outcomes: Record<string, number> = {};
    for (let seed = 1; seed <= 12; seed++) {
      const s = autoplay(newGame('usa', seed * 101));
      expect(isOver(s)).toBe(true);
      const key = `${s.endReason}:${s.winner ?? '-'}`;
      outcomes[key] = (outcomes[key] ?? 0) + 1;
    }
    console.log(outcomes);
  });
});
