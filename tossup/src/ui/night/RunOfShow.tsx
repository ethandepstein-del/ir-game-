import { useEffect, useMemo, useState } from 'react';
import { STATES } from '../../data/states';
import { SENATE_RACES, GOVERNOR_RACES } from '../../data/races';
import { Link } from '../../router';
import { useForecast } from '../../state/forecast';
import { fmtClose } from '../pages/RacePage';
import { prob } from '../format';
import { useWatchRows } from './common';

const FIRST_CLOSE = Date.UTC(2026, 10, 3, 23, 0); // 6:00 pm EST

function useCountdown() {
  const [now, setNow] = useState(() => Math.max(Date.now(), Date.parse('2026-09-29T12:00:00Z')));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.max(Date.now(), Date.parse('2026-09-29T12:00:00Z'))), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = FIRST_CLOSE - now;
  if (ms <= 0) return null;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return { d, h, m, s };
}

const senateStates = new Set(SENATE_RACES.map((r) => r.state));
const govStates = new Set(GOVERNOR_RACES.map((r) => r.state));

export function RunOfShow({ onPractice }: { onPractice: () => void }) {
  const cd = useCountdown();
  const rows = useWatchRows();
  const { result } = useForecast();
  const buckets = useMemo(() => {
    const m = new Map<number, typeof STATES>();
    for (const s of STATES) {
      const k = s.close;
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    const keys = [...m.keys()].sort((a, b) => a - b);
    let seatsSoFar = 0;
    let senSoFar = 0;
    return keys.map((k) => {
      const sts = m.get(k)!;
      seatsSoFar += sts.reduce((a, s) => a + s.house, 0);
      senSoFar += sts.filter((s) => senateStates.has(s.code)).length;
      const codes = new Set(sts.map((s) => s.code));
      const key = rows.filter((r) => codes.has(r.meta.state) && r.meta.office !== 'governor').slice(0, 3);
      return { k, sts, seatsSoFar, senSoFar, key };
    });
  }, [rows]);

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="grid g-main-side">
        <div className="card hero-night">
          <div className="label">First polls close in</div>
          {cd ? (
            <div className="countdown-big" aria-live="off">
              {[['d', 'days'], ['h', 'hours'], ['m', 'min'], ['s', 'sec']].map(([k, l]) => (
                <div key={k}><b className="num">{String(cd[k as 'd']).padStart(2, '0')}</b><span>{l}</span></div>
              ))}
            </div>
          ) : (
            <div className="kpi">It's election night.</div>
          )}
          <p className="muted" style={{ marginTop: 10, maxWidth: '52ch' }}>
            Polls in parts of Indiana and Kentucky close at 6 pm Eastern on Tuesday, November 3. The bulk of the decisive races close between 7 and 10 pm. Below is the whole night, hour by hour.
          </p>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn gold" onClick={onPractice}>Try the practice night</button>
            <span className="faint" style={{ fontSize: 13 }}>A full simulated evening on the live map, with a win-probability needle.</span>
          </div>
        </div>
        <div className="card tint">
          <h3>The short version</h3>
          <ul className="plain">
            <li><b>7 pm:</b> Georgia, Virginia and most of Florida. Suburban swings show up here first.</li>
            <li><b>7:30 pm:</b> North Carolina and Ohio. Big Senate races, fast counts.</li>
            <li><b>8 pm:</b> Pennsylvania, Michigan, Texas and the Northeast. Lots of House seats.</li>
            <li><b>9 pm:</b> Arizona, Wisconsin, Minnesota, Colorado, New York. Some counts are slow.</li>
            <li><b>10 pm and later:</b> Iowa, Nevada, Utah, Montana, then the West Coast, Alaska and Hawaii.</li>
          </ul>
          <p className="faint" style={{ fontSize: 12.5, marginTop: 8 }}>Close times shown are Eastern. States with more than one time zone close in stages; the details are in each state's row.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>Run of show</h3>
            <div className="sub">When each state's polls close (Eastern), what's on the ballot, and the races that matter most in that hour</div>
          </div>
        </div>
        <div className="timeline">
          {buckets.map((b) => (
            <div key={b.k} className="tl-row">
              <div className="tl-time">
                <b className="num">{fmtClose(b.k)}</b>
                <span className="faint">ET</span>
                <div className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>{Math.round((b.seatsSoFar / 435) * 100)}% of House seats and {b.senSoFar} of 35 Senate races have closed by now</div>
              </div>
              <div className="tl-body">
                <div className="row" style={{ gap: 6 }}>
                  {b.sts.map((s) => (
                    <Link key={s.code} to={`state/${s.code.toLowerCase()}`} className="st-chip" title={`${s.name}${s.closeNote ? ' · ' + s.closeNote : ''}${s.paceNote ? ' · ' + s.paceNote : ''}`}>
                      <b>{s.code}</b>
                      {senateStates.has(s.code) && <i className="tag s">S</i>}
                      {govStates.has(s.code) && <i className="tag g">G</i>}
                      <span className={`pace ${s.pace}`} aria-label={`${s.pace} counting`} />
                    </Link>
                  ))}
                </div>
                {b.key.length > 0 && (
                  <div className="tl-key">
                    <span className="label">Watch</span>
                    {b.key.map((r) => (
                      <Link key={r.meta.id} to={`race/${r.meta.id}`} className="chip">{r.meta.title} · D {prob(r.pD)}</Link>
                    ))}
                  </div>
                )}
                {b.sts.some((s) => s.closeNote || (s.pace === 'slow' && s.paceNote)) && (
                  <div className="faint" style={{ fontSize: 12.5, marginTop: 6 }}>
                    {b.sts.filter((s) => s.closeNote).map((s) => `${s.code}: ${s.closeNote}`).join(' ')} {b.sts.filter((s) => s.pace === 'slow' && s.paceNote).map((s) => `${s.code} counts slowly: ${s.paceNote}`).join(' ')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="legend" style={{ marginTop: 14 }}>
          <span><i className="tag s" style={{ width: 'auto', height: 'auto', padding: '0 5px' }}>S</i>Senate race</span>
          <span><i className="tag g" style={{ width: 'auto', height: 'auto', padding: '0 5px' }}>G</i>Governor</span>
          <span><span className="pace fast" />fast counter</span>
          <span><span className="pace medium" />medium</span>
          <span><span className="pace slow" />slow</span>
        </div>
        <p className="faint" style={{ fontSize: 12.5, marginTop: 8 }}>Counting pace reflects 2020 to 2024 patterns. Election rules can change from year to year, so treat it as a tendency, not a promise. {result ? '' : ''}</p>
      </div>

      <div className="card">
        <h3>Reading the night</h3>
        <div className="grid g3" style={{ marginTop: 12, gap: 16 }}>
          <div><b>Early vote versus Election Day.</b><p className="muted" style={{ fontSize: 14, marginTop: 4 }}>Which kind of ballot a state reports first shapes the early margin. In some states early votes lean Democratic and Election Day votes lean Republican, in others the reverse. Compare each race with how its state usually behaves, not with a national gut feeling.</p></div>
          <div><b>The blue shift and the red mirage.</b><p className="muted" style={{ fontSize: 14, marginTop: 4 }}>In places that count mail ballots late, such as California, Washington, Oregon, Nevada and Arizona, early leads can shrink or grow as the count finishes. "Called" beats "leading."</p></div>
          <div><b>Benchmark, don't eyeball.</b><p className="muted" style={{ fontSize: 14, marginTop: 4 }}>The What to watch tab gives an expected margin for each race and what it means for the country if a party beats it. One race is noisy; ten early races beating the forecast in the same direction is a signal.</p></div>
        </div>
      </div>
    </div>
  );
}
