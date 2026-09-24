import type { ConceptId } from '../data/concepts';
import { POWER, TERRITORIES, type PowerId } from '../data/world';
import { alivePowers, bordersPower, hasPact, ownedBy, rand, shares } from './game';
import type { GameState, Offer } from './types';

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

/** Would `to` accept a non-aggression pact from `from`? Realist logic with a reputation term. */
export function considerPact(s: GameState, from: PowerId, to: PowerId): PactVerdict {
  const sh = shares(s);
  const rep = s.powers[from].reputation;
  let score = 42 + (rep - 50) * 0.8;
  const factors: { v: number; reason: string; concept?: ConceptId }[] = [];

  if (s.coalition === from && from !== 'ind') factors.push({ v: -60, reason: 'You are the threat to the balance. We stand with the coalition.', concept: 'balancing' });
  if (rep < 35) factors.push({ v: -15, reason: 'Your signature is worth nothing. You broke your word before.', concept: 'reputation' });
  if (sh[from] > sh[to] + 0.12) factors.push({ v: -12, reason: 'You are growing too strong. We keep our hands free.' });
  const threat = mainThreat(s, to);
  if (threat && threat !== from) factors.push({ v: 16, reason: `Our real problem is ${POWER[threat].name}. Peace on your border suits us.` });
  if (threat === from) factors.push({ v: -8, reason: 'Your armies sit on our border. Words will not move them.', concept: 'security-dilemma' });
  if (!bordersPower(s, from, to)) factors.push({ v: 10, reason: 'We have no quarrel with you. Agreed.' });
  if (from === 'eu') factors.push({ v: 14, reason: 'Institutions are your strength. Agreed.', concept: 'institutions' });
  if (from === 'ind') factors.push({ v: 24, reason: 'India threatens no one. Agreed.' });

  for (const f of factors) score += f.v;
  const accept = score >= 50;
  const decisive = accept
    ? factors.filter((f) => f.v > 0).sort((a, b) => b.v - a.v)[0]
    : factors.filter((f) => f.v < 0).sort((a, b) => a.v - b.v)[0];
  return {
    accept,
    reason: decisive?.reason ?? (accept ? 'A reasonable arrangement.' : 'We see no advantage in it.'),
    concept: decisive?.concept,
  };
}

/** Occasionally an AI facing a different threat offers the player a pact. */
export function pickOfferToPlayer(s: GameState): Offer | null {
  if (s.round < 2 || s.coalition === s.player) return null;
  for (const q of alivePowers(s)) {
    if (q === s.player || hasPact(s, q, s.player) || !bordersPower(s, q, s.player)) continue;
    const threat = mainThreat(s, q);
    if (threat && threat !== s.player && rand(s) < 0.3) return { from: q, to: s.player };
  }
  return null;
}

/** AIs court a neighbour when their main threat lies elsewhere, so EU and Indian doctrines matter for AIs too. */
export function aiPactTarget(s: GameState, p: PowerId): PowerId | null {
  if (s.round < 2 || rand(s) > 0.35) return null;
  const threat = mainThreat(s, p);
  const candidates = alivePowers(s).filter(
    (q) => q !== p && q !== s.player && q !== threat && q !== s.coalition && p !== s.coalition && !hasPact(s, p, q) && bordersPower(s, p, q),
  );
  for (const q of candidates) if (considerPact(s, p, q).accept) return q;
  return null;
}
