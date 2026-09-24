import { memo, useState, type CSSProperties } from 'react';
import { CONCEPT_ORDER } from '../data/concepts';
import { HEGEMONY, MAX_ROUNDS, POWER, POWERS, T, TERRITORIES, type PowerId } from '../data/world';
import type { Progress } from '../storage';
import { sfx } from './audio/sfx';
import { GEO, MAP_H, MAP_W } from './geometry';

const OWNER: Record<number, PowerId> = Object.fromEntries(POWERS.flatMap((p) => p.core.map((c) => [T(c), p.id]))) as Record<number, PowerId>;

/** Slowly drifting world map behind the title. */
const Backdrop = memo(function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid slice">
        {GEO.paths.map((d, i) => (
          <path key={i} d={d} fill={OWNER[i] ? POWER[OWNER[i]].color : '#243447'} opacity={OWNER[i] ? 0.55 : 0.5} />
        ))}
        <path d={GEO.lanes} className="lanes" />
      </svg>
      <div className="backdrop-sweep" />
      <div className="backdrop-fade" />
    </div>
  );
});

/** A cropped inset map of a power's homeland. */
function Homeland({ id }: { id: PowerId }) {
  const pts = POWER[id].core.map((c) => GEO.labels[T(c)]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = 70;
  let x0 = Math.min(...xs) - pad;
  let x1 = Math.max(...xs) + pad;
  let y0 = Math.min(...ys) - pad * 0.7;
  let y1 = Math.max(...ys) + pad * 0.7;
  // Keep a 2:1 frame.
  const w = Math.max(x1 - x0, (y1 - y0) * 2);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  x0 = cx - w / 2;
  x1 = cx + w / 2;
  y0 = cy - w / 4;
  y1 = cy + w / 4;
  const core = new Set(POWER[id].core.map(T));
  return (
    <svg className="homeland" viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} aria-hidden="true">
      {GEO.paths.map((d, i) => (
        <path key={i} d={d} fill={core.has(i) ? POWER[id].color : '#2a3a4e'} opacity={core.has(i) ? 1 : 0.7} />
      ))}
      {TERRITORIES.filter((t) => core.has(t.index)).map((t) => (
        <path key={t.id} d={GEO.outlines[t.index]} fill="none" stroke="#08111b" strokeWidth={1.5} />
      ))}
    </svg>
  );
}

export function Start({ progress, onStart, onCodex }: { progress: Progress; onStart: (p: PowerId) => void; onCodex: () => void }) {
  const [pick, setPick] = useState<PowerId>('usa');
  return (
    <main className="start">
      <Backdrop />
      <header className="start-hero">
        <p className="kicker rise" style={{ '--d': '0ms' } as CSSProperties}>
          A game of great-power politics
        </p>
        <h1 className="logo" aria-label="Anarchy">
          {'ANARCHY'.split('').map((ch, i) => (
            <span key={i} className="stamp-letter" style={{ '--d': `${120 + i * 70}ms` } as CSSProperties} aria-hidden="true">
              {ch}
            </span>
          ))}
          <span className="classified" aria-hidden="true">
            Top secret
          </span>
        </h1>
        <p className="lede rise" style={{ '--d': '700ms' } as CSSProperties}>
          Five great powers. Fifty-seven territories. No world government. Conquer the map, but grow too fast and the world
          will balance against you. Strike a rival's homeland and the Doomsday Clock ticks toward midnight, for everyone.
        </p>
      </header>

      <section className="start-powers" aria-label="Choose your power">
        {POWERS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className={`power-card rise ${pick === p.id ? 'on' : ''}`}
            style={{ ['--pc' as string]: p.color, '--d': `${850 + i * 90}ms` } as CSSProperties}
            onClick={() => {
              setPick(p.id);
              sfx.unlock();
              sfx.deploy(0, true);
            }}
            aria-pressed={pick === p.id}
          >
            <Homeland id={p.id} />
            <span className="power-short">{p.short}</span>
            <span className="power-name">{p.name}</span>
            <span className="power-doctrine">{p.doctrine}</span>
            <span className="power-text">{p.doctrineText}</span>
            {progress.wins[p.id] ? <span className="power-wins">{progress.wins[p.id]} win{progress.wins[p.id] > 1 ? 's' : ''}</span> : null}
          </button>
        ))}
      </section>

      <div className="start-actions rise" style={{ '--d': '1350ms' } as CSSProperties}>
        <button type="button" className="btn btn-primary btn-big" onClick={() => {
            sfx.unlock();
            sfx.conquest();
            onStart(pick);
          }}>
          Take command of {POWERS.find((p) => p.id === pick)!.name}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCodex}>
          Codex · {progress.concepts.length}/{CONCEPT_ORDER.length}
        </button>
      </div>

      <section className="rules-grid">
        <div>
          <h2>Each turn</h2>
          <p>
            <b>Deploy</b> new armies, then <b>attack</b> neighbours by rolling dice as in Risk (you roll up to 3, they roll up to 2,
            ties go to the defender). Finish with one <b>fortify</b> move.
          </p>
        </div>
        <div>
          <h2>How to win</h2>
          <p>
            Hold <b>{HEGEMONY} territories</b> at the end of your turn for hegemony, or have the most prestige after{' '}
            <b>{MAX_ROUNDS} rounds</b> (territories, region bonuses, and 3 per capital held).
          </p>
        </div>
        <div>
          <h2>The balance of power</h2>
          <p>
            Pass a third of world strength and the others form a coalition against you, with +3 armies each per turn. Weak
            states may bandwagon with you instead.
          </p>
        </div>
        <div>
          <h2>The Doomsday Clock</h2>
          <p>
            Attacking a great power's homeland moves the clock a minute toward midnight, and taking a capital moves it
            another. At midnight, everyone loses. Wars in the periphery are safe.
          </p>
        </div>
        <div>
          <h2>Diplomacy</h2>
          <p>
            Propose non-aggression pacts. Rivals decide like realists: they weigh threats, relative power and your
            reputation. Breaking a pact costs you 30 reputation.
          </p>
        </div>
        <div>
          <h2>Crisis cards</h2>
          <p>
            Win a territory to draw a card: Arms Race, Sanctions, Coup, Proxy War, Summit, Carrier Group, Blitzkrieg or
            Détente. Military eras also shift between offense and defense.
          </p>
        </div>
      </section>
    </main>
  );
}
