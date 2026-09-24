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
  | 'hegemony'
  | 'offensive-realism'
  | 'defensive-realism'
  | 'revisionism'
  | 'collective-defense'
  | 'chain-ganging'
  | 'buck-passing'
  | 'democratic-peace'
  | 'audience-costs'
  | 'diversionary-war'
  | 'public-opinion'
  | 'chokepoints'
  | 'energy-security'
  | 'weaponized-interdependence'
  | 'tripwire'
  | 'grey-zone'
  | 'food-security';

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
  'offensive-realism': {
    name: 'Offensive Realism',
    dispatch: 'Great powers maximize relative power, because under anarchy you can never be sure you have enough.',
    body: 'John Mearsheimer argues that uncertainty about others\' intentions drives great powers to seek hegemony whenever the opportunity arises. Status quo powers are rare, and every great power is a potential revisionist.',
    reading: 'John Mearsheimer, The Tragedy of Great Power Politics (2001).',
  },
  'defensive-realism': {
    name: 'Defensive Realism',
    dispatch: 'Expansion usually backfires, so sensible states seek security, not domination.',
    body: 'Defensive realists hold that the system punishes aggression: expansion triggers balancing, and defense is often easier than offense. States should aim for an appropriate amount of power, and overexpansion comes from domestic pathologies, not systemic logic.',
    reading: 'Kenneth Waltz, Theory of International Politics (1979); Jack Snyder, Myths of Empire (1991); Charles Glaser, Rational Theory of International Politics (2010).',
  },
  revisionism: {
    name: 'Revisionist vs. Status Quo Powers',
    dispatch: 'Some states want security. Others want to change the rules of the system itself.',
    body: 'Randall Schweller argues that realism went wrong by assuming all states are security-seekers. Revisionist states value what they could gain more than what they already have, and are willing to take risks to overturn the order. Power transition theory expects them to challenge a declining leader.',
    reading: 'Randall Schweller, "Neorealism\'s Status-Quo Bias" (1996); A. F. K. Organski, World Politics (1958).',
  },
  'collective-defense': {
    name: 'Alliances & Collective Defense',
    dispatch: 'An ally next door makes an attack costlier, provided the promise to help is believed.',
    body: 'Alliances aggregate capabilities and deter attack, but only if commitments are credible. States ally mainly against threats, weighing power, proximity, offensive capability and perceived intentions (Walt\'s balance of threat), rather than against power alone.',
    reading: 'Stephen Walt, The Origins of Alliances (1987); Glenn Snyder, Alliance Politics (1997).',
  },
  'chain-ganging': {
    name: 'Chain-Ganging',
    dispatch: 'You honored an alliance, and it dragged you into a war with a stronger power.',
    body: 'In multipolar systems with tight alliances, states can be chained to reckless allies. 1914 is the classic case: each power felt it could not let its partner be defeated. The alliance security dilemma is choosing between entrapment in an ally\'s war and abandonment by the ally.',
    reading: 'Thomas Christensen & Jack Snyder, "Chain Gangs and Passed Bucks" (1990); Glenn Snyder, "The Security Dilemma in Alliance Politics" (1984).',
  },
  'buck-passing': {
    name: 'Buck-Passing',
    dispatch: 'You left your ally to fend for itself and let someone else pay the cost of balancing.',
    body: 'When defense looks easy, states may pass the buck: stay out and let others check an aggressor. The 1930s are the classic case, when Britain, France and the USSR each hoped another would stop Germany. Abandoned allies remember.',
    reading: 'Thomas Christensen & Jack Snyder, "Chain Gangs and Passed Bucks" (1990); John Mearsheimer, The Tragedy of Great Power Politics, ch. 8.',
  },
  'democratic-peace': {
    name: 'The Democratic Peace',
    dispatch: 'Democracies rarely fight each other, and their publics punish leaders who try.',
    body: 'Established democracies have almost never fought wars with one another. Explanations include shared norms of peaceful dispute resolution, institutional constraints on leaders, and the transparency that makes threats and commitments credible. Critics question the definitions and the causal story.',
    reading: 'Michael Doyle, "Kant, Liberal Legacies, and Foreign Affairs" (1983); Bruce Russett, Grasping the Democratic Peace (1993); Sebastian Rosato, "The Flawed Logic of Democratic Peace Theory" (2003).',
  },
  'audience-costs': {
    name: 'Audience Costs',
    dispatch: 'Leaders who break public commitments pay for it at home, which is what makes their commitments believable.',
    body: 'Democratic leaders who make threats or promises and then back down face punishment from domestic audiences. That cost is what makes their commitments credible abroad. Autocrats face audience costs too, but usually from elites rather than voters.',
    reading: 'James Fearon, "Domestic Political Audiences and the Escalation of International Disputes" (1994); Jessica Weeks, "Autocratic Audience Costs" (2008).',
  },
  'diversionary-war': {
    name: 'Diversionary War',
    dispatch: 'A regime in trouble at home looks for a victory abroad.',
    body: 'Leaders facing domestic unrest may start foreign conflicts to rally support and distract the public. The evidence is mixed. The Falklands war (1982) is the textbook case, but many embattled regimes avoid war precisely because they are weak.',
    reading: 'Jack Levy, "The Diversionary Theory of War" (1989); Amy Oakes, Diversionary War (2012).',
  },
  'public-opinion': {
    name: 'Rally & War Weariness',
    dispatch: 'An attack on the homeland rallies the public, but mounting losses wear democracies down.',
    body: 'External attacks briefly boost support for leaders (the rally-round-the-flag effect), but public support for war falls as casualties mount. Democracies are generally more casualty-sensitive than autocracies.',
    reading: 'John Mueller, War, Presidents and Public Opinion (1973); Christopher Gelpi, Peter Feaver & Jason Reifler, Paying the Human Costs of War (2009).',
  },
  chokepoints: {
    name: 'Chokepoints & Sea Control',
    dispatch: 'Whoever holds the narrow straits holds the world’s trade by the throat.',
    body: 'Most seaborne trade and energy squeezes through a handful of straits: Hormuz, Malacca, Suez, Bab-el-Mandeb, the Turkish Straits, Panama. Naval strategists from Mahan to Corbett argued that controlling these points, rather than every stretch of ocean, is what sea power means in practice. The Houthi attacks on Red Sea shipping from 2023 showed how even a weak actor can hold a chokepoint hostage.',
    reading: 'Alfred Thayer Mahan, The Influence of Sea Power upon History (1890); Julian Corbett, Some Principles of Maritime Strategy (1911); Rockford Weitz et al., chokepoint studies at the Fletcher School.',
  },
  'energy-security': {
    name: 'Energy Security',
    dispatch: 'Oil and gas are power: those who sell them can cut them off, and those who buy them are exposed.',
    body: 'Energy security is the reliable supply of energy at an affordable price. Exporters can turn supplies into leverage, as the Arab oil embargo of 1973 and Russia’s gas cut-offs to Europe in 2022 showed; importers respond by diversifying suppliers, building stockpiles and switching fuels. Resource wealth can also be a curse, feeding corruption and conflict at home.',
    reading: 'Daniel Yergin, The Prize (1991) and The New Map (2020); Michael Ross, The Oil Curse (2012).',
  },
  'weaponized-interdependence': {
    name: 'Weaponized Interdependence',
    dispatch: 'Global supply chains run through a few hubs, and whoever controls a hub can squeeze everyone else.',
    body: 'Globalization did not spread power evenly: networks such as finance, the internet and chip manufacturing converge on a few hubs. States that control those hubs can watch and choke off others, as the US did with export controls on advanced chips to China from 2022. Taiwan’s dominance of advanced chipmaking is sometimes called a “silicon shield”: invading it would wreck the fabs everyone depends on.',
    reading: 'Henry Farrell & Abraham Newman, "Weaponized Interdependence" (2019) and Underground Empire (2023); Chris Miller, Chip War (2022).',
  },
  tripwire: {
    name: 'Tripwire Forces',
    dispatch: 'A small garrison abroad cannot win a war, but attacking it guarantees a much bigger one.',
    body: 'Great powers station troops in allies’ territory not to hold the line alone but to make their commitment credible: an attack on the garrison automatically involves the home country. Thomas Schelling called this “the threat that leaves something to chance”. US troops in South Korea, NATO’s battlegroups in the Baltic states and the old Berlin Brigade are classic tripwires.',
    reading: 'Thomas Schelling, Arms and Influence (1966); Dan Reiter & Paul Poast, "The Truth about Tripwires" (2021).',
  },
  'grey-zone': {
    name: 'Grey-Zone Conflict',
    dispatch: 'Cyber attacks, drones and disinformation: coercion that stays below the threshold of open war.',
    body: 'States increasingly compete in the space between peace and war: cyber operations like NotPetya (2017), election interference, militias and “little green men”, and cheap drones. Deniability and ambiguity make retaliation hard to justify, while cheap precision strikes are changing the balance between offense and defense, as the war in Ukraine showed.',
    reading: 'Michael Mazarr, Mastering the Gray Zone (2015); Thomas Rid, Active Measures (2020); Michael Horowitz, "Battles of Precise Mass" (2024).',
  },
  'food-security': {
    name: 'Food Security',
    dispatch: 'Governments that cannot feed their people do not last: grain is a strategic asset.',
    body: 'Food prices topple governments: the 2010–11 price spike fed the Arab Spring. Major exporters such as the US, Brazil, Argentina, Canada and Ukraine carry quiet influence, and Russia’s 2022 blockade of Ukrainian ports showed that grain can be weaponized like oil.',
    reading: 'Amartya Sen, Poverty and Famines (1981); Christopher Barrett (ed.), Food Security and Sociopolitical Stability (2013).',
  },
};

export const CONCEPT_ORDER = Object.keys(CONCEPTS) as ConceptId[];
