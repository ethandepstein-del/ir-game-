import { TERRITORY_DEFS } from './map.generated';

export type PowerId = 'usa' | 'eu' | 'rus' | 'chn' | 'ind';

export interface Region {
  id: string;
  name: string;
  bonus: number;
}

export const REGIONS: Region[] = [
  { id: 'na', name: 'North America', bonus: 5 },
  { id: 'sa', name: 'South America', bonus: 2 },
  { id: 'eu', name: 'Europe', bonus: 5 },
  { id: 'hl', name: 'The Heartland', bonus: 5 },
  { id: 'me', name: 'Middle East', bonus: 4 },
  { id: 'af', name: 'Africa', bonus: 3 },
  { id: 'sa2', name: 'South Asia', bonus: 3 },
  { id: 'ea', name: 'East Asia', bonus: 5 },
  { id: 'sea', name: 'Southeast Asia', bonus: 2 },
  { id: 'oc', name: 'Oceania', bonus: 2 },
];

export const TERRITORIES = TERRITORY_DEFS.map((t, i) => ({ ...t, index: i }));
export const T = (id: string): number => {
  const i = TERRITORIES.findIndex((t) => t.id === id);
  if (i < 0) throw new Error(`Unknown territory ${id}`);
  return i;
};
export const REGION_MEMBERS: Record<string, number[]> = Object.fromEntries(
  REGIONS.map((r) => [r.id, TERRITORIES.filter((t) => t.region === r.id).map((t) => t.index)]),
);

export interface PowerDef {
  id: PowerId;
  name: string;
  short: string;
  color: string;
  core: string[];
  capital: string;
  doctrine: string;
  doctrineText: string;
  regime: 'democracy' | 'autocracy';
}

export const POWERS: PowerDef[] = [
  {
    id: 'usa',
    regime: 'democracy',
    name: 'United States',
    short: 'USA',
    color: '#1f5fbf',
    core: ['us-east', 'us-west', 'alaska'],
    capital: 'us-east',
    doctrine: 'Command of the Commons',
    doctrineText: 'You attack across sea lanes at full strength. Everyone else rolls at most 2 dice when attacking across water.',
  },
  {
    id: 'eu',
    regime: 'democracy',
    name: 'European Union',
    short: 'EU',
    color: '#e0a800',
    core: ['france', 'germany', 'italy'],
    capital: 'france',
    doctrine: 'Institutions',
    doctrineText: '+1 army per turn for each active pact (up to +3). Other powers are more willing to sign pacts with you.',
  },
  {
    id: 'rus',
    regime: 'autocracy',
    name: 'Russia',
    short: 'RUS',
    color: '#c42e2e',
    core: ['moscow', 'urals', 'siberia', 'far-east'],
    capital: 'moscow',
    doctrine: 'Defense in Depth',
    doctrineText: 'You start with four territories and defend with 3 dice anywhere in the Heartland. Invaders have learned this the hard way.',
  },
  {
    id: 'chn',
    regime: 'autocracy',
    name: 'China',
    short: 'CHN',
    color: '#6b3fa0',
    core: ['north-china', 'south-china', 'west-china'],
    capital: 'north-china',
    doctrine: 'Rising Power',
    doctrineText: 'Your economy compounds: +1 army per turn for every 4 rounds played (up to +4).',
  },
  {
    id: 'ind',
    regime: 'democracy',
    name: 'India',
    short: 'IND',
    color: '#16875a',
    core: ['hindustan', 'ganges', 'deccan'],
    capital: 'hindustan',
    doctrine: 'Strategic Autonomy',
    doctrineText: '+1 army per turn. Everyone is more willing to sign pacts with you, including powers that are balancing against the leader.',
  },
];

export const POWER: Record<PowerId, PowerDef> = Object.fromEntries(POWERS.map((p) => [p.id, p])) as Record<PowerId, PowerDef>;

/** Middle powers start stronger than other minor states. */
export const MIDDLE_POWERS: Record<string, number> = {
  uk: 3, japan: 3, brazil: 3, 'canada-w': 2, 'central-am': 2, 'gran-colombia': 2, 'southern-cone': 2, andes: 1, anatolia: 2, persia: 2, korea: 2, 'aus-e': 2, arabia: 1, 'canada-e': 3, mexico: 3, 'southern-africa': 1, egypt: 1, 'eastern-eu': 1, 'central-eu': 1, indonesia: 1, pakistan: 2, taiwan: 2,
};

/** Hold this many territories at the end of your turn to win outright. */
export const HEGEMONY = 26;
export const MAX_ROUNDS = 20;
export const PACT_LENGTH = 5;
export const START_CLOCK = 6;
export const MAX_CLOCK = 9;

export const MAX_ALLIANCES = 2;
