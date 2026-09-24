import type { ConceptId } from '../data/concepts';

/** Hidden leader temperament. Maps onto Jervis's deterrence vs. spiral models. */
export type LeaderType = 'opportunist' | 'insecure' | 'pragmatist';

export interface Issue {
  id: string;
  name: string;
  /** One-line explanation shown under the slider. */
  blurb: string;
  /** Label for value 0 (their ideal) and 100 (your ideal). */
  theirEnd: string;
  yourEnd: string;
  /** Human-readable description of a position on this issue. */
  format: (v: number) => string;
}

export interface GameEventOption {
  label: string;
  detail: string;
  effects: Partial<Record<'tension' | 'support' | 'trust' | 'resolve' | 'fear' | 'aspiration', number>>;
  concept?: ConceptId;
  outcome: string;
}

export interface GameEvent {
  id: string;
  title: string;
  body: string;
  options: GameEventOption[];
}

export interface Scenario {
  id: string;
  title: string;
  tagline: string;
  kind: 'territorial' | 'trade' | 'arms';
  difficulty: 1 | 2 | 3;
  briefing: string[];
  you: { country: string; role: string };
  them: { country: string; leader: string; title: string; dossier: string };
  issues: Issue[];
  /** Your priorities (sum to 1). */
  playerWeights: number[];
  /** Baseline hidden priorities for the other side (sum to 1); perturbed per game. */
  oppWeightsBase: number[];
  leaderTypes: LeaderType[];
  rounds: number;
  start: { tension: number; support: number; trust: number };
  /** Utility a deal must reach to pass your legislature when support is 50. */
  ratificationBase: number;
  /** Other side's baseline reservation utility. */
  oppReservationBase: number;
  /** Your value if talks end with no deal. */
  noDealValue: number;
  /** Escalation ladder rungs, low to high. The last rung is the breakdown. */
  ladder: string[];
  breakdown: {
    name: string; // e.g. "War", "Trade War"
    /** Outcome values to you for victory/stalemate/defeat. */
    values: [number, number, number];
    text: [string, string, string];
  };
  /** Does the other side need trust to sign? (commitment problem) */
  trustFloor: number;
  events: GameEvent[];
}

export type Speaker = 'you' | 'them' | 'desk' | 'event';

export interface LogEntry {
  round: number;
  speaker: Speaker;
  text: string;
  concepts?: ConceptId[];
}

export interface Offer {
  from: 'you' | 'them' | 'mediator';
  round: number;
  values: number[];
}

export interface Moment {
  round: number;
  text: string;
  concept: ConceptId;
  tone: 'good' | 'bad' | 'neutral';
}

export interface RedLine {
  issue: number;
  min: number;
}

export type Status = 'playing' | 'deal' | 'breakdown' | 'nodeal' | 'walkout';

export interface OpponentState {
  type: LeaderType;
  weights: number[];
  /** Their belief that you'd really fight / hold out (0–1). */
  perceivedResolve: number;
  /** How threatened they feel (0–1). */
  fear: number;
  /** Additive adjustment to their demands built up by events and actions. */
  demandShift: number;
  standingOffer: number[];
}

export interface GameState {
  scenarioId: string;
  seed: number;
  rng: number;
  round: number;
  tension: number;
  support: number;
  trust: number;
  opp: OpponentState;
  revealed: boolean[];
  typeHinted: boolean;
  redLines: RedLine[];
  mediatorUsed: boolean;
  mobilizations: number;
  offers: Offer[];
  log: LogEntry[];
  moments: Moment[];
  concepts: ConceptId[];
  usedEvents: string[];
  pendingEvent: GameEvent | null;
  status: Status;
  finalDeal: number[] | null;
  breakdownResult: 0 | 1 | 2 | null;
  ratificationFailures: number;
  lastProposalRound: number;
}

export type Action =
  | { kind: 'propose'; values: number[] }
  | { kind: 'ultimatum'; values: number[] }
  | { kind: 'acceptTheirs' }
  | { kind: 'mobilize' }
  | { kind: 'warning' }
  | { kind: 'tieHands'; issue: number; min: number }
  | { kind: 'goodwill' }
  | { kind: 'backchannel' }
  | { kind: 'mediator' }
  | { kind: 'walkout' };
