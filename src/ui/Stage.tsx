import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CARDS } from '../data/cards';
import { POWER, TERRITORIES, type PowerId } from '../data/world';
import type { CardId } from '../engine/types';
import type { BannerSpec, RollEvent, Stage } from './fx/director';
import type { FxEngine } from './fx/particles';

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const FACE: Record<number, string> = {
  1: 'rotateY(0deg)',
  6: 'rotateY(180deg)',
  3: 'rotateY(90deg)',
  4: 'rotateY(-90deg)',
  2: 'rotateX(90deg)',
  5: 'rotateX(-90deg)',
};
const SHOW: Record<number, [number, number]> = { 1: [0, 0], 6: [0, -180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };

export function Die3D({ value, color, delay = 0, lost = false, seed = 0 }: { value: number; color: string; delay?: number; lost?: boolean; seed?: number }) {
  const [fx, fy] = SHOW[value];
  const r = (n: number) => ((Math.sin(seed * 999 + n) + 1) / 2) * 360;
  const style = {
    '--fx': `${fx}deg`,
    '--fy': `${fy}deg`,
    '--sx': `${fx + 720 + r(1)}deg`,
    '--sy': `${fy - 540 - r(2)}deg`,
    '--sz': `${r(3) - 180}deg`,
    '--dc': color,
    animationDelay: `${delay}ms`,
  } as CSSProperties;
  return (
    <span className={`die3d-wrap ${lost ? 'lost' : ''}`} style={{ animationDelay: `${delay}ms` } as CSSProperties}>
      <span className="die3d" style={style}>
        {[1, 2, 3, 4, 5, 6].map((f) => (
          <span key={f} className="face" style={{ transform: `${FACE[f]} translateZ(var(--half))` }}>
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} className={PIPS[f].includes(i) ? 'pip' : ''} />
            ))}
          </span>
        ))}
      </span>
    </span>
  );
}

function DiceTray({ rolls, id }: { rolls: RollEvent[]; id: number }) {
  const last = rolls[rolls.length - 1];
  const aColor = POWER[last.attacker].color;
  const totalA = rolls.reduce((a, r) => a + r.aLoss, 0);
  const totalD = rolls.reduce((a, r) => a + r.dLoss, 0);
  const pairs = Math.min(last.aDice.length, last.dDice.length);
  return (
    <div className="dice-tray" key={id} role="status">
      <div className="tray-head">
        <span style={{ color: aColor }}>{POWER[last.attacker].short}</span>
        <span className="tray-route">
          {TERRITORIES[last.from].name} → {TERRITORIES[last.to].name}
        </span>
      </div>
      <div className="tray-dice">
        <div className="tray-side">
          {last.aDice.map((d, i) => (
            <Die3D key={i} value={d} color={aColor} delay={i * 60} seed={id * 7 + i} lost={i < pairs && !beats(last, i)} />
          ))}
        </div>
        <span className="tray-vs">vs</span>
        <div className="tray-side">
          {last.dDice.map((d, i) => (
            <Die3D key={i} value={d} color="#d9dee6" delay={i * 60 + 40} seed={id * 13 + i} lost={i < pairs && beats(last, i)} />
          ))}
        </div>
      </div>
      <div className="tray-foot">
        {rolls.length > 1 ? `${rolls.length} rolls · ` : ''}
        attacker <b className="t-bad">−{totalA}</b> · defender <b className="t-bad">−{totalD}</b>
      </div>
    </div>
  );
}

const beats = (r: RollEvent, i: number) => r.wins[i] ?? false;

interface BannerItem extends BannerSpec {
  id: number;
}

export function useStage(fx: FxEngine) {
  const [dice, setDice] = useState<{ rolls: RollEvent[]; id: number } | null>(null);
  const [banner, setBanner] = useState<BannerItem | null>(null);
  const [turn, setTurn] = useState<{ power: PowerId; round: number; mine: boolean; id: number } | null>(null);
  const [shake, setShake] = useState<{ level: number; id: number } | null>(null);
  const [flash, setFlash] = useState(0);
  const [card, setCard] = useState<{ card: CardId; id: number } | null>(null);
  const queue = useRef<BannerItem[]>([]);
  const ids = useRef(0);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const later = (key: string, ms: number, fn: () => void) => {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, ms);
  };

  const nextBanner = useCallback(() => {
    const b = queue.current.shift() ?? null;
    setBanner(b);
    if (b) later('banner', 2300, nextBanner);
  }, []);

  const stage: Stage = useMemo(
    () => ({
      fx,
      dice: (rolls) => {
        setDice({ rolls, id: ++ids.current });
        later('dice', 2200, () => setDice(null));
      },
      banner: (b) => {
        const item = { ...b, id: ++ids.current };
        if (queue.current.length >= 3) queue.current.shift();
        queue.current.push(item);
        setBanner((cur) => {
          if (!cur) {
            queue.current.shift();
            later('banner', 2300, nextBanner);
            return item;
          }
          return cur;
        });
      },
      turn: (power, round, mine) => {
        setTurn({ power, round, mine, id: ++ids.current });
        later('turn', mine ? 1500 : 950, () => setTurn(null));
      },
      shake: (level) => {
        setShake({ level, id: ++ids.current });
        later('shake', 600, () => setShake(null));
      },
      flash: () => setFlash(++ids.current),
      card: (c) => {
        setCard({ card: c, id: ++ids.current });
        later('card', 1500, () => setCard(null));
      },
    }),
    [fx, nextBanner],
  );

  const mapOverlay = (
    <>
      {turn && (
        <div className={`turn-banner ${turn.mine ? 'mine' : ''}`} key={turn.id} style={{ ['--pc' as string]: POWER[turn.power].color }}>
          <span className="tb-stripe" />
          <span className="tb-text">
            <span className="tb-kicker">Round {turn.round}</span>
            <span className="tb-title">{turn.mine ? 'Your move' : POWER[turn.power].name}</span>
          </span>
        </div>
      )}
      {banner && (
        <div className={`event-banner tone-${banner.tone}`} key={banner.id} style={{ ['--bc' as string]: banner.color ?? 'var(--signal)' }}>
          <span className="eb-title">{banner.title}</span>
          {banner.sub && <span className="eb-sub">{banner.sub}</span>}
        </div>
      )}
      {dice && <DiceTray rolls={dice.rolls} id={dice.id} />}
    </>
  );

  const screenOverlay = (
    <>
      {card && (
        <div className="card-flight" key={card.id} aria-hidden="true">
          <div className="cf-card">
            <span className="cf-kicker">Crisis card</span>
            <span className="cf-name">{CARDS[card.card].name}</span>
            <span className="cf-text">{CARDS[card.card].text}</span>
          </div>
        </div>
      )}
      {flash > 0 && <div className="nuke-flash" key={flash} />}
    </>
  );

  return { stage, mapOverlay, screenOverlay, shakeLevel: shake?.level ?? 1, shakeKey: shake?.id ?? 0 };
}
