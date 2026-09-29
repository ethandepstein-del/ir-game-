// Numbers other outlets published, as found on 2026-09-29. Shown next to ours for comparison,
// each with its source. These are quoted, not recomputed, and may have moved since.

export interface Published {
  who: string;
  value: number;
  /** ISO date the figure refers to. */
  date: string;
  note?: string;
  url: string;
}

export const GENERIC_PUBLISHED: Published[] = [
  { who: 'Silver Bulletin', value: 8.1, date: '2026-09-28', note: '9.2 with a likely-voter adjustment', url: 'https://www.natesilver.net/p/generic-ballot-average-2026-nate-silver-bulletin-congress-polls' },
  { who: 'RealClearPolling', value: 8.6, date: '2026-09-29', url: 'https://www.realclearpolling.com/polls/state-of-the-union/generic-congressional-vote' },
  { who: 'NBC News', value: 9, date: '2026-09-29', note: '52% to 43%, likely-voter scale', url: 'https://www.nbcnews.com/politics/2026-election/nbc-news-polling-averages-democrats-enjoy-biggest-lead-yet-race-congre-rcna599378' },
  { who: 'Decision Desk HQ', value: 8, date: '2026-09-28', note: '"about 8 points"', url: 'https://polls.decisiondeskhq.com/averages/generic-ballot/national/lv-rv-adults' },
  { who: 'Pollsmax', value: 7.8, date: '2026-09-29', note: '50.8% to 43.0%', url: 'https://www.pollsmax.com/approval/generic-ballot/' },
  { who: 'US Polling Data', value: 7.4, date: '2026-09-27', note: '49.3% to 41.9%', url: 'https://uspollingdata.com/polls/2026-midterm-tracker/' },
];

/** Silver Bulletin's published generic-ballot readings through the year, for the trend chart. */
export const GENERIC_HISTORY_POINTS: { who: string; value: number; date: string; url: string }[] = [
  { who: 'Silver Bulletin', value: 5.3, date: '2026-01-15', url: 'https://www.natesilver.net/p/generic-ballot-average-2026-nate-silver-bulletin-congress-polls' },
  { who: 'Silver Bulletin', value: 7.0, date: '2026-06-15', url: 'https://www.natesilver.net/p/generic-ballot-average-2026-nate-silver-bulletin-congress-polls' },
  { who: 'Silver Bulletin', value: 6.7, date: '2026-09-01', url: 'https://www.natesilver.net/p/generic-ballot-average-2026-nate-silver-bulletin-congress-polls' },
  { who: 'Silver Bulletin', value: 7.9, date: '2026-09-26', url: 'https://www.natesilver.net/p/generic-ballot-average-2026-nate-silver-bulletin-congress-polls' },
];

export const APPROVAL_PUBLISHED: { who: string; approve: number; net?: number; date: string; url: string }[] = [
  { who: 'Silver Bulletin', approve: 37.4, net: -22.4, date: '2026-09-28', url: 'https://www.natesilver.net/p/trump-approval-ratings-nate-silver-bulletin' },
  { who: 'FiftyPlusOne', approve: 35.1, net: -26.8, date: '2026-09-28', url: 'https://fiftyplusone.news/polls/approval/president' },
  { who: 'Economist', approve: 35.0, date: '2026-09-24', url: 'https://www.economist.com/interactive/trump-approval-tracker' },
  { who: 'New York Times', approve: 37.0, date: '2026-09-24', url: 'https://www.nytimes.com/interactive/polls/donald-trump-approval-rating-polls.html' },
  { who: 'Decision Desk HQ', approve: 37.2, date: '2026-09-23', url: 'https://polls.decisiondeskhq.com/' },
  { who: 'RealClearPolling', approve: 38.8, date: '2026-09-23', url: 'https://www.realclearpolling.com/polls/approval/donald-trump/approval-rating' },
];

export interface OutsideForecast {
  who: string;
  house?: string;
  senate?: string;
  date: string;
  note?: string;
  url: string;
}

export const OUTSIDE_FORECASTS: OutsideForecast[] = [
  { who: 'Decision Desk HQ', house: 'D 76% · 234 seats', senate: 'D 55% · 51 seats', date: '2026-09-29', url: 'https://votes.decisiondeskhq.com/forecast/2026' },
  { who: 'Cook Political Report', house: 'Dems favored; 5 to 15 seat gain', senate: '"True toss-up"', date: '2026-09-25', note: 'Ratings, not probabilities: D favored in 208 seats, R in 205, 22 toss-ups.', url: 'https://www.cookpolitical.com/analysis/house/house-overview/gop-track-lose-house-majority-15-race-ratings-shift-towards-dems' },
  { who: 'CBS News/YouGov model', house: 'D about 228 seats', date: '2026-09-11', url: 'https://www.cbsnews.com/news/poll-trump-battleground-tracker-house-control-2026-midterm-elections/' },
  { who: 'Silver Bulletin (FLIPR)', senate: 'D 56.8%', date: '2026-08-24', note: 'Latest figure found; the model updates daily.', url: 'https://www.natesilver.net/p/nate-silver-2026-midterm-election-polls-model' },
  { who: 'Kalshi (prediction market)', senate: 'D 63%', date: '2026-09-16', url: 'https://kalshi.com/markets/controls/senate-winner/controls-2026' },
  { who: 'Polymarket (prediction market)', senate: 'D 66%', date: '2026-09-23', url: 'https://www.cnbc.com/2026/09/16/prediction-markets-say-democrats-are-slightly-favored-to-win-senate.html' },
];

/** Context events for annotating charts. */
export const EVENTS: { date: string; label: string }[] = [
  { date: '2026-02-28', label: 'Iran war begins' },
];
