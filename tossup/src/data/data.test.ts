import { describe, expect, it } from 'vitest';
import { HOUSE_HOLDERS, HOUSE_SEATS } from './house';
import { consensus, isTossupish, leansD, leansR } from './ratings';
import { GOVERNOR_RACES, SENATE_RACES } from './races';
import { STATES, TOTAL_HOUSE } from './states';

describe('reference data', () => {
  it('has 435 seats and matching apportionment', () => {
    expect(TOTAL_HOUSE).toBe(435);
    expect(HOUSE_SEATS.length).toBe(435);
  });
  it('current House holders are 215 D and 220 R', () => {
    expect(HOUSE_HOLDERS.D).toBe(215);
    expect(HOUSE_HOLDERS.R).toBe(220);
  });
  it('has 35 Senate and 36 governor races', () => {
    expect(SENATE_RACES.length).toBe(35);
    expect(GOVERNOR_RACES.length).toBe(36);
  });
  it('Senate seats up: 13 D-held, 22 R-held', () => {
    expect(SENATE_RACES.filter((r) => r.holder === 'D').length).toBe(13);
    expect(SENATE_RACES.filter((r) => r.holder === 'R').length).toBe(22);
  });
  it('has 50 states', () => expect(STATES.length).toBe(50));
  it('reports House consensus counts (for eyeballing against Cook: 208 D / 205 R / 22 toss-up)', () => {
    let d = 0, r = 0, t = 0;
    for (const s of HOUSE_SEATS) {
      const c = consensus(s).rating;
      if (c === 'toss') t++;
      else if (leansD(c)) d++;
      else if (leansR(c)) r++;
    }
    console.log('house consensus', { d, r, toss: t });
    expect(d + r + t).toBe(435);
    void isTossupish;
  });
});
