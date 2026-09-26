// Render the video: every frame is drawn at 30 fps, split across worker processes, encoded in
// segments, then joined and muxed.
//
//   node render.mjs --audio master.wav --features features.json --out kilby_girl.mp4 [--scale 1] [--workers 4] [--smooth]
//
// --smooth prints flat ink tints instead of halftone dots, for copies that must survive low bitrates.
import { spawn } from 'node:child_process';
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

function run(cmd, argv, opts = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, argv, { stdio: ['ignore', 'inherit', 'inherit'], ...opts });
    p.on('close', (c) => (c === 0 ? res() : rej(new Error(`${cmd} exited ${c}`))));
  });
}

async function worker(k0, k1, segPath) {
  const { Painter, Press } = await import('./lib/ink.mjs');
  const { Clock } = await import('./lib/util.mjs');
  const { drawFrame } = await import('./scenes.mjs');
  const clock = new Clock(feat);
  const press = new Press(W, H, scale, { smooth: args.includes('--smooth') }), P = new Painter(W, H);
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-tune', 'animation', '-crf', opt('--crf', '12'), '-pix_fmt', 'yuv420p', segPath], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  const buf = Buffer.alloc(W * H * 3);
  for (let k = k0; k < k1; k++) {
    drawFrame(P, clock, k / FPS, scale);
    press.composite(P, buf);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (process.send && (k - k0) % 30 === 0) process.send({ k, k0, k1 });
  }
  ff.stdin.end();
  await done;
}

async function main() {
  const out = opt('--out', 'kilby_girl.mp4');
  const audio = opt('--audio');
  const nw = +opt('--workers', Math.max(1, os.cpus().length));
  const tmp = fs.mkdtempSync(path.join(path.dirname(path.resolve(out)), '.segs-'));
  const self = fileURLToPath(import.meta.url);
  const t0 = Date.now();
  const progress = new Array(nw).fill(0);
  const jobs = [];
  for (let w = 0; w < nw; w++) {
    const k0 = Math.floor((total * w) / nw), k1 = Math.floor((total * (w + 1)) / nw);
    const seg = path.join(tmp, `seg${w}.mp4`);
    jobs.push(seg);
    const child = spawn(process.execPath, [self, ...args, '--worker', `${k0}:${k1}:${seg}`], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    child.on('message', (m) => {
      progress[w] = m.k - m.k0;
      const d = progress.reduce((a, b) => a + b, 0);
      process.stderr.write(`\r${d}/${total} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s   `);
    });
    jobs[w] = [seg, new Promise((res, rej) => child.on('close', (c) => (c === 0 ? res() : rej(new Error('worker ' + w)))))];
  }
  await Promise.all(jobs.map((j) => j[1]));
  process.stderr.write(`\nrendered in ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, jobs.map(([s]) => `file '${s}'`).join('\n'));
  const mux = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
  if (audio) mux.push('-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '320k', '-shortest');
  mux.push('-c:v', 'copy', '-movflags', '+faststart', out);
  await run(FFMPEG, mux);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('wrote', out);
}

const wk = opt('--worker');
if (wk) {
  const [a, b, seg] = wk.split(':');
  worker(+a, +b, seg).catch((e) => { console.error(e); process.exit(1); });
} else main().catch((e) => { console.error(e); process.exit(1); });
