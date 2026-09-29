import { useMemo } from 'react';
import { Link } from '../../router';
import { consensus } from '../../data/ratings';
import { EVENTS, GENERIC_PUBLISHED, APPROVAL_PUBLISHED } from '../../data/benchmarks';
import { AS_OF, ELECTION_DAY } from '../../engine/model';
import { leverage, phraseFor } from '../../engine/insights';
import { fmtDate } from '../../engine/stats';
import { useForecast } from '../../state/forecast';
import { ALL_RACES, APPROVAL, GENERIC, GENERIC_POLLS, RACE_BY_ID, RACE_POLLS, pollAverageFor } from '../../state/data';
import { Ring, Sparkline } from '../charts/Basic';
import { RatingPill } from '../components/bits';
import { daysUntil, lead, plainOdds, prob, signed } from '../format';
import type { Poll } from '../../data/types';
import { HouseMapMini, StateMapMini } from '../maps/MiniMaps';

function OddsCard({ title, pD, seats, sub, to, needLabel }: { title: string; pD: number | null; seats?: string; sub?: string; to: string; needLabel: string }) {
  return (
    <Link to={to} className="odds-card">
      <div className="label">{title}</div>
      {pD === null ? (
        <div className="skeleton" style={{ width: 150, height: 150, borderRadius: '50%', margin: '12px 0' }} />
      ) : (
        <Ring pD={pD} size={150} stroke={15} label={`${title}: Democrats ${Math.round(pD * 100)} percent`}>
          <div>
            <div className="kpi" style={{ fontSize: 38 }}>{prob(pD)}</div>
            <div className="faint" style={{ fontSize: 12, fontWeight: 700 }}>Dem. chance</div>
          </div>
        </Ring>
      )}
      {pD !== null && (
        <>
          <div className="odds-line">{seats}</div>
          <div className="faint odds-sub">{plainOdds(pD)}</div>
          <div className="faint odds-sub">{sub ?? needLabel}</div>
        </>
      )}
    </Link>
  );
}

function latestPolls(n: number): (Poll & { where: string; to?: string })[] {
  const all: (Poll & { where: string; to?: string })[] = GENERIC_POLLS.map((p) => ({ ...p, where: 'Generic ballot', to: 'generic' }));
  for (const [id, list] of Object.entries(RACE_POLLS)) {
    const meta = RACE_BY_ID[id];
    for (const p of list) all.push({ ...p, where: meta?.title ?? id, to: `race/${id}` });
  }
  return all.sort((a, b) => (a.end < b.end ? 1 : a.end > b.end ? -1 : 0)).slice(0, n);
}

export function Home() {
  const { result, running, config } = useForecast();
  const days = daysUntil(ELECTION_DAY, AS_OF);
  const lev = useMemo(() => (result ? leverage(result).filter((l) => l.office !== 'governor').slice(0, 10) : []), [result]);
  const polls = useMemo(() => latestPolls(9), []);
  const genericSeries = GENERIC.trend.slice(-70).map((t) => t.mean);
  const approvalSeries = APPROVAL.trendApprove.slice(-40).map((t) => t.mean);
  const iran = EVENTS[0];
  void iran;

  const pH = result?.house.pControl ?? null;
  const pS = result?.senate.pControl ?? null;
  const pG = result?.governor.pControl ?? null;

  return (
    <div className="stack" style={{ gap: 26 }}>
      <section className="hero card">
        <div className="hero-copy">
          <div className="eyebrow">{days} days to Election Day · updated {fmtDate(AS_OF, { month: 'long', day: 'numeric' })}</div>
          <h1>
            {pH === null ? 'Crunching 20,000 elections…' : phraseFor(pH, 'the House') + '.'}
            <br />
            <span className="muted">{pS === null ? '' : phraseFor(pS, 'the Senate') + '.'}</span>
          </h1>
          <p className="lede">
            Tossup averages the polls, adds what we know about each state and district, and plays out Election Day 20,000 times. Democrats lead the generic ballot by <b>{lead(GENERIC.margin)}</b>, and President Trump's approval sits at <b>{APPROVAL.approve.toFixed(0)}%</b>.
          </p>
          <div className="row" style={{ marginTop: 18 }}>
            <Link to="lab" className="btn gold">Play with the flip lab</Link>
            <Link to="night" className="btn">Election night HQ</Link>
            <Link to="methods" className="btn">How it works</Link>
          </div>
          {running && result && <div className="faint" style={{ marginTop: 10, fontSize: 12 }}>Re-running the model…</div>}
        </div>
        <div className="hero-odds">
          <OddsCard title="House" pD={pH} seats={result ? `${result.house.median} D seats · ${result.house.p10}–${result.house.p90}` : undefined} sub={result ? `${result.houseNeeded} needed` : undefined} to="house" needLabel="218 needed" />
          <OddsCard title="Senate" pD={pS} seats={result ? `${result.senate.median} D seats · ${result.senate.p10}–${result.senate.p90}` : undefined} sub={result ? '51 needed (VP breaks ties for GOP)' : undefined} to="senate" needLabel="51 needed" />
          <OddsCard title="Governors" pD={pG} seats={result ? `${result.governor.median} D governors · ${result.governor.p10}–${result.governor.p90}` : undefined} sub={result ? '26 for a majority' : undefined} to="governors" needLabel="26 needed" />
        </div>
      </section>

      <section className="grid g2">
        <Link to="generic" className="card link-card">
          <div className="card-head">
            <div>
              <div className="label">Generic ballot</div>
              <div className="kpi lg dem">{lead(GENERIC.margin)}</div>
            </div>
            <Sparkline values={genericSeries} color="var(--dem)" width={170} height={64} />
          </div>
          <div className="muted" style={{ fontSize: 14 }}>
            {GENERIC.d.toFixed(1)}% Democratic to {GENERIC.r.toFixed(1)}% Republican across {GENERIC_POLLS.length} polls. Others' averages: {GENERIC_PUBLISHED.slice(0, 3).map((p) => `${p.who} D+${p.value}`).join(', ')}.
          </div>
        </Link>
        <Link to="approval" className="card link-card">
          <div className="card-head">
            <div>
              <div className="label">Trump approval</div>
              <div className="kpi lg rep">{APPROVAL.approve.toFixed(1)}%</div>
            </div>
            <Sparkline values={approvalSeries} color="var(--rep)" width={170} height={64} />
          </div>
          <div className="muted" style={{ fontSize: 14 }}>
            {APPROVAL.disapprove.toFixed(1)}% disapprove, a net of {signed(APPROVAL.net)}. Others' averages range from {Math.min(...APPROVAL_PUBLISHED.map((p) => p.approve))}% to {Math.max(...APPROVAL_PUBLISHED.map((p) => p.approve))}% approve.
          </div>
        </Link>
      </section>

      <section>
        <div className="sec-head">
          <h2>The four possible worlds</h2>
          <span className="sub">How the House and Senate might land together</span>
        </div>
        <div className="grid g4 worlds">
          {result ? (
            (
              [
                ['dd', 'Blue sweep', 'Democrats win both chambers', result.joint.dd, 'var(--dem)'],
                ['dr', 'Split: blue House', 'Democrats take the House, Republicans hold the Senate', result.joint.dr, 'var(--toss-fill)'],
                ['rd', 'Split: blue Senate', 'Republicans keep the House, Democrats take the Senate', result.joint.rd, 'var(--toss-fill)'],
                ['rr', 'Red hold', 'Republicans keep both chambers', result.joint.rr, 'var(--rep)'],
              ] as const
            ).map(([k, name, desc, p, color]) => (
              <div className="card world" key={k}>
                <div className="world-bar" style={{ background: color, width: `${Math.max(4, p * 100)}%` }} />
                <div className="kpi sm">{prob(p)}</div>
                <h3>{name}</h3>
                <p className="muted">{desc}</p>
              </div>
            ))
          ) : (
            [0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 130 }} />)
          )}
        </div>
      </section>

      <section className="grid g-main-side">
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Races that move the needle</h3>
              <div className="sub">Ranked by how much deciding each one shifts the odds of chamber control</div>
            </div>
            <Link to="forecast" className="btn sm">Full forecast</Link>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Race</th>
                  <th>Poll average</th>
                  <th>Dem. win</th>
                  <th>If D wins</th>
                  <th>If R wins</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                {lev.map((l) => {
                  const meta = RACE_BY_ID[l.id];
                  const avg = pollAverageFor(l.id === '' ? '' : l.id);
                  const cons = consensus(meta);
                  const ch = l.office === 'senate' ? 'Senate' : 'House';
                  return (
                    <tr key={l.id}>
                      <td>
                        <Link to={`race/${l.id}`}>{meta.title}</Link>
                        <span className="chip" style={{ marginLeft: 8 }}>{ch}</span>
                      </td>
                      <td className="num">{avg ? lead(avg.margin) : <span className="faint">no polls</span>}</td>
                      <td className="num"><b>{prob(l.pD)}</b></td>
                      <td className="num dem">{prob(l.pCtrlIfD)}</td>
                      <td className="num rep">{prob(l.pCtrlIfR)}</td>
                      <td><RatingPill rating={cons.rating} est={cons.source !== 'cited'} /></td>
                    </tr>
                  );
                })}
                {!lev.length && (
                  <tr>
                    <td colSpan={6}><div className="skeleton" style={{ height: 200 }} /></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="faint" style={{ fontSize: 12.5, marginTop: 10 }}>
            "If D wins" and "If R wins" are the chamber-control odds for Democrats in each case. Dashed pills are our estimates where no specific rater's rating was found.
          </p>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h3>Senate at a glance</h3>
              <Link to="senate" className="btn sm">Open</Link>
            </div>
            <StateMapMini office="senate" />
          </div>
          <div className="card">
            <div className="card-head">
              <h3>House at a glance</h3>
              <Link to="house" className="btn sm">Open</Link>
            </div>
            <HouseMapMini />
          </div>
        </div>
      </section>

      <section className="grid g-main-side">
        <div className="card">
          <div className="card-head">
            <h3>Fresh polls</h3>
            <Link to="polls" className="btn sm">All polls</Link>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Where</th>
                  <th>Pollster</th>
                  <th>Result</th>
                  <th>Ended</th>
                </tr>
              </thead>
              <tbody>
                {polls.map((p) => (
                  <tr key={p.id}>
                    <td><Link to={p.to ?? 'polls'}>{p.where}</Link></td>
                    <td>
                      <a href={p.source} target="_blank" rel="noreferrer noopener" title="Open the source">{p.pollster}</a>
                      {p.approx && <span className="faint" title="Only a release date was found; field dates are approximate."> ~</span>}
                    </td>
                    <td className="num">
                      {p.d !== null && p.r !== null ? (
                        <>
                          <span className="dem">{p.d}</span>–<span className="rep">{p.r}</span>{' '}
                        </>
                      ) : null}
                      <b className={p.margin > 0 ? 'dem' : p.margin < 0 ? 'rep' : ''}>{lead(p.margin, 0)}</b>
                    </td>
                    <td className="faint">{fmtDate(p.end)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card tint">
          <h3>Where should I start?</h3>
          <div className="stack" style={{ gap: 12, marginTop: 14 }}>
            <Link to="lab" className="tile-link"><b>Flip lab.</b> Click races to flip them and watch the chamber odds move, or drag the national mood.</Link>
            <Link to="night" className="tile-link"><b>Election night HQ.</b> Poll-close times, what to watch each hour, and a live map with a win-probability needle. Try the practice night.</Link>
            <Link to="senate" className="tile-link"><b>Senate.</b> Map, tipping-point chart and every race's polls.</Link>
            <Link to="polls" className="tile-link"><b>Poll explorer.</b> Every poll behind the numbers, filterable, with a source link on each.</Link>
          </div>
          <p className="faint" style={{ marginTop: 16, fontSize: 12.5 }}>
            {ALL_RACES.length} races modeled. House ratings for many safe seats are estimates; look for dashed pills and the "estimated" tags.
          </p>
        </div>
      </section>
      <span className="sr-only">{config.flavor}</span>
    </div>
  );
}
