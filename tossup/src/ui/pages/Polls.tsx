import { useMemo, useState } from 'react';
import { pollsterInfo } from '../../data/pollsters';
import { STATES } from '../../data/states';
import { SENATE_RACES, GOVERNOR_RACES } from '../../data/races';
import { HOUSE_SEATS } from '../../data/house';
import { consensus } from '../../data/ratings';
import type { ApprovalPoll, Poll, Pop } from '../../data/types';
import { fmtDate } from '../../engine/stats';
import { Link } from '../../router';
import { useForecast, useAgg } from '../../state/forecast';
import { ALL_POLL_COUNT, RACE_BY_ID } from '../../state/data';
import { usePrefs } from '../../state/prefs';
import { useToast } from '../components/bits';
import { SortTable, type Col } from '../components/SortTable';
import { lead } from '../format';

interface Row {
  id: string;
  kind: 'generic' | 'approval' | 'senate' | 'governor' | 'house';
  where: string;
  to?: string;
  pollster: string;
  start: string;
  end: string;
  n?: number;
  pop?: Pop;
  result: string;
  margin: number | null;
  approx?: boolean;
  internal?: boolean;
  yours: boolean;
  source: string;
  state?: string;
  tier: string;
}

const TODAY = '2026-09-29';

function isoOk(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export function Polls() {
  const { config, addUserPoll, addUserApproval, removeUserPoll, clearUserPolls } = useForecast();
  const { genericPolls, approvalPolls, mergedRace } = useAgg();
  const { nerd } = usePrefs();
  const toast = useToast();
  const [kind, setKind] = useState<'all' | Row['kind']>('all');
  const [state, setState] = useState('');
  const [q, setQ] = useState('');
  const [pop, setPop] = useState<'' | Pop>('');
  const [days, setDays] = useState(0);
  const [showForm, setShowForm] = useState(false);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const p of genericPolls) out.push({ id: p.id, kind: 'generic', where: 'Generic ballot', to: 'generic', pollster: p.pollster, start: p.start, end: p.end, n: p.n, pop: p.pop, result: p.d !== null ? `${p.d}–${p.r}` : '', margin: p.margin, approx: p.approx, internal: !!p.internal, yours: p.id.startsWith('user-'), source: p.source, tier: pollsterInfo(p.pollster).tier });
    for (const p of approvalPolls) out.push({ id: p.id, kind: 'approval', where: 'Trump approval', to: 'approval', pollster: p.pollster, start: p.start, end: p.end, n: p.n, pop: p.pop, result: `${p.approve}% approve${p.disapprove !== null ? ` / ${p.disapprove}%` : ''}`, margin: p.disapprove !== null ? p.approve - p.disapprove : null, approx: p.approx, yours: p.id.startsWith('user-'), source: p.source, tier: pollsterInfo(p.pollster).tier });
    for (const [rid, list] of Object.entries(mergedRace)) {
      const meta = RACE_BY_ID[rid];
      for (const p of list) out.push({ id: p.id, kind: meta?.office ?? 'senate', where: meta?.title ?? rid, to: `race/${rid}`, pollster: p.pollster, start: p.start, end: p.end, n: p.n, pop: p.pop, result: p.d !== null ? `${p.d}–${p.r}` : '', margin: p.margin, approx: p.approx, internal: !!p.internal, yours: p.id.startsWith('user-'), source: p.source, state: meta?.state, tier: pollsterInfo(p.pollster).tier });
    }
    return out.sort((a, b) => (a.end < b.end ? 1 : a.end > b.end ? -1 : 0));
  }, [genericPolls, approvalPolls, mergedRace]);

  const filtered = rows.filter((r) => {
    if (kind !== 'all' && r.kind !== kind) return false;
    if (state && r.state !== state) return false;
    if (pop && r.pop !== pop) return false;
    if (q && !`${r.pollster} ${r.where}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (days) {
      const age = (Date.parse(TODAY) - Date.parse(r.end)) / 86_400_000;
      if (age > days) return false;
    }
    return true;
  });

  const cols: Col<Row>[] = [
    { key: 'where', label: 'Race', sort: (a, b) => a.where.localeCompare(b.where), render: (r) => <Link to={r.to ?? 'polls'}>{r.where}</Link> },
    { key: 'p', label: 'Pollster', sort: (a, b) => a.pollster.localeCompare(b.pollster), render: (r) => (<><a href={r.source} target="_blank" rel="noreferrer noopener">{r.pollster}</a>{r.yours && <span className="chip warn" style={{ marginLeft: 6 }}>yours</span>}{r.internal && <span className="chip" style={{ marginLeft: 6 }} title="Released by a campaign">internal</span>}</>) },
    { key: 'dates', label: 'Field dates', sort: (a, b) => (a.end < b.end ? -1 : 1), render: (r) => <span className="faint">{fmtDate(r.start)}–{fmtDate(r.end)}{r.approx ? ' ~' : ''}</span> },
    { key: 'n', label: 'Sample', right: true, sort: (a, b) => (a.n ?? 0) - (b.n ?? 0), render: (r) => <span className="num">{r.n ? r.n.toLocaleString() : '—'} {r.pop?.toUpperCase() ?? ''}</span> },
    { key: 'res', label: 'Result', right: true, render: (r) => <span className="num">{r.result}</span> },
    { key: 'm', label: 'Margin', right: true, sort: (a, b) => (a.margin ?? -99) - (b.margin ?? -99), render: (r) => (r.margin === null ? <span className="faint">—</span> : r.kind === 'approval' ? <b className={`num ${r.margin < 0 ? 'rep' : r.margin > 0 ? 'dem' : ''}`}>{r.margin > 0 ? '+' : r.margin < 0 ? '−' : ''}{Math.abs(r.margin)}</b> : <b className={`num ${r.margin > 0 ? 'dem' : r.margin < 0 ? 'rep' : ''}`}>{lead(r.margin)}</b>) },
    { key: 'g', label: 'Grade', nerd: true, render: (r) => <span className="chip">{r.tier}</span> },
    { key: 'x', label: '', render: (r) => (r.yours ? <button className="btn sm" onClick={() => removeUserPoll(r.id)}>Remove</button> : null) },
  ];

  const copy = async (fmt: 'csv' | 'json') => {
    const text =
      fmt === 'json'
        ? JSON.stringify(filtered.map(({ where, pollster, start, end, n, pop, result, margin, source }) => ({ where, pollster, start, end, n, pop, result, margin, source })), null, 2)
        : ['where,pollster,start,end,n,pop,result,margin,source', ...filtered.map((r) => [r.where, r.pollster, r.start, r.end, r.n ?? '', r.pop ?? '', r.result, r.margin ?? '', r.source].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.say(`Copied ${filtered.length} polls as ${fmt.toUpperCase()}.`);
    } catch {
      toast.say('Your browser blocked copying.');
    }
  };

  const userCount = config.extraPolls.length + config.extraApproval.length;
  const counts = { generic: 0, approval: 0, senate: 0, governor: 0, house: 0 } as Record<string, number>;
  rows.forEach((r) => counts[r.kind]++);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">{ALL_POLL_COUNT + userCount} polls</div>
          <h1>Poll explorer</h1>
          <p className="lede">Every poll behind the averages and the forecast, each with a link to its source. Add one you just saw and watch the numbers move.</p>
        </div>
        <button className="btn gold" onClick={() => setShowForm(!showForm)}>{showForm ? 'Close' : 'Add a poll'}</button>
      </div>

      {showForm && <AddPoll onAdd={(p) => { addUserPoll(p); toast.say('Added. The forecast is re-running.'); }} onAddApproval={(p) => { addUserApproval(p); toast.say('Added. The approval average is updated.'); }} />}

      {userCount > 0 && (
        <div className="callout">
          <b>You've added {userCount} {userCount === 1 ? 'poll' : 'polls'}.</b> They are included in every average and forecast in this browser only, and are marked "yours". <button className="btn sm" onClick={clearUserPolls} style={{ marginLeft: 8 }}>Remove all of mine</button>
        </div>
      )}

      <div className="card">
        <div className="row" style={{ gap: 12, marginBottom: 14, alignItems: 'flex-end' }}>
          <div className="seg" aria-label="Poll type" style={{ flexWrap: 'wrap' }}>
            {([['all', `All (${rows.length})`], ['generic', `Generic (${counts.generic})`], ['approval', `Approval (${counts.approval})`], ['senate', `Senate (${counts.senate})`], ['governor', `Governor (${counts.governor})`], ['house', `House (${counts.house})`]] as const).map(([k, l]) => (
              <button key={k} aria-pressed={kind === k} onClick={() => setKind(k as typeof kind)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="grid g4" style={{ gap: 10, marginBottom: 14 }}>
          <div className="field"><label htmlFor="pq">Search</label><input id="pq" className="input" placeholder="Pollster or race" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="field"><label htmlFor="ps">State</label><select id="ps" className="input" value={state} onChange={(e) => setState(e.target.value)}><option value="">All states</option>{STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></div>
          <div className="field"><label htmlFor="pp">Population</label><select id="pp" className="input" value={pop} onChange={(e) => setPop(e.target.value as Pop | '')}><option value="">Any</option><option value="lv">Likely voters</option><option value="rv">Registered voters</option><option value="a">Adults</option></select></div>
          <div className="field"><label htmlFor="pd">Recency</label><select id="pd" className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={0}>Any time</option><option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option></select></div>
        </div>
        <div className="spread" style={{ marginBottom: 8 }}>
          <span className="muted" style={{ fontSize: 13.5 }}>{filtered.length} matching</span>
          <div className="row">
            <button className="btn sm" onClick={() => copy('csv')}>Copy CSV</button>
            <button className="btn sm" onClick={() => copy('json')}>Copy JSON</button>
          </div>
        </div>
        <SortTable rows={filtered} cols={cols} rowKey={(r) => r.kind + r.id} initialSort="dates" initialDesc showNerd={nerd} limit={40} empty="No polls match those filters." />
        <p className="faint" style={{ fontSize: 12.5, marginTop: 10 }}>
          A tilde (~) means only a release date was found, so field dates are approximate. Poll counts by race are as complete as public reporting we could reach; a race showing no polls may simply not have been searched thoroughly. House polls are rare and none are included yet.
        </p>
      </div>
      {toast.node}
    </div>
  );
}

function AddPoll({ onAdd, onAddApproval }: { onAdd: (p: Poll) => void; onAddApproval: (p: ApprovalPoll) => void }) {
  const [kind, setKind] = useState<'generic' | 'approval' | 'race'>('generic');
  const [race, setRace] = useState('senate-nc');
  const [pollster, setPollster] = useState('');
  const [start, setStart] = useState('2026-09-27');
  const [end, setEnd] = useState('2026-09-28');
  const [n, setN] = useState('800');
  const [pop, setPop] = useState<Pop>('lv');
  const [d, setD] = useState('');
  const [r, setR] = useState('');
  const [src, setSrc] = useState('');
  const [err, setErr] = useState('');

  const races = [...SENATE_RACES, ...GOVERNOR_RACES, ...HOUSE_SEATS.filter((h) => consensus(h).rating !== 'safe-d' && consensus(h).rating !== 'safe-r')];

  const submit = () => {
    setErr('');
    if (!pollster.trim()) return setErr('Add the pollster name.');
    if (!isoOk(start) || !isoOk(end) || start > end) return setErr('Check the dates: the end must be on or after the start.');
    const dv = Number(d);
    const rv = Number(r);
    if (!Number.isFinite(dv) || !Number.isFinite(rv) || dv < 0 || rv < 0) return setErr(kind === 'approval' ? 'Enter approve and disapprove percentages.' : 'Enter both toplines as percentages.');
    if (dv + rv > 100.5) return setErr('The two numbers add to more than 100.');
    const nn = n ? Number(n) : undefined;
    if (nn !== undefined && (!Number.isFinite(nn) || nn < 50)) return setErr('Sample size looks too small.');
    const id = `user-${Date.now()}`;
    const source = src.trim() || 'https://';
    if (kind === 'approval') {
      onAddApproval({ id, pollster: pollster.trim(), start, end, n: nn, pop, approve: dv, disapprove: rv, source });
    } else {
      onAdd({ id, race: kind === 'generic' ? 'generic' : race, pollster: pollster.trim(), start, end, n: nn, pop, d: dv, r: rv, margin: +(dv - rv).toFixed(2), source });
    }
    setD('');
    setR('');
  };

  return (
    <div className="card">
      <div className="card-head"><div><h3>Add a poll</h3><div className="sub">It joins the averages immediately, only in this browser. Use the same numbers the pollster published.</div></div></div>
      <div className="grid g3" style={{ gap: 12 }}>
        <div className="field"><label htmlFor="ak">Type</label><select id="ak" className="input" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="generic">Generic ballot</option><option value="approval">Trump approval</option><option value="race">A specific race</option></select></div>
        {kind === 'race' && (
          <div className="field"><label htmlFor="ar">Race</label><select id="ar" className="input" value={race} onChange={(e) => setRace(e.target.value)}>{races.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></div>
        )}
        <div className="field"><label htmlFor="ap">Pollster</label><input id="ap" className="input" list="pollsters" value={pollster} onChange={(e) => setPollster(e.target.value)} placeholder="e.g. Marist" /><datalist id="pollsters">{['Emerson College', 'Marist', 'Quinnipiac', 'NYT/Siena', 'Economist/YouGov', 'Morning Consult', 'Rasmussen Reports', 'Cygnal', 'Fox News', 'CNN/SSRS'].map((x) => <option key={x} value={x} />)}</datalist></div>
        <div className="field"><label htmlFor="as">First day in the field</label><input id="as" className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="field"><label htmlFor="ae">Last day</label><input id="ae" className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        <div className="field"><label htmlFor="an">Sample size</label><input id="an" className="input" type="number" min={50} value={n} onChange={(e) => setN(e.target.value)} /></div>
        <div className="field"><label htmlFor="apop">Who was polled</label><select id="apop" className="input" value={pop} onChange={(e) => setPop(e.target.value as Pop)}><option value="lv">Likely voters</option><option value="rv">Registered voters</option><option value="a">Adults</option></select></div>
        <div className="field"><label htmlFor="ad">{kind === 'approval' ? 'Approve %' : 'Democrat %'}</label><input id="ad" className="input" type="number" step="0.1" value={d} onChange={(e) => setD(e.target.value)} /></div>
        <div className="field"><label htmlFor="ar2">{kind === 'approval' ? 'Disapprove %' : 'Republican %'}</label><input id="ar2" className="input" type="number" step="0.1" value={r} onChange={(e) => setR(e.target.value)} /></div>
        <div className="field" style={{ gridColumn: 'span 1' }}><label htmlFor="asrc">Source link (optional)</label><input id="asrc" className="input" value={src} onChange={(e) => setSrc(e.target.value)} placeholder="https://" /></div>
      </div>
      {err && <div className="callout" style={{ marginTop: 12 }}>{err}</div>}
      <div className="row" style={{ marginTop: 14 }}><button className="btn primary" onClick={submit}>Add poll</button></div>
    </div>
  );
}
