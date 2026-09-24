import { POWER, type PowerId } from '../data/world';
import type { BattleReport } from '../engine/types';

export function PowerDot({ p }: { p: PowerId }) {
  return <i className="pdot" style={{ background: POWER[p].color }} aria-hidden="true" />;
}

/** Doomsday Clock face: the minute hand sits `minutes` before twelve. */
export function Clock({ minutes, size = 30 }: { minutes: number; size?: number }) {
  const a = ((60 - minutes) / 60) * 2 * Math.PI - Math.PI / 2;
  const hot = minutes <= 3;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={`clock ${hot ? 'clock-hot' : ''}`} aria-hidden="true">
      <circle cx="16" cy="16" r="14" className="clock-face" />
      <path d={`M16,16 L16,2 A14,14 0 0,0 ${16 + 14 * Math.cos(a)},${16 + 14 * Math.sin(a)} Z`} className="clock-wedge" />
      <line x1="16" y1="16" x2="16" y2="5" className="clock-hand" />
      <line x1="16" y1="16" x2={16 + 11 * Math.cos(a)} y2={16 + 11 * Math.sin(a)} className="clock-hand" />
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
