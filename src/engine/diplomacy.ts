import type { ConceptId } from '../data/concepts';
import { MAX_ALLIANCES, POWER, TERRITORIES, type PowerId } from '../data/world';
import { alivePowers, allied, alliesOf, bordersPower, hasPact, isDemocracy, ownedBy, rand, shares } from './game';
import type { Doctrine, GameState, Obligation, Offer } from './types';

/** The great power with the most armies massed next to `p`'s territories. */
export function mainThreat(s: GameState, p: PowerId): PowerId | null {
  const mine = new Set(ownedBy(s, p));
  const pressure = {} as Record<PowerId, number>;
  s.territories.forEach((t, i) => {
    if (!t.owner || t.owner === p || hasPact(s, p, t.owner)) return;
    if (TERRITORIES[i].adj.some((u) => mine.has(u))) pressure[t.owner] = (pressure[t.owner] ?? 0) + t.armies;
  });
  const entries = Object.entries(pressure) as [PowerId, number][];
  if (!entries.length) return null;
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

export interface PactVerdict {
  accept: boolean;
  reason: string;
  concept?: ConceptId;
}

type Factor = { v: number; reason: string; concept?: ConceptId };

const PACT_BIAS: Record<Doctrine, Factor> = {
  liberal: { v: 20, reason: 'Agreements make everyone safer. We are glad to sign.', concept: 'institutions' },
  defensive: { v: 8, reason: 'A quiet border lets us look to our security.' },
  offensive: { v: -14, reason: 'Paper promises do not make a state secure. Power does.', concept: 'offensive-realism' },
  revisionist: { v: -8, reason: 'We will not bind ourselves to the present order.', concept: 'revisionism' },
};

const ALLIANCE_BIAS: Record<Doctrine, Factor> = {
  liberal: { v: 22, reason: 'Collective defense is how cooperation survives anarchy.', concept: 'institutions' },
  defensive: { v: 6, reason: 'An alliance against a shared threat is prudent.' },
  offensive: { v: -22, reason: 'We will not be chained to another state\'s wars.', concept: 'chain-ganging' },
  revisionist: { v: -12, reason: 'We keep our hands free to change the order.', concept: 'revisionism' },
};

function verdict(score: number, factors: Factor[], threshold: number): PactVerdict {
  const accept = score >= threshold;
  const decisive = accept
    ? factors.filter((f) => f.v > 0).sort((a, b) => b.v - a.v)[0]
    : factors.filter((f) => f.v < 0).sort((a, b) => a.v - b.v)[0];
  return {
    accept,
    reason: decisive?.reason ?? (accept ? 'A reasonable arrangement.' : 'We see no advantage in it.'),
    concept: decisive?.concept,
  };
}

/** Factors every agreement shares: the balance, threats, reputation, regimes. */
function commonFactors(s: GameState, from: PowerId, to: PowerId): Factor[] {
  const sh = shares(s);
  const rep = s.powers[from].reputation;
  const f: Factor[] = [];
  const doctrine = s.powers[to].doctrine;
  const repWeight = doctrine === 'liberal' ? 1.4 : 0.8;
  f.push({ v: (rep - 50) * repWeight * 0.5, reason: rep >= 50 ? 'Your record of keeping your word helps.' : 'You have broken your word before.', concept: 'reputation' });
  if (s.coalition === from && from !== 'ind') f.push({ v: -60, reason: 'You are the threat to the balance. We stand with the coalition.', concept: 'balancing' });
  if (sh[from] > sh[to] + 0.12) f.push({ v: -12, reason: 'You are growing too strong. We keep our hands free.' });
  const threat = mainThreat(s, to);
  if (threat && threat !== from) f.push({ v: 16, reason: `Our real problem is ${POWER[threat].name}.`, concept: 'balancing' });
  if (threat === from) f.push({ v: -10, reason: 'Your armies sit on our border. Words will not move them.', concept: 'security-dilemma' });
  if (isDemocracy(from) && isDemocracy(to)) f.push({ v: 12, reason: 'Democracies keep faith with one another.', concept: 'democratic-peace' });
  if (from === 'eu') f.push({ v: 12, reason: 'Institutions are your strength. Agreed.', concept: 'institutions' });
  if (from === 'ind') f.push({ v: 20, reason: 'India threatens no one. Agreed.' });
  return f;
}

/** Would `to` accept a non-aggression pact from `from`? */
export function considerPact(s: GameState, from: PowerId, to: PowerId): PactVerdict {
  const f = commonFactors(s, from, to);
  f.push(PACT_BIAS[s.powers[to].doctrine]);
  if (!bordersPower(s, from, to)) f.push({ v: 10, reason: 'We have no quarrel with you. Agreed.' });
  return verdict(42 + f.reduce((a, x) => a + x.v, 0), f, 50);
}

/** Would `to` accept a defensive alliance? Needs a shared threat (Walt's balance of threat). */
export function considerAlliance(s: GameState, from: PowerId, to: PowerId): PactVerdict {
  const f = commonFactors(s, from, to);
  f.push(ALLIANCE_BIAS[s.powers[to].doctrine]);
  const tFrom = mainThreat(s, from);
  const tTo = mainThreat(s, to);
  const shared = (tFrom && tFrom === tTo) || (s.coalition && s.coalition !== from && s.coalition !== to);
  if (shared) f.push({ v: 22, reason: `We face the same danger. Together, then.`, concept: 'collective-defense' });
  else f.push({ v: -14, reason: 'We do not share your enemies, and we will not inherit them.', concept: 'chain-ganging' });
  if (alliesOf(s, to).length >= MAX_ALLIANCES) f.push({ v: -100, reason: 'We are already committed elsewhere.' });
  return verdict(30 + f.reduce((a, x) => a + x.v, 0), f, 55);
}

/** Occasionally an AI facing a different threat offers the player a pact. */
export function pickOfferToPlayer(s: GameState): Offer | null {
  if (s.round < 2 || s.coalition === s.player) return null;
  for (const q of alivePowers(s)) {
    if (q === s.player || hasPact(s, q, s.player) || !bordersPower(s, q, s.player)) continue;
    const threat = mainThreat(s, q);
    const eager = s.powers[q].doctrine === 'liberal' ? 0.45 : s.powers[q].doctrine === 'offensive' ? 0.1 : 0.25;
    if (threat && threat !== s.player && rand(s) < eager) return { from: q, to: s.player };
  }
  return null;
}

const PACT_EAGERNESS: Record<Doctrine, number> = { liberal: 0.6, defensive: 0.35, revisionist: 0.2, offensive: 0.12 };

/** AIs court a neighbour when their main threat lies elsewhere. */
export function aiPactTarget(s: GameState, p: PowerId): PowerId | null {
  if (s.round < 2 || rand(s) > PACT_EAGERNESS[s.powers[p].doctrine]) return null;
  const threat = mainThreat(s, p);
  const candidates = alivePowers(s).filter(
    (q) => q !== p && q !== s.player && q !== threat && q !== s.coalition && p !== s.coalition && !hasPact(s, p, q) && bordersPower(s, p, q),
  );
  for (const q of candidates) if (considerPact(s, p, q).accept) return q;
  return null;
}

/** AIs facing a common threat may form a defensive alliance. */
export function aiAllianceTarget(s: GameState, p: PowerId): PowerId | null {
  const d = s.powers[p].doctrine;
  if (s.round < 3 || d === 'offensive' || alliesOf(s, p).length >= MAX_ALLIANCES) return null;
  if (rand(s) > (d === 'liberal' ? 0.35 : 0.15)) return null;
  const candidates = alivePowers(s).filter((q) => q !== p && q !== s.player && !allied(s, p, q) && q !== s.coalition && p !== s.coalition);
  for (const q of candidates) if (considerAlliance(s, p, q).accept) return q;
  return null;
}

/** Does an AI honor its alliance when the ally is attacked? */
export function decideObligation(s: GameState, ob: Obligation): boolean {
  const sh = shares(s);
  const me = ob.ally;
  let score = { liberal: 30, defensive: 16, offensive: -8, revisionist: -14 }[s.powers[me].doctrine];
  score += sh[ob.aggressor] < sh[me] ? 18 : -14;
  score += bordersPower(s, me, ob.aggressor) ? 8 : -8;
  if (s.clock <= 3) score -= 10;
  if (isDemocracy(me)) score += 6;
  return score >= 10;
}
