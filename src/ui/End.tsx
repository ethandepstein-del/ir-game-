import { CONCEPTS, type ConceptId } from '../data/concepts';
import { POWER, POWERS } from '../data/world';
import { ownedBy, prestige } from '../engine/game';
import type { GameState } from '../engine/types';
import { PowerDot } from './bits';

const REASON: Record<NonNullable<GameState['endReason']>, string> = {
  hegemony: 'Hegemony',
  score: 'The final count',
  nuclear: 'Midnight',
  eliminated: 'Eliminated',
  'last-standing': 'Last power standing',
};

export function End({ game, onAgain, onMenu, onCodex }: { game: GameState; onAgain: () => void; onMenu: () => void; onCodex: (id: ConceptId) => void }) {
  const me = game.player;
  const won = game.winner === me;
  const ranking = POWERS.map((p) => ({ p: p.id, score: prestige(game, p.id), terr: ownedBy(game, p.id).length })).sort((a, b) => b.score - a.score);
  const headline =
    game.endReason === 'nuclear'
      ? 'Nobody wins a nuclear war.'
      : won
        ? `${POWER[me].name} shapes the new world order.`
        : game.endReason === 'eliminated'
          ? `${POWER[me].name} has been wiped from the map.`
          : `${POWER[game.winner!].name} prevails.`;

  return (
    <main className="end">
      <header className={`end-hero ${won ? 'won' : game.endReason === 'nuclear' ? 'nuked' : 'lost'}`}>
        <p className="kicker">{REASON[game.endReason!]} · Round {Math.min(game.round, 20)}</p>
        <h1>{won ? 'Victory' : game.endReason === 'nuclear' ? 'Midnight' : 'Defeat'}</h1>
        <p className="lede">{headline}</p>
      </header>

      <div className="end-grid">
        <section className="card">
          <h3>Final standings</h3>
          <ol className="ranking">
            {ranking.map((r) => (
              <li key={r.p} className={r.p === me ? 'me' : ''}>
                <PowerDot p={r.p} />
                <span>{POWER[r.p].name}</span>
                <span className="num">{r.terr} terr.</span>
                <span className="num">
                  <b>{r.score}</b> prestige
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="card">
          <h3>The balance of power, round by round</h3>
          <ShareChart game={game} />
        </section>

        <section className="card end-concepts">
          <h3>Theory you ran into this game</h3>
          <ul>
            {game.learned.map((id) => (
              <li key={id}>
                <button type="button" className="learned" onClick={() => onCodex(id)}>
                  <b>{CONCEPTS[id].name}</b>
                  <span>{CONCEPTS[id].dispatch}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="row">
        <button type="button" className="btn btn-primary btn-big" onClick={onAgain}>
          Play again as {POWER[me].name}
        </button>
        <button type="button" className="btn" onClick={onMenu}>
          Choose another power
        </button>
      </div>
    </main>
  );
}

function ShareChart({ game }: { game: GameState }) {
  const W = 520;
  const H = 240;
  const pad = { l: 36, r: 44, t: 12, b: 28 };
  const hist = game.history;
  const maxR = Math.max(2, hist[hist.length - 1].round);
  const maxS = Math.max(0.4, ...hist.flatMap((h) => Object.values(h.share)));
  const x = (r: number) => pad.l + ((r - 1) / (maxR - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / maxS) * (H - pad.t - pad.b);
  const ticks = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].filter((t) => t <= maxS + 0.001);
  // Direct labels at line ends, nudged apart so they don't collide.
  const ends = POWERS.map((p) => ({ p: p.id, y: y(hist[hist.length - 1].share[p.id] ?? 0) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 12) ends[i].y = ends[i - 1].y + 12;
  return (
    <figure className="chart">
      <div className="chart-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Each great power's share of world strength by round">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid" />
              <text x={pad.l - 6} y={y(t) + 3.5} textAnchor="end" className="tick">
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}
          <line x1={pad.l} x2={W - pad.r} y1={y(0.33)} y2={y(0.33)} className="threshold" />
          <text x={pad.l + 4} y={y(0.33) - 4} className="tick">
            coalition line
          </text>
          {[1, Math.round(maxR / 2), maxR].map((r) => (
            <text key={r} x={x(r)} y={H - 8} textAnchor="middle" className="tick">
              R{r}
            </text>
          ))}
          {POWERS.map((p) => (
            <polyline
              key={p.id}
              fill="none"
              stroke={p.color}
              strokeWidth={p.id === game.player ? 3 : 2}
              strokeLinejoin="round"
              points={hist.map((h) => `${x(h.round)},${y(h.share[p.id] ?? 0)}`).join(' ')}
            >
              <title>{p.name}</title>
            </polyline>
          ))}
          {ends.map((e) => (
            <text key={e.p} x={W - pad.r + 6} y={e.y + 3.5} className="end-label">
              {POWER[e.p].short}
            </text>
          ))}
        </svg>
      </div>
      <figcaption className="legend">
        {POWERS.map((p) => (
          <span key={p.id}>
            <PowerDot p={p.id} /> {p.short}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
