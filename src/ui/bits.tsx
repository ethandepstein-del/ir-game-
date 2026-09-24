import { CONCEPTS, type ConceptId } from '../data/concepts';

/** Priority shown as 1–4 filled pips. */
export function Pips({ weight, tone = 'brass', label }: { weight: number | null; tone?: 'brass' | 'steel'; label: string }) {
  const filled = weight === null ? 0 : Math.max(1, Math.min(4, Math.round(weight * 10)));
  return (
    <span className={`pips pips-${tone}`} aria-label={weight === null ? `${label}: unknown` : `${label}: ${filled} of 4`}>
      {weight === null ? (
        <span className="pips-unknown">?</span>
      ) : (
        [0, 1, 2, 3].map((i) => <i key={i} className={i < filled ? 'on' : ''} />)
      )}
    </span>
  );
}

/** Round diplomatic seal with the country's initials. */
export function Seal({ name, tone, size = 56 }: { name: string; tone: 'brass' | 'steel'; size?: number }) {
  const initials = name
    .replace(/^The /, '')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const ticks = Array.from({ length: 24 }, (_, i) => i * 15);
  return (
    <svg className={`seal seal-${tone}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" className="seal-ring" />
      <circle cx="32" cy="32" r="24" className="seal-inner" />
      {ticks.map((a) => (
        <line key={a} x1="32" y1="4" x2="32" y2="7.5" className="seal-tick" transform={`rotate(${a} 32 32)`} />
      ))}
      <text x="32" y="38.5" textAnchor="middle" className="seal-text">
        {initials}
      </text>
    </svg>
  );
}

export function ConceptChip({ id, onClick }: { id: ConceptId; onClick?: (id: ConceptId) => void }) {
  const c = CONCEPTS[id];
  if (onClick) {
    return (
      <button type="button" className="chip chip-button" onClick={() => onClick(id)} title={c.short}>
        {c.name}
      </button>
    );
  }
  return (
    <span className="chip" title={c.short}>
      {c.name}
    </span>
  );
}

export function Stars({ n }: { n: number }) {
  return (
    <span className="difficulty" aria-label={`Difficulty ${n} of 3`}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= n ? 'on' : ''} />
      ))}
    </span>
  );
}
