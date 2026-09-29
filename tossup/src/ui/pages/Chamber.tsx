import { useMemo, useState } from 'react';
import { RATINGS, type Rating } from '../../data/types';
import { RATING_LABEL, RATING_MARGIN } from '../../data/ratings';
import { GOVERNORS_NOT_UP, SENATE_NOT_UP } from '../../data/races';
import { HOUSE_HOLDERS } from '../../data/house';
import { OUTSIDE_FORECASTS } from '../../data/benchmarks';
import { navigate } from '../../router';
import { useForecast } from '../../state/forecast';
import { Ring, SeatHistogram, Snake, Hemicycle, type SeatDot } from '../charts/Basic';
import { PartyBar, RatingPill, Under } from '../components/bits';
import { Matchup, RaceCard, RatingsStrip } from '../components/raceparts';
import { SortTable, type Col } from '../components/SortTable';
import { RATING_VAR, lead, plainOdds, prob, probFill } from '../format';
import { HexMap, StateMap, TileMap } from '../maps/maps';
import { useRows, type Row } from '../useRows';
import { usePrefs } from '../../state/prefs';

type Office = 'senate' | 'governor' | 'house';
type Mode = 'forecast' | 'rating' | 'polls' | 'flips';

const COPY: Record<Office, { title: string; lede: string; what: string }> = {
  senate: {
    title: 'Senate',
    lede: 'Thirty-five seats are up: 33 regular elections and specials in Ohio and Florida. Republicans hold 53 seats to Democrats\' 47, so Democrats need a net gain of four. A 50-50 split goes to the Republican vice president.',
    what: 'seats',
  },
  governor: {
    title: 'Governors',
    lede: 'Thirty-six governorships are on the ballot. Twenty-six is a majority of the nation\'s governors; the six Democratic and eight Republican governors not up this year are already counted.',
    what: 'governors',
  },
  house: {
    title: 'House',
    lede: 'All 435 seats are up on maps that changed in several states this year. Republicans hold 220 seats to Democrats\' 215, so Democrats need a net gain of three for the 218 they need.',
    what: 'seats',
  },
};

function marginToRating(m: number): Rating {
  if (m >= 10) return 'safe-d';
  if (m >= 6) return 'likely-d';
  if (m >= 3) return 'lean-d';
  if (m >= 1) return 'tilt-d';
  if (m > -1) return 'toss';
  if (m > -3) return 'tilt-r';
  if (m > -6) return 'lean-r';
  if (m > -10) return 'likely-r';
  return 'safe-r';
}

function RatingSpread({ rows, notUp, office }: { rows: Row[]; notUp?: { D: number; R: number }; office: Office }) {
  const counts = Object.fromEntries(RATINGS.map((r) => [r, 0])) as Record<Rating, number>;
  rows.forEach((r) => counts[r.cons.rating]++);
  const total = rows.length + (notUp ? notUp.D + notUp.R : 0);
  const seg = (n: number, bg: string, label: string, key: string, dark = false) =>
    n > 0 ? (
      <div key={key} title={`${label}: ${n}`} style={{ flex: n, background: bg, color: dark ? '#fff' : '#111', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 12.5, minWidth: n > 0 ? 3 : 0, height: 34, borderRadius: 6 }}>
        {n >= 2 ? n : ''}
      </div>
    ) : null;
  return (
    <div>
      <div style={{ display: 'flex', gap: 2 }} role="img" aria-label={`${office} seats by expert rating`}>
        {notUp && seg(notUp.D, 'var(--dem-2)', 'Democratic, not up', 'nud', true)}
        {RATINGS.map((r) => seg(counts[r], RATING_VAR[r], RATING_LABEL[r], r, r === 'safe-d' || r === 'likely-d' || r === 'likely-r' || r === 'safe-r'))}
        {notUp && seg(notUp.R, 'var(--rep-2)', 'Republican, not up', 'nur', true)}
      </div>
      <div className="legend" style={{ marginTop: 8 }}>
        {notUp && <span><i style={{ background: 'var(--dem-2)' }} />{notUp.D} D not up</span>}
        {RATINGS.filter((r) => counts[r]).map((r) => (
          <span key={r}><i style={{ background: RATING_VAR[r] }} />{RATING_LABEL[r]} {counts[r]}</span>
        ))}
        {notUp && <span><i style={{ background: 'var(--rep-2)' }} />{notUp.R} R not up</span>}
        <span className="faint">({total} total)</span>
      </div>
    </div>
  );
}

function SenateHemicycle({ rows }: { rows: Row[] }) {
  const dots: SeatDot[] = [];
  for (let i = 0; i < SENATE_NOT_UP.D; i++) dots.push({ color: 'var(--dem-2)', title: 'Democratic seat, not up this year' });
  const up = [...rows].sort((a, b) => b.margin - a.margin);
  up.forEach((r) => {
    const p = r.pD ?? 0.5;
    dots.push({ color: probFill(p), ring: false, title: `${r.meta.title}: Democrats ${prob(p)}` });
  });
  for (let i = 0; i < SENATE_NOT_UP.R; i++) dots.push({ color: 'var(--rep-2)', title: 'Republican seat, not up this year' });
  return <Hemicycle seats={dots} label="Senate seats: 34 Democratic not up, 35 on the ballot, 31 Republican not up" />;
}

export function Chamber({ office }: { office: Office }) {
  const rows = useRows(office);
  const { result, running, config, setConfig, env } = useForecast();
  const { nerd } = usePrefs();
  const [mode, setMode] = useState<Mode>('forecast');
  const [style, setStyle] = useState<'geo' | 'tile'>('geo');
  const [selected, setSelected] = useState<string | null>(null);
  const [showSafe, setShowSafe] = useState(false);
  const [filter, setFilter] = useState<'all' | 'D' | 'R'>('all');
  const copy = COPY[office];
  const ch = result ? (office === 'senate' ? result.senate : office === 'governor' ? result.governor : result.house) : null;
  const needed = office === 'senate' ? 51 : office === 'governor' ? 26 : 218;
  const byKey = useMemo(() => Object.fromEntries(rows.map((r) => [office === 'house' ? r.meta.id : r.meta.state, r])), [rows, office]);
  const byId = useMemo(() => Object.fromEntries(rows.map((r) => [r.meta.id, r])), [rows]);
  const sel = selected ? (byKey[selected] ?? byId[selected]) : null;

  const fillFor = (key: string): string | undefined => {
    const r = byKey[key];
    if (!r) return undefined;
    if (mode === 'rating') return RATING_VAR[r.cons.rating];
    if (mode === 'polls') return r.avg ? RATING_VAR[marginToRating(r.avg.margin)] : 'var(--rt-none)';
    if (mode === 'flips') {
      const p = r.pD;
      if (p === undefined) return RATING_VAR[r.cons.rating];
      return p > 0.5 ? 'var(--dem)' : 'var(--rep)';
    }
    return r.pD === undefined ? RATING_VAR[r.cons.rating] : probFill(r.pD);
  };
  const markFor = (key: string): string | undefined => (mode === 'flips' && byKey[key]?.flips ? '●' : undefined);
  const tip = (key: string) => {
    const r = byKey[key];
    if (!r) return <span>Not on the ballot in 2026</span>;
    return (
      <>
        <b>{r.meta.title}</b>
        <div>{r.pD !== undefined ? `Democrats ${prob(r.pD)} to win` : 'Simulating…'}</div>
        <div className="tip-sub">{RATING_LABEL[r.cons.rating]}{r.cons.source !== 'cited' ? ' (est.)' : ''}{r.avg ? ` · polls ${lead(r.avg.margin)}` : ''}</div>
      </>
    );
  };

  const cols: Col<Row>[] = [
    {
      key: 'race',
      label: 'Race',
      sort: (a, b) => a.meta.title.localeCompare(b.meta.title),
      render: (r) => (
        <>
          <a href={`#/race/${r.meta.id}`} onClick={(e) => { e.preventDefault(); navigate(`race/${r.meta.id}`); }}>{r.meta.title}</a>
          {r.meta.special && <span className="chip" style={{ marginLeft: 6 }}>special</span>}
          {r.meta.open && <span className="chip" style={{ marginLeft: 6 }}>open</span>}
          {r.flips && <span className={`chip ${r.flips === 'D' ? 'dem' : 'rep'}`} style={{ marginLeft: 6 }} title="Projected to change parties">flip to {r.flips}</span>}
        </>
      ),
    },
    { key: 'cands', label: 'Matchup', render: (r) => <Matchup meta={r.meta} /> },
    {
      key: 'poll',
      label: 'Poll avg',
      right: true,
      sort: (a, b) => (a.avg?.margin ?? -99) - (b.avg?.margin ?? -99),
      render: (r) => (r.avg ? <span className="num"><b className={r.avg.margin > 0 ? 'dem' : 'rep'}>{lead(r.avg.margin)}</b> <span className="faint" title="Recent polls">·{r.avg.nRecent}</span></span> : <span className="faint">—</span>),
    },
    {
      key: 'margin',
      label: 'Forecast',
      right: true,
      sort: (a, b) => a.margin - b.margin,
      render: (r) => <b className={`num ${r.margin > 0 ? 'dem' : 'rep'}`}>{lead(r.margin)}</b>,
    },
    {
      key: 'pd',
      label: 'Dem. win',
      sort: (a, b) => (a.pD ?? 0) - (b.pD ?? 0),
      render: (r) => (
        <div style={{ minWidth: 120 }}>
          <div className="spread" style={{ fontSize: 12.5, marginBottom: 3 }}>
            <b className="dem">{r.pD === undefined ? '…' : prob(r.pD)}</b>
            <span className="rep">{r.pD === undefined ? '' : prob(1 - r.pD)}</span>
          </div>
          <PartyBar d={r.pD ?? 0.5} r={1 - (r.pD ?? 0.5)} />
        </div>
      ),
    },
    {
      key: 'rating',
      label: 'Rating',
      sort: (a, b) => RATING_MARGIN[a.cons.rating] - RATING_MARGIN[b.cons.rating],
      render: (r) => (
        <div>
          <RatingPill rating={r.cons.rating} est={r.cons.source !== 'cited'} />
          <div style={{ marginTop: 4 }}><RatingsStrip ratings={r.meta.ratings} /></div>
        </div>
      ),
    },
    { key: 'tip', label: 'Tipping pt', right: true, nerd: true, sort: (a, b) => a.tipping - b.tipping, render: (r) => <span className="num">{prob(r.tipping, 1)}</span>, title: 'Chance this is the race that delivers the majority' },
  ];

  let tableRows = rows;
  if (office === 'house' && !showSafe) tableRows = rows.filter((r) => r.cons.rating !== 'safe-d' && r.cons.rating !== 'safe-r' && (r.pD === undefined || (r.pD > 0.02 && r.pD < 0.98)));
  if (filter !== 'all') tableRows = tableRows.filter((r) => r.meta.holder === filter);
  // The House table is long, so lead with the closest races; the others read best as a left-to-right spectrum.
  if (office === 'house') tableRows = [...tableRows].sort((x, y) => Math.abs((x.pD ?? 0.5) - 0.5) - Math.abs((y.pD ?? 0.5) - 0.5));
  const flipsD = rows.filter((r) => r.flips === 'D').length;
  const flipsR = rows.filter((r) => r.flips === 'R').length;

  const snakeItems = rows.map((r) => ({ id: r.meta.id, label: office === 'house' ? '' : r.meta.state, pD: r.pD ?? 0.5, mean: r.margin, href: `race/${r.meta.id}`, sub: r.meta.title }));
  const needFromTop = office === 'senate' ? 17 : office === 'governor' ? 20 : 218;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">2026 forecast</div>
          <h1>{copy.title}</h1>
          <p className="lede">{copy.lede}</p>
        </div>
      </div>

      <div className="grid g-main-side">
        <div className="card">
          <div className="grid g2" style={{ alignItems: 'center' }}>
            <div className="row" style={{ gap: 22, alignItems: 'center', flexWrap: 'nowrap' }}>
              {ch ? (
                <Ring pD={ch.pControl} size={148} stroke={15} label={`Democrats ${Math.round(ch.pControl * 100)} percent to win`}>
                  <div>
                    <div className="kpi" style={{ fontSize: 36 }}>{prob(ch.pControl)}</div>
                    <div className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>Dem. control</div>
                  </div>
                </Ring>
              ) : (
                <div className="skeleton" style={{ width: 148, height: 148, borderRadius: '50%' }} />
              )}
              <div>
                <div className="label">Republican control</div>
                <div className="kpi sm rep">{ch ? prob(1 - ch.pControl - (office === 'senate' ? 0 : 0)) : '…'}</div>
                <div className="faint" style={{ fontSize: 13, marginTop: 6 }}>{ch ? plainOdds(ch.pControl) : ''}</div>
              </div>
            </div>
            <div className="stack" style={{ gap: 10 }}>
              <div>
                <div className="label">Median outcome</div>
                <div className="kpi sm">{ch ? ch.median : '…'} <span className="faint" style={{ fontSize: 16, fontWeight: 700 }}>D {copy.what}</span></div>
                <div className="faint" style={{ fontSize: 13 }}>{ch ? `80% of simulations land between ${ch.p10} and ${ch.p90}` : ''}</div>
              </div>
              <div className="faint" style={{ fontSize: 13.5 }}>
                {office === 'senate' && `Democrats hold ${SENATE_NOT_UP.D} seats not up and need ${needed - SENATE_NOT_UP.D} of the 35 races. A 50-50 tie${ch ? ` (${prob(ch.pTie, 1)})` : ''} leaves Republicans in charge.`}
                {office === 'governor' && `Democrats hold ${GOVERNORS_NOT_UP.D} governorships not up and need ${needed - GOVERNORS_NOT_UP.D} of the 36 races${ch ? `; a 25-25 tie is ${prob(ch.pTie, 1)}` : ''}.`}
                {office === 'house' && `Democrats hold ${HOUSE_HOLDERS.D} seats now; ${needed} makes a majority. Seat by seat, the favorite changes the party in ${flipsD} seats toward Democrats and ${flipsR} toward Republicans.`}
              </div>
              {office === 'senate' && (
                <label className="switch" title="Dan Osborn (NE) and Todd Achilles (ID) are independents. Osborn has said he would not caucus with either party.">
                  <input type="checkbox" checked={config.indCaucusD} onChange={(e) => setConfig({ indCaucusD: e.target.checked })} />
                  Count independent challengers (Osborn, Achilles) as Democrats
                </label>
              )}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Where the {office === 'governor' ? 'governors' : 'seats'} could land</h3>
              <div className="sub">Each bar is how often Democrats end up with that many {copy.what} across 20,000 simulated Election Days</div>
            </div>
          </div>
          {ch ? (
            <SeatHistogram hist={ch.hist} threshold={needed} median={ch.median} label={`Distribution of Democratic ${copy.what}`} unit={copy.what} needLabel={office === 'governor' ? 'Democratic majority of governors' : 'Democratic majority'} />
          ) : (
            <div className="skeleton" style={{ height: 220 }} />
          )}
          {running && <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>Updating…</div>}
        </div>
      </div>

      <div className="grid g-main-side" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head" style={{ flexWrap: 'wrap' }}>
            <div>
              <h3>Map</h3>
              <div className="sub">
                {mode === 'forecast' && 'Colored by chance of a Democratic win'}
                {mode === 'rating' && 'Colored by expert consensus rating'}
                {mode === 'polls' && 'Colored by the polling average (gray means no polls)'}
                {mode === 'flips' && 'Colored by projected winner; a dot marks a projected change of party'}
              </div>
            </div>
            <div className="row">
              <div className="seg" role="tablist" aria-label="Map coloring">
                {(
                  [['forecast', 'Forecast'], ['rating', 'Ratings'], ...(office === 'house' ? [] : [['polls', 'Polls']]), ['flips', 'Flips']] as [Mode, string][]
                ).map(([m, l]) => (
                  <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{l}</button>
                ))}
              </div>
              {office !== 'house' && (
                <div className="seg" aria-label="Map style">
                  <button aria-pressed={style === 'geo'} onClick={() => setStyle('geo')}>Map</button>
                  <button aria-pressed={style === 'tile'} onClick={() => setStyle('tile')}>Tiles</button>
                </div>
              )}
            </div>
          </div>
          {office === 'house' ? (
            <HexMap label="House cartogram" fill={fillFor} tip={tip} mark={markFor} selected={selected} onSelect={setSelected} />
          ) : style === 'geo' ? (
            <StateMap label={`${copy.title} map`} fill={fillFor} tip={tip} mark={markFor} selected={selected} onSelect={(k) => byKey[k] && setSelected(k)} />
          ) : (
            <TileMap label={`${copy.title} tile map`} fill={fillFor} tip={tip} mark={markFor} selected={selected} onSelect={(k) => byKey[k] && setSelected(k)} />
          )}
          <div className="legend" style={{ marginTop: 10 }}>
            {(['safe-d', 'likely-d', 'lean-d', 'tilt-d', 'toss', 'tilt-r', 'lean-r', 'likely-r', 'safe-r'] as Rating[]).map((r) => (
              <span key={r}><i style={{ background: RATING_VAR[r] }} />{RATING_LABEL[r]}</span>
            ))}
            {office !== 'house' && <span><i style={{ background: 'var(--rt-none)' }} />Not up</span>}
          </div>
          {office === 'house' && (
            <p className="faint" style={{ fontSize: 12.5, marginTop: 8 }}>
              Each hexagon is one district, grouped by state and warped so populous states get room. Placement inside a state is schematic. Click one for details.
            </p>
          )}
        </div>
        <div className="stack" style={{ position: 'sticky', top: 74 }}>
          {sel ? (
            <RaceCard row={sel} onClose={() => setSelected(null)} />
          ) : (
            <div className="card tint">
              <h3>Pick a {office === 'house' ? 'district' : 'race'}</h3>
              <p className="muted" style={{ marginTop: 8 }}>Click the map or a row below to see the matchup, polls, ratings and odds.</p>
              {office === 'senate' && ch && (
                <div style={{ marginTop: 12 }}>
                  <SenateHemicycle rows={rows} />
                  <div className="faint" style={{ fontSize: 12, textAlign: 'center' }}>Every Senate seat, most Democratic to most Republican</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>The tipping-point chart</h3>
            <div className="sub">
              {office === 'house'
                ? 'All 435 seats from most Democratic to most Republican. The 218th from the left is the seat that delivers the majority.'
                : `Races from most Democratic to most Republican. Democrats need ${office === 'senate' ? '17 of these 35' : '20 of these 36'}, so the dashed line falls at the tipping point.`}
            </div>
          </div>
        </div>
        {result ? <Snake items={snakeItems} needFromTop={needFromTop} title={`${copy.title} tipping point chart`} height={office === 'house' ? 200 : 240} /> : <div className="skeleton" style={{ height: 220 }} />}
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>{copy.title} by expert rating</h3>
            <div className="sub">{office === 'house' ? 'Our consensus of the ratings we could cite, with a stated estimate for the rest. Cook\'s own count on Sept 25: 208 Democratic-favored, 205 Republican-favored, 22 toss-ups.' : 'Consensus of the raters we could cite; dashed pills elsewhere are our estimate.'}</div>
          </div>
        </div>
        <RatingSpread rows={rows} office={office} notUp={office === 'senate' ? SENATE_NOT_UP : office === 'governor' ? GOVERNORS_NOT_UP : undefined} />
      </div>

      <div className="card">
        <div className="card-head" style={{ flexWrap: 'wrap' }}>
          <div>
            <h3>{office === 'house' ? 'Competitive districts' : `All ${rows.length} races`}</h3>
            <div className="sub">Click a row for details; click a column to sort. Forecast is the model's projected margin.</div>
          </div>
          <div className="row">
            <div className="seg">
              {([['all', 'All'], ['D', 'D-held'], ['R', 'R-held']] as const).map(([k, l]) => (
                <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
              ))}
            </div>
            {office === 'house' && (
              <label className="switch">
                <input type="checkbox" checked={showSafe} onChange={(e) => setShowSafe(e.target.checked)} />
                Include safe seats
              </label>
            )}
          </div>
        </div>
        <SortTable
          rows={tableRows}
          cols={cols}
          rowKey={(r) => r.meta.id}
          initialSort={office === 'house' ? undefined : 'pd'}
          initialDesc={false}
          showNerd={nerd}
          limit={office === 'house' ? 40 : undefined}
          onRowClick={(r) => setSelected(office === 'house' ? r.meta.id : r.meta.state)}
          selectedKey={sel?.meta.id ?? null}
        />
      </div>

      {office === 'house' && (
        <div className="callout info">
          <b>About this data.</b> Ratings for {rows.filter((r) => r.cons.source === 'cited').length} House seats are cited to Cook (Sept 25) or Sabato (Sept 29). Another {rows.filter((r) => r.cons.source === 'estimated').length} carry our own stated estimate (dashed pills), and the remaining {rows.filter((r) => r.cons.source === 'default').length} default to Safe for the party that holds them. Nominees are named only where reporting named them. District polling is scarce, so House forecasts lean on ratings and the national mood. The <a href="#/methods" onClick={(e) => { e.preventDefault(); navigate('methods'); }}>Methods page</a> says exactly what's missing.
        </div>
      )}

      {office === 'house' && <BattlegroundCheck rows={rows} national={env.generic} />}

      <Under title="How other forecasters see it">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Source</th><th>House</th><th>Senate</th><th>As of</th></tr></thead>
            <tbody>
              {OUTSIDE_FORECASTS.map((f) => (
                <tr key={f.who}>
                  <td><a href={f.url} target="_blank" rel="noreferrer noopener">{f.who}</a>{f.note && <div className="faint" style={{ fontSize: 12 }}>{f.note}</div>}</td>
                  <td>{f.house ?? <span className="faint">—</span>}</td>
                  <td>{f.senate ?? <span className="faint">—</span>}</td>
                  <td className="faint">{f.date.slice(5)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Under>
    </div>
  );
}

/** A district-level cross-check: Cook's Battleground District Project poll against our competitive seats. */
function BattlegroundCheck({ rows, national }: { rows: Row[]; national: number }) {
  const comp = rows.filter((r) => Math.abs(RATING_MARGIN[r.cons.rating]) <= 6 && r.margin !== undefined && Number.isFinite(r.margin));
  if (comp.length === 0) return null;
  const avg = comp.reduce((a, r) => a + (r.margin as number), 0) / comp.length;
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3>A district-level reality check</h3>
          <div className="sub">The best district polling we found, next to what the model says about the same kind of seat</div>
        </div>
      </div>
      <div className="grid g2" style={{ gap: 18 }}>
        <div>
          <div className="label">Cook Battleground District Project, Sept 8-11</div>
          <div className="kpi">D+2</div>
          <p className="muted" style={{ fontSize: 14, margin: '4px 0 0' }}>
            1,052 likely voters across the 37 districts Cook rates competitive: 49% Democratic, 47% Republican on the generic ballot. Those districts voted for Trump by about 5 points in 2024, so this is a swing of roughly 7 points toward Democrats.{' '}
            <a href="https://www.cookpolitical.com/analysis/survey-research/battleground-district-project/new-battleground-district-poll-shows" target="_blank" rel="noreferrer noopener">Cook's write-up</a>
          </p>
        </div>
        <div>
          <div className="label">Tossup, average of {comp.length} seats rated Toss-up, Tilt or Lean</div>
          <div className={`kpi ${avg > 0 ? 'dem' : 'rep'}`}>{lead(avg)}</div>
          <p className="muted" style={{ fontSize: 14, margin: '4px 0 0' }}>
            Not quite the same measure: theirs is a generic ballot with no candidates named, ours is a forecast margin that includes incumbency and candidate quality. Both show the battleground moving less than the country as a whole, where the generic-ballot average is {lead(national)}.
          </p>
        </div>
      </div>
    </div>
  );
}
