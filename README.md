# The Table

A crisis-diplomacy negotiation game. You sit across from a rival leader, read their intentions, trade what you can spare, bluff when you must, and try to sign a deal your own legislature will ratify before the generals take over.

It is a game first. It is also built so that everything that happens at the table is a real idea from international relations, named and explained in a post-game debrief and a Codex you unlock by playing.

## Play

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine tests
npm run build      # static build in dist/
npm run build:single  # one self-contained HTML file in dist-single/
```

## How it plays

- **Three crises.** *The Veyra Strait* is a territorial standoff (tutorial difficulty). *Tariff Winter* is a trade war. *The Kessel Protocol* is arms control, and the other side won't sign until it trusts you.
- **Issues on sliders.** Left is their ideal, right is yours. Both sides weight the issues differently, and their weights are hidden.
- **One move per round:** table a package, accept their offer, mobilize, issue a public warning, make a goodwill gesture, open a back channel, draw a red line, call a mediator, issue an ultimatum, or walk out.
- **A hidden leader temperament**, drawn at random each game:
  - **Opportunist:** firmness works and concessions invite more demands (deterrence model).
  - **Insecure:** threats trigger counter-escalation and reassurance works (spiral model).
  - **Pragmatist:** responds mostly to the numbers on the table.
- **An escalation ladder.** Past the danger line, incidents can start a war nobody ordered.
- **Ratification at home.** Your legislature's bar rises as your domestic support falls, and crossing your own public red line sinks the deal.
- **Crisis events** interrupt the talks with two-way choices.
- **Debrief.** It reveals who you faced and their true priorities, and charts the bargaining space: the Pareto frontier, the real ZOPA, every offer made, and how much value you left on the table. It also lists the turning points with the concept behind each.

## Concepts covered

Bargaining model of war (Fearon), BATNA, ZOPA, logrolling and issue linkage, costly signaling, cheap talk, audience costs, two-level games (Putnam), spiral vs. deterrence models (Jervis), private information, commitment problems, mediation, brinkmanship (Schelling), rally-round-the-flag, and Pareto efficiency. Each Codex entry has a short explanation, how it shows up in play, and a key reading.

## Code layout

```
src/engine/   pure game logic (no React): state, AI, scoring, Pareto math + tests
src/data/     scenarios, concept Codex, leader dialogue
src/ui/       React screens: Title, Briefing, Table, Debrief, Codex
```

The engine is deterministic for a given seed, so games can be replayed and tested. The other side's model works like this:

- **Reservation point:** what they need to beat no deal. It shifts with how resolved they think you are, how afraid they are, and what has happened in the talks so far.
- **Aspiration:** what they currently demand. It starts high and decays toward the reservation point as the clock runs down, at a rate set by their temperament.
- **Counteroffers:** they concede first on the issues they care least about, so their offers reveal their priorities.

## Adding a scenario

Add a `Scenario` object to `src/data/scenarios.ts`. It needs:

- the issues, each with a `format` function for its labels
- both sides' weights
- the number of rounds
- reservation and ratification baselines
- an escalation ladder
- the breakdown outcomes
- a handful of events
