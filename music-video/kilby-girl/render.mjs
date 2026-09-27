// Render the video: every frame is drawn, split across worker processes, encoded in segments,
// then joined and muxed.
//
//   node render.mjs --audio master.wav --features features.json --out kilby_girl.mp4
//        [--fps 30|60] [--scale 1] [--workers 4] [--range t0:t1] [--look studio|v3|...] [--smooth]
//        [--crf 12] [--preset medium] [--cache dir [--redo t0:t1]]
//
// --range t0:t1  render only that excerpt (seconds); the audio is cut to match.
// --look         print look from lib/ink.mjs LOOKS (default: the current house look; v3 = old hard dots)
// --smooth       flat ink tints instead of halftone dots, for copies that must survive low bitrates.
// --cache dir    render in fixed 2-second chunks kept in dir, and reuse a chunk when its settings and
//                the source code (every .mjs here + the features file) are unchanged. With a range,
//                the excerpt snaps outward to whole chunks.
// --redo t0:t1   with --cache: re-render the chunks overlapping t0:t1 and reuse every other cached
//                chunk even if the code changed since (for fixing one shot in a long draft).
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const FFMPEG = opt('--ffmpeg', process.env.FFMPEG || 'ffmpeg');
const scale = +opt('--scale', 1);
const W = Math.round(1920 * scale / 2) * 2, H = Math.round(1080 * scale / 2) * 2;
const FPS = +opt('--fps', 30);
const featPath = opt('--features');
const feat = JSON.parse(fs.readFileSync(featPath, 'utf8'));
const total = Math.ceil(feat.duration * FPS);
const look = opt('--look');
const smooth = args.includes('--smooth');
const span = (s) => { const [a, b] = s.split(':').map(Number); return [Math.max(0, a || 0), Math.min(feat.duration, b || feat.duration)]; };
const CHUNK = 2 * FPS;

function run(cmd, argv, opts = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, argv, { stdio: ['ignore', 'inherit', 'inherit'], ...opts });
    p.on('close', (c) => (c === 0 ? res() : rej(new Error(`${cmd} exited ${c}`))));
  });
}

// worker: render a list of [k0, k1, segPath] jobs, one ffmpeg encode per job
async function worker(jobs) {
  const { Painter, Press } = await import('./lib/ink.mjs');
  const { Clock } = await import('./lib/util.mjs');
  const { drawFrame } = await import('./scenes.mjs');
  const clock = new Clock(feat);
  const press = new Press(W, H, scale, { smooth, ...(look ? { look } : {}) }), P = new Painter(W, H);
  const buf = Buffer.alloc(W * H * 3);
  let n = 0, tDraw = 0;
  for (const [k0, k1, segPath, meta] of jobs) {
    const part = segPath + '.part.mp4';
    const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
      '-c:v', 'libx264', '-preset', opt('--preset', 'medium'), '-tune', 'animation', '-crf', opt('--crf', '12'), '-pix_fmt', 'yuv420p', part], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
    for (let k = k0; k < k1; k++) {
      const a = performance.now();
      drawFrame(P, clock, k / FPS, scale);
      press.composite(P, buf);
      tDraw += performance.now() - a;
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if (process.send && ++n % 15 === 0) process.send({ n, ms: tDraw / n });
    }
    ff.stdin.end();
    await done;
    fs.renameSync(part, segPath);
    if (meta) fs.writeFileSync(segPath.replace(/\.mp4$/, '.json'), JSON.stringify(meta));
    if (process.send) process.send({ n, ms: tDraw / n, seg: segPath });
  }
}

// hash of everything that decides what a frame looks like
function sourceHash() {
  const h = crypto.createHash('sha1');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const files = [...fs.readdirSync(here).filter((f) => f.endsWith('.mjs')).map((f) => path.join(here, f)),
    ...fs.readdirSync(path.join(here, 'lib')).filter((f) => f.endsWith('.mjs')).map((f) => path.join(here, 'lib', f))].sort();
  for (const f of files) h.update(f).update(fs.readFileSync(f));
  h.update(fs.readFileSync(featPath));
  return h.digest('hex').slice(0, 16);
}

async function main() {
  const out = opt('--out', 'kilby_girl.mp4');
  const audio = opt('--audio');
  const nw = +opt('--workers', Math.max(1, os.cpus().length));
  const [t0, t1] = opt('--range') ? span(opt('--range')) : [0, feat.duration];
  let k0 = Math.ceil(t0 * FPS - 1e-6), k1 = Math.min(total, Math.ceil(t1 * FPS - 1e-6));
  const self = fileURLToPath(import.meta.url);
  const cacheDir = opt('--cache');
  const tmp = fs.mkdtempSync(path.join(path.dirname(path.resolve(out)), '.segs-'));
  // the list of segments that make the output, and which of them need rendering
  let segs = [], todo = [];
  if (cacheDir) {
    fs.mkdirSync(cacheDir, { recursive: true });
    const src = sourceHash();
    const tag = `${W}x${H}_${FPS}_${smooth ? 'smooth' : look || 'default'}_crf${opt('--crf', '12')}_${opt('--preset', 'medium')}`;
    const redo = opt('--redo') ? span(opt('--redo')) : null;
    k0 = Math.floor(k0 / CHUNK) * CHUNK; k1 = Math.min(total, Math.ceil(k1 / CHUNK) * CHUNK);
    for (let a = k0; a < k1; a += CHUNK) {
      const b = Math.min(total, a + CHUNK);
      const base = path.join(path.resolve(cacheDir), `${tag}_${String(a).padStart(6, '0')}`);
      const seg = base + '.mp4', meta = base + '.json';
      segs.push(seg);
      const have = fs.existsSync(seg) && fs.existsSync(meta);
      const fresh = have && JSON.parse(fs.readFileSync(meta, 'utf8')).src === src;
      const inRedo = redo && a < redo[1] * FPS && b > redo[0] * FPS;
      if (redo ? inRedo || !have : !fresh) todo.push([a, b, seg, { src, a, b, fps: FPS }]);
    }
    console.error(`${segs.length} chunks, ${segs.length - todo.length} reused, ${todo.length} to render`);
  } else {
    for (let w = 0; w < nw; w++) {
      const a = k0 + Math.floor(((k1 - k0) * w) / nw), b = k0 + Math.floor(((k1 - k0) * (w + 1)) / nw);
      if (b <= a) continue;
      const seg = path.join(tmp, `seg${w}.mp4`);
      segs.push(seg); todo.push([a, b, seg]);
    }
  }
  const t0w = Date.now();
  const nTodo = todo.reduce((s, [a, b]) => s + b - a, 0);
  const done = new Array(nw).fill(0), ms = new Array(nw).fill(0);
  const children = [];
  for (let w = 0; w < nw; w++) {
    const mine = todo.filter((_, i) => i % nw === w); // chunks dealt round-robin
    if (!mine.length) continue;
    const jf = path.join(tmp, `jobs${w}.json`);
    fs.writeFileSync(jf, JSON.stringify(mine));
    const child = spawn(process.execPath, [self, ...args, '--worker', jf], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    child.on('message', (m) => {
      done[w] = m.n; ms[w] = m.ms;
      const d = done.reduce((a, b) => a + b, 0), el = (Date.now() - t0w) / 1000;
      process.stderr.write(`\r${d}/${nTodo} frames  ${el.toFixed(0)}s  ${(d / el).toFixed(1)} fps  draw+composite ${ms[w].toFixed(0)} ms/frame   `);
    });
    children.push(new Promise((res, rej) => child.on('close', (c) => (c === 0 ? res() : rej(new Error('worker ' + w))))));
  }
  await Promise.all(children);
  const el = (Date.now() - t0w) / 1000;
  process.stderr.write(`\nrendered ${nTodo} frames in ${el.toFixed(0)}s (${(nTodo / Math.max(el, 1e-3)).toFixed(1)} fps)\n`);
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, segs.map((s) => `file '${s}'`).join('\n'));
  const mux = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
  const a0 = k0 / FPS, dur = (k1 - k0) / FPS;
  if (audio) mux.push('-ss', a0.toFixed(4), '-t', dur.toFixed(4), '-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '320k', '-shortest');
  mux.push('-c:v', 'copy', '-movflags', '+faststart', out);
  await run(FFMPEG, mux);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('wrote', out, `(${a0.toFixed(2)}-${(a0 + dur).toFixed(2)}s, ${FPS} fps)`);
}

const wk = opt('--worker');
if (wk) {
  // legacy form k0:k1:seg is still accepted
  const jobs = fs.existsSync(wk) ? JSON.parse(fs.readFileSync(wk, 'utf8')) : [[+wk.split(':')[0], +wk.split(':')[1], wk.split(':').slice(2).join(':')]];
  worker(jobs).catch((e) => { console.error(e); process.exit(1); });
} else main().catch((e) => { console.error(e); process.exit(1); });
