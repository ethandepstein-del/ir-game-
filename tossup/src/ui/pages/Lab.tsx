import { useEffect, useMemo, useRef, useState } from 'react';
import { leverage } from '../../engine/insights';
import type { SimResult } from '../../engine/sim';
import { navigate } from '../../router';
import { useForecast } from '../../state/forecast';
import { Ring } from '../charts/Basic';
import { PartyBar, useToast } from '../components/bits';
import { RATING_VAR, lead, prob, probFill } from '../format';
import { HexMap, StateMap, TileMap } from '../maps/maps';
import { useRows } from '../useRows';
import { RATING_LABEL } from '../../data/ratings';
import { RACE_BY_ID } from '../../state/data';

type Office = 'senate' | 'governor' | 'house';
type Forced = Record<string, 'D' | 'R'>;

const PRESETS: { label: string; value: (base: number) => number | null; note: string }[] = [
  { label: 'Today', value: () => null, note: "The model's estimate" },
  { label: 'Cook-style D+3', value: () => 3, note: 'A narrower mood, closer to how raters frame it' },
  { label: 'Polling miss (R+3)', value: (b) => b - 3, note: 'Polls overstate Democrats, as they did in 2022' },
  { label: 'Blue tsunami', value: (b) => b + 4, note: 'The late-deciders break hard for Democrats' },
  { label: 'GOP comeback', value: (b) => b - 5, note: 'The economy improves and the map does the rest' },
];

function Delta({ now, base }: { now: number; base: number }) {
  const d = Math.round((now - base) * 100);
  if (Math.abs(d) < 1) return <span className="faint" style={{ fontSize: 12 }}>no change</span>;
  return <span className={d > 0 ? 'dem' : 'rep'} style={{ fontSize: 12.5, fontWeight: 800 }}>{d > 0 ? '▲' : '▼'} {Math.abs(d)} pts</span>;
}

export function Lab() {
  const { result: base, env, run } = useForecast();
  const [office, setOffice] = useState<Office>('senate');
  const [style, setStyle] = useState<'geo' | 'tile'>('geo');
  const [forced, setForced] = useState<Forced>({});
  const [mood, setMood] = useState<number | null>(null);
  const [res, setRes] = useState<SimResult | null>(null);
  const [busy, setBusy] = useState(false);
  const tok = useRef(0);
  const toast = useToast();
  const senate = useRows('senate');
  const gov = useRows('governor');
  const house = useRows('house');
  const rowsByOffice = { senate, governor: gov, house };
  const M = mood ?? env.blend;

  useEffect(() => {
    if (Object.keys(forced).length === 0 && mood === null) {
      setRes(null);
      return;
    }
    const my = ++tok.current;
    setBusy(true);
    const t = setTimeout(() => {
      run({ forced }, { envOverride: mood, nSims: 9000 }).then((r) => {
        if (my === tok.current) {
          setRes(r);
          setBusy(false);
        }
      });
    }, 250);
    return () => clearTimeout(t);
  }, [forced, mood, run]);

  const shown = res ?? base;
  const pdOf = useMemo(() => Object.fromEntries((shown?.races ?? []).map((r) => [r.id, r.pD])), [shown]);
  const keyToId = (key: string) => (office === 'house' ? key : office === 'senate' ? `senate-${key.toLowerCase()}` : `gov-${key.toLowerCase()}`);
  const rows = rowsByOffice[office];
  const byId = Object.fromEntries(rows.map((r) => [r.meta.id, r]));

  const cycle = (id: string) =>
    setForced((f) => {
      const n = { ...f };
      if (!n[id]) n[id] = 'D';
      else if (n[id] === 'D') n[id] = 'R';
      else delete n[id];
      return n;
    });

  const fill = (key: string) => {
    const id = keyToId(key);
    if (!byId[id]) return undefined;
    const f = forced[id];
    if (f) return f === 'D' ? 'var(--dem-2)' : 'var(--rep-2)';
    const p = pdOf[id];
    return p === undefined ? RATING_VAR[byId[id].cons.rating] : probFill(p);
  };
  const mark = (key: string) => (forced[keyToId(key)] ? '✓' : undefined);
  const tip = (key: string) => {
    const id = keyToId(key);
    const r = byId[id];
    if (!r) return <span>Not up in 2026</span>;
    const f = forced[id];
    return (
      <>
        <b>{r.meta.title}</b>
        <div>{f ? `Forced: ${f === 'D' ? 'Democrat' : 'Republican'} wins` : `Democrats ${prob(pdOf[id] ?? r.pD ?? 0.5)}`}</div>
        <div className="tip-sub">{f ? 'Click to cycle' : `${RATING_LABEL[r.cons.rating]} · click to force a winner`}</div>
      </>
    );
  };

  const bulk = (pred: (rt: string) => boolean, to: 'D' | 'R') =>
    setForced((f) => {
      const n = { ...f };
      house.forEach((r) => pred(r.cons.rating) && (n[r.meta.id] = to));
      return n;
    });

  const forcedList = Object.entries(forced);
  const lev = useMemo(() => (shown ? leverage(shown).filter((l) => !forced[l.id] && l.office === office).slice(0, 6) : []), [shown, forced, office]);
  const copySummary = async () => {
    if (!shown) return;
    const text = `Tossup flip lab: national mood ${lead(M)}, ${forcedList.length} race(s) forced (${forcedList.map(([id, w]) => `${RACE_BY_ID[id]?.title ?? id}→${w}`).join(', ') || 'none'}). Democratic control odds: House ${prob(shown.house.pControl)}, Senate ${prob(shown.senate.pControl)}, governors ${prob(shown.governor.pControl)}.`;
    try {
      await navigator.clipboard.writeText(text);
      toast.say('Scenario copied.');
    } catch {
      toast.say(text);
    }
  };

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">What-if machine</div>
          <h1>Flip lab</h1>
          <p className="lede">Click a race to hand it to Democrats, click again to hand it to Republicans, once more to let the model decide. Every other race updates, because races that share voters tend to move together.</p>
        </div>
      </div>

      <div className="grid g-main-side" style={{ alignItems: 'start' }}>
        <div className="stack">
          <div className="card">
            <div className="card-head" style={{ flexWrap: 'wrap' }}>
              <div className="seg" role="tablist" aria-label="Chamber">
                {([['senate', 'Senate'], ['house', 'House'], ['governor', 'Governors']] as const).map(([k, l]) => (
                  <button key={k} aria-pressed={office === k} onClick={() => setOffice(k)}>{l}</button>
                ))}
              </div>
              <div className="row">
                {office !== 'house' && (
                  <div className="seg">
                    <button aria-pressed={style === 'geo'} onClick={() => setStyle('geo')}>Map</button>
                    <button aria-pressed={style === 'tile'} onClick={() => setStyle('tile')}>Tiles</button>
                  </div>
                )}
                <button className="btn sm" onClick={() => { setForced({}); setMood(null); }} disabled={!forcedList.length && mood === null}>Clear everything</button>
              </div>
            </div>
            {office === 'house' ? (
              <HexMap label="House scenario map" fill={fill} tip={tip} mark={mark} onSelect={cycle} />
            ) : style === 'geo' ? (
              <StateMap label="Scenario map" fill={fill} tip={tip} mark={mark} onSelect={(k) => byId[keyToId(k)] && cycle(keyToId(k))} />
            ) : (
              <TileMap label="Scenario tile map" fill={fill} tip={tip} mark={mark} onSelect={(k) => byId[keyToId(k)] && cycle(keyToId(k))} />
            )}
            <div className="legend" style={{ marginTop: 10 }}>
              <span><i style={{ background: 'var(--dem-2)' }} />You: Democrat wins ✓</span>
              <span><i style={{ background: 'var(--rep-2)' }} />You: Republican wins ✓</span>
              <span className="faint">Other colors are the model's chance of a Democratic win</span>
            </div>
            {office === 'house' && (
              <div className="row" style={{ marginTop: 12 }}>
                <span className="label">Bulk</span>
                <button className="btn sm" onClick={() => bulk((r) => r === 'toss', 'D')}>Toss-ups → D</button>
                <button className="btn sm" onClick={() => bulk((r) => r === 'toss', 'R')}>Toss-ups → R</button>
                <button className="btn sm" onClick={() => bulk((r) => r === 'toss' || r === 'lean-r' || r === 'tilt-r', 'D')}>Toss-ups and Lean R → D</button>
                <button className="btn sm" onClick={() => bulk((r) => r === 'toss' || r === 'lean-d' || r === 'tilt-d', 'R')}>Toss-ups and Lean D → R</button>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <h3>National mood</h3>
                <div className="sub">The starting margin in the national House vote, before the races are simulated. Drag it, or try a preset.</div>
              </div>
              <div className="kpi sm">{lead(M)}</div>
            </div>
            <input aria-label="National mood" type="range" min={-6} max={16} step={0.25} value={M} onChange={(e) => setMood(Number(e.target.value))} />
            <div className="row" style={{ marginTop: 8 }}>
              {PRESETS.map((p) => (
                <button key={p.label} className="btn sm" title={p.note} onClick={() => setMood(p.value(env.blend))}>{p.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="stack" style={{ position: 'sticky', top: 74 }}>
          <div className="card">
            <div className="card-head">
              <div>
                <h3>The result</h3>
                <div className="sub">{busy ? 'Simulating…' : forcedList.length || mood !== null ? 'With your changes' : 'The baseline. Click something.'}</div>
              </div>
            </div>
            <div className="stack" style={{ gap: 14 }}>
              {(
                [
                  ['House', shown?.house, base?.house, '218 seats'],
                  ['Senate', shown?.senate, base?.senate, '51 seats'],
                  ['Governors', shown?.governor, base?.governor, '26 governors'],
                ] as const
              ).map(([name, c, b, need]) => (
                <div key={name} className="row" style={{ gap: 14, flexWrap: 'nowrap' }}>
                  {c ? (
                    <Ring pD={c.pControl} size={82} stroke={10} label={`${name}: Democrats ${Math.round(c.pControl * 100)} percent`}>
                      <b className="num" style={{ fontSize: 18 }}>{prob(c.pControl)}</b>
                    </Ring>
                  ) : <div className="skeleton" style={{ width: 82, height: 82, borderRadius: '50%' }} />}
                  <div style={{ flex: 1 }}>
                    <div className="spread"><b>{name}</b>{c && b && <Delta now={c.pControl} base={b.pControl} />}</div>
                    <div className="faint" style={{ fontSize: 13 }}>{c ? `${c.median} D · ${c.p10}–${c.p90} · ${need} to win` : ''}</div>
                    {c && <div style={{ marginTop: 6 }}><PartyBar d={c.pControl} r={1 - c.pControl} /></div>}
                  </div>
                </div>
              ))}
            </div>
            {res && res.ess < 400 && <div className="callout" style={{ marginTop: 12, fontSize: 13 }}>That's a very unlikely scenario, so few simulations support it (effective sample {Math.round(res.ess)}). Treat the exact numbers loosely.</div>}
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn sm" onClick={copySummary}>Copy summary</button>
            </div>
          </div>

          {forcedList.length > 0 && (
            <div className="card">
              <h3>Your calls ({forcedList.length})</h3>
              <div className="row" style={{ marginTop: 10, gap: 6 }}>
                {forcedList.slice(0, 40).map(([id, w]) => (
                  <button key={id} className={`chip ${w === 'D' ? 'dem' : 'rep'}`} style={{ border: 0, cursor: 'pointer' }} title="Click to remove" onClick={() => setForced((f) => { const n = { ...f }; delete n[id]; return n; })}>
                    {RACE_BY_ID[id]?.title.replace(' Senate', '').replace(' Governor', ' Gov') ?? id} → {w} ×
                  </button>
                ))}
                {forcedList.length > 40 && <span className="faint">+{forcedList.length - 40} more</span>}
              </div>
            </div>
          )}

          {lev.length > 0 && (
            <div className="card">
              <h3>Next most important {office === 'house' ? 'districts' : 'races'}</h3>
              <div className="sub muted" style={{ fontSize: 13, marginBottom: 8 }}>Given what you've set, these still swing the chamber the most.</div>
              {lev.map((l) => (
                <div key={l.id} className="spread" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <a href={`#/race/${l.id}`} onClick={(e) => { e.preventDefault(); navigate(`race/${l.id}`); }} style={{ fontWeight: 700, textDecoration: 'none' }}>{RACE_BY_ID[l.id].title}</a>
                  <span className="num" style={{ fontSize: 13 }}><span className="dem">{prob(l.pCtrlIfD)}</span> / <span className="rep">{prob(l.pCtrlIfR)}</span></span>
                </div>
              ))}
              <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>Democratic control odds if D wins / if R wins.</div>
            </div>
          )}
        </div>
      </div>
      {toast.node}
    </div>
  );
}
