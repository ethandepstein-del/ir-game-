import { CARDS } from '../data/cards';
import { REGION_MEMBERS, TERRITORIES, type PowerId } from '../data/world';
import { mainThreat } from './diplomacy';
import { alivePowers, assetCount, assetsOf, attackBlocker, bordersPower, capitalOf, coreOf, current, hasPact, isDemocracy, ownedBy, pactWith, reachable, shares, tripwires } from './game';
import type { Action, GameState } from './types';

/** Is `u` a legitimate target for `p` right now? AIs honour pacts and coalition solidarity. */
function hostile(s: GameState, p: PowerId, u: number): boolean {
  const o = s.territories[u].owner;
  if (o === p) return false;
  if (!o) return true;
  if (hasPact(s, p, o)) return false;
  // Coalition solidarity, unless the other power has attacked us recently.
  const struck = (s.aggression[`${o}>${p}`] ?? -9) >= s.round - 1;
  if (!struck && s.coalition && s.coalition !== p && o !== s.coalition && !hasPact(s, o, s.coalition)) return false;
  return true;
}

/** Armies of hostile great powers that could strike territory t, minus t's own garrison. */
function exposure(s: GameState, p: PowerId, t: number): number {
  let enemy = 0;
  for (const u of TERRITORIES[t].adj) {
    const o = s.territories[u].owner;
    if (o && o !== p && !hasPact(s, p, o)) enemy = Math.max(enemy, s.territories[u].armies);
  }
  return enemy - s.territories[t].armies;
}

/** Minimum odds (attacking armies ÷ defenders) each doctrine accepts. */
const NERVE = { offensive: 1.3, revisionist: 1.25, defensive: 1.75, liberal: 1.7 } as const;

function nerve(s: GameState, p: PowerId): number {
  const ps = s.powers[p];
  let n = NERVE[ps.doctrine];
  // Diversionary war: an embattled autocracy wants a quick win abroad.
  if (!isDemocracy(p) && ps.legitimacy < 40) n -= 0.2;
  return n;
}

function targetValue(s: GameState, p: PowerId, u: number): number {
  const t = TERRITORIES[u];
  const owner = s.territories[u].owner;
  const d = s.powers[p].doctrine;
  const struckUs = owner ? (s.aggression[`${owner}>${p}`] ?? -9) >= s.round - 1 : false;
  const members = REGION_MEMBERS[t.region];
  const mineAfter = members.filter((m) => m === u || s.territories[m].owner === p).length;
  let v = 1 + (mineAfter / members.length) * 3;
  if (mineAfter === members.length) v += 4;
  if (!owner) v += 1;
  if (owner && s.coalition === owner && owner !== p) v += 5;
  if (owner && (s.aggression[`${owner}>${p}`] ?? -9) >= s.round - 1) v += 2;
  // Doctrine shapes what is worth fighting for.
  if (owner && owner !== p) {
    if (d === 'offensive') v += 1.5;
    if (d === 'revisionist' && owner === s.leader) v += 4;
    if ((d === 'defensive' || d === 'liberal') && !struckUs && s.coalition !== owner) v -= d === 'liberal' ? 3.5 : 2.5;
    if (isDemocracy(p) && isDemocracy(owner) && !struckUs) v -= 2.5;
  }
  if (!owner && d === 'defensive' && t.adj.some((a) => s.territories[a].owner === p && coreOf(a) === p)) v += 1.5;
  const core = coreOf(u);
  if (owner && core === owner) {
    const redline = 2;
    if (s.clock <= redline) return -Infinity;
    v -= s.clock <= 4 ? (d === 'revisionist' ? 3 : 4) : 2;
    if (s.coalition === owner) v += 2;
  }
  if (owner && capitalOf(u) === owner) v += 1;
  // Real-world stakes: straits, oil, fabs and mines are worth fighting for...
  for (const a of assetsOf(s, u)) v += a.kind === 'chips' ? (TERRITORIES[u].id !== 'taiwan' ? 1.3 : d === 'revisionist' ? 1 : -1.5) : a.kind === 'grain' ? 0.8 : 1.3;
  // ...but a rival's garrison is a tripwire: deterrence usually works.
  if (s.bases.some(([t, y]) => t === u && y === p)) v -= 1.5;
  if (tripwires(s, u, p).length) {
    if (s.clock <= 3) return -Infinity;
    v -= d === 'revisionist' ? 1 : d === 'offensive' ? 2 : 3;
  }
  // Denying a rival its region bonus is worth something too.
  if (owner && members.every((m) => s.territories[m].owner === owner)) v += 2;
  return v;
}

interface Option {
  from: number;
  to: number;
  score: number;
  odds: number;
}

function attackOptions(s: GameState, p: PowerId, extra = 0, extraAt = -1): Option[] {
  const out: Option[] = [];
  for (const from of ownedBy(s, p)) {
    const a = s.territories[from].armies + (from === extraAt ? extra : 0);
    if (a < 2) continue;
    for (const to of TERRITORIES[from].adj) {
      const d = s.territories[to].armies;
      const odds = (a - 1) / Math.max(1, d);
      let value = targetValue(s, p, to);
      if (!hostile(s, p, to)) {
        // Opportunists will betray a pact (never an alliance) for an easy, valuable prize.
        const o = s.territories[to].owner;
        const doc = s.powers[p].doctrine;
        const pact = o ? pactWith(s, p, o) : null;
        if (!(pact && pact.kind === 'nap' && (doc === 'offensive' || doc === 'revisionist') && odds >= 3 && value >= 4)) continue;
        value -= 2;
      }
      if (value <= 0) continue;
      out.push({ from, to, odds, score: value * Math.min(odds, 3) - d * 0.15 });
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

export function aiStep(s: GameState): Action {
  const p = current(s);
  const me = s.powers[p];

  if (s.pendingMove) {
    const m = s.pendingMove;
    const keep = exposure(s, p, m.from) > -2 ? Math.floor(m.max / 3) : 0;
    return { kind: 'move', n: Math.max(m.min, m.max - keep) };
  }

  const card = pickCard(s, p);
  if (card) return card;

  if (s.phase === 'deploy') {
    const mine = ownedBy(s, p);
    // Commit most reinforcements to the best offensive opportunity, the rest to the weakest border.
    const best = mine
      .map((t) => ({ t, opt: attackOptions(s, p, s.reinforcements, t).find((o) => o.from === t) }))
      .filter((x) => x.opt)
      .sort((a, b) => b.opt!.score - a.opt!.score)[0];
    const weakest = mine.reduce((a, b) => (exposure(s, p, b) > exposure(s, p, a) ? b : a));
    if (best && (exposure(s, p, weakest) < 3 || s.reinforcements > 4)) {
      const n = exposure(s, p, weakest) >= 3 ? Math.ceil(s.reinforcements * 0.65) : s.reinforcements;
      return { kind: 'deploy', t: best.t, n };
    }
    return { kind: 'deploy', t: weakest, n: s.reinforcements };
  }

  if (s.phase === 'attack') {
    const opt = attackOptions(s, p).find(
      (o) =>
        o.odds >= nerve(s, p) ||
        (o.odds >= 1.15 && s.coalition !== null && s.territories[o.to].owner === s.coalition && s.coalition !== p) ||
        (s.territories[o.to].armies === 1 && s.territories[o.from].armies >= 3),
    );
    if (opt && me.conquered < 8 && !attackBlocker(s, opt.from, opt.to)) {
      return { kind: 'attack', from: opt.from, to: opt.to, blitz: true, stopAt: Math.max(1, Math.ceil(s.territories[opt.from].armies / 4)) };
    }
    return { kind: 'endAttack' };
  }

  // Fortify: move the largest safe interior stack toward the most exposed reachable border.
  const interior = ownedBy(s, p)
    .filter((t) => s.territories[t].armies > 1 && TERRITORIES[t].adj.every((u) => !hostile(s, p, u) || !s.territories[u].owner))
    .sort((a, b) => s.territories[b].armies - s.territories[a].armies);
  for (const from of interior) {
    const targets = [...reachable(s, from)].filter((t) => TERRITORIES[t].adj.some((u) => hostile(s, p, u)));
    if (!targets.length) continue;
    const to = targets.reduce((a, b) => (exposure(s, p, b) > exposure(s, p, a) ? b : a));
    return { kind: 'fortify', from, to, n: s.territories[from].armies - 1 };
  }
  return { kind: 'endTurn' };
}

function pickCard(s: GameState, p: PowerId): Action | null {
  const cards = s.powers[p].cards;
  const sh = shares(s);
  const rival = s.coalition && s.coalition !== p ? s.coalition : alivePowers(s).filter((q) => q !== p).reduce((a, b) => (sh[b] > sh[a] ? b : a));
  for (let i = 0; i < cards.length; i++) {
    const c = CARDS[cards[i]];
    if (s.phase === 'deploy') {
      if (c.id === 'arms-race') return { kind: 'play', card: i };
      if (c.id === 'summit' && s.clock <= 3) return { kind: 'play', card: i };
      if (c.id === 'sanctions') return { kind: 'play', card: i, target: rival };
      if (c.id === 'coup') {
        const t = ownedBy(s, p)
          .flatMap((m) => TERRITORIES[m].adj)
          .find((u) => !s.territories[u].owner && s.territories[u].armies <= 4);
        if (t !== undefined) return { kind: 'play', card: i, target: t };
      }
      if (c.id === 'proxy-war' && rival) {
        const t = ownedBy(s, rival)
          .flatMap((m) => TERRITORIES[m].adj)
          .find((u) => !s.territories[u].owner);
        if (t !== undefined) return { kind: 'play', card: i, target: t };
      }
      if (c.id === 'cyber' && rival) return { kind: 'play', card: i, target: rival };
      if (c.id === 'info-ops' && rival && (isDemocracy(rival) || s.powers[rival].legitimacy < 50)) return { kind: 'play', card: i, target: rival };
      if (c.id === 'energy-cutoff' && rival && assetCount(s, p, 'oil') > 0) return { kind: 'play', card: i, target: rival };
      if (c.id === 'detente') {
        // Only when a real threat exists and no pact is in place.

        const threat = mainThreat(s, p);
        if (threat && threat !== s.coalition && !hasPact(s, p, threat) && bordersPower(s, p, threat)) return { kind: 'play', card: i, target: threat };
      }
    }
    if (s.phase === 'attack' && c.id === 'drone') {
      // Soften the best target first.
      const opt = attackOptions(s, p).find((o) => {
        const q = s.territories[o.to].owner;
        return s.territories[o.to].armies >= 3 && !(q && hasPact(s, p, q)) && !(q && coreOf(o.to) === q && s.clock <= 3);
      });
      if (opt) return { kind: 'play', card: i, target: opt.to };
    }
    if (s.phase === 'attack' && (c.id === 'carrier' || c.id === 'blitzkrieg') && !s.blitz && !s.carrier) {
      if (attackOptions(s, p).some((o) => o.odds >= nerve(s, p))) return { kind: 'play', card: i };
    }
  }
  return null;
}
