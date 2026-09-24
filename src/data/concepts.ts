export type ConceptId =
  | 'anarchy'
  | 'balancing'
  | 'bandwagoning'
  | 'security-dilemma'
  | 'offense-defense'
  | 'mad'
  | 'stability-instability'
  | 'heartland'
  | 'sea-power'
  | 'reputation'
  | 'power-transition'
  | 'polarity'
  | 'economic-statecraft'
  | 'covert-action'
  | 'proxy-war'
  | 'arms-control'
  | 'detente'
  | 'institutions'
  | 'hegemony';

export interface Concept {
  name: string;
  /** One line shown in the in-game dispatch. */
  dispatch: string;
  body: string;
  reading: string;
}

export const CONCEPTS: Record<ConceptId, Concept> = {
  anarchy: {
    name: 'Anarchy',
    dispatch: 'There is no world government. Nobody will save you but you.',
    body: 'In IR, "anarchy" does not mean chaos. It means there is no authority above states to enforce rules or protect the weak. Realists argue this forces states into self-help: each must look after its own security, which is why power matters so much.',
    reading: 'Kenneth Waltz, Theory of International Politics (1979), ch. 6.',
  },
  balancing: {
    name: 'Balance of Power',
    dispatch: 'When one power grows too strong, the others band together against it.',
    body: 'Neorealists predict that states balance against concentrations of power. They do it by arming themselves (internal balancing) or by allying with others (external balancing). This is why would-be hegemons, from Napoleon to Hitler, have repeatedly faced grand coalitions.',
    reading: 'Kenneth Waltz, Theory of International Politics (1979); Stephen Walt, The Origins of Alliances (1987).',
  },
  bandwagoning: {
    name: 'Bandwagoning',
    dispatch: 'Weak states sometimes side with the strongest power instead of opposing it.',
    body: 'Instead of balancing, a small or exposed state may join the rising power, either to avoid being attacked or to share in the spoils. Walt argues this is rarer than balancing and more common among weak states that have no allies to turn to.',
    reading: 'Stephen Walt, The Origins of Alliances (1987); Randall Schweller, "Bandwagoning for Profit" (1994).',
  },
  'security-dilemma': {
    name: 'The Security Dilemma',
    dispatch: 'Your defensive build-up looks like a threat to your neighbors, and they arm in response.',
    body: 'Measures a state takes to make itself secure often make others less secure, and their responses leave everyone worse off. The dilemma is sharpest when offensive and defensive weapons look alike.',
    reading: 'John Herz, "Idealist Internationalism and the Security Dilemma" (1950); Robert Jervis, "Cooperation Under the Security Dilemma" (1978).',
  },
  'offense-defense': {
    name: 'Offense–Defense Balance',
    dispatch: 'Military technology decides whether attacking or defending is easier, and that changes everything.',
    body: 'When defense has the advantage, as with trenches and machine guns, conquest is costly and the world is more stable. When offense has the advantage, as with blitzkrieg, states are tempted to strike first. Leaders who misjudge the balance, like the "cult of the offensive" in 1914, can walk into catastrophe.',
    reading: 'Robert Jervis (1978); Stephen Van Evera, "The Cult of the Offensive and the Origins of the First World War" (1984).',
  },
  mad: {
    name: 'Mutually Assured Destruction',
    dispatch: 'Attacking a great power\'s homeland moves the Doomsday Clock. At midnight, everyone loses.',
    body: 'Nuclear weapons make total war between great powers suicidal, because each side can destroy the other even after being struck first. The result is a peace built on shared vulnerability. The danger lies in crises that escalate beyond anyone\'s control.',
    reading: 'Bernard Brodie, The Absolute Weapon (1946); Thomas Schelling, Arms and Influence (1966).',
  },
  'stability-instability': {
    name: 'Stability–Instability Paradox',
    dispatch: 'Nuclear stability between the great powers makes smaller wars on the periphery more likely.',
    body: 'Because all-out war is unthinkable, great powers feel freer to fight limited and proxy wars in the periphery, confident that neither side will escalate. The Cold War\'s "long peace" in Europe coexisted with wars in Korea, Vietnam, Angola and Afghanistan.',
    reading: 'Glenn Snyder, "The Balance of Power and the Balance of Terror" (1965).',
  },
  heartland: {
    name: 'The Heartland Theory',
    dispatch: '"Who rules the Heartland commands the World-Island." (Mackinder)',
    body: 'Halford Mackinder argued in 1904 that the vast, sea-inaccessible interior of Eurasia was the pivot of world politics. A land power that controlled it could not be reached by sea power and could dominate Eurasia. The theory shaped a century of containment strategy.',
    reading: 'Halford Mackinder, "The Geographical Pivot of History" (1904); Nicholas Spykman, The Geography of the Peace (1944).',
  },
  'sea-power': {
    name: 'Sea Power',
    dispatch: 'Amphibious assaults are hard. Command of the sea lanes changes that.',
    body: 'Alfred Thayer Mahan argued that control of the seas, meaning trade routes, chokepoints and naval bases, was the foundation of great power. Barry Posen later described US "command of the commons" (sea, air and space) as the military basis of its hegemony.',
    reading: 'A. T. Mahan, The Influence of Sea Power upon History (1890); Barry Posen, "Command of the Commons" (2003).',
  },
  reputation: {
    name: 'Reputation & Credibility',
    dispatch: 'You broke a pact. Everyone saw it, and your word is now worth less.',
    body: 'Can states build a reputation for keeping or breaking commitments? Some scholars argue that past behavior shapes how others judge a state\'s promises and threats. Others, like Press, find that leaders judge credibility mostly by current power and interests. In this game, reputation matters.',
    reading: 'Jonathan Mercer, Reputation and International Politics (1996); Daryl Press, Calculating Credibility (2005).',
  },
  'power-transition': {
    name: 'Power Transition',
    dispatch: 'The top power has changed. Transitions are the most dangerous moments in world politics.',
    body: 'Power transition theory holds that war is most likely when a dissatisfied rising power catches up to the dominant one. The "Thucydides Trap" debate applies this to US–China relations.',
    reading: 'A. F. K. Organski, World Politics (1958); Graham Allison, Destined for War (2017).',
  },
  polarity: {
    name: 'Polarity',
    dispatch: 'The distribution of power, whether unipolar, bipolar or multipolar, shapes how the system behaves.',
    body: 'Waltz argued that bipolar systems are the most stable, because the two superpowers watch each other closely and responsibility is clear. Multipolar systems breed miscalculation and chain-ganging alliances. Others argue that unipolarity is the most peaceful of all.',
    reading: 'Kenneth Waltz, "The Stability of a Bipolar World" (1964); William Wohlforth, "The Stability of a Unipolar World" (1999).',
  },
  'economic-statecraft': {
    name: 'Economic Statecraft',
    dispatch: 'Sanctions trade your economic weight for political leverage, and rarely achieve as much as hoped.',
    body: 'States use trade, finance and aid as instruments of power. Sanctions can impose real costs, but studies find they rarely force a target to change major policies, especially when the target is a great power.',
    reading: 'David Baldwin, Economic Statecraft (1985); Robert Pape, "Why Economic Sanctions Do Not Work" (1997).',
  },
  'covert-action': {
    name: 'Covert Action',
    dispatch: 'Regime change on the cheap, until it is exposed.',
    body: 'States often intervene secretly to topple foreign governments, from Iran in 1953 to Guatemala in 1954 and beyond. Covert action lets leaders act while avoiding escalation and domestic scrutiny. The long-run consequences are often poor.',
    reading: 'Lindsey O\'Rourke, Covert Regime Change (2018); Austin Carson, Secret Wars (2018).',
  },
  'proxy-war': {
    name: 'Proxy War',
    dispatch: 'Arm a minor state to bleed your rival without fighting it yourself.',
    body: 'Great powers often back local actors instead of fighting directly. This lets them contest influence while keeping the risk of direct great-power war low. Proxy wars were the main battleground of the Cold War.',
    reading: 'Andrew Mumford, Proxy Warfare (2013).',
  },
  'arms-control': {
    name: 'Arms Control',
    dispatch: 'Even rivals can agree to limit the most dangerous weapons.',
    body: 'Arms control treaties reduce the risk and cost of competition without ending the rivalry. SALT, the INF Treaty and New START made the balance of terror more predictable, and verification made the agreements credible.',
    reading: 'Thomas Schelling & Morton Halperin, Strategy and Arms Control (1961).',
  },
  detente: {
    name: 'Détente',
    dispatch: 'A deliberate easing of tensions between rivals.',
    body: 'In the 1970s, the US and the Soviet Union pursued détente: summits, arms control and trade, without giving up their rivalry. Critics said it rewarded the other side. Supporters said it made the Cold War safer.',
    reading: 'Raymond Garthoff, Détente and Confrontation (1985).',
  },
  institutions: {
    name: 'Neoliberal Institutionalism',
    dispatch: 'Institutions make cooperation pay by lowering costs and making promises credible.',
    body: 'Liberal institutionalists argue that even under anarchy, states cooperate when institutions reduce transaction costs, share information and extend "the shadow of the future". Cooperation is hard but not impossible.',
    reading: 'Robert Keohane, After Hegemony (1984); Robert Axelrod, The Evolution of Cooperation (1984).',
  },
  hegemony: {
    name: 'Hegemony',
    dispatch: 'One power now dominates the system.',
    body: 'Hegemonic stability theory argues that a single dominant power can provide order: open trade, a reserve currency, security guarantees. Realists warn that hegemons provoke balancing and overextend themselves.',
    reading: 'Robert Gilpin, War and Change in World Politics (1981); Paul Kennedy, The Rise and Fall of the Great Powers (1987).',
  },
};

export const CONCEPT_ORDER = Object.keys(CONCEPTS) as ConceptId[];
