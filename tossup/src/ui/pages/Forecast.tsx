import { useEffect, useMemo, useState } from 'react';
import { OUTSIDE_FORECASTS } from '../../data/benchmarks';
import { MIDTERMS, fitMidterms } from '../../data/history';
import { FLAVORS, type Flavor } from '../../engine/model';
import type { SimResult } from '../../engine/sim';
import { useForecast, useAgg } from '../../state/forecast';
import { usePrefs } from '../../state/prefs';
import { MarginCurve, Ring, SeatHistogram } from '../charts/Basic';
import { linear, ticks, useWidth } from '../charts/util';
import { Under } from '../components/bits';
import { lead, plainOdds, prob, signed } from '../format';

function ChamberBlock({ title, ch, needed, unit }: { title: string; ch: SimResult['house'] | null; needed: number; unit: string }) {
  return (
    <div className="card">
      <div className="label">{title}</div>
      <div className="row" style={{ gap: 18, flexWrap: 'nowrap', marginTop: 8 }}>
        {ch ? (
          <Ring pD={ch.pControl} size={110} stroke={12} label={`${title}: Democrats ${Math.round(ch.pControl * 100)} percent`}>
            <div className="kpi" style={{ fontSize: 26 }}>{prob(ch.pControl)}</div>
          </Ring>
        ) : (
          <div className="skeleton" style={{ width: 110, height: 110, borderRadius: '50%' }} />
        )}
        <div>
          <div className="kpi sm">{ch ? ch.median : '…'} <span className="faint" style={{ fontSize: 14 }}>D {unit}</span></div>
          <div className="faint" style={{ fontSize: 13 }}>{ch ? `80% range ${ch.p10} to ${ch.p90}` : ''}</div>
          <div className="faint" style={{ fontSize: 13 }}>{ch ? plainOdds(ch.pControl) : ''}</div>
          <div className="faint" style={{ fontSize: 12 }}>{needed} needed</div>
        </div>
      </div>
      {ch && (
        <div style={{ marginTop: 10 }}>
          <SeatHistogram hist={ch.hist} threshold={needed} median={ch.median} height={130} label={`${title} distribution`} unit={unit} needLabel="Democratic majority" />
        </div>
      )}
    </div>
  );
}

function SeatScatter({ pts }: { pts: SimResult['scatter'] }) {
  const [ref, w] = useWidth<HTMLDivElement>(560);
  const h = 260;
  const M = { l: 40, r: 12, t: 12, b: 32 };
  const xs = pts.map((p) => p.nat);
  const ys = pts.map((p) => p.house);
  const x = linear(Math.min(...xs), Math.max(...xs), M.l, w - M.r);
  const y = linear(Math.min(...ys) - 3, Math.max(...ys) + 3, h - M.b, M.t);
  const xt = ticks(Math.min(...xs), Math.max(...xs), 6);
  const yt = ticks(Math.min(...ys), Math.max(...ys), 5);
  return (
    <div ref={ref}>
      <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Democratic House seats versus the national House vote in each simulation">
        {yt.map((t) => (<g key={t}><line x1={M.l} x2={w - M.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="2 4" /><text x={M.l - 6} y={y(t) + 4} textAnchor="end">{t}</text></g>))}
        {xt.map((t) => (<text key={t} x={x(t)} y={h - 10} textAnchor="middle">{t === 0 ? 'Even' : `${t > 0 ? 'D' : 'R'}+${Math.abs(t)}`}</text>))}
        <line x1={M.l} x2={w - M.r} y1={y(218)} y2={y(218)} stroke="var(--ink)" strokeWidth="2" strokeDasharray="4 3" />
        <text x={w - M.r} y={y(218) - 6} textAnchor="end" style={{ fill: 'var(--ink)', fontWeight: 800 }}>218 seats</text>
        {pts.map((p, i) => (<circle key={i} cx={x(p.nat)} cy={y(p.house)} r="2.6" fill={p.house >= 218 ? 'var(--dem)' : 'var(--rep)'} opacity="0.45" />))}
      </svg>
    </div>
  );
}

function HistoryScatter({ now }: { now: number }) {
  const [ref, w] = useWidth<HTMLDivElement>(560);
  const h = 260;
  const M = { l: 44, r: 16, t: 14, b: 34 };
  const fit = fitMidterms();
  const xs = [...MIDTERMS.map((r) => -r.net), -now];
  const x = linear(Math.min(...xs) - 4, Math.max(...xs) + 4, M.l, w - M.r);
  const ys = MIDTERMS.map((r) => (r.party === 'D' ? -r.houseMargin : r.houseMargin));
  const y = linear(Math.min(...ys) - 3, Math.max(...ys, fit.intercept + fit.slope * -now) + 3, h - M.b, M.t);
  const x0 = Math.min(...xs) - 4;
  const x1 = Math.max(...xs) + 4;
  return (
    <div ref={ref}>
      <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Out-party House margin versus president's net disapproval, 1994 to 2022, with 2026">
        {ticks(Math.min(...ys) - 3, Math.max(...ys) + 3, 5).map((t) => (<g key={t}><line x1={M.l} x2={w - M.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="2 4" /><text x={M.l - 6} y={y(t) + 4} textAnchor="end">{signed(t, 0)}</text></g>))}
        {ticks(x0, x1, 6).map((t) => (<text key={t} x={x(t)} y={h - 12} textAnchor="middle">{signed(-t, 0)}</text>))}
        <text x={w / 2} y={h - 0} textAnchor="middle" style={{ fontSize: 11 }}>president's net approval at the midterm</text>
        <line x1={x(x0)} y1={y(fit.intercept + fit.slope * x0)} x2={x(x1)} y2={y(fit.intercept + fit.slope * x1)} stroke="var(--ink-3)" strokeWidth="2" strokeDasharray="5 4" />
        {MIDTERMS.map((r, i) => (
          <g key={r.year}>
            <circle cx={x(-r.net)} cy={y(ys[i])} r="5.5" fill="var(--ink-3)" stroke="var(--surface)" strokeWidth="2" />
            <text x={x(-r.net) + 8} y={y(ys[i]) + 4} style={{ fontSize: 11 }}>{r.year}</text>
          </g>
        ))}
        <circle cx={x(-now)} cy={y(fit.intercept + fit.slope * -now)} r="8" fill="var(--brand)" stroke="var(--ink)" strokeWidth="2.5" />
        <text x={x(-now) - 12} y={y(fit.intercept + fit.slope * -now) - 12} textAnchor="end" style={{ fill: 'var(--ink)', fontWeight: 800, fontSize: 13 }}>2026</text>
      </svg>
      <p className="faint" style={{ fontSize: 12 }}>Vertical axis: the out-party's margin in the House popular vote. Dashed line: the fit. 2026 sits on the line by construction; the point is where it lands.</p>
    </div>
  );
}

export function Forecast() {
  const { config, setConfig, resetConfig, result, running, env, run } = useForecast();
  const { generic, approval } = useAgg();
  const { nerd } = usePrefs();
  const [flavorRes, setFlavorRes] = useState<Record<string, SimResult>>({});
  const [sens, setSens] = useState<{ d: number; res: SimResult }[]>([]);
  const M = config.envOverride ?? env.blend;

  useEffect(() => {
    let dead = false;
    const t = setTimeout(async () => {
      const out: Record<string, SimResult> = {};
      for (const f of FLAVORS) {
        const r = await run(undefined, { flavor: f.id, nSims: 5000 });
        if (dead) return;
        out[f.id] = r;
        setFlavorRes({ ...out });
      }
      const s: { d: number; res: SimResult }[] = [];
      for (const d of [-4, -2, 0, 2, 4]) {
        const r = await run(undefined, { envOverride: M + d, nSims: 5000 });
        if (dead) return;
        s.push({ d, res: r });
        setSens([...s]);
      }
    }, 700);
    return () => {
      dead = true;
      clearTimeout(t);
    };
  }, [run, M]);

  const crossing = useMemo(() => {
    if (!result) return null;
    const pts = [...result.scatter].sort((a, b) => a.nat - b.nat);
    const win = 60;
    let last: number | null = null;
    for (let i = 0; i + win < pts.length; i += 5) {
      const seg = pts.slice(i, i + win);
      const p = seg.filter((s) => s.house >= 218).length / seg.length;
      if (p >= 0.5) {
        last = seg.reduce((a, s) => a + s.nat, 0) / seg.length;
        break;
      }
    }
    return last;
  }, [result]);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">The model room</div>
          <h1>Forecast</h1>
          <p className="lede">20,000 simulated Election Days. Each one draws a national mood, regional and office-specific swings, and a surprise for every race, so races that share a fate (Ohio and Iowa, say) tend to move together.</p>
        </div>
        <div className="row">
          <div className="seg" role="tablist" aria-label="Model version">
            {FLAVORS.map((f) => (
              <button key={f.id} aria-pressed={config.flavor === f.id} title={f.blurb} onClick={() => setConfig({ flavor: f.id as Flavor })}>{f.name}</button>
            ))}
          </div>
          <button className="btn sm" onClick={resetConfig}>Reset dials</button>
        </div>
      </div>
      <div className="callout info">{FLAVORS.find((f) => f.id === config.flavor)?.blurb}{running ? ' Updating…' : ''}</div>

      <div className="grid g3">
        <ChamberBlock title="House" ch={result?.house ?? null} needed={218} unit="seats" />
        <ChamberBlock title="Senate" ch={result?.senate ?? null} needed={51} unit="seats" />
        <ChamberBlock title="Governors" ch={result?.governor ?? null} needed={26} unit="governors" />
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-head">
            <div>
              <h3>The national mood</h3>
              <div className="sub">The starting point for every race: the expected margin in the national House vote</div>
            </div>
            <div style={{ textAlign: 'right' }}><div className="label">Using</div><div className="kpi sm">{lead(M)}</div></div>
          </div>
          <MarginCurve mean={M} sd={result?.national.sd ?? 3.5} domain={20} label="National House vote margin" height={150} />
          <div className="tbl-wrap" style={{ marginTop: 8 }}>
            <table className="tbl">
              <tbody>
                <tr><td>Generic ballot average</td><td className="r num">{lead(generic.margin)}</td></tr>
                <tr><td>Approval-based fundamentals (net {signed(approval.net)})</td><td className="r num">{lead(env.fundamentals)}</td></tr>
                <tr><td><b>Blend, weighted by precision</b></td><td className="r num"><b>{lead(env.blend)}</b></td></tr>
                {config.envOverride !== null && <tr><td>Your override</td><td className="r num"><b>{lead(config.envOverride)}</b></td></tr>}
              </tbody>
            </table>
          </div>
          {result && <p className="muted" style={{ fontSize: 13.5, marginTop: 10 }}>Democrats win the national House vote in {prob(result.national.pDwins)} of simulations.</p>}
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Votes to seats</h3>
              <div className="sub">Each dot is one simulated Election Day. Redistricting makes the House map lean Republican, so Democrats need a positive national margin just to reach 218.</div>
            </div>
          </div>
          {result ? <SeatScatter pts={result.scatter} /> : <div className="skeleton" style={{ height: 260 }} />}
          <p style={{ marginTop: 8, fontSize: 14 }}>
            {crossing !== null ? <>In these simulations, Democrats need about <b>{lead(crossing)}</b> in the national vote for even odds of a House majority.</> : null}
          </p>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Compare the model versions</h3>
              <div className="sub">Same simulation, different ingredients. Big gaps mean the answer depends on what you trust.</div>
            </div>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Version</th><th className="r">House</th><th className="r">Senate</th><th className="r">Governors</th></tr></thead>
              <tbody>
                {FLAVORS.map((f) => {
                  const r = flavorRes[f.id];
                  return (
                    <tr key={f.id} style={{ background: config.flavor === f.id ? 'var(--surface-3)' : undefined }}>
                      <td><b>{f.name}</b></td>
                      <td className="r num">{r ? prob(r.house.pControl) : '…'}</td>
                      <td className="r num">{r ? prob(r.senate.pControl) : '…'}</td>
                      <td className="r num">{r ? prob(r.governor.pControl) : '…'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="faint" style={{ fontSize: 12.5, marginTop: 8 }}>Democratic odds of control. 5,000 simulations each, so expect a point of noise.</p>
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <h3>What if the mood shifts?</h3>
              <div className="sub">Democratic control odds if the national margin moves by this much by Election Day</div>
            </div>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Mood</th><th className="r">House</th><th className="r">Senate</th></tr></thead>
              <tbody>
                {[-4, -2, 0, 2, 4].map((d) => {
                  const r = sens.find((s) => s.d === d)?.res;
                  return (
                    <tr key={d} style={{ background: d === 0 ? 'var(--surface-3)' : undefined }}>
                      <td>{lead(M + d)} <span className="faint">{d === 0 ? '(current)' : `(${signed(d, 0)})`}</span></td>
                      <td className="r num">{r ? prob(r.house.pControl) : '…'}</td>
                      <td className="r num">{r ? prob(r.senate.pControl) : '…'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-head">
            <div>
              <h3>The fundamentals check</h3>
              <div className="sub">Presidents' approval and their party's midterm House results since 1994</div>
            </div>
          </div>
          <HistoryScatter now={approval.net} />
        </div>
        <div className="card">
          <div className="card-head"><div><h3>How other forecasters see it</h3><div className="sub">Quoted from their own pages; ours is the first row</div></div></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Source</th><th>House</th><th>Senate</th></tr></thead>
              <tbody>
                <tr><td><b>Tossup ({config.flavor})</b></td><td><b>{result ? `D ${prob(result.house.pControl)} · ${result.house.median} seats` : '…'}</b></td><td><b>{result ? `D ${prob(result.senate.pControl)} · ${result.senate.median} seats` : '…'}</b></td></tr>
                {OUTSIDE_FORECASTS.map((f) => (
                  <tr key={f.who}>
                    <td><a href={f.url} target="_blank" rel="noreferrer noopener">{f.who}</a><div className="faint" style={{ fontSize: 12 }}>{f.date.slice(5)}</div></td>
                    <td>{f.house ?? <span className="faint">—</span>}</td>
                    <td>{f.senate ?? <span className="faint">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Under title="Dials for the wonky" open={nerd}>
        <div className="grid g2" style={{ gap: 22, marginTop: 8 }}>
          <div className="stack" style={{ gap: 12 }}>
            <div className="field">
              <label htmlFor="mood">National mood override: {config.envOverride === null ? `${lead(env.blend)} (model)` : lead(config.envOverride)}</label>
              <input id="mood" type="range" min={-6} max={16} step={0.25} value={M} onChange={(e) => setConfig({ envOverride: Number(e.target.value) })} />
              <button className="btn sm" style={{ alignSelf: 'start' }} onClick={() => setConfig({ envOverride: null })}>Back to the model's estimate</button>
            </div>
            {(['polls', 'fundamentals', 'ratings'] as const).map((k) => (
              <div className="field" key={k}>
                <label htmlFor={`w-${k}`}>Weight on {k}: {config.weights[k].toFixed(2)}×</label>
                <input id={`w-${k}`} type="range" min={0} max={2.5} step={0.05} value={config.weights[k]} onChange={(e) => setConfig({ weights: { ...config.weights, [k]: Number(e.target.value) }, flavor: 'blend' })} />
              </div>
            ))}
          </div>
          <div className="stack" style={{ gap: 12 }}>
            {(['sigmaNat', 'sigmaRegion', 'sigmaOffice'] as const).map((k) => (
              <div className="field" key={k}>
                <label htmlFor={`s-${k}`}>{k === 'sigmaNat' ? 'National error (points)' : k === 'sigmaRegion' ? 'Regional error' : 'Per-office error'}: {config[k].toFixed(1)}</label>
                <input id={`s-${k}`} type="range" min={0} max={6} step={0.1} value={config[k]} onChange={(e) => setConfig({ [k]: Number(e.target.value) })} />
              </div>
            ))}
            <div className="field">
              <label htmlFor="nsims">Simulations: {config.nSims.toLocaleString()}</label>
              <input id="nsims" type="range" min={4000} max={60000} step={2000} value={config.nSims} onChange={(e) => setConfig({ nSims: Number(e.target.value) })} />
            </div>
            <label className="switch"><input type="checkbox" checked={config.indCaucusD} onChange={(e) => setConfig({ indCaucusD: e.target.checked })} />Count independent challengers as Democrats for Senate control</label>
          </div>
        </div>
      </Under>
    </div>
  );
}
