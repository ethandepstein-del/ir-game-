import { useState } from 'react';
import { CONCEPT_ORDER } from '../data/concepts';
import { SCENARIOS } from '../data/scenarios';
import type { Progress } from '../storage';
import { Stars } from './bits';

const KIND_LABEL = { territorial: 'Territorial crisis', trade: 'Trade dispute', arms: 'Arms control' } as const;

export function Title({ progress, onPick, onCodex }: { progress: Progress; onPick: (id: string) => void; onCodex: () => void }) {
  const [howOpen, setHowOpen] = useState(false);
  return (
    <main className="page title-page">
      <header className="title-hero">
        <p className="eyebrow">A game of crisis diplomacy</p>
        <h1 className="logo">
          The <span>Table</span>
        </h1>
        <p className="lede">
          Sit across from a rival leader. Read their intentions, trade what you can spare, bluff when you must, and sign a deal
          your own parliament will accept before the generals take over.
        </p>
      </header>

      <section aria-labelledby="pick" className="stack">
        <h2 id="pick" className="section-label">
          Choose a crisis
        </h2>
        <div className="scenario-grid">
          {SCENARIOS.map((sc) => {
            const best = progress.best[sc.id];
            return (
              <button key={sc.id} type="button" className="scenario-card" onClick={() => onPick(sc.id)}>
                <span className="scenario-kind">{KIND_LABEL[sc.kind]}</span>
                <span className="scenario-title">{sc.title}</span>
                <span className="scenario-tag">{sc.tagline}</span>
                <span className="scenario-meta">
                  <Stars n={sc.difficulty} />
                  <span>{sc.rounds} rounds</span>
                  {best ? <span className="best">Best {best.grade} · {best.score}</span> : <span className="best muted">Unplayed</span>}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="title-actions">
        <button type="button" className="btn btn-ghost" onClick={() => setHowOpen((o) => !o)} aria-expanded={howOpen}>
          {howOpen ? 'Hide rules' : 'How to play'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCodex}>
          Codex · {progress.concepts.length}/{CONCEPT_ORDER.length} concepts
        </button>
      </div>

      {howOpen && (
        <section className="rules panel">
          <h2>How to play</h2>
          <ol>
            <li>
              <b>Each issue has a slider.</b> Left is their ideal, right is yours. You both care about some issues more than
              others, and you cannot see their priorities.
            </li>
            <li>
              <b>Each round you make one move:</b> table a package, signal resolve, reassure, dig for intelligence, or draw a
              red line. They answer, and their standing offer updates.
            </li>
            <li>
              <b>Read their counteroffers.</b> They give ground first on what they care about least. Trade them those issues for
              the ones you care about most.
            </li>
            <li>
              <b>Watch the escalation ladder.</b> Past the danger line, accidents can start a crisis that nobody ordered.
            </li>
            <li>
              <b>Every deal must be ratified at home.</b> Your legislature's line rises when your support falls. A red line you
              cross will sink the deal.
            </li>
            <li>
              <b>Figure out who you are facing.</b> Some leaders back down when you show strength. Others panic and escalate. The
              debrief reveals which one you faced.
            </li>
          </ol>
        </section>
      )}
    </main>
  );
}
