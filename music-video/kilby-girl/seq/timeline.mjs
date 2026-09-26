// The timeline: every sequence's shots in song order, transitions between them, and the
// per-frame print treatment (misregistration jolts, downbeat punch, flashes, fades).
//
// A shot entry is [start, end, shot(P, S, opts), opts?, transitionIn?]. transitionIn is
// { kind: 'whip'|'tear'|'iris'|'slam'|'wipe', dur, pre?, ...kind options } and blends from the
// previous shot; `pre` is how much of `dur` happens before the cut (whips default to half).
import { TRANSITIONS } from '../lib/fx.mjs';
import { rect } from '../lib/shapes.mjs';
import { clamp, hs, inv } from '../lib/util.mjs';
import { H, K, W } from '../lib/world.mjs';
import { loadSong, makeS } from './common.mjs';
import { T } from './songmap.mjs';
import * as intro from './intro.mjs';
import * as verse1 from './verse1.mjs';
import * as hook1 from './hook1.mjs';
import * as break1 from './break1.mjs';
import * as verse2 from './verse2.mjs';
import * as hook2 from './hook2.mjs';
import * as bridge from './bridge.mjs';
import * as finale from './finale.mjs';
import * as outro from './outro.mjs';

const SEQS = [intro, verse1, hook1, break1, verse2, hook2, bridge, finale, outro];
export const SHOTS = SEQS.flatMap((m) => m.SHOTS).sort((a, b) => a[0] - b[0]);
const FLASHES = SEQS.flatMap((m) => m.FLASHES ?? []);
// sequences may export NO_PUNCH = [[t0, t1], ...]: ranges where the global downbeat punch is off
const NO_PUNCH = SEQS.flatMap((m) => m.NO_PUNCH ?? []);

function flashAt(t) {
  let f = 0;
  for (const e of FLASHES) {
    const d = t - e;
    if (d >= -1 / 120 && d < 0.6) f = Math.max(f, d < 1 / 15 ? 0.92 : 0.92 * Math.exp(-(d - 1 / 15) / 0.09));
  }
  return f;
}

function shotIndex(t) {
  let i = SHOTS.findIndex(([a, b]) => t >= a && t < b);
  return i < 0 ? SHOTS.length - 1 : i;
}

function drawShot(P, t, i) {
  const [t0, t1, fn, o] = SHOTS[i];
  const S = makeS(t);
  S.t0 = t0; S.t1 = t1; S.lt = t - t0;
  fn(P, S, o || {});
}

// which transition (if any) is active at t: [u, kind, opts, fromIndex, toIndex]
function activeTransition(t, i) {
  const check = (to) => {
    const tr = SHOTS[to]?.[4];
    if (!tr || to <= 0) return null;
    const pre = tr.pre ?? (tr.kind === 'whip' ? tr.dur / 2 : 0);
    const a = SHOTS[to][0] - pre;
    if (t >= a && t < a + tr.dur) return [(t - a) / tr.dur, tr, to - 1, to];
    return null;
  };
  return check(i) || check(i + 1);
}

export function drawFrame(P, clock, t, scale = 1) {
  loadSong(clock);
  const i = shotIndex(t);
  const S = makeS(t);
  // misregistration: a base offset, kicked around by hits in the loud sections
  const sn = clock.last('snares', t).i, ac = clock.last('accents', t).i;
  const jolt = S.E * (S.snare * 1.2 + S.acc * 5);
  const reg = [[0, 0], [1.5, -1], [-1.5, 1]].map(([x, y], k) => [
    Math.round((x + hs(sn, ac, k, 1) * jolt) * scale),
    Math.round((y + hs(sn, ac, k, 2) * jolt) * scale),
  ]);
  P.begin(reg);
  P.save();
  P.scale(scale);
  // camera punch on every downbeat in the loud sections
  const punchOn = !NO_PUNCH.some(([a, b]) => t >= a && t < b);
  const punch = 1 + (punchOn ? 0.022 * S.E * clock.pulse('downbeats', t, 0.22) : 0);
  P.translate(W / 2, H / 2);
  P.scale(punch);
  P.translate(-W / 2, -H / 2);
  const tr = activeTransition(t, i);
  if (tr) {
    const [u, spec, from, to] = tr;
    TRANSITIONS[spec.kind](P, clamp(u), () => drawShot(P, t, from), () => drawShot(P, t, to), spec);
  } else drawShot(P, t, i);
  const fade = Math.max(1 - clamp(t / 0.8), inv(T.end - 2.2, T.end - 0.2, t), flashAt(t));
  if (fade > 0) P.alpha(fade).fill(rect(-200, -200, W + 400, H + 400), K.paper).alpha(1);
  P.restore();
}

export { T };
