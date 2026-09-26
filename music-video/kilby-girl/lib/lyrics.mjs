// Lyric typography. Every style reveals words on their sung times (word.t) and treats the word
// being sung as "hot". Words carry {w, t, e} in seconds; lines carry {text, start, end, words}.
import { circle, curve, line, poly, rect, roundRect, star } from './shapes.mjs';
import { backOut, clamp, easeOut, hash, hs, lerp, TAU } from './util.mjs';
import { K } from './world.mjs';

export const appear = (w, t, dur = 0.12) => clamp((t - w.t + 0.02) / dur);
export const hot = (w, t) => t >= w.t - 0.02 && t < (w.e ?? w.t + 0.4);

// line ids in song order, for lyric files written before lines carried their own ids
const LEGACY_IDS = ['v1_1', 'v1_2', 'v1_3', 'v1_4', 'h1_1', 'h1_2', 'h1_3', 'h1_4', 'h1_5', 'h1_6', 'h1_7',
  'v2_1', 'v2_2', 'v2_3', 'v2_4', 'h2_1', 'h2_2', 'h2_3', 'h2_4', 'h2_5', 'h2_6', 'h2_7'];
const NO_LINE = Object.freeze({ id: null, text: '', start: Infinity, end: Infinity, words: Object.freeze([]) });

export class Lyrics {
  constructor(data) {
    this.lines = data?.lines ?? [];
    this.byId = new Map();
    this.lines.forEach((l, i) => {
      const id = l.id ?? LEGACY_IDS[i];
      if (id) this.byId.set(id, l);
    });
  }
  // a line by id ('h1_2'); a missing line is empty, so scenes never need to check
  line(id) {
    return this.byId.get(id) ?? NO_LINE;
  }
  // the words of several lines by id, in order
  wordsOf(...ids) {
    return ids.flatMap((id) => this.line(id).words);
  }
  // every line whose id starts with a prefix ('fin_'), in song order
  section(prefix) {
    return this.lines.filter((l, i) => (l.id ?? LEGACY_IDS[i] ?? '').startsWith(prefix));
  }
  // words of lines [a, b] as one flat list
  words(a, b = a) {
    return this.lines.slice(a, b + 1).flatMap((l) => l.words);
  }
  // split a run of words into chunks that each start at or after the given times
  chunk(words, starts) {
    return starts.map((s, i) => words.filter((w) => w.t >= s - 0.05 && (i + 1 >= starts.length || w.t < starts[i + 1] - 0.05)));
  }
}

const upper = (s) => s.toUpperCase();

// measure a word list with spaces
function layoutWords(P, words, font, maxW, spaceK = 0.28, size = 100, lineH = 1.05) {
  const rows = [[]];
  let x = 0;
  const space = size * spaceK;
  for (const w of words) {
    const ww = P.measure(w.text ?? w.w, font);
    if (x > 0 && x + ww > maxW) {
      rows.push([]);
      x = 0;
    }
    rows[rows.length - 1].push({ w, x, width: ww });
    x += ww + space;
  }
  return rows.map((r) => ({ items: r, width: r.length ? r[r.length - 1].x + r[r.length - 1].width : 0 })).map((r, i) => ({ ...r, y: i * size * lineH }));
}

// ---------------------------------------------------------------- big stamped words (posters, walls)
// each word slams in on its sung time; hot word in `hotInks`
export function stampWords(P, words, t, cx, cy, maxW, size, { font = 'Anton', inks = [0, 1, 0], hotInks = [1, 0, 0], shadow = [0, 0, 1], upperCase = true, align = 'center', lineH = 1.02, rotJitter = 0.04, seed = 1 } = {}) {
  const f = `${size}px ${font}`;
  const ws = words.map((w) => ({ ...w, text: upperCase ? upper(w.w) : w.w }));
  const rows = layoutWords(P, ws, f, maxW, 0.26, size, lineH);
  const H = rows.length * size * lineH;
  rows.forEach((r) => {
    const x0 = align === 'center' ? cx - r.width / 2 : cx;
    for (const it of r.items) {
      const a = appear(it.w, t, 0.1);
      if (a <= 0) continue;
      const k = backOut(a, 2.2);
      const x = x0 + it.x + it.width / 2, y = cy - H / 2 + r.y + size * 0.85;
      P.save();
      P.translate(x, y - size * 0.35);
      P.scale(lerp(1.6, 1, k));
      P.rotate(hs(seed, it.w.t) * rotJitter);
      const ink = hot(it.w, t) ? hotInks : inks;
      if (shadow) P.text(it.w.text, 7, size * 0.35 + 6, f, shadow);
      P.text(it.w.text, 0, size * 0.35, f, ink.map((v) => v ?? 0));
      P.restore();
    }
  });
  return H;
}

// ---------------------------------------------------------------- letters on a curve (wires, circles)
// pathAt(s) -> [x, y, angle] for arc length s; words laid end to end from s0
export function wordsOnPath(P, words, t, pathAt, s0, size, { font = 'Anton', inks = [0, 0, 0], hotInks = [1, 0, 0], card = null, hang = 0, spacing = 0.3, upperCase = true, drop = 60 } = {}) {
  const f = `${size}px ${font}`;
  let s = s0;
  for (const w of words) {
    const text = upperCase ? upper(w.w) : w.w;
    const a = appear(w, t, 0.14);
    for (const ch of text) {
      const cw = P.measure(ch, f);
      if (a > 0) {
        const [x, y, ang] = pathAt(s + cw / 2);
        const k = easeOut(a);
        P.save();
        P.translate(x, y + (1 - k) * -drop);
        P.rotate(ang + (hang ? Math.sin(t * 3 + s * 0.05) * hang : 0));
        if (card) {
          // letter cards clipped to a wire
          P.fill(rect(-cw / 2 - 6, 8, cw + 12, size * 1.05), card);
          P.fill(rect(-3, 0, 6, 16), K.ink);
          P.text(ch, 0, size * 0.98, f, hot(w, t) ? hotInks : inks);
        } else {
          P.text(ch, 0, size * 0.35, f, hot(w, t) ? hotInks : inks);
        }
        P.restore();
      }
      s += cw + (card ? 14 : 2);
    }
    s += size * spacing;
  }
  return s;
}

// ---------------------------------------------------------------- handwriting (photo captions, chalk)
// words written left to right; each word is wiped on over ~0.18 s from its sung time
export function handwrite(P, words, t, x, y, maxW, size, { font = '"Permanent Marker"', inks = K.navy, hotInks = null, lineH = 1.15, align = 'left', upperCase = false } = {}) {
  const f = `${size}px ${font}`;
  const ws = words.map((w) => ({ ...w, text: upperCase ? upper(w.w) : w.w }));
  const rows = layoutWords(P, ws, f, maxW, 0.3, size, lineH);
  for (const r of rows) {
    const x0 = align === 'center' ? x - r.width / 2 : x;
    for (const it of r.items) {
      const a = clamp((t - it.w.t + 0.02) / 0.18);
      if (a <= 0) continue;
      P.save();
      P.clip(rect(x0 + it.x - 4, y + r.y - size, it.width * a + 8, size * 1.5));
      P.text(it.w.text, x0 + it.x, y + r.y, f, hotInks && hot(it.w, t) ? hotInks : inks, { align: 'left' });
      P.restore();
    }
  }
  return rows.length * size * lineH;
}

// ---------------------------------------------------------------- typewriter box (zine captions)
// characters of each word type out across the word's duration; a cursor blinks on the beat
export function typeBox(P, words, t, x, y, w, size, { font = '"Special Elite"', inks = K.ink, box = [1, 0, 0], beatPhase = 0, rot = 0 } = {}) {
  const f = `${size}px ${font}`;
  const rows = [[]];
  let cx = 0;
  const pad = size * 0.5, space = P.measure(' ', f);
  for (const wd of words) {
    const ww = P.measure(wd.w, f);
    if (cx > 0 && cx + ww > w - pad * 2) { rows.push([]); cx = 0; }
    rows[rows.length - 1].push({ wd, x: cx, ww });
    cx += ww + space;
  }
  const h = rows.length * size * 1.25 + pad * 1.4;
  P.save();
  P.translate(x, y);
  P.rotate(rot);
  P.fill(rect(6, 8, w, h), [0, 0.4, 0.6]);
  P.fill(rect(0, 0, w, h), box);
  P.stroke(rect(0, 0, w, h), K.ink, 4);
  let cursor = null;
  rows.forEach((r, ri) => {
    for (const it of r) {
      const dur = Math.max(0.12, Math.min(0.45, ((it.wd.e ?? it.wd.t + 0.3) - it.wd.t) * 0.7));
      const n = Math.floor(clamp((t - it.wd.t + 0.02) / dur) * it.wd.w.length + 1e-6);
      if (n <= 0) continue;
      const s = it.wd.w.slice(0, n);
      const ty = pad + size * 0.95 + ri * size * 1.25;
      P.text(s, pad + it.x, ty, f, inks, { align: 'left' });
      cursor = [pad + it.x + P.measure(s, f) + 3, ty];
    }
  });
  if (cursor && beatPhase < 0.5) P.fill(rect(cursor[0], cursor[1] - size * 0.8, size * 0.45, size * 0.9), K.ink);
  P.restore();
  return h;
}

// ---------------------------------------------------------------- flyer carrying a lyric chunk
export function lyricFlyer(P, words, t, x, y, w, h, rot, seed, { slapAt = null } = {}) {
  if (!words.length) return;
  const t0 = slapAt ?? words[0].t;
  const a = clamp((t - t0 + 0.02) / 0.14);
  if (a <= 0) return;
  const k = backOut(a, 1.8);
  const bgs = [[1, 0.05, 0], [0, 1, 0], [0.05, 0, 0.85], [0, 0, 0]];
  const bg = bgs[seed % bgs.length];
  const fg = bg[2] > 0.5 || (bg[0] === 0 && bg[1] === 0) ? [1, 0.1, 0] : K.ink;
  P.save();
  P.translate(x, y);
  P.rotate(rot * k + (1 - k) * 0.25);
  P.scale(lerp(1.35, 1, k));
  P.fill(rect(-w / 2 + 8, -h / 2 + 10, w, h), [0, 0.35, 0.55]);
  P.fill(rect(-w / 2, -h / 2, w, h), bg);
  for (let i = 0; i < 3; i++) P.fill(star(-w / 2 + 34 + i * 30, -h / 2 + 30, 11, 4.5), fg);
  stampWords(P, words, t, 0, 10, w - 40, Math.min(h / (words.length > 3 ? 3.2 : 2.3), w / 5.2), { inks: fg, hotInks: fg, shadow: null, rotJitter: 0.02, seed });
  P.fill(rect(-w / 2 + 20, h / 2 - 34, w - 40, 5), fg);
  // tape
  P.fill(rect(-34, -h / 2 - 14, 68, 26), [0.25, 0.18, 0.05]);
  P.restore();
}
