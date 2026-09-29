// Midterm history used by the fundamentals model and the "How midterms usually go" chart.
// Approvals are approximate, rounded late-cycle averages of the sitting president's net approval
// (approve minus disapprove). House margins are the national popular vote, D minus R.
// Treat every number here as approximate (a point or two); the regression is a sanity anchor with
// only eight data points, and the model weights it accordingly.

export interface MidtermRow {
  year: number;
  president: string;
  party: 'D' | 'R';
  /** Net approval of the president, approximate. */
  net: number;
  /** House popular-vote margin, D minus R. */
  houseMargin: number;
  /** Net House seats gained by the party that does NOT hold the White House (negative = president's party gained). */
  outPartyGain: number;
}

export const MIDTERMS: MidtermRow[] = [
  { year: 1994, president: 'Clinton', party: 'D', net: -1, houseMargin: -6.8, outPartyGain: 54 },
  { year: 1998, president: 'Clinton', party: 'D', net: 35, houseMargin: -1.8, outPartyGain: -5 },
  { year: 2002, president: 'Bush', party: 'R', net: 38, houseMargin: -4.8, outPartyGain: -8 },
  { year: 2006, president: 'Bush', party: 'R', net: -22, houseMargin: 8.0, outPartyGain: 31 },
  { year: 2010, president: 'Obama', party: 'D', net: -3, houseMargin: -6.8, outPartyGain: 63 },
  { year: 2014, president: 'Obama', party: 'D', net: -9, houseMargin: -5.7, outPartyGain: 13 },
  { year: 2018, president: 'Trump', party: 'R', net: -10, houseMargin: 8.6, outPartyGain: 41 },
  { year: 2022, president: 'Biden', party: 'D', net: -13, houseMargin: -2.8, outPartyGain: 9 },
];

/** Out-party House margin (points) = intercept + slope * (minus net approval). Ordinary least squares. */
export function fitMidterms(rows = MIDTERMS): { intercept: number; slope: number; rmse: number } {
  const xs = rows.map((r) => -r.net);
  const ys = rows.map((r) => (r.party === 'D' ? -r.houseMargin : r.houseMargin));
  const n = rows.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  xs.forEach((x, i) => {
    sxy += (x - mx) * (ys[i] - my);
    sxx += (x - mx) ** 2;
  });
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const rss = xs.reduce((a, x, i) => a + (ys[i] - (intercept + slope * x)) ** 2, 0);
  return { intercept, slope, rmse: Math.sqrt(rss / (n - 2)) };
}
