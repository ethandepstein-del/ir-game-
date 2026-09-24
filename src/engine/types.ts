import type { ConceptId } from '../data/concepts';
import type { PowerId } from '../data/world';

export type { PowerId };
export type Owner = PowerId | null;

export type CardId = 'arms-race' | 'sanctions' | 'coup' | 'proxy-war' | 'summit' | 'carrier' | 'blitzkrieg' | 'detente';
export type CardTarget = 'none' | 'power' | 'neutral-adjacent' | 'neutral';

export interface CardDef {
  id: CardId;
  name: string;
  text: string;
  target: CardTarget;
  concept: ConceptId;
}

export type Era = 'balanced' | 'defense' | 'offense';
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
}

export interface Pact {
  a: PowerId;
  b: PowerId;
  until: number;
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
  | { kind: 'answerOffer'; accept: boolean };
