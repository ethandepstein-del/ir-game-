import { useState } from 'react';
import { CONCEPT_ORDER, CONCEPTS, type ConceptId } from '../data/concepts';

export function Codex({ unlocked, focus, onBack }: { unlocked: ConceptId[]; focus?: ConceptId; onBack: () => void }) {
  const [selected, setSelected] = useState<ConceptId | null>(focus ?? unlocked[0] ?? null);
  const c = selected ? CONCEPTS[selected] : null;
  const open = selected !== null && unlocked.includes(selected);

  return (
    <main className="page codex-page">
      <button type="button" className="link-back" onClick={onBack}>
        ← Back
      </button>
      <header>
        <p className="eyebrow">Field manual</p>
        <h1>The Codex</h1>
        <p className="lede">
          Every idea you run into at the table is filed here. {unlocked.length} of {CONCEPT_ORDER.length} unlocked. Play more
          crises, and try different approaches, to fill it in.
        </p>
      </header>
      <div className="codex-grid">
        <ul className="codex-list">
          {CONCEPT_ORDER.map((id) => {
            const has = unlocked.includes(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  className={`codex-item ${selected === id ? 'sel' : ''} ${has ? '' : 'locked'}`}
                  onClick={() => setSelected(id)}
                  aria-current={selected === id}
                >
                  {has ? CONCEPTS[id].name : 'Classified'}
                </button>
              </li>
            );
          })}
        </ul>
        <article className="panel codex-entry">
          {c && open ? (
            <>
              <h2>{c.name}</h2>
              <p className="codex-short">{c.short}</p>
              <p>{c.body}</p>
              <h3>At the table</h3>
              <p>{c.inGame}</p>
              <h3>Read</h3>
              <p className="fine">{c.reading}</p>
            </>
          ) : (
            <>
              <h2>Classified</h2>
              <p>You have not run into this idea at the table yet. Keep playing, and try strategies you have not used before.</p>
            </>
          )}
        </article>
      </div>
    </main>
  );
}
