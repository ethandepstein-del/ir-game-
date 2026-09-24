import { useState } from 'react';
import { CONCEPT_ORDER, CONCEPTS, type ConceptId } from '../data/concepts';

export function Codex({ unlocked, focus, onBack }: { unlocked: ConceptId[]; focus?: ConceptId; onBack: () => void }) {
  const [sel, setSel] = useState<ConceptId | null>(focus ?? unlocked[0] ?? null);
  const c = sel && unlocked.includes(sel) ? CONCEPTS[sel] : null;
  return (
    <div className="overlay codex-overlay" role="dialog" aria-modal="true" aria-labelledby="codex-h">
      <div className="codex">
        <header className="codex-head">
          <div>
            <p className="kicker">Field manual</p>
            <h2 id="codex-h">The Codex</h2>
            <p className="hint">
              {unlocked.length} of {CONCEPT_ORDER.length} theories encountered. They unlock as they happen in play.
            </p>
          </div>
          <button type="button" className="btn" onClick={onBack}>
            Close
          </button>
        </header>
        <div className="codex-body">
          <ul className="codex-list">
            {CONCEPT_ORDER.map((id) => {
              const has = unlocked.includes(id);
              return (
                <li key={id}>
                  <button type="button" className={`codex-item ${sel === id ? 'on' : ''} ${has ? '' : 'locked'}`} onClick={() => setSel(id)}>
                    {has ? CONCEPTS[id].name : 'Classified'}
                  </button>
                </li>
              );
            })}
          </ul>
          <article className="codex-entry">
            {c ? (
              <>
                <h3>{c.name}</h3>
                <p className="codex-dispatch">{c.dispatch}</p>
                <p>{c.body}</p>
                <p className="hint">Read: {c.reading}</p>
              </>
            ) : (
              <>
                <h3>Classified</h3>
                <p>You haven't seen this one happen yet. Play more games and try different strategies to unlock it.</p>
              </>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
