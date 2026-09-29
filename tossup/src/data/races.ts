// Senate and governor races for 2026. Researched from public reporting on 2026-09-29; each race links
// its sources through the polls it carries. Ratings appear only where a specific rater's rating was
// found; otherwise `estRating` is a stated judgment and the UI labels it as an estimate.

import type { Candidate, Party, RaceMeta, Rating, Ratings } from './types';

const c = (name: string, party: Party, o: Partial<Candidate> = {}): Candidate => ({ name, party, ...o });

interface Seed {
  st: string;
  holder: Party;
  open?: boolean;
  special?: boolean;
  D?: Candidate;
  R?: Candidate;
  I?: Candidate;
  others?: string[];
  ratings?: Ratings;
  est?: Rating;
  adj?: number;
  adjNote?: string;
  note?: string;
}

export type RaceRecord = RaceMeta;

function build(office: 'senate' | 'governor', prefix: string, title: (s: string) => string, seeds: Seed[]): RaceRecord[] {
  return seeds.map((s) => {
    const cited = s.ratings && Object.values(s.ratings).some(Boolean);
    return {
      id: `${prefix}-${s.st.toLowerCase()}`,
      office,
      state: s.st,
      title: title(s.st),
      special: s.special,
      open: Boolean(s.open),
      holder: s.holder,
      candidates: { D: s.D, R: s.R, I: s.I },
      others: s.others,
      ratings: s.ratings ?? {},
      ratingSource: cited ? 'cited' : 'inferred',
      estRating: s.est,
      adj: s.adj,
      adjNote: s.adjNote,
      note: s.note,
      tier: 'researched',
    };
  });
}

/* ------------------------------------------------------------------------------- Senate */

const SENATE: Seed[] = [
  { st: 'AL', holder: 'R', open: true, D: c('Everett Wess', 'D'), R: c('Barry Moore', 'R'), est: 'safe-r', note: 'Tommy Tuberville is running for governor.' },
  { st: 'AK', holder: 'R', D: c('Mary Peltola', 'D'), R: c('Dan Sullivan', 'R', { incumbent: true }), ratings: { cook: 'toss', inside: 'tilt-r' }, est: 'toss', note: 'Alaska uses ranked-choice voting in the general election; polls report first-round and final-round numbers.' },
  { st: 'AR', holder: 'R', D: c('Hallie Shoffner', 'D'), R: c('Tom Cotton', 'R', { incumbent: true }), est: 'likely-r', note: 'A Hendrix College poll showed the Democrat narrowly ahead.' },
  { st: 'CO', holder: 'D', D: c('John Hickenlooper', 'D', { incumbent: true }), R: c('Mark Baisley', 'R'), est: 'safe-d' },
  { st: 'DE', holder: 'D', D: c('Chris Coons', 'D', { incumbent: true }), R: c('Katz', 'R'), est: 'safe-d' },
  { st: 'FL', holder: 'R', special: true, D: c('Angie Nixon', 'D', { note: 'Upset Alex Vindman in the primary.' }), R: c('Ashley Moody', 'R', { incumbent: true, note: 'Appointed to Marco Rubio\'s seat.' }), est: 'likely-r', note: 'Special election for the remainder of the term.' },
  { st: 'GA', holder: 'D', D: c('Jon Ossoff', 'D', { incumbent: true }), R: c('Mike Collins', 'R', { note: 'Won the June runoff with Trump\'s endorsement.' }), ratings: { cook: 'likely-d' }, est: 'likely-d', note: 'Georgia requires 50% to win; a runoff would be held December 1.' },
  { st: 'ID', holder: 'R', R: c('Jim Risch', 'R', { incumbent: true }), I: c('Todd Achilles', 'I', { note: 'Former Democratic state representative running as an independent.' }), est: 'likely-r', note: 'One poll, from a firm with a limited track record, shows the independent ahead.' },
  { st: 'IL', holder: 'D', open: true, D: c('Juliana Stratton', 'D'), R: c('Don Tracy', 'R'), est: 'safe-d', note: 'Dick Durbin is retiring.' },
  { st: 'IA', holder: 'R', open: true, D: c('Josh Turek', 'D'), R: c('Ashley Hinson', 'R'), ratings: { cook: 'toss', sabato: 'toss' }, est: 'toss', note: 'Joni Ernst is retiring.' },
  { st: 'KS', holder: 'R', D: c('Adam Hamilton', 'D', { note: 'Megachurch pastor.' }), R: c('Roger Marshall', 'R', { incumbent: true }), ratings: { cook: 'lean-r', sabato: 'lean-r' }, est: 'lean-r' },
  { st: 'KY', holder: 'R', open: true, D: c('Charles Booker', 'D'), R: c('Andy Barr', 'R'), est: 'safe-r', note: 'Mitch McConnell is retiring.' },
  { st: 'LA', holder: 'R', open: true, D: c('Jamie Davis', 'D'), R: c('Julia Letlow', 'R', { note: 'Won the June runoff after Sen. Bill Cassidy lost the primary.' }), est: 'safe-r' },
  { st: 'ME', holder: 'R', D: c('Troy Jackson', 'D', { note: 'Chosen at a July convention after Graham Platner withdrew.' }), R: c('Susan Collins', 'R', { incumbent: true }), ratings: { cook: 'toss', inside: 'toss' }, est: 'toss', note: 'Collins has run well ahead of the top of the ticket in past elections.' },
  { st: 'MA', holder: 'D', D: c('Ed Markey', 'D', { incumbent: true }), est: 'safe-d' },
  { st: 'MI', holder: 'D', open: true, D: c('Abdul El-Sayed', 'D'), R: c('Mike Rogers', 'R'), ratings: { cook: 'toss', sabato: 'lean-d' }, est: 'lean-d', note: 'Gary Peters is retiring.' },
  { st: 'MN', holder: 'D', open: true, D: c('Peggy Flanagan', 'D'), R: c('Michele Tafoya', 'R'), est: 'lean-d', note: 'Tina Smith is retiring.' },
  { st: 'MS', holder: 'R', D: c('Scott Colom', 'D'), R: c('Cindy Hyde-Smith', 'R', { incumbent: true }), I: c('Ty Pinkins', 'I'), est: 'likely-r' },
  { st: 'MT', holder: 'R', open: true, D: c('Bodnar', 'D'), R: c('Kurt Alme', 'R'), est: 'safe-r', note: 'Steve Daines announced his retirement in March.' },
  { st: 'NE', holder: 'R', R: c('Pete Ricketts', 'R', { incumbent: true }), I: c('Dan Osborn', 'I', { note: 'Independent; has said he would not caucus with either party.' }), est: 'lean-r' },
  { st: 'NH', holder: 'D', open: true, D: c('Chris Pappas', 'D'), R: c('John Sununu', 'R'), ratings: { cook: 'toss', inside: 'toss' }, est: 'toss', note: 'Jeanne Shaheen is retiring.' },
  { st: 'NJ', holder: 'D', D: c('Cory Booker', 'D', { incumbent: true }), R: c('Justin Murphy', 'R'), est: 'safe-d' },
  { st: 'NM', holder: 'D', D: c('Ben Ray Luján', 'D', { incumbent: true }), R: c('Larry Marker', 'R', { note: 'Nominated as a write-in.' }), est: 'safe-d' },
  { st: 'NC', holder: 'R', open: true, D: c('Roy Cooper', 'D', { note: 'Former two-term governor.' }), R: c('Michael Whatley', 'R', { note: 'Former RNC chair.' }), est: 'lean-d', note: 'Thom Tillis is retiring.' },
  { st: 'OH', holder: 'R', special: true, D: c('Sherrod Brown', 'D'), R: c('Jon Husted', 'R', { incumbent: true, note: 'Appointed to JD Vance\'s seat.' }), ratings: { cook: 'toss', inside: 'toss' }, est: 'toss', note: 'Special election for the remainder of the term.' },
  { st: 'OK', holder: 'R', open: true, D: c('N\'Kiyla Jasmine Thomas', 'D'), R: c('Kevin Hern', 'R'), est: 'safe-r', note: 'Markwayne Mullin became DHS Secretary; Alan Armstrong was appointed and is not on the ballot.' },
  { st: 'OR', holder: 'D', D: c('Jeff Merkley', 'D', { incumbent: true }), est: 'safe-d' },
  { st: 'RI', holder: 'D', D: c('Jack Reed', 'D', { incumbent: true }), est: 'safe-d' },
  { st: 'SC', holder: 'R', D: c('Annie Andrews', 'D', { note: 'Pediatrician.' }), R: c('Darline Graham', 'R', { incumbent: true, note: 'Appointed after her brother, Sen. Lindsey Graham, died in July.' }), ratings: { cook: 'likely-r' }, est: 'likely-r' },
  { st: 'SD', holder: 'R', R: c('Mike Rounds', 'R', { incumbent: true }), I: c('Brian Bengs', 'I'), est: 'safe-r', note: 'The Democratic nominee withdrew in August.' },
  { st: 'TN', holder: 'R', D: c('Marquita Bradshaw', 'D'), R: c('Bill Hagerty', 'R', { incumbent: true }), est: 'safe-r' },
  { st: 'TX', holder: 'R', open: true, D: c('James Talarico', 'D'), R: c('Ken Paxton', 'R', { note: 'Beat Sen. John Cornyn in the May runoff.' }), others: ['Ted Brown (L)'], ratings: { cook: 'toss', sabato: 'toss' }, est: 'toss', note: 'Talarico has a large fundraising edge.' },
  { st: 'VA', holder: 'D', D: c('Mark Warner', 'D', { incumbent: true }), R: c('Bert Mizusawa', 'R'), est: 'safe-d' },
  { st: 'WV', holder: 'R', D: c('Rachel Fetty Anderson', 'D'), R: c('Shelley Moore Capito', 'R', { incumbent: true }), est: 'safe-r' },
  { st: 'WY', holder: 'R', open: true, D: c('James W. Byrd', 'D'), R: c('Harriet Hageman', 'R'), est: 'safe-r', note: 'Cynthia Lummis is retiring.' },
];

/* ---------------------------------------------------------------------------- Governors */

const GOVERNOR: Seed[] = [
  { st: 'AL', holder: 'R', open: true, D: c('Doug Jones', 'D', { note: 'Former U.S. senator.' }), R: c('Tommy Tuberville', 'R'), est: 'likely-r' },
  { st: 'AK', holder: 'R', open: true, D: c('Jonathan Kreiss-Tomkins', 'D'), R: c('Republican field', 'R', { note: 'Several Republicans split the vote under ranked-choice rules.' }), ratings: { cook: 'toss' }, est: 'toss' },
  { st: 'AZ', holder: 'D', D: c('Katie Hobbs', 'D', { incumbent: true }), R: c('Andy Biggs', 'R'), est: 'lean-d' },
  { st: 'AR', holder: 'R', D: c('Fredrick Love', 'D'), R: c('Sarah Huckabee Sanders', 'R', { incumbent: true }), est: 'safe-r' },
  { st: 'CA', holder: 'D', open: true, D: c('Xavier Becerra', 'D'), R: c('Steve Hilton', 'R'), est: 'safe-d' },
  { st: 'CO', holder: 'D', open: true, D: c('Phil Weiser', 'D'), R: c('Victor Marx', 'R'), est: 'safe-d' },
  { st: 'CT', holder: 'D', D: c('Ned Lamont', 'D', { incumbent: true }), R: c('Ryan Fazio', 'R'), est: 'likely-d' },
  { st: 'FL', holder: 'R', open: true, D: c('David Jolly', 'D'), R: c('Byron Donalds', 'R'), ratings: { sabato: 'lean-r' }, est: 'lean-r', note: 'Donalds has raised roughly $121 million to Jolly\'s $15 million.' },
  { st: 'GA', holder: 'R', open: true, D: c('Keisha Lance Bottoms', 'D'), R: c('Rick Jackson', 'R', { note: 'Won the GOP runoff over Burt Jones.' }), ratings: { inside: 'toss' }, est: 'toss' },
  { st: 'HI', holder: 'D', D: c('Josh Green', 'D', { incumbent: true }), R: c('Gary Cordery', 'R'), est: 'safe-d' },
  { st: 'ID', holder: 'R', D: c('Terri Pickens', 'D'), R: c('Brad Little', 'R', { incumbent: true }), est: 'safe-r' },
  { st: 'IL', holder: 'D', D: c('JB Pritzker', 'D', { incumbent: true }), R: c('Darren Bailey', 'R'), est: 'safe-d' },
  { st: 'IA', holder: 'R', open: true, D: c('Rob Sand', 'D', { note: 'State auditor.' }), R: c('Zach Lahn', 'R'), est: 'toss' },
  { st: 'KS', holder: 'D', open: true, D: c('Cindy Holscher', 'D'), R: c('Ty Masterson', 'R'), est: 'lean-r' },
  { st: 'ME', holder: 'D', open: true, D: c('Hannah Pingree', 'D'), R: c('Bobby Charles', 'R'), I: c('Rick Bennett', 'I'), est: 'likely-d' },
  { st: 'MD', holder: 'D', D: c('Wes Moore', 'D', { incumbent: true }), R: c('Dan Cox', 'R'), est: 'safe-d' },
  { st: 'MA', holder: 'D', D: c('Maura Healey', 'D', { incumbent: true }), R: c('Michael Minogue', 'R'), est: 'safe-d' },
  { st: 'MI', holder: 'D', open: true, D: c('Jocelyn Benson', 'D'), R: c('John James', 'R'), ratings: { inside: 'tilt-d' }, est: 'lean-d', note: 'Mike Duggan ended his independent bid in May.' },
  { st: 'MN', holder: 'D', open: true, D: c('Amy Klobuchar', 'D'), R: c('Lisa Demuth', 'R'), est: 'likely-d', note: 'Gov. Tim Walz withdrew in January.' },
  { st: 'NE', holder: 'R', D: c('Lynne Walz', 'D'), R: c('Jim Pillen', 'R', { incumbent: true }), est: 'safe-r' },
  { st: 'NV', holder: 'R', D: c('Aaron Ford', 'D'), R: c('Joe Lombardo', 'R', { incumbent: true }), ratings: { sabato: 'toss' }, est: 'toss' },
  { st: 'NH', holder: 'R', D: c('Cinde Warmington', 'D'), R: c('Kelly Ayotte', 'R', { incumbent: true }), est: 'lean-r', note: 'UNH found Ayotte up 10 in August, then a statistical tie in September.' },
  { st: 'NM', holder: 'D', open: true, D: c('Deb Haaland', 'D'), R: c('Gregg Hull', 'R'), est: 'likely-d' },
  { st: 'NY', holder: 'D', D: c('Kathy Hochul', 'D', { incumbent: true }), R: c('Bruce Blakeman', 'R'), est: 'safe-d' },
  { st: 'OH', holder: 'R', open: true, D: c('Amy Acton', 'D'), R: c('Vivek Ramaswamy', 'R'), ratings: { cook: 'toss', sabato: 'toss' }, est: 'toss' },
  { st: 'OK', holder: 'R', open: true, D: c('Cyndi Munson', 'D'), R: c('Mike Mazzei', 'R'), est: 'safe-r' },
  { st: 'OR', holder: 'D', D: c('Tina Kotek', 'D', { incumbent: true }), R: c('Christine Drazan', 'R'), est: 'likely-d' },
  { st: 'PA', holder: 'D', D: c('Josh Shapiro', 'D', { incumbent: true }), R: c('Stacy Garrity', 'R'), est: 'safe-d' },
  { st: 'RI', holder: 'D', open: true, D: c('Helena Foulkes', 'D', { note: 'Defeated Gov. Dan McKee in the September primary.' }), est: 'safe-d' },
  { st: 'SC', holder: 'R', open: true, D: c('Jermaine Johnson', 'D'), R: c('Alan Wilson', 'R'), est: 'safe-r' },
  { st: 'SD', holder: 'R', D: c('Dan Ahlers', 'D'), R: c('Larry Rhoden', 'R', { incumbent: true }), est: 'safe-r' },
  { st: 'TN', holder: 'R', open: true, D: c('Jerri Green', 'D'), R: c('Marsha Blackburn', 'R'), est: 'safe-r' },
  { st: 'TX', holder: 'R', D: c('Gina Hinojosa', 'D'), R: c('Greg Abbott', 'R', { incumbent: true }), ratings: { sabato: 'lean-r' }, est: 'lean-r' },
  { st: 'VT', holder: 'R', D: c('Amanda Janoo', 'D'), R: c('Phil Scott', 'R', { incumbent: true }), est: 'safe-r' },
  { st: 'WI', holder: 'D', open: true, D: c('David Crowley', 'D'), R: c('Tom Tiffany', 'R'), est: 'toss', note: 'Gov. Tony Evers is retiring.' },
  { st: 'WY', holder: 'R', open: true, D: c('Casner', 'D'), R: c('Eric Barlow', 'R'), est: 'safe-r' },
];

export const SENATE_RACES = build('senate', 'senate', (s) => `${s} Senate`, SENATE);
export const GOVERNOR_RACES = build('governor', 'gov', (s) => `${s} Governor`, GOVERNOR);

/** Seats not on the ballot in 2026 (independents caucus with the party shown). */
export const SENATE_NOT_UP = { D: 34, R: 31 } as const;
/** Governorships not on the ballot in 2026 (DE, KY, NJ, NC, VA, WA for Democrats; IN, LA, MS, MO, MT, ND, UT, WV for Republicans). */
export const GOVERNORS_NOT_UP = { D: 6, R: 8 } as const;

export const RACE_INDEX: Record<string, RaceRecord> = Object.fromEntries(
  [...SENATE_RACES, ...GOVERNOR_RACES].map((r) => [r.id, r]),
);
