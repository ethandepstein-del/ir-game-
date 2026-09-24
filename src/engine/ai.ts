import { CARDS } from '../data/cards';
import { REGION_MEMBERS, TERRITORIES, type PowerId } from '../data/world';
import { mainThreat } from './diplomacy';
import { alivePowers, attackBlocker, bordersPower, capitalOf, coreOf, current, hasPact, ownedBy, reachable, shares } from './game';
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

function targetValue(s: GameState, p: PowerId, u: number): number {
  const t = TERRITORIES[u];
  const owner = s.territories[u].owner;
  const members = REGION_MEMBERS[t.region];
  const mineAfter = members.filter((m) => m === u || s.territories[m].owner === p).length;
  let v = 1 + (mineAfter / members.length) * 3;
  if (mineAfter === members.length) v += 4;
  if (!owner) v += 1;
  if (owner && s.coalition === owner && owner !== p) v += 5;
  if (owner && (s.aggression[`${owner}>${p}`] ?? -9) >= s.round - 1) v += 2;
  const core = coreOf(u);
  if (owner && core === owner) {
    if (s.clock <= 2) return -Infinity;
    v -= s.clock <= 4 ? 4 : 2;
    if (s.coalition === owner) v += 2;
  }
  if (owner && capitalOf(u) === owner) v += 1;
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
      if (!hostile(s, p, to)) continue;
      const d = s.territories[to].armies;
      const odds = (a - 1) / Math.max(1, d);
      const value = targetValue(s, p, to);
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
        o.odds >= 1.5 ||
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
      if (c.id === 'detente') {
        // Only when a real threat exists and no pact is in place.

        const threat = mainThreat(s, p);
        if (threat && threat !== s.coalition && !hasPact(s, p, threat) && bordersPower(s, p, threat)) return { kind: 'play', card: i, target: threat };
      }
    }
    if (s.phase === 'attack' && (c.id === 'carrier' || c.id === 'blitzkrieg') && !s.blitz && !s.carrier) {
      if (attackOptions(s, p).some((o) => o.odds >= 1.5)) return { kind: 'play', card: i };
    }
  }
  return null;
}
