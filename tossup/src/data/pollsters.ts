// Pollster families, quality tiers and lean priors.
//
// These are judgment calls, not measurements. They exist so that a lone poll from a firm with a
// known partisan track record doesn't move an average as much as its topline suggests. The
// generic-ballot model re-estimates house effects from the data (the prior only shrinks them);
// race averages lean on the priors more because most firms poll a given race once.
// Everything here is shown to the user on the Methods page and can be edited.

export type Tier = 'A' | 'B' | 'C';

export interface PollsterInfo {
  family: string;
  tier: Tier;
  /** Prior house effect in points on the D-R margin (positive = leans D). */
  lean: number;
  note?: string;
}

const P = (family: string, tier: Tier, lean = 0, note?: string): PollsterInfo => ({ family, tier, lean, note });

/** Ordered: first matching pattern wins. */
const PATTERNS: [RegExp, PollsterInfo][] = [
  [/nyt\/siena|new york times\/siena|^siena/i, P('NYT/Siena', 'A')],
  [/marist/i, P('Marist', 'A')],
  [/quinnipiac/i, P('Quinnipiac', 'A')],
  [/emerson/i, P('Emerson College', 'A')],
  [/marquette/i, P('Marquette', 'A')],
  [/cnn\/ssrs|ssrs/i, P('CNN/SSRS', 'A')],
  [/^fox news/i, P('Fox News', 'A')],
  [/ap-?norc/i, P('AP-NORC', 'A')],
  [/unh|university of new hampshire/i, P('UNH Survey Center', 'A')],
  [/suffolk/i, P('Suffolk', 'A')],
  [/aarp/i, P('AARP (Fabrizio/Impact)', 'A')],
  [/ppic/i, P('PPIC', 'A')],
  [/berkeley|uc berkeley/i, P('UC Berkeley IGS', 'A')],
  [/msu|ippsr/i, P('MSU IPPSR', 'B')],
  [/elon/i, P('Elon University', 'B')],
  [/bgsu|bowling green/i, P('BGSU', 'B')],
  [/hendrix/i, P('Hendrix College', 'B')],
  [/umass lowell/i, P('UMass Lowell', 'B')],
  [/albuquerque journal/i, P('Albuquerque Journal', 'B')],
  [/stetson/i, P('Stetson University', 'B')],
  [/mason-dixon/i, P('Mason-Dixon', 'B')],
  [/noble predictive/i, P('Noble Predictive Insights', 'B')],
  [/surveyusa/i, P('SurveyUSA', 'B')],
  [/st\. pete polls/i, P('St. Pete Polls', 'B', 0, 'Automated phone; Florida specialist.')],
  [/alaska survey research/i, P('Alaska Survey Research', 'B')],
  [/economist\/yougov|^yougov/i, P('YouGov', 'B')],
  [/morning consult/i, P('Morning Consult', 'B')],
  [/reuters\/ipsos|ipsos/i, P('Ipsos', 'B')],
  [/echelon/i, P('Echelon Insights', 'B')],
  [/verasight|strength in numbers/i, P('Strength In Numbers/Verasight', 'B', 0.3)],
  [/angus reid/i, P('Angus Reid', 'B')],
  [/harvard caps|harris/i, P('Harvard CAPS/Harris', 'B', -1.5, 'Forced-choice format that pushes undecideds into the toplines.')],
  [/cygnal|carolina journal/i, P('Cygnal', 'B', -0.5, 'Republican firm with a strong record.')],
  [/data for progress/i, P('Data for Progress', 'B', 1.0, 'Democratic firm.')],
  [/common cause|public policy polling|ppp/i, P('Public Policy Polling', 'B', 1.5, 'Democratic firm.')],
  [/co\/efficient/i, P('co/efficient', 'B', -1.5, 'Republican firm.')],
  [/rasmussen/i, P('Rasmussen Reports', 'C', -1.5, 'Republican-leaning house effect in past cycles.')],
  [/insideradvantage|insider advantage/i, P('InsiderAdvantage', 'C', -2.0, 'Republican-leaning house effect in past cycles.')],
  [/trafalgar/i, P('Trafalgar Group', 'C', -2.0, 'Republican-leaning house effect in past cycles.')],
  [/quantus/i, P('Quantus Insights', 'C', -1.0)],
  [/big data poll/i, P('Big Data Poll', 'C', -1.0)],
  [/activote/i, P('ActiVote', 'C', 0, 'App-based panel; two-party toplines only.')],
  [/american research group|^arg/i, P('American Research Group', 'C')],
  [/wedgewood/i, P('Wedgewood Polls', 'C', -1.0)],
  [/socal strategies/i, P('SoCal Strategies', 'C', -1.0)],
  [/advanced targeting/i, P('Advanced Targeting Research', 'C', 0, 'Limited track record.')],
  [/gbao|dga|internal/i, P('Campaign internal', 'C', 0, 'Sponsor-released internal polls are adjusted against the sponsor.')],
];

const CACHE = new Map<string, PollsterInfo>();

export function pollsterInfo(name: string): PollsterInfo {
  const hit = CACHE.get(name);
  if (hit) return hit;
  let info: PollsterInfo | undefined;
  for (const [re, p] of PATTERNS) {
    if (re.test(name)) {
      info = p;
      break;
    }
  }
  if (!info) info = P(name, 'C', 0, 'Unrated pollster.');
  CACHE.set(name, info);
  return info;
}

/** Variance multiplier by tier; higher means the poll counts for less. */
export const TIER_VAR: Record<Tier, number> = { A: 1.0, B: 1.25, C: 1.7 };
