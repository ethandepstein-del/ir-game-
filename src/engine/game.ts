import { CONCEPTS, type ConceptId } from '../data/concepts';
import { line, type Reaction } from '../data/dialogue';
import { getScenario } from '../data/scenarios';
import {
  clamp,
  frontierDealAt,
  maxYouGivenThem,
  normalize,
  paretoFrontier,
  rand,
  theirValue,
  yourValue,
} from './math';
import type { Action, GameState, LeaderType, Moment, Scenario, Speaker } from './types';

const OPENING_ASPIRATION = 0.88;
/** They never concede all the way to their walk-away point unless pressured. */
const DEADLINE_MARGIN = 0.06;
/** Rounds without a proposal before the other side accuses you of stalling. */
const STALL_ROUNDS = 2;
/** How stubbornly each temperament holds out before conceding (Boulware exponent). */
const HOLDOUT: Record<LeaderType, number> = { opportunist: 2.6, insecure: 1.7, pragmatist: 1.2 };
/** Tension above which accidental incidents become possible. */
export const DANGER_LINE = 70;
export const MAX_RED_LINES = 2;

// ---------- Derived quantities ----------

/** The least they will ever accept: their valuation of the no-deal alternative. */
export function reservation(s: GameState, sc: Scenario): number {
  const { opp } = s;
  const fearWeight = opp.type === 'insecure' ? 0.14 : 0.04;
  const r = sc.oppReservationBase + (0.5 - opp.perceivedResolve) * 0.3 + opp.fear * fearWeight + opp.demandShift;
  return clamp(r, 0.12, 0.82);
}

/** What they currently demand; decays toward their reservation as the clock runs down. */
export function aspiration(s: GameState, sc: Scenario): number {
  const r = reservation(s, sc);
  const progress = sc.rounds <= 1 ? 1 : (s.round - 1) / (sc.rounds - 1);
  const holdout = 1 - Math.pow(progress, HOLDOUT[s.opp.type]);
  const trustDiscount = (s.trust - 40) / 600;
  const floor = r + DEADLINE_MARGIN;
  return clamp(floor + (OPENING_ASPIRATION - floor) * holdout - trustDiscount, r, 0.95);
}

/** Utility a deal needs to pass your legislature. Falls as support rises. */
export function ratificationThreshold(s: GameState, sc: Scenario): number {
  return clamp(sc.ratificationBase + (50 - s.support) / 250, 0.2, 0.85);
}

export interface DealPreview {
  yours: number;
  threshold: number;
  brokenRedLines: number[];
  passes: boolean;
}

export function previewDeal(s: GameState, values: number[]): DealPreview {
  const sc = getScenario(s.scenarioId);
  const yours = yourValue(sc.playerWeights, values);
  const threshold = ratificationThreshold(s, sc);
  const brokenRedLines = s.redLines.filter((r) => values[r.issue] < r.min).map((r) => r.issue);
  return { yours, threshold, brokenRedLines, passes: yours >= threshold && brokenRedLines.length === 0 };
}

/**
 * Move a package toward the utility `target` for them. Concede on the issues they
 * care least about first; claw back the ones they care most about first. This is what
 * makes their counteroffers reveal their priorities.
 */
export function adjustToward(s: GameState, base: number[], target: number): number[] {
  const v = s.opp.weights;
  const x = base.map((n) => clamp(Math.round(n), 0, 100));
  const floorFor = (i: number) => s.redLines.find((r) => r.issue === i)?.min ?? 0;
  let gap = theirValue(v, x) - target;
  if (gap > 0) {
    const order = x.map((_, i) => i).sort((a, b) => v[a] - v[b]);
    for (const i of order) {
      if (gap <= 0) break;
      const give = Math.min(100 - x[i], Math.floor((gap / v[i]) * 100));
      x[i] += give;
      gap -= (v[i] * give) / 100;
    }
  } else if (gap < 0) {
    const order = x.map((_, i) => i).sort((a, b) => v[b] - v[a]);
    // First pass respects your red lines (they believe them); second pass does not.
    for (const respect of [true, false]) {
      for (const i of order) {
        if (gap >= 0) break;
        const floor = respect ? floorFor(i) : 0;
        const take = Math.min(Math.max(0, x[i] - floor), Math.ceil((-gap / v[i]) * 100));
        x[i] -= take;
        gap += (v[i] * take) / 100;
      }
    }
  }
  return x;
}

// ---------- Setup ----------

export function newGame(scenarioId: string, seed = Date.now() >>> 0): GameState {
  const sc = getScenario(scenarioId);
  const s: GameState = {
    scenarioId,
    seed,
    rng: seed | 0,
    round: 1,
    tension: sc.start.tension,
    support: sc.start.support,
    trust: sc.start.trust,
    opp: { type: 'pragmatist', weights: [], perceivedResolve: 0.5, fear: 0.1, demandShift: 0, standingOffer: [] },
    revealed: sc.issues.map(() => false),
    typeHinted: false,
    redLines: [],
    mediatorUsed: false,
    mobilizations: 0,
    offers: [],
    log: [],
    moments: [],
    concepts: [],
    usedEvents: [],
    pendingEvent: null,
    status: 'playing',
    finalDeal: null,
    breakdownResult: null,
    ratificationFailures: 0,
    lastProposalRound: 1,
  };
  s.opp.type = sc.leaderTypes[Math.floor(rand(s) * sc.leaderTypes.length)];
  s.opp.weights = normalize(sc.oppWeightsBase.map((w) => w * (0.65 + rand(s) * 0.7)));
  s.opp.fear = s.opp.type === 'insecure' ? 0.3 : 0.1;
  s.opp.standingOffer = adjustToward(s, sc.issues.map(() => 0), aspiration(s, sc));
  s.offers.push({ from: 'them', round: 1, values: [...s.opp.standingOffer] });
  say(s, 'desk', `Talks open. ${sc.rounds} rounds on the clock.`);
  say(s, 'them', speak(s, sc, 'opening'));
  say(s, 'them', 'Our opening position is on the table.');
  return s;
}

// ---------- Helpers ----------

function say(s: GameState, speaker: Speaker, text: string, concepts?: ConceptId[]) {
  s.log.push({ round: s.round, speaker, text, concepts });
}

function speak(s: GameState, sc: Scenario, reaction: Reaction): string {
  return line(s.opp.type, reaction, rand(s))
    .replaceAll('{you}', sc.you.country)
    .replaceAll('{them}', sc.them.country);
}

function learn(s: GameState, ...ids: ConceptId[]) {
  for (const id of ids) if (!s.concepts.includes(id)) s.concepts.push(id);
}

function moment(s: GameState, text: string, concept: ConceptId, tone: Moment['tone']) {
  s.moments.push({ round: s.round, text, concept, tone });
  learn(s, concept);
}

function bump(s: GameState, d: { tension?: number; support?: number; trust?: number }) {
  if (d.tension) s.tension = clamp(s.tension + d.tension, 0, 100);
  if (d.support) s.support = clamp(s.support + d.support, 0, 100);
  if (d.trust) s.trust = clamp(s.trust + d.trust, 0, 100);
}

function shiftBelief(s: GameState, d: { resolve?: number; fear?: number; demand?: number }) {
  if (d.resolve) s.opp.perceivedResolve = clamp(s.opp.perceivedResolve + d.resolve, 0, 1);
  if (d.fear) s.opp.fear = clamp(s.opp.fear + d.fear, 0, 1);
  if (d.demand) s.opp.demandShift = clamp(s.opp.demandShift + d.demand, -0.2, 0.2);
}

function postCounter(s: GameState, sc: Scenario, base: number[]) {
  s.opp.standingOffer = adjustToward(s, base, aspiration(s, sc));
  s.offers.push({ from: 'them', round: s.round, values: [...s.opp.standingOffer] });
}

// ---------- Resolution ----------

function ratify(s: GameState, sc: Scenario, values: number[], how: string): void {
  const p = previewDeal(s, values);
  if (p.passes) {
    s.status = 'deal';
    s.finalDeal = [...values];
    say(s, 'desk', `${how} Your legislature ratifies the agreement.`, ['two-level-game']);
    learn(s, 'two-level-game');
    return;
  }
  s.ratificationFailures++;
  if (p.brokenRedLines.length) {
    const names = p.brokenRedLines.map((i) => sc.issues[i].name).join(', ');
    bump(s, { support: -22, trust: -8, tension: 8 });
    say(s, 'desk', `${how} But it crosses your own public red line on ${names}. The legislature votes it down and calls you a liar.`, ['audience-costs']);
    moment(s, `Signed a deal that crossed your own red line on ${names}. The audience cost came due.`, 'audience-costs', 'bad');
  } else {
    bump(s, { support: -10, trust: -10, tension: 8 });
    say(s, 'desk', `${how} But your legislature rejects it: it falls short of what they will accept.`, ['two-level-game']);
    moment(s, 'A deal the other side accepted died in your own legislature. Level II beat Level I.', 'two-level-game', 'bad');
  }
  shiftBelief(s, { demand: 0.02 });
  say(s, 'them', speak(s, sc, 'ratFail'));
}

function breakdown(s: GameState, sc: Scenario, cause: string) {
  s.status = 'breakdown';
  const pWin = 0.28 + Math.min(0.15, s.mobilizations * 0.05);
  const pLose = 0.27 - Math.min(0.12, s.mobilizations * 0.04);
  const r = rand(s);
  s.breakdownResult = r < pWin ? 0 : r < 1 - pLose ? 1 : 2;
  say(s, 'desk', cause);
  say(s, 'event', sc.breakdown.text[s.breakdownResult]);
  moment(s, `${sc.breakdown.name}: ${cause}`, 'bargaining-war', 'bad');
}

/** Applies a player action, then the other side's response and end-of-round effects. */
export function act(prev: GameState, action: Action): GameState {
  if (prev.status !== 'playing' || prev.pendingEvent) return prev;
  const s: GameState = structuredClone(prev);
  const sc = getScenario(s.scenarioId);
  const opp = s.opp;
  let counterBase: number[] | null = null;

  switch (action.kind) {
    case 'propose': {
      const x = action.values;
      s.offers.push({ from: 'you', round: s.round, values: [...x] });
      say(s, 'you', 'You table a package.');
      const theirs = theirValue(opp.weights, x);
      const asp = aspiration(s, sc);
      if (theirs >= asp - 0.005) {
        if (s.trust < sc.trustFloor) {
          say(s, 'them', speak(s, sc, 'noTrust'), ['commitment-problem']);
          moment(s, `They liked the terms but would not sign at trust ${Math.round(s.trust)} (they needed ${sc.trustFloor}).`, 'commitment-problem', 'neutral');
          counterBase = x;
          break;
        }
        say(s, 'them', speak(s, sc, 'accept'));
        ratify(s, sc, x, 'They accept.');
        if (s.status === 'deal') return s;
        break;
      }
      if (theirs < reservation(s, sc) - 0.15) {
        bump(s, { trust: -5, tension: 4 });
        say(s, 'them', speak(s, sc, 'lowball'), ['batna']);
        learn(s, 'batna');
      } else {
        say(s, 'them', speak(s, sc, 'counter'), ['logrolling']);
        learn(s, 'logrolling');
      }
      counterBase = x;
      break;
    }

    case 'acceptTheirs': {
      say(s, 'you', 'You accept their terms.');
      say(s, 'them', speak(s, sc, 'acceptTheirs'));
      ratify(s, sc, opp.standingOffer, 'Handshakes all round.');
      if (s.status === 'deal') return s;
      break;
    }

    case 'ultimatum': {
      const x = action.values;
      s.offers.push({ from: 'you', round: s.round, values: [...x] });
      bump(s, { tension: 15 });
      say(s, 'you', 'You put a final offer on the table: take it, or face the consequences.', ['brinkmanship']);
      const give = { opportunist: 0.05, pragmatist: 0.03, insecure: -0.03 }[opp.type];
      const theirs = theirValue(opp.weights, x);
      if (theirs >= reservation(s, sc) - give && s.trust >= sc.trustFloor - 15) {
        bump(s, { trust: -15 });
        say(s, 'them', speak(s, sc, 'ultimatumAccept'));
        moment(s, 'Your ultimatum worked: the offer was above their true walk-away point.', 'brinkmanship', 'good');
        ratify(s, sc, x, 'They accept under protest.');
        if (s.status === 'deal') return s;
        break;
      }
      say(s, 'them', speak(s, sc, 'ultimatumReject'));
      moment(s, 'Your ultimatum fell below their walk-away point. Brinkmanship went over the edge.', 'brinkmanship', 'bad');
      breakdown(s, sc, `Your ultimatum is rejected and talks collapse.`);
      return s;
    }

    case 'mobilize': {
      s.mobilizations++;
      bump(s, { tension: 14, support: 6 });
      say(s, 'you', 'You order a partial mobilization.', ['costly-signal', 'rally-effect']);
      learn(s, 'costly-signal', 'rally-effect');
      say(s, 'them', speak(s, sc, 'mobilize'));
      if (opp.type === 'opportunist') {
        shiftBelief(s, { resolve: 0.2, demand: -0.03 });
        moment(s, 'You mobilized and the opportunist backed off. Deterrence worked.', 'deterrence-model', 'good');
      } else if (opp.type === 'insecure') {
        shiftBelief(s, { resolve: 0.08, fear: 0.25, demand: 0.03 });
        bump(s, { tension: 10 });
        say(s, 'them', speak(s, sc, 'counterMobilize'));
        moment(s, 'You mobilized; a frightened state mobilized back and hardened its demands. The spiral turned.', 'spiral-model', 'bad');
      } else {
        shiftBelief(s, { resolve: 0.15 });
        moment(s, 'A costly signal: the pragmatist updated their estimate of your resolve.', 'costly-signal', 'neutral');
      }
      break;
    }

    case 'warning': {
      bump(s, { tension: 5, support: 3 });
      say(s, 'you', 'You warn publicly that your country "will not be pushed around."', ['cheap-talk']);
      learn(s, 'cheap-talk');
      const credible = s.trust >= 50 || s.support >= 70;
      if (credible) {
        shiftBelief(s, { resolve: 0.06 });
        say(s, 'them', speak(s, sc, 'warning'));
      } else {
        shiftBelief(s, { resolve: 0.01 });
        say(s, 'them', speak(s, sc, 'warningIgnored'));
      }
      if (opp.type === 'insecure') shiftBelief(s, { fear: 0.08 });
      break;
    }

    case 'tieHands': {
      if (s.redLines.length >= MAX_RED_LINES || s.redLines.some((r) => r.issue === action.issue)) return prev;
      s.redLines.push({ issue: action.issue, min: action.min });
      bump(s, { support: 8, tension: 4 });
      shiftBelief(s, { resolve: 0.08, demand: -0.02 });
      const issue = sc.issues[action.issue];
      say(s, 'you', `You declare a public red line: ${issue.name}, no worse than "${issue.format(action.min)}".`, ['audience-costs']);
      learn(s, 'audience-costs');
      say(s, 'them', speak(s, sc, 'tieHands'));
      moment(s, `Drew a red line on ${issue.name}. Tying your hands made the commitment credible.`, 'audience-costs', 'neutral');
      break;
    }

    case 'goodwill': {
      bump(s, { tension: -15, trust: 12, support: -6 });
      say(s, 'you', 'You make a unilateral goodwill gesture.');
      say(s, 'them', speak(s, sc, 'goodwill'));
      if (opp.type === 'opportunist') {
        shiftBelief(s, { resolve: -0.12, demand: 0.04 });
        moment(s, 'Goodwill toward an opportunist read as weakness, and their demands went up.', 'deterrence-model', 'bad');
      } else if (opp.type === 'insecure') {
        shiftBelief(s, { fear: -0.25, demand: -0.05 });
        moment(s, 'Reassurance calmed a fearful counterpart, and their demands fell.', 'spiral-model', 'good');
      } else {
        shiftBelief(s, { demand: -0.015 });
      }
      break;
    }

    case 'backchannel': {
      bump(s, { tension: -3 });
      say(s, 'you', 'You open a quiet back channel.', ['private-information']);
      learn(s, 'private-information');
      const hidden = s.revealed.map((r, i) => (r ? -1 : i)).filter((i) => i >= 0);
      if (hidden.length) {
        const i = hidden[Math.floor(rand(s) * hidden.length)];
        s.revealed[i] = true;
        const w = opp.weights[i];
        const level = w >= 0.33 ? 'a top priority' : w >= 0.2 ? 'important' : 'a low priority';
        say(s, 'desk', `Source: ${sc.them.country} sees ${sc.issues[i].name} as ${level} (${Math.round(w * 100)}% of their concern).`);
      }
      if (!s.typeHinted && (hidden.length <= 3)) {
        s.typeHinted = true;
        const hint = {
          opportunist: `${sc.them.leader} has been telling aides privately that you will fold if pressed.`,
          insecure: `${sc.them.leader}'s generals are convinced you are preparing to strike. The fear looks genuine.`,
          pragmatist: `${sc.them.leader} has asked for detailed economic costings of each option.`,
        }[opp.type];
        say(s, 'desk', `Source: ${hint}`);
      }
      moment(s, 'Used a back channel to reduce the information asymmetry.', 'private-information', 'neutral');
      break;
    }

    case 'mediator': {
      if (s.mediatorUsed) return prev;
      s.mediatorUsed = true;
      bump(s, { tension: -10, trust: 5 });
      shiftBelief(s, { demand: -0.03 });
      const frontier = paretoFrontier(sc.playerWeights, opp.weights);
      const dYou = sc.noDealValue;
      const dThem = reservation(s, sc);
      let best = frontierDealAt(frontier, 0.5);
      let bestProduct = -Infinity;
      for (let k = 0; k <= 200; k++) {
        const deal = frontierDealAt(frontier, k / 200);
        const product = (yourValue(sc.playerWeights, deal) - dYou) * (theirValue(opp.weights, deal) - dThem);
        if (product > bestProduct) {
          bestProduct = product;
          best = deal;
        }
      }
      s.offers.push({ from: 'mediator', round: s.round, values: best });
      say(s, 'you', 'You invite a neutral mediator.', ['mediation']);
      say(s, 'desk', 'The mediator shuttles between delegations and proposes a package. It is loaded on your board.', ['mediation']);
      say(s, 'them', speak(s, sc, 'mediator'));
      moment(s, 'Brought in a mediator, who proposed a package on the efficient frontier.', 'mediation', 'good');
      break;
    }

    case 'walkout': {
      s.status = 'walkout';
      say(s, 'you', 'You gather your papers and walk out.');
      say(s, 'desk', `No agreement. The standoff continues without a deal.`);
      moment(s, 'Walked away: you took your BATNA.', 'batna', 'neutral');
      return s;
    }
  }

  if (action.kind === 'propose' || action.kind === 'mediator') {
    s.lastProposalRound = s.round;
  } else if (s.round - s.lastProposalRound >= STALL_ROUNDS) {
    bump(s, { trust: -4 });
    shiftBelief(s, { demand: 0.015 });
    say(s, 'them', 'Are you here to negotiate or to stall? Put something on the table.');
  }
  postCounter(s, sc, counterBase ?? opp.standingOffer);
  endRound(s, sc);
  return s;
}

function endRound(s: GameState, sc: Scenario) {
  const opp = s.opp;
  // The other side's own moves.
  if (opp.type === 'opportunist' && opp.perceivedResolve < 0.35 && rand(s) < 0.5) {
    bump(s, { tension: 8 });
    say(s, 'them', speak(s, sc, 'provoke'));
    moment(s, 'Sensing weakness, the opportunist probed with a provocation.', 'deterrence-model', 'bad');
  }
  if (opp.type === 'insecure' && opp.fear > 0.6 && rand(s) < 0.5) {
    bump(s, { tension: 6 });
    say(s, 'desk', `${sc.them.country} raises its alert level, citing "defensive necessity."`);
  }
  opp.fear = clamp(opp.fear * 0.92, 0, 1);

  // Brinkmanship: above the danger line things can slip out of anyone's control.
  if (s.tension >= 100) {
    breakdown(s, sc, 'Escalation reaches the top of the ladder. The talks are overtaken by events.');
    return;
  }
  if (s.tension > DANGER_LINE && rand(s) < (s.tension - DANGER_LINE) / 120) {
    learn(s, 'brinkmanship');
    breakdown(s, sc, 'An incident nobody ordered: a nervous commander, a misread radar return. It spirals out of control.');
    return;
  }

  s.round++;
  if (s.round > sc.rounds) {
    s.status = 'nodeal';
    say(s, 'desk', 'The clock runs out. Delegations go home without an agreement.');
    moment(s, 'Time ran out with no deal.', 'zopa', 'bad');
    return;
  }

  // Refresh their standing offer as their patience wears down.
  s.opp.standingOffer = adjustToward(s, s.opp.standingOffer, aspiration(s, sc));

  const unused = sc.events.filter((e) => !s.usedEvents.includes(e.id));
  if (unused.length && s.round > 1 && rand(s) < 0.42) {
    const ev = unused[Math.floor(rand(s) * unused.length)];
    s.usedEvents.push(ev.id);
    s.pendingEvent = ev;
  }
}

export function resolveEvent(prev: GameState, optionIndex: number): GameState {
  if (!prev.pendingEvent) return prev;
  const s: GameState = structuredClone(prev);
  const sc = getScenario(s.scenarioId);
  const ev = s.pendingEvent!;
  const opt = ev.options[optionIndex];
  const e = opt.effects;
  bump(s, { tension: e.tension, support: e.support, trust: e.trust });
  shiftBelief(s, { resolve: e.resolve, fear: e.fear, demand: e.aspiration });
  say(s, 'event', `${ev.title}: ${opt.outcome}`, opt.concept ? [opt.concept] : undefined);
  if (opt.concept) learn(s, opt.concept);
  s.pendingEvent = null;
  s.opp.standingOffer = adjustToward(s, s.opp.standingOffer, aspiration(s, sc));
  if (s.tension >= 100) breakdown(s, sc, 'The crisis boils over before talks can resume.');
  return s;
}

// ---------- Scoring & debrief ----------

export interface Result {
  score: number;
  grade: string;
  title: string;
  headline: string;
  yours: number;
  theirs: number | null;
  leftOnTable: number;
  lines: { label: string; value: number }[];
}

const GRADES: [number, string, string][] = [
  [78, 'S', 'Metternich Would Weep'],
  [68, 'A', 'Master Diplomat'],
  [58, 'B', 'Seasoned Envoy'],
  [47, 'C', 'Junior Attaché'],
  [34, 'D', 'Out of Your Depth'],
  [0, 'F', 'Casus Belli'],
];

export function result(s: GameState): Result {
  const sc = getScenario(s.scenarioId);
  const lines: Result['lines'] = [];
  let base: number;
  let theirs: number | null = null;
  let leftOnTable = 0;
  let headline: string;
  if (s.status === 'deal' && s.finalDeal) {
    base = yourValue(sc.playerWeights, s.finalDeal) * 100;
    theirs = theirValue(s.opp.weights, s.finalDeal);
    const frontier = paretoFrontier(sc.playerWeights, s.opp.weights);
    leftOnTable = Math.max(0, maxYouGivenThem(frontier, theirs) * 100 - base);
    lines.push({ label: 'Value of the agreement', value: Math.round(base) });
    const durability = clamp(Math.round((s.trust - 40) / 6 - (s.tension - 50) / 12), -6, 8);
    lines.push({ label: durability >= 0 ? 'Durability (trust, calm)' : 'Fragility (distrust, tension)', value: durability });
    base += durability;
    headline = 'Agreement signed and ratified';
  } else if (s.status === 'breakdown' && s.breakdownResult !== null) {
    base = sc.breakdown.values[s.breakdownResult] * 100;
    lines.push({ label: `${sc.breakdown.name}: ${['victory', 'stalemate', 'defeat'][s.breakdownResult]}`, value: Math.round(base) });
    headline = sc.breakdown.name;
  } else {
    base = sc.noDealValue * 100;
    lines.push({ label: 'Status quo, no agreement', value: Math.round(base) });
    headline = s.status === 'walkout' ? 'You walked out' : 'Time ran out';
  }
  if (s.mobilizations) {
    lines.push({ label: `Mobilization costs ×${s.mobilizations}`, value: -2 * s.mobilizations });
    base -= 2 * s.mobilizations;
  }
  const score = Math.round(clamp(base, 0, 100));
  const [, grade, title] = GRADES.find(([min]) => score >= min)!;
  return {
    score,
    grade,
    title,
    headline,
    yours: s.finalDeal ? yourValue(sc.playerWeights, s.finalDeal) : 0,
    theirs,
    leftOnTable,
    lines,
  };
}

/** Concepts the debrief teaches, including ones only visible after the reveal. */
export function debriefConcepts(s: GameState): ConceptId[] {
  const ids = new Set<ConceptId>(s.concepts);
  ids.add('bargaining-war');
  ids.add('zopa');
  ids.add(s.opp.type === 'insecure' ? 'spiral-model' : 'deterrence-model');
  if (s.status === 'deal') ids.add('pareto');
  return [...ids].filter((id) => id in CONCEPTS);
}
