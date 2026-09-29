import { Fragment, useMemo } from 'react';
import { RATING_LABEL } from '../../data/ratings';
import { STATE_BY_CODE } from '../../data/states';
import { pollsterInfo } from '../../data/pollsters';
import type { Candidate, Party } from '../../data/types';
import { fundamentalsBreakdown } from '../../engine/model';
import { raceAverage } from '../../engine/aggregate';
import { dayNum, fmtDate, isoFromDay, pollDay } from '../../engine/stats';
import { AS_OF } from '../../engine/model';
import { Link, navigate } from '../../router';
import { useForecast } from '../../state/forecast';
import { usePrefs } from '../../state/prefs';
import { ALL_RACES, RACE_BY_ID } from '../../state/data';
import { MarginCurve, RangeRow, Ring } from '../charts/Basic';
import { TrendChart } from '../charts/TrendChart';
import { PartyBar, RatingPill, Under } from '../components/bits';
import { RatingsStrip } from '../components/raceparts';
import { SortTable, type Col } from '../components/SortTable';
import { lead, plainOdds, prob, signed } from '../format';
import { useRows } from '../useRows';
import type { Poll } from '../../data/types';

function Side({ c, party, pD }: { c?: Candidate; party: Party; pD?: number }) {
  const cls = party === 'D' ? 'd' : party === 'R' ? 'r' : 'i';
  return (
    <div className={`side ${cls}`}>
      <div className="label">{party === 'D' ? 'Democratic' : party === 'R' ? 'Republican' : 'Independent'}</div>
      <div className="name">{c?.name ?? `${party === 'D' ? 'Democratic' : 'Republican'} nominee`}</div>
      <div className="faint" style={{ fontSize: 13, marginTop: 4 }}>
        {c?.incumbent ? 'Incumbent' : c ? '' : 'Name not in our data'}
        {c?.note ? `${c.incumbent ? ' · ' : ''}${c.note}` : ''}
      </div>
      {pD !== undefined && <div className={`num ${party === 'R' ? 'rep' : 'dem'}`} style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>{prob(party === 'R' ? 1 - pD : pD)}</div>}
    </div>
  );
}

function raceSeries(polls: Poll[]) {
  if (polls.length < 2) return null;
  const days = polls.map((p) => pollDay(p.start, p.end));
  const d0 = Math.min(...days);
  const d1 = dayNum(AS_OF);
  const out: { day: number; mean: number; sd: number }[] = [];
  for (let d = d0; d <= d1; d++) {
    const upto = polls.filter((p) => pollDay(p.start, p.end) <= d);
    if (!upto.length) continue;
    const a = raceAverage(upto, isoFromDay(d), { maxAgeDays: 120, halfLifeDays: 21 });
    if (Number.isFinite(a.margin)) out.push({ day: d, mean: a.margin, sd: Math.min(a.se, 9) });
  }
  return out.length > 1 ? out : null;
}

export function RacePage({ id }: { id: string }) {
  const meta = RACE_BY_ID[id];
  const office = meta?.office ?? 'senate';
  const rows = useRows(office);
  const { result, env, config } = useForecast();
  const { nerd } = usePrefs();
  const row = rows.find((r) => r.meta.id === id);
  const series = useMemo(() => (row ? raceSeries(row.polls) : null), [row]);

  if (!meta || !row) {
    return (
      <div className="card">
        <h2>We couldn't find that race</h2>
        <p className="muted" style={{ marginTop: 8 }}>Try the <Link to="senate">Senate</Link>, <Link to="governors">Governors</Link> or <Link to="house">House</Link> pages.</p>
      </div>
    );
  }
  const { model, sim, cons, avg, polls } = row;
  const st = STATE_BY_CODE[meta.state];
  const fb = fundamentalsBreakdown(meta, config.envOverride ?? env.blend);
  const leverageChamber = office === 'senate' ? 'the Senate' : office === 'governor' ? 'a majority of governorships' : 'the House';
  const others = ALL_RACES.filter((r) => r.state === meta.state && r.id !== meta.id && r.office !== 'house');
  const houseHere = ALL_RACES.filter((r) => r.state === meta.state && r.office === 'house');
  const D = meta.candidates.D;
  const R = meta.candidates.R;
  const I = meta.candidates.I;

  const dots = polls.map((p) => ({
    id: p.id,
    day: pollDay(p.start, p.end),
    value: p.margin,
    pollster: p.pollster,
    pop: p.pop,
    detail: `${p.d ?? '?'}–${p.r ?? '?'} · ${fmtDate(p.start)}–${fmtDate(p.end)}${p.approx ? ' (dates approximate)' : ''}`,
  }));

  const pcols: Col<Poll>[] = [
    { key: 'p', label: 'Pollster', sort: (a, b) => a.pollster.localeCompare(b.pollster), render: (p) => <a href={p.source} target="_blank" rel="noreferrer noopener">{p.pollster}</a> },
    { key: 'dates', label: 'Field dates', sort: (a, b) => (a.end < b.end ? -1 : 1), render: (p) => <span className="faint">{fmtDate(p.start)}–{fmtDate(p.end)}{p.approx ? ' ~' : ''}</span> },
    { key: 'n', label: 'Sample', right: true, sort: (a, b) => (a.n ?? 0) - (b.n ?? 0), render: (p) => <span className="num">{p.n ? p.n.toLocaleString() : '—'}{p.pop ? ` ${p.pop.toUpperCase()}` : ''}</span> },
    { key: 'res', label: 'D – R', right: true, render: (p) => <span className="num"><span className="dem">{p.d ?? '?'}</span>–<span className="rep">{p.r ?? '?'}</span></span> },
    { key: 'm', label: 'Margin', right: true, sort: (a, b) => a.margin - b.margin, render: (p) => <b className={`num ${p.margin > 0 ? 'dem' : 'rep'}`}>{lead(p.margin, 0)}</b> },
    { key: 'adj', label: 'Adjusted', right: true, nerd: true, render: (p) => (avg?.adjusted[p.id] !== undefined ? <span className="num">{lead(avg.adjusted[p.id])}</span> : <span className="faint">old</span>), title: 'After the pollster lean prior and any internal-poll penalty' },
    { key: 'w', label: 'Weight', right: true, nerd: true, render: (p) => <span className="num">{avg?.weights[p.id] !== undefined ? `${Math.round(avg.weights[p.id] * 100)}%` : '—'}</span> },
    { key: 'tier', label: 'Grade', nerd: true, render: (p) => <span className="chip" title={pollsterInfo(p.pollster).note}>{pollsterInfo(p.pollster).tier}</span> },
  ];

  const pCtrlD = sim?.pCtrlIfD;
  const pCtrlR = sim?.pCtrlIfR;
  const sideOrder: [Candidate | undefined, Party][] = [[D, 'D']];
  if (I && !D) sideOrder[0] = [I, 'I'];
  else if (I) sideOrder.push([I, 'I']);
  sideOrder.push([R, 'R']);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <Link to={office === 'senate' ? 'senate' : office === 'governor' ? 'governors' : 'house'} style={{ textDecoration: 'none' }}>{office === 'senate' ? 'Senate' : office === 'governor' ? 'Governor' : 'House'}</Link>
            {' · '}
            <Link to={`state/${meta.state.toLowerCase()}`} style={{ textDecoration: 'none' }}>{st.name}</Link>
            {meta.special ? ' · special election' : ''}
            {meta.open ? ' · open seat' : ''}
          </div>
          <h1>{meta.title}</h1>
          {meta.note && <p className="lede">{meta.note}</p>}
          {meta.leanNote && <p className="faint" style={{ margin: '4px 0 0', fontSize: 13.5 }}>District context: {meta.leanNote}.</p>}
        </div>
        <div className="row">
          <RatingPill rating={cons.rating} est={cons.source !== 'cited'} />
          <span className="chip">{meta.holder === 'D' ? 'Democratic-held' : 'Republican-held'}</span>
          {row.flips && <span className={`chip ${row.flips === 'D' ? 'dem' : 'rep'}`}>projected flip to {row.flips}</span>}
        </div>
      </div>

      <div className="vs">
        {sideOrder.map(([c, p], i) => (
          <Fragment key={p}>
            <Side c={c} party={p} pD={sim?.pD} />
            {i < sideOrder.length - 1 && <div className="mid">vs.</div>}
          </Fragment>
        ))}
      </div>

      <div className="grid g-main-side">
        <div className="card">
          <div className="card-head">
            <div>
              <h3>The forecast</h3>
              <div className="sub">The projected margin on Election Day, with the full range of what could happen</div>
            </div>
          </div>
          <div className="grid g2" style={{ alignItems: 'center' }}>
            <div className="row" style={{ gap: 20, flexWrap: 'nowrap' }}>
              {sim ? (
                <Ring pD={sim.pD} size={140} stroke={14} label={`Democrats ${Math.round(sim.pD * 100)} percent`}>
                  <div>
                    <div className="kpi" style={{ fontSize: 32 }}>{prob(sim.pD)}</div>
                    <div className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>Dem. win</div>
                  </div>
                </Ring>
              ) : <div className="skeleton" style={{ width: 140, height: 140, borderRadius: '50%' }} />}
              <div>
                <div className="label">Projected margin</div>
                <div className="kpi sm">{lead(row.margin)}</div>
                {sim && <div className="faint" style={{ fontSize: 13, marginTop: 4 }}>80% range {lead(sim.mean - 1.28 * sim.sd, 0)} to {lead(sim.mean + 1.28 * sim.sd, 0)}</div>}
                {sim && <div className="faint" style={{ fontSize: 13 }}>{plainOdds(sim.pD)}</div>}
              </div>
            </div>
            <div>{sim ? <MarginCurve mean={sim.mean} sd={sim.sd} label="Distribution of the projected margin" domain={office === 'house' ? 30 : 34} /> : <div className="skeleton" style={{ height: 150 }} />}</div>
          </div>
          {sim && <div style={{ marginTop: 12 }}><PartyBar d={sim.pD} r={1 - sim.pD} size="lg" /></div>}
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h3>Why it matters</h3>
              <div className="sub">Democratic odds of winning {leverageChamber}, depending on this race</div>
            </div>
          </div>
          {pCtrlD !== undefined && pCtrlR !== undefined && Number.isFinite(pCtrlD) && Number.isFinite(pCtrlR) ? (
            <div className="stack" style={{ gap: 12 }}>
              <div>
                <div className="spread"><span className="dem"><b>If Democrats win here</b></span><b className="num">{prob(pCtrlD)}</b></div>
                <PartyBar d={pCtrlD} r={1 - pCtrlD} />
              </div>
              <div>
                <div className="spread"><span className="rep"><b>If Republicans win here</b></span><b className="num">{prob(pCtrlR)}</b></div>
                <PartyBar d={pCtrlR} r={1 - pCtrlR} />
              </div>
              <div className="faint" style={{ fontSize: 13 }}>
                {Math.abs(pCtrlD - pCtrlR) > 0.2 ? 'A big swing: watch this one.' : Math.abs(pCtrlD - pCtrlR) > 0.08 ? 'A meaningful swing.' : 'It barely moves the chamber, either because the result is lopsided or the chamber is already decided.'}
              </div>
              <div className="spread">
                <span className="muted">Chance this race is the tipping point</span>
                <b className="num">{prob(row.tipping, 1)}</b>
              </div>
            </div>
          ) : (
            <div className="skeleton" style={{ height: 140 }} />
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>Polls</h3>
            <div className="sub">
              {polls.length ? `${polls.length} ${polls.length === 1 ? 'poll' : 'polls'} in our data. Filled dots are likely-voter polls, hollow are registered voters or adults. Blue means the Democrat leads.` : 'No public polls found for this race yet.'}
            </div>
          </div>
          {avg && <div style={{ textAlign: 'right' }}><div className="label">Average</div><div className="kpi sm">{lead(avg.margin)}</div></div>}
        </div>
        {series ? (
          <TrendChart
            series={series}
            dots={dots}
            partisan
            zero
            yFormat={(v) => (v === 0 ? 'Even' : `${v > 0 ? 'D' : 'R'}+${Math.abs(Math.round(v))}`)}
            valueFormat={(v) => lead(v)}
            height={260}
            endLabel={avg ? lead(avg.margin) : undefined}
            label={`Polling trend for ${meta.title}`}
          />
        ) : polls.length ? (
          <div className="callout info">Only {polls.length === 1 ? 'one poll' : 'a couple of polls'} so far, which isn't enough to draw a trend. The table below has the details.</div>
        ) : (
          <div className="callout info">Pollsters haven't visited this one. The forecast leans on the state's partisan lean, the national mood and the expert ratings. {meta.office === 'house' ? 'District polls are rare; the Cook Battleground District Project found Democrats up 49% to 47% across 37 competitive districts (Sept 8 to 11).' : ''}</div>
        )}
        {polls.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <SortTable rows={polls} cols={pcols} rowKey={(p) => p.id} initialSort="dates" initialDesc showNerd={nerd} />
            <p className="faint" style={{ fontSize: 12.5, marginTop: 8 }}>A tilde (~) means only a release date was found, so field dates are approximate. Internal polls released by a campaign are adjusted against the sponsor.</p>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>How this forecast is built</h3>
            <div className="sub">Three ingredients on the same scale, blended by how much each one knows. The final blend feeds the simulation.</div>
          </div>
        </div>
        <RangeRow label="Polls" mean={model.polls?.mean ?? null} sd={model.polls?.sd} weight={model.weightsUsed.polls} note={model.polls ? `${avg?.nRecent} recent ${avg?.nRecent === 1 ? 'poll' : 'polls'}` : 'no recent polls'} />
        <RangeRow label="Fundamentals" mean={model.fundamentals.mean} sd={model.fundamentals.sd} weight={model.weightsUsed.fundamentals} note={office === 'house' ? "The ratings' implied lean plus today's national mood" : 'State lean, national mood, incumbency'} />
        <RangeRow label="Expert ratings" mean={model.ratings.mean} sd={model.ratings.sd} weight={model.weightsUsed.ratings} note={cons.source === 'cited' ? `${cons.raters} ${cons.raters === 1 ? 'rater' : 'raters'}: ${RATING_LABEL[cons.rating]}` : `Our estimate: ${RATING_LABEL[cons.rating]}`} />
        <RangeRow label="Blend" mean={model.mean} sd={model.sd} note="Before the national and regional shocks are added" />
        <Under title="Fundamentals, itemized" open={nerd}>
          <div className="tbl-wrap">
            <table className="tbl">
              <tbody>
                {office === 'house' ? (
                  <>
                    <tr><td>Expert-implied margin today</td><td className="r num">{lead(fb.ratingImplied ?? 0)}</td></tr>
                    <tr><td>Neutral lean (that margin minus the mood the ratings assume)</td><td className="r num">{lead(fb.lean)}</td></tr>
                    <tr><td>Today's national mood, scaled by elasticity {fb.elasticity.toFixed(2)}</td><td className="r num">{lead(fb.envTerm)}</td></tr>
                    {fb.districtEstimate !== undefined && fb.fromRatings !== undefined && (
                      <>
                        <tr><td>From the ratings alone</td><td className="r num">{lead(fb.fromRatings)}</td></tr>
                        <tr><td>From the district's 2024 presidential result, moved by 70% of the national swing, plus incumbency</td><td className="r num">{lead(fb.districtEstimate)}</td></tr>
                        <tr><td className="faint">The two are averaged</td><td className="r num faint">50 / 50</td></tr>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <tr><td>Partisan lean of {st.name} (75% 2024, 25% 2020 presidential margin vs. the nation)</td><td className="r num">{lead(fb.lean)}</td></tr>
                    <tr><td>National mood D{signed(config.envOverride ?? env.blend)}, scaled by elasticity {fb.elasticity.toFixed(2)}</td><td className="r num">{lead(fb.envTerm)}</td></tr>
                    <tr><td>Incumbency</td><td className="r num">{fb.incumbency ? lead(fb.incumbency) : '—'}</td></tr>
                    <tr><td>Named adjustment{fb.adjNote ? `: ${fb.adjNote}` : ''}</td><td className="r num">{fb.adj ? lead(fb.adj) : '—'}</td></tr>
                  </>
                )}
                <tr><td><b>Fundamentals margin</b></td><td className="r num"><b>{lead(fb.total)}</b></td></tr>
              </tbody>
            </table>
          </div>
        </Under>
      </div>

      <div className="grid g2">
        <div className="card">
          <h3>Ratings</h3>
          <div style={{ marginTop: 12 }} className="stack">
            <div className="row"><span className="label">Consensus</span><RatingPill rating={cons.rating} est={cons.source !== 'cited'} /></div>
            <RatingsStrip ratings={meta.ratings} est={meta.estRating} />
            {cons.source !== 'cited' && <p className="faint" style={{ fontSize: 13 }}>We could not find a specific rater's rating for this race, so the pill shows our own stated estimate. It is dashed to say so.</p>}
          </div>
        </div>
        <div className="card">
          <h3>In {st.name}</h3>
          <div className="stack" style={{ gap: 8, marginTop: 12 }}>
            <div className="spread"><span className="muted">2024 presidential margin</span><b className="num">{lead(st.pres2024)}</b></div>
            <div className="spread"><span className="muted">2020 presidential margin</span><b className="num">{lead(st.pres2020)}</b></div>
            <div className="spread"><span className="muted">Polls close</span><b>{fmtClose(st.close)} ET</b></div>
            <div className="spread"><span className="muted">Counts votes</span><b>{st.pace}</b></div>
            {others.length > 0 && (
              <div>
                <div className="label" style={{ margin: '6px 0 4px' }}>Also on the ballot</div>
                <div className="row">{others.map((o) => <Link key={o.id} to={`race/${o.id}`} className="chip">{o.office === 'senate' ? 'Senate' : 'Governor'}</Link>)}</div>
              </div>
            )}
            {houseHere.length > 0 && office !== 'house' && (
              <div><Link to={`state/${meta.state.toLowerCase()}`} className="btn sm">All {houseHere.length} House seats in {st.name}</Link></div>
            )}
          </div>
        </div>
      </div>
      {result && (
        <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('lab')}>Flip this race in the lab</button>
      )}
    </div>
  );
}

export function fmtClose(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const h12 = ((hh + 11) % 12) + 1;
  const ampm = hh % 24 >= 12 && hh % 24 !== 0 ? 'pm' : 'am';
  return `${h12}${mm ? ':' + String(mm).padStart(2, '0') : ''} ${ampm}`;
}
