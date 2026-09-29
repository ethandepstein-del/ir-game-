import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ALL_RACES, RACE_BY_ID } from '../../state/data';
import { STATE_BY_CODE } from '../../data/states';
import type { RaceMeta } from '../../data/types';
import { NIGHT_END_MIN, clockLabel, constraintsFrom, makeWorld, parseFeed, partialSd, resultsAt, sampleFeed, swingVsModel, tally, type RaceResult, type Results } from '../../engine/night';
import type { SimResult } from '../../engine/sim';
import { useForecast } from '../../state/forecast';
import { Sparkline } from '../charts/Basic';
import { lead, prob } from '../format';
import { HexMap, StateMap, TileMap } from '../maps/maps';
import { RATING_LABEL } from '../../data/ratings';
import { consensus } from '../../data/ratings';
import { fmtClose } from '../pages/RacePage';
import { navigate } from '../../router';

type Source = 'practice' | 'manual' | 'feed';
type Chamber = 'senate' | 'house' | 'governor';
interface Call { id: string; who: 'D' | 'R' | 'I'; at: string }

const CHAMBERS: [Chamber, string][] = [['senate', 'Senate'], ['house', 'House'], ['governor', 'Governors']];

function winnerName(meta: RaceMeta, who: 'D' | 'R' | 'I'): string {
  const c = who === 'D' ? meta.candidates.D : who === 'R' ? meta.candidates.R : meta.candidates.I;
  const party = who === 'I' ? 'I' : who;
  return c ? `${c.name} (${party})` : `${party === 'D' ? 'Democrat' : party === 'R' ? 'Republican' : 'Independent'}`;
}

function liveFill(r: RaceResult | undefined): string {
  if (!r) return 'var(--rt-none)';
  if (r.called === 'D') return 'var(--dem-2)';
  if (r.called === 'R') return 'var(--rep-2)';
  if (r.called === 'I') return 'var(--ind)';
  if (r.margin === null) return 'var(--rt-none)';
  const m = r.margin;
  if (m > 8) return 'var(--rt-ld)';
  if (m > 0.5) return 'var(--rt-nd)';
  if (m >= -0.5) return 'var(--rt-t)';
  if (m >= -8) return 'var(--rt-nr)';
  return 'var(--rt-lr)';
}

function Confetti({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 26 }, (_, i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 9) * 0.12}s`, background: i % 3 === 0 ? 'var(--brand)' : i % 3 === 1 ? 'var(--dem)' : 'var(--rep)' }} />
      ))}
    </div>
  );
}

function ScoreBar({ label, t, pWin, deltaFromStart, hist, seats }: { label: string; t: ReturnType<typeof tally>; pWin: number | null; deltaFromStart: number | null; hist: number[]; seats?: number }) {
  const { D, R, I, pending, needed } = t;
  const total = D + R + I + pending || 1;
  const decidedD = D >= needed;
  const decidedR = D + pending + (0) < needed;
  return (
    <div className="score">
      <div className="spread">
        <b>{label}</b>
        <span className="faint" style={{ fontSize: 12.5 }}>{needed} needed</span>
      </div>
      <div className="row" style={{ gap: 12, alignItems: 'flex-end', flexWrap: 'nowrap', margin: '6px 0' }}>
        <div>
          <div className="kpi sm" style={{ color: decidedD ? 'var(--dem)' : decidedR ? 'var(--rep)' : undefined }}>{pWin === null ? '…' : decidedD ? '100%' : decidedR ? '0%' : prob(pWin)}</div>
          <div className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>Dem. control odds{deltaFromStart !== null && Math.abs(deltaFromStart) >= 0.005 ? ` (${deltaFromStart > 0 ? '+' : '−'}${Math.abs(Math.round(deltaFromStart * 100))})` : ''}</div>
        </div>
        <Sparkline values={hist.length > 1 ? hist : [pWin ?? 0.5, pWin ?? 0.5]} width={120} height={36} color="var(--ink-2)" fill={false} />
      </div>
      <div style={{ display: 'flex', gap: 2, height: 22, borderRadius: 8, overflow: 'hidden', background: 'var(--surface-3)', position: 'relative' }} role="img" aria-label={`${label}: ${D} Democratic, ${R} Republican, ${I} independent, ${pending} undecided`}>
        <div style={{ width: `${(D / total) * 100}%`, background: 'var(--dem-2)' }} />
        {I > 0 && <div style={{ width: `${(I / total) * 100}%`, background: 'var(--ind)' }} />}
        <div style={{ flex: 1 }} />
        <div style={{ width: `${(R / total) * 100}%`, background: 'var(--rep-2)' }} />
        <div style={{ position: 'absolute', left: `${(needed / total) * 100}%`, top: 0, bottom: 0, width: 2, background: 'var(--ink)' }} />
      </div>
      <div className="spread" style={{ fontSize: 12.5, marginTop: 4 }}>
        <span className="dem"><b>{D}</b> D{I ? ` · ${I} I` : ''}</span>
        <span className="faint">{pending} undecided{seats ? '' : ''}</span>
        <span className="rep"><b>{R}</b> R</span>
      </div>
      {(decidedD || decidedR) && <div className={`callout ${decidedD ? '' : 'info'}`} style={{ marginTop: 8, fontWeight: 800, fontSize: 13.5 }}>{decidedD ? `Democrats have won ${label === 'Governors' ? 'a majority of governorships' : `the ${label}`}.` : `Republicans have held ${label === 'Governors' ? 'a majority of governorships' : `the ${label}`}.`}</div>}
    </div>
  );
}

export function LiveMap() {
  const { result: base, models, modelById, run, config, env } = useForecast();
  const [source, setSource] = useState<Source>('practice');
  const [chamber, setChamber] = useState<Chamber>('senate');
  const [style, setStyle] = useState<'geo' | 'tile'>('geo');
  const [sel, setSel] = useState<string | null>(null);
  const indep = useMemo(() => Object.fromEntries(models.map((m) => [m.id, m.indepD])), [models]);
  const known = useMemo(() => new Set(ALL_RACES.map((r) => r.id)), []);

  // practice night
  const [seed, setSeed] = useState(67);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(6);
  const envMean = config.envOverride ?? env.blend;
  const world = useMemo(() => makeWorld(models, config, envMean, seed), [models, config, envMean, seed]);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setT((x) => {
        const n = Math.min(NIGHT_END_MIN, x + speed * 0.1);
        if (n >= NIGHT_END_MIN) setPlaying(false);
        return n;
      });
    }, 100);
    return () => clearInterval(id);
  }, [playing, speed]);

  // manual and feed
  const [manual, setManual] = useState<Results>({});
  const [feed, setFeed] = useState<Results>({});
  const [feedUrl, setFeedUrl] = useState('');
  const [feedAuto, setFeedAuto] = useState(false);
  const [feedSecs, setFeedSecs] = useState(20);
  const [feedMsg, setFeedMsg] = useState<string>('');
  const [feedJson, setFeedJson] = useState('');

  const minute = Math.floor(t);
  const practiceResults = useMemo(() => resultsAt(world, models, indep, minute), [world, models, indep, minute]);
  const results: Results = source === 'practice' ? practiceResults : source === 'manual' ? manual : feed;
  const clock = source === 'practice' ? clockLabel(minute) : 'live';

  // the needle
  const cons = useMemo(() => constraintsFrom(results, indep), [results, indep]);
  const empty = Object.keys(cons.forced ?? {}).length + Object.keys(cons.observed ?? {}).length === 0;
  const [needle, setNeedle] = useState<SimResult | null>(null);
  const [hist, setHist] = useState<{ t: number; h: number; s: number; g: number }[]>([]);
  const pending = useRef<typeof cons | null>(null);
  const inflight = useRef(false);
  const alive = useRef(true);
  const stamp = useRef(0);
  const updateCount = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  stamp.current = source === 'practice' ? minute : updateCount.current;
  const pump = useCallback(async () => {
    inflight.current = true;
    while (pending.current) {
      const c = pending.current;
      pending.current = null;
      const at = stamp.current;
      try {
        const r = await run(c, { nSims: 7000 });
        if (!alive.current) return;
        setNeedle(r);
        setHist((h) => [...h.filter((p) => p.t !== at), { t: at, h: r.house.pControl, s: r.senate.pControl, g: r.governor.pControl }].sort((a, b) => a.t - b.t));
      } catch {
        /* ignore a failed step */
      }
    }
    inflight.current = false;
  }, [run]);
  useEffect(() => {
    if (empty) {
      setNeedle(null);
      setHist([]);
      return;
    }
    pending.current = cons;
    if (!inflight.current) void pump();
  }, [cons, empty, pump]);
  const shown = needle ?? base;

  // call log
  const [calls, setCalls] = useState<Call[]>([]);
  const prevCalled = useRef<Set<string>>(new Set());
  useEffect(() => {
    const now = new Set(Object.entries(results).filter(([, r]) => r.called).map(([id]) => id));
    const fresh = [...now].filter((id) => !prevCalled.current.has(id));
    if (fresh.length) {
      setCalls((c) => [...fresh.map((id) => ({ id, who: results[id].called as 'D' | 'R' | 'I', at: source === 'practice' ? clockLabel(results[id].calledAt ?? minute) : new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) })), ...c].slice(0, 400));
    }
    prevCalled.current = now;
  }, [results, source, minute]);

  const resetAll = (s: Source) => {
    setSource(s);
    setNeedle(null);
    setHist([]);
    setCalls([]);
    prevCalled.current = new Set();
    setSel(null);
    updateCount.current = 0;
    if (s === 'practice') {
      setT(0);
      setPlaying(false);
    }
  };

  const tallies = useMemo(() => ({ senate: tally(results, ALL_RACES, 'senate'), house: tally(results, ALL_RACES, 'house'), governor: tally(results, ALL_RACES, 'governor') }), [results]);
  const decidedNow = (c: Chamber) => {
    const tl = tallies[c];
    return tl.D >= tl.needed ? 'D' : tl.D + tl.pending < tl.needed ? 'R' : null;
  };
  const [confetti, setConfetti] = useState(false);
  const decidedKey = ['senate', 'house', 'governor'].map((c) => decidedNow(c as Chamber)).join('');
  const lastKey = useRef('');
  useEffect(() => {
    if (decidedKey !== lastKey.current && lastKey.current !== '' && /D/.test(decidedKey)) {
      setConfetti(true);
      const id = setTimeout(() => setConfetti(false), 3500);
      lastKey.current = decidedKey;
      return () => clearTimeout(id);
    }
    lastKey.current = decidedKey;
  }, [decidedKey]);

  const swing = useMemo(() => swingVsModel(results, modelById), [results, modelById]);

  const races = ALL_RACES.filter((r) => r.office === chamber);
  const byKey = useMemo(() => Object.fromEntries(races.map((r) => [chamber === 'house' ? r.id : r.state, r])), [races, chamber]);
  const fill = (key: string) => {
    const meta = byKey[key];
    if (!meta) return undefined;
    return liveFill(results[meta.id]);
  };
  const hatch = (key: string) => {
    const meta = byKey[key];
    const r = meta && results[meta.id];
    return !!r && !r.called && r.margin !== null;
  };
  const mark = (key: string) => (byKey[key] && results[byKey[key].id]?.called ? '✓' : undefined);
  const tip = (key: string) => {
    const meta = byKey[key];
    if (!meta) return <span>Not on the ballot in 2026</span>;
    const r = results[meta.id];
    const m = modelById[meta.id];
    return (
      <>
        <b>{meta.title}</b>
        {r?.called ? <div>Called: {winnerName(meta, r.called)}</div> : r && r.margin !== null ? <div>{Math.round(r.reporting * 100)}% in · {lead(r.margin)}</div> : <div>No results yet · polls close {fmtClose(STATE_BY_CODE[meta.state].close)} ET</div>}
        <div className="tip-sub">Forecast {lead(m?.mean ?? 0)} · {RATING_LABEL[consensus(meta).rating]}</div>
      </>
    );
  };

  const selMeta = sel ? RACE_BY_ID[sel] : null;
  const onSelect = (key: string) => {
    const meta = byKey[key];
    if (meta) setSel(meta.id);
  };

  // manual editing
  const [mRep, setMRep] = useState('50');
  const [mD, setMD] = useState('');
  const [mR, setMR] = useState('');
  const applyManual = (called?: 'D' | 'R' | 'I' | null) => {
    if (!selMeta) return;
    const rep = Math.min(100, Math.max(0, Number(mRep) || 0)) / 100;
    const d = Number(mD);
    const r = Number(mR);
    const margin = d + r > 0 ? (100 * (d - r)) / (d + r) : null;
    updateCount.current += 1;
    setManual((prev) => {
      const next = { ...prev };
      if (called === null) delete next[selMeta.id];
      else next[selMeta.id] = { reporting: called ? Math.max(rep, 0.02) : rep, margin: margin ?? prev[selMeta.id]?.margin ?? null, called: called ?? undefined };
      return next;
    });
  };

  const fetchFeed = useCallback(async () => {
    try {
      if (!feedUrl) {
        setFeedMsg('Enter a URL first, or paste JSON below.');
        return;
      }
      const res = await fetch(feedUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const p = parseFeed(await res.json(), known);
      updateCount.current += 1;
      setFeed(p.results);
      setFeedMsg(`Loaded ${Object.keys(p.results).length} races${p.updated ? `, updated ${p.updated}` : ''}.${p.problems.length ? ` ${p.problems.length} problem(s): ${p.problems.slice(0, 3).join('; ')}` : ''}`);
    } catch (e) {
      setFeedMsg(`Could not load the feed (${(e as Error).message}). The server has to allow cross-origin requests (CORS) and return JSON in the format below.`);
    }
  }, [feedUrl, known]);
  useEffect(() => {
    if (source !== 'feed' || !feedAuto || !feedUrl) return;
    const id = setInterval(fetchFeed, Math.max(5, feedSecs) * 1000);
    return () => clearInterval(id);
  }, [source, feedAuto, feedUrl, feedSecs, fetchFeed]);
  const applyJson = () => {
    try {
      const p = parseFeed(JSON.parse(feedJson), known);
      updateCount.current += 1;
      setFeed(p.results);
      setFeedMsg(`Applied ${Object.keys(p.results).length} races.${p.problems.length ? ` Problems: ${p.problems.slice(0, 4).join('; ')}` : ''}`);
    } catch (e) {
      setFeedMsg(`That isn't valid JSON: ${(e as Error).message}`);
    }
  };

  // lists
  const reportingList = useMemo(
    () =>
      races
        .map((r) => ({ r, res: results[r.id] }))
        .filter((x) => x.res && !x.res.called && x.res.margin !== null)
        .sort((a, b) => Math.abs(a.res!.margin as number) - Math.abs(b.res!.margin as number))
        .slice(0, 14),
    [races, results],
  );

  const startHist = base ? { h: base.house.pControl, s: base.senate.pControl, g: base.governor.pControl } : null;
  const histSeries = (k: 'h' | 's' | 'g') => (startHist ? [startHist[k], ...hist.map((p) => p[k])] : hist.map((p) => p[k]));

  return (
    <div className="stack" style={{ gap: 20 }}>
      <Confetti on={confetti} />
      <div className="card">
        <div className="card-head" style={{ flexWrap: 'wrap' }}>
          <div className="seg" role="tablist" aria-label="Where results come from">
            <button aria-pressed={source === 'practice'} onClick={() => resetAll('practice')}>Practice night</button>
            <button aria-pressed={source === 'manual'} onClick={() => resetAll('manual')}>Type it in</button>
            <button aria-pressed={source === 'feed'} onClick={() => resetAll('feed')}>Live feed</button>
          </div>
          <span className="chip warn">{source === 'practice' ? 'SIMULATED: not real results' : source === 'manual' ? 'Your entries' : 'Your feed'}</span>
        </div>

        {source === 'practice' && (
          <div className="stack" style={{ gap: 10 }}>
            <p className="muted" style={{ fontSize: 14 }}>
              One possible election night, drawn from the model. States report on their own schedules, early counts lean one way or the other, and races are called when the lead is safe. The odds needle updates from the votes counted, as it would on the real night. Press play, or drag the clock.
            </p>
            <div className="row" style={{ gap: 12 }}>
              <button className="btn primary" onClick={() => { if (t >= NIGHT_END_MIN) setT(0); setPlaying(!playing); }} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚ Pause' : t >= NIGHT_END_MIN ? '↺ Replay' : '▶ Play'}</button>
              <div className="clock num">{clock} <span className="faint" style={{ fontSize: 13 }}>ET</span></div>
              <div className="seg" aria-label="Speed">
                {([[2, 'Slow'], [6, 'Normal'], [18, 'Fast'], [50, 'Blitz']] as const).map(([v, l]) => (
                  <button key={v} aria-pressed={speed === v} onClick={() => setSpeed(v)}>{l}</button>
                ))}
              </div>
              <button className="btn sm" onClick={() => { setSeed(seed + 1); resetAll('practice'); }}>New night</button>
            </div>
            <input type="range" min={0} max={NIGHT_END_MIN} step={1} value={t} onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} aria-label="Election night clock" />
            <div className="row">
              {[['7 pm', 60], ['8 pm', 120], ['9 pm', 180], ['10 pm', 240], ['11 pm', 300], ['Midnight', 360], ['2 am', 480], ['4 am', 600]].map(([l, v]) => (
                <button key={l as string} className="btn sm" onClick={() => { setPlaying(false); setT(v as number); }}>{l}</button>
              ))}
            </div>
          </div>
        )}

        {source === 'manual' && (
          <p className="muted" style={{ fontSize: 14 }}>
            Follow along with your TV or a results site. Click a race on the map, enter how much is counted and the vote totals so far (or percentages), or call it outright. The odds update from what you enter.
          </p>
        )}

        {source === 'feed' && (
          <div className="stack" style={{ gap: 10 }}>
            <p className="muted" style={{ fontSize: 14 }}>
              Point Tossup at any JSON endpoint you control or can read that follows the format below (a small script or serverless function can translate a state or wire feed into it). Results are polled every few seconds. No real results exist until polls close, so nothing is loaded by default.
            </p>
            <div className="grid g2" style={{ gap: 12 }}>
              <div className="field">
                <label htmlFor="feedurl">Feed URL</label>
                <input id="feedurl" className="input" placeholder="https://example.com/results.json" value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} />
                <div className="row">
                  <button className="btn sm primary" onClick={fetchFeed}>Fetch now</button>
                  <label className="switch"><input type="checkbox" checked={feedAuto} onChange={(e) => setFeedAuto(e.target.checked)} />Auto-refresh every</label>
                  <input aria-label="Seconds between refreshes" className="input" style={{ width: 70 }} type="number" min={5} value={feedSecs} onChange={(e) => setFeedSecs(Number(e.target.value))} /> sec
                </div>
              </div>
              <div className="field">
                <label htmlFor="feedjson">Or paste JSON</label>
                <textarea id="feedjson" className="input" rows={5} style={{ fontFamily: 'monospace', fontSize: 12 }} placeholder='{"races": {"senate-nc": {"reporting": 62, "d": 1204331, "r": 1102982}}}' value={feedJson} onChange={(e) => setFeedJson(e.target.value)} />
                <div className="row">
                  <button className="btn sm primary" onClick={applyJson}>Apply</button>
                  <button className="btn sm" onClick={() => setFeedJson(sampleFeed(models.filter((m) => m.office === 'senate').map((m) => m.id)))}>Insert an example</button>
                </div>
              </div>
            </div>
            {feedMsg && <div className="callout info" style={{ fontSize: 13.5 }}>{feedMsg}</div>}
            <details className="under"><summary>Feed format</summary>
              <div className="under-body">
                <pre className="code">{`{
  "updated": "2026-11-03T21:15:00-05:00",
  "races": {
    "senate-nc":  { "reporting": 62, "d": 1204331, "r": 1102982 },
    "gov-az":     { "reporting": 35, "dPct": 51.2, "rPct": 46.9 },
    "house-pa-07": { "reporting": 88, "d": 141200, "r": 139900, "called": "D" }
  }
}`}</pre>
                <p className="muted" style={{ fontSize: 13 }}>Keys are race ids: <code>senate-xx</code>, <code>gov-xx</code>, <code>house-xx-nn</code> (lowercase state, two-digit district). <code>reporting</code> is 0 to 100 (or 0 to 1). <code>d</code> and <code>r</code> can be vote counts or percentages; only their ratio is used. <code>called</code> is <code>"D"</code>, <code>"R"</code> or <code>"I"</code> for an independent winner.</p>
              </div>
            </details>
          </div>
        )}
      </div>

      <div className="grid g-main-side" style={{ alignItems: 'start' }}>
        <div className="stack">
          <div className="card">
            <div className="card-head" style={{ flexWrap: 'wrap' }}>
              <div className="seg" role="tablist" aria-label="Chamber">
                {CHAMBERS.map(([k, l]) => (<button key={k} aria-pressed={chamber === k} onClick={() => { setChamber(k); setSel(null); }}>{l}</button>))}
              </div>
              {chamber !== 'house' && (
                <div className="seg">
                  <button aria-pressed={style === 'geo'} onClick={() => setStyle('geo')}>Map</button>
                  <button aria-pressed={style === 'tile'} onClick={() => setStyle('tile')}>Tiles</button>
                </div>
              )}
            </div>
            {chamber === 'house' ? (
              <HexMap label="Live House results" fill={fill} tip={tip} mark={mark} hatch={hatch} selected={sel} onSelect={onSelect} />
            ) : style === 'geo' ? (
              <StateMap label="Live results map" fill={fill} tip={tip} mark={mark} hatch={hatch} selected={selMeta?.state ?? null} onSelect={onSelect} />
            ) : (
              <TileMap label="Live results tiles" fill={fill} tip={tip} mark={mark} hatch={hatch} selected={selMeta?.state ?? null} onSelect={onSelect} />
            )}
            <div className="legend" style={{ marginTop: 10 }}>
              <span><i style={{ background: 'var(--dem-2)' }} />Called D ✓</span>
              <span><i style={{ background: 'var(--rep-2)' }} />Called R ✓</span>
              <span><i style={{ background: 'var(--ind)' }} />Called I ✓</span>
              <span><i style={{ background: 'var(--rt-nd)' }} />D leads (striped: counting)</span>
              <span><i style={{ background: 'var(--rt-nr)' }} />R leads (striped)</span>
              <span><i style={{ background: 'var(--rt-t)' }} />Too close</span>
              <span><i style={{ background: 'var(--rt-none)' }} />No results / not up</span>
            </div>
          </div>

          {selMeta && (
            <div className="card">
              <div className="card-head">
                <div>
                  <div className="eyebrow">{selMeta.office === 'house' ? 'House' : selMeta.office === 'senate' ? 'Senate' : 'Governor'}</div>
                  <h3 style={{ fontSize: 20 }}>{selMeta.title}</h3>
                </div>
                <button className="btn sm" onClick={() => navigate(`race/${selMeta.id}`)}>Race page</button>
              </div>
              <div className="grid g3" style={{ gap: 12 }}>
                <div><div className="label">Status</div><b>{results[selMeta.id]?.called ? `Called: ${winnerName(selMeta, results[selMeta.id].called!)}` : results[selMeta.id]?.margin != null ? `${Math.round(results[selMeta.id].reporting * 100)}% in` : 'Waiting'}</b></div>
                <div><div className="label">Count so far</div><b className="num">{results[selMeta.id]?.margin != null ? lead(results[selMeta.id].margin as number) : '—'}</b></div>
                <div><div className="label">Forecast</div><b className="num">{lead(modelById[selMeta.id]?.mean ?? 0)}</b> <span className="faint" style={{ fontSize: 12 }}>{results[selMeta.id]?.margin != null && !results[selMeta.id].called ? `±${partialSd(results[selMeta.id].reporting).toFixed(0)} from what's in` : ''}</span></div>
              </div>
              {source === 'manual' && (
                <div className="stack" style={{ gap: 10, marginTop: 14 }}>
                  <div className="grid g3" style={{ gap: 10 }}>
                    <div className="field"><label htmlFor="mrep">% counted</label><input id="mrep" className="input" type="number" min={0} max={100} value={mRep} onChange={(e) => setMRep(e.target.value)} /></div>
                    <div className="field"><label htmlFor="md">Democratic votes or %</label><input id="md" className="input" type="number" min={0} value={mD} onChange={(e) => setMD(e.target.value)} /></div>
                    <div className="field"><label htmlFor="mr">Republican votes or %</label><input id="mr" className="input" type="number" min={0} value={mR} onChange={(e) => setMR(e.target.value)} /></div>
                  </div>
                  <div className="row">
                    <button className="btn sm primary" onClick={() => applyManual(undefined)}>Update count</button>
                    {!indep[selMeta.id] && <button className="btn sm" style={{ background: 'var(--dem-soft)' }} onClick={() => applyManual('D')}>Call D</button>}
                    {indep[selMeta.id] && <button className="btn sm" style={{ background: 'var(--ind-soft)' }} onClick={() => applyManual('I')}>Call {selMeta.candidates.I?.name ?? 'independent'} (I)</button>}
                    <button className="btn sm" style={{ background: 'var(--rep-soft)' }} onClick={() => applyManual('R')}>Call R</button>
                    <button className="btn sm" onClick={() => applyManual(null)}>Clear</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="card">
            <div className="card-head"><div><h3>Still counting</h3><div className="sub">The closest races with votes in but no call</div></div></div>
            {reportingList.length ? (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>Race</th><th className="r">In</th><th className="r">Count</th><th className="r">Forecast</th><th className="r">vs forecast</th></tr></thead>
                  <tbody>
                    {reportingList.map(({ r, res }) => {
                      const m = modelById[r.id];
                      const d = (res!.margin as number) - (m?.mean ?? 0);
                      return (
                        <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setSel(r.id)}>
                          <td><b>{r.title}</b></td>
                          <td className="r num">{Math.round(res!.reporting * 100)}%</td>
                          <td className="r num"><b className={(res!.margin as number) > 0 ? 'dem' : 'rep'}>{lead(res!.margin as number)}</b></td>
                          <td className="r num faint">{lead(m?.mean ?? 0)}</td>
                          <td className="r num"><span className={d > 0 ? 'dem' : 'rep'}>{d > 0 ? 'D' : 'R'} +{Math.abs(d).toFixed(1)}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">{source === 'practice' ? 'Nothing is counting yet. Press play.' : 'Nothing here yet. Enter a count or load a feed.'}</p>
            )}
          </div>
        </div>

        <div className="stack" style={{ position: 'sticky', top: 74 }}>
          <div className="card">
            <div className="card-head">
              <div>
                <h3>The needle</h3>
                <div className="sub">Democratic odds of control, updated from what's counted and called{needle && needle.ess < 300 ? ` (effective sample ${Math.round(needle.ess)})` : ''}</div>
              </div>
            </div>
            <div className="stack" style={{ gap: 16 }}>
              <ScoreBar label="House" t={tallies.house} pWin={shown?.house.pControl ?? null} deltaFromStart={needle && base ? needle.house.pControl - base.house.pControl : null} hist={histSeries('h')} />
              <ScoreBar label="Senate" t={tallies.senate} pWin={shown?.senate.pControl ?? null} deltaFromStart={needle && base ? needle.senate.pControl - base.senate.pControl : null} hist={histSeries('s')} />
              <ScoreBar label="Governors" t={tallies.governor} pWin={shown?.governor.pControl ?? null} deltaFromStart={needle && base ? needle.governor.pControl - base.governor.pControl : null} hist={histSeries('g')} />
            </div>
          </div>

          <div className="card">
            <h3>Running ahead or behind?</h3>
            {swing ? (
              <>
                <div className="kpi sm" style={{ marginTop: 8 }}><span className={swing.swing > 0 ? 'dem' : 'rep'}>{swing.swing > 0 ? 'D' : 'R'}+{Math.abs(swing.swing).toFixed(1)}</span></div>
                <p className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>Average gap between the count so far and the forecast, across {swing.n} races with at least a quarter counted. Early counts are skewed by what gets reported first, so read it as a hint.</p>
              </>
            ) : (
              <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>Shows once enough races have a quarter of the vote in.</p>
            )}
          </div>

          <div className="card">
            <h3>Calls</h3>
            <div className="calls">
              {calls.slice(0, 40).map((c) => {
                const meta = RACE_BY_ID[c.id];
                if (!meta) return null;
                return (
                  <div key={c.id} className="call-row" onClick={() => setSel(c.id)}>
                    <span className="num faint" style={{ width: 62 }}>{c.at}</span>
                    <i className="dot" style={{ background: c.who === 'D' ? 'var(--dem)' : c.who === 'R' ? 'var(--rep)' : 'var(--ind)' }} />
                    <span><b>{meta.title}</b> {winnerName(meta, c.who)}</span>
                  </div>
                );
              })}
              {!calls.length && <p className="muted" style={{ fontSize: 14 }}>No calls yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
