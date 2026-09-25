// Offline renderer: drives the page in headless Chromium, captures every frame at 60fps,
// renders the synthesized soundtrack, and muxes both with ffmpeg.
//
//   node render.mjs video [--workers 3] [--from 0] [--to 900] [--out out/ball-test.mp4]
//   node render.mjs stills 0.5,1.25,2.0 [--out .stills] [--nomb]
//   node render.mjs audio [--out out/ball-test.wav]
//   node render.mjs encode        (re-encode existing .frames + out/ball-test.wav)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FPS = Number(process.env.FPS || 120), DURATION = 15, FRAMES = FPS * DURATION;
const args = process.argv.slice(2);
const mode = args[0] || 'video';
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes('--' + name);

function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try {
    return execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
  } catch { return 'ffmpeg'; }
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, () => resolve(srv));
  });
}

async function openPage(port) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://localhost:${port}/index.html?render`);
  await page.waitForFunction(() => window.BT && window.BT.ready, null, { timeout: 120000 });
  return { browser, page };
}

async function capture(page, t, motionBlur = true) {
  const b64 = await page.evaluate(([t, mb, fps]) => {
    window.BT.renderFrame(t, { motionBlur: mb, fps });
    return document.getElementById('c').toDataURL('image/png').split(',')[1];
  }, [t, motionBlur, FPS]);
  return Buffer.from(b64, 'base64');
}

async function renderAudioFile(page, file) {
  const b64 = await page.evaluate(() => window.BT.audioWavBase64());
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  return file;
}

const srv = await serve();
const port = srv.address().port;

if (mode === 'stills') {
  const times = (args[1] || '0.5').split(',').map(Number);
  const dir = path.resolve(ROOT, opt('out', '.stills'));
  fs.mkdirSync(dir, { recursive: true });
  const { browser, page } = await openPage(port);
  for (const t of times) {
    const t0 = Date.now();
    const png = await capture(page, t, !flag('nomb'));
    const f = path.join(dir, `t${t.toFixed(3)}.png`);
    fs.writeFileSync(f, png);
    console.log(f, `${Date.now() - t0}ms`);
  }
  await browser.close();
} else if (mode === 'audio') {
  const { browser, page } = await openPage(port);
  console.log(await renderAudioFile(page, path.resolve(ROOT, opt('out', 'out/ball-test.wav'))));
  await browser.close();
} else if (mode === 'video') {
  const workers = Number(opt('workers', 3));
  const from = Number(opt('from', 0)), to = Number(opt('to', FRAMES));
  const frameDir = path.resolve(ROOT, '.frames');
  fs.mkdirSync(frameDir, { recursive: true });
  const outFile = path.resolve(ROOT, opt('out', 'out/ball-test.mp4'));
  const todo = [];
  for (let f = from; f < to; f++) {
    const file = path.join(frameDir, `f${String(f).padStart(4, '0')}.png`);
    if (!flag('resume') || !fs.existsSync(file)) todo.push(f);
  }
  console.log(`rendering ${todo.length} frames with ${workers} workers`);
  const started = Date.now();
  let done = 0;
  const pages = await Promise.all(Array.from({ length: workers }, () => openPage(port)));
  await Promise.all(pages.map(async ({ page }, wi) => {
    for (let i = wi; i < todo.length; i += workers) {
      const f = todo[i];
      const png = await capture(page, f / FPS, true);
      fs.writeFileSync(path.join(frameDir, `f${String(f).padStart(4, '0')}.png`), png);
      if (++done % 30 === 0) {
        const el = (Date.now() - started) / 1000;
        console.log(`${done}/${todo.length} frames, ${el.toFixed(0)}s elapsed, ~${(el / done * (todo.length - done)).toFixed(0)}s left`);
      }
    }
  }));
  const wav = await renderAudioFile(pages[0].page, path.resolve(ROOT, 'out/ball-test.wav'));
  await Promise.all(pages.map(({ browser }) => browser.close()));
  if (!flag('noencode') && from === 0 && to === FRAMES) await encodeAll(wav, started);
}

// 120 fps master, plus a 60 fps version made by blending each pair of frames (a 360° shutter).
async function encodeAll(wav, started = Date.now()) {
  const ff = findFfmpeg();
  const frameDir = path.resolve(ROOT, '.frames');
  const outs = [
    { file: path.resolve(ROOT, 'out/ball-test-120fps.mp4'), vf: null, crf: '16' },
    // Pairs (2k, 2k+1) blend into 60 fps frame k, so stark single-pair frames stay intact.
    { file: path.resolve(ROOT, 'out/ball-test.mp4'), vf: 'tmix=frames=2,select=mod(n\\,2),setpts=N/(60*TB)', rate: '60', crf: '15' },
  ];
  for (const o of outs) {
    fs.mkdirSync(path.dirname(o.file), { recursive: true });
    const ffArgs = ['-y', '-framerate', String(FPS), '-i', path.join(frameDir, 'f%04d.png'), '-i', wav,
      ...(o.vf ? ['-vf', o.vf] : []), ...(o.rate ? ['-r', o.rate] : []),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', o.crf, '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-tune', 'animation', '-movflags', '+faststart',
      '-c:a', 'aac', '-b:a', '320k', '-shortest', o.file];
    console.log('encoding', o.file);
    await new Promise((res, rej) => {
      const p = spawn(ff, ffArgs, { stdio: ['ignore', 'ignore', 'inherit'] });
      p.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
    });
  }
  console.log('done', `${((Date.now() - started) / 1000).toFixed(0)}s total`);
}
if (mode === 'encode') await encodeAll(path.resolve(ROOT, 'out/ball-test.wav'));
srv.close();
