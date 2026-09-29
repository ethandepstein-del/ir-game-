import { useMemo, type ReactNode } from 'react';
import { HOUSE_SEATS } from '../../data/house';
import { MIDTERMS, fitMidterms } from '../../data/history';
import { GENERIC_PUBLISHED, OUTSIDE_FORECASTS } from '../../data/benchmarks';
import { SENATE_RACES, GOVERNOR_RACES } from '../../data/races';
import { consensus } from '../../data/ratings';
import { TIER_VAR, pollsterInfo } from '../../data/pollsters';
import { AS_OF, ADJ, DEFAULT_CONFIG, RATINGS_MOOD } from '../../engine/model';
import { fmtDate } from '../../engine/stats';
import { Link } from '../../router';
import { ALL_POLL_COUNT, APPROVAL_POLLS, DATA_BUILT, GENERIC, GENERIC_POLLS, RACE_POLLS } from '../../state/data';
import { Under } from '../components/bits';

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="card meth">
      <div className="eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function jump(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function Methods() {
  const fit = fitMidterms();
  const stats = useMemo(() => {
    const tally = (list: { ratingSource?: string; ratings: object; estRating?: unknown }[]) => {
      const cited = list.filter((r) => Object.keys(r.ratings).length > 0).length;
      return { n: list.length, cited, est: list.length - cited };
    };
    const houseSrc = { cited: 0, estimated: 0, dflt: 0 };
    for (const h of HOUSE_SEATS) {
      const c = consensus(h);
      if (c.source === 'cited') houseSrc.cited++;
      else if (c.source === 'estimated') houseSrc.estimated++;
      else houseSrc.dflt++;
    }
    const raceCount = Object.keys(RACE_POLLS).length;
    const hosts = new Map<string, number>();
    const add = (u: string) => {
      try {
        const h = new URL(u).hostname.replace(/^www\./, '');
        hosts.set(h, (hosts.get(h) ?? 0) + 1);
      } catch {
        /* unparseable link */
      }
    };
    GENERIC_POLLS.forEach((p) => add(p.source));
    APPROVAL_POLLS.forEach((p) => add(p.source));
    Object.values(RACE_POLLS).flat().forEach((p) => add(p.source));
    const topHosts = [...hosts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return { senate: tally(SENATE_RACES), gov: tally(GOVERNOR_RACES), houseSrc, raceCount, topHosts };
  }, []);

  const houseEffects = Object.entries(GENERIC.fit.houseEffects)
    .filter(([, v]) => v.n >= 2)
    .sort((a, b) => b[1].effect - a[1].effect);

  const feedExample = `{
  "updated": "2026-11-03T21:15:00-05:00",
  "races": {
    "senate-nc": { "reporting": 42, "d": 51.3, "r": 48.7, "called": null },
    "house-pa-07": { "reporting": 0.65, "d": 61250, "r": 60110 },
    "governor-ga": { "reporting": 100, "d": 49.4, "r": 50.6, "called": "R" }
  }
}`;

  const jsonl = `{"race":"senate-nc","pollster":"Emerson College","start":"2026-09-21","end":"2026-09-23",
 "n":900,"pop":"lv","d":47,"r":45,"source":"https://…"}`;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">Show your work</div>
          <h1>How Tossup works</h1>
          <p className="lede">Where every number comes from, what we guessed, and how the odds get made. If something here looks wrong to you, it might be. That is why it is written down.</p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="chip" onClick={() => jump('sources')}>Sources</button>
          <button className="chip" onClick={() => jump('gaps')}>What's missing</button>
          <button className="chip" onClick={() => jump('model')}>The model</button>
          <button className="chip" onClick={() => jump('calls')}>Judgment calls</button>
          <button className="chip" onClick={() => jump('night')}>Election night</button>
          <button className="chip" onClick={() => jump('refresh')}>Refreshing</button>
        </div>
      </div>

      <div className="callout">
        <b>The short version.</b> Tossup averages the polls, adds what we know about each district and state that polls can't see, blends the two, then plays the election {DEFAULT_CONFIG.nSims.toLocaleString()} times with shared, correlated errors. The odds are how often each side wins. Data is current to <b>{fmtDate(AS_OF)}</b>{DATA_BUILT ? <> (built {fmtDate(DATA_BUILT.slice(0, 10))})</> : null}.
      </div>

      <Section id="sources" eyebrow="Where it comes from" title="The data, and how honest we can be about it">
        <p>
          We gathered <b>{ALL_POLL_COUNT} polls</b> by web search, {GENERIC_POLLS.length} generic-ballot, {APPROVAL_POLLS.length} presidential-approval and {ALL_POLL_COUNT - GENERIC_POLLS.length - APPROVAL_POLLS.length} in {stats.raceCount} specific races. Every poll links to where we found it; the source is in the last column of the <Link to="/polls">poll explorer</Link>. Most links go to news write-ups, Wikipedia-style poll tables, or the pollster's own release.
        </p>
        <div className="grid g2" style={{ gap: 16, marginTop: 10 }}>
          <div>
            <div className="label">Where the polls came from</div>
            <table className="tbl">
              <tbody>
                {stats.topHosts.map(([h, n]) => (
                  <tr key={h}><td>{h}</td><td className="r num">{n}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div className="label">Expert ratings (Cook, Sabato, Inside Elections)</div>
            <table className="tbl">
              <tbody>
                <tr><td>Senate races with a rating we found and cited</td><td className="r num">{stats.senate.cited} / {stats.senate.n}</td></tr>
                <tr><td>Governor races with a rating we found and cited</td><td className="r num">{stats.gov.cited} / {stats.gov.n}</td></tr>
                <tr><td>House seats with a cited rating</td><td className="r num">{stats.houseSrc.cited} / {HOUSE_SEATS.length}</td></tr>
                <tr><td>House seats with our estimated rating</td><td className="r num">{stats.houseSrc.estimated}</td></tr>
                <tr><td>House seats defaulting to "Safe for the holder"</td><td className="r num">{stats.houseSrc.dflt}</td></tr>
              </tbody>
            </table>
            <p className="faint" style={{ fontSize: 13, marginTop: 6 }}>Estimated ratings are marked with a dotted outline wherever they appear.</p>
          </div>
        </div>
        <Under title="How we treat individual polls">
          <ul className="bullets">
            <li><b>Population.</b> Likely-voter, registered-voter and adult samples are put on one scale using a population effect estimated from the polls themselves, so a poll of adults isn't compared to a poll of likely voters as if they were the same thing.</li>
            <li><b>Two-party numbers.</b> Some pollsters only publish Democrat-versus-Republican shares with the undecideds removed. Those margins are scaled down to 91% so they read like ordinary toplines.</li>
            <li><b>Internal polls</b> released by a campaign or party are marked, and their margin is moved 3 to 4 points against the sponsor.</li>
            <li><b>Approximate dates.</b> If we only found a release date, the field dates are marked with a tilde (~) and the poll counts about 15% less.</li>
            <li><b>Pollster grades (A/B/C)</b> are our own judgment from track record and transparency, not anyone's official rating. Lower grades count for less: an A counts {TIER_VAR.A}×, a B {(1 / TIER_VAR.B).toFixed(2)}× and a C {(1 / TIER_VAR.C).toFixed(2)}× as much.</li>
          </ul>
        </Under>
      </Section>

      <Section id="gaps" eyebrow="What we could not get" title="Known gaps">
        <ul className="bullets">
          <li><b>House is the thinnest part.</b> There are almost no district polls, and the paywalled rating tables from the big raters were out of reach. Cited ratings come from what Cook and Sabato published publicly in late September. Everything else is our estimate from each seat's holder, the 2024 result and the state's political lean. The competitive races matter most, and that's where the research went first, but a seat listed as Safe in our data may be rated Likely by the raters.</li>
          <li><b>Redistricting.</b> Several states redrew their maps this cycle (California's Prop 50, Texas, Florida, Ohio, North Carolina; Missouri's is on hold). We flagged the most prominent redrawn seats one by one, but the "holder" of a seat is who has it today, not who the new lines favor. If a seat looks wrong, it probably is; a rating override is a one-line edit.</li>
          <li><b>Some nominees are unknown to us</b> (a few Senate and governor primaries, notably in MA, OR and RI). Those races use partisan lean and the holder's party only.</li>
          <li><b>No live results yet.</b> Nobody has voted. The Election night tools run on a practice night, manual entry, or a JSON feed you point them to. The feed adapter has been tested with sample data only, not a real results provider.</li>
          <li><b>Some sites blocked us.</b> Several sources we would normally use (Wikipedia, RealClearPolling, VoteHub, FiveThirtyEight archives, the FEC, Ballotpedia) were unreachable from where this was built, so polls came from news coverage and aggregator pages instead. If a poll you know about is missing, add it on the <Link to="/polls">Polls</Link> page and watch the averages move.</li>
          <li><b>Early trend is sparse.</b> The generic-ballot trend line before June relies on few polls, so it is shaded to say so.</li>
        </ul>
      </Section>

      <Section id="model" eyebrow="The model" title="From polls to odds, in five steps">
        <ol className="steps">
          <li>
            <h4>1 · Average the polls</h4>
            <p>A Kalman-style smoother turns scattered polls into a trend line with an honest uncertainty band. Each pollster gets a <b>house effect</b>, its average lean relative to everyone else, estimated from the data but shrunk toward a prior so a few polls can't swing it. Recent, larger, higher-graded polls count more; a pollster that releases many polls in a row doesn't get to dominate.</p>
            <Under title="Numbers">
              <p>Today the generic-ballot average is <b className="dem">D+{GENERIC.margin.toFixed(1)}</b> (±{(1.645 * GENERIC.sd).toFixed(1)} for 90% of the time), {GENERIC.d.toFixed(1)}% to {GENERIC.r.toFixed(1)}%. Race averages use a 16-day half-life on recency and add a shared error of 2.6 points, because polls in the same race aren't independent of each other.</p>
              <div className="tbl-wrap" style={{ marginTop: 8 }}>
                <table className="tbl">
                  <thead><tr><th>Pollster</th><th>Grade</th><th className="r">Polls</th><th className="r">Prior lean</th><th className="r">Estimated lean</th></tr></thead>
                  <tbody>
                    {houseEffects.map(([name, v]) => (
                      <tr key={name}>
                        <td>{name}</td>
                        <td><span className="chip">{pollsterInfo(name).tier}</span></td>
                        <td className="r num">{v.n}</td>
                        <td className="r num">{v.prior > 0 ? '+' : ''}{v.prior.toFixed(1)}</td>
                        <td className="r num"><b>{v.effect > 0 ? '+' : ''}{v.effect.toFixed(1)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="faint" style={{ fontSize: 13 }}>Positive means a lean toward Democrats compared with the pack. Effects are re-centred so the average pollster has none.</p>
            </Under>
          </li>
          <li>
            <h4>2 · Estimate the national mood</h4>
            <p>The national environment combines two signals, each weighted by how certain it is: the generic-ballot average, and what the president's approval rating implies from history. Midterms punish the president's party more when he is unpopular, and that has held since 1994 with a few exceptions.</p>
            <Under title="Numbers">
              <p>A regression across eight midterms (1994–2022) says the out-party's House margin ≈ <b>{fit.intercept.toFixed(1)} + {fit.slope.toFixed(2)} × (minus net approval)</b>. With so few data points, it has a wide error band and the model treats it as a sanity check, not a headline.</p>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>Year</th><th>President</th><th className="r">Net approval</th><th className="r">House vote</th></tr></thead>
                  <tbody>{MIDTERMS.map((m) => (<tr key={m.year}><td>{m.year}</td><td>{m.president}</td><td className="r num">{m.net > 0 ? '+' : ''}{m.net}</td><td className="r num">{m.houseMargin > 0 ? 'D+' : 'R+'}{Math.abs(m.houseMargin).toFixed(1)}</td></tr>))}</tbody>
                </table>
              </div>
              <p className="faint" style={{ fontSize: 13 }}>Approximate late-cycle values, rounded. Good for a sanity check; not audited to the decimal.</p>
            </Under>
          </li>
          <li>
            <h4>3 · Build each race's expected margin</h4>
            <p>For every seat we blend up to three ingredients, each weighted by how precise it is: the <b>race polls</b> (if any), the <b>fundamentals</b> (the state or district's partisan lean, plus the national mood, plus a bonus for incumbents), and the <b>expert ratings</b>. Races with lots of polls lean on the polls. Races with none lean on fundamentals and ratings. You can turn any ingredient up or down on the <Link to="/forecast">Forecast</Link> page.</p>
            <Under title="Numbers">
              <ul className="bullets">
                <li>State lean is 75% of the 2024 presidential result and 25% of 2020, measured relative to the nation.</li>
                <li>Incumbency: Senate and House +2, Governor +3 points; half of that for appointed incumbents.</li>
                <li>Swing states move more with the national mood than lopsided ones. Elasticity runs from 1.05 in the closest seats down to 0.72 in the safest.</li>
                <li>Expert ratings map to margins: Safe ±24, Likely ±12, Lean ±6, Tilt ±3, Toss-up 0. When several raters have rated the same race we average them.</li>
              </ul>
            </Under>
          </li>
          <li>
            <h4>4 · Simulate, with correlated mistakes</h4>
            <p>This is the step that keeps odds honest. Polls miss together: if Democrats are overrated in Pennsylvania, they're probably overrated in Michigan too. Each simulated election draws one national shock, one shock per region, one per type of office, and a small independent error per race. Then we count seats.</p>
            <Under title="Numbers">
              <p>Shocks: national σ = {DEFAULT_CONFIG.sigmaNat}, region σ = {DEFAULT_CONFIG.sigmaRegion} (seven regions), office σ = {DEFAULT_CONFIG.sigmaOffice} (Senate, Governor and House each get their own), plus per-race error from the blend. {DEFAULT_CONFIG.nSims.toLocaleString()} simulations per run in a background thread. You can change every σ on the Forecast page. The randomness is seeded, so the same settings produce the same odds every time.</p>
            </Under>
          </li>
          <li>
            <h4>5 · Read off the answers</h4>
            <p>Chamber control is the share of simulations where a party gets enough seats: 51 for the Senate (assuming a Republican Vice President breaks ties), 218 for the House, 26 for governors. Every race odds, the seat histogram, tipping-point states and "if X wins, then…" numbers come from the same runs, so they always agree with each other.</p>
          </li>
        </ol>
      </Section>

      <Section id="calls" eyebrow="Where we made a call" title="Judgment calls you should know about">
        <p>Every forecast has a few of these. Here are ours, so you can disagree with them.</p>
        <div className="grid g2" style={{ gap: 16 }}>
          <div className="callout info">
            <b>The House mood setting ({RATINGS_MOOD.toFixed(1)}).</b> Expert ratings were set when the national mood was roughly D+{RATINGS_MOOD.toFixed(0)}. So for House seats, we treat a rating as "how a seat votes in a D+{RATINGS_MOOD.toFixed(0)} year" and shift it with today's mood. It is the most important knob for the House, and the one we're least sure about. Lower it and Republicans do better; raise it and Democrats do. Try it in the Flip lab or override the national environment on the Forecast page.
          </div>
          <div className="callout info">
            <b>Independents in the Senate.</b> Dan Osborn (NE) and Todd Achilles (ID) are independents. By default they don't count toward Democratic control, because we don't know whom they'd caucus with. There's a switch on the Forecast page.
          </div>
        </div>
        <div className="tbl-wrap" style={{ marginTop: 14 }}>
          <table className="tbl">
            <thead><tr><th>Race</th><th className="r">Adjustment (points)</th><th>Why</th></tr></thead>
            <tbody>
              {Object.entries(ADJ).map(([id, a]) => (
                <tr key={id}><td>{id.replace('senate-', '').toUpperCase()} Senate</td><td className="r num"><b className={a.adj > 0 ? 'dem' : 'rep'}>{a.adj > 0 ? 'D+' : 'R+'}{Math.abs(a.adj)}</b></td><td>{a.note}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="faint" style={{ fontSize: 13, marginTop: 8 }}>These nudge the <i>fundamentals</i> only, the part of the blend that doesn't come from polls. Where polls exist, they take over.</p>
        <Under title="How Tossup compares with other forecasts">
          <p>For reference, here's what others say. They are quoted as found on {fmtDate(AS_OF)} and may have moved. We used them to sanity-check our output, never to tune it to match.</p>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Who</th><th>House</th><th>Senate</th><th>As of</th></tr></thead>
              <tbody>
                {OUTSIDE_FORECASTS.map((f) => (
                  <tr key={f.who}><td><a href={f.url} target="_blank" rel="noreferrer noopener">{f.who}</a></td><td>{f.house ?? '—'}</td><td>{f.senate ?? '—'}</td><td className="faint">{fmtDate(f.date)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="faint" style={{ fontSize: 13, marginTop: 6 }}>Generic-ballot averages elsewhere range from D+{Math.min(...GENERIC_PUBLISHED.map((g) => g.value)).toFixed(1)} to D+{Math.max(...GENERIC_PUBLISHED.map((g) => g.value)).toFixed(1)}. Ours is D+{GENERIC.margin.toFixed(1)}. Tossup takes ideas from projects like FiveThirtyEight, Silver Bulletin's FLIPR and VoteHub (average the polls, blend with fundamentals, simulate with correlated error) but uses none of their code or data.</p>
        </Under>
      </Section>

      <Section id="night" eyebrow="Election night" title="How the needle works">
        <p>On election night, the results feed into the same simulation. A called race pins that outcome. A partial count pins its <i>likely</i> outcome: 10% of the vote in Georgia tells you a little, 90% tells you a lot. Because errors are shared, results in one state move the odds in others, which is exactly how a real needle behaves. Bellwether scores come from the same math: a state's score is how much of the national swing shows up in it, relative to its own noise.</p>
        <div className="grid g2" style={{ gap: 16 }}>
          <div>
            <h4 style={{ margin: '4px 0' }}>The practice night</h4>
            <p>Since there are no real results yet, the app can play one simulated election in fast-forward: a hidden "truth" is drawn from the model, states report at their real poll-closing times, some count slowly, some lean toward one side early (the "blue shift" in West Coast states, for instance), and calls arrive when the lead is safe. It is a way to learn the tools before you need them. It is not a prediction.</p>
          </div>
          <div>
            <h4 style={{ margin: '4px 0' }}>Plugging in real results</h4>
            <p>Point the Live map at a JSON URL that returns the shape below, or paste it in. <code>reporting</code> is the share counted (0–100, or 0–1); <code>d</code> and <code>r</code> may be raw votes or percentages. Race ids are the ones in the URLs (<code>senate-nc</code>, <code>house-pa-07</code>). Browsers can only fetch URLs that allow cross-origin requests, so you may need a small proxy.</p>
          </div>
        </div>
        <pre className="code">{feedExample}</pre>
      </Section>

      <Section id="refresh" eyebrow="Keeping it current" title="Updating the data">
        <p>Everything is plain files in the repository. Polls live in <code>tossup/data/polls/*.jsonl</code>, one poll per line. After adding lines, run <code>npm run data</code> to rebuild <code>src/data/generated/polls.json</code>, then reload. Ratings live in <code>src/data/races.ts</code> and <code>src/data/house.ts</code>; set <code>AS_OF</code> in <code>src/engine/model.ts</code> to today's date.</p>
        <pre className="code">{jsonl}</pre>
        <p className="faint" style={{ fontSize: 13 }}>Optional fields: <code>note</code>, <code>internal</code> ("D" or "R" sponsor), <code>approx</code> (dates are approximate), <code>twoParty</code>. Race polls use ids like <code>senate-ga</code>. Files named <code>generic*.jsonl</code> and <code>approval*.jsonl</code> hold generic-ballot and approval polls; approval lines carry <code>approve</code> and <code>disapprove</code> instead of <code>d</code> and <code>r</code>. Polls you add in the browser on the Polls page skip all of this but only exist in your browser.</p>
      </Section>

      <div className="callout info">
        <b>One last thing.</b> A forecast of 78% is not a promise. It is a claim about how often things like this happen: about like flipping two heads in a row, minus a little. Toss-ups are toss-ups. The point of Tossup is to let you see how uncertain we really are, and what would change our mind.
      </div>
    </div>
  );
}
