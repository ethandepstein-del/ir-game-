import type { PowerId } from './world';

/**
 * Real-world geopolitics layered on the board: the straits, fields, fabs, mines
 * and farms that great powers actually compete over, the overseas bases they
 * actually hold, and a line of intelligence for every territory.
 */

export type AssetKind = 'strait' | 'oil' | 'chips' | 'minerals' | 'grain';

export interface Asset {
  kind: AssetKind;
  name: string;
}

export const ASSET_INFO: Record<AssetKind, { label: string; effect: string }> = {
  strait: { label: 'Chokepoint', effect: '+1 army a turn (sea control)' },
  oil: { label: 'Oil & gas', effect: '+1 army a turn; +2 more in an oil shock' },
  chips: { label: 'Chip fabs', effect: '+1 army a turn' },
  minerals: { label: 'Critical minerals', effect: '+1 army a turn for every two held' },
  grain: { label: 'Breadbasket', effect: '+1 legitimacy a turn (food security)' },
};

export const ASSETS: Record<string, Asset[]> = {
  // Chokepoints
  persia: [
    { kind: 'strait', name: 'Strait of Hormuz' },
    { kind: 'oil', name: 'South Pars gas field' },
  ],
  egypt: [{ kind: 'strait', name: 'Suez Canal' }],
  horn: [{ kind: 'strait', name: 'Bab-el-Mandeb' }],
  malaya: [{ kind: 'strait', name: 'Strait of Malacca' }],
  anatolia: [{ kind: 'strait', name: 'Turkish Straits' }],
  'central-am': [{ kind: 'strait', name: 'Panama Canal' }],
  iberia: [{ kind: 'strait', name: 'Strait of Gibraltar' }],
  taiwan: [
    { kind: 'strait', name: 'Taiwan Strait' },
    { kind: 'chips', name: 'TSMC fabs, Hsinchu' },
  ],
  uk: [{ kind: 'strait', name: 'GIUK Gap' }],
  scandinavia: [{ kind: 'strait', name: 'Danish Straits' }],
  'far-east': [{ kind: 'strait', name: 'Northern Sea Route' }],
  // Energy
  arabia: [{ kind: 'oil', name: 'Ghawar oil field' }],
  levant: [{ kind: 'oil', name: 'Rumaila & Kirkuk fields' }],
  urals: [{ kind: 'oil', name: 'West Siberian basin' }],
  siberia: [{ kind: 'oil', name: 'Vankor & East Siberian fields' }],
  'gran-colombia': [{ kind: 'oil', name: 'Orinoco Belt' }],
  'west-africa': [{ kind: 'oil', name: 'Niger Delta' }],
  kazakhstan: [{ kind: 'oil', name: 'Tengiz & Kashagan' }],
  maghreb: [{ kind: 'oil', name: 'Hassi Messaoud & Sirte' }],
  // Semiconductors
  korea: [{ kind: 'chips', name: 'Samsung & SK Hynix fabs' }],
  japan: [{ kind: 'chips', name: 'Chip materials & tools' }],
  // Critical minerals
  'north-china': [
    { kind: 'minerals', name: 'Bayan Obo rare earths' },
    { kind: 'chips', name: 'SMIC fabs, Shanghai' },
  ],
  'south-china': [{ kind: 'minerals', name: 'Rare-earth refining, Jiangxi' }],
  congo: [{ kind: 'minerals', name: 'Katanga cobalt' }],
  andes: [{ kind: 'minerals', name: 'Lithium triangle' }],
  'aus-w': [{ kind: 'minerals', name: 'Pilbara iron & lithium' }],
  'southern-africa': [{ kind: 'minerals', name: 'Bushveld platinum' }],
  deccan: [
    { kind: 'strait', name: 'Six Degree Channel' },
    { kind: 'minerals', name: 'Odisha iron ore & coal' },
  ],
  // Breadbaskets
  'eastern-eu': [{ kind: 'grain', name: 'Black Earth wheat belt' }],
  'us-east': [{ kind: 'grain', name: 'Corn Belt' }],
  brazil: [{ kind: 'grain', name: 'Mato Grosso soy' }],
  'southern-cone': [{ kind: 'grain', name: 'The Pampas' }],
  'canada-w': [{ kind: 'grain', name: 'Prairie wheat' }],
  hindustan: [{ kind: 'grain', name: 'Punjab breadbasket' }],
};

/** Overseas bases held at the start: [territory id, power, base name]. */
export const START_BASES: [string, PowerId, string][] = [
  ['japan', 'usa', 'Yokosuka, US 7th Fleet'],
  ['korea', 'usa', 'Camp Humphreys'],
  ['germany', 'usa', 'Ramstein Air Base'],
  ['arabia', 'usa', 'Al Udeid Air Base'],
  ['horn', 'usa', 'Camp Lemonnier'],
  ['levant', 'rus', 'Tartus naval base'],
  ['central-asia', 'rus', '201st Military Base'],
  ['anatolia', 'rus', '102nd Base, Gyumri'],
  ['horn', 'chn', 'PLA Support Base, Djibouti'],
  ['indochina', 'chn', 'Ream Naval Base'],
  ['arabia', 'eu', 'French base, Abu Dhabi'],
  ['horn', 'eu', 'French forces in Djibouti'],
];

/** One line of real-world intelligence per territory. */
export const INTEL: Record<string, string> = {
  alaska: 'Fort Greely hosts most of America’s ground-based missile interceptors; the Bering Strait is 82 km wide.',
  'canada-w': 'Prairie wheat and the oil sands of Alberta; NORAD watches the polar approach from here.',
  'canada-e': 'Northwest Passage claims and the Atlantic convoy routes of two world wars.',
  greenland: 'Pituffik Space Base tracks ballistic missiles; the GIUK gap is where NATO hunts Russian submarines.',
  'us-west': 'Silicon Valley, the Permian Basin and the Pacific Fleet at San Diego.',
  'us-east': 'Washington, Wall Street, the Corn Belt and Naval Station Norfolk, the world’s largest naval base.',
  mexico: 'America’s largest trading partner; nearshoring is pulling factories from China.',
  'central-am': 'The Panama Canal carries about 5% of world seaborne trade; drought has cut its traffic.',
  'gran-colombia': 'Venezuela holds the world’s largest proven oil reserves, mostly in the Orinoco Belt.',
  brazil: 'The world’s top soybean exporter; a founding BRICS member that avoids taking sides.',
  andes: 'Chile and Bolivia sit on the “lithium triangle”, about half of the world’s known lithium.',
  'southern-cone': 'The Pampas feed the world; Argentina still claims the Falklands.',
  uk: 'A nuclear power with a permanent UN Security Council seat; Faslane berths its Trident submarines.',
  iberia: 'Gibraltar guards the only Atlantic entrance to the Mediterranean; Rota hosts US destroyers.',
  france: 'France is the EU’s only nuclear power; the Netherlands’ ASML makes the only EUV chipmaking machines.',
  germany: 'Europe’s industrial core; Ramstein is the hub for US operations in Europe and the Middle East.',
  italy: 'Naples hosts the US Sixth Fleet; Sicily’s Sigonella flies NATO drones over the Mediterranean.',
  scandinavia: 'Finland and Sweden joined NATO in 2023–24, turning the Baltic into a NATO lake.',
  'central-eu': 'The Suwałki Gap, 65 km between Belarus and Kaliningrad, is NATO’s most exposed seam.',
  'eastern-eu': 'The Black Earth belt once earned Ukraine the name “breadbasket of Europe”.',
  balkans: 'Camp Bondsteel in Kosovo has hosted US troops since NATO’s 1999 intervention.',
  moscow: 'Seat of Russian power; an anti-ballistic-missile system has ringed the capital since the Cold War.',
  urals: 'The West Siberian basin pumps most of Russia’s oil; tank factories at Nizhny Tagil.',
  siberia: 'The Power of Siberia pipeline sends gas to China; vast, frozen and hard to invade.',
  'far-east': 'Vladivostok hosts the Pacific Fleet; Kamchatka hides ballistic-missile submarines.',
  kazakhstan: 'Tengiz and Kashagan oil; Baikonur, where Gagarin lifted off.',
  'central-asia': 'Russia’s 201st Base in Tajikistan guards the Afghan border; China’s Belt and Road runs through.',
  maghreb: 'Algeria and Libya pipe gas to Europe; Libya’s civil war drew Russian and Turkish forces.',
  egypt: 'The Suez Canal carries about 12% of world trade; Houthi attacks from late 2023 diverted shipping around Africa.',
  levant: 'Russia’s Tartus base, its Mediterranean foothold, has been in doubt since Assad fell in 2024; Iraq’s Rumaila is a giant oil field.',
  anatolia: 'Turkey controls the Bosporus under the 1936 Montreux Convention; NATO’s second-largest army.',
  arabia: 'Ghawar is the largest conventional oil field ever found; Al Udeid runs US air power in the region.',
  persia: 'About a fifth of the world’s oil passes through the Strait of Hormuz.',
  'west-africa': 'Nigeria’s Niger Delta oil; the Sahel coups of 2020–23 expelled French troops.',
  horn: 'Djibouti hosts US, Chinese, French, Japanese and Italian bases within a few kilometres of each other.',
  congo: 'Katanga mines about 70% of the world’s cobalt, essential for batteries.',
  'east-africa': 'Mombasa and Dar es Salaam are the gateways to East Africa; China financed their railways.',
  'southern-africa': 'The Bushveld holds most of the world’s platinum; South Africa once built, then gave up, nuclear weapons.',
  hindustan: 'Punjab is India’s breadbasket; the Line of Control with Pakistan is among the world’s most militarised borders.',
  ganges: 'The Siliguri “Chicken’s Neck”, 22 km wide, is all that links India to its northeast.',
  deccan: 'Bengaluru’s tech hub; the Andaman & Nicobar Command watches the western mouth of Malacca.',
  pakistan: 'A nuclear-armed rival of India; the China–Pakistan Economic Corridor ends at the port of Gwadar.',
  burma: 'China’s pipelines from Kyaukphyu bypass the Strait of Malacca; civil war since the 2021 coup.',
  'north-china': 'Beijing, and Bayan Obo, the world’s largest rare-earth mine.',
  'south-china': 'The workshop of the world; China refines about 90% of the world’s rare earths.',
  'west-china': 'Xinjiang’s Lop Nur was China’s nuclear test site; Tibet looks down on India across the Himalaya.',
  mongolia: 'A democracy wedged between Russia and China that courts “third neighbours”.',
  korea: 'Samsung and SK Hynix make most of the world’s memory chips; 28,500 US troops are stationed here.',
  japan: 'The US Seventh Fleet sails from Yokosuka; Japan supplies key chipmaking chemicals.',
  taiwan: 'TSMC makes about 90% of the world’s most advanced chips: the “silicon shield”.',
  indochina: 'Vietnam contests the South China Sea; China is upgrading Cambodia’s Ream naval base.',
  malaya: 'The Strait of Malacca carries about a quarter of world trade, including most of China’s oil imports.',
  indonesia: 'The world’s largest archipelago straddles every sea route from the Pacific to the Indian Ocean.',
  philippines: 'US forces rotate through new sites facing the South China Sea and Taiwan.',
  'aus-w': 'The Pilbara ships iron ore and lithium; Pine Gap and North West Cape serve US signals and submarines.',
  'aus-e': 'AUKUS will give Australia nuclear-powered attack submarines, the core of its alliance with the US and UK.',
  'new-zealand': 'Five Eyes member; China and the West compete for influence across the Pacific islands.',
};
