import { useState } from 'react';
import { CONCEPT_ORDER } from '../data/concepts';
import { HEGEMONY, MAX_ROUNDS, POWERS, type PowerId } from '../data/world';
import type { Progress } from '../storage';

export function Start({ progress, onStart, onCodex }: { progress: Progress; onStart: (p: PowerId) => void; onCodex: () => void }) {
  const [pick, setPick] = useState<PowerId>('usa');
  return (
    <main className="start">
      <header className="start-hero">
        <p className="kicker">A game of great-power politics</p>
        <h1 className="logo">ANARCHY</h1>
        <p className="lede">
          Five great powers. Fifty-seven territories. No world government. Conquer the map, but grow too fast and the world
          will balance against you. Strike a rival's homeland and the Doomsday Clock ticks toward midnight, for everyone.
        </p>
      </header>

      <section className="start-powers" aria-label="Choose your power">
        {POWERS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`power-card ${pick === p.id ? 'on' : ''}`}
            style={{ ['--pc' as string]: p.color }}
            onClick={() => setPick(p.id)}
            aria-pressed={pick === p.id}
          >
            <span className="power-short">{p.short}</span>
            <span className="power-name">{p.name}</span>
            <span className="power-doctrine">{p.doctrine}</span>
            <span className="power-text">{p.doctrineText}</span>
            {progress.wins[p.id] ? <span className="power-wins">{progress.wins[p.id]} win{progress.wins[p.id] > 1 ? 's' : ''}</span> : null}
          </button>
        ))}
      </section>

      <div className="start-actions">
        <button type="button" className="btn btn-primary btn-big" onClick={() => onStart(pick)}>
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
