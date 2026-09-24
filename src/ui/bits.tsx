import { POWER, type PowerId } from '../data/world';
import type { BattleReport, CardId } from '../engine/types';
import type { AssetKind } from '../data/geo';

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

/** Printed bar showing a power's share of world strength. */
export function ShareRing({ share, color }: { share: number; color: string; size?: number }) {
  return (
    <span className="share" aria-label={`${Math.round(share * 100)}% of world strength`}>
      <span className="share-track">
        <i style={{ width: `${Math.min(100, share * 100 * 2)}%`, background: color }} />
        <b className="share-third" />
      </span>
      <span className="share-num">{Math.round(share * 100)}%</span>
    </span>
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
  // Terminal with a lightning prompt: cyber attack.
  cyber: 'M3 5h18v11H3z M9 20h6 M12 16v4 M7 9l2 2-2 2 M11 13h4',
  // Quadcopter: drone strike.
  drone: 'M10 11h4v3h-4z M6 7a2 2 0 104 0a2 2 0 10-4 0 M14 7a2 2 0 104 0a2 2 0 10-4 0 M6 18a2 2 0 104 0a2 2 0 10-4 0 M14 18a2 2 0 104 0a2 2 0 10-4 0 M9.5 8.5l1 2.5 M14.5 8.5l-1 2.5 M9.5 16.5l1-2.5 M14.5 16.5l-1-2.5',
  // Oil drop, struck through: energy cutoff.
  'energy-cutoff': 'M12 3c3 4 5 7 5 10a5 5 0 01-10 0c0-3 2-6 5-10z M4 4l16 16',
  // Speech bubble full of noise: information operations.
  'info-ops': 'M4 5h16v10H10l-5 4v-4H4z M8 9h8 M8 12h5',
};

export function CardGlyph({ id }: { id: CardId }) {
  return (
    <svg className="card-glyph" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path d={GLYPHS[id]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Tiny ink icons for strategic assets, drawn in a 12×12 box centred on 0,0. */
export const ASSET_ICON: Record<AssetKind, string> = {
  // Anchor: a chokepoint.
  strait: 'M0,-4.2 V4.2 M-3.8,1.2 Q0,6.5 3.8,1.2 M-2.4,-2.2 H2.4 M0,-5.8 a1.3,1.3 0 1 0 0.01,0',
  // Drop: oil and gas.
  oil: 'M0,-5 C2.8,-1.2 4,0.8 4,2.2 A4,4 0 0 1 -4,2.2 C-4,0.8 -2.8,-1.2 0,-5 Z',
  // Chip: a die with pins.
  chips: 'M-3,-3 H3 V3 H-3 Z M-1.5,-4.6 V-3 M1.5,-4.6 V-3 M-1.5,3 V4.6 M1.5,3 V4.6 M-4.6,-1.5 H-3 M-4.6,1.5 H-3 M3,-1.5 H4.6 M3,1.5 H4.6',
  // Gem: critical minerals.
  minerals: 'M-4.5,-1 L-2.2,-4.2 H2.2 L4.5,-1 L0,4.8 Z M-4.5,-1 H4.5 M-1.2,-4.2 L-1.8,-1 L0,4.8 L1.8,-1 L1.2,-4.2',
  // Wheat: a breadbasket.
  grain: 'M0,5 V-5 M0,-3 L-2.6,-5 M0,-3 L2.6,-5 M0,0 L-2.6,-2 M0,0 L2.6,-2 M0,3 L-2.6,1 M0,3 L2.6,1',
};

export function AssetIcon({ kind, size = 16 }: { kind: AssetKind; size?: number }) {
  return (
    <svg className={`asset-icon a-${kind}`} viewBox="-6.5 -6.5 13 13" width={size} height={size} aria-hidden="true">
      <path d={ASSET_ICON[kind]} />
    </svg>
  );
}
