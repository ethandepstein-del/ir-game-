import { CARDS, DECK } from '../data/cards';
import type { ConceptId } from '../data/concepts';
import { SEA_LANES } from '../data/map.generated';
import {
  HEGEMONY,
  MAX_ALLIANCES,
  MAX_CLOCK,
  MAX_ROUNDS,
  MIDDLE_POWERS,
  PACT_LENGTH,
  POWER,
  POWERS,
  REGION_MEMBERS,
  REGIONS,
  START_CLOCK,
  T,
  TERRITORIES,
  type PowerId,
} from '../data/world';
import { DOCTRINE_ORDER } from '../data/doctrines';
import { ASSETS, START_BASES, type Asset, type AssetKind } from '../data/geo';
import { aiAllianceTarget, aiPactTarget, considerAlliance, considerPact, decideObligation, pickOfferToPlayer } from './diplomacy';
import type { Action, BattleReport, Doctrine, Era, FxEvent, GameState, LogKind, Obligation, PowerState } from './types';

// ---------- Static lookups ----------

const LANE_SET = new Set(SEA_LANES.flatMap(([a, b]) => [`${a}-${b}`, `${b}-${a}`]));
export const isSeaLane = (a: number, b: number) => LANE_SET.has(`${a}-${b}`);
export const adjacent = (a: number, b: number) => TERRITORIES[a].adj.includes(b);
const CORE: Record<PowerId, number[]> = Object.fromEntries(POWERS.map((p) => [p.id, p.core.map(T)])) as Record<PowerId, number[]>;
const CAPITAL: Record<PowerId, number> = Object.fromEntries(POWERS.map((p) => [p.id, T(p.capital)])) as Record<PowerId, number>;
export const coreOf = (t: number): PowerId | null => POWERS.find((p) => CORE[p.id].includes(t))?.id ?? null;
export const capitalOf = (t: number): PowerId | null => POWERS.find((p) => CAPITAL[p.id] === t)?.id ?? null;

// ---------- RNG ----------

export function rand(s: GameState): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const die = (s: GameState) => 1 + Math.floor(rand(s) * 6);

// ---------- Queries ----------

export const current = (s: GameState): PowerId => s.order[s.turn];
export const ownedBy = (s: GameState, p: PowerId) => s.territories.flatMap((t, i) => (t.owner === p ? [i] : []));
export const hasPact = (s: GameState, a: PowerId, b: PowerId) =>
  s.pacts.some((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));
export const pactWith = (s: GameState, a: PowerId, b: PowerId) =>
  s.pacts.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a)) ?? null;
export const alivePowers = (s: GameState) => s.order.filter((p) => s.powers[p].alive);
export const allied = (s: GameState, a: PowerId, b: PowerId) =>
  s.pacts.some((p) => p.kind === 'alliance' && ((p.a === a && p.b === b) || (p.a === b && p.b === a)));
export const alliesOf = (s: GameState, p: PowerId): PowerId[] =>
  s.pacts.filter((x) => x.kind === 'alliance' && (x.a === p || x.b === p)).map((x) => (x.a === p ? x.b : x.a));
export const isDemocracy = (p: PowerId) => POWER[p].regime === 'democracy';

/** Does an ally of the defender stand next to this territory (collective defense)? */
export function alliedSupport(s: GameState, to: number): PowerId | null {
  const def = s.territories[to].owner;
  if (!def) return null;
  for (const ally of alliesOf(s, def)) {
    if (TERRITORIES[to].adj.some((u) => s.territories[u].owner === ally)) return ally;
  }
  return null;
}

// ---------- Real-world stakes: assets and bases ----------

/** The strategic assets in a territory that still work (fabs can be wrecked). */
export function assetsOf(s: GameState, t: number): Asset[] {
  const list = ASSETS[TERRITORIES[t].id] ?? [];
  return s.wrecked.includes(t) ? list.filter((a) => a.kind !== 'chips') : list;
}

export function assetCount(s: GameState, p: PowerId, kind: AssetKind): number {
  return ownedBy(s, p).reduce((n, t) => n + assetsOf(s, t).filter((a) => a.kind === kind).length, 0);
}

/** Rival bases in `to` whose garrisons would fight an attack by `attacker`. */
export function tripwires(s: GameState, to: number, attacker: PowerId): [number, PowerId, string][] {
  const owner = s.territories[to].owner;
  return s.bases.filter(([t, y]) => t === to && y !== attacker && y !== owner && s.powers[y].alive);
}

/** Plain-language consequences of attacking `to` from `from`, for previews. */
export function attackConsequences(s: GameState, from: number, to: number): { text: string; tone: 'bad' | 'warn' | 'info' }[] {
  const p = s.territories[from].owner!;
  const def = s.territories[to].owner;
  const out: { text: string; tone: 'bad' | 'warn' | 'info' }[] = [];
  const host = s.bases.find(([t, y]) => t === to && y === p);
  if (host) out.push({ text: `Invading your own host nation closes ${host[2]}: reputation −15`, tone: 'bad' });
  for (const [, y, name] of tripwires(s, to, p)) {
    out.push({ text: `Tripwire: ${POWER[y].short} garrison at ${name} fights back (+1 to their best die)`, tone: 'warn' });
    out.push({ text: `Overrunning it: Doomsday Clock −1 and ${POWER[y].short} will retaliate`, tone: 'bad' });
  }
  if (TERRITORIES[to].id === 'taiwan' && !s.wrecked.includes(to))
    out.push({ text: 'Taking it by force wrecks the chip fabs: every power gets 2 fewer armies next turn', tone: 'warn' });
  if (!def) return out;
  const pact = pactWith(s, p, def);
  if (pact) out.push({ text: pact.kind === 'alliance' ? 'Betrays your ally: reputation −40' : 'Breaks your pact: reputation −30', tone: 'bad' });
  if (coreOf(to) === def && !s.coreStrikes.includes(`${p}>${def}`)) out.push({ text: 'Homeland strike: Doomsday Clock −1', tone: 'bad' });
  if (isDemocracy(p) && isDemocracy(def) && !s.turnKeys.includes(`dp>${def}`)) out.push({ text: 'Democratic peace: your legitimacy −8', tone: 'warn' });
  const obliged = alliesOf(s, def).filter((y) => y !== p && !allied(s, y, p) && s.powers[y].alive);
  if (obliged.length) out.push({ text: `${obliged.map((y) => POWER[y].short).join(' & ')} must honor ${POWER[def].short}'s alliance`, tone: 'warn' });
  const sup = alliedSupport(s, to);
  if (sup && s.era !== 'defense') out.push({ text: `${POWER[sup].short} stands beside them: +1 to their best die`, tone: 'info' });
  if (coreOf(to) === def) out.push({ text: `${POWER[def].short} rallies at home: their legitimacy +4`, tone: 'info' });
  return out;
}

export function regionsHeld(s: GameState, p: PowerId) {
  return REGIONS.filter((r) => REGION_MEMBERS[r.id].every((t) => s.territories[t].owner === p));
}

export function bordersPower(s: GameState, a: PowerId, b: PowerId): boolean {
  return ownedBy(s, a).some((t) => TERRITORIES[t].adj.some((u) => s.territories[u].owner === b));
}

export interface IncomeLine {
  label: string;
  value: number;
}

export function income(s: GameState, p: PowerId): { total: number; lines: IncomeLine[] } {
  const n = ownedBy(s, p).length;
  const lines: IncomeLine[] = [{ label: `${n} territories ÷ 3`, value: Math.max(3, Math.floor(n / 3)) }];
  for (const r of regionsHeld(s, p)) lines.push({ label: r.name, value: r.bonus });
  if (p === 'chn') {
    const g = Math.min(4, Math.floor((s.round - 1) / 3));
    if (g) lines.push({ label: 'Rising Power', value: g });
  }
  if (p === 'ind') lines.push({ label: 'Strategic Autonomy', value: 2 });
  const straits = assetCount(s, p, 'strait');
  if (straits) lines.push({ label: 'Chokepoints', value: straits });
  const oil = assetCount(s, p, 'oil');
  if (oil) lines.push({ label: 'Oil & gas', value: oil });
  const chips = assetCount(s, p, 'chips');
  if (chips) lines.push({ label: 'Chip fabs', value: chips });
  const minerals = Math.floor(assetCount(s, p, 'minerals') / 2);
  if (minerals) lines.push({ label: 'Critical minerals', value: minerals });
  if (p === 'eu') {
    const k = Math.min(3, s.pacts.filter((x) => x.a === 'eu' || x.b === 'eu').length);
    if (k) lines.push({ label: 'Institutions', value: k });
  }
  if (s.coalition && s.coalition !== p && !hasPact(s, p, s.coalition)) {
    const leaderShare = shares(s)[s.coalition];
    lines.push({ label: 'Coalition aid', value: leaderShare >= 0.42 ? 5 : leaderShare >= 0.37 ? 4 : 3 });
  }
  const L = s.powers[p].legitimacy;
  if (L >= 75) lines.push({ label: 'Popular mandate', value: 2 });
  else if (L <= 15) lines.push({ label: 'Regime crisis', value: -4 });
  else if (L <= 35) lines.push({ label: 'Unrest at home', value: -2 });
  const mod = s.powers[p].incomeMod;
  if (mod) lines.push({ label: mod < 0 ? 'Sanctions & shocks' : 'Windfall', value: mod });
  const total = Math.max(1, lines.reduce((a, l) => a + l.value, 0));
  return { total, lines };
}

/** Share of total great-power strength (territories plus armies). */
export function shares(s: GameState): Record<PowerId, number> {
  const w = {} as Record<PowerId, number>;
  let total = 0;
  for (const p of s.order) {
    const ts = ownedBy(s, p);
    w[p] = s.powers[p].alive ? ts.length + ts.reduce((a, t) => a + s.territories[t].armies, 0) / 4 : 0;
    total += w[p];
  }
  for (const p of s.order) w[p] = total ? w[p] / total : 0;
  return w;
}

export type Polarity = 'Unipolar' | 'Bipolar' | 'Multipolar';
export function polarity(s: GameState): Polarity {
  const v = Object.values(shares(s)).sort((a, b) => b - a);
  if (v[0] >= 0.42) return 'Unipolar';
  if (v[1] >= 0.27 && v[2] < 0.2) return 'Bipolar';
  return 'Multipolar';
}

export function prestige(s: GameState, p: PowerId): number {
  const ts = ownedBy(s, p);
  const capitals = ts.filter((t) => capitalOf(t)).length;
  return ts.length + regionsHeld(s, p).reduce((a, r) => a + r.bonus, 0) + capitals * 3;
}

/** Territories reachable from `from` through your own territories (for fortifying). */
export function reachable(s: GameState, from: number): Set<number> {
  const owner = s.territories[from].owner;
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const t = queue.shift()!;
    for (const u of TERRITORIES[t].adj) {
      if (!seen.has(u) && s.territories[u].owner === owner) {
        seen.add(u);
        queue.push(u);
      }
    }
  }
  seen.delete(from);
  return seen;
}

export function attackDice(s: GameState, from: number, to: number): { a: number; d: number; amphibious: boolean } {
  const att = s.territories[from].owner!;
  const def = s.territories[to];
  const amphibious = isSeaLane(from, to);
  let a = Math.min(3, s.territories[from].armies - 1);
  if (amphibious && att !== 'usa') a = Math.min(a, 2);
  let d = Math.min(2, def.armies);
  if (def.owner === 'rus' && TERRITORIES[to].region === 'hl') d = Math.min(3, def.armies);
  if (s.carrier) d = 1;
  return { a, d, amphibious };
}

// ---------- Mutation helpers ----------

function log(s: GameState, kind: LogKind, text: string, power: PowerId | null = null) {
  s.log.push({ round: s.round, power, kind, text });
  if (s.log.length > 200) s.log.splice(0, s.log.length - 200);
}

export function learn(s: GameState, id: ConceptId) {
  if (!s.learned.includes(id)) {
    s.learned.push(id);
    s.dispatches.push(id);
  }
}

function fx(s: GameState, e: FxEvent) {
  s.fx.push(e);
}

function drawCard(s: GameState, p: PowerState) {
  const card = DECK[Math.floor(rand(s) * DECK.length)];
  p.cards.push(card);
  if (p.cards.length > 5) p.cards.shift();
}

export function legit(s: GameState, p: PowerId, delta: number) {
  s.powers[p].legitimacy = clamp(s.powers[p].legitimacy + delta, 0, 100);
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function addPact(s: GameState, a: PowerId, b: PowerId) {
  if (hasPact(s, a, b)) return;
  s.pacts.push({ a, b, until: s.round + PACT_LENGTH - 1, kind: 'nap' });
  s.powers[a].stats.pacts++;
  s.powers[b].stats.pacts++;
  fx(s, { t: 'pact', a, b });
  if (a === 'eu' || b === 'eu') learn(s, 'institutions');
}

function addAlliance(s: GameState, a: PowerId, b: PowerId) {
  s.pacts = s.pacts.filter((p) => !((p.a === a && p.b === b) || (p.a === b && p.b === a)));
  s.pacts.push({ a, b, until: 9999, kind: 'alliance' });
  s.powers[a].stats.pacts++;
  s.powers[b].stats.pacts++;
  fx(s, { t: 'alliance', a, b });
  learn(s, 'collective-defense');
}

function dropPact(s: GameState, a: PowerId, b: PowerId) {
  s.pacts = s.pacts.filter((p) => !((p.a === a && p.b === b) || (p.a === b && p.b === a)));
}

function breakPact(s: GameState, a: PowerId, b: PowerId) {
  const wasAlliance = allied(s, a, b);
  dropPact(s, a, b);
  s.powers[a].reputation = Math.max(0, s.powers[a].reputation - (wasAlliance ? 40 : 30));
  s.powers[a].stats.betrayals++;
  legit(s, a, isDemocracy(a) ? -10 : -3);
  fx(s, { t: 'pactBroken', a, b });
  log(
    s,
    'diplo',
    wasAlliance
      ? `${POWER[a].name} turns on its own ally, ${POWER[b].name}. No one will trust its guarantees now.`
      : `${POWER[a].name} tears up its pact with ${POWER[b].name}. Its word is worth less now.`,
    a,
  );
  learn(s, 'reputation');
  if (isDemocracy(a)) learn(s, 'audience-costs');
}

/** An ally answers the call, or walks away. */
function resolveObligation(s: GameState, ob: Obligation, honor: boolean) {
  const { ally, victim, aggressor } = ob;
  s.obligations = s.obligations.filter((o) => o !== ob && !(o.ally === ally && o.victim === victim && o.aggressor === aggressor));
  if (!allied(s, ally, victim) || !s.powers[ally].alive) return;
  if (honor) {
    if (hasPact(s, ally, aggressor)) dropPact(s, ally, aggressor);
    s.aggression[`${aggressor}>${ally}`] = s.round;
    s.powers[ally].stats.honored++;
    if (ally === current(s)) s.reinforcements += 3;
    else s.powers[ally].incomeMod += 3;
    legit(s, ally, 2);
    log(s, 'diplo', `${POWER[ally].name} honors its alliance with ${POWER[victim].name} and mobilizes against ${POWER[aggressor].name} (+3 armies).`, ally);
    const sh = shares(s);
    learn(s, sh[aggressor] > sh[ally] ? 'chain-ganging' : 'collective-defense');
  } else {
    dropPact(s, ally, victim);
    s.powers[ally].reputation = Math.max(0, s.powers[ally].reputation - 25);
    s.powers[ally].stats.abandoned++;
    legit(s, ally, isDemocracy(ally) ? -12 : -4);
    log(s, 'diplo', `${POWER[ally].name} abandons ${POWER[victim].name} to its fate. The alliance is dead.`, ally);
    learn(s, 'buck-passing');
    if (isDemocracy(ally)) learn(s, 'audience-costs');
  }
  fx(s, { t: 'obligation', ally, victim, aggressor, honored: honor });
}

// ---------- Setup ----------

export function newGame(player: PowerId, seed = Date.now() >>> 0): GameState {
  const s: GameState = {
    seed,
    rng: seed | 0,
    round: 1,
    order: POWERS.map((p) => p.id),
    turn: 0,
    player,
    phase: 'deploy',
    reinforcements: 0,
    territories: TERRITORIES.map(() => ({ owner: null, armies: 0 })),
    powers: Object.fromEntries(
      POWERS.map((p): [PowerId, PowerState] => [
        p.id,
        {
          id: p.id,
          alive: true,
          cards: [],
          reputation: 60,
          incomeMod: 0,
          conquered: 0,
          doctrine: 'liberal',
          legitimacy: 60,
          bled: 0,
          stats: { gpAttacks: 0, pacts: 0, betrayals: 0, honored: 0, abandoned: 0 },
        },
      ]),
    ) as Record<PowerId, PowerState>,
    pacts: [],
    clock: START_CLOCK,
    quietRound: true,
    era: 'balanced',
    coalition: null,
    leader: null,
    log: [],
    lastBattle: null,
    pendingMove: null,
    fortified: false,
    coreStrikes: [],
    blitz: false,
    carrier: false,
    proposedThisRound: [],
    offer: null,
    winner: null,
    endReason: null,
    learned: [],
    dispatches: [],
    history: [],
    fx: [],
    aggression: {},
    obligations: [],
    pendingObligation: null,
    turnKeys: [],
    guesses: {},
    bases: START_BASES.map(([id, p, name]) => [T(id), p, name] as [number, PowerId, string]),
    wrecked: [],
  };
  // Each rival secretly follows a different grand strategy.
  const doctrines: Doctrine[] = [...DOCTRINE_ORDER];
  for (let i = doctrines.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [doctrines[i], doctrines[j]] = [doctrines[j], doctrines[i]];
  }
  s.order.filter((p) => p !== player).forEach((p, i) => (s.powers[p].doctrine = doctrines[i % doctrines.length]));
  s.territories.forEach((t, i) => {
    t.armies = 1 + Math.floor(rand(s) * 3) + (MIDDLE_POWERS[TERRITORIES[i].id] ?? 0);
  });
  for (const p of POWERS) {
    for (const id of p.core) {
      const t = T(id);
      s.territories[t] = { owner: p.id, armies: id === p.capital ? 7 : 4 };
    }
    drawCard(s, s.powers[p.id]);
  }
  learn(s, 'anarchy');
  log(s, 'info', 'The unipolar moment is over. Five great powers compete in an anarchic world.');
  s.leader = leaderOf(s);
  s.history.push({ round: 1, share: shares(s) });
  startTurn(s);
  return s;
}

function leaderOf(s: GameState): PowerId {
  const sh = shares(s);
  return alivePowers(s).reduce((a, b) => (sh[b] > sh[a] ? b : a));
}

function startTurn(s: GameState) {
  const p = current(s);
  const ps = s.powers[p];
  // Food security: breadbaskets keep the home front fed and calm .
  const grain = assetCount(s, p, 'grain');
  if (grain && ps.legitimacy < 100) {
    legit(s, p, grain);
    if (p === s.player) learn(s, 'food-security');
  }
  const inc = income(s, p);
  s.reinforcements = inc.total;
  ps.incomeMod = 0;
  ps.conquered = 0;
  s.phase = 'deploy';
  s.fortified = false;
  s.coreStrikes = [];
  s.blitz = false;
  s.carrier = false;
  s.pendingMove = null;
  s.lastBattle = null;
  s.turnKeys = [];
  // Alliance obligations come due at the start of the ally's turn.
  s.obligations = s.obligations.filter((o) => s.round - o.round <= 1 && s.powers[o.victim].alive && s.powers[o.aggressor].alive);
  const mine = s.obligations.filter((o) => o.ally === p);
  if (p === s.player) s.pendingObligation = mine[0] ?? null;
  else for (const ob of mine) resolveObligation(s, ob, decideObligation(s, ob));
  s.offer = p === s.player && !s.pendingObligation ? pickOfferToPlayer(s) : null;
  if (p !== s.player) {
    const ally = aiAllianceTarget(s, p);
    if (ally) {
      addAlliance(s, p, ally);
      log(s, 'diplo', `${POWER[p].name} and ${POWER[ally].name} form a defensive alliance.`, p);
    } else {
      const partner = aiPactTarget(s, p);
      if (partner) {
        addPact(s, p, partner);
        log(s, 'diplo', `${POWER[p].name} and ${POWER[partner].name} sign a non-aggression pact.`, p);
      }
    }
  }
  fx(s, { t: 'turn', power: p, round: s.round });
}

function endRound(s: GameState) {
  s.round++;
  s.proposedThisRound = [];
  // Pacts that run their course build reputation.
  for (const pact of s.pacts.filter((x) => x.until < s.round)) {
    s.powers[pact.a].reputation = Math.min(100, s.powers[pact.a].reputation + 5);
    s.powers[pact.b].reputation = Math.min(100, s.powers[pact.b].reputation + 5);
    log(s, 'diplo', `The ${POWER[pact.a].short}–${POWER[pact.b].short} pact expires, honored by both sides.`);
  }
  s.pacts = s.pacts.filter((x) => x.until >= s.round);

  // Domestic politics: casualties wear democracies down; quiet rounds restore order.
  for (const p of alivePowers(s)) {
    const ps = s.powers[p];
    if (isDemocracy(p) && ps.bled >= 6) {
      legit(s, p, -3);
      learn(s, 'public-opinion');
    } else if (!isDemocracy(p) && ps.bled >= 10) legit(s, p, -2);
    else if (ps.bled === 0 && ps.legitimacy < 55) legit(s, p, 2);
    ps.bled = 0;
  }
  if (s.quietRound && s.clock < MAX_CLOCK) {
    s.clock++;
    fx(s, { t: 'clock', minutes: s.clock, delta: 1 });
    log(s, 'info', `A quiet round between the great powers. The Doomsday Clock eases back to ${s.clock} minutes.`);
  }
  s.quietRound = true;

  if (s.round === 7 || s.round === 13 || s.round === 19) shiftEra(s);
  if (s.round % 3 === 0) globalEvent(s);
  updateBalance(s);
  s.history.push({ round: s.round, share: shares(s) });

  if (s.round > MAX_ROUNDS) {
    const best = alivePowers(s).reduce((a, b) => (prestige(s, b) > prestige(s, a) ? b : a));
    finish(s, best, 'score');
  }
}

const ERA_TEXT: Record<Era, string> = {
  balanced: 'Balanced era: standard combat. Ties go to the defender.',
  defense: 'Age of the Machine Gun: defense is dominant. Defenders add +1 to their highest die.',
  offense: 'Age of Maneuver: offense is dominant. Attackers win ties.',
};

function shiftEra(s: GameState) {
  const options = (['balanced', 'defense', 'offense'] as Era[]).filter((e) => e !== s.era);
  s.era = options[Math.floor(rand(s) * options.length)];
  log(s, 'alert', `Military technology shifts. ${ERA_TEXT[s.era]}`);
  fx(s, { t: 'era', era: s.era });
  learn(s, 'offense-defense');
}

function globalEvent(s: GameState) {
  const r = Math.floor(rand(s) * 6);
  if (r === 0) {
    for (const p of alivePowers(s)) s.powers[p].incomeMod -= 2;
    fx(s, { t: 'world', kind: 'financial' });
    log(s, 'alert', 'Global financial crisis: every power gets 2 fewer armies next turn.');
  } else if (r === 1) {
    for (const p of alivePowers(s)) {
      const held = assetCount(s, p, 'oil');
      if (held) s.powers[p].incomeMod += 2 * held;
    }
    fx(s, { t: 'world', kind: 'oil' });
    log(s, 'alert', 'Oil shock: prices spike. Every power gets +2 armies next turn for each oil field it holds.');
    learn(s, 'energy-security');
  } else if (r === 4) {
    for (const p of alivePowers(s)) legit(s, p, -6);
    fx(s, { t: 'world', kind: 'pandemic' });
    log(s, 'alert', 'A pandemic sweeps the world. Lockdowns and funerals: every power loses 6 legitimacy.');
  } else if (r === 5) {
    for (const p of alivePowers(s)) {
      const g = assetCount(s, p, 'grain');
      legit(s, p, g ? 3 * g : -4);
    }
    fx(s, { t: 'world', kind: 'grain' });
    log(s, 'alert', 'Drought and blockades send grain prices soaring. Breadbasket powers gain legitimacy; importers face bread riots.');
    learn(s, 'food-security');
  } else if (r === 2) {
    for (const t of s.territories) if (!t.owner) t.armies++;
    fx(s, { t: 'world', kind: 'nationalism' });
    log(s, 'alert', 'Nationalist awakening: every minor state gains +1 army.');
  } else {
    s.clock = Math.min(MAX_CLOCK, s.clock + 1);
    fx(s, { t: 'world', kind: 'talks' });
    fx(s, { t: 'clock', minutes: s.clock, delta: 1 });
    log(s, 'alert', `Back-channel arms talks succeed. The Doomsday Clock moves back to ${s.clock} minutes.`);
    learn(s, 'arms-control');
  }
}

function updateBalance(s: GameState) {
  const sh = shares(s);
  const lead = leaderOf(s);
  if (s.leader && lead !== s.leader && s.round > 3) {
    log(s, 'alert', `Power transition: ${POWER[lead].name} overtakes ${POWER[s.leader].name} as the strongest power.`);
    learn(s, 'power-transition');
    fx(s, { t: 'transition', power: lead });
  }
  s.leader = lead;
  if (polarity(s) !== 'Multipolar') learn(s, 'polarity');

  const leadTerritories = ownedBy(s, lead).length;
  if (!s.coalition && sh[lead] >= 0.33 && leadTerritories >= 13) {
    s.coalition = lead;
    log(s, 'alert', `Balancing coalition: the other powers close ranks against ${POWER[lead].name}.`);
    learn(s, 'balancing');
    fx(s, { t: 'coalition', against: lead });
    // The weakest exposed power may bandwagon with the leader instead.
    const weak = alivePowers(s)
      .filter((p) => p !== lead && sh[p] < 0.13 && bordersPower(s, p, lead) && p !== s.player)
      .sort((a, b) => sh[a] - sh[b])[0];
    if (weak && !hasPact(s, weak, lead)) {
      addPact(s, weak, lead);
      log(s, 'diplo', `${POWER[weak].name} bandwagons: it signs a pact with ${POWER[lead].name} rather than resist.`);
      learn(s, 'bandwagoning');
      fx(s, { t: 'bandwagon', power: weak, leader: lead });
    }
  } else if (s.coalition && (sh[s.coalition] < 0.27 || !s.powers[s.coalition].alive)) {
    log(s, 'info', `The coalition against ${POWER[s.coalition].name} dissolves: the balance is restored.`);
    fx(s, { t: 'coalitionEnd' });
    s.coalition = null;
  } else if (s.coalition && s.coalition !== lead && sh[lead] >= 0.33 && leadTerritories >= 13) {
    s.coalition = lead;
    log(s, 'alert', `The coalition turns on the new leader, ${POWER[lead].name}.`);
    fx(s, { t: 'coalition', against: lead });
  }
  if (sh[lead] >= 0.42) learn(s, 'hegemony');
}

function finish(s: GameState, winner: PowerId | null, reason: NonNullable<GameState['endReason']>) {
  s.winner = winner;
  s.endReason = reason;
  fx(s, { t: 'end', winner, reason });
}

export function isOver(s: GameState) {
  return s.endReason !== null;
}

function nextTurn(s: GameState) {
  const p = current(s);
  if (s.powers[p].conquered > 0) drawCard(s, s.powers[p]);
  if (ownedBy(s, p).length >= HEGEMONY) {
    log(s, 'alert', `${POWER[p].name} controls ${ownedBy(s, p).length} territories and establishes global hegemony.`, p);
    learn(s, 'hegemony');
    finish(s, p, 'hegemony');
    return;
  }
  do {
    s.turn++;
    if (s.turn >= s.order.length) {
      s.turn = 0;
      endRound(s);
      if (isOver(s)) return;
    }
  } while (!s.powers[current(s)].alive);
  startTurn(s);
}

// ---------- Combat ----------

function resolveRoll(s: GameState, from: number, to: number): BattleReport {
  const A = s.territories[from];
  const D = s.territories[to];
  const attacker = A.owner!;
  const { a, d, amphibious } = attackDice(s, from, to);
  if (amphibious) learn(s, 'sea-power');
  const aDice = Array.from({ length: a }, () => die(s)).sort((x, y) => y - x);
  const dDice = Array.from({ length: d }, () => die(s)).sort((x, y) => y - x);
  const dEff = [...dDice];
  if (s.era === 'defense' && dEff.length) dEff[0] += 1;
  else if (dEff.length && alliedSupport(s, to)) {
    dEff[0] += 1;
    learn(s, 'collective-defense');
  } else if (dEff.length && tripwires(s, to, attacker).length) {
    // A great power's garrison stands in the way.
    dEff[0] += 1;
    learn(s, 'tripwire');
  }
  const attackerWinsTies = s.era === 'offense' || s.blitz;
  let aLoss = 0;
  let dLoss = 0;
  const wins: boolean[] = [];
  for (let i = 0; i < Math.min(a, d); i++) {
    const win = aDice[i] > dEff[i] || (aDice[i] === dEff[i] && attackerWinsTies);
    wins.push(win);
    if (win) dLoss++;
    else aLoss++;
  }
  A.armies -= aLoss;
  D.armies -= dLoss;
  s.powers[attacker].bled += aLoss;
  if (D.owner) s.powers[D.owner].bled += dLoss;
  return { from, to, attacker, defender: D.owner, aDice, dDice, aLoss, dLoss, conquered: D.armies <= 0, wins };
}

function strikeCore(s: GameState, attacker: PowerId, to: number) {
  const def = s.territories[to].owner;
  if (!def || coreOf(to) !== def) return;
  const key = `${attacker}>${def}`;
  s.quietRound = false;
  if (!s.turnKeys.includes(`rally>${def}`)) {
    s.turnKeys.push(`rally>${def}`);
    legit(s, def, 4);
    learn(s, 'public-opinion');
  }
  if (s.coreStrikes.includes(key)) return;
  s.coreStrikes.push(key);
  s.clock = Math.max(0, s.clock - 1);
  fx(s, { t: 'clock', minutes: s.clock, delta: -1 });
  log(s, 'alert', `${POWER[attacker].name} strikes the ${POWER[def].name} homeland. Doomsday Clock: ${s.clock} minutes to midnight.`, attacker);
  learn(s, 'mad');
  if (s.clock <= 0) midnight(s);
}

function midnight(s: GameState) {
  if (isOver(s)) return;
  log(s, 'alert', 'Midnight. The great-power war has gone nuclear.');
  finish(s, null, 'nuclear');
}

function conquer(s: GameState, rep: BattleReport, diceUsed: number) {
  const { from, to, attacker } = rep;
  const loser = rep.defender;
  const overrun = tripwires(s, to, attacker);
  // Invading the country that hosts your own base ends the basing deal, and others notice.
  const own = s.bases.find(([t, y]) => t === to && y === attacker);
  if (own) {
    s.bases = s.bases.filter((b) => b !== own);
    s.powers[attacker].reputation = Math.max(0, s.powers[attacker].reputation - 15);
    log(s, 'diplo', `${POWER[attacker].name} turns on its own host nation. ${own[2]} closes, and allies take note.`, attacker);
    learn(s, 'reputation');
  }
  s.territories[to].owner = attacker;
  s.territories[to].armies = 0;
  s.powers[attacker].conquered++;
  const wasLow = s.powers[attacker].legitimacy < 40;
  legit(s, attacker, isDemocracy(attacker) ? 1 : 2);
  if (loser) legit(s, loser, isDemocracy(loser) ? -3 : -2);
  if (wasLow && !isDemocracy(attacker) && !s.turnKeys.includes('diversion')) {
    s.turnKeys.push('diversion');
    log(s, 'alert', `${POWER[attacker].name}'s embattled regime seeks victories abroad to shore up support at home.`, attacker);
    learn(s, 'diversionary-war');
  }
  const max = s.territories[from].armies - 1;
  s.pendingMove = { from, to, min: Math.min(diceUsed, max), max };
  fx(s, { t: 'conquer', at: to, from, power: attacker, loser });
  const name = TERRITORIES[to].name;
  log(s, 'war', loser ? `${POWER[attacker].name} takes ${name} from ${POWER[loser].name}.` : `${POWER[attacker].name} takes ${name}.`, attacker);

  if (loser && capitalOf(to) === loser) {
    s.clock = Math.max(0, s.clock - 1);
    fx(s, { t: 'capital', at: to, power: loser });
    fx(s, { t: 'clock', minutes: s.clock, delta: -1 });
    log(s, 'alert', `${POWER[loser].name}'s capital has fallen. Doomsday Clock: ${s.clock} minutes.`);
  }
  // Tripwires: overrunning a great power's garrison drags it into the war.
  for (const [t, y, base] of overrun) {
    s.bases = s.bases.filter((b) => !(b[0] === t && b[1] === y));
    legit(s, y, 5);
    s.aggression[`${attacker}>${y}`] = s.round;
    s.quietRound = false;
    fx(s, { t: 'base', at: to, power: y, by: attacker, name: base });
    log(s, 'alert', `${POWER[attacker].name} overruns ${base}. ${POWER[y].name}'s garrison is killed and its public demands a response.`, attacker);
    learn(s, 'tripwire');
    if (!s.turnKeys.includes(`trip>${y}`)) {
      s.turnKeys.push(`trip>${y}`);
      s.clock = Math.max(0, s.clock - 1);
      fx(s, { t: 'clock', minutes: s.clock, delta: -1 });
    }
  }
  // Silicon shield: invading Taiwan wrecks the fabs the whole world depends on.
  if (TERRITORIES[to].id === 'taiwan' && !s.wrecked.includes(to)) {
    s.wrecked.push(to);
    for (const q of alivePowers(s)) s.powers[q].incomeMod -= 2;
    fx(s, { t: 'chipShock', at: to, by: attacker });
    log(s, 'alert', `The chip fabs in ${TERRITORIES[to].name} are wrecked in the fighting. A global chip shock: every power gets 2 fewer armies next turn.`, attacker);
    learn(s, 'weaponized-interdependence');
  }
  if (assetsOf(s, to).some((a) => a.kind === 'strait') && attacker === s.player) learn(s, 'chokepoints');
  if (assetsOf(s, to).some((a) => a.kind === 'oil') && attacker === s.player) learn(s, 'energy-security');

  if (TERRITORIES[to].region === 'hl' && attacker !== 'rus') learn(s, 'heartland');
  if (regionsHeld(s, attacker).some((r) => r.id === 'hl')) learn(s, 'heartland');
  if (!loser && s.clock <= 4 && s.coreStrikes.length === 0) learn(s, 'stability-instability');

  if (s.clock <= 0) {
    midnight(s);
    return;
  }
  if (loser && ownedBy(s, loser).length === 0) {
    s.powers[loser].alive = false;
    s.powers[attacker].cards.push(...s.powers[loser].cards);
    s.powers[attacker].cards = s.powers[attacker].cards.slice(-5);
    s.powers[loser].cards = [];
    s.pacts = s.pacts.filter((p) => p.a !== loser && p.b !== loser);
    log(s, 'alert', `${POWER[loser].name} has been eliminated as a great power.`, attacker);
    fx(s, { t: 'eliminated', power: loser, by: attacker });
    if (loser === s.player) finish(s, null, 'eliminated');
    else if (alivePowers(s).length === 1) finish(s, attacker, 'last-standing');
  }
}

// ---------- Validation ----------

export function attackBlocker(s: GameState, from: number, to: number): string | null {
  const p = current(s);
  if (s.phase !== 'attack') return 'Not in the attack phase.';
  if (s.territories[from].owner !== p) return 'You must attack from your own territory.';
  if (s.territories[to].owner === p) return 'You already hold it.';
  if (!adjacent(from, to)) return 'Not adjacent.';
  if (s.territories[from].armies < 2) return 'Need at least 2 armies to attack.';
  return null;
}

// ---------- The reducer ----------

/**
 * Copy exactly the parts of the state a reducer step can mutate. Several times
 * faster than structuredClone, which matters when the AI plays a whole round at once.
 */
export function cloneState(p: GameState): GameState {
  const powers = {} as GameState['powers'];
  for (const k in p.powers) {
    const ps = p.powers[k as PowerId];
    powers[k as PowerId] = { ...ps, cards: ps.cards.slice(), stats: { ...ps.stats } };
  }
  return {
    ...p,
    order: p.order.slice(),
    territories: p.territories.map((t) => ({ ...t })),
    powers,
    pacts: p.pacts.map((x) => ({ ...x })),
    log: p.log.slice(),
    pendingMove: p.pendingMove ? { ...p.pendingMove } : null,
    coreStrikes: p.coreStrikes.slice(),
    proposedThisRound: p.proposedThisRound.slice(),
    offer: p.offer ? { ...p.offer } : null,
    learned: p.learned.slice(),
    dispatches: p.dispatches.slice(),
    history: p.history.slice(),
    fx: p.fx.slice(),
    aggression: { ...p.aggression },
    obligations: p.obligations.map((o) => ({ ...o })),
    pendingObligation: p.pendingObligation ? { ...p.pendingObligation } : null,
    turnKeys: p.turnKeys.slice(),
    guesses: { ...p.guesses },
    bases: p.bases.slice(),
    wrecked: p.wrecked.slice(),
  };
}

export function apply(prev: GameState, action: Action): GameState {
  if (isOver(prev)) return prev;
  const s: GameState = cloneState(prev);
  s.dispatches = [];
  s.fx = [];
  const p = current(s);
  const me = s.powers[p];

  if (s.pendingMove && action.kind !== 'move') return prev;
  if (action.kind === 'guess') {
    if (action.power === s.player) return prev;
    if (action.doctrine) s.guesses[action.power] = action.doctrine;
    else delete s.guesses[action.power];
    return s;
  }
  if (s.pendingObligation && action.kind !== 'answerObligation') return prev;
  const validT = (t: unknown): t is number => Number.isInteger(t) && (t as number) >= 0 && (t as number) < s.territories.length;
  const count = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : NaN);

  switch (action.kind) {
    case 'deploy': {
      if (s.phase !== 'deploy' || !validT(action.t) || s.territories[action.t].owner !== p) return prev;
      const n = Math.min(count(action.n), s.reinforcements);
      if (!(n > 0)) return prev;
      s.territories[action.t].armies += n;
      fx(s, { t: 'deploy', at: action.t, n, power: p });
      s.reinforcements -= n;
      if (s.reinforcements === 0) s.phase = 'attack';
      return s;
    }

    case 'attack': {
      if (!validT(action.from) || !validT(action.to) || attackBlocker(s, action.from, action.to)) return prev;
      const def = s.territories[action.to].owner;
      if (def) {
        s.aggression[`${p}>${def}`] = s.round;
        if (hasPact(s, p, def)) breakPact(s, p, def);
        if (!s.turnKeys.includes(`gp>${def}`)) {
          s.turnKeys.push(`gp>${def}`);
          s.powers[p].stats.gpAttacks++;
          if (isDemocracy(p) && isDemocracy(def)) {
            s.turnKeys.push(`dp>${def}`);
            legit(s, p, -8);
            log(s, 'diplo', `Protests at home: ${POWER[p].name}'s public balks at war with a fellow democracy.`, p);
            learn(s, 'democratic-peace');
          }
          for (const y of alliesOf(s, def)) {
            if (y === p || allied(s, y, p) || !s.powers[y].alive) continue;
            if (s.obligations.some((o) => o.ally === y && o.victim === def && o.aggressor === p)) continue;
            s.obligations.push({ ally: y, victim: def, aggressor: p, round: s.round });
            log(s, 'diplo', `${POWER[def].name} invokes its alliance: ${POWER[y].name} must answer on its next turn.`, def);
          }
        }
      }
      strikeCore(s, p, action.to);
      if (isOver(s)) return s;
      let rep: BattleReport;
      let totals = { aLoss: 0, dLoss: 0 };
      const stopAt = Math.max(1, action.stopAt ?? 1);
      do {
        const dice = attackDice(s, action.from, action.to).a;
        rep = resolveRoll(s, action.from, action.to);
        fx(s, { t: 'roll', from: rep.from, to: rep.to, attacker: p, aDice: rep.aDice, dDice: rep.dDice, aLoss: rep.aLoss, dLoss: rep.dLoss, wins: rep.wins });
        totals = { aLoss: totals.aLoss + rep.aLoss, dLoss: totals.dLoss + rep.dLoss };
        if (rep.conquered) {
          conquer(s, rep, dice);
          break;
        }
      } while (action.blitz && s.territories[action.from].armies > stopAt);
      s.lastBattle = { ...rep, ...totals };
      if (!rep.conquered) {
        const who = def ? POWER[def].name : 'the local forces';
        if (action.blitz || rep.aLoss + rep.dLoss > 0)
          log(s, 'war', `${POWER[p].name} attacks ${TERRITORIES[action.to].name}: loses ${totals.aLoss}, ${who} lose ${totals.dLoss}.`, p);
      }
      return s;
    }

    case 'move': {
      const m = s.pendingMove;
      if (!m) return prev;
      const req = count(action.n);
      const n = Math.max(m.min, Math.min(m.max, Number.isNaN(req) ? m.max : req));
      s.territories[m.from].armies -= n;
      s.territories[m.to].armies += n;
      s.pendingMove = null;
      fx(s, { t: 'move', from: m.from, to: m.to, n, fortify: false, power: p });
      return s;
    }

    case 'endAttack': {
      if (s.phase === 'deploy' && s.reinforcements > 0) return prev;
      s.phase = 'fortify';
      return s;
    }

    case 'fortify': {
      if (s.phase === 'deploy' && s.reinforcements > 0) return prev;
      const { from, to } = action;
      if (!validT(from) || !validT(to) || s.territories[from].owner !== p || !reachable(s, from).has(to)) return prev;
      const n = Math.min(count(action.n), s.territories[from].armies - 1);
      if (!(n > 0)) return prev;
      s.territories[from].armies -= n;
      s.territories[to].armies += n;
      fx(s, { t: 'move', from, to, n, fortify: true, power: p });
      nextTurn(s);
      return s;
    }

    case 'endTurn': {
      if (s.phase === 'deploy' && s.reinforcements > 0) return prev;
      nextTurn(s);
      return s;
    }

    case 'play': {
      const card = me.cards[action.card];
      if (!card || (card === 'arms-race' && s.phase !== 'deploy') || s.phase === 'fortify') return prev;
      if (!playCard(s, p, card, action.target)) return prev;
      me.cards.splice(action.card, 1);
      fx(s, { t: 'card', card, power: p, target: action.target });
      learn(s, CARDS[card].concept);
      return s;
    }

    case 'answerObligation': {
      const ob = s.pendingObligation;
      if (!ob) return prev;
      s.pendingObligation = null;
      resolveObligation(s, ob, action.honor);
      s.pendingObligation = s.obligations.find((o) => o.ally === p) ?? null;
      if (!s.pendingObligation) s.offer = pickOfferToPlayer(s);
      return s;
    }

    case 'proposeAlliance': {
      const to = action.to;
      if (p !== s.player || !(to in s.powers) || to === p || !s.powers[to].alive || allied(s, p, to) || s.proposedThisRound.includes(to)) return prev;
      if (alliesOf(s, p).length >= MAX_ALLIANCES) return prev;
      s.proposedThisRound.push(to);
      const verdict = considerAlliance(s, p, to);
      if (verdict.accept) {
        addAlliance(s, p, to);
        log(s, 'diplo', `${POWER[to].name} agrees to a defensive alliance. "${verdict.reason}"`, to);
      } else {
        log(s, 'diplo', `${POWER[to].name} declines an alliance. "${verdict.reason}"`, to);
        fx(s, { t: 'pactRejected', a: p, b: to });
      }
      if (verdict.concept) learn(s, verdict.concept);
      return s;
    }

    case 'propose': {
      const to = action.to;
      if (p !== s.player || !(to in s.powers) || to === p || !s.powers[to].alive || hasPact(s, p, to) || s.proposedThisRound.includes(to)) return prev;
      s.proposedThisRound.push(to);
      const verdict = considerPact(s, p, to);
      if (verdict.accept) {
        addPact(s, p, to);
        log(s, 'diplo', `${POWER[to].name} signs a ${PACT_LENGTH}-round non-aggression pact with you. "${verdict.reason}"`, to);
      } else {
        fx(s, { t: 'pactRejected', a: p, b: to });
        log(s, 'diplo', `${POWER[to].name} rejects your pact. "${verdict.reason}"`, to);
      }
      if (verdict.concept) learn(s, verdict.concept);
      return s;
    }

    case 'answerOffer': {
      const o = s.offer;
      if (!o) return prev;
      s.offer = null;
      if (action.accept && s.powers[o.from].alive) {
        addPact(s, o.from, o.to);
        log(s, 'diplo', `You accept ${POWER[o.from].name}'s offer of a non-aggression pact.`, o.from);
      } else {
        log(s, 'diplo', `You decline ${POWER[o.from].name}'s offer.`, o.from);
      }
      return s;
    }
  }
}

function playCard(s: GameState, p: PowerId, card: string, target?: number | PowerId): boolean {
  const name = POWER[p].name;
  switch (card) {
    case 'arms-race': {
      s.reinforcements += 5;
      const mine = new Set(ownedBy(s, p));
      const responders: string[] = [];
      for (const q of alivePowers(s)) {
        if (q === p) continue;
        const border = ownedBy(s, q).filter((t) => TERRITORIES[t].adj.some((u) => mine.has(u)));
        if (!border.length) continue;
        const t = border.reduce((a, b) => (s.territories[b].armies > s.territories[a].armies ? b : a));
        s.territories[t].armies += 2;
        responders.push(POWER[q].short);
      }
      log(s, 'card', `${name} launches an arms race (+5 armies).${responders.length ? ` ${responders.join(', ')} arm in response.` : ''}`, p);
      return true;
    }
    case 'sanctions': {
      if (typeof target !== 'string' || !(target in s.powers) || target === p || !s.powers[target].alive) return false;
      s.powers[target].incomeMod -= 4;
      log(s, 'card', `${name} imposes sanctions on ${POWER[target].name} (−4 armies next turn).`, p);
      return true;
    }
    case 'coup': {
      if (typeof target !== 'number' || !s.territories[target]) return false;
      const t = s.territories[target];
      const adj = TERRITORIES[target].adj.some((u) => s.territories[u].owner === p);
      if (t.owner || t.armies > 4 || !adj) return false;
      t.owner = p;
      t.armies = Math.max(1, Math.floor(t.armies / 2));
      s.powers[p].reputation = Math.max(0, s.powers[p].reputation - 10);
      log(s, 'card', `A coup in ${TERRITORIES[target].name} installs a government friendly to ${name}.`, p);
      return true;
    }
    case 'proxy-war': {
      if (typeof target !== 'number' || !s.territories[target] || s.territories[target].owner) return false;
      s.territories[target].armies += 4;
      log(s, 'card', `${name} arms ${TERRITORIES[target].name} (+4 armies).`, p);
      return true;
    }
    case 'summit': {
      s.clock = Math.min(MAX_CLOCK, s.clock + 2);
      fx(s, { t: 'clock', minutes: s.clock, delta: 2 });
      s.powers[p].reputation = Math.min(100, s.powers[p].reputation + 10);
      log(s, 'card', `${name} hosts an arms control summit. Doomsday Clock: ${s.clock} minutes.`, p);
      return true;
    }
    case 'carrier': {
      if (s.carrier) return false;
      s.carrier = true;
      log(s, 'card', `${name} deploys a carrier strike group. Defenders roll 1 die this turn.`, p);
      return true;
    }
    case 'blitzkrieg': {
      if (s.blitz) return false;
      s.blitz = true;
      log(s, 'card', `${name} launches a blitzkrieg and wins ties this turn.`, p);
      return true;
    }
    case 'detente': {
      if (typeof target !== 'string' || !(target in s.powers) || target === p || !s.powers[target].alive || hasPact(s, p, target)) return false;
      addPact(s, p, target);
      log(s, 'card', `Détente: ${name} and ${POWER[target].name} sign a non-aggression pact.`, p);
      return true;
    }
    case 'cyber': {
      if (typeof target !== 'string' || !(target in s.powers) || target === p || !s.powers[target].alive) return false;
      const hit = ownedBy(s, target)
        .sort((a, b) => s.territories[b].armies - s.territories[a].armies)
        .slice(0, 2);
      for (const t of hit) s.territories[t].armies = Math.max(1, s.territories[t].armies - 2);
      log(s, 'card', `Wiper malware cripples ${POWER[target].name}'s networks in ${hit.map((t) => TERRITORIES[t].name).join(' and ')}. Nobody claims it.`, p);
      return true;
    }
    case 'drone': {
      if (typeof target !== 'number' || !s.territories[target]) return false;
      const t = s.territories[target];
      if (t.owner === p || !TERRITORIES[target].adj.some((u) => s.territories[u].owner === p)) return false;
      if (t.owner && hasPact(s, p, t.owner)) return false;
      t.armies = Math.max(1, t.armies - 3);
      if (t.owner) {
        s.aggression[`${p}>${t.owner}`] = s.round;
        s.quietRound = false;
      }
      log(s, 'card', `${name}'s drones strike ${TERRITORIES[target].name}.`, p);
      if (t.owner) strikeCore(s, p, target);
      return true;
    }
    case 'energy-cutoff': {
      if (typeof target !== 'string' || !(target in s.powers) || target === p || !s.powers[target].alive) return false;
      if (!assetCount(s, p, 'oil')) return false;
      s.powers[target].incomeMod -= 3;
      legit(s, target, -5);
      log(s, 'card', `${name} cuts off oil and gas to ${POWER[target].name}. Prices soar there (−3 armies next turn, legitimacy −5).`, p);
      return true;
    }
    case 'info-ops': {
      if (typeof target !== 'string' || !(target in s.powers) || target === p || !s.powers[target].alive) return false;
      legit(s, target, isDemocracy(target) ? -12 : -6);
      log(s, 'card', `A disinformation campaign floods ${POWER[target].name}'s feeds. Its legitimacy falls.`, p);
      return true;
    }
  }
  return false;
}

/** Monte Carlo estimate that an all-out attack from `from` takes `to`. */
export function winChance(s: GameState, from: number, to: number, runs = 400): number {
  const att = s.territories[from].owner!;
  const def = s.territories[to].owner;
  const amphibious = isSeaLane(from, to) && att !== 'usa';
  const rusDefense = def === 'rus' && TERRITORIES[to].region === 'hl';
  const tiesToAttacker = s.era === 'offense' || s.blitz;
  let wins = 0;
  for (let r = 0; r < runs; r++) {
    let a = s.territories[from].armies;
    let d = s.territories[to].armies;
    while (a > 1 && d > 0) {
      const na = Math.min(amphibious ? 2 : 3, a - 1);
      const nd = s.carrier ? 1 : Math.min(rusDefense ? 3 : 2, d);
      const ad = Array.from({ length: na }, () => 1 + Math.floor(Math.random() * 6)).sort((x, y) => y - x);
      const dd = Array.from({ length: nd }, () => 1 + Math.floor(Math.random() * 6)).sort((x, y) => y - x);
      if (s.era === 'defense') dd[0] += 1;
      for (let i = 0; i < Math.min(na, nd); i++) {
        if (ad[i] > dd[i] || (ad[i] === dd[i] && tiesToAttacker)) d--;
        else a--;
      }
    }
    if (d <= 0) wins++;
  }
  return wins / runs;
}
