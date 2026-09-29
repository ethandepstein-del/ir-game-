import type { RegionId, StateInfo } from './types';

// Presidential margins (D minus R, points) are rounded to 0.1 from certified state totals.
// Poll-close times are 2026 Election Day (Nov 3, after daylight time ends), Eastern hours in 24h decimal.
// Counting pace is a historical tendency from 2020-2024 patterns, not a promise for this year.

type Row = [
  code: string,
  name: string,
  region: RegionId,
  pres2020: number,
  pres2024: number,
  house: number,
  close: number,
  closeLast: number | undefined,
  pace: StateInfo['pace'],
  paceNote?: string,
  closeNote?: string,
];

const ROWS: Row[] = [
  ['AL', 'Alabama', 'SE', -25.4, -30.5, 7, 20, undefined, 'fast'],
  ['AK', 'Alaska', 'PC', -10.1, -13.1, 1, 24, 25, 'slow', 'Ranked-choice tabulation and late absentee counting can take days.', 'Most of the state closes at midnight ET; the Aleutians at 1 am ET.'],
  ['AZ', 'Arizona', 'SW', 0.3, -5.5, 9, 21, undefined, 'slow', 'Late-arriving early ballots have made Maricopa County slow to finish.'],
  ['AR', 'Arkansas', 'SE', -27.6, -30.6, 4, 20.5, undefined, 'fast'],
  ['CA', 'California', 'PC', 29.2, 20.2, 52, 23, undefined, 'slow', 'Mail ballots keep coming in for weeks; early returns lean red, later counts lean blue.'],
  ['CO', 'Colorado', 'MT', 13.5, 11.0, 8, 21, undefined, 'medium'],
  ['CT', 'Connecticut', 'NE', 20.1, 14.4, 5, 20, undefined, 'fast'],
  ['DE', 'Delaware', 'NE', 19.0, 14.6, 1, 20, undefined, 'fast'],
  ['FL', 'Florida', 'SE', -3.3, -13.1, 28, 19, 20, 'fast', 'Counts most mail ballots before Election Day and reports quickly.', 'Most of the state closes at 7 pm ET; the Panhandle at 8 pm ET.'],
  ['GA', 'Georgia', 'SE', 0.2, -2.2, 14, 19, undefined, 'fast', 'Large early-vote dump right after polls close, then Election Day votes.'],
  ['HI', 'Hawaii', 'PC', 29.5, 25.5, 2, 24, undefined, 'medium'],
  ['ID', 'Idaho', 'MT', -30.7, -36.7, 2, 22, 23, 'fast', undefined, 'Southern Idaho closes at 10 pm ET; the northern Panhandle at 11 pm ET.'],
  ['IL', 'Illinois', 'GL', 17.0, 10.9, 17, 20, undefined, 'fast'],
  ['IN', 'Indiana', 'GL', -16.0, -18.6, 9, 18, 19, 'fast', undefined, 'Eastern-time counties close at 6 pm ET; central-time counties at 7 pm ET.'],
  ['IA', 'Iowa', 'GL', -8.2, -13.2, 4, 22, undefined, 'fast'],
  ['KS', 'Kansas', 'GP', -14.6, -16.2, 4, 20, 21, 'fast', undefined, 'Most of the state closes at 8 pm ET; a few western counties at 9 pm ET.'],
  ['KY', 'Kentucky', 'SE', -25.9, -30.5, 6, 18, 19, 'fast', undefined, 'Eastern-time counties close at 6 pm ET; central-time counties at 7 pm ET.'],
  ['LA', 'Louisiana', 'SE', -18.6, -22.0, 6, 21, undefined, 'medium'],
  ['ME', 'Maine', 'NE', 9.1, 7.1, 2, 20, undefined, 'medium', 'Ranked-choice tabulation can add days in close races.'],
  ['MD', 'Maryland', 'NE', 33.2, 28.5, 8, 20, undefined, 'slow', 'Mail ballots are counted over several days.'],
  ['MA', 'Massachusetts', 'NE', 33.5, 25.2, 9, 20, undefined, 'fast'],
  ['MI', 'Michigan', 'GL', 2.8, -1.4, 13, 20, 21, 'medium', 'Pre-processing of absentees helps; Detroit and big counties can run late.', 'Most of the state closes at 8 pm ET; a few Upper Peninsula counties at 9 pm ET.'],
  ['MN', 'Minnesota', 'GL', 7.1, 4.2, 8, 21, undefined, 'fast'],
  ['MS', 'Mississippi', 'SE', -16.5, -22.6, 4, 20, undefined, 'fast'],
  ['MO', 'Missouri', 'GP', -15.4, -18.4, 8, 20, undefined, 'fast'],
  ['MT', 'Montana', 'MT', -16.4, -20.4, 2, 22, undefined, 'medium'],
  ['NE', 'Nebraska', 'GP', -19.1, -20.0, 3, 21, undefined, 'fast', 'Omaha (NE-02) reports fast but the margin can swing late.'],
  ['NV', 'Nevada', 'MT', 2.4, -3.1, 4, 22, undefined, 'slow', 'Mail ballots arriving after Election Day mean close races can take days.'],
  ['NH', 'New Hampshire', 'NE', 7.4, 2.8, 2, 19, 20, 'fast', undefined, 'Most towns close at 7 pm ET; some at 8 pm ET.'],
  ['NJ', 'New Jersey', 'NE', 15.9, 5.9, 12, 20, undefined, 'medium'],
  ['NM', 'New Mexico', 'SW', 10.8, 6.0, 3, 21, undefined, 'medium'],
  ['NY', 'New York', 'NE', 23.2, 12.6, 26, 21, undefined, 'medium', 'Upstate counts fast; New York City and mail ballots come later.'],
  ['NC', 'North Carolina', 'SE', -1.3, -3.2, 14, 19.5, undefined, 'fast', 'Early vote posts within minutes of poll close.'],
  ['ND', 'North Dakota', 'GP', -33.4, -36.4, 1, 20, 21, 'fast', undefined, 'Central-time counties close at 8 pm ET; mountain-time counties at 9 pm ET.'],
  ['OH', 'Ohio', 'GL', -8.0, -11.2, 15, 19.5, undefined, 'fast', 'Early vote reports first; late absentees can trim the leader.'],
  ['OK', 'Oklahoma', 'SW', -33.1, -34.3, 5, 20, undefined, 'fast'],
  ['OR', 'Oregon', 'PC', 16.1, 14.3, 6, 23, undefined, 'slow', 'All-mail state; counts run for days.', 'Most of the state closes at 11 pm ET; a sliver of eastern Oregon at 10 pm ET.'],
  ['PA', 'Pennsylvania', 'NE', 1.2, -1.7, 17, 20, undefined, 'medium', 'Mail ballots are counted after polls close, so the lead can move overnight.'],
  ['RI', 'Rhode Island', 'NE', 20.8, 13.7, 2, 20, undefined, 'fast'],
  ['SC', 'South Carolina', 'SE', -11.7, -18.2, 7, 19, undefined, 'fast'],
  ['SD', 'South Dakota', 'GP', -26.2, -29.0, 1, 20, 21, 'fast', undefined, 'Central-time counties close at 8 pm ET; mountain-time counties at 9 pm ET.'],
  ['TN', 'Tennessee', 'SE', -23.2, -29.8, 9, 20, undefined, 'fast'],
  ['TX', 'Texas', 'SW', -5.6, -13.7, 38, 20, 21, 'fast', 'Big counties post early vote quickly; Election Day vote runs later.', 'Most of the state closes at 8 pm ET; El Paso area at 9 pm ET.'],
  ['UT', 'Utah', 'MT', -20.5, -21.6, 4, 22, undefined, 'medium', 'Mostly mail voting; ballots keep arriving for days.'],
  ['VT', 'Vermont', 'NE', 35.1, 31.9, 1, 19, undefined, 'fast'],
  ['VA', 'Virginia', 'SE', 10.1, 5.8, 11, 19, undefined, 'fast', 'Reports fast; early vote lands first.'],
  ['WA', 'Washington', 'PC', 19.2, 18.2, 10, 23, undefined, 'slow', 'All-mail state; counts run for days.'],
  ['WV', 'West Virginia', 'SE', -38.9, -42.1, 2, 19.5, undefined, 'fast'],
  ['WI', 'Wisconsin', 'GL', 0.6, -0.9, 8, 21, undefined, 'medium', 'Milwaukee central count arrives late in the night.'],
  ['WY', 'Wyoming', 'MT', -43.4, -46.1, 1, 21, undefined, 'fast'],
];

export const STATES: StateInfo[] = ROWS.map(
  ([code, name, region, pres2020, pres2024, house, close, closeLast, pace, paceNote, closeNote]) => ({
    code, name, region, pres2020, pres2024, house, close, closeLast, pace, paceNote, closeNote,
  }),
);

export const STATE_BY_CODE: Record<string, StateInfo> = Object.fromEntries(STATES.map((s) => [s.code, s]));

/** National presidential margins used as the partisan-lean baseline. */
export const NAT_PRES_2020 = 4.5;
export const NAT_PRES_2024 = -1.5;

/**
 * Partisan lean relative to the nation: blends 2024 (75%) and 2020 (25%) presidential margins,
 * each measured against that year's national margin. D positive.
 */
export function stateLean(code: string): number {
  const s = STATE_BY_CODE[code];
  if (!s) return 0;
  return 0.75 * (s.pres2024 - NAT_PRES_2024) + 0.25 * (s.pres2020 - NAT_PRES_2020);
}

export function stateName(code: string): string {
  return STATE_BY_CODE[code]?.name ?? code;
}

export const TOTAL_HOUSE = STATES.reduce((a, s) => a + s.house, 0);
