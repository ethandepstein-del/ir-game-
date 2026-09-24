import type { ConceptId } from './concepts';
import type { Doctrine } from '../engine/types';

export interface DoctrineDef {
  id: Doctrine;
  name: string;
  short: string;
  thinker: string;
  summary: string;
  /** What to watch for at the table. */
  tells: string;
  concept: ConceptId;
}

export const DOCTRINES: Record<Doctrine, DoctrineDef> = {
  offensive: {
    id: 'offensive',
    name: 'Offensive realist',
    short: 'Offensive',
    thinker: 'Mearsheimer',
    summary: 'Security comes only from maximizing relative power, so it expands whenever the odds allow.',
    tells: 'Attacks great powers at modest odds, rarely signs pacts, and will betray one for a big enough prize.',
    concept: 'offensive-realism',
  },
  defensive: {
    id: 'defensive',
    name: 'Defensive realist',
    short: 'Defensive',
    thinker: 'Waltz · Jervis',
    summary: 'Seeks enough power to be secure, not domination. Expansion provokes balancing, so it holds back.',
    tells: 'Takes buffer zones and minor states, fortifies borders, balances hard against the leader, retaliates when struck.',
    concept: 'defensive-realism',
  },
  liberal: {
    id: 'liberal',
    name: 'Liberal institutionalist',
    short: 'Liberal',
    thinker: 'Keohane · Nye',
    summary: 'Cooperation pays under anarchy if commitments are credible, so it invests in pacts and alliances.',
    tells: 'Signs and keeps agreements, honors its allies, cares about reputation, fights mostly when attacked.',
    concept: 'institutions',
  },
  revisionist: {
    id: 'revisionist',
    name: 'Revisionist',
    short: 'Revisionist',
    thinker: 'Schweller · Organski',
    summary: 'Dissatisfied with the order itself, it targets whoever leads the system and accepts high risk.',
    tells: 'Goes after the strongest power and capitals, tolerates a low Doomsday Clock, breaks pacts when convenient.',
    concept: 'revisionism',
  },
};

export const DOCTRINE_ORDER: Doctrine[] = ['offensive', 'defensive', 'liberal', 'revisionist'];
