import type { RaceMeta, Candidate } from '../../data/types';
import { RATING_LABEL, consensus } from '../../data/ratings';
import type { Ratings } from '../../data/types';
import { Link } from '../../router';
import { fmtDate } from '../../engine/stats';
import type { Row } from '../useRows';
import { lead, prob } from '../format';
import { PartyBar, RatingPill } from './bits';

export function CandPill({ c, fallback }: { c?: Candidate; fallback?: string }) {
  if (!c) return <span className="faint">{fallback ?? '—'}</span>;
  const cls = c.party === 'D' ? 'dem' : c.party === 'R' ? 'rep' : 'ind';
  return (
    <span className="cand">
      <i className={`dot ${cls}-dot`} style={{ background: c.party === 'D' ? 'var(--dem)' : c.party === 'R' ? 'var(--rep)' : 'var(--ind)' }} />
      <span>{c.name}</span>
      {c.incumbent && <span className="faint" title="Incumbent"> (inc.)</span>}
    </span>
  );
}

export function Matchup({ meta }: { meta: RaceMeta }) {
  const { D, R, I } = meta.candidates;
  return (
    <div className="matchup">
      <CandPill c={D} fallback="Democratic nominee" />
      <CandPill c={R} fallback="Republican nominee" />
      {I && <CandPill c={I} />}
    </div>
  );
}

export function RatingsStrip({ ratings, est, estSource }: { ratings: Ratings; est?: RaceMeta['estRating']; estSource?: boolean }) {
  const items = (['cook', 'sabato', 'inside'] as const).filter((k) => ratings[k]);
  if (!items.length) {
    return est ? (
      <div className="row" style={{ gap: 6 }}>
        <RatingPill rating={est} est />
        <span className="faint" style={{ fontSize: 12 }}>our estimate; no specific rating found</span>
      </div>
    ) : null;
  }
  const names = { cook: 'Cook', sabato: 'Sabato', inside: 'Inside Elections' } as const;
  void estSource;
  return (
    <div className="row" style={{ gap: 8 }}>
      {items.map((k) => (
        <span key={k} className="row" style={{ gap: 5 }}>
          <span className="faint" style={{ fontSize: 12 }}>{names[k]}</span>
          <RatingPill rating={ratings[k]!} />
        </span>
      ))}
    </div>
  );
}

export function RaceCard({ row, onClose }: { row: Row; onClose?: () => void }) {
  const { meta, model, cons, avg, polls, pD } = row;
  const recent = polls.slice(0, 3);
  return (
    <div className="card race-card">
      <div className="card-head">
        <div>
          <div className="eyebrow">{meta.office === 'house' ? 'House' : meta.office === 'senate' ? 'Senate' : 'Governor'}{meta.special ? ' · special election' : ''}{meta.open ? ' · open seat' : ''}</div>
          <h3 style={{ fontSize: 22, marginTop: 4 }}>{meta.title}</h3>
        </div>
        {onClose && <button className="icon-btn" aria-label="Close" onClick={onClose}>×</button>}
      </div>
      <Matchup meta={meta} />
      {pD !== undefined && (
        <div style={{ margin: '14px 0 6px' }}>
          <div className="spread" style={{ marginBottom: 6 }}>
            <span className="dem"><b className="num" style={{ fontSize: 22 }}>{prob(pD)}</b> <span className="faint" style={{ fontSize: 12 }}>Democratic win</span></span>
            <span className="rep"><span className="faint" style={{ fontSize: 12 }}>Republican win</span> <b className="num" style={{ fontSize: 22 }}>{prob(1 - pD)}</b></span>
          </div>
          <PartyBar d={pD} r={1 - pD} size="lg" />
        </div>
      )}
      <div className="grid g2" style={{ gap: 10, margin: '12px 0' }}>
        <div>
          <div className="label">Poll average</div>
          <div className="num" style={{ fontSize: 20, fontWeight: 800 }}>{avg ? lead(avg.margin) : <span className="faint" style={{ fontSize: 15, fontWeight: 600 }}>no polls yet</span>}</div>
          {avg && <div className="faint" style={{ fontSize: 12 }}>{avg.nRecent} recent {avg.nRecent === 1 ? 'poll' : 'polls'}, latest {fmtDate(avg.latest!)}</div>}
        </div>
        <div>
          <div className="label">Model margin</div>
          <div className="num" style={{ fontSize: 20, fontWeight: 800 }}>{lead(row.margin)}</div>
          <div className="faint" style={{ fontSize: 12 }}>{Math.round(model.weightsUsed.polls * 100)}% polls · {Math.round(model.weightsUsed.fundamentals * 100)}% fundamentals · {Math.round(model.weightsUsed.ratings * 100)}% ratings</div>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="label">Consensus rating</span>
          <RatingPill rating={cons.rating} est={cons.source !== 'cited'} />
        </div>
        <div style={{ marginTop: 6 }}><RatingsStrip ratings={meta.ratings} est={meta.estRating} /></div>
      </div>
      {meta.note && <p className="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>{meta.note}</p>}
      {recent.length > 0 && (
        <div>
          <div className="label" style={{ marginBottom: 4 }}>Latest polls</div>
          {recent.map((p) => (
            <div key={p.id} className="spread" style={{ fontSize: 13, padding: '3px 0' }}>
              <a href={p.source} target="_blank" rel="noreferrer noopener" style={{ textDecoration: 'none', fontWeight: 600 }}>{p.pollster}</a>
              <span className="num"><span className="dem">{p.d ?? ''}</span>–<span className="rep">{p.r ?? ''}</span> <b>{lead(p.margin, 0)}</b> <span className="faint">{fmtDate(p.end)}</span></span>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <Link to={`race/${meta.id}`} className="btn primary sm">Full race page</Link>
      </div>
    </div>
  );
}

export const ratingTitle = (r: RaceMeta) => {
  const c = consensus(r);
  return `${RATING_LABEL[c.rating]}${c.source !== 'cited' ? ' (estimate)' : ''}`;
};
