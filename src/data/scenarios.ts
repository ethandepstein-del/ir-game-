import type { Scenario } from '../engine/types';

const pct = (v: number) => `${Math.round(v)}%`;

const veyra: Scenario = {
  id: 'veyra',
  title: 'The Veyra Strait',
  tagline: 'Two navies, three islets and one very narrow strait.',
  kind: 'territorial',
  difficulty: 1,
  briefing: [
    'Nine days ago a Kasrani patrol boat rammed an Aldmarki trawler near the Tessen Islets. Four sailors are in hospital. Both navies have moved into the Veyra Strait, and the two fleets are now within gun range of each other.',
    'Marshal-President Vasko has agreed to talks at a neutral venue. Your cabinet wants the islets. Your fishing towns want their waters back. Everyone wants to avoid a war that would close the busiest shipping lane in the region.',
    'You have ten rounds before the summit collapses under its own weight. Find a deal your parliament will ratify, or the admirals decide what happens next.',
  ],
  you: { country: 'Aldmark', role: 'Foreign Minister of the Republic of Aldmark' },
  them: {
    country: 'Kasran',
    leader: 'Oren Vasko',
    title: 'Marshal-President of the Kasrani Federation',
    dossier:
      'A former naval officer who took power promising to restore national pride. Our analysts disagree about him. One camp says he is testing how far he can push. The other says he genuinely fears encirclement by our alliance. Watch how he reacts to pressure.',
  },
  issues: [
    {
      id: 'islets',
      name: 'Tessen Islets',
      blurb: 'Sovereignty over the disputed islets and their seabed.',
      theirEnd: 'Kasrani sovereignty',
      yourEnd: 'Aldmarki sovereignty',
      format: (v) =>
        v < 20 ? 'Kasrani sovereignty' : v < 45 ? 'Kasrani admin, shared seabed' : v < 60 ? 'Joint condominium' : v < 85 ? 'Aldmarki admin, shared seabed' : 'Aldmarki sovereignty',
    },
    {
      id: 'fishing',
      name: 'Fishing Quota',
      blurb: "Aldmark's share of the strait's annual catch.",
      theirEnd: '0% to Aldmark',
      yourEnd: '100% to Aldmark',
      format: (v) => `${pct(v)} to Aldmark`,
    },
    {
      id: 'navy',
      name: 'Naval Exclusion Zone',
      blurb: 'How far Kasrani warships must stay from the Aldmarki coast.',
      theirEnd: 'No limits',
      yourEnd: '60 km exclusion',
      format: (v) => (v < 5 ? 'No limits' : `${Math.round((v / 100) * 60)} km exclusion`),
    },
    {
      id: 'sanctions',
      name: 'Sanctions',
      blurb: 'Aldmarki sanctions on Kasrani banks, imposed after the incident.',
      theirEnd: 'Lifted immediately',
      yourEnd: 'Kept in full',
      format: (v) => (v < 15 ? 'Lifted immediately' : v < 50 ? 'Phased out over 1 year' : v < 85 ? 'Partially kept' : 'Kept in full'),
    },
  ],
  playerWeights: [0.35, 0.3, 0.2, 0.15],
  oppWeightsBase: [0.3, 0.1, 0.2, 0.4],
  leaderTypes: ['opportunist', 'insecure', 'pragmatist'],
  rounds: 10,
  start: { tension: 35, support: 55, trust: 35 },
  ratificationBase: 0.5,
  oppReservationBase: 0.38,
  noDealValue: 0.3,
  ladder: ['Diplomatic protest', 'Naval shadowing', 'Mobilization', 'Blockade', 'Exchange of fire', 'War'],
  breakdown: {
    name: 'War',
    values: [0.32, 0.12, 0.0],
    text: [
      'After eleven days of fighting, Kasrani forces withdraw from the strait. Aldmark holds the islets, but 1,400 people are dead and the shipping lane is mined for a year.',
      'The fighting bogs down. A ceasefire freezes the line where the ships stopped. Nobody wins the islets, and both economies go into recession.',
      'The Kasrani navy blockades Aldmark\'s northern ports. Your government falls, and the peace terms are dictated in Kasran.',
    ],
  },
  trustFloor: 0,
  events: [
    {
      id: 'trawler',
      title: 'Fishermen Detained',
      body: 'Kasrani coast guards have boarded a second Aldmarki trawler and are holding its crew of nine. Aldmarki television is showing live footage from the harbor.',
      options: [
        { label: 'Demand release publicly', detail: 'Tension +10, Support +8', effects: { tension: 10, support: 8, resolve: 0.05 }, concept: 'rally-effect', outcome: 'The nation rallies behind you. Kasran calls the statement "hysterical."' },
        { label: 'Work it quietly', detail: 'Trust +8, Support −6', effects: { trust: 8, support: -6 }, outcome: 'The crew is freed two days later. Opposition papers call you soft.' },
      ],
    },
    {
      id: 'ally',
      title: 'Alliance Hesitates',
      body: "Your main ally's defense secretary says his country's treaty commitments \"do not automatically extend to disputed territory.\"",
      options: [
        { label: 'Downplay it', detail: 'Resolve −0.1', effects: { resolve: -0.1 }, outcome: 'Vasko\'s aides are seen smiling.' },
        { label: 'Stage joint exercises', detail: 'Tension +12, Resolve +0.1', effects: { tension: 12, resolve: 0.1, fear: 0.1 }, concept: 'costly-signal', outcome: 'Allied warships sail through the strait. Kasran scrambles jets.' },
      ],
    },
    {
      id: 'storm',
      title: 'Search and Rescue',
      body: 'A storm capsizes a Kasrani supply ship near the islets. Your coast guard is the closest vessel.',
      options: [
        { label: 'Launch the rescue', detail: 'Trust +12, Tension −10', effects: { trust: 12, tension: -10, fear: -0.1 }, outcome: 'Twenty-two Kasrani sailors come home. Vasko thanks you on state TV.' },
        { label: 'Leave it to Kasran', detail: 'Support +3, Trust −5', effects: { support: 3, trust: -5 }, outcome: 'Kasran reaches them in time, only just. The episode is noted.' },
      ],
    },
    {
      id: 'oil',
      title: 'Seismic Survey Leaks',
      body: 'A leaked survey suggests a large gas field under the Tessen seabed. Both publics suddenly care much more about the islets.',
      options: [
        { label: 'Confirm the survey', detail: 'Support +5, Their demands rise', effects: { support: 5, aspiration: 0.04, tension: 6 }, outcome: 'Kasrani hardliners demand the islets "without compromise."' },
        { label: 'Call it speculation', detail: 'Support −4, Tension −4', effects: { support: -4, tension: -4 }, outcome: 'The story fades from the front pages, for now.' },
      ],
    },
    {
      id: 'election',
      title: 'Snap Election Rumors',
      body: 'Your coalition partner threatens to leave if you "give away Aldmarki waters." Parliament is restless.',
      options: [
        { label: 'Reassure the hawks', detail: 'Support +10, Trust −6', effects: { support: 10, trust: -6 }, concept: 'two-level-game', outcome: 'The coalition holds. Kasran reads your speech closely.' },
        { label: 'Hold the center', detail: 'Support −8', effects: { support: -8 }, concept: 'two-level-game', outcome: 'You keep your options open, and your ratification margin narrows.' },
      ],
    },
  ],
};

const tariff: Scenario = {
  id: 'tariff',
  title: 'Tariff Winter',
  tagline: 'A trade war nobody wants, and nobody can afford to lose.',
  kind: 'trade',
  difficulty: 2,
  briefing: [
    'Six months of tit-for-tat tariffs between the Commonwealth of Marenne and the Hollis Union have closed factories on both sides. Hollis has just threatened export controls on the chips Marenne\'s car industry depends on.',
    'Commissioner Ilse Varga has come to negotiate. Your steelworkers, farmers and carmakers are all watching, and each group believes it is the one being sold out.',
    'You have eight rounds. If talks fail, the trade war escalates to full decoupling. Nobody gets shot, but a lot of people lose their jobs.',
  ],
  you: { country: 'Marenne', role: 'Chief Trade Envoy of the Commonwealth of Marenne' },
  them: {
    country: 'Hollis',
    leader: 'Ilse Varga',
    title: 'Trade Commissioner of the Hollis Union',
    dossier:
      "A career technocrat answering to twenty-seven member governments. Some reports describe her as a hardball tactician who treats every concession as a sign of weakness. Others say she is under siege at home and terrified of looking weak. Both may be exaggerated.",
  },
  issues: [
    {
      id: 'steel',
      name: 'Steel Tariffs',
      blurb: 'Tariff Hollis charges on Marennese steel.',
      theirEnd: '40% tariff',
      yourEnd: 'Zero tariff',
      format: (v) => `${Math.round(40 - (v / 100) * 40)}% tariff`,
    },
    {
      id: 'chips',
      name: 'Chip Export Controls',
      blurb: 'Hollis licensing on advanced semiconductors sold to Marenne.',
      theirEnd: 'Full controls',
      yourEnd: 'Open licensing',
      format: (v) => (v < 20 ? 'Full controls' : v < 50 ? 'Case-by-case licenses' : v < 80 ? 'General license, some exclusions' : 'Open licensing'),
    },
    {
      id: 'farm',
      name: 'Farm Market Access',
      blurb: 'How much of your agricultural market opens to Hollis produce.',
      theirEnd: 'Fully open',
      yourEnd: 'Fully protected',
      format: (v) => `${Math.round(100 - v)}% of quota opened`,
    },
    {
      id: 'currency',
      name: 'Currency Pledge',
      blurb: 'Whether Marenne commits not to devalue its currency.',
      theirEnd: 'Binding pledge + monitoring',
      yourEnd: 'No commitment',
      format: (v) => (v < 25 ? 'Binding pledge + monitoring' : v < 60 ? 'Non-binding pledge' : v < 85 ? 'Joint statement only' : 'No commitment'),
    },
  ],
  playerWeights: [0.25, 0.4, 0.25, 0.1],
  oppWeightsBase: [0.15, 0.25, 0.4, 0.2],
  leaderTypes: ['opportunist', 'insecure', 'pragmatist'],
  rounds: 8,
  start: { tension: 45, support: 50, trust: 40 },
  ratificationBase: 0.52,
  oppReservationBase: 0.4,
  noDealValue: 0.32,
  ladder: ['Formal complaint', 'Targeted tariffs', 'Broad tariffs', 'Export controls', 'Asset freezes', 'Trade War'],
  breakdown: {
    name: 'Trade War',
    values: [0.3, 0.16, 0.05],
    text: [
      'Hollis blinks first. Its farmers riot and the Commission backs down on chips, but your steel mills have already closed.',
      'The two economies decouple. Supply chains reroute over three painful years, and both sides end up poorer.',
      'The chip embargo shuts your car plants. Unemployment hits 11% and your government falls at the next election.',
    ],
  },
  trustFloor: 0,
  events: [
    {
      id: 'strike',
      title: 'Steelworkers Strike',
      body: 'Forty thousand steelworkers march on the capital, demanding you "walk out rather than sell us out."',
      options: [
        { label: 'Meet the unions', detail: 'Support +8, Their demands fall', effects: { support: 8, aspiration: -0.03 }, concept: 'two-level-game', outcome: 'You tell Varga your hands are tied, and she believes it.' },
        { label: 'Stay above it', detail: 'Support −8', effects: { support: -8 }, outcome: 'The marches continue, and your ratification margin shrinks.' },
      ],
    },
    {
      id: 'wto',
      title: 'Trade Court Ruling',
      body: 'An international trade panel rules that Hollis\'s steel tariffs violate its commitments. Hollis says it will "study the ruling."',
      options: [
        { label: 'Trumpet the ruling', detail: 'Resolve +0.1, Tension +5', effects: { resolve: 0.1, tension: 5 }, outcome: 'International opinion shifts your way. Varga is irritated.' },
        { label: 'Offer a face-saver', detail: 'Trust +10', effects: { trust: 10, fear: -0.1 }, concept: 'mediation', outcome: 'You suggest the panel "assist implementation." Varga quietly accepts.' },
      ],
    },
    {
      id: 'chipshortage',
      title: 'Plant Shutdown',
      body: 'Your largest carmaker halts two assembly lines, citing chip shortages. Markets fall 3%.',
      options: [
        { label: 'Blame Hollis loudly', detail: 'Support +5, Tension +8', effects: { support: 5, tension: 8 }, concept: 'rally-effect', outcome: 'It plays well at home and badly in the negotiating room.' },
        { label: 'Absorb it', detail: 'Resolve −0.08', effects: { resolve: -0.08 }, concept: 'private-information', outcome: 'Hollis analysts conclude that you need a deal badly.' },
      ],
    },
    {
      id: 'thirdparty',
      title: 'A Third Market',
      body: 'A large economy to the east offers Marenne a chip supply deal if talks with Hollis fail.',
      options: [
        { label: 'Let Hollis find out', detail: 'Their demands fall, Tension +6', effects: { aspiration: -0.05, tension: 6, resolve: 0.08 }, concept: 'batna', outcome: 'Varga\'s team suddenly looks more flexible.' },
        { label: 'Keep it in reserve', detail: 'No effect', effects: {}, outcome: 'You keep the card hidden for now.' },
      ],
    },
    {
      id: 'summit',
      title: "Leaders' Summit Looms",
      body: 'Both heads of government want a signing ceremony at next week\'s summit. The pressure to close is rising on both sides.',
      options: [
        { label: 'Use the deadline', detail: 'Their demands fall, Trust −4', effects: { aspiration: -0.04, trust: -4 }, outcome: 'Varga feels the clock too.' },
        { label: 'Refuse artificial deadlines', detail: 'Support +4', effects: { support: 4 }, outcome: 'Your hawks approve.' },
      ],
    },
  ],
};

const kessel: Scenario = {
  id: 'kessel',
  title: 'The Kessel Protocol',
  tagline: 'Nobody signs an arms deal with someone they expect to cheat.',
  kind: 'arms',
  difficulty: 3,
  briefing: [
    'The Republic of Suhr is enriching uranium at its Kessel facility. Your intelligence services estimate it is fourteen months from weapons capability. Sanctions have crippled Suhr\'s economy but have not stopped the centrifuges.',
    'Director Amun Halevar leads Suhr\'s delegation. His government says it enriches only for power. It also remembers that the last agreement collapsed when your predecessor walked away from it.',
    'You have twelve rounds. Suhr will not sign anything, however generous, until it trusts that you will keep your side. If talks fail, your defense ministry has a strike plan ready.',
  ],
  you: { country: 'The Concord', role: 'Special Envoy of the Northern Concord' },
  them: {
    country: 'Suhr',
    leader: 'Amun Halevar',
    title: 'Director of the Suhrani Atomic Agency',
    dossier:
      'A physicist turned diplomat. Suhr remembers the last deal collapsing and will not sign unless it believes you will keep your word. Some analysts say its leadership wants a bomb and is buying time. Others say it wants security guarantees above all.',
  },
  issues: [
    {
      id: 'enrich',
      name: 'Enrichment Cap',
      blurb: 'Maximum uranium enrichment Suhr may keep.',
      theirEnd: '60% enrichment',
      yourEnd: 'No enrichment',
      format: (v) => (v > 92 ? 'No enrichment' : `${(60 - (v / 100) * 58).toFixed(1)}% cap`),
    },
    {
      id: 'inspect',
      name: 'Inspections',
      blurb: 'Access for international inspectors.',
      theirEnd: 'Declared sites only',
      yourEnd: 'Anytime, anywhere',
      format: (v) => (v < 25 ? 'Declared sites only' : v < 55 ? 'Declared + 24-day notice' : v < 85 ? 'Snap inspections, military excluded' : 'Anytime, anywhere'),
    },
    {
      id: 'relief',
      name: 'Sanctions Relief',
      blurb: 'How quickly sanctions on Suhr are lifted.',
      theirEnd: 'Lifted on signing',
      yourEnd: 'Kept until full compliance',
      format: (v) => (v < 20 ? 'Lifted on signing' : v < 50 ? 'Phased over 6 months' : v < 80 ? 'Phased over 2 years' : 'Kept until full compliance'),
    },
    {
      id: 'sunset',
      name: 'Sunset Clause',
      blurb: 'When the restrictions expire.',
      theirEnd: '5 years',
      yourEnd: 'Permanent',
      format: (v) => (v > 92 ? 'Permanent' : `${Math.round(5 + (v / 100) * 25)} years`),
    },
  ],
  playerWeights: [0.35, 0.3, 0.1, 0.25],
  oppWeightsBase: [0.25, 0.15, 0.45, 0.15],
  leaderTypes: ['opportunist', 'insecure', 'pragmatist'],
  rounds: 12,
  start: { tension: 50, support: 50, trust: 18 },
  ratificationBase: 0.55,
  oppReservationBase: 0.42,
  noDealValue: 0.28,
  ladder: ['Diplomatic warning', 'New sanctions', 'Covert sabotage', 'Carrier deployment', 'Strike orders drafted', 'Airstrikes'],
  breakdown: {
    name: 'Military Strikes',
    values: [0.3, 0.12, 0.0],
    text: [
      'The strikes destroy Kessel. Suhr rebuilds deeper underground and leaves the Non-Proliferation Treaty. You have bought perhaps three years.',
      'The strikes damage Kessel, and Suhr retaliates against shipping. A regional war simmers for years with no clear end.',
      'The strikes fail to reach the buried centrifuge halls. Suhr tests a device eighteen months later.',
    ],
  },
  trustFloor: 40,
  events: [
    {
      id: 'scientist',
      title: 'Scientist Assassinated',
      body: 'A senior Suhrani nuclear scientist is killed by a car bomb. Suhr blames your intelligence services.',
      options: [
        { label: 'Deny and condemn', detail: 'Trust +4, Tension +6', effects: { trust: 4, tension: 6 }, outcome: 'Halevar does not believe you, but he appreciates the condemnation.' },
        { label: 'No comment', detail: 'Resolve +0.1, Trust −10', effects: { resolve: 0.1, trust: -10, fear: 0.15 }, concept: 'spiral-model', outcome: 'Suhr\'s hardliners call for leaving the talks.' },
      ],
    },
    {
      id: 'iaea',
      title: 'Inspector Report',
      body: 'Inspectors find uranium traces at an undeclared site. Suhr says the traces are old contamination.',
      options: [
        { label: 'Demand answers', detail: 'Resolve +0.1, Tension +8', effects: { resolve: 0.1, tension: 8 }, concept: 'private-information', outcome: 'Suhr grants limited access, grudgingly.' },
        { label: 'Refer to experts', detail: 'Trust +8', effects: { trust: 8 }, concept: 'commitment-problem', outcome: 'A technical working group is formed, and it becomes a small channel of trust.' },
      ],
    },
    {
      id: 'senate',
      title: 'Legislature Revolts',
      body: 'Sixty legislators sign a letter warning Suhr that any deal "could be revoked by the next government with the stroke of a pen."',
      options: [
        { label: 'Disavow the letter', detail: 'Trust +10, Support −8', effects: { trust: 10, support: -8 }, concept: 'commitment-problem', outcome: 'You reassure Suhr at a political cost at home.' },
        { label: 'Use it as leverage', detail: 'Support +5, Trust −8', effects: { support: 5, trust: -8, aspiration: -0.03 }, concept: 'two-level-game', outcome: '"I cannot sell a weak deal," you tell Halevar. He believes you, and trusts you less.' },
      ],
    },
    {
      id: 'prisoners',
      title: 'Prisoner Swap Offered',
      body: 'Suhr offers to release two detained journalists in exchange for three convicted Suhrani sanctions-evaders.',
      options: [
        { label: 'Accept the swap', detail: 'Trust +14, Support −4', effects: { trust: 14, support: -4, fear: -0.1 }, outcome: 'The journalists land home to cameras. Halevar calls it "a first step."' },
        { label: 'Decline', detail: 'Support +3', effects: { support: 3 }, outcome: 'Suhr notes the refusal.' },
      ],
    },
    {
      id: 'carrier',
      title: 'Carrier Group Request',
      body: 'Your defense minister asks to move a carrier group into range "to concentrate minds."',
      options: [
        { label: 'Approve', detail: 'Tension +14, Resolve +0.15', effects: { tension: 14, resolve: 0.15, fear: 0.15 }, concept: 'costly-signal', outcome: 'The carrier arrives. Suhr puts its air defenses on alert.' },
        { label: 'Refuse', detail: 'Support −5, Tension −4', effects: { support: -5, tension: -4 }, outcome: 'Your hawks complain to the press.' },
      ],
    },
    {
      id: 'earthquake',
      title: 'Earthquake in Suhr',
      body: 'A 6.8-magnitude earthquake strikes northern Suhr. Thousands are homeless.',
      options: [
        { label: 'Send aid, no strings', detail: 'Trust +14, Tension −8', effects: { trust: 14, tension: -8, fear: -0.12 }, outcome: 'Your field hospitals are on Suhrani TV for a week.' },
        { label: 'Offer aid via NGOs', detail: 'Trust +5', effects: { trust: 5 }, outcome: 'A cautious gesture, cautiously received.' },
      ],
    },
  ],
};

export const SCENARIOS: Scenario[] = [veyra, tariff, kessel];

export function getScenario(id: string): Scenario {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scenario ${id}`);
  return s;
}
