import { useEffect, useMemo, useRef, useState } from 'react';
import { getScenario } from '../data/scenarios';
import { act, DANGER_LINE, MAX_RED_LINES, previewDeal, resolveEvent } from '../engine/game';
import { yourValue } from '../engine/math';
import type { Action, GameState } from '../engine/types';
import { ConceptChip, Pips, Seal } from './bits';

interface Props {
  game: GameState;
  setGame: (g: GameState) => void;
  onFinish: (g: GameState) => void;
  onQuit: () => void;
}

type Mode = 'normal' | 'redline' | 'walkout';

export function Table({ game, setGame, onFinish, onQuit }: Props) {
  const sc = getScenario(game.scenarioId);
  const [draft, setDraft] = useState<number[]>(() => game.opp.standingOffer.map((v) => Math.min(100, v + 25)));
  const [mode, setMode] = useState<Mode>('normal');
  const logRef = useRef<HTMLOListElement>(null);
  const over = game.status !== 'playing';

  const preview = useMemo(() => previewDeal(game, draft), [game, draft]);
  const theirsPreview = useMemo(() => previewDeal(game, game.opp.standingOffer), [game]);
  const lastMediator = [...game.offers].reverse().find((o) => o.from === 'mediator');

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [game.log.length]);

  const play = (a: Action) => {
    const next = act(game, a);
    setMode('normal');
    setGame(next);
    if (a.kind === 'mediator') {
      const med = [...next.offers].reverse().find((o) => o.from === 'mediator');
      if (med) setDraft(med.values);
    }
  };

  const setIssue = (i: number, v: number) => setDraft((d) => d.map((x, k) => (k === i ? v : x)));

  const verdict = preview.brokenRedLines.length
    ? { tone: 'bad', text: 'Crosses your own red line' }
    : preview.passes
      ? { tone: 'good', text: 'Would pass ratification' }
      : { tone: 'warn', text: 'Would fail ratification' };

  return (
    <main className="page table-page">
      <header className="table-bar">
        <div className="table-bar-title">
          <button type="button" className="link-back" onClick={onQuit}>
            ← Leave
          </button>
          <h1>{sc.title}</h1>
        </div>
        <div className="clock" aria-label={`Round ${Math.min(game.round, sc.rounds)} of ${sc.rounds}`}>
          <span className="clock-label">Round</span>
          <span className="clock-num">
            {Math.min(game.round, sc.rounds)}
            <small>/{sc.rounds}</small>
          </span>
          <span className="clock-pips">
            {Array.from({ length: sc.rounds }, (_, i) => (
              <i key={i} className={i + 1 < game.round ? 'past' : i + 1 === game.round ? 'now' : ''} />
            ))}
          </span>
        </div>
      </header>

      <div className="table-grid">
        {/* Across the table */}
        <section className="panel across" aria-labelledby="across-h">
          <div className="leader">
            <Seal name={sc.them.country} tone="steel" />
            <div>
              <p className="eyebrow">Across the table</p>
              <h2 id="across-h">{sc.them.leader}</h2>
              <p className="fine">{sc.them.title}</p>
            </div>
          </div>
          <ol className="cable" ref={logRef} aria-live="polite">
            {game.log.map((e, i) => {
              const newRound = i === 0 || game.log[i - 1].round !== e.round;
              return (
                <li key={i} className={`cable-${e.speaker}`}>
                  {newRound && <span className="cable-round">Round {e.round}</span>}
                  <span className="cable-who">{e.speaker === 'them' ? sc.them.country : e.speaker === 'you' ? 'You' : e.speaker === 'event' ? 'Event' : 'Desk'}</span>
                  <span className="cable-text">{e.text}</span>
                  {e.concepts && (
                    <span className="cable-tags">
                      {e.concepts.map((c) => (
                        <ConceptChip key={c} id={c} />
                      ))}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        {/* The proposal board */}
        <section className="panel board" aria-labelledby="board-h">
          <div className="board-head">
            <h2 id="board-h">Your package</h2>
            <div className="board-tools">
              <button type="button" className="btn btn-small" onClick={() => setDraft([...game.opp.standingOffer])} disabled={over}>
                Load their offer
              </button>
              {lastMediator && (
                <button type="button" className="btn btn-small" onClick={() => setDraft([...lastMediator.values])} disabled={over}>
                  Load mediator's plan
                </button>
              )}
            </div>
          </div>
          <div className="legend">
            <span>
              <i className="mk mk-them" /> Their standing offer
            </span>
            <span>
              <i className="mk mk-red" /> Your red line
            </span>
            <span className="legend-pips">
              Priority: <b className="t-brass">yours</b> / <b className="t-steel">theirs</b>
            </span>
          </div>

          <ul className="issues">
            {sc.issues.map((iss, i) => {
              const red = game.redLines.find((r) => r.issue === i);
              const theirs = game.opp.standingOffer[i];
              const broken = preview.brokenRedLines.includes(i);
              return (
                <li key={iss.id} className={`issue ${broken ? 'issue-broken' : ''}`}>
                  <div className="issue-top">
                    <label htmlFor={`issue-${iss.id}`} className="issue-name">
                      {iss.name}
                    </label>
                    <span className="issue-prio">
                      <Pips weight={sc.playerWeights[i]} label="Your priority" />
                      <Pips weight={game.revealed[i] ? game.opp.weights[i] : null} tone="steel" label="Their priority" />
                    </span>
                  </div>
                  <div className="slider-wrap">
                    <input
                      id={`issue-${iss.id}`}
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={draft[i]}
                      disabled={over}
                      onChange={(e) => setIssue(i, Number(e.target.value))}
                      style={{ ['--v' as string]: `${draft[i]}%` }}
                      aria-valuetext={iss.format(draft[i])}
                    />
                    <span className="mk mk-them on-track" style={{ left: onTrack(theirs) }} title={`Their offer: ${iss.format(theirs)}`} />
                    {red && <span className="mk mk-red on-track" style={{ left: onTrack(red.min) }} title={`Red line: ${iss.format(red.min)}`} />}
                  </div>
                  <div className="issue-ends">
                    <span>{iss.theirEnd}</span>
                    <output htmlFor={`issue-${iss.id}`} className="issue-value">
                      {iss.format(draft[i])}
                    </output>
                    <span>{iss.yourEnd}</span>
                  </div>
                  {mode === 'redline' && !red && (
                    <button type="button" className="btn btn-small btn-danger redline-pick" onClick={() => play({ kind: 'tieHands', issue: i, min: draft[i] })}>
                      Red line here: no worse than “{iss.format(draft[i])}”
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="deal-meter">
            <div className="deal-meter-row">
              <span className="deal-label">Value to you</span>
              <span className="deal-num">{Math.round(preview.yours * 100)}</span>
              <span className={`verdict verdict-${verdict.tone}`}>{verdict.text}</span>
            </div>
            <div className="meter-track">
              <div className="meter-fill" style={{ width: `${preview.yours * 100}%` }} />
              <div className="meter-line" style={{ left: `${preview.threshold * 100}%` }}>
                <span>Ratification {Math.round(preview.threshold * 100)}</span>
              </div>
            </div>
            <p className="fine">
              Their current offer is worth <b>{Math.round(yourValue(sc.playerWeights, game.opp.standingOffer) * 100)}</b> to you
              {theirsPreview.passes ? ' and would pass at home.' : ' and would not pass at home.'}
            </p>
          </div>
        </section>

        {/* Situation */}
        <section className="panel situation" aria-labelledby="sit-h">
          <h2 id="sit-h" className="section-label">
            Escalation ladder
          </h2>
          <Ladder rungs={sc.ladder} tension={game.tension} />
          <Meter label="Support at home" value={game.support} hint="Higher support lowers the ratification line." />
          <Meter
            label="Trust"
            value={game.trust}
            hint={sc.trustFloor ? `They will not sign below ${sc.trustFloor}.` : 'Makes words credible and deals durable.'}
            floor={sc.trustFloor || undefined}
          />
          {game.redLines.length > 0 && (
            <p className="fine">
              Red lines drawn: {game.redLines.length}/{MAX_RED_LINES}
            </p>
          )}
        </section>
      </div>

      {over ? (
        <section className="panel ending">
          <h2>{endingTitle(game, sc.breakdown.name)}</h2>
          <button type="button" className="btn btn-primary" onClick={() => onFinish(game)}>
            Read the debrief
          </button>
        </section>
      ) : mode === 'walkout' ? (
        <section className="panel ending">
          <h2>Walk out and take no deal?</h2>
          <p>The status quo is worth {Math.round(sc.noDealValue * 100)} to you.</p>
          <div className="row">
            <button type="button" className="btn btn-danger" onClick={() => play({ kind: 'walkout' })}>
              Walk out
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode('normal')}>
              Stay at the table
            </button>
          </div>
        </section>
      ) : (
        <Moves game={game} mode={mode} setMode={setMode} play={play} draft={draft} proposalOk={!preview.brokenRedLines.length} />
      )}

      {game.pendingEvent && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="ev-h">
          <div className="telegram">
            <p className="stamp">Urgent · Round {game.round}</p>
            <h2 id="ev-h">{game.pendingEvent.title}</h2>
            <p>{game.pendingEvent.body}</p>
            <div className="telegram-options">
              {game.pendingEvent.options.map((o, i) => (
                <button key={i} type="button" className="btn option" onClick={() => setGame(resolveEvent(game, i))}>
                  <span>{o.label}</span>
                  <small>{o.detail}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/** Position a marker over the slider thumb's travel range (thumb is 18px wide). */
function onTrack(v: number): string {
  return `calc(9px + (100% - 18px) * ${v / 100})`;
}

function endingTitle(g: GameState, breakdownName: string): string {
  switch (g.status) {
    case 'deal':
      return 'Agreement signed.';
    case 'breakdown':
      return `${breakdownName}.`;
    case 'walkout':
      return 'You walked out.';
    default:
      return 'Time ran out.';
  }
}

interface MoveDef {
  key: string;
  name: string;
  effect: string;
  action?: Action;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'danger';
}

function Moves({
  game,
  mode,
  setMode,
  play,
  draft,
  proposalOk,
}: {
  game: GameState;
  mode: Mode;
  setMode: (m: Mode) => void;
  play: (a: Action) => void;
  draft: number[];
  proposalOk: boolean;
}) {
  const moves: MoveDef[] = [
    { key: 'propose', name: 'Table package', effect: 'Offer your sliders. They accept or counter.', action: { kind: 'propose', values: draft }, tone: 'primary', disabled: !proposalOk },
    { key: 'accept', name: 'Accept their offer', effect: 'Sign their standing terms and send them home for ratification.', action: { kind: 'acceptTheirs' } },
    { key: 'mobilize', name: 'Mobilize', effect: 'Costly signal. Tension +14, support up. Shows resolve.', action: { kind: 'mobilize' } },
    { key: 'warning', name: 'Public warning', effect: 'Cheap talk. Only works if they trust you or your public is behind you.', action: { kind: 'warning' } },
    { key: 'goodwill', name: 'Goodwill gesture', effect: 'Tension −15, trust +12, support −6. Some read it as weakness.', action: { kind: 'goodwill' } },
    { key: 'backchannel', name: 'Back channel', effect: 'Learn one of their priorities. Tension −3.', action: { kind: 'backchannel' } },
    {
      key: 'redline',
      name: mode === 'redline' ? 'Cancel red line' : 'Draw red line',
      effect: `Set a slider, then pick the issue. Support +8. Crossing it later sinks the deal.`,
      onClick: () => setMode(mode === 'redline' ? 'normal' : 'redline'),
      disabled: game.redLines.length >= MAX_RED_LINES,
    },
    { key: 'mediator', name: 'Call mediator', effect: 'Once per game. Proposes a fair package. Tension −10.', action: { kind: 'mediator' }, disabled: game.mediatorUsed },
    { key: 'ultimatum', name: 'Ultimatum', effect: 'Final offer: they accept your sliders or talks collapse. Tension +15.', action: { kind: 'ultimatum', values: draft }, tone: 'danger', disabled: !proposalOk },
    { key: 'walkout', name: 'Walk out', effect: 'End talks and keep the status quo.', onClick: () => setMode('walkout'), tone: 'danger' },
  ];
  return (
    <section className="moves" aria-label="Your move">
      <h2 className="section-label">
        Your move {mode === 'redline' && <span className="hint">Pick an issue above to draw the line at its current setting.</span>}
      </h2>
      <div className="move-grid">
        {moves.map((m) => (
          <button
            key={m.key}
            type="button"
            className={`move ${m.tone ? `move-${m.tone}` : ''} ${m.key === 'redline' && mode === 'redline' ? 'move-active' : ''}`}
            disabled={m.disabled || game.tension >= 100}
            onClick={() => (m.onClick ? m.onClick() : m.action && play(m.action))}
          >
            <span className="move-name">{m.name}</span>
            <span className="move-effect">{m.effect}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Ladder({ rungs, tension }: { rungs: string[]; tension: number }) {
  const step = 100 / (rungs.length - 1);
  const current = Math.min(rungs.length - 1, Math.floor(tension / step));
  return (
    <div className="ladder" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(tension)} aria-label="Tension">
      <div className="ladder-bar">
        <div className={`ladder-fill ${tension > DANGER_LINE ? 'hot' : ''}`} style={{ height: `${tension}%` }} />
        <div className="ladder-danger" style={{ bottom: `${DANGER_LINE}%` }} />
      </div>
      <ol className="ladder-rungs">
        {[...rungs].reverse().map((r, idx) => {
          const i = rungs.length - 1 - idx;
          return (
            <li key={r} className={i === current ? 'now' : i < current ? 'past' : ''}>
              {r}
            </li>
          );
        })}
      </ol>
      <div className="ladder-read">
        <span className="big-num">{Math.round(tension)}</span>
        <span className="fine">{tension > DANGER_LINE ? 'Danger: incidents possible' : `Danger line at ${DANGER_LINE}`}</span>
      </div>
    </div>
  );
}

function Meter({ label, value, hint, floor }: { label: string; value: number; hint: string; floor?: number }) {
  return (
    <div className="meter">
      <div className="meter-head">
        <span>{label}</span>
        <span className="meter-num">{Math.round(value)}</span>
      </div>
      <div className="meter-track small">
        <div className="meter-fill" style={{ width: `${value}%` }} />
        {floor !== undefined && <div className="meter-line" style={{ left: `${floor}%` }} />}
      </div>
      <p className="fine">{hint}</p>
    </div>
  );
}
