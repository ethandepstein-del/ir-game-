export type ConceptId =
  | 'bargaining-war'
  | 'batna'
  | 'zopa'
  | 'logrolling'
  | 'costly-signal'
  | 'cheap-talk'
  | 'audience-costs'
  | 'two-level-game'
  | 'spiral-model'
  | 'deterrence-model'
  | 'private-information'
  | 'commitment-problem'
  | 'mediation'
  | 'brinkmanship'
  | 'rally-effect'
  | 'pareto';

export interface Concept {
  id: ConceptId;
  name: string;
  short: string;
  body: string;
  inGame: string;
  reading: string;
}

export const CONCEPTS: Record<ConceptId, Concept> = {
  'bargaining-war': {
    id: 'bargaining-war',
    name: 'The Bargaining Model of War',
    short: 'War is costly, so some deal should always beat fighting.',
    body:
      'Fighting destroys value both sides could have kept. So for rational states there is almost always a range of deals both prefer to war. Wars still happen for three reasons: the two sides hold private information and have incentives to misrepresent it, they cannot credibly commit to keep a deal, or the stakes are hard to divide.',
    inGame:
      'Breakdown is almost always worse for you than a mediocre deal. When talks collapse, ask which of the three causes got you there.',
    reading: 'James Fearon, "Rationalist Explanations for War," International Organization 49:3 (1995).',
  },
  batna: {
    id: 'batna',
    name: 'BATNA',
    short: 'Your Best Alternative To a Negotiated Agreement.',
    body:
      'What each side gets if talks fail sets the floor for any deal it will accept. You gain leverage when your alternative improves, or when the other side comes to believe it has.',
    inGame:
      'Their minimum depends on how they rate their chances if talks fail, and that depends on how resolved they think you are.',
    reading: 'Roger Fisher & William Ury, Getting to Yes (1981).',
  },
  zopa: {
    id: 'zopa',
    name: 'Zone of Possible Agreement',
    short: 'The set of deals both sides prefer to walking away.',
    body:
      'The overlap between each side\'s reservation point is the bargaining range. Neither side can see the other\'s edge of it, so each probes and signals to find where it lies.',
    inGame: 'The debrief chart shades the real ZOPA, which you could not see during play.',
    reading: 'Howard Raiffa, The Art and Science of Negotiation (1982).',
  },
  logrolling: {
    id: 'logrolling',
    name: 'Logrolling & Integrative Bargaining',
    short: 'Trade what you value less for what you value more.',
    body:
      'When sides weigh issues differently, each can concede on what matters little to it and win on what matters most. That creates value instead of just dividing it. Linking issues together turns a zero-sum haggle into a positive-sum package.',
    inGame:
      'Their counteroffers give away the issues they care least about first. Read those moves to work out their priorities.',
    reading: 'Richard Walton & Robert McKersie, A Behavioral Theory of Labor Negotiations (1965); Robert Keohane on issue linkage.',
  },
  'costly-signal': {
    id: 'costly-signal',
    name: 'Costly Signaling',
    short: 'Actions that bluffers could not afford are believed.',
    body:
      'A signal is credible when a weaker or less committed actor would not be willing to pay for it. Mobilizing troops costs money and risks escalation, so it says more than words do.',
    inGame: 'Mobilizing moves their estimate of your resolve far more than a speech does, and it costs you in both money and danger.',
    reading: 'James Fearon, "Signaling Foreign Policy Interests," Journal of Conflict Resolution 41:1 (1997).',
  },
  'cheap-talk': {
    id: 'cheap-talk',
    name: 'Cheap Talk',
    short: 'Costless statements carry little information.',
    body:
      'Anyone can say they will not back down, including those who would. Statements matter mainly when there is already some trust, or when they create costs later on, as audience costs do.',
    inGame: 'A public warning barely moves a counterpart who does not trust you.',
    reading: 'Vincent Crawford & Joel Sobel, "Strategic Information Transmission," Econometrica (1982).',
  },
  'audience-costs': {
    id: 'audience-costs',
    name: 'Audience Costs',
    short: 'Public commitments are credible because backing down hurts at home.',
    body:
      'A leader who publicly draws a line and then retreats pays a domestic price. Making that price visible ties the leader\'s hands, which makes the commitment believable.',
    inGame: 'Drawing a red line strengthens your hand. Sign a deal that crosses it and your legislature will reject it.',
    reading: 'James Fearon, "Domestic Political Audiences and the Escalation of International Disputes," APSR 88:3 (1994).',
  },
  'two-level-game': {
    id: 'two-level-game',
    name: 'Two-Level Games',
    short: 'Every deal must win at the table and at home.',
    body:
      'Negotiators bargain with foreign counterparts (Level I) while also needing ratification from domestic constituencies (Level II). A narrow domestic win-set weakens you at home but can strengthen you abroad: "I can\'t sell that at home."',
    inGame: 'Your deal must clear the ratification line, which rises when your domestic support falls.',
    reading: 'Robert Putnam, "Diplomacy and Domestic Politics: The Logic of Two-Level Games," International Organization 42:3 (1988).',
  },
  'spiral-model': {
    id: 'spiral-model',
    name: 'The Spiral Model',
    short: 'Threats can provoke the insecurity they were meant to deter.',
    body:
      'When the other side is driven by fear, not greed, shows of strength confirm its fears and set off counter-escalation. Reassurance and reciprocity work better than threats. This is the security dilemma played out in a crisis.',
    inGame: 'An insecure leader answers mobilization with mobilization. Goodwill gestures soften them.',
    reading: 'Robert Jervis, Perception and Misperception in International Politics (1976), ch. 3.',
  },
  'deterrence-model': {
    id: 'deterrence-model',
    name: 'The Deterrence Model',
    short: 'Concessions to a greedy adversary invite more demands.',
    body:
      'When the other side is opportunistic, it reads accommodation as weakness and probes further. Firmness and credible threats hold it back. The Munich analogy draws on this model, sometimes wrongly.',
    inGame: 'An opportunist raises their demands after your goodwill gestures and backs down when you show strength.',
    reading: 'Robert Jervis, Perception and Misperception in International Politics (1976), ch. 3.',
  },
  'private-information': {
    id: 'private-information',
    name: 'Private Information',
    short: 'Each side knows things the other cannot see.',
    body:
      'Resolve, capabilities and priorities are hidden, and each side has reasons to exaggerate. Intelligence and back channels narrow the gap, which makes a deal more likely.',
    inGame: 'Back channels reveal what they care about. Everything else you infer from their behavior.',
    reading: 'James Fearon (1995); Robert Jervis, The Logic of Images in International Relations (1970).',
  },
  'commitment-problem': {
    id: 'commitment-problem',
    name: 'The Commitment Problem',
    short: 'A deal is worthless if one side expects the other to renege.',
    body:
      'Without a world government to enforce agreements, a state may refuse a good deal because it fears the other side will break it later. Verification, phased implementation and trust-building address this.',
    inGame: 'In arms talks they will not sign anything, however generous, until trust clears a threshold.',
    reading: 'James Fearon (1995); Robert Powell, "War as a Commitment Problem," International Organization 60:1 (2006).',
  },
  mediation: {
    id: 'mediation',
    name: 'Third-Party Mediation',
    short: 'Outsiders can surface solutions and cool tempers.',
    body:
      'Mediators pass information between the parties, suggest focal-point solutions and give leaders political cover to concede. How well it works depends on the mediator\'s leverage and on whether the parties see it as impartial.',
    inGame: 'The mediator proposes a package close to the efficient split, based on information you do not have.',
    reading: 'Andrew Kydd, "Which Side Are You On? Bias, Credibility, and Mediation," AJPS 47:4 (2003).',
  },
  brinkmanship: {
    id: 'brinkmanship',
    name: 'Brinkmanship',
    short: 'The threat that leaves something to chance.',
    body:
      'Raising a shared risk of disaster that neither side fully controls can force the other to yield. It can also go over the edge by accident.',
    inGame: 'Above the danger line on the escalation ladder, each round carries a chance of an incident neither side intended.',
    reading: 'Thomas Schelling, The Strategy of Conflict (1960) and Arms and Influence (1966).',
  },
  'rally-effect': {
    id: 'rally-effect',
    name: 'Rally-Round-the-Flag',
    short: 'External threats briefly boost domestic support.',
    body:
      'Crises and shows of strength often lift a leader\'s approval for a while, which can tempt leaders to escalate. The effect usually fades quickly.',
    inGame: 'Mobilizing lifts your support at home. Conciliatory moves can make you look weak to hardliners.',
    reading: 'John Mueller, War, Presidents and Public Opinion (1973).',
  },
  pareto: {
    id: 'pareto',
    name: 'Pareto Efficiency',
    short: 'A deal is efficient if no one can gain without someone losing.',
    body:
      'Many agreements leave joint gains unclaimed. A different package could have made both sides better off. The Pareto frontier marks the set of deals that leave nothing on the table.',
    inGame: 'The debrief shows how far your deal was from the frontier: value you could have claimed without costing them anything.',
    reading: 'Howard Raiffa, The Art and Science of Negotiation (1982).',
  },
};

export const CONCEPT_ORDER = Object.keys(CONCEPTS) as ConceptId[];
