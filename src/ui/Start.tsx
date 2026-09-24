import { useMemo, useState, type CSSProperties } from 'react';
import { CONCEPT_ORDER } from '../data/concepts';
import { HEGEMONY, MAX_ROUNDS, POWER, POWERS, T, TERRITORIES, type PowerId } from '../data/world';
import type { Progress } from '../storage';
import { sfx } from './audio/sfx';
import { GEO, MAP_H, MAP_W } from './geometry';

const OWNER: Record<number, PowerId> = Object.fromEntries(POWERS.flatMap((p) => p.core.map((c) => [T(c), p.id]))) as Record<number, PowerId>;

/** A cropped inset map of a power's homeland. */
function Homeland({ id }: { id: PowerId }) {
  const pts = POWER[id].core.map((c) => GEO.labels[T(c)]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = 70;
  const w = Math.max(Math.max(...xs) - Math.min(...xs) + pad * 2, (Math.max(...ys) - Math.min(...ys) + pad * 1.4) * 2);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const core = new Set(POWER[id].core.map(T));
  return (
    <svg className="homeland" viewBox={`${cx - w / 2} ${cy - w / 4} ${w} ${w / 2}`} aria-hidden="true">
      {GEO.paths.map((d, i) => (
        <path key={i} d={d} fill={core.has(i) ? POWER[id].color : '#dcd8cc'} />
      ))}
      {TERRITORIES.filter((t) => core.has(t.index)).map((t) => (
        <path key={t.id} d={GEO.outlines[t.index]} fill="none" stroke="#111" strokeWidth={2} />
      ))}
    </svg>
  );
}

const RULES: { title: string; body: React.ReactNode; icon: string }[] = [
  {
    title: 'Deploy · Attack · Fortify',
    icon: 'M4 18l5-5 4 4 7-8M15 9h5v5',
    body: (
      <>
        Place armies, roll Risk dice (up to 3 against 2, ties to the defender), then make one repositioning move. Take a
        territory in a turn to draw a <b>crisis card</b>.
      </>
    ),
  },
  {
    title: 'Hegemony or prestige',
    icon: 'M12 3l2.6 5.5 6 .8-4.4 4.2 1 6L12 16.8 6.8 19.5l1-6L3.4 9.3l6-.8z',
    body: (
      <>
        Hold <b>{HEGEMONY} territories</b> at the end of your turn, or lead in prestige after <b>{MAX_ROUNDS} rounds</b>.
      </>
    ),
  },
  {
    title: 'The balance of power',
    icon: 'M12 4v16M5 8h14M5 8l-3 6h6zM19 8l-3 6h6z',
    body: (
      <>
        Pass a third of world strength and the other powers <b>form a coalition</b> against you. Weak states may
        bandwagon instead.
      </>
    ),
  },
  {
    title: 'The Doomsday Clock',
    icon: 'M12 3a9 9 0 100 18a9 9 0 100-18M12 7v5l-3 2',
    body: (
      <>
        Striking a great power's <b>homeland</b> moves the clock toward midnight, and at midnight everyone loses. Wars in
        the periphery are safe.
      </>
    ),
  },
];

export function Start({ progress, onStart, onCodex }: { progress: Progress; onStart: (p: PowerId) => void; onCodex: () => void }) {
  const [pick, setPick] = useState<PowerId>('usa');
  const poster = useMemo(
    () =>
      GEO.paths.map((d, i) => (
        <path key={i} d={d} fill={OWNER[i] ? POWER[OWNER[i]].color : '#f3f0e6'} className={OWNER[i] ? `own own-${OWNER[i]}` : 'free'} />
      )),
    [],
  );

  return (
    <main className="start" style={{ '--pc': POWER[pick].color } as CSSProperties}>
      <section className="start-hero">
        <div className="start-copy">
          <p className="stamp rise" style={{ '--d': '0ms' } as CSSProperties}>
            A game of great-power politics · 1 player · 20 rounds
          </p>
          <h1 className="logo" aria-label="Anarchy">
            {'ANARCHY'.split('').map((ch, i) => (
              <span key={i} className="stamp-letter" style={{ '--d': `${150 + i * 70}ms` } as CSSProperties} aria-hidden="true">
                {ch}
              </span>
            ))}
          </h1>
          <p className="lede rise" style={{ '--d': '750ms' } as CSSProperties}>
            Five great powers, fifty-seven territories and no world government. Conquer the map, but grow too strong and
            the world balances against you. Strike a rival's homeland and the Doomsday Clock ticks toward midnight for
            everyone.
          </p>
          <div className="start-cta rise" style={{ '--d': '900ms' } as CSSProperties}>
            <button
              type="button"
              className="btn primary huge"
              onClick={() => {
                sfx.unlock();
                sfx.conquest();
                onStart(pick);
              }}
            >
              Take command of {POWER[pick].name}
            </button>
            <button type="button" className="btn ghost" onClick={onCodex}>
              Codex · {progress.concepts.length}/{CONCEPT_ORDER.length}
            </button>
          </div>
        </div>
        <figure className={`poster rise pick-${pick}`} style={{ '--d': '300ms' } as CSSProperties}>
          <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden="true">
            <rect width={MAP_W} height={MAP_H} className="poster-sea" />
            {poster}
            <path d={GEO.coast} className="poster-coast" />
            <path d={GEO.borders} className="poster-borders" />
            <path d={GEO.lanes} className="poster-lanes" />
          </svg>
          <figcaption>
            <span className="poster-short">{POWER[pick].short}</span>
            <span>{POWER[pick].doctrine}</span>
          </figcaption>
        </figure>
      </section>

      <section className="start-powers" aria-label="Choose your power">
        {POWERS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className={`power-card rise ${pick === p.id ? 'on' : ''}`}
            style={{ '--c': p.color, '--d': `${1000 + i * 80}ms` } as CSSProperties}
            onClick={() => {
              setPick(p.id);
              sfx.unlock();
              sfx.deploy(0, true);
            }}
            aria-pressed={pick === p.id}
          >
            <Homeland id={p.id} />
            <span className="pc-head">
              <span className="pc-short">{p.short}</span>
              {progress.wins[p.id] ? <span className="pc-wins">★ {progress.wins[p.id]}</span> : null}
            </span>
            <span className="pc-name">{p.name}</span>
            <span className="pc-doc">{p.doctrine}</span>
            <span className="pc-text">{p.doctrineText}</span>
          </button>
        ))}
      </section>

      <section className="start-rules">
        {RULES.map((r) => (
          <div key={r.title} className="rule">
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path d={r.icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
            </svg>
            <h2>{r.title}</h2>
            <p>{r.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
