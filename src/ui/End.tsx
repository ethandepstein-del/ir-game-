import { useEffect, useRef, type CSSProperties } from 'react';
import { CONCEPTS, type ConceptId } from '../data/concepts';
import { DOCTRINES } from '../data/doctrines';
import { POWER, POWERS } from '../data/world';
import { ownedBy, prestige } from '../engine/game';
import type { GameState } from '../engine/types';
import { sfx } from './audio/sfx';
import { PowerDot } from './bits';

/** Falling hex confetti for a win, drifting ash for a loss. */
function Weather({ mode, color }: { mode: 'won' | 'lost' | 'nuked'; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = c.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    let w = 0;
    let h = 0;
    const size = () => {
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const palette = mode === 'won' ? [color, '#ffffff', '#ffd76a'] : mode === 'nuked' ? ['#b9b3a8', '#8a847a', '#d8cfc0'] : ['#6d7684', '#9aa3ae'];
    const n = mode === 'won' ? 140 : 90;
    const parts = Array.from({ length: n }, () => ({
      x: Math.random() * w,
      y: Math.random() * -h,
      vy: mode === 'won' ? 60 + Math.random() * 90 : 12 + Math.random() * 20,
      vx: (Math.random() - 0.5) * (mode === 'won' ? 60 : 16),
      r: mode === 'won' ? 3 + Math.random() * 4 : 1 + Math.random() * 2.2,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 6,
      c: palette[Math.floor(Math.random() * palette.length)],
      a: 0.5 + Math.random() * 0.5,
    }));
    let last = performance.now();
    let raf = 0;
    const started = last;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      const fade = mode === 'won' ? Math.max(0, 1 - (now - started - 6000) / 3000) : 1;
      for (const p of parts) {
        p.y += p.vy * dt;
        p.x += p.vx * dt + Math.sin(now / 900 + p.rot) * 0.3;
        p.rot += p.vr * dt;
        if (p.y > h + 10) {
          if (mode === 'won' && now - started > 5000) continue;
          p.y = -10;
          p.x = Math.random() * w;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.a * fade;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k;
          if (k === 0) ctx.moveTo(Math.cos(a) * p.r, Math.sin(a) * p.r);
          else ctx.lineTo(Math.cos(a) * p.r, Math.sin(a) * p.r);
        }
        ctx.fill();
        ctx.restore();
      }
      if (fade > 0) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', size);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
    };
  }, [mode, color]);
  return <canvas ref={ref} className="weather" aria-hidden="true" />;
}

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

  const mode = won ? 'won' : game.endReason === 'nuclear' ? 'nuked' : 'lost';
  useEffect(() => {
    sfx.unlock();
    const id = setTimeout(() => (mode === 'won' ? sfx.victory() : mode === 'lost' ? sfx.defeat() : sfx.defeat()), 250);
    return () => clearTimeout(id);
  }, [mode]);

  return (
    <main className={`end end-${mode}`} style={{ '--me': POWER[me].color } as CSSProperties}>
      <Weather mode={mode} color={POWER[me].color} />
      <header className={`end-hero ${mode}`}>
        <p className="kicker">{REASON[game.endReason!]} · Round {Math.min(game.round, 20)}</p>
        <h1>{won ? 'Victory' : game.endReason === 'nuclear' ? 'Midnight' : 'Defeat'}</h1>
        <p className="lede">{headline}</p>
      </header>

      <div className="end-grid">
        <section className="card">
          <h3>Final standings</h3>
          <ol className="ranking">
            {ranking.map((r, i) => (
              <li key={r.p} className={`rise ${r.p === me ? 'me' : ''}`} style={{ '--d': `${400 + i * 110}ms` } as CSSProperties}>
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
          <h3>The rivals, unmasked</h3>
          <ul className="reveal">
            {POWERS.filter((p) => p.id !== me).map((p) => {
              const ps = game.powers[p.id];
              const d = DOCTRINES[ps.doctrine];
              const guess = game.guesses[p.id];
              return (
                <li key={p.id}>
                  <button type="button" className="learned" onClick={() => onCodex(d.concept)}>
                    <b>
                      <PowerDot p={p.id} /> {p.name}: {d.name}
                    </b>
                    <span>
                      {guess ? (guess === ps.doctrine ? '✓ You read them correctly.' : `✗ You guessed ${DOCTRINES[guess].name}.`) : 'You made no guess.'} {d.summary}
                    </span>
                    <span>
                      Record: {ps.stats.gpAttacks} attacks on great powers · {ps.stats.pacts} agreements · {ps.stats.betrayals} betrayals · honored allies{' '}
                      {ps.stats.honored}×, abandoned {ps.stats.abandoned}×
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
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
        <button type="button" className="btn primary huge" onClick={onAgain}>
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
              pathLength={1}
              className="draw-line"
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
