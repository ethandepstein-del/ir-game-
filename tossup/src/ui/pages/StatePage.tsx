import geo from '../../data/generated/geo-states.json';
import { STATE_BY_CODE } from '../../data/states';
import { Link, navigate } from '../../router';
import { probFill, lead, prob, RATING_VAR } from '../format';
import { useRows } from '../useRows';
import { PartyBar, RatingPill } from '../components/bits';
import { Matchup } from '../components/raceparts';
import { SortTable, type Col } from '../components/SortTable';
import { RATING_MARGIN } from '../../data/ratings';
import { fmtClose } from './RacePage';
import type { Row } from '../useRows';

type G = Record<string, { d: string; bbox: number[] }>;

export function StateShape({ code, fill }: { code: string; fill?: string }) {
  const g = (geo as G)[code];
  if (!g) return null;
  const [x0, y0, x1, y1] = g.bbox;
  const pad = 8;
  return (
    <svg viewBox={`${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}`} width="120" height="100" role="img" aria-label={`${code} outline`}>
      <path d={g.d} fill={fill ?? 'var(--surface-3)'} stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function StatePage({ code }: { code: string }) {
  const st = STATE_BY_CODE[code];
  const sen = useRows('senate').filter((r) => r.meta.state === code);
  const gov = useRows('governor').filter((r) => r.meta.state === code);
  const house = useRows('house').filter((r) => r.meta.state === code);
  if (!st) {
    return (
      <div className="card">
        <h2>Unknown state</h2>
        <p className="muted">Pick one from the <Link to="senate">Senate map</Link>.</p>
      </div>
    );
  }
  const statewide: Row[] = [...sen, ...gov];
  const cols: Col<Row>[] = [
    { key: 'd', label: 'District', sort: (a, b) => (a.meta.district ?? 0) - (b.meta.district ?? 0), render: (r) => <Link to={`race/${r.meta.id}`}>{r.meta.title}</Link> },
    { key: 'h', label: 'Held by', render: (r) => <span className={`chip ${r.meta.holder === 'D' ? 'dem' : 'rep'}`}>{r.meta.holder === 'D' ? 'Democrat' : 'Republican'}</span> },
    { key: 'm', label: 'Matchup', render: (r) => <Matchup meta={r.meta} /> },
    { key: 'p', label: 'Dem. win', sort: (a, b) => (a.pD ?? 0) - (b.pD ?? 0), render: (r) => <span className="num"><b>{r.pD === undefined ? '…' : prob(r.pD)}</b></span> },
    { key: 'r', label: 'Rating', sort: (a, b) => RATING_MARGIN[a.cons.rating] - RATING_MARGIN[b.cons.rating], render: (r) => <RatingPill rating={r.cons.rating} est={r.cons.source !== 'cited'} /> },
  ];
  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head">
        <div className="row" style={{ gap: 22, alignItems: 'center' }}>
          <StateShape code={code} fill={statewide[0]?.pD !== undefined ? probFill(statewide[0].pD) : undefined} />
          <div>
            <div className="eyebrow">State</div>
            <h1>{st.name}</h1>
            <p className="lede">{st.house === 1 ? 'One at-large House seat.' : `${st.house} House seats.`} Polls close at {fmtClose(st.close)} ET{st.closeLast ? ` (some places as late as ${fmtClose(st.closeLast)})` : ''}. {st.paceNote ?? ''}</p>
          </div>
        </div>
        <div className="grid g2" style={{ gap: 20 }}>
          <div><div className="label">2024 president</div><div className="kpi sm">{lead(st.pres2024)}</div></div>
          <div><div className="label">2020 president</div><div className="kpi sm">{lead(st.pres2020)}</div></div>
        </div>
      </div>

      {statewide.length > 0 && (
        <section className="grid g2">
          {statewide.map((r) => (
            <Link key={r.meta.id} to={`race/${r.meta.id}`} className="card link-card">
              <div className="eyebrow">{r.meta.office === 'senate' ? 'Senate' : 'Governor'}{r.meta.special ? ' · special' : ''}</div>
              <h3 style={{ margin: '6px 0 10px', fontSize: 22 }}>{r.meta.title}</h3>
              <Matchup meta={r.meta} />
              <div style={{ margin: '14px 0 8px' }} className="spread">
                <span className="dem"><b className="num" style={{ fontSize: 22 }}>{r.pD === undefined ? '…' : prob(r.pD)}</b> <span className="faint" style={{ fontSize: 12 }}>Democratic</span></span>
                <RatingPill rating={r.cons.rating} est={r.cons.source !== 'cited'} />
              </div>
              <PartyBar d={r.pD ?? 0.5} r={1 - (r.pD ?? 0.5)} />
            </Link>
          ))}
        </section>
      )}
      {statewide.length === 0 && <div className="callout info">No Senate or governor race in {st.name} this year.</div>}

      <div className="card">
        <div className="card-head">
          <div>
            <h3>House seats</h3>
            <div className="sub">Click any row for that district's page.</div>
          </div>
          <div className="row">
            {house.map((r) => (
              <span key={r.meta.id} title={r.meta.title} style={{ width: 14, height: 14, borderRadius: 4, background: r.pD === undefined ? RATING_VAR[r.cons.rating] : probFill(r.pD), display: 'inline-block', cursor: 'pointer' }} onClick={() => navigate(`race/${r.meta.id}`)} />
            ))}
          </div>
        </div>
        <SortTable rows={house} cols={cols} rowKey={(r) => r.meta.id} initialSort="d" onRowClick={(r) => navigate(`race/${r.meta.id}`)} />
      </div>
    </div>
  );
}
