# Tossup

A polling aggregator, forecast and election-night tool for the 2026 US midterms. Generic ballot,
presidential approval, Senate, governor and House, with maps, a Monte Carlo forecast, a "what if"
lab, and an election-night HQ (run of show, what to watch, bellwethers, a live map with a
win-probability needle, and bingo).

Data is current to **2026-09-29** (`AS_OF` in `src/engine/model.ts`). Read the in-app **How it
works** page (`#/methods`) for the sources, the model, and an honest list of what is estimated or
missing. The short version: polls came from web search with a source link on every poll; House
ratings are cited for competitive seats where a public Cook or Sabato rating was found and
estimated everywhere else.

## Run it

```bash
cd tossup
npm install
npm run dev          # http://localhost:5173
npm test             # aggregation, simulation, data and election-night tests
npm run build        # static site in dist/
npm run build:single # one self-contained dist-single/index.html (fonts, data and worker inlined)
```

## Layout

| Path | What is there |
| --- | --- |
| `data/polls/*.jsonl` | Source of truth for polls, one JSON object per line |
| `scripts/build-data.mjs` | `npm run data`: validates the JSONL and writes `src/data/generated/polls.json` |
| `scripts/build-geo.mjs`, `build-hex.mjs` | Rebuild the state map paths and the 435-district hex cartogram |
| `src/data/` | States, races (Senate, governor), House seats, pollster grades, ratings, history |
| `src/engine/aggregate.ts` | Kalman smoother with house effects; race poll averages |
| `src/engine/model.ts` | National environment, race models (polls + fundamentals + ratings) |
| `src/engine/sim.ts` | Correlated Monte Carlo, conditioning on called races and partial counts |
| `src/engine/night.ts` | Practice-night simulator, feed parser, results to simulation constraints |
| `src/ui/` | Pages, charts, maps; everything is hand-built SVG |
| `scripts/qa/` | Playwright sweeps used for layout QA (overflow at phone width, night tabs, single-file build) |

## Updating polls

Add lines to a file in `data/polls/`, then `npm run data`:

```json
{"race":"senate-nc","pollster":"Emerson College","start":"2026-09-21","end":"2026-09-23","n":900,"pop":"lv","d":47,"r":45,"source":"https://example.com/poll"}
```

- The file name decides the kind of poll: `generic*.jsonl` holds generic-ballot polls (no `race` needed),
  `approval*.jsonl` holds approval polls, and every other file holds race polls, where `race` is a race id
  such as `senate-ga`, `governor-az` or `house-pa-07`.
- `pop` is `lv`, `rv` or `a`. Optional: `note`, `internal` (`"D"` or `"R"` sponsor), `approx: true`
  (only a release date was found), `twoParty: true` (toplines exclude undecideds), `indep: "D"`.
- Approval polls use `approve` and `disapprove` instead of `d` and `r`.
- Pollster grade and lean priors live in `src/data/pollsters.ts`. Unknown pollsters are graded C.

Ratings live in `src/data/races.ts` (Senate, governor) and `OVERRIDES` in `src/data/house.ts`.
Change `AS_OF` in `src/engine/model.ts` to the new date.

Polls can also be added at runtime in the browser on the **Polls** page; those are kept in
`localStorage`, marked "yours", and never leave the browser.

## Election night

The **Live map** has three sources:

1. **Practice night**: one simulated evening drawn from the model, at the real poll-closing times.
2. **Type it in**: enter percent counted and the candidates' votes for any race, or call it.
3. **Live feed**: paste JSON or give a URL that returns it (the server must allow CORS; otherwise put a
   small proxy in front). The adapter has been tested against sample data only, not against a
   real results provider.

```json
{
  "updated": "2026-11-03T21:15:00-05:00",
  "races": {
    "senate-nc":   { "reporting": 42,   "d": 51.3,  "r": 48.7, "called": null },
    "house-pa-07": { "reporting": 0.65, "d": 61250, "r": 60110 },
    "governor-ga": { "reporting": 100,  "d": 49.4,  "r": 50.6, "called": "R" }
  }
}
```

`reporting` is 0-100 or 0-1. `d` and `r` may be counts or percentages. `called` is `"D"`, `"R"`, `"I"` or omitted.

## Honest limits

- House competitive-seat research is incomplete; many House ratings are estimates and are marked as such.
- There are almost no district-level polls.
- Several data hosts were unreachable when this was built, so polls came from news coverage and
  aggregator pages rather than from the raters' or pollsters' own tables.
- FLIPR (Silver Bulletin), VoteHub and FiveThirtyEight were feature references only. No code or data was taken from them.
