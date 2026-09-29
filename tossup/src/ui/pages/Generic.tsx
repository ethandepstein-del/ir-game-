import { useMemo, useState } from 'react';
import { GENERIC_HISTORY_POINTS, GENERIC_PUBLISHED, EVENTS } from '../../data/benchmarks';
import { pollsterInfo } from '../../data/pollsters';
import { dayNum, fmtDate, pollDay } from '../../engine/stats';
import { useAgg } from '../../state/forecast';
import { usePrefs } from '../../state/prefs';
import { Link } from '../../router';
import { TrendChart } from '../charts/TrendChart';
import { Under } from '../components/bits';
import { SortTable, type Col } from '../components/SortTable';
import { lead } from '../format';
import type { Poll } from '../../data/types';

export function Generic() {
  const { generic, genericPolls } = useAgg();
  const { nerd } = usePrefs();
  const [pop, setPop] = useState<'all' | 'lv' | 'rv' | 'a'>('all');
  const [showPub, setShowPub] = useState(true);
  const visible = genericPolls.filter((p) => pop === 'all' || p.pop === pop);
  const series = generic.trend.map((t) => ({ day: t.day, mean: t.mean, sd: t.sd }));
  const dots = visible.map((p) => ({
    id: p.id,
    day: pollDay(p.start, p.end),
    value: p.margin * (p.twoParty ? 0.91 : 1),
    pollster: p.pollster,
    pop: p.pop,
    detail: `${p.d !== null ? `${p.d}–${p.r}` : `${lead(p.margin, 0)}`} · ${fmtDate(p.start)}–${fmtDate(p.end)}${p.n ? ` · n=${p.n.toLocaleString()}` : ''}${p.approx ? ' (dates approx.)' : ''}`,
  }));
  const refs = showPub
    ? [{ name: 'Silver Bulletin (as published)', color: 'var(--toss)', points: GENERIC_HISTORY_POINTS.map((p) => ({ day: dayNum(p.date), value: p.value })) }]
    : [];
  const events = EVENTS.map((e) => ({ day: dayNum(e.date), label: e.label }));

  const cols: Col<Poll>[] = useMemo(
    () => [
      { key: 'p', label: 'Pollster', sort: (a, b) => a.pollster.localeCompare(b.pollster), render: (p) => (<><a href={p.source} target="_blank" rel="noreferrer noopener">{p.pollster}</a>{p.id.startsWith('user-') && <span className="chip warn" style={{ marginLeft: 6 }}>yours</span>}</>) },
      { key: 'd', label: 'Field dates', sort: (a, b) => (a.end < b.end ? -1 : 1), render: (p) => <span className="faint">{fmtDate(p.start)}–{fmtDate(p.end)}{p.approx ? ' ~' : ''}</span> },
      { key: 'n', label: 'Sample', right: true, sort: (a, b) => (a.n ?? 0) - (b.n ?? 0), render: (p) => <span className="num">{p.n ? p.n.toLocaleString() : '—'} {p.pop.toUpperCase()}</span> },
      { key: 'r', label: 'D – R', right: true, render: (p) => (p.d !== null ? <span className="num"><span className="dem">{p.d}</span>–<span className="rep">{p.r}</span></span> : <span className="faint">n/a</span>) },
      { key: 'm', label: 'Margin', right: true, sort: (a, b) => a.margin - b.margin, render: (p) => <b className={`num ${p.margin > 0 ? 'dem' : 'rep'}`}>{lead(p.margin)}</b>, title: 'Democratic minus Republican share' },
      { key: 'a', label: 'Adjusted', right: true, nerd: true, sort: (a, b) => (generic.fit.adjusted[a.id] ?? 0) - (generic.fit.adjusted[b.id] ?? 0), render: (p) => <span className="num">{lead(generic.fit.adjusted[p.id] ?? NaN)}</span>, title: 'After house effect and population adjustment (two-party polls are scaled first)' },
      { key: 'h', label: 'House effect', right: true, nerd: true, render: (p) => { const f = generic.fit.houseEffects[pollsterInfo(p.pollster).family]; return f ? <span className="num">{f.effect >= 0 ? 'D' : 'R'}+{Math.abs(f.effect).toFixed(1)}</span> : null; } },
      { key: 'w', label: 'Influence', right: true, nerd: true, sort: (a, b) => (generic.influence[a.id] ?? 0) - (generic.influence[b.id] ?? 0), render: (p) => <span className="num">{((generic.influence[p.id] ?? 0) * 100).toFixed(0)}%</span>, title: "Rough share of today's average that this poll accounts for" },
      { key: 'g', label: 'Grade', nerd: true, render: (p) => <span className="chip" title={pollsterInfo(p.pollster).note}>{pollsterInfo(p.pollster).tier}</span> },
    ],
    [generic],
  );

  const effects = Object.entries(generic.fit.houseEffects).sort((a, b) => b[1].effect - a[1].effect);
  const maxEff = Math.max(...effects.map((e) => Math.abs(e[1].effect)), 1);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">National environment</div>
          <h1>Generic ballot</h1>
          <p className="lede">"If the election for Congress were held today, would you vote for the Democrat or the Republican in your district?" It is the best single read on the national mood, and the main input to the forecast.</p>
        </div>
      </div>

      <div className="grid g-main-side" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head" style={{ flexWrap: 'wrap' }}>
            <div>
              <div className="label">Our average · {fmtDate('2026-09-29', { month: 'long', day: 'numeric' })}</div>
              <div className="kpi lg dem">{lead(generic.margin)}</div>
              <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
                {generic.d.toFixed(1)}% Democratic, {generic.r.toFixed(1)}% Republican · 90% range {lead(generic.lo)} to {lead(generic.hi)}
              </div>
            </div>
            <div className="row">
              <div className="seg" aria-label="Show polls of">
                {([['all', 'All polls'], ['lv', 'Likely voters'], ['rv', 'Registered'], ['a', 'Adults']] as const).map(([k, l]) => (
                  <button key={k} aria-pressed={pop === k} onClick={() => setPop(k)}>{l}</button>
                ))}
              </div>
              <label className="switch"><input type="checkbox" checked={showPub} onChange={(e) => setShowPub(e.target.checked)} />Silver Bulletin readings</label>
            </div>
          </div>
          <TrendChart
            series={series}
            dots={dots}
            refs={refs}
            vlines={events}
            sparseBefore={{ day: dayNum('2026-06-01'), label: 'Few polls in our data' }}
            partisan
            yFormat={(v) => (v === 0 ? 'Even' : `${v > 0 ? 'D' : 'R'}+${Math.abs(Math.round(v))}`)}
            valueFormat={(v) => lead(v)}
            zero
            height={360}
            endLabel={lead(generic.margin)}
            label="Generic congressional ballot average over time with individual polls"
          />
          <p className="faint" style={{ fontSize: 12.5, marginTop: 10 }}>
            The line is the average with a 90% range. Dots are individual polls (filled are likely voters). Diamonds are Silver Bulletin's own published readings, for comparison. Polling before June is sparse in our data, so the early line is a bit rough.
          </p>
        </div>
        <div className="stack">
          <div className="card">
            <h3>Others' averages</h3>
            <div className="sub muted" style={{ fontSize: 13, margin: '4px 0 10px' }}>As published around Sept 27 to 29. Ours uses only the polls in this database, so expect small differences.</div>
            <div className="tbl-wrap">
              <table className="tbl">
                <tbody>
                  <tr><td><b>Tossup (ours)</b></td><td className="r num"><b className="dem">{lead(generic.margin)}</b></td></tr>
                  {GENERIC_PUBLISHED.map((p) => (
                    <tr key={p.who}>
                      <td><a href={p.url} target="_blank" rel="noreferrer noopener">{p.who}</a>{p.note && <div className="faint" style={{ fontSize: 12 }}>{p.note}</div>}</td>
                      <td className="r num">D+{p.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card tint">
            <h3>What does D+{generic.margin.toFixed(0)} mean?</h3>
            <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
              Democrats won the House popular vote by 8.6 points in 2018 and gained 41 seats. Maps have shifted since: after this year's redistricting, the median House seat is about three points redder than the nation, so Democrats need to win the national vote by a few points just to be even in seats. See the <Link to="forecast">forecast</Link> for how that plays out.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>Every poll</h3>
            <div className="sub">{visible.length} {visible.length === 1 ? 'poll' : 'polls'}. Click a pollster to open the source. Turn on Nerd mode for adjustments and weights.</div>
          </div>
        </div>
        <SortTable rows={visible} cols={cols} rowKey={(p) => p.id} initialSort="d" initialDesc showNerd={nerd} limit={18} />
      </div>

      <Under title="House effects: which pollsters run high or low">
        <p className="muted" style={{ marginBottom: 10, fontSize: 13.5 }}>Estimated from the data with shrinkage toward what we know of each firm's history, then centered so the average effect is zero. Positive means the pollster runs more Democratic than the consensus.</p>
        <div className="stack" style={{ gap: 6 }}>
          {effects.map(([name, e]) => (
            <div key={name} className="row" style={{ flexWrap: 'nowrap', gap: 10 }}>
              <div style={{ width: 210, fontSize: 13.5 }}>{name} <span className="faint">({e.n})</span></div>
              <div style={{ flex: 1, position: 'relative', height: 16, background: 'var(--surface-2)', borderRadius: 999 }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: 'var(--line-2)' }} />
                <div style={{ position: 'absolute', top: 2, bottom: 2, borderRadius: 999, background: e.effect >= 0 ? 'var(--dem)' : 'var(--rep)', left: e.effect >= 0 ? '50%' : `${50 - (Math.abs(e.effect) / maxEff) * 50}%`, width: `${(Math.abs(e.effect) / maxEff) * 50}%` }} />
              </div>
              <div className="num" style={{ width: 64, textAlign: 'right', fontSize: 13 }}>{e.effect >= 0 ? 'D+' : 'R+'}{Math.abs(e.effect).toFixed(1)}</div>
            </div>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
          Population effects (a likely-voter poll versus the all-polls average): likely voters {generic.fit.popEffects.lv >= 0 ? 'D' : 'R'}+{Math.abs(generic.fit.popEffects.lv).toFixed(1)}, registered {generic.fit.popEffects.rv >= 0 ? 'D' : 'R'}+{Math.abs(generic.fit.popEffects.rv).toFixed(1)}, adults {generic.fit.popEffects.a >= 0 ? 'D' : 'R'}+{Math.abs(generic.fit.popEffects.a).toFixed(1)}.
        </p>
      </Under>
    </div>
  );
}
