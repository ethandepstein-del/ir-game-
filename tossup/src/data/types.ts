// Shared types for Tossup. Margins are always D minus R, in percentage points.

export type Party = 'D' | 'R' | 'I';
export type Pop = 'lv' | 'rv' | 'a';
export type Office = 'senate' | 'governor' | 'house';

/** Expert-rating scale, ordered from most Democratic to most Republican. */
export type Rating =
  | 'safe-d'
  | 'likely-d'
  | 'lean-d'
  | 'tilt-d'
  | 'toss'
  | 'tilt-r'
  | 'lean-r'
  | 'likely-r'
  | 'safe-r';

export const RATINGS: Rating[] = [
  'safe-d', 'likely-d', 'lean-d', 'tilt-d', 'toss', 'tilt-r', 'lean-r', 'likely-r', 'safe-r',
];

/** Generic-ballot or head-to-head poll. */
export interface Poll {
  id: string;
  /** Race id ("senate-nc") or "generic". */
  race: string;
  pollster: string;
  start: string; // ISO date
  end: string; // ISO date
  n?: number;
  pop: Pop;
  d: number | null;
  r: number | null;
  o?: number | null;
  margin: number; // D - R
  /** Field dates are approximate (only a release date was found). */
  approx?: boolean;
  /** Sponsor of an internal poll. */
  internal?: 'D' | 'R';
  /** The D-side candidate is an independent (e.g. Osborn in NE). */
  indep?: 'D' | 'R';
  /** Toplines are two-party shares (no undecided), so the margin is inflated. */
  twoParty?: boolean;
  note?: string;
  source: string;
}

export interface ApprovalPoll {
  id: string;
  pollster: string;
  start: string;
  end: string;
  n?: number;
  pop?: Pop;
  approve: number;
  disapprove: number | null;
  approx?: boolean;
  note?: string;
  source: string;
}

export interface Candidate {
  name: string;
  party: Party;
  incumbent?: boolean;
  /** One-line context shown on the race page. */
  note?: string;
}

export interface Ratings {
  cook?: Rating;
  sabato?: Rating;
  inside?: Rating;
}

export type RatingSource = 'cited' | 'inferred';

export interface RaceMeta {
  id: string; // senate-nc, governor-az, house-tx-15
  office: Office;
  state: string; // USPS
  district?: number;
  title: string; // "North Carolina Senate"
  special?: boolean;
  /** No incumbent running. */
  open: boolean;
  /** Party currently holding the seat/office. */
  holder: Party;
  candidates: { D?: Candidate; R?: Candidate; I?: Candidate };
  /** Other notable candidates (libertarian etc.). */
  others?: string[];
  ratings: Ratings;
  ratingSource: RatingSource;
  /** Stated judgment used when no rater's rating was found. */
  estRating?: Rating;
  /** Manual fundamentals nudge in points (D positive) with a documented reason. */
  adj?: number;
  adjNote?: string;
  /** Free text context. */
  note?: string;
  /** Extra sources for context (URLs). */
  links?: string[];
  /** For House: estimated partisan lean relative to nation, D positive, if known. */
  lean?: number;
  leanNote?: string;
  /** Data tier: how well-researched this race is. */
  tier: 'researched' | 'estimated';
}

export interface StateInfo {
  code: string;
  name: string;
  region: RegionId;
  /** Presidential margins (D-R), 2020 and 2024. */
  pres2020: number;
  pres2024: number;
  house: number;
  /** Poll-close time in hours ET (24h, decimal). Last-closing time listed in `closeLast`. */
  close: number;
  closeLast?: number;
  closeNote?: string;
  /** Historic counting speed. */
  pace: 'fast' | 'medium' | 'slow';
  paceNote?: string;
}

export type RegionId = 'NE' | 'SE' | 'GL' | 'GP' | 'SW' | 'MT' | 'PC';

export const REGION_NAMES: Record<RegionId, string> = {
  NE: 'Northeast',
  SE: 'South',
  GL: 'Great Lakes',
  GP: 'Plains',
  SW: 'Southwest',
  MT: 'Mountain West',
  PC: 'Pacific',
};
