import { useMemo, useState } from 'react';
import { Link } from '../../router';
import { RatingPill } from '../components/bits';
import { lead, prob } from '../format';
import { consensus } from '../../data/ratings';
import { fmtClose } from '../pages/RacePage';
import { useForecast } from '../../state/forecast';
import { useWatchRows, type WatchRow } from './common';

export function WatchList() {
  const rows = useWatchRows();
  const { config, result } = useForecast();
  const [chamber, setChamber] = useState<'all' | 'Senate' | 'House' | 'Governor'>('all');
  const [n, setN] = useState(12);

  const filtered = useMemo(() => rows.filter((r) => chamber === 'all' || r.chamber === chamber), [rows, chamber]);
  const decisive = filtered.slice(0, n);
  const early = useMemo(
    () => filtered.filter((r) => r.close <= 20.5 && r.pD > 0.08 && r.pD < 0.92).sort((a, b) => b.beta - a.beta).slice(0, 8),
    [filtered],
  );

  const byHour = useMemo(() => {
    const m = new Map<number, WatchRow[]>();
    for (const r of filtered.slice(0, 60)) {
      const k = Math.floor(r.close);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  const bench = (r: WatchRow) => {
    const shift = 1.5 * config.sigmaNat;
    return { r: r.mean - shift, m: r.mean, d: r.mean + shift };
  };

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="card">
        <div className="card-head" style={{ flexWrap: 'wrap' }}>
          <div>
            <h3>What to follow</h3>
            <div className="sub">Ranked by how much each race, once decided, moves the odds of chamber control. This is the list to keep open.</div>
          </div>
          <div className="seg">
            {(['all', 'Senate', 'House', 'Governor'] as const).map((c) => (
              <button key={c} aria-pressed={chamber === c} onClick={() => setChamber(c)}>{c === 'all' ? 'Everything' : c}</button>
            ))}
          </div>
        </div>
        {!result && <div className="skeleton" style={{ height: 240 }} />}
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th><th>Race</th><th>Closes</th><th className="r">Dem. win</th><th className="r">Swing in control odds</th><th>Likely called</th><th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {decisive.map((r, i) => (
                <tr key={r.meta.id}>
                  <td className="faint">{i + 1}</td>
                  <td><Link to={`race/${r.meta.id}`}>{r.meta.title}</Link> <span className="chip">{r.chamber}</span></td>
                  <td className="num">{fmtClose(r.close)}<span className={`pace ${r.pace}`} style={{ marginLeft: 6 }} title={`${r.pace} counting`} /></td>
                  <td className="r num"><b>{prob(r.pD)}</b></td>
                  <td className="r num" title="Expected change in Democratic control odds when this race is decided">{(r.swing * 100).toFixed(1)} pts</td>
                  <td className="faint" style={{ fontSize: 13 }}>{r.call}</td>
                  <td><RatingPill rating={consensus(r.meta).rating} est={consensus(r.meta).source !== 'cited'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > n && <div style={{ textAlign: 'center', marginTop: 12 }}><button className="btn sm" onClick={() => setN(n + 12)}>Show more</button></div>}
        <p className="faint" style={{ fontSize: 12.5, marginTop: 10 }}>"Swing" is the expected absolute change in the chamber's Democratic-control probability the moment this race is called, averaged over both outcomes.</p>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>Early tells</h3>
            <div className="sub">Races that close early and read the national mood well. If several beat (or miss) the forecast the same way, adjust your whole night.</div>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Race</th><th>Closes</th><th className="r">Republican night</th><th className="r">On the forecast</th><th className="r">Democratic wave</th><th className="r" title="Points of national swing implied per point this race beats the forecast">Signal</th></tr>
            </thead>
            <tbody>
              {early.map((r) => {
                const b = bench(r);
                return (
                  <tr key={r.meta.id}>
                    <td><Link to={`race/${r.meta.id}`}>{r.meta.title}</Link></td>
                    <td className="num">{fmtClose(r.close)}</td>
                    <td className="r num rep">{lead(b.r, 0)} or worse</td>
                    <td className="r num"><b>{lead(b.m, 0)}</b></td>
                    <td className="r num dem">{lead(b.d, 0)} or better</td>
                    <td className="r num">{r.beta.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="faint" style={{ fontSize: 12.5, marginTop: 10 }}>
          The benchmark columns are the model's expected margin, and the margin that would be a 1.5-standard-deviation surprise for the national mood in either direction. "Signal" is how many points of national swing each point of surprise in that race is worth. Early counts are noisy; judge on percent reporting, not first drops.
        </p>
      </div>

      <div className="card">
        <div className="card-head"><div><h3>Hour by hour</h3><div className="sub">The most important races closing in each hour</div></div></div>
        <div className="stack" style={{ gap: 12 }}>
          {byHour.map(([h, list]) => (
            <div key={h} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 14 }}>
              <div className="num" style={{ width: 70, fontWeight: 800 }}>{fmtClose(h)}</div>
              <div className="row" style={{ gap: 6 }}>
                {list.slice(0, 8).map((r) => (
                  <Link key={r.meta.id} to={`race/${r.meta.id}`} className={`chip ${r.pD > 0.62 ? 'dem' : r.pD < 0.38 ? 'rep' : 'toss'}`}>{r.meta.title}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
