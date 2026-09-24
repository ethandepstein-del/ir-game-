import type { CardDef, CardId } from '../engine/types';

export const CARDS: Record<CardId, CardDef> = {
  'arms-race': {
    id: 'arms-race',
    name: 'Arms Race',
    text: '+5 armies to deploy. Every great power that borders you gets +2 armies on that border.',
    target: 'none',
    concept: 'security-dilemma',
  },
  sanctions: {
    id: 'sanctions',
    name: 'Sanctions',
    text: 'Target power gets 4 fewer armies next turn.',
    target: 'power',
    concept: 'economic-statecraft',
  },
  coup: {
    id: 'coup',
    name: "Coup d'État",
    text: 'Take a neighbouring minor state with 4 or fewer armies. Reputation −10 when it leaks.',
    target: 'neutral-adjacent',
    concept: 'covert-action',
  },
  'proxy-war': {
    id: 'proxy-war',
    name: 'Proxy War',
    text: 'Arm any minor state with +4 armies to block a rival.',
    target: 'neutral',
    concept: 'proxy-war',
  },
  summit: {
    id: 'summit',
    name: 'Arms Control Summit',
    text: 'Doomsday Clock +2 minutes. Reputation +10.',
    target: 'none',
    concept: 'arms-control',
  },
  carrier: {
    id: 'carrier',
    name: 'Carrier Strike Group',
    text: 'For the rest of this turn, defenders you attack roll only 1 die.',
    target: 'none',
    concept: 'sea-power',
  },
  blitzkrieg: {
    id: 'blitzkrieg',
    name: 'Blitzkrieg',
    text: 'For the rest of this turn, you win ties in combat.',
    target: 'none',
    concept: 'offense-defense',
  },
  detente: {
    id: 'detente',
    name: 'Détente',
    text: 'Sign a non-aggression pact with any power. They cannot refuse.',
    target: 'power',
    concept: 'detente',
  },
};

export const DECK: CardId[] = ['arms-race', 'arms-race', 'sanctions', 'coup', 'coup', 'proxy-war', 'summit', 'carrier', 'blitzkrieg', 'detente'];
