import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CARDS } from '../data/cards';
import { CONCEPTS, type ConceptId } from '../data/concepts';
import { DOCTRINE_ORDER, DOCTRINES } from '../data/doctrines';
import { HEGEMONY, MAX_ALLIANCES, MAX_ROUNDS, POWER, POWERS, REGION_MEMBERS, REGIONS, TERRITORIES, type PowerId } from '../data/world';
import { aiStep } from '../engine/ai';
import {
  alliesOf,
  apply,
  attackBlocker,
  attackConsequences,
  attackDice,
  capitalOf,
  coreOf,
  current,
  hasPact,
  income,
  isOver,
  ownedBy,
  pactWith,
  polarity,
  reachable,
  shares,
  winChance,
} from '../engine/game';
import type { Action, CardId, Doctrine, FxEvent, GameState } from '../engine/types';
import { sfx } from './audio/sfx';
import { CardGlyph, Clock, PowerDot, ShareRing } from './bits';
import { direct } from './fx/director';
import { FxEngine } from './fx/particles';
import { GEO, MAP_W } from './geometry';
import { SoundControls } from './SoundControls';
import { useStage } from './Stage';
import { Tutorial, tutorialHolds } from './Tutorial';
import { NEUTRAL, WorldMap, type Highlight } from './WorldMap';

type Speed = 'normal' | 'fast' | 'instant';
const MIN_DELAY: Record<Speed, number> = { normal: 280, fast: 70, instant: 0 };

/** Events worth surfacing even when the AI plays instantly. */
const MAJOR = new Set<FxEvent['t']>(['coalition', 'coalitionEnd', 'bandwagon', 'transition', 'era', 'world', 'eliminated', 'capital', 'clock', 'end', 'pactBroken']);

const ERA_LABEL = { balanced: 'Balanced', defense: 'Defense dominant', offense: 'Offense dominant' } as const;

interface Props {
  game: GameState;
  setGame: (g: GameState) => void;
  onLearn: (ids: ConceptId[]) => void;
  onCodex: (id?: ConceptId) => void;
  onQuit: () => void;
  onEnd: () => void;
  tutorial: boolean;
  onTutorialDone: () => void;
}

function useIsPhone() {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.innerWidth < 760);
  useEffect(() => {
    const on = () => setPhone(window.innerWidth < 760);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return phone;
}

export function Game({ game, setGame, onLearn, onCodex, onQuit, onEnd, tutorial, onTutorialDone }: Props) {
  const [sel, setSel] = useState<number | null>(null);
  const [tgt, setTgt] = useState<number | null>(null);
  const [step, setStep] = useState<1 | 5 | 0>(1);
  const [cardMode, setCardMode] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [fortN, setFortN] = useState(1);
  const [moveN, setMoveN] = useState(0);
  const [speed, setSpeed] = useState<Speed>('normal');
  const [toast, setToast] = useState<{ id: ConceptId; key: number } | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [drawer, setDrawer] = useState<'powers' | 'cards' | null>(null);
  const toastKey = useRef(0);
  const fxEngine = useMemo(() => new FxEngine(), []);
  const { stage, mapOverlay, screenOverlay, shakeKey, shakeLevel } = useStage(fxEngine);
  const busyUntil = useRef(0);
  const phone = useIsPhone();
  const [tut, setTut] = useState<number | null>(tutorial ? 0 : null);
  const [attacks, setAttacks] = useState(0);
  const tutHold = tut !== null && tutorialHolds(tut);
  const closeTut = useCallback(() => {
    setTut(null);
    onTutorialDone();
  }, [onTutorialDone]);

  const me = game.player;
  const turnOf = current(game);
  const over = isOver(game);
  const myTurn = turnOf === me && !over;

  const commit = useCallback(
    (next: GameState, detail: 'full' | 'brief' | 'silent' = 'full') => {
      const span = direct(next.fx, stage, { player: next.player, detail });
      busyUntil.current = performance.now() + span;
      if (next.dispatches.length) {
        onLearn(next.dispatches);
        setToast({ id: next.dispatches[next.dispatches.length - 1], key: ++toastKey.current });
      }
      setGame(next);
    },
    [onLearn, setGame, stage],
  );

  const act = useCallback(
    (a: Action) => {
      const next = apply(game, a);
      if (next !== game) commit(next);
      else sfx.deny();
      return next;
    },
    [game, commit],
  );

  // Opening beats.
  useEffect(() => {
    commit({ ...game });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => fxEngine.clear(), [fxEngine]);
  useEffect(() => {
    (window as unknown as { __anarchy?: unknown }).__anarchy = { state: game, speed, fx: fxEngine };
  }, [game, speed, fxEngine]);

  // Drive AI turns, paced by the choreography of the previous action.
  useEffect(() => {
    if (over || game.offer || turnOf === me || tutHold) return;
    const run = () => {
      let s = game;
      let guard = 0;
      const learned: ConceptId[] = [];
      const events: FxEvent[] = [];
      do {
        const a = aiStep(s);
        let next = apply(s, a);
        if (next === s) next = apply(s, s.phase === 'attack' ? { kind: 'endAttack' } : { kind: 'endTurn' });
        learned.push(...next.dispatches);
        events.push(
          ...next.fx.filter(
            (e) =>
              speed !== 'instant' ||
              MAJOR.has(e.t) ||
              (e.t === 'turn' && e.power === me) ||
              (e.t === 'pact' && (e.a === me || e.b === me)) ||
              (e.t === 'conquer' && e.loser === me),
          ),
        );
        s = next;
      } while (speed === 'instant' && !isOver(s) && current(s) !== me && guard++ < 5000);
      commit({ ...s, dispatches: learned, fx: events }, speed === 'normal' ? 'full' : speed === 'fast' ? 'brief' : 'silent');
    };
    const wait = Math.max(MIN_DELAY[speed], speed === 'instant' ? 0 : busyUntil.current - performance.now());
    const id = setTimeout(run, wait);
    return () => clearTimeout(id);
  }, [game, speed, over, turnOf, me, commit, tutHold]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 10000);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (game.pendingMove && myTurn) setMoveN(game.pendingMove.max);
  }, [game.pendingMove, myTurn]);

  useEffect(() => {
    setTgt(null);
    setCardMode(null);
  }, [game.phase, game.turn]);

  // Keyboard: Esc clears, Enter advances the phase.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element).closest('input, textarea')) return;
      if (e.key === 'Escape') {
        setSel(null);
        setTgt(null);
        setCardMode(null);
        setDrawer(null);
      }
      if (e.key === 'Enter' && myTurn && !game.pendingMove && !game.offer) {
        if (game.phase === 'attack') act({ kind: 'endAttack' });
        else if (game.phase === 'fortify') act({ kind: 'endTurn' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act, myTurn, game.phase, game.pendingMove, game.offer]);

  const cardTarget = cardMode !== null ? CARDS[game.powers[me].cards[cardMode]]?.target : undefined;

  const highlight: Highlight = useMemo(() => {
    const targets = new Set<number>();
    let mode: Highlight['mode'] = 'none';
    if (myTurn && cardTarget === 'neutral') {
      mode = 'card';
      game.territories.forEach((t, i) => !t.owner && targets.add(i));
    } else if (myTurn && cardTarget === 'neutral-adjacent') {
      mode = 'card';
      for (const m of ownedBy(game, me))
        for (const u of TERRITORIES[m].adj) if (!game.territories[u].owner && game.territories[u].armies <= 4) targets.add(u);
    } else if (myTurn && game.phase === 'deploy') {
      mode = 'deploy';
    } else if (myTurn && game.phase === 'attack' && sel !== null && game.territories[sel].owner === me) {
      mode = 'attack';
      for (const u of TERRITORIES[sel].adj) if (!attackBlocker(game, sel, u)) targets.add(u);
    } else if (myTurn && game.phase === 'fortify' && sel !== null && game.territories[sel].owner === me) {
      mode = 'fortify';
      for (const u of reachable(game, sel)) targets.add(u);
    }
    return { selected: sel, targets, mode, aimTo: tgt };
  }, [game, sel, tgt, myTurn, me, cardTarget]);

  const oddsCache = useRef(new Map<string, number>());
  useEffect(() => oddsCache.current.clear(), [game]);
  const oddsFn = useCallback(
    (from: number, to: number) => {
      const key = `${from}-${to}`;
      if (!oddsCache.current.has(key)) oddsCache.current.set(key, winChance(game, from, to, 600));
      return oddsCache.current.get(key)!;
    },
    [game],
  );

  const onPick = (t: number) => {
    const T = game.territories[t];
    const pan = ((GEO.labels[t][0] / MAP_W) * 2 - 1) * 0.7;
    if (myTurn && cardMode !== null) {
      if (highlight.targets.has(t)) {
        act({ kind: 'play', card: cardMode, target: t });
        setCardMode(null);
      } else sfx.deny();
      return;
    }
    if (!(myTurn && game.phase === 'deploy' && T.owner === me)) sfx.select(pan);
    if (!myTurn || game.pendingMove) {
      setSel(t);
      setTgt(null);
      return;
    }
    if (game.phase === 'deploy') {
      setSel(t);
      if (T.owner === me) act({ kind: 'deploy', t, n: step === 0 ? game.reinforcements : step });
      return;
    }
    if (game.phase === 'attack') {
      if (T.owner === me) {
        setSel(t);
        setTgt(null);
      } else if (sel !== null && highlight.targets.has(t)) setTgt(t);
      else {
        setSel(t);
        setTgt(null);
      }
      return;
    }
    if (game.phase === 'fortify') {
      if (sel !== null && highlight.targets.has(t)) {
        setTgt(t);
        setFortN(Math.max(1, game.territories[sel].armies - 1));
      } else {
        setSel(t);
        setTgt(null);
      }
    }
  };

  const doAttack = (a: Action) => {
    const next = act(a);
    if (next !== game) setAttacks((n) => n + 1);
    if (a.kind === 'attack') {
      if (next.territories[a.to].owner === me) {
        setSel(a.to);
        setTgt(null);
      } else if (next.territories[a.from].armies < 2) setTgt(null);
    }
  };
  const attack = (blitz: boolean) => {
    if (sel === null || tgt === null) return;
    const a: Action = { kind: 'attack', from: sel, to: tgt, blitz };
    const def = game.territories[tgt].owner;
    if (def && hasPact(game, me, def)) setConfirm(a);
    else doAttack(a);
  };

  const sh = shares(game);
  const pol = polarity(game);
  const myTerr = ownedBy(game, me).length;
  const insets = phone ? { top: 56, right: 0, bottom: 160, left: 0 } : { top: 64, right: 60, bottom: 140, left: 262 };

  return (
    <div
      className={`g-root ${myTurn ? 'is-mine' : 'is-waiting'} ${game.clock <= 3 ? 'is-doom' : ''}`}
      style={{ '--pc': POWER[turnOf].color, '--me': POWER[me].color } as CSSProperties}
    >
      <WorldMap
        game={game}
        highlight={highlight}
        onPick={onPick}
        fx={fxEngine}
        odds={oddsFn}
        overlay={mapOverlay}
        shakeKey={shakeKey}
        shakeLevel={shakeLevel}
        insets={insets}
      />

      {/* ---------- Command bar ---------- */}
      <header className="g-top">
        <div className="g-top-left">
          <button type="button" className="icon-btn" onClick={onQuit} aria-label="Back to menu">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="wordmark">Anarchy</span>
          {phone && (
            <button type="button" className="chip-btn" onClick={() => setDrawer(drawer === 'powers' ? null : 'powers')} aria-expanded={drawer === 'powers'}>
              Powers
            </button>
          )}
        </div>

        <ol className="track hide-phone" aria-label={`Round ${game.round} of ${MAX_ROUNDS}`}>
          {Array.from({ length: MAX_ROUNDS }, (_, i) => (
            <li key={i} className={i + 1 < game.round ? 'past' : i + 1 === game.round ? 'now' : ''}>
              {i + 1}
            </li>
          ))}
        </ol>

        <div className="g-top-stats">
          <button
            type="button"
            className={`doom ${game.clock <= 3 ? 'hot' : ''}`}
            onClick={() => onCodex('mad')}
            title="Doomsday Clock: attacks on great-power homelands move it toward midnight."
          >
            <Clock minutes={game.clock} size={34} />
            <span className="doom-text">
              <b key={game.clock} className="doom-num">
                {game.clock}
              </b>
              <span>min to midnight</span>
            </span>
          </button>
          <Stat label="Era" value={ERA_LABEL[game.era]} onClick={() => onCodex('offense-defense')} hideOnPhone />
          <Stat label="System" value={pol} onClick={() => onCodex('polarity')} hideOnPhone />
          <div className="stat" title="Your domestic legitimacy">
            <span className="stat-label">Legitimacy</span>
            <span className="stat-value">{game.powers[me].legitimacy}</span>
          </div>
          <div className="stat heg" title={`Hold ${HEGEMONY} territories for hegemony`}>
            <span className="stat-label">Hegemony</span>
            <span className="stat-value">
              {myTerr}
              <small>/{HEGEMONY}</small>
            </span>
          </div>
        </div>

        <div className="g-top-right">
          <div className="seg" role="group" aria-label="AI speed">
            {(['normal', 'fast', 'instant'] as Speed[]).map((sp) => (
              <button key={sp} type="button" className={speed === sp ? 'on' : ''} onClick={() => setSpeed(sp)} title={`AI speed: ${sp}`} aria-pressed={speed === sp}>
                <SpeedIcon n={sp === 'normal' ? 1 : sp === 'fast' ? 2 : 3} />
              </button>
            ))}
          </div>
          <button
            type="button"
            className="icon-btn speed-cycle"
            aria-label={`AI speed: ${speed}. Tap to change.`}
            onClick={() => setSpeed(speed === 'normal' ? 'fast' : speed === 'fast' ? 'instant' : 'normal')}
          >
            <SpeedIcon n={speed === 'normal' ? 1 : speed === 'fast' ? 2 : 3} />
          </button>
          <SoundControls />
          <button type="button" className="icon-btn help-btn" onClick={() => setTut(0)} aria-label="Replay the tutorial" title="How to play">
            ?
          </button>
          <button type="button" className="icon-btn hide-phone codex-btn" onClick={() => onCodex()} aria-label="Open the Codex">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <path d="M4 3h9a3 3 0 013 3v11H7a3 3 0 01-3-3z M4 14a3 3 0 013-3h9" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </header>

      {game.coalition && (
        <div className={`ribbon ${game.coalition === me ? 'hot' : ''}`} style={{ '--rc': POWER[game.coalition].color } as CSSProperties}>
          <span className="ribbon-dot" />
          {game.coalition === me ? (
            <span>
              <b>The world is balancing against you.</b> Rivals get extra armies each turn until your share falls below 27%.
            </span>
          ) : (
            <span>
              <b>Coalition against {POWER[game.coalition].name}.</b> Members get extra armies each turn. A pact with the leader forfeits yours.
            </span>
          )}
          <button type="button" className="link" onClick={() => onCodex('balancing')}>
            Why?
          </button>
        </div>
      )}

      {/* ---------- Great powers roster ---------- */}
      <aside className={`g-roster panel ${phone ? (drawer === 'powers' ? 'drawer open' : 'drawer') : ''}`} aria-label="Great powers">
        <h2 className="panel-head">Great powers</h2>
        <ul className="plaques">
          {POWERS.map((p) => {
            const ps = game.powers[p.id];
            const pact = pactWith(game, me, p.id);
            const canPropose = myTurn && p.id !== me && ps.alive && !pact && !game.proposedThisRound.includes(p.id);
            const others = game.pacts.filter((x) => (x.a === p.id || x.b === p.id) && x.a !== me && x.b !== me);
            return (
              <li
                key={p.id}
                className={`plaque ${ps.alive ? '' : 'dead'} ${p.id === turnOf ? 'active' : ''} ${p.id === me ? 'me' : ''}`}
                style={{ '--c': p.color } as CSSProperties}
              >
                <span className="plaque-chip" />
                <div className="plaque-body">
                  <div className="plaque-row">
                    <span className="plaque-name">{p.short}</span>
                    <span className="plaque-full">{p.id === me ? 'You' : p.name}</span>
                    <span className="plaque-rep" title="Reputation">
                      rep {ps.reputation}
                    </span>
                    <span className="plaque-num" title="Territories">
                      {ownedBy(game, p.id).length}
                    </span>
                  </div>
                  <ShareRing share={sh[p.id]} color={p.color} />
                  <div className="legit" title={`Legitimacy ${ps.legitimacy}: domestic support. High adds armies, low costs them.`}>
                    <span className="legit-label">{p.regime === 'democracy' ? 'Democracy' : 'Autocracy'}</span>
                    <span className="legit-track">
                      <i style={{ width: `${ps.legitimacy}%` }} className={ps.legitimacy <= 35 ? 'low' : ''} />
                    </span>
                    <span className="legit-num">{ps.legitimacy}</span>
                  </div>
                  {p.id !== me && ps.alive && (
                    <label className="guess">
                      <span>Doctrine</span>
                      <select
                        value={game.guesses[p.id] ?? ''}
                        onChange={(e) => act({ kind: 'guess', power: p.id, doctrine: (e.target.value || null) as Doctrine | null })}
                        aria-label={`Your guess at ${p.name}'s doctrine`}
                      >
                        <option value="">Unknown</option>
                        {DOCTRINE_ORDER.map((d) => (
                          <option key={d} value={d}>
                            {DOCTRINES[d].name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="plaque-tags">
                    {!ps.alive && <span className="tag">Eliminated</span>}
                    {game.coalition === p.id && <span className="tag hot">Coalition target</span>}
                    {pact && pact.kind === 'alliance' && <span className="tag good">Allied</span>}
                    {pact && pact.kind === 'nap' && <span className="tag good">Pact · {pact.until - game.round + 1}r</span>}
                    {others.length > 0 && <span className="tag muted">⟷ {others.map((x) => POWER[x.a === p.id ? x.b : x.a].short).join(' ')}</span>}
                  </div>
                  {myTurn && p.id !== me && ps.alive && !game.proposedThisRound.includes(p.id) && (
                    <div className="plaque-actions">
                      {canPropose && (
                        <button
                          type="button"
                          className="plaque-action"
                          onClick={() => act({ kind: 'propose', to: p.id })}
                          title={game.coalition === p.id ? 'Signing with the coalition target forfeits your coalition aid.' : 'Offer a 5-round non-aggression pact'}
                        >
                          Pact
                        </button>
                      )}
                      {pact?.kind !== 'alliance' && alliesOf(game, me).length < MAX_ALLIANCES && (
                        <button
                          type="button"
                          className="plaque-action"
                          onClick={() => act({ kind: 'proposeAlliance', to: p.id })}
                          title="Defensive alliance: each side must come to the other's aid, or abandon it at a cost."
                        >
                          Alliance
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <details className="regions">
          <summary>Regions</summary>
          <ul>
            {REGIONS.map((r) => {
              const members = REGION_MEMBERS[r.id];
              const mine = members.filter((t) => game.territories[t].owner === me).length;
              const holder = POWERS.find((p) => members.every((t) => game.territories[t].owner === p.id));
              return (
                <li key={r.id}>
                  <span className="reg-name">
                    {holder ? <PowerDot p={holder.id} /> : <i className="pdot empty" />} {r.name}
                  </span>
                  <span className="reg-bar" title={`You hold ${mine} of ${members.length}`}>
                    <i style={{ width: `${(mine / members.length) * 100}%` }} />
                  </span>
                  <span className="reg-num">+{r.bonus}</span>
                </li>
              );
            })}
          </ul>
        </details>
      </aside>

      {/* ---------- Dossier ---------- */}
      {sel !== null && !(phone && drawer) && (
        <Dossier
          game={game}
          t={sel}
          tgt={tgt}
          odds={highlight.mode === 'attack' && tgt !== null ? oddsFn(sel, tgt) : null}
          onClose={() => {
            setSel(null);
            setTgt(null);
          }}
        />
      )}

      {/* ---------- Dispatch wire ---------- */}
      <div className="g-wire">
        {toast && !(phone && (sel !== null || drawer)) && (
          <div className="theory panel" key={toast.key}>
            <span className="panel-head">Theory in play</span>
            <span className="theory-title">{CONCEPTS[toast.id].name}</span>
            <span className="theory-text">{CONCEPTS[toast.id].dispatch}</span>
            <span className="theory-actions">
              <button type="button" className="link" onClick={() => onCodex(toast.id)}>
                Read more
              </button>
              <button type="button" className="link muted" onClick={() => setToast(null)}>
                Dismiss
              </button>
            </span>
          </div>
        )}
        {!phone && (
          <div className={`wire panel ${logOpen ? 'open' : ''}`}>
            <button type="button" className="wire-head" onClick={() => setLogOpen((o) => !o)} aria-expanded={logOpen}>
              <span className="wire-led" />
              Dispatches
              <span className="wire-chev">{logOpen ? 'Collapse' : 'Expand'}</span>
            </button>
            <ol className="wire-list">
              {[...game.log]
                .reverse()
                .slice(0, logOpen ? 40 : 3)
                .map((l, i) => (
                  <li key={game.log.length - i} className={`log-${l.kind}`}>
                    {l.power ? <PowerDot p={l.power} /> : <i className="pdot" style={{ background: NEUTRAL }} />}
                    <span>{l.text}</span>
                  </li>
                ))}
            </ol>
          </div>
        )}
      </div>

      {/* ---------- Card hand ---------- */}
      <Hand
        game={game}
        me={me}
        myTurn={myTurn}
        cardMode={cardMode}
        setCardMode={setCardMode}
        act={act}
        phone={phone}
        open={drawer === 'cards'}
        setOpen={(o) => setDrawer(o ? 'cards' : null)}
      />

      {/* ---------- Phase dock ---------- */}
      <section className={`g-dock panel ${myTurn ? 'mine' : ''}`} aria-label="Your move">
        <div className="phases" aria-hidden={!myTurn}>
          {(['deploy', 'attack', 'fortify'] as const).map((ph, i) => (
            <span
              key={ph}
              className={`phase ${myTurn && game.phase === ph ? 'on' : ''} ${myTurn && ['deploy', 'attack', 'fortify'].indexOf(game.phase) > i ? 'done' : ''}`}
            >
              <i>{i + 1}</i>
              {ph}
            </span>
          ))}
        </div>
        <div className="dock-body">
          {over ? (
            <>
              <div className="dock-main">
                <span className="dock-kicker">The game is over</span>
                <span className="dock-title">{game.endReason === 'nuclear' ? 'Midnight.' : game.winner === me ? 'Victory.' : 'Defeat.'}</span>
              </div>
              <button type="button" className="btn primary big" onClick={onEnd}>
                See the verdict
              </button>
            </>
          ) : !myTurn ? (
            <>
              <div className="dock-main">
                <span className="dock-kicker">
                  Round {game.round} · {game.phase === 'deploy' ? 'Mobilizing' : game.phase === 'attack' ? 'Conducting operations' : 'Repositioning'}
                </span>
                <span className="dock-title enemy">
                  <PowerDot p={turnOf} /> {POWER[turnOf].name}
                </span>
                <span className="scan" aria-hidden="true">
                  <i />
                </span>
              </div>
              <span className="dock-hint hide-phone">Speed up enemy turns with the ▸▸ control.</span>
            </>
          ) : game.pendingMove ? (
            <>
              <div className="dock-main">
                <span className="dock-kicker">Territory taken · move in</span>
                <span className="dock-title">{TERRITORIES[game.pendingMove.to].name}</span>
              </div>
              <label className="slider" htmlFor="move-n">
                <input
                  id="move-n"
                  type="range"
                  min={game.pendingMove.min}
                  max={game.pendingMove.max}
                  value={moveN}
                  onChange={(e) => setMoveN(Number(e.target.value))}
                />
                <b>{moveN}</b>
              </label>
              <button type="button" className="btn primary" onClick={() => act({ kind: 'move', n: moveN })}>
                Move {moveN}
              </button>
            </>
          ) : game.phase === 'deploy' ? (
            <>
              <div className="dock-main">
                <span className="dock-kicker">Reinforcements</span>
                <span className="dock-title">
                  <span className="big-num">{game.reinforcements}</span> to deploy
                </span>
                <IncomeLine game={game} />
              </div>
              <span className="dock-hint hide-phone">Click your territories to place armies.</span>
              <div className="seg" role="group" aria-label="Armies per click">
                {([1, 5, 0] as const).map((n) => (
                  <button key={n} type="button" className={step === n ? 'on' : ''} onClick={() => setStep(n)} aria-pressed={step === n}>
                    {n === 0 ? 'All' : `+${n}`}
                  </button>
                ))}
              </div>
            </>
          ) : game.phase === 'attack' ? (
            <>
              {sel !== null && tgt !== null && !attackBlocker(game, sel, tgt) ? (
                <>
                  <div className="dock-main">
                    <span className="dock-kicker">
                      {game.territories[sel].armies} vs {game.territories[tgt].armies} · {Math.round(oddsFn(sel, tgt) * 100)}% to take it
                    </span>
                    <span className="dock-title small">
                      {TERRITORIES[sel].name} <span className="arrow">→</span> {TERRITORIES[tgt].name}
                    </span>
                  </div>
                  <div className="dock-actions">
                    <button type="button" className="btn" onClick={() => attack(false)}>
                      Roll once
                    </button>
                    <button type="button" className="btn danger big" onClick={() => attack(true)}>
                      Attack all-out
                    </button>
                  </div>
                </>
              ) : (
                <div className="dock-main">
                  <span className="dock-kicker">Attack</span>
                  <span className="dock-title small">
                    {sel !== null && game.territories[sel].owner === me
                      ? game.territories[sel].armies < 2
                        ? 'Need 2+ armies here to attack.'
                        : 'Choose a highlighted enemy.'
                      : 'Select one of your territories.'}
                  </span>
                </div>
              )}
              <button type="button" className="btn ghost" onClick={() => act({ kind: 'endAttack' })} title="Enter">
                End attacks →
              </button>
            </>
          ) : (
            <>
              {sel !== null && tgt !== null ? (
                <>
                  <div className="dock-main">
                    <span className="dock-kicker">Fortify</span>
                    <span className="dock-title small">
                      {TERRITORIES[sel].name} → {TERRITORIES[tgt].name}
                    </span>
                  </div>
                  <label className="slider" htmlFor="fort-n">
                    <input
                      id="fort-n"
                      type="range"
                      min={1}
                      max={Math.max(1, game.territories[sel].armies - 1)}
                      value={fortN}
                      onChange={(e) => setFortN(Number(e.target.value))}
                    />
                    <b>{fortN}</b>
                  </label>
                  <button type="button" className="btn primary" onClick={() => act({ kind: 'fortify', from: sel, to: tgt, n: fortN })}>
                    Move & end turn
                  </button>
                </>
              ) : (
                <div className="dock-main">
                  <span className="dock-kicker">Fortify (optional)</span>
                  <span className="dock-title small">Move armies once through your own territory.</span>
                </div>
              )}
              <button type="button" className="btn ghost" onClick={() => act({ kind: 'endTurn' })} title="Enter">
                End turn →
              </button>
            </>
          )}
        </div>
      </section>

      {game.pendingObligation && myTurn && (
        <Modal>
          <span className="modal-kicker hot">Alliance obligation</span>
          <h2>
            {POWER[game.pendingObligation.aggressor].name} attacked your ally, {POWER[game.pendingObligation.victim].name}
          </h2>
          <p>
            <b>Honor</b> the alliance and you are at war with {POWER[game.pendingObligation.aggressor].name}: any pact with them ends and
            you mobilize +3 armies. <b>Abandon</b> your ally and the alliance dies: reputation −25, and legitimacy −
            {POWER[me].regime === 'democracy' ? 12 : 4} as your public sees a broken promise.
          </p>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => act({ kind: 'answerObligation', honor: true })}>
              Honor the alliance
            </button>
            <button type="button" className="btn" onClick={() => act({ kind: 'answerObligation', honor: false })}>
              Abandon them
            </button>
          </div>
        </Modal>
      )}

      {game.offer && myTurn && !game.pendingObligation && (
        <Modal>
          <span className="modal-kicker">Diplomatic cable · {POWER[game.offer.from].name}</span>
          <h2>A non-aggression pact is offered</h2>
          <p>Five rounds of peace on your shared border. Breaking it later costs you 30 reputation.</p>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => act({ kind: 'answerOffer', accept: true })}>
              Sign
            </button>
            <button type="button" className="btn" onClick={() => act({ kind: 'answerOffer', accept: false })}>
              Decline
            </button>
          </div>
        </Modal>
      )}

      {confirm && confirm.kind === 'attack' && (
        <Modal>
          <span className="modal-kicker hot">Break the pact?</span>
          <h2>You have a pact with {POWER[game.territories[confirm.to].owner!].name}</h2>
          <p>Attacking tears it up. Your reputation drops by 30 and other powers will trust your signature less.</p>
          <div className="row">
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                doAttack(confirm);
                setConfirm(null);
              }}
            >
              Attack anyway
            </button>
            <button type="button" className="btn" onClick={() => setConfirm(null)}>
              Keep my word
            </button>
          </div>
        </Modal>
      )}

      {screenOverlay}
      {tut !== null && !game.pendingObligation && !(game.offer && myTurn) && !confirm && (
        <Tutorial view={{ game, sel, tgt, attacks, phone }} index={tut} setIndex={setTut} onClose={closeTut} />
      )}
    </div>
  );
}

function SpeedIcon({ n }: { n: number }) {
  return (
    <svg viewBox={`0 0 ${8 * n + 4} 12`} width={8 * n + 4} height="12" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <path key={i} d={`M${2 + i * 8},1 L${9 + i * 8},6 L${2 + i * 8},11 Z`} fill="currentColor" />
      ))}
    </svg>
  );
}

function Stat({ label, value, sub, onClick, hideOnPhone }: { label: string; value: string; sub?: string; onClick?: () => void; hideOnPhone?: boolean }) {
  const inner = (
    <>
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {value}
        {sub && <small>{sub}</small>}
      </span>
    </>
  );
  const cls = `stat ${hideOnPhone ? 'hide-phone' : ''}`;
  return onClick ? (
    <button type="button" className={`${cls} as-btn`} onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function IncomeLine({ game }: { game: GameState }) {
  const inc = income(game, game.player);
  return (
    <span className="income">
      {inc.lines.map((l) => (
        <span key={l.label} className={l.value < 0 ? 'neg' : ''}>
          {l.value > 0 ? '+' : ''}
          {l.value} {/territories/.test(l.label) ? 'territories' : l.label}
        </span>
      ))}
    </span>
  );
}

function Dossier({ game, t, tgt, odds, onClose }: { game: GameState; t: number; tgt: number | null; odds: number | null; onClose: () => void }) {
  const focus = tgt ?? t;
  const def = TERRITORIES[focus];
  const st = game.territories[focus];
  const region = REGIONS.find((r) => r.id === def.region)!;
  const core = coreOf(focus);
  const cap = capitalOf(focus);
  const members = REGION_MEMBERS[region.id];
  const color = st.owner ? POWER[st.owner].color : NEUTRAL;
  return (
    <aside className={`g-dossier panel ${st.owner === 'eu' || !st.owner ? 'light-deed' : ''}`} style={{ '--c': color } as CSSProperties} aria-label="Territory intelligence" key={focus}>
      <div className="deed">
        <span className="dossier-kicker">
          {region.name} · region bonus +{region.bonus}
        </span>
        <h2 className="dossier-name">{def.name}</h2>
        <button type="button" className="dossier-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="dossier-owner">
        <i className="pdot" style={{ background: color }} />
        {st.owner ? POWER[st.owner].name : 'Minor state'}
        <span className="dossier-armies">
          <span className="big-num">{st.armies}</span> armies
        </span>
      </div>
      {(cap || core) && (
        <div className="plaque-tags">
          {cap && <span className="tag">★ Capital of {POWER[cap].short}</span>}
          {core && !cap && <span className="tag">{POWER[core].short} homeland</span>}
          {core && <span className="tag hot">Striking it moves the clock</span>}
        </div>
      )}
      <div className="dossier-region" aria-label={`${region.name} control`}>
        {members.map((m) => (
          <i
            key={m}
            title={TERRITORIES[m].name}
            style={{ background: game.territories[m].owner ? POWER[game.territories[m].owner!].color : NEUTRAL }}
            className={m === focus ? 'cur' : ''}
          />
        ))}
      </div>
      {odds !== null && tgt !== null && (
        <div className="dossier-odds">
          <div className="odds-bar">
            <i style={{ width: `${odds * 100}%` }} />
          </div>
          <span>
            <b>{Math.round(odds * 100)}%</b> chance an all-out attack takes it
          </span>
          <DiceNote game={game} from={t} to={tgt} />
          {attackConsequences(game, t, tgt).length > 0 && (
            <ul className="consequences">
              {attackConsequences(game, t, tgt).map((c) => (
                <li key={c.text} className={`cq-${c.tone}`}>
                  {c.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="dossier-borders">Borders {def.adj.map((u) => TERRITORIES[u].name).join(' · ')}</p>
    </aside>
  );
}

function DiceNote({ game, from, to }: { game: GameState; from: number; to: number }) {
  const d = attackDice(game, from, to);
  const notes: string[] = [`You roll ${d.a}, they roll ${d.d}.`];
  if (d.amphibious && game.territories[from].owner !== 'usa') notes.push('Amphibious: max 2 dice.');
  if (game.era === 'defense') notes.push('Defense era: +1 to their best die.');
  if (game.era === 'offense' || game.blitz) notes.push('You win ties.');
  return <span className="dice-note">{notes.join(' ')}</span>;
}

function Hand({
  game,
  me,
  myTurn,
  cardMode,
  setCardMode,
  act,
  phone,
  open,
  setOpen,
}: {
  game: GameState;
  me: PowerId;
  myTurn: boolean;
  cardMode: number | null;
  setCardMode: (n: number | null) => void;
  act: (a: Action) => GameState;
  phone: boolean;
  open: boolean;
  setOpen: (o: boolean) => void;
}) {
  const cards = game.powers[me].cards;
  const usable = (c: CardId) => myTurn && !game.pendingMove && (game.phase === 'deploy' || (game.phase === 'attack' && c !== 'arms-race'));
  if (phone && !open)
    return (
      <button type="button" className="hand-toggle panel" onClick={() => setOpen(true)} disabled={!cards.length}>
        Cards <b>{cards.length}</b>
      </button>
    );
  return (
    <div className={`g-hand ${phone ? 'sheet panel' : ''}`} aria-label="Crisis cards">
      {phone && (
        <button type="button" className="sheet-close link" onClick={() => setOpen(false)}>
          Close
        </button>
      )}
      {cards.length === 0 && !phone && <span className="hand-empty">Win a territory in a turn to draw a crisis card.</span>}
      {cards.map((c, i) => {
        const def = CARDS[c];
        const n = cards.length;
        const angle = phone ? 0 : (i - (n - 1) / 2) * 5;
        const lift = phone ? 0 : Math.pow(Math.abs(i - (n - 1) / 2), 1.6) * 5;
        return (
          <div key={`${c}-${i}`} className="card-slot" style={{ '--a': `${angle}deg`, '--l': `${lift}px` } as CSSProperties}>
            <button
              type="button"
              className={`crisis ${cardMode === i ? 'on' : ''}`}
              disabled={!usable(c)}
              onClick={() => {
                if (def.target === 'none') act({ kind: 'play', card: i });
                else setCardMode(cardMode === i ? null : i);
              }}
            >
              <CardGlyph id={c} />
              <span className="crisis-name">{def.name}</span>
              <span className="crisis-text">{def.text}</span>
            </button>
            {cardMode === i && def.target === 'power' && (
              <div className="power-pick panel">
                {POWERS.filter((p) => p.id !== me && game.powers[p.id].alive && !(c === 'detente' && hasPact(game, me, p.id))).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="btn small"
                    onClick={() => {
                      act({ kind: 'play', card: i, target: p.id });
                      setCardMode(null);
                    }}
                  >
                    <PowerDot p={p.id} /> {p.short}
                  </button>
                ))}
              </div>
            )}
            {cardMode === i && def.target !== 'power' && <span className="pick-hint">Pick a highlighted minor state</span>}
          </div>
        );
      })}
    </div>
  );
}

function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="modal panel">{children}</div>
    </div>
  );
}
