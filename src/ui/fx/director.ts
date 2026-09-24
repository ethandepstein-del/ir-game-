import { CARDS } from '../../data/cards';
import { POWER, T, TERRITORIES, type PowerId } from '../../data/world';
import type { CardId, Era, FxEvent } from '../../engine/types';
import { sfx } from '../audio/sfx';
import { GEO, MAP_W } from '../geometry';
import type { FxEngine } from './particles';

export type RollEvent = Extract<FxEvent, { t: 'roll' }>;

export interface BannerSpec {
  title: string;
  sub?: string;
  tone: 'alert' | 'info' | 'good';
  color?: string;
}

export interface Stage {
  fx: FxEngine;
  dice: (rolls: RollEvent[]) => void;
  banner: (b: BannerSpec) => void;
  turn: (power: PowerId, round: number, mine: boolean) => void;
  shake: (level: 1 | 2 | 3) => void;
  flash: () => void;
  card: (card: CardId, power: PowerId) => void;
}

export interface DirectOpts {
  player: PowerId;
  /** 'full' animates everything; 'brief' skips per-roll detail; 'silent' only major beats. */
  detail: 'full' | 'brief' | 'silent';
}

const pos = (t: number) => GEO.labels[t];
const panOf = (t: number) => ((GEO.labels[t][0] / MAP_W) * 2 - 1) * 0.7;

const ERA_TITLE: Record<Era, [string, string]> = {
  balanced: ['Balanced Era', 'Standard combat. Ties go to the defender.'],
  defense: ['Age of the Machine Gun', 'Defense dominant. Defenders add +1 to their best die.'],
  offense: ['Age of Maneuver', 'Offense dominant. Attackers win ties.'],
};

const WORLD_TITLE = {
  financial: ['Global Financial Crisis', 'Every power gets 2 fewer armies next turn.'],
  oil: ['Oil Shock', 'Every oil field pays +2 armies next turn.'],
  pandemic: ['Pandemic', 'Every power loses 6 legitimacy.'],
  grain: ['Global Food Crisis', 'Breadbaskets gain legitimacy; importers riot.'],
  nationalism: ['Nationalist Awakening', 'Every minor state gains +1 army.'],
  talks: ['Arms Talks Succeed', 'The Doomsday Clock moves back a minute.'],
} as const;

/** Stamp a wax seal halfway between two powers' capitals (or on the first, if the map wraps). */
function sealBetween(fx: FxEngine, a: PowerId, b: PowerId, label: string, color: string, delay: number) {
  const [x1, y1] = pos(T(POWER[a].capital));
  const [x2, y2] = pos(T(POWER[b].capital));
  if (Math.abs(x1 - x2) < MAP_W / 2) fx.seal((x1 + x2) / 2, (y1 + y2) / 2, label, color, delay);
  else fx.seal(x1, y1, label, color, delay);
}

/** Returns how long (ms) the choreography needs before the next action should run. */
export function direct(events: FxEvent[], stage: Stage, opts: DirectOpts): number {
  const { fx } = stage;
  const full = opts.detail === 'full';
  const quiet = opts.detail === 'silent';
  let t = 0; // running timeline in ms
  let span = 0;

  const rolls = events.filter((e): e is RollEvent => e.t === 'roll');
  if (rolls.length && !quiet) {
    stage.dice(rolls);
    const shown = full ? rolls.slice(-3) : rolls.slice(-1);
    const involvesPlayer = rolls[0].attacker === opts.player;
    sfx.dice(panOf(rolls[0].from));
    shown.forEach((r, i) => {
      const base = 380 + i * 330;
      const [x1, y1] = pos(r.from);
      const [x2, y2] = pos(r.to);
      const color = POWER[r.attacker].color;
      if (Math.abs(x1 - x2) < MAP_W / 2) {
        // One cut-paper arrow per roll; the burst on arrival grows with the defender's losses.
        fx.muzzle(x1, y1, color, base);
        fx.projectile(x1, y1, x2, y2, color, base, 330, r.dLoss > 0 ? () => fx.explosion(x2, y2, 0.55 + r.dLoss * 0.3, '#ec8a2f') : () => fx.puff(x2, y2, 0.7));
        if (r.aLoss > 0) {
          fx.projectile(x2, y2, x1, y1, '#f3efe4', base + 170, 300, () => fx.explosion(x1, y1, 0.45 + r.aLoss * 0.25, '#c9483b'));
        }
      } else {
        fx.explosion(x2, y2, 0.8, '#ec8a2f', base + 300);
      }
      setTimeout(() => sfx.cannon(panOf(r.to), involvesPlayer ? 1 : 0.7), base + 360);
      if (r.aLoss > 0) setTimeout(() => sfx.volley(panOf(r.from), 2 + r.aLoss), base + 520);
      span = Math.max(span, base + 700);
    });
    t = span;
  }

  for (const e of events) {
    switch (e.t) {
      case 'deploy': {
        if (quiet) break;
        const [x, y] = pos(e.at);
        fx.drop(x, y, POWER[e.power].color, e.n);
        sfx.deploy(panOf(e.at), e.n >= 5);
        span = Math.max(span, 300);
        break;
      }
      case 'conquer': {
        const at = t + 80;
        const [x, y] = pos(e.at);
        const color = POWER[e.power].color;
        if (!quiet) {
          fx.capture(x, y, color, at);
          fx.text(x, y, TERRITORIES[e.at].name.toUpperCase(), color, at + 100, true);
        }
        setTimeout(() => {
          if (e.power === opts.player) sfx.conquest(panOf(e.at));
          else if (e.loser === opts.player) sfx.lost(panOf(e.at));
          else if (!quiet) sfx.march(panOf(e.at));
        }, at);
        span = Math.max(span, at + 500);
        break;
      }
      case 'move': {
        if (quiet) break;
        const [x1, y1] = pos(e.from);
        const [x2, y2] = pos(e.to);
        fx.stream(x1, y1, x2, y2, POWER[e.power].color, Math.min(10, 3 + e.n), t);
        setTimeout(() => sfx.march(panOf(e.to)), t);
        span = Math.max(span, t + 700);
        break;
      }
      case 'clock': {
        if (e.delta < 0) {
          setTimeout(() => sfx.clockTick(e.minutes), t + 200);
          stage.shake(e.minutes <= 3 ? 2 : 1);
          if (e.minutes <= 3 && e.minutes > 0)
            stage.banner({ title: `${e.minutes} minute${e.minutes === 1 ? '' : 's'} to midnight`, sub: 'One more homeland strike could end the world.', tone: 'alert' });
        } else if (!quiet) {
          sfx.relief();
        }
        break;
      }
      case 'capital': {
        const [x, y] = pos(e.at);
        fx.explosion(x, y, 2, '#ff5b4f', t + 150);
        fx.ring(x, y, 10, 120, '#111111', 1200, 3, t + 150);
        setTimeout(() => sfx.capitalFalls(panOf(e.at)), t + 150);
        stage.shake(2);
        stage.banner({ title: `${POWER[e.power].short} capital falls`, sub: `${TERRITORIES[e.at].name} is occupied.`, tone: 'alert', color: POWER[e.power].color });
        break;
      }
      case 'base': {
        const [x, y] = pos(e.at);
        fx.explosion(x, y, 1.5, '#ec8a2f', t + 150);
        setTimeout(() => sfx.capitalFalls(panOf(e.at)), t + 150);
        stage.shake(2);
        stage.banner({ title: 'Tripwire triggered', sub: `${POWER[e.by].short} overruns ${e.name}. ${POWER[e.power].name} will answer.`, tone: 'alert', color: POWER[e.power].color });
        break;
      }
      case 'chipShock': {
        const [x, y] = pos(e.at);
        fx.explosion(x, y, 1.4, '#6f8fa6', t + 120);
        stage.banner({ title: 'Global chip shock', sub: 'The fabs are wrecked. Every power gets 2 fewer armies next turn.', tone: 'alert' });
        sfx.teletype();
        break;
      }
      case 'eliminated': {
        stage.banner({ title: `${POWER[e.power].name} eliminated`, sub: `Destroyed by ${POWER[e.by].name}.`, tone: 'alert', color: POWER[e.power].color });
        stage.shake(3);
        setTimeout(() => sfx.cannon(0, 2), t + 200);
        break;
      }
      case 'coalition': {
        const mine = e.against === opts.player;
        stage.banner({
          title: mine ? 'The world balances against you' : 'Balancing coalition',
          sub: mine ? 'Every other power now gets +3 armies a turn.' : `The powers close ranks against ${POWER[e.against].name}.`,
          tone: 'alert',
          color: POWER[e.against].color,
        });
        sfx.coalition();
        break;
      }
      case 'coalitionEnd':
        if (!quiet) stage.banner({ title: 'Coalition dissolves', sub: 'The balance of power is restored.', tone: 'info' });
        break;
      case 'bandwagon':
        stage.banner({ title: `${POWER[e.power].short} bandwagons`, sub: `It signs with ${POWER[e.leader].name} rather than resist.`, tone: 'info', color: POWER[e.power].color });
        break;
      case 'transition':
        stage.banner({ title: 'Power transition', sub: `${POWER[e.power].name} is now the strongest power.`, tone: 'info', color: POWER[e.power].color });
        sfx.gong();
        break;
      case 'era': {
        const [title, sub] = ERA_TITLE[e.era];
        stage.banner({ title, sub, tone: 'info' });
        sfx.gong();
        break;
      }
      case 'world': {
        const [title, sub] = WORLD_TITLE[e.kind];
        stage.banner({ title, sub, tone: 'info' });
        sfx.teletype();
        break;
      }
      case 'card': {
        if (e.power === opts.player) stage.card(e.card, e.power);
        else if (!quiet) stage.banner({ title: `${POWER[e.power].short} plays ${CARDS[e.card].name}`, tone: 'info', color: POWER[e.power].color });
        sfx.card();
        if (typeof e.target === 'number') {
          const [x, y] = pos(e.target);
          fx.ring(x, y, 4, 50, '#111111', 900, 2.5, 350);
          fx.ring(x, y, 4, 30, '#c42e2e', 700, 1.5, 500);
        }
        break;
      }
      case 'pact':
        if (e.a === opts.player || e.b === opts.player || !quiet) {
          sealBetween(fx, e.a, e.b, 'PACT', '#2f5d8a', t);
          sfx.pact();
          if (e.a === opts.player || e.b === opts.player)
            stage.banner({ title: 'Pact signed', sub: `${POWER[e.a].name} and ${POWER[e.b].name}: 5 rounds of non-aggression.`, tone: 'good' });
        }
        break;
      case 'alliance':
        sealBetween(fx, e.a, e.b, 'ALLY', '#a8322a', t);
        sfx.pact();
        stage.banner({ title: 'Alliance formed', sub: `${POWER[e.a].name} and ${POWER[e.b].name} pledge mutual defense.`, tone: 'good' });
        break;
      case 'obligation':
        if (e.honored) sfx.pact();
        else sfx.betrayal();
        stage.banner({
          title: e.honored ? 'Alliance honored' : 'Ally abandoned',
          sub: e.honored
            ? `${POWER[e.ally].name} goes to war with ${POWER[e.aggressor].name} for ${POWER[e.victim].name}.`
            : `${POWER[e.ally].name} leaves ${POWER[e.victim].name} to face ${POWER[e.aggressor].name} alone.`,
          tone: e.honored ? 'info' : 'alert',
          color: POWER[e.ally].color,
        });
        break;
      case 'pactBroken':
        sfx.betrayal();
        stage.banner({ title: 'Pact broken', sub: `${POWER[e.a].name} betrays ${POWER[e.b].name}.`, tone: 'alert', color: POWER[e.a].color });
        break;
      case 'pactRejected':
        sfx.rejected();
        break;
      case 'turn': {
        const mine = e.power === opts.player;
        if (mine || !quiet) {
          stage.turn(e.power, e.round, mine);
          sfx.ping(mine);
          span = Math.max(span, mine ? 0 : full ? 900 : 250);
        }
        break;
      }
      case 'end':
        if (e.reason === 'nuclear') {
          stage.flash();
          const ground = rolls.length ? pos(rolls[rolls.length - 1].to) : pos(0);
          fx.nuke(ground[0], ground[1]);
          sfx.nuclear();
        }
        break;
    }
  }
  return span;
}
