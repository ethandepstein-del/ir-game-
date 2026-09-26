// Close-ups of the girl against bokeh, with an optional typewriter caption. Shared by several
// sequences (lead-owned; copy it into your sequence if you need a variant).
import { typeBox } from '../lib/lyrics.mjs';
import { girlBust } from '../lib/people.mjs';
import { clamp, easeInOut } from '../lib/util.mjs';
import { blinkOn, bokeh } from './common.mjs';

export function shotBust(P, S, o) {
  const { t, bf } = S;
  bokeh(P, t, { level: 0.75 + 0.25 * S.kick, drift: S.barPos * 0.4 });
  const sway = Math.sin((S.barPos * Math.PI) / 2);
  const s = o.s || 1.05, cy = o.cy || 560;
  const camera = o.camera ? easeInOut(clamp((t - o.camera[0]) / (o.camera[1] - o.camera[0]))) : 0;
  P.save();
  P.translate(960 + sway * 10, cy);
  P.rotate(sway * 0.03);
  girlBust(P, 0, 0, s, { t, bf, sway, blink: o.happy ? 0 : blinkOn(S, 1), lookY: o.lookY ?? -0.4, lookX: o.lookX ?? 0, happy: o.happy ? 1 : 0, smile: o.smile ?? 0.6, camera });
  P.restore();
  const words = o.captionWords ? o.captionWords() : null;
  if (words && words.length) typeBox(P, words, t, 120, 880, 1000, 46, { beatPhase: S.bp % 1, rot: -0.01 });
}
