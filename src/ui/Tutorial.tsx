import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { HEGEMONY, MAX_ROUNDS, POWER, T } from '../data/world';
import { current, isOver } from '../engine/game';
import type { GameState } from '../engine/types';

/** What the tutorial can see of the table besides the game state. */
export interface TutorialView {
  game: GameState;
  sel: number | null;
  tgt: number | null;
  attacks: number;
  phone: boolean;
}

interface Step {
  id: string;
  /** Selectors tried in order; the first one on screen gets circled. None: the note sits mid-table. */
  target?: (v: TutorialView) => string[];
  title: string;
  body: (v: TutorialView) => ReactNode;
  /** When set, the step advances by itself once this is true; otherwise the note has a Next button. */
  until?: (v: TutorialView, start: TutorialView) => boolean;
  /** Skip the step entirely when this is already true on arrival. */
  skip?: (v: TutorialView) => boolean;
}

const mine = (v: TutorialView) => current(v.game) === v.game.player && !isOver(v.game);

const STEPS: Step[] = [
  {
    id: 'welcome',
    title: 'Welcome to Anarchy',
    body: (v) => (
      <>
        No world government, no referee. Five great powers compete for the map and nobody enforces the rules. You play{' '}
        <b>{POWER[v.game.player].name}</b>.
        <br />
        Win by holding <b>{HEGEMONY} territories</b> (hegemony), or by leading in prestige after <b>{MAX_ROUNDS} rounds</b>.
      </>
    ),
  },
  {
    id: 'you',
    target: (v) => [`.token[data-t="${T(POWER[v.game.player].capital)}"]`],
    title: 'This is you',
    body: (v) => (
      <>
        Your hexes are {colorName(v)}. Each disc counts the armies in a territory, and the star marks your capital. White land
        belongs to minor states: weak, and a good place to start.
      </>
    ),
  },
  {
    id: 'rivals',
    target: (v) => (v.phone ? ['.chip-btn'] : ['.g-roster']),
    title: 'Your rivals',
    body: () => (
      <>
        The bar is each power&rsquo;s share of world strength. Pass the tick mark and the others <b>balance</b> against you.
        Every rival secretly follows an IR doctrine. Watch how they behave and write your guess on their card.
      </>
    ),
  },
  {
    id: 'clock',
    target: () => ['.doom'],
    title: 'The Doomsday Clock',
    body: () => (
      <>
        Attacking a great power&rsquo;s <b>homeland</b> moves the clock toward midnight. At zero it&rsquo;s nuclear war and{' '}
        <b>everyone loses</b>. Wars on the periphery are safe.
      </>
    ),
  },
  {
    id: 'wait',
    target: (v) => (v.phone ? ['.speed-cycle'] : ['.g-top-right .seg']),
    title: 'Rivals move first',
    body: () => <>Watch the map while the others take their turns. Too slow? Speed them up here.</>,
    until: (v) => mine(v),
    skip: (v) => mine(v),
  },
  {
    id: 'deploy',
    target: (v) => [`.token[data-t="${T(POWER[v.game.player].capital)}"]`, '.g-dock'],
    title: '1 · Deploy',
    body: (v) => (
      <>
        It&rsquo;s your turn. You have <b>{v.game.reinforcements || 'new'} armies</b>. Tap your own territories to place them.
        Stack them where you plan to attack.
      </>
    ),
    until: (v) => !mine(v) || v.game.phase !== 'deploy',
  },
  {
    id: 'aim',
    target: () => ['.g-dock'],
    title: '2 · Attack',
    body: () => (
      <>
        Tap one of your territories with <b>2+ armies</b>, then a highlighted neighbour. The pencil arrow shows your odds.
        Aim for a white minor state first.
      </>
    ),
    until: (v) => !mine(v) || v.game.phase !== 'attack' || v.tgt !== null,
  },
  {
    id: 'roll',
    target: (v) => (v.phone ? ['.g-dock'] : ['.g-dossier', '.g-dock']),
    title: 'Read the card, then roll',
    body: () => (
      <>
        The card lists the odds and the <b>consequences</b>: broken pacts, the clock, public opinion at home. When
        you&rsquo;re happy, press <b>Attack all-out</b>.
      </>
    ),
    until: (v, s) => !mine(v) || v.game.phase !== 'attack' || v.attacks > s.attacks,
  },
  {
    id: 'dice',
    target: () => ['.g-dock'],
    title: 'How the dice work',
    body: () => (
      <>
        You roll up to 3 dice, the defender up to 2. The highest dice are compared in pairs, and <b>ties go to the defender</b>.
        Take a territory this turn and you draw a crisis card. Attack again, or press <b>End attacks</b>.
      </>
    ),
    until: (v) => !mine(v) || v.game.phase === 'fortify',
  },
  {
    id: 'fortify',
    target: () => ['.g-dock'],
    title: '3 · Fortify',
    body: () => (
      <>
        You get one move through your own territory: shift armies from a safe interior to an exposed border. Or just press{' '}
        <b>End turn</b>.
      </>
    ),
    until: (v) => !mine(v),
    skip: (v) => !mine(v),
  },
  {
    id: 'diplomacy',
    target: (v) => (v.phone ? ['.chip-btn'] : ['.plaque-actions', '.g-roster']),
    title: 'Diplomacy',
    body: () => (
      <>
        On your turn, offer rivals a <b>Pact</b> (5 rounds of peace) or an <b>Alliance</b> (each side must defend the other).
        Break your word and you lose <b>reputation</b> abroad and <b>legitimacy</b> at home.
      </>
    ),
  },
  {
    id: 'theory',
    target: (v) => (v.phone ? [] : ['.codex-btn']),
    title: 'The theory behind it',
    body: () => (
      <>
        Every rule is an IR idea: the security dilemma, balancing, audience costs. A note appears when one is at work, and you
        collect them in the <b>Codex</b>. That&rsquo;s everything. Good luck.
      </>
    ),
  },
];

function colorName(v: TutorialView) {
  return { usa: 'blue', eu: 'gold', rus: 'red', chn: 'purple', ind: 'green' }[v.game.player];
}

/** Does the current step want the AI paused so the player can read? */
export function tutorialHolds(index: number): boolean {
  const s = STEPS[index];
  return !!s && !s.until;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function findTarget(sels: string[]): Rect | null {
  for (const sel of sels) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }
  return null;
}

const NOTE_W = 300;

/** Where the note sits relative to the circled target. */
function placeNote(r: Rect | null, noteH: number, phone: boolean): { left: number; top: number } {
  const W = innerWidth;
  const H = innerHeight;
  const w = Math.min(NOTE_W, W - 32);
  if (!r) return { left: (W - w) / 2, top: Math.max(70, H * 0.3 - noteH / 2) };
  const gap = 34;
  const clampX = (x: number) => Math.min(W - w - 16, Math.max(16, x));
  const clampY = (y: number) => Math.min(H - noteH - 16, Math.max(64, y));
  if (phone) {
    // Above or below, whichever has room.
    const below = r.y + r.h + gap;
    if (below + noteH < H - 10) return { left: clampX(r.x + r.w / 2 - w / 2), top: below };
    return { left: clampX(r.x + r.w / 2 - w / 2), top: clampY(r.y - gap - noteH) };
  }
  const room = { right: W - (r.x + r.w), left: r.x, below: H - (r.y + r.h), above: r.y };
  // Things along the bottom edge (the dock, the hand) read best with the note above them, over open sea.
  if (r.y > H * 0.55 && room.above > noteH + gap + 64) return { left: clampX(r.x + r.w / 2 - w / 2), top: r.y - gap - noteH };
  if (room.right > w + gap + 16) return { left: r.x + r.w + gap, top: clampY(r.y + r.h / 2 - noteH / 2) };
  if (room.left > w + gap + 16) return { left: r.x - gap - w, top: clampY(r.y + r.h / 2 - noteH / 2) };
  if (room.above > noteH + gap + 64) return { left: clampX(r.x + r.w / 2 - w / 2), top: r.y - gap - noteH };
  return { left: clampX(r.x + r.w / 2 - w / 2), top: clampY(r.y + r.h + gap) };
}

export function Tutorial({ view, index, setIndex, onClose }: { view: TutorialView; index: number; setIndex: (n: number) => void; onClose: () => void }) {
  const step = STEPS[index];
  const startView = useRef(view);
  const note = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [noteH, setNoteH] = useState(180);

  // Snapshot the table on arrival, and skip steps that are already done.
  useEffect(() => {
    startView.current = view;
    if (step?.skip?.(view)) setIndex(index + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    if (step?.until && step.until(view, startView.current)) setIndex(index + 1);
  }, [view, step, index, setIndex]);

  useEffect(() => {
    if (!step) onClose();
  }, [step, onClose]);

  // Follow the target as the map pans and panels move.
  const sels = step?.target?.(view) ?? [];
  const key = sels.join('|');
  useEffect(() => {
    let raf = 0;
    let last = '';
    const tick = () => {
      const r = findTarget(key ? key.split('|') : []);
      const sig = r ? `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}` : '';
      if (sig !== last) {
        last = sig;
        setRect(r);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [key]);

  useLayoutEffect(() => {
    if (note.current) setNoteH(note.current.offsetHeight);
  }, [index, rect === null]);

  if (!step) return null;
  const pos = placeNote(rect, noteH, view.phone);
  const w = Math.min(NOTE_W, innerWidth - 32);
  const tilt = ((index * 37) % 5) - 2;

  // A pencil loop around the target and a hand-drawn arrow from the note to it.
  let loop: ReactNode = null;
  let arrow: ReactNode = null;
  if (rect) {
    const pad = 10;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const rx = Math.min(rect.w / 2 + pad, innerWidth / 2);
    const ry = rect.h / 2 + pad;
    const loopD = `M${cx - rx * 0.2},${cy - ry * 1.02} C${cx + rx * 0.7},${cy - ry * 1.08} ${cx + rx * 1.04},${cy - ry * 0.5} ${cx + rx},${cy + ry * 0.05} C${cx + rx * 0.98},${cy + ry * 0.75} ${cx + rx * 0.4},${cy + ry * 1.04} ${cx - rx * 0.1},${cy + ry} C${cx - rx * 0.75},${cy + ry * 0.98} ${cx - rx * 1.03},${cy + ry * 0.5} ${cx - rx},${cy} C${cx - rx * 0.98},${cy - ry * 0.62} ${cx - rx * 0.62},${cy - ry * 0.98} ${cx + rx * 0.12},${cy - ry * 1.1}`;
    loop = <path d={loopD} className="tut-loop" pathLength={1} />;
    // Arrow from the nearest note edge to the loop.
    const nx = Math.min(Math.max(cx, pos.left + 10), pos.left + w - 10);
    const ny = Math.min(Math.max(cy, pos.top + 10), pos.top + noteH - 10);
    const dx = cx - nx;
    const dy = cy - ny;
    const len = Math.hypot(dx, dy);
    if (len > 40) {
      const ux = dx / len;
      const uy = dy / len;
      const ex = cx - ux * (Math.abs(ux) * rx + Math.abs(uy) * ry + 4);
      const ey = cy - uy * (Math.abs(ux) * rx + Math.abs(uy) * ry + 4);
      const sx = nx + ux * 8;
      const sy = ny + uy * 8;
      const mx = (sx + ex) / 2 - uy * len * 0.18;
      const my = (sy + ey) / 2 + ux * len * 0.18;
      const ang = Math.atan2(ey - my, ex - mx);
      const head = 12;
      const h1 = `${ex - head * Math.cos(ang - 0.45)},${ey - head * Math.sin(ang - 0.45)}`;
      const h2 = `${ex - head * Math.cos(ang + 0.45)},${ey - head * Math.sin(ang + 0.45)}`;
      if (Math.hypot(ex - sx, ey - sy) > 24)
        arrow = (
          <>
            <path d={`M${sx},${sy} Q${mx},${my} ${ex},${ey}`} className="tut-arrow" pathLength={1} />
            <path d={`M${h1} L${ex},${ey} L${h2}`} className="tut-arrow tut-head" pathLength={1} />
          </>
        );
    }
  }

  return (
    <div className="tut" aria-live="polite">
      <svg className="tut-ink" aria-hidden="true" key={`ink-${index}`}>
        <g filter="url(#boil)">
          {loop}
          {arrow}
        </g>
      </svg>
      <div
        ref={note}
        key={`note-${index}`}
        className="tut-note"
        role="dialog"
        aria-label={`Tutorial: ${step.title}`}
        style={{ left: pos.left, top: pos.top, width: w, rotate: `${tilt * 0.6}deg` }}
      >
        <span className="tut-tape" aria-hidden="true" />
        <span className="tut-count">
          {index + 1} / {STEPS.length}
        </span>
        <h3 className="tut-title">{step.title}</h3>
        <p className="tut-body">{step.body(view)}</p>
        <div className="tut-actions">
          <button type="button" className="tut-skip" onClick={onClose}>
            Skip tutorial
          </button>
          {!step.until ? (
            <button type="button" className="tut-next" onClick={() => setIndex(index + 1)} autoFocus>
              {index === STEPS.length - 1 ? 'Got it' : 'Next →'}
            </button>
          ) : (
            <span className="tut-waiting">your move…</span>
          )}
        </div>
      </div>
    </div>
  );
}
