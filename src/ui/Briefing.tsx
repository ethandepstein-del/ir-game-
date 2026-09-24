import { getScenario } from '../data/scenarios';
import { Pips, Seal } from './bits';

export function Briefing({ scenarioId, onStart, onBack }: { scenarioId: string; onStart: () => void; onBack: () => void }) {
  const sc = getScenario(scenarioId);
  return (
    <main className="page briefing-page">
      <button type="button" className="link-back" onClick={onBack}>
        ← All crises
      </button>
      <article className="dossier">
        <header className="dossier-head">
          <p className="stamp">Eyes only · Briefing</p>
          <h1>{sc.title}</h1>
          <p className="dossier-role">You are the {sc.you.role}.</p>
        </header>
        <div className="dossier-body">
          <section className="prose">
            {sc.briefing.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
          <aside className="dossier-side">
            <section>
              <h2>Your instructions</h2>
              <ul className="priority-list">
                {sc.issues.map((iss, i) => (
                  <li key={iss.id}>
                    <span>{iss.name}</span>
                    <Pips weight={sc.playerWeights[i]} label="Your priority" />
                  </li>
                ))}
              </ul>
              <p className="fine">More pips means the issue matters more to your score.</p>
            </section>
            <section className="leader-file">
              <div className="leader-file-head">
                <Seal name={sc.them.country} tone="steel" size={48} />
                <div>
                  <h2>{sc.them.leader}</h2>
                  <p className="fine">{sc.them.title}</p>
                </div>
              </div>
              <p>{sc.them.dossier}</p>
            </section>
            {sc.trustFloor > 0 && (
              <p className="warning-note">
                {sc.them.country} will not sign anything until trust reaches {sc.trustFloor}. It starts at {sc.start.trust}.
              </p>
            )}
          </aside>
        </div>
        <footer className="dossier-foot">
          <button type="button" className="btn btn-primary" onClick={onStart}>
            Take your seat
          </button>
        </footer>
      </article>
    </main>
  );
}
