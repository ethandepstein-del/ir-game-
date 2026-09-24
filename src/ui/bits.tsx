import { POWER, type PowerId } from '../data/world';
import type { BattleReport, CardId } from '../engine/types';

export function PowerDot({ p }: { p: PowerId }) {
  return <i className="pdot" style={{ background: POWER[p].color }} aria-hidden="true" />;
}

/** Doomsday Clock face: the minute hand sits `minutes` before twelve and sweeps when it moves. */
export function Clock({ minutes, size = 30 }: { minutes: number; size?: number }) {
  const deg = -(minutes / 60) * 360;
  const a = ((60 - minutes) / 60) * 2 * Math.PI - Math.PI / 2;
  const hot = minutes <= 3;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={`clock ${hot ? 'clock-hot' : ''}`} aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" className="clock-face" />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1="16" y1="2.6" x2="16" y2={i % 3 === 0 ? 5.2 : 4} className="clock-mark" transform={`rotate(${i * 30} 16 16)`} />
      ))}
      <path d={`M16,16 L16,2 A14,14 0 0,0 ${16 + 14 * Math.cos(a)},${16 + 14 * Math.sin(a)} Z`} className="clock-wedge" />
      <line x1="16" y1="16" x2="16" y2="6.5" className="clock-hand clock-hour" />
      <line x1="16" y1="16" x2="16" y2="3.5" className="clock-hand clock-minute" style={{ transform: `rotate(${deg}deg)` }} />
      <circle cx="16" cy="16" r="1.6" className="clock-pin" />
    </svg>
  );
}

export function DiceRow({ battle }: { battle: BattleReport }) {
  return (
    <div className="dice" aria-label={`Attacker rolled ${battle.aDice.join(', ')}; defender rolled ${battle.dDice.join(', ')}`}>
      <span className="dice-set">
        {battle.aDice.map((d, i) => (
          <i key={i} className="die die-a">
            {d}
          </i>
        ))}
      </span>
      <span className="dice-vs">vs</span>
      <span className="dice-set">
        {battle.dDice.map((d, i) => (
          <i key={i} className="die die-d">
            {d}
          </i>
        ))}
      </span>
      <span className="dice-res">
        {battle.conquered ? 'Taken' : `−${battle.aLoss} / −${battle.dLoss}`}
      </span>
    </div>
  );
}

/** Donut showing a power's share of world strength. */
export function ShareRing({ share, color, size = 38 }: { share: number; color: string; size?: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg className="share-ring" width={size} height={size} viewBox="0 0 38 38" aria-label={`${Math.round(share * 100)}% of world strength`}>
      <circle cx="19" cy="19" r={r} className="ring-track" />
      <circle
        cx="19"
        cy="19"
        r={r}
        className="ring-fill"
        stroke={color}
        strokeDasharray={`${c * share} ${c}`}
        transform="rotate(-90 19 19)"
      />
      <text x="19" y="23" textAnchor="middle" className="ring-text">
        {Math.round(share * 100)}
      </text>
    </svg>
  );
}

const GLYPHS: Record<CardId, string> = {
  // Two rising bars with arrows: escalation.
  'arms-race': 'M5 20V12h4v8M11 20V7h4v13M17 20V4 M14 7l3-3 3 3',
  // A padlocked coin: sanctions.
  sanctions: 'M12 4a8 8 0 100 16a8 8 0 100-16M8 12h8M12 8v8',
  // Crown tipping over: coup.
  coup: 'M4 16l2-9 4 4 3-6 3 6 4-4 2 9z M4 19h16',
  // Puppet strings: proxy war.
  'proxy-war': 'M4 4h16M8 4v6M16 4v6M12 4v8M8 10l4 4 4-4M12 14v6M9 20h6',
  // Handshake over table: summit.
  summit: 'M3 13l4-4 3 2 4-3 4 3 3-1M3 17h18M6 17v3M18 17v3',
  // Carrier silhouette.
  carrier: 'M2 15h20l-3 4H6z M7 15v-3h8l2 3M10 12V9h3',
  // Lightning arrow: blitzkrieg.
  blitzkrieg: 'M13 3L5 13h6l-2 8 8-10h-6z',
  // Two linked rings: détente.
  detente: 'M9 8a5 5 0 100 8a5 5 0 100-8M15 8a5 5 0 100 8a5 5 0 100-8',
};

export function CardGlyph({ id }: { id: CardId }) {
  return (
    <svg className="card-glyph" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path d={GLYPHS[id]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
