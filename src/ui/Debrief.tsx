import { CONCEPTS, type ConceptId } from '../data/concepts';
import { TYPE_INFO } from '../data/dialogue';
import { getScenario } from '../data/scenarios';
import { debriefConcepts, ratificationThreshold, reservation, result } from '../engine/game';
import { maxYouGivenThem, paretoFrontier, theirValue, yourValue, type FrontierPoint } from '../engine/math';
import type { GameState } from '../engine/types';
import { ConceptChip, Pips } from './bits';

interface Props {
  game: GameState;
  onReplay: () => void;
  onMenu: () => void;
  onConcept: (id: ConceptId) => void;
}

export function Debrief({ game, onReplay, onMenu, onConcept }: Props) {
  const sc = getScenario(game.scenarioId);
  const r = result(game);
  const type = TYPE_INFO[game.opp.type];
  const concepts = debriefConcepts(game);

  return (
    <main className="page debrief-page">
      <header className="verdict-hero">
        <div className={`grade grade-${r.grade}`}>{r.grade}</div>
        <div>
          <p className="eyebrow">{r.headline}</p>
          <h1>{r.title}</h1>
          <p className="score-line">
            Score <b>{r.score}</b>
          </p>
          <ul className="score-lines">
            {r.lines.map((l) => (
              <li key={l.label}>
                <span>{l.label}</span>
                <span className={l.value < 0 ? 't-bad' : ''}>{l.value > 0 && l.label !== r.lines[0].label ? `+${l.value}` : l.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </header>

      <div className="debrief-grid">
        <section className="panel reveal">
          <p className="eyebrow">Who was across the table</p>
          <h2>
            {sc.them.leader} was <span className="t-steel">{type.name}</span>
          </h2>
          <p>{type.summary}</p>
          <p>
            <ConceptChip id={type.model as ConceptId} onClick={onConcept} />
          </p>
          <table className="prio-table">
            <thead>
              <tr>
                <th scope="col">Issue</th>
                <th scope="col">You</th>
                <th scope="col">Them</th>
                {game.finalDeal && <th scope="col">Final deal</th>}
              </tr>
            </thead>
            <tbody>
              {sc.issues.map((iss, i) => (
                <tr key={iss.id}>
                  <th scope="row">{iss.name}</th>
                  <td>
                    <Pips weight={sc.playerWeights[i]} label="Your priority" />
                  </td>
                  <td>
                    <Pips weight={game.opp.weights[i]} tone="steel" label="Their priority" />
                  </td>
                  {game.finalDeal && <td className="fine">{iss.format(game.finalDeal[i])}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="fine">
            Issues where your pips outnumber theirs were cheap for them to give you. That is where logrolling pays.
          </p>
        </section>

        <section className="panel chart-panel">
          <p className="eyebrow">The bargaining space</p>
          <h2>Where the deals were</h2>
          <BargainChart game={game} />
          {r.theirs !== null && (
            <p>
              {r.leftOnTable >= 2 ? (
                <>
                  You left <b>{Math.round(r.leftOnTable)} points</b> on the table. A different package on the frontier would
                  have given you that much more at no cost to them.
                </>
              ) : (
                <>Your deal sits on the Pareto frontier. No other package could have helped you without hurting them.</>
              )}
            </p>
          )}
        </section>

        <section className="panel moments">
          <p className="eyebrow">Turning points</p>
          <h2>What moved the talks</h2>
          {game.moments.length ? (
            <ol className="moment-list">
              {game.moments.map((m, i) => (
                <li key={i} className={`moment moment-${m.tone}`}>
                  <span className="moment-round">R{m.round}</span>
                  <span className="moment-text">{m.text}</span>
                  <ConceptChip id={m.concept} onClick={onConcept} />
                </li>
              ))}
            </ol>
          ) : (
            <p>No turning points recorded.</p>
          )}
        </section>

        <section className="panel learned">
          <p className="eyebrow">Added to your Codex</p>
          <h2>Concepts in play</h2>
          <ul className="learned-list">
            {concepts.map((id) => (
              <li key={id}>
                <button type="button" className="learned-item" onClick={() => onConcept(id)}>
                  <span className="learned-name">{CONCEPTS[id].name}</span>
                  <span className="fine">{CONCEPTS[id].short}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="row debrief-actions">
        <button type="button" className="btn btn-primary" onClick={onReplay}>
          Play again: new leader, same crisis
        </button>
        <button type="button" className="btn btn-ghost" onClick={onMenu}>
          Choose another crisis
        </button>
      </div>
    </main>
  );
}

function themAtYou(frontier: FrontierPoint[], you: number): number {
  for (let k = 1; k < frontier.length; k++) {
    const a = frontier[k - 1];
    const b = frontier[k];
    if (b.you >= you) {
      const t = a.you === b.you ? 0 : (you - a.you) / (b.you - a.you);
      return a.them + t * (b.them - a.them);
    }
  }
  return frontier[frontier.length - 1].them;
}

function BargainChart({ game }: { game: GameState }) {
  const sc = getScenario(game.scenarioId);
  const W = 420;
  const H = 320;
  const pad = { l: 46, r: 16, t: 14, b: 42 };
  const x = (v: number) => pad.l + v * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - v * (H - pad.t - pad.b);

  const frontier = paretoFrontier(sc.playerWeights, game.opp.weights);
  const a = ratificationThreshold(game, sc);
  const b = reservation(game, sc);
  const gB = maxYouGivenThem(frontier, b);
  const zopa: [number, number][] = [];
  if (gB > a) {
    zopa.push([a, b], [a, themAtYou(frontier, a)]);
    for (const p of frontier) if (p.you > a && p.them > b) zopa.push([p.you, p.them]);
    zopa.push([gB, b]);
  }
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const offers = game.offers.map((o) => ({ ...o, u: yourValue(sc.playerWeights, o.values), v: theirValue(game.opp.weights, o.values) }));
  const deal = game.finalDeal ? { u: yourValue(sc.playerWeights, game.finalDeal), v: theirValue(game.opp.weights, game.finalDeal) } : null;

  return (
    <figure className="chart">
      <div className="chart-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bargaining space: your value against their value, with the Pareto frontier, the zone of possible agreement and every offer made.">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={y(0)} y2={y(1)} className="grid" />
              <line x1={x(0)} x2={x(1)} y1={y(t)} y2={y(t)} className="grid" />
              <text x={x(t)} y={y(0) + 16} textAnchor="middle" className="tick">
                {Math.round(t * 100)}
              </text>
              <text x={x(0) - 8} y={y(t) + 4} textAnchor="end" className="tick">
                {Math.round(t * 100)}
              </text>
            </g>
          ))}
          {zopa.length > 2 && <polygon points={zopa.map(([u, v]) => `${x(u)},${y(v)}`).join(' ')} className="zopa" />}
          <polyline points={frontier.map((p) => `${x(p.you)},${y(p.them)}`).join(' ')} className="frontier" />
          <line x1={x(a)} x2={x(a)} y1={y(0)} y2={y(1)} className="res res-you" />
          <line x1={x(0)} x2={x(1)} y1={y(b)} y2={y(b)} className="res res-them" />
          <text x={x(a) + 4} y={y(1) + 10} className="res-label">
            your ratification line
          </text>
          <text x={x(0) + 4} y={y(b) - 6} className="res-label">
            their walk-away point
          </text>
          {offers.map((o, i) => (
            <circle key={i} cx={x(o.u)} cy={y(o.v)} r={4} className={`dot dot-${o.from}`}>
              <title>
                Round {o.round}, {o.from === 'you' ? 'your' : o.from === 'them' ? 'their' : "mediator's"} offer: {Math.round(o.u * 100)} to you, {Math.round(o.v * 100)} to them
              </title>
            </circle>
          ))}
          {deal && (
            <g transform={`translate(${x(deal.u)} ${y(deal.v)})`}>
              <path d="M0,-9 L2.6,-3 L9,-2.8 L4,1.6 L5.6,8 L0,4.4 L-5.6,8 L-4,1.6 L-9,-2.8 L-2.6,-3 Z" className="deal-star" />
            </g>
          )}
          <text x={(x(0) + x(1)) / 2} y={H - 6} textAnchor="middle" className="axis">
            Value to you →
          </text>
          <text transform={`translate(12 ${(y(0) + y(1)) / 2}) rotate(-90)`} textAnchor="middle" className="axis">
            Value to them →
          </text>
        </svg>
      </div>
      <figcaption className="chart-legend">
        <span>
          <i className="sw sw-frontier" /> Pareto frontier
        </span>
        <span>
          <i className="sw sw-zopa" /> ZOPA
        </span>
        <span>
          <i className="sw sw-you" /> Your offers
        </span>
        <span>
          <i className="sw sw-them" /> Their offers
        </span>
        <span>
          <i className="sw sw-mediator" /> Mediator
        </span>
        {deal && (
          <span>
            <i className="sw sw-deal" /> Final deal
          </span>
        )}
      </figcaption>
    </figure>
  );
}
