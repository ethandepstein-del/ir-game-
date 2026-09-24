import type { ConceptId } from '../data/concepts';
import type { PowerId } from '../data/world';

export type { PowerId };
export type Owner = PowerId | null;

export type CardId =
  | 'arms-race'
  | 'sanctions'
  | 'coup'
  | 'proxy-war'
  | 'summit'
  | 'carrier'
  | 'blitzkrieg'
  | 'detente'
  | 'cyber'
  | 'drone'
  | 'energy-cutoff'
  | 'info-ops';
export type CardTarget = 'none' | 'power' | 'neutral-adjacent' | 'neutral' | 'enemy-adjacent';

export interface CardDef {
  id: CardId;
  name: string;
  text: string;
  target: CardTarget;
  concept: ConceptId;
}

export type Era = 'balanced' | 'defense' | 'offense';
/** Hidden grand strategy each AI follows. */
export type Doctrine = 'offensive' | 'defensive' | 'liberal' | 'revisionist';
export type Phase = 'deploy' | 'attack' | 'fortify';

export interface TerritoryState {
  owner: Owner;
  armies: number;
}

export interface PowerState {
  id: PowerId;
  alive: boolean;
  cards: CardId[];
  reputation: number;
  /** One-off modifier to next income (sanctions, events). */
  incomeMod: number;
  conquered: number;
  doctrine: Doctrine;
  /** Domestic legitimacy, 0–100. */
  legitimacy: number;
  /** Armies lost in battle this round (war weariness). */
  bled: number;
  stats: { gpAttacks: number; pacts: number; betrayals: number; honored: number; abandoned: number };
}

export interface Pact {
  a: PowerId;
  b: PowerId;
  until: number;
  kind: 'nap' | 'alliance';
}

/** An ally was attacked; `ally` must honor or abandon the alliance on its next turn. */
export interface Obligation {
  ally: PowerId;
  victim: PowerId;
  aggressor: PowerId;
  round: number;
}

export interface BattleReport {
  from: number;
  to: number;
  attacker: PowerId;
  defender: Owner;
  aDice: number[];
  dDice: number[];
  aLoss: number;
  dLoss: number;
  conquered: boolean;
  /** For each compared die pair, did the attacker win it? */
  wins: boolean[];
}

export type LogKind = 'info' | 'war' | 'diplo' | 'alert' | 'card';
export interface LogEntry {
  round: number;
  power: PowerId | null;
  kind: LogKind;
  text: string;
}

export interface Offer {
  from: PowerId;
  to: PowerId;
}

/** Structured events emitted by each action, consumed by animation and sound. */
export type FxEvent =
  | { t: 'deploy'; at: number; n: number; power: PowerId }
  | { t: 'roll'; from: number; to: number; attacker: PowerId; aDice: number[]; dDice: number[]; aLoss: number; dLoss: number; wins: boolean[] }
  | { t: 'conquer'; at: number; from: number; power: PowerId; loser: Owner }
  | { t: 'move'; from: number; to: number; n: number; fortify: boolean; power: PowerId }
  | { t: 'clock'; minutes: number; delta: number }
  | { t: 'capital'; at: number; power: PowerId }
  | { t: 'eliminated'; power: PowerId; by: PowerId }
  | { t: 'coalition'; against: PowerId }
  | { t: 'coalitionEnd' }
  | { t: 'bandwagon'; power: PowerId; leader: PowerId }
  | { t: 'transition'; power: PowerId }
  | { t: 'era'; era: Era }
  | { t: 'world'; kind: 'financial' | 'oil' | 'nationalism' | 'talks' | 'pandemic' | 'grain' }
  | { t: 'base'; at: number; power: PowerId; by: PowerId; name: string }
  | { t: 'chipShock'; at: number; by: PowerId }
  | { t: 'card'; card: CardId; power: PowerId; target?: number | PowerId }
  | { t: 'pact'; a: PowerId; b: PowerId }
  | { t: 'alliance'; a: PowerId; b: PowerId }
  | { t: 'obligation'; ally: PowerId; victim: PowerId; aggressor: PowerId; honored: boolean }
  | { t: 'pactBroken'; a: PowerId; b: PowerId }
  | { t: 'pactRejected'; a: PowerId; b: PowerId }
  | { t: 'turn'; power: PowerId; round: number }
  | { t: 'end'; winner: PowerId | null; reason: NonNullable<GameState['endReason']> };

export interface GameState {
  seed: number;
  rng: number;
  round: number;
  order: PowerId[];
  turn: number;
  player: PowerId;
  phase: Phase;
  reinforcements: number;
  territories: TerritoryState[];
  powers: Record<PowerId, PowerState>;
  pacts: Pact[];
  clock: number;
  quietRound: boolean;
  era: Era;
  coalition: PowerId | null;
  leader: PowerId | null;
  log: LogEntry[];
  lastBattle: BattleReport | null;
  pendingMove: { from: number; to: number; min: number; max: number } | null;
  fortified: boolean;
  coreStrikes: string[];
  blitz: boolean;
  carrier: boolean;
  proposedThisRound: PowerId[];
  offer: Offer | null;
  winner: PowerId | null;
  endReason: 'hegemony' | 'score' | 'nuclear' | 'eliminated' | 'last-standing' | null;
  learned: ConceptId[];
  /** Concepts triggered but not yet shown as dispatches. */
  dispatches: ConceptId[];
  history: { round: number; share: Record<PowerId, number> }[];
  /** Events produced by the most recent action. */
  fx: FxEvent[];
  /** Round in which `a` last attacked `b`, keyed "a>b". */
  aggression: Record<string, number>;
  obligations: Obligation[];
  /** The player's obligation awaiting an answer. */
  pendingObligation: Obligation | null;
  /** Per-turn keys so a penalty or rally applies once per target. */
  turnKeys: string[];
  /** The player's guesses at each rival's doctrine. */
  guesses: Partial<Record<PowerId, Doctrine>>;
  /** Overseas bases still standing: [territory, power, name]. */
  bases: [number, PowerId, string][];
  /** Territories whose chip fabs were wrecked in an invasion. */
  wrecked: number[];
}

export type Action =
  | { kind: 'deploy'; t: number; n: number }
  | { kind: 'attack'; from: number; to: number; blitz: boolean; stopAt?: number }
  | { kind: 'move'; n: number }
  | { kind: 'endAttack' }
  | { kind: 'fortify'; from: number; to: number; n: number }
  | { kind: 'endTurn' }
  | { kind: 'play'; card: number; target?: number | PowerId }
  | { kind: 'propose'; to: PowerId }
  | { kind: 'proposeAlliance'; to: PowerId }
  | { kind: 'answerObligation'; honor: boolean }
  | { kind: 'guess'; power: PowerId; doctrine: Doctrine | null }
  | { kind: 'answerOffer'; accept: boolean };
