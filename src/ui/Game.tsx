import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CARDS } from '../data/cards';
import { CONCEPTS, type ConceptId } from '../data/concepts';
import { HEGEMONY, MAX_ROUNDS, POWER, POWERS, REGION_MEMBERS, REGIONS, TERRITORIES } from '../data/world';
import { aiStep } from '../engine/ai';
import {
  apply,
  attackBlocker,
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
import type { Action, FxEvent, GameState } from '../engine/types';
import { sfx } from './audio/sfx';
import { Clock, PowerDot } from './bits';
import { direct } from './fx/director';
import { FxEngine } from './fx/particles';
import { GEO, MAP_W } from './geometry';
import { SoundControls } from './SoundControls';
import { useStage } from './Stage';
import { WorldMap, type Highlight } from './WorldMap';

type Speed = 'normal' | 'fast' | 'instant';
const MIN_DELAY: Record<Speed, number> = { normal: 280, fast: 70, instant: 0 };

/** Events worth surfacing even when the AI plays instantly. */
const MAJOR = new Set<FxEvent['t']>(['coalition', 'coalitionEnd', 'bandwagon', 'transition', 'era', 'world', 'eliminated', 'capital', 'clock', 'end', 'pactBroken']);

interface Props {
  game: GameState;
  setGame: (g: GameState) => void;
  onLearn: (ids: ConceptId[]) => void;
  onCodex: (id?: ConceptId) => void;
  onQuit: () => void;
  onEnd: () => void;
}

interface Toast {
  id: ConceptId;
  key: number;
}

export function Game({ game, setGame, onLearn, onCodex, onQuit, onEnd }: Props) {
  const [sel, setSel] = useState<number | null>(null);
  const [tgt, setTgt] = useState<number | null>(null);
  const [step, setStep] = useState<1 | 5 | 0>(1);
  const [cardMode, setCardMode] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [fortN, setFortN] = useState(1);
  const [moveN, setMoveN] = useState(0);
  const [speed, setSpeed] = useState<Speed>('normal');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastKey = useRef(0);
  const fxEngine = useMemo(() => new FxEngine(), []);
  const { stage, mapOverlay, screenOverlay, shakeClass, shakeKey } = useStage(fxEngine);
  const busyUntil = useRef(0);

  const me = game.player;
  const turnOf = current(game);
  const myTurn = turnOf === me && !isOver(game);
  const over = isOver(game);

  const commit = useCallback(
    (next: GameState, detail: 'full' | 'brief' | 'silent' = 'full') => {
      const span = direct(next.fx, stage, { player: next.player, detail });
      busyUntil.current = performance.now() + span;
      if (next.dispatches.length) {
        onLearn(next.dispatches);
        setToasts((t) => [...t, ...next.dispatches.map((id) => ({ id, key: ++toastKey.current }))].slice(-1));
      }
      setGame(next);
    },
    [onLearn, setGame, stage],
  );

  const act = useCallback(
    (a: Action) => {
      const next = apply(game, a);
      if (next !== game) commit(next);
      return next;
    },
    [game, commit],
  );

  // Play the opening beats (first turn, first dispatch) once.
  useEffect(() => {
    commit({ ...game });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => fxEngine.clear(), [fxEngine]);

  // Expose read-only state for automated playtesting.
  useEffect(() => {
    (window as unknown as { __anarchy?: unknown }).__anarchy = { state: game, speed };
  }, [game, speed]);

  // Drive AI turns.
  useEffect(() => {
    if (over || game.offer || turnOf === me) return;
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
        events.push(...next.fx.filter((e) => speed !== 'instant' || MAJOR.has(e.t) || (e.t === 'turn' && e.power === me) || (e.t === 'pact' && (e.a === me || e.b === me)) || (e.t === 'conquer' && e.loser === me)));
        s = next;
      } while (speed === 'instant' && !isOver(s) && current(s) !== me && guard++ < 5000);
      commit({ ...s, dispatches: learned, fx: events }, speed === 'normal' ? 'full' : speed === 'fast' ? 'brief' : 'silent');
    };
    const wait = Math.max(MIN_DELAY[speed], speed === 'instant' ? 0 : busyUntil.current - performance.now());
    const id = setTimeout(run, wait);
    return () => clearTimeout(id);
  }, [game, speed, over, turnOf, me, commit]);

  useEffect(() => {
    if (!toasts.length) return;
    const id = setTimeout(() => setToasts((t) => t.slice(1)), 9000);
    return () => clearTimeout(id);
  }, [toasts]);

  useEffect(() => {
    if (game.pendingMove && myTurn) setMoveN(game.pendingMove.max);
  }, [game.pendingMove, myTurn]);

  // Clear stale selections when phases change.
  useEffect(() => {
    setTgt(null);
    setCardMode(null);
  }, [game.phase, game.turn]);

  // Keyboard: Esc clears selection, Enter advances the phase.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element).closest('input, textarea')) return;
      if (e.key === 'Escape') {
        setSel(null);
        setTgt(null);
        setCardMode(null);
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
      for (const m of ownedBy(game, me)) for (const u of TERRITORIES[m].adj) if (!game.territories[u].owner && game.territories[u].armies <= 4) targets.add(u);
    } else if (myTurn && game.phase === 'deploy') {
      mode = 'deploy';
    } else if (myTurn && game.phase === 'attack' && sel !== null && game.territories[sel].owner === me) {
      mode = 'attack';
      for (const u of TERRITORIES[sel].adj) if (!attackBlocker(game, sel, u)) targets.add(u);
    } else if (myTurn && game.phase === 'fortify' && sel !== null && game.territories[sel].owner === me) {
      mode = 'fortify';
      for (const u of reachable(game, sel)) targets.add(u);
    }
    return { selected: sel, targets, mode };
  }, [game, sel, myTurn, me, cardTarget]);

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
      } else if (sel !== null && highlight.targets.has(t)) {
        setTgt(t);
      } else {
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

  const attack = (blitz: boolean) => {
    if (sel === null || tgt === null) return;
    const a: Action = { kind: 'attack', from: sel, to: tgt, blitz };
    const def = game.territories[tgt].owner;
    if (def && hasPact(game, me, def)) {
      setConfirm(a);
      return;
    }
    doAttack(a);
  };
  const doAttack = (a: Action) => {
    const next = act(a);
    if (a.kind === 'attack') {
      if (next.territories[a.to].owner === me) {
        setSel(a.to);
        setTgt(null);
      } else if (next.territories[a.from].armies < 2) setTgt(null);
    }
  };

  const odds = useMemo(
    () => (myTurn && game.phase === 'attack' && sel !== null && tgt !== null && !attackBlocker(game, sel, tgt) ? winChance(game, sel, tgt) : null),
    [game, sel, tgt, myTurn],
  );

  const sh = shares(game);
  const pol = polarity(game);
  const myTerr = ownedBy(game, me).length;
  const inc = income(game, me);

  return (
    <div className="game">
      <header className="hud">
        <div className="hud-left">
          <button type="button" className="link" onClick={onQuit}>
            ← Menu
          </button>
          <span className="logo-small">ANARCHY</span>
        </div>
        <div className="hud-stats">
          <Stat label="Round" value={`${Math.min(game.round, MAX_ROUNDS)}/${MAX_ROUNDS}`} />
          <Stat label="System" value={pol} onClick={() => onCodex('polarity')} />
          <Stat
            label="Era"
            value={game.era === 'balanced' ? 'Balanced' : game.era === 'defense' ? 'Defense dominant' : 'Offense dominant'}
            onClick={() => onCodex('offense-defense')}
          />
          <Stat label="Hegemony" value={`${myTerr}/${HEGEMONY}`} />
          <button
            type="button"
            className={`clock-stat ${game.clock <= 3 ? 'hot' : ''}`}
            onClick={() => onCodex('mad')}
            title="Doomsday Clock: attacks on great-power homelands move it toward midnight."
          >
            <Clock minutes={game.clock} size={38} />
            <span>
              <b key={game.clock} className="clock-num">
                {game.clock}
              </b>{' '}
              min to midnight
            </span>
          </button>
          <div className="speed hud-speed" role="group" aria-label="AI speed">
            {(['normal', 'fast', 'instant'] as Speed[]).map((sp) => (
              <button key={sp} type="button" className={speed === sp ? 'on' : ''} onClick={() => setSpeed(sp)} title={`AI speed: ${sp}`}>
                {sp === 'normal' ? '▶' : sp === 'fast' ? '▶▶' : '▶▶▶'}
              </button>
            ))}
          </div>
          <SoundControls />
        </div>
      </header>

      {game.coalition && (
        <div className={`banner ${game.coalition === me ? 'banner-hot' : ''}`}>
          {game.coalition === me
            ? 'The world is balancing against you. Every other power gets +3 armies a turn while your share stays above 27%.'
            : `Balancing coalition against ${POWER[game.coalition].name}. Members get +3 armies a turn.`}
          <button type="button" className="link" onClick={() => onCodex('balancing')}>
            Why?
          </button>
        </div>
      )}

      <div className="board">
        <section className="map-col">
          <WorldMap
            game={game}
            highlight={highlight}
            onPick={onPick}
            fx={fxEngine}
            overlay={mapOverlay}
            shakeClass={shakeClass}
            shakeKey={shakeKey}
          />
          <div className="toasts" aria-live="polite">
            {toasts.map((t) => (
              <div key={t.key} className="toast">
                <p className="toast-kicker">Theory in play</p>
                <p className="toast-title">{CONCEPTS[t.id].name}</p>
                <p className="toast-text">{CONCEPTS[t.id].dispatch}</p>
                <div className="toast-actions">
                  <button type="button" className="link" onClick={() => onCodex(t.id)}>
                    Read more
                  </button>
                  <button type="button" className="link" onClick={() => setToasts((ts) => ts.filter((x) => x.key !== t.key))}>
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="under-map">
          {/* Log & regions */}
          <section className="card">
            <h3>Dispatches</h3>
            <ol className="log" reversed>
              {[...game.log]
                .reverse()
                .slice(0, 14)
                .map((l, i) => (
                  <li key={game.log.length - i} className={`log-${l.kind}`}>
                    {l.power && <PowerDot p={l.power} />} <span>{l.text}</span>
                  </li>
                ))}
            </ol>
          </section>

          <section className="card regions">
            <h3>Region bonuses</h3>
            <ul>
              {REGIONS.map((r) => {
                const members = REGION_MEMBERS[r.id];
                const mine = members.filter((t) => game.territories[t].owner === me).length;
                const holder = POWERS.find((p) => members.every((t) => game.territories[t].owner === p.id));
                return (
                  <li key={r.id}>
                    <span>
                      {holder && <PowerDot p={holder.id} />} {r.name}
                    </span>
                    <span>
                      you {mine}/{members.length} · +{r.bonus}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
          </div>
        </section>

        <aside className="side">
          {/* Turn panel */}
          <section className="card turn-card" style={{ ['--pc' as string]: POWER[turnOf].color }}>
            {over ? (
              <>
                <h2>Game over</h2>
                <button type="button" className="btn btn-primary" onClick={onEnd}>
                  See the verdict
                </button>
              </>
            ) : !myTurn ? (
              <>
                <p className="kicker">Round {game.round} · Enemy turn</p>
                <h2 className="thinking">
                  <PowerDot p={turnOf} /> {POWER[turnOf].name}
                </h2>
                <div className="scan" aria-hidden="true">
                  <i />
                </div>
                <p className="hint">
                  {game.phase === 'deploy' ? 'Mobilizing reserves…' : game.phase === 'attack' ? 'Conducting operations…' : 'Repositioning forces…'} Speed up with the ▶▶ controls.
                </p>
              </>
            ) : game.pendingMove ? (
              <>
                <p className="kicker">Victory. Move in</p>
                <h2>{TERRITORIES[game.pendingMove.to].name}</h2>
                <label className="slider-row" htmlFor="move-n">
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
                <button type="button" className="btn btn-primary" onClick={() => act({ kind: 'move', n: moveN })}>
                  Move {moveN} armies
                </button>
              </>
            ) : game.phase === 'deploy' ? (
              <>
                <p className="kicker">Your turn · Deploy</p>
                <h2>
                  <span className="big">{game.reinforcements}</span> armies to place
                </h2>
                <p className="hint">Click your territories to reinforce them.</p>
                <div className="speed" role="group" aria-label="Armies per click">
                  {([1, 5, 0] as const).map((n) => (
                    <button key={n} type="button" className={step === n ? 'on' : ''} onClick={() => setStep(n)}>
                      {n === 0 ? 'All' : `+${n}`}
                    </button>
                  ))}
                </div>
                <details className="income">
                  <summary>Income: {inc.total}</summary>
                  <ul>
                    {inc.lines.map((l) => (
                      <li key={l.label}>
                        <span>{l.label}</span>
                        <span>{l.value > 0 ? `+${l.value}` : l.value}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            ) : game.phase === 'attack' ? (
              <>
                <p className="kicker">Your turn · Attack</p>
                {sel !== null && tgt !== null && odds !== null ? (
                  <>
                    <h2>
                      {TERRITORIES[sel].name} → {TERRITORIES[tgt].name}
                    </h2>
                    <p className="odds">
                      {game.territories[sel].armies} vs {game.territories[tgt].armies} · win chance <b>{Math.round(odds * 100)}%</b>
                    </p>
                    <DiceNote game={game} from={sel} to={tgt} />
                    <div className="row">
                      <button type="button" className="btn" onClick={() => attack(false)}>
                        Roll once
                      </button>
                      <button type="button" className="btn btn-primary" onClick={() => attack(true)}>
                        Attack all-out
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="hint">Select one of your territories with 2+ armies, then a highlighted neighbour.</p>
                )}
                <button type="button" className="btn btn-ghost" onClick={() => act({ kind: 'endAttack' })}>
                  End attacks → fortify
                </button>
              </>
            ) : (
              <>
                <p className="kicker">Your turn · Fortify</p>
                {sel !== null && tgt !== null ? (
                  <>
                    <h2>
                      {TERRITORIES[sel].name} → {TERRITORIES[tgt].name}
                    </h2>
                    <label className="slider-row" htmlFor="fort-n">
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
                    <button type="button" className="btn btn-primary" onClick={() => act({ kind: 'fortify', from: sel, to: tgt, n: fortN })}>
                      Move and end turn
                    </button>
                  </>
                ) : (
                  <p className="hint">Optionally move armies once through your own territory, then end your turn.</p>
                )}
                <button type="button" className="btn btn-ghost" onClick={() => act({ kind: 'endTurn' })}>
                  End turn
                </button>
              </>
            )}
          </section>

          {/* Selected territory */}
          {sel !== null && <TerritoryCard game={game} t={sel} />}

          {/* Cards */}
          <section className="card">
            <h3>Crisis cards</h3>
            {game.powers[me].cards.length === 0 ? (
              <p className="hint">Conquer at least one territory in a turn to draw a card.</p>
            ) : (
              <ul className="cards">
                {game.powers[me].cards.map((c, i) => {
                  const def = CARDS[c];
                  const usable = myTurn && !game.pendingMove && (game.phase === 'deploy' || (game.phase === 'attack' && c !== 'arms-race'));
                  return (
                    <li key={`${c}-${i}`}>
                      <button
                        type="button"
                        className={`crisis ${cardMode === i ? 'on' : ''}`}
                        disabled={!usable}
                        onClick={() => {
                          if (def.target === 'none') act({ kind: 'play', card: i });
                          else setCardMode(cardMode === i ? null : i);
                        }}
                      >
                        <span className="crisis-name">{def.name}</span>
                        <span className="crisis-text">{def.text}</span>
                      </button>
                      {cardMode === i && def.target === 'power' && (
                        <div className="power-pick">
                          {POWERS.filter((p) => p.id !== me && game.powers[p.id].alive && !(c === 'detente' && hasPact(game, me, p.id))).map((p) => (
                            <button key={p.id} type="button" className="btn btn-small" onClick={() => (act({ kind: 'play', card: i, target: p.id }), setCardMode(null))}>
                              <PowerDot p={p.id} /> {p.short}
                            </button>
                          ))}
                        </div>
                      )}
                      {cardMode === i && def.target !== 'power' && <p className="hint">Pick a highlighted minor state on the map.</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Powers */}
          <section className="card">
            <h3>Great powers</h3>
            <ul className="powers">
              {POWERS.map((p) => {
                const ps = game.powers[p.id];
                const pact = pactWith(game, me, p.id);
                const canPropose = myTurn && p.id !== me && ps.alive && !pact && !game.proposedThisRound.includes(p.id);
                return (
                  <li key={p.id} className={ps.alive ? '' : 'dead'}>
                    <div className="pw-row">
                      <PowerDot p={p.id} />
                      <span className="pw-name">
                        {p.name}
                        {p.id === me && <em> (you)</em>}
                      </span>
                      <span className="pw-num">{ownedBy(game, p.id).length}</span>
                    </div>
                    <div className="share-bar" title={`${Math.round(sh[p.id] * 100)}% of great-power strength`}>
                      <i style={{ width: `${sh[p.id] * 100}%`, background: p.color }} />
                    </div>
                    <div className="pw-tags">
                      {!ps.alive && <span className="tag">Eliminated</span>}
                      {game.coalition === p.id && <span className="tag tag-hot">Coalition target</span>}
                      {pact && <span className="tag">Pact · {pact.until - game.round + 1}r</span>}
                      {p.id !== me && ps.alive && game.pacts.some((x) => (x.a === p.id || x.b === p.id) && x.a !== me && x.b !== me) && (
                        <span className="tag tag-muted">
                          Pact with{' '}
                          {game.pacts
                            .filter((x) => (x.a === p.id || x.b === p.id) && x.a !== me && x.b !== me)
                            .map((x) => POWER[x.a === p.id ? x.b : x.a].short)
                            .join(', ')}
                        </span>
                      )}
                      <span className="tag tag-muted">Rep {ps.reputation}</span>
                      {canPropose && (
                        <button type="button" className="btn btn-small" onClick={() => act({ kind: 'propose', to: p.id })}>
                          Propose pact
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

        </aside>
      </div>

      {game.offer && myTurn && (
        <Modal>
          <p className="kicker">Diplomatic cable</p>
          <h2>{POWER[game.offer.from].name} proposes a non-aggression pact</h2>
          <p>Five rounds of peace on your shared border. Breaking it later will cost you 30 reputation.</p>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => act({ kind: 'answerOffer', accept: true })}>
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
          <p className="kicker">Break the pact?</p>
          <h2>You have a non-aggression pact with {POWER[game.territories[confirm.to].owner!].name}</h2>
          <p>Attacking tears it up. Your reputation drops by 30, and other powers will be less willing to sign with you.</p>
          <div className="row">
            <button type="button" className="btn btn-danger" onClick={() => (doAttack(confirm), setConfirm(null))}>
              Attack anyway
            </button>
            <button type="button" className="btn" onClick={() => setConfirm(null)}>
              Keep my word
            </button>
          </div>
        </Modal>
      )}
      {screenOverlay}
    </div>
  );
}

function Stat({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </>
  );
  return onClick ? (
    <button type="button" className="stat" onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="stat">{inner}</div>
  );
}

function DiceNote({ game, from, to }: { game: GameState; from: number; to: number }) {
  const d = attackDice(game, from, to);
  const notes: string[] = [`You roll ${d.a}, they roll ${d.d}.`];
  if (d.amphibious && game.territories[from].owner !== 'usa') notes.push('Amphibious: max 2 dice.');
  if (game.era === 'defense') notes.push('Defense era: +1 to their best die.');
  if (game.era === 'offense' || game.blitz) notes.push('You win ties.');
  const def = game.territories[to].owner;
  if (def && coreOf(to) === def) notes.push('Homeland strike: the Doomsday Clock will move.');
  return <p className="hint">{notes.join(' ')}</p>;
}

function TerritoryCard({ game, t }: { game: GameState; t: number }) {
  const def = TERRITORIES[t];
  const st = game.territories[t];
  const region = REGIONS.find((r) => r.id === def.region)!;
  const core = coreOf(t);
  const cap = capitalOf(t);
  const neighbours = def.adj.map((u) => TERRITORIES[u].name);
  return (
    <section className="card terr-card" style={{ ['--pc' as string]: st.owner ? POWER[st.owner].color : '#56606d' }}>
      <p className="kicker">{region.name}</p>
      <h3 className="terr-name">{def.name}</h3>
      <p>
        {st.owner ? (
          <>
            <PowerDot p={st.owner} /> {POWER[st.owner].name}
          </>
        ) : (
          'Minor state'
        )}{' '}
        · <b>{st.armies}</b> armies
      </p>
      <div className="pw-tags">
        {cap && <span className="tag">Capital of {POWER[cap].short}</span>}
        {core && !cap && <span className="tag">{POWER[core].short} homeland</span>}
      </div>
      <p className="hint">
        Borders: {neighbours.join(', ')}
      </p>
    </section>
  );
}

function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="modal">{children}</div>
    </div>
  );
}

