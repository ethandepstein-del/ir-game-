import { useMemo } from 'react';
import { APPROVAL_PUBLISHED } from '../../data/benchmarks';
import { MIDTERMS, fitMidterms } from '../../data/history';
import { pollsterInfo } from '../../data/pollsters';
import { fmtDate, pollDay } from '../../engine/stats';
import { useAgg } from '../../state/forecast';
import { usePrefs } from '../../state/prefs';
import { TrendChart } from '../charts/TrendChart';
import { SortTable, type Col } from '../components/SortTable';
import { signed } from '../format';
import type { ApprovalPoll } from '../../data/types';

export function Approval() {
  const { approval, approvalPolls } = useAgg();
  const { nerd } = usePrefs();
  const a = approval;
  const netSeries = a.trendNet.map((t) => ({ day: t.day, mean: t.mean, sd: t.sd }));
  const apprSeries = a.trendApprove.map((t) => ({ day: t.day, mean: t.mean, sd: t.sd }));
  const dots = approvalPolls
    .filter((p) => p.disapprove !== null)
    .map((p) => ({ id: p.id, day: pollDay(p.start, p.end), value: p.approve - (p.disapprove as number), pollster: p.pollster, detail: `${p.approve}% approve, ${p.disapprove}% disapprove · ${fmtDate(p.start)}–${fmtDate(p.end)}` }));
  const apprDots = approvalPolls.map((p) => ({ id: p.id, day: pollDay(p.start, p.end), value: p.approve, pollster: p.pollster, detail: `${p.approve}% approve${p.disapprove !== null ? `, ${p.disapprove}% disapprove` : ''}` }));

  const cols: Col<ApprovalPoll>[] = useMemo(
    () => [
      { key: 'p', label: 'Pollster', sort: (x, y) => x.pollster.localeCompare(y.pollster), render: (p) => <a href={p.source} target="_blank" rel="noreferrer noopener">{p.pollster}</a> },
      { key: 'd', label: 'Field dates', sort: (x, y) => (x.end < y.end ? -1 : 1), render: (p) => <span className="faint">{fmtDate(p.start)}–{fmtDate(p.end)}</span> },
      { key: 'ap', label: 'Approve', right: true, sort: (x, y) => x.approve - y.approve, render: (p) => <span className="num">{p.approve}%</span> },
      { key: 'di', label: 'Disapprove', right: true, sort: (x, y) => (x.disapprove ?? 0) - (y.disapprove ?? 0), render: (p) => <span className="num">{p.disapprove === null ? '—' : `${p.disapprove}%`}</span> },
      { key: 'n', label: 'Net', right: true, sort: (x, y) => x.approve - (x.disapprove ?? 0) - (y.approve - (y.disapprove ?? 0)), render: (p) => (p.disapprove === null ? <span className="faint">—</span> : <b className={`num ${p.approve - p.disapprove < 0 ? 'rep' : 'dem'}`}>{signed(p.approve - p.disapprove, 0)}</b>) },
      { key: 'g', label: 'Grade', nerd: true, render: (p) => <span className="chip">{pollsterInfo(p.pollster).tier}</span> },
    ],
    [],
  );

  const fit = fitMidterms();
  const sorted = [...MIDTERMS].sort((x, y) => x.net - y.net);
  const min = Math.min(a.net, ...sorted.map((r) => r.net));
  const max = Math.max(a.net, ...sorted.map((r) => r.net));
  const pos = (v: number) => ((v - min) / (max - min)) * 100;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">The other big input</div>
          <h1>Trump approval</h1>
          <p className="lede">A president's approval rating is the best predictor of how his party does in a midterm. Ours averages the polls with a pollster-quality weight and a correction for firms whose questions read differently.</p>
        </div>
      </div>
      <div className="grid g-main-side">
        <div className="card">
          <div className="card-head" style={{ flexWrap: 'wrap' }}>
            <div className="row" style={{ gap: 28 }}>
              <div><div className="label">Approve</div><div className="kpi lg">{a.approve.toFixed(1)}%</div></div>
              <div><div className="label">Disapprove</div><div className="kpi lg rep">{a.disapprove.toFixed(1)}%</div></div>
              <div><div className="label">Net</div><div className="kpi lg rep">{signed(a.net)}</div></div>
            </div>
          </div>
          <div className="label" style={{ margin: '4px 0' }}>Net approval (approve minus disapprove)</div>
          <TrendChart series={netSeries} dots={dots} partisan yFormat={(v) => signed(Math.round(v), 0)} valueFormat={(v) => signed(v)} zero height={280} endLabel={signed(a.net)} label="Trump net approval over time" color="var(--rep)" />
          <div className="label" style={{ margin: '12px 0 4px' }}>Approval</div>
          <TrendChart series={apprSeries} dots={apprDots} yFormat={(v) => `${Math.round(v)}%`} valueFormat={(v) => `${v.toFixed(1)}%`} height={240} endLabel={`${a.approve.toFixed(1)}%`} label="Trump approval over time" color="var(--ink)" />
          <p className="faint" style={{ fontSize: 12.5, marginTop: 8 }}>Our polls cover late August and September. Earlier this year Silver Bulletin's average went from about 47% at the inauguration to 41% in March, a brief recovery in April, and a low of about 38% in May.</p>
        </div>
        <div className="stack">
          <div className="card">
            <h3>Others' averages</h3>
            <div className="tbl-wrap" style={{ marginTop: 8 }}>
              <table className="tbl">
                <thead><tr><th>Source</th><th className="r">Approve</th><th className="r">Net</th></tr></thead>
                <tbody>
                  <tr><td><b>Tossup (ours)</b></td><td className="r num"><b>{a.approve.toFixed(1)}%</b></td><td className="r num"><b>{signed(a.net)}</b></td></tr>
                  {APPROVAL_PUBLISHED.map((p) => (
                    <tr key={p.who}><td><a href={p.url} target="_blank" rel="noreferrer noopener">{p.who}</a></td><td className="r num">{p.approve}%</td><td className="r num">{p.net !== undefined ? signed(p.net) : '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card tint">
            <h3>Approval and midterms</h3>
            <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>Since 1994, the party out of the White House has won the House popular vote by about {fit.intercept.toFixed(0)} points plus {fit.slope.toFixed(2)} points for every point of net disapproval. At {signed(a.net)}, that points to roughly <b>D+{(fit.intercept + fit.slope * -a.net).toFixed(0)}</b>, within a few points of the generic ballot.</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>Where this stands against past midterms</h3>
            <div className="sub">Each president's approximate net approval at his midterm, and what the other party gained in the House. Approvals are rounded; treat them as a point or two off.</div>
          </div>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          {[...sorted.map((r) => ({ label: `${r.year} ${r.president}`, net: r.net, note: `${r.outPartyGain >= 0 ? '+' : ''}${r.outPartyGain} seats for the other party`, now: false })), { label: '2026 Trump', net: a.net, note: 'now', now: true }]
            .sort((x, y) => x.net - y.net)
            .map((r) => (
              <div key={r.label} className="row" style={{ flexWrap: 'nowrap', gap: 12 }}>
                <div style={{ width: 120, fontWeight: r.now ? 800 : 600 }}>{r.label}</div>
                <div style={{ flex: 1, height: 18, position: 'relative', background: 'var(--surface-2)', borderRadius: 999 }}>
                  <div style={{ position: 'absolute', top: 2, bottom: 2, left: 0, width: `${Math.max(3, pos(r.net))}%`, background: r.now ? 'var(--brand)' : 'var(--ink-3)', opacity: r.now ? 1 : 0.55, borderRadius: 999 }} />
                </div>
                <div className="num" style={{ width: 52, textAlign: 'right', fontWeight: 700 }}>{signed(r.net, 0)}</div>
                <div className="faint" style={{ width: 200, fontSize: 13 }}>{r.note}</div>
              </div>
            ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Every approval poll</h3></div>
        <SortTable rows={approvalPolls} cols={cols} rowKey={(p) => p.id} initialSort="d" initialDesc showNerd={nerd} />
      </div>
    </div>
  );
}
