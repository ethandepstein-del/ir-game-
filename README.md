# Anarchy

A game of great-power politics in the spirit of Risk, built for people who argue about Mearsheimer at parties.

Five great powers compete for a hex map of the real world, rasterized from Natural Earth borders into 57 territories. Deploy, roll dice, conquer, fortify. The rules are built on IR theory: balancing coalitions, a nuclear Doomsday Clock, offense–defense eras, and diplomacy that depends on reputation.

## Play

```bash
npm install
npm run dev           # http://localhost:5173
npm test              # engine tests, including full AI-vs-AI games
npm run build         # static site in dist/
npm run build:single  # one self-contained HTML file in dist-single/
npm run map           # regenerate the hex map from Natural Earth data
```

Your first game opens with a guided tutorial: sticky notes walk you through one full turn (deploy, attack, fortify), diplomacy and the Doomsday Clock, with a pencil circling what to click next. Replay it at any time with the **?** button in the top bar, or tick *Show me how to play* on the start screen.

The table is styled as paper: cut-card panels, an index-card territory dossier, sticky-note theory notes, a typewritten dispatch strip, newspaper-clipping bulletins, and hand-inked map borders with colored-pencil hatching. Animation is cut-paper stop-motion, written in plain canvas JS (`src/ui/fx/particles.ts`). Attacks are paper arrows that hop across the board and burst into cartoon cut-outs and scraps; conquests plant a flapping paper flag; reinforcements fall in as paper chits; pacts and alliances are stamped with a wax seal; nuclear war builds a paper mushroom cloud. The paper poses (bursts, seals, flags) are held on a 12 fps clock and re-cut slightly every frame so their edges boil, while motion through space (arrows, scraps, troop hops, parachutes, doves) moves smoothly at full frame rate. Explosions come with comic-book sound effects, pacts release a paper dove, reinforcements parachute in, and paper boats and whales drift around the oceans when the board is quiet.

The countries are smooth cut-paper shapes. The map is still built on the hex grid for adjacency, but `geometry.ts` traces each shared border once, smooths it (Taubin, then Chaikin), simplifies it and reassembles every territory from those shared curves, so neighbours fit exactly. The page overlays (banners, clippings, dice, notes) use the same held-frame timing.

## Rules in brief

- **Turn:** deploy armies, attack with Risk dice (up to 3 vs 2, ties to the defender), then make one fortify move. Conquering a territory in a turn earns a crisis card.
- **Win:** hold 26 of 57 territories at the end of your turn (hegemony). Otherwise, the most prestige after 20 rounds wins: territories, plus region bonuses, plus 3 per capital held.
- **Great powers** each have a doctrine:

  | Power | Doctrine | Effect |
  |---|---|---|
  | United States | Command of the Commons | Everyone else is limited to 2 dice across sea lanes. |
  | European Union | Institutions | +1 army per active pact. |
  | Russia | Defense in Depth | Defends with 3 dice in the Heartland. |
  | China | Rising Power | Income grows over time. |
  | India | Strategic Autonomy | Others are more willing to sign pacts with you. |

## IR theory built into the rules

| Mechanic | Concept |
|---|---|
| Pass ~⅓ of world strength and the others form a coalition against you, with +3 armies each per turn | Balance of power (Waltz, Walt) |
| Weak exposed powers may sign with the leader instead | Bandwagoning |
| Striking a great power's homeland moves the Doomsday Clock; at midnight everyone loses | MAD, brinkmanship (Schelling) |
| Periphery wars don't move the clock | Stability–instability paradox (Snyder) |
| Eras shift between defense-dominant (+1 to the defender's best die) and offense-dominant (attacker wins ties) | Offense–defense balance (Jervis, Van Evera) |
| Rivals accept pacts based on threat, relative power and your reputation; breaking a pact costs 30 reputation | Realist alliance politics, reputation (Mercer, Press) |
| Arms Race card: you get +5 armies, but every neighbour arms too | Security dilemma |
| Sanctions, Coup, Proxy War, Summit, Carrier Group, Blitzkrieg and Détente cards | Economic statecraft, covert action, proxy war, arms control… |
| The top power changes | Power transition (Organski) |
| Live system readout: unipolar, bipolar or multipolar | Polarity |

When a concept first happens in play, a short "Theory in play" note appears. The **Codex** collects 19 concepts, each with a key reading, and unlocks them as you encounter them. The end screen charts every power's share of world strength, round by round.

## Deeper IR systems

- **Secret doctrines.** Each rival is secretly an offensive realist, defensive realist, liberal institutionalist or revisionist, and plays like one. Mark your guesses on the roster; the end screen reveals the truth with each rival's record.
- **Alliances with obligations.** Defensive alliances give the defender +1 to its best die when an ally stands next door. When your ally is attacked you must honor the alliance (go to war) or abandon it (reputation and legitimacy losses): chain-ganging vs. buck-passing.
- **Regime type and legitimacy.** Democracies (USA, EU, India) and autocracies (Russia, China) have a legitimacy meter that changes income. It covers audience costs, the democratic peace, rally effects, war weariness and diversionary war.
- **Attack previews** list every consequence before you commit: broken pacts, Doomsday Clock, legitimacy costs, allies that will be obliged to respond.

## Code

```
scripts/build-map.mjs   Natural Earth → hex grid, territory grouping, adjacency, sea lanes
src/data/               map (generated), regions & powers, cards, concepts
src/engine/             pure, seeded rules engine (game.ts), diplomacy.ts, ai.ts + tests
src/ui/                 React: Start, Game (map + sidebar), WorldMap (SVG, zoom/pan), Tutorial, End, Codex
src/ui/paper.css        the paper-and-pencil finish (loaded over styles.css)
```

The engine is a pure reducer: `apply(state, action)`. Human and AI players use the same actions. The AI:

- deploys toward its best attack or its most exposed border;
- attacks when the odds favor it, valuing region completion;
- honors its pacts and coalition solidarity;
- avoids striking homelands as midnight approaches.
