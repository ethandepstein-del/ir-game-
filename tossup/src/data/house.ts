// The 435 House seats.
//
// Coverage is honest about its limits:
//  - `holder` is who holds the seat today (119th Congress delegations, with vacancies counted by party).
//  - Competitive seats carry ratings I could cite to a specific rater on a specific date.
//  - Other seats carry `estRating`, a stated judgment built from the holder and the 2026 maps.
//    Seats with no rating at all default to Safe for the holding party.
//  - Names are filled in only where reporting named the incumbent or nominee.
// If you have Cook PVI or a rater's full table, add it to OVERRIDES (or replace this file): the model
// reads whatever is here.

import { STATE_BY_CODE } from './states';
import type { Candidate, Party, RaceMeta, Rating, Ratings } from './types';

/** n districts, all `major`, with the listed district numbers held by `minor`. */
const mk = (n: number, major: Party, minor: Party, minorSeats: number[]): string =>
  Array.from({ length: n }, (_, i) => (minorSeats.includes(i + 1) ? minor : major)).join('');

/** Holders by district number (index = district - 1). */
export const HOLDERS: Record<string, string> = {
  AL: 'RDRRRRD',
  AK: 'R',
  AZ: 'RRDDRRDRR',
  AR: 'RRRR',
  CA: mk(52, 'D', 'R', [1, 3, 5, 20, 22, 23, 40, 41, 48]),
  CO: 'DDRRRDDR',
  CT: 'DDDDD',
  DE: 'D',
  FL: mk(28, 'R', 'D', [9, 10, 14, 20, 22, 23, 24, 25]),
  GA: 'RDRDDDRRRRRRDR',
  HI: 'DD',
  ID: 'RR',
  IL: 'DDDDDDDDDDDRDDRRD',
  IN: 'DRRRRRDRR',
  IA: 'RRRR',
  KS: 'RRDR',
  KY: 'RRDRRR',
  LA: 'RDRRRD',
  ME: 'DD',
  MD: 'RDDDDDDD',
  MA: 'DDDDDDDDD',
  MI: 'RRDRRDRDRRDDD',
  MN: 'RDDDDRRR',
  MS: 'RDRR',
  MO: 'DRRRDRRR',
  MT: 'RR',
  NE: 'RRR',
  NV: 'DRDD',
  NH: 'DD',
  NJ: 'DRDRDDRDDDDD',
  NM: 'DDD',
  NY: mk(26, 'D', 'R', [1, 2, 11, 17, 21, 23, 24]),
  NC: 'DDRDRRRRRRRDRR',
  ND: 'R',
  OH: 'DRDRRRRRDRDRDRR',
  OK: 'RRRRR',
  OR: 'DRDDDD',
  PA: 'RDDDDDRRRRRDRRRRD',
  RI: 'DD',
  SC: 'RRRRRDR',
  SD: 'R',
  TN: 'RRRRRRRRD',
  TX: mk(38, 'R', 'D', [7, 9, 16, 18, 20, 28, 29, 30, 32, 33, 34, 35, 37]),
  UT: 'RRRR',
  VT: 'D',
  VA: 'RRDDRRDDRDD',
  WA: 'DDDRRDDDDD',
  WV: 'RR',
  WI: 'RDRDRRRR',
  WY: 'R',
};

interface Spec {
  ratings?: Ratings;
  est?: Rating;
  D?: string;
  R?: string;
  I?: string;
  incD?: boolean;
  incR?: boolean;
  open?: boolean;
  note?: string;
  /** Approximate partisan lean relative to the nation, D positive, when reporting gave one. */
  lean?: number;
  leanNote?: string;
}

const inc = (name: string): Spec => ({ R: name, incR: true });

const OVERRIDES: Record<string, Spec> = {
  // ------ Cited to a specific rater (Cook 2026-09-25, Sabato 2026-09-29, or the dates noted)
  'AZ-01': { ratings: { cook: 'lean-d' }, D: 'Amish Shah', R: 'Jay Feely', open: true, note: 'Open seat; Rep. David Schweikert is running for governor.' },
  'AZ-06': { ratings: { cook: 'toss' }, ...inc('Juan Ciscomani'), D: 'JoAnna Mendoza', lean: -0.7, leanNote: 'Trump +0.7 in 2024' },
  'CA-22': { ratings: { cook: 'toss' }, ...inc('David Valadao'), lean: -2, leanNote: 'Trump +2 under the Prop 50 lines' },
  'CA-45': { ratings: { sabato: 'likely-d' }, D: 'Derek Tran', incD: true },
  'CO-05': { ratings: { cook: 'lean-r' }, ...inc('Jeff Crank') },
  'CO-08': { ratings: { cook: 'toss' }, ...inc('Gabe Evans'), lean: -1.8, leanNote: 'Trump +1.8 in 2024' },
  'FL-13': { ratings: { cook: 'lean-r' }, ...inc('Anna Paulina Luna') },
  'FL-22': { ratings: { cook: 'toss' }, D: 'Lois Frankel', incD: true, note: 'Redrawn by Florida\'s new map to lean Republican.' },
  'FL-27': { ratings: { cook: 'lean-r' }, ...inc('Maria Elvira Salazar') },
  'IA-01': { ratings: { cook: 'toss' }, ...inc('Mariannette Miller-Meeks') },
  'IA-03': { ratings: { cook: 'toss' }, ...inc('Zach Nunn'), D: 'Sarah Trone Garriott', lean: -4.4, leanNote: 'Trump +4.4 in 2024' },
  'KY-06': { ratings: { sabato: 'lean-r' }, open: true, note: 'Open seat; Rep. Andy Barr is running for Senate.' },
  'ME-02': { ratings: { sabato: 'lean-r' }, open: true, note: 'Open seat; Rep. Jared Golden is not running.' },
  'MI-07': { ratings: { cook: 'toss' }, ...inc('Tom Barrett'), D: 'Will Lawrence' },
  'MO-02': { ratings: { sabato: 'lean-r' }, ...inc('Ann Wagner'), note: 'Missouri\'s new map is on hold pending a referendum; the old map is in use.' },
  'MT-01': { ratings: { cook: 'lean-r', sabato: 'lean-r' }, open: true },
  'NE-02': { ratings: { cook: 'toss' }, open: true, note: 'Open seat; Rep. Don Bacon is retiring.' },
  'NV-02': { ratings: { cook: 'likely-r' }, ...inc('Mark Amodei') },
  'NJ-07': { ratings: { cook: 'lean-d' }, ...inc('Tom Kean Jr.') },
  'NY-17': { ratings: { cook: 'toss' }, ...inc('Mike Lawler'), lean: 0.6, leanNote: 'Harris +0.6 in 2024' },
  'NY-21': { ratings: { cook: 'likely-r' } },
  'NC-03': { ratings: { sabato: 'likely-r' }, ...inc('Greg Murphy') },
  'NC-11': { ratings: { cook: 'toss' }, ...inc('Chuck Edwards') },
  'OH-15': { ratings: { sabato: 'likely-r' }, ...inc('Mike Carey') },
  'PA-01': { ratings: { cook: 'likely-r' }, ...inc('Brian Fitzpatrick') },
  'PA-07': { ratings: { cook: 'toss', sabato: 'lean-d' }, ...inc('Ryan Mackenzie') },
  'PA-08': { ratings: { cook: 'toss' }, ...inc('Rob Bresnahan'), D: 'Paige Cognetti', lean: -8.5, leanNote: 'Trump +8.5 in 2024' },
  'PA-10': { ratings: { cook: 'toss' }, ...inc('Scott Perry') },
  'TX-09': { ratings: { cook: 'likely-r' }, note: 'Redrawn by Texas\'s new map to lean Republican.' },
  'TX-15': { ratings: { cook: 'toss' }, ...inc('Monica De La Cruz') },
  'TX-35': { ratings: { cook: 'lean-r' }, open: true, note: 'New San Antonio-area seat drawn to lean Republican.' },
  'VA-01': { ratings: { sabato: 'toss' }, ...inc('Rob Wittman') },
  'VA-02': { ratings: { cook: 'toss', sabato: 'lean-d' }, ...inc('Jen Kiggans'), D: 'Elaine Luria', lean: -0.3, leanNote: 'Trump +0.3 in 2024' },
  'VA-05': { ratings: { cook: 'likely-r', sabato: 'lean-r' }, ...inc('John McGuire') },
  'WI-01': { ratings: { cook: 'lean-r' }, ...inc('Bryan Steil'), D: 'Mitchell Berman' },
  'WI-03': { ratings: { cook: 'toss' }, ...inc('Derrick Van Orden'), lean: -7.4, leanNote: 'Trump +7.4 in 2024' },
  // ------ Stated judgments (no specific rating found); see notes
  'AL-02': { est: 'likely-r', note: 'Alabama moved to a 6-1 map after the Supreme Court narrowed the Voting Rights Act.' },
  'AK-01': { est: 'likely-r', ...inc('Nick Begich'), I: 'Bill Hill', note: 'Democrat-backed independent Bill Hill is the top challenger.' },
  'CA-01': { est: 'lean-d', note: 'Redrawn by Prop 50 to lean Democratic.' },
  'CA-03': { est: 'lean-d', note: 'Redrawn by Prop 50; Rep. Kevin Kiley now identifies as an independent.' },
  'CA-09': { est: 'likely-d' },
  'CA-13': { est: 'lean-d', D: 'Adam Gray', incD: true, note: 'Rated a toss-up by Cook in June; likely moved since.' },
  'CA-27': { est: 'likely-d' },
  'CA-40': { est: 'likely-r' },
  'CA-41': { est: 'lean-d', note: 'Redrawn by Prop 50 to lean Democratic.' },
  'CA-47': { est: 'likely-d' },
  'CA-48': { est: 'lean-d', note: 'Redrawn by Prop 50 to lean Democratic.' },
  'CO-03': { est: 'likely-r' },
  'CO-06': { est: 'likely-d' },
  'CT-05': { est: 'likely-d' },
  'FL-09': { est: 'lean-r', note: 'Redrawn by Florida\'s new map to lean Republican.' },
  'FL-14': { est: 'likely-r', note: 'Now Trump +11 (2024) under Florida\'s new map.' },
  'FL-23': { est: 'likely-d' },
  'GA-06': { est: 'likely-d' },
  'GA-07': { est: 'likely-r' },
  'IL-13': { est: 'likely-d' },
  'IL-17': { est: 'likely-d' },
  'IN-01': { est: 'likely-d' },
  'IA-02': { est: 'likely-r', open: true },
  'KS-03': { est: 'likely-d' },
  'LA-06': { est: 'safe-r', note: 'Louisiana eliminated its second Black-opportunity district after the Supreme Court\'s Callais ruling.' },
  'MD-06': { est: 'likely-d' },
  'MI-03': { est: 'likely-d' },
  'MI-04': { est: 'likely-r' },
  'MI-08': { est: 'likely-d' },
  'MI-10': { est: 'lean-r', open: true, note: 'Open seat; Rep. John James is running for governor.' },
  'MN-02': { est: 'likely-d', open: true },
  'MO-05': { est: 'likely-d', note: 'The redrawn map that targeted this seat is on hold; the old map is in use.' },
  'NV-01': { est: 'likely-d' },
  'NV-03': { est: 'likely-d' },
  'NV-04': { est: 'likely-d' },
  'NH-01': { est: 'likely-d', open: true },
  'NH-02': { est: 'likely-d' },
  'NJ-09': { est: 'likely-d' },
  'NM-02': { est: 'lean-d', note: 'Rated a toss-up by Cook in June; likely moved since.' },
  'NY-01': { est: 'likely-r' },
  'NY-03': { est: 'likely-d' },
  'NY-04': { est: 'lean-d', note: 'Rated a toss-up by Cook in June; likely moved since.' },
  'NY-11': { est: 'likely-r' },
  'NY-18': { est: 'likely-d' },
  'NY-19': { est: 'likely-d' },
  'NY-22': { est: 'likely-d' },
  'NC-01': { est: 'toss', D: 'Don Davis', incD: true, note: 'Redrawn by North Carolina\'s new map; now Trump +11 or 12 (2024).' },
  'NC-13': { est: 'likely-r' },
  'OH-01': { est: 'toss', D: 'Greg Landsman', incD: true, note: 'Redrawn by Ohio\'s new map to lean Republican.' },
  'OH-09': { est: 'toss', D: 'Marcy Kaptur', incD: true, note: 'Redrawn by Ohio\'s new map to lean Republican by up to 11.' },
  'OH-10': { est: 'likely-r' },
  'OH-13': { est: 'lean-d', D: 'Emilia Sykes', incD: true, note: 'Ohio\'s new map made this seat slightly more Democratic.' },
  'OR-05': { est: 'likely-d' },
  'OR-06': { est: 'likely-d' },
  'PA-17': { est: 'likely-d' },
  'TN-09': { est: 'likely-r', note: 'Tennessee split Memphis to draw a 9-0 Republican map after the Callais ruling.' },
  'TX-07': { est: 'likely-d' },
  'TX-23': { est: 'likely-r', note: 'Rep. Tony Gonzales faces a late-breaking scandal.' },
  'TX-28': { est: 'toss', note: 'Redrawn by Texas\'s new map to lean more Republican.' },
  'TX-32': { est: 'lean-r', note: 'Redrawn by Texas\'s new map to lean Republican.' },
  'TX-34': { est: 'toss', D: 'Vicente Gonzalez', incD: true, note: 'Rated a toss-up by Cook; redrawn to lean Republican.' },
  'UT-01': { est: 'safe-d', note: 'New court-ordered Salt Lake County seat; Harris would have won it by 24 points.' },
  'VA-07': { est: 'likely-d' },
  'WA-03': { est: 'lean-d', D: 'Marie Gluesenkamp Perez', incD: true, note: 'Rated a toss-up by Cook in June; likely moved since.' },
  'WA-08': { est: 'likely-d' },
};

const two = (n: number) => String(n).padStart(2, '0');

function candidate(name: string | undefined, party: Party, incumbent?: boolean): Candidate | undefined {
  return name ? { name, party, incumbent } : undefined;
}

export const HOUSE_SEATS: RaceMeta[] = [];
for (const [st, str] of Object.entries(HOLDERS)) {
  const holders = str.split('') as Party[];
  const info = STATE_BY_CODE[st];
  if (!info || holders.length !== info.house) throw new Error(`House holders for ${st}: ${holders.length} vs ${info?.house}`);
  holders.forEach((holder, i) => {
    const d = i + 1;
    const key = `${st}-${two(d)}`;
    const o = OVERRIDES[key] ?? {};
    const cited = o.ratings && Object.values(o.ratings).some(Boolean);
    const tier: RaceMeta['tier'] = cited ? 'researched' : o.est ? 'researched' : 'estimated';
    HOUSE_SEATS.push({
      id: `house-${st.toLowerCase()}-${two(d)}`,
      office: 'house',
      state: st,
      district: d,
      title: info.house === 1 ? `${info.name} at-large` : `${st}-${two(d)}`,
      open: Boolean(o.open),
      holder,
      candidates: { D: candidate(o.D, 'D', o.incD), R: candidate(o.R, 'R', o.incR), I: candidate(o.I, 'I') },
      ratings: o.ratings ?? {},
      ratingSource: cited ? 'cited' : 'inferred',
      estRating: o.est,
      note: o.note,
      lean: o.lean,
      leanNote: o.leanNote,
      tier,
    });
  });
}

export const HOUSE_INDEX: Record<string, RaceMeta> = Object.fromEntries(HOUSE_SEATS.map((r) => [r.id, r]));

/** House seats currently held (Kevin Kiley, CA-03, is counted as Republican-held: he was elected as one). */
export const HOUSE_HOLDERS = {
  D: HOUSE_SEATS.filter((s) => s.holder === 'D').length,
  R: HOUSE_SEATS.filter((s) => s.holder === 'R').length,
};
