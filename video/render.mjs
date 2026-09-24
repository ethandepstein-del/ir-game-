// Render the film frame by frame in headless Chromium and encode it with ffmpeg.
//
//   node render.mjs                     full film → build/anarchy.mp4
//   node render.mjs --stills 5,40,90    single frames → build/stills/*.jpg
//   node render.mjs --from 30 --to 40   a section only (for previews)
//   node render.mjs --workers 3 --fps 24
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = dirname(fileURLToPath(import.meta.url));
const BUILD = join(ROOT, 'build');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
const FPS = Number(args.fps ?? 24);
const WORKERS = Number(args.workers ?? 3);

const CHROME = process.env.CHROME ?? ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(existsSync);
const FFMPEG = process.env.FFMPEG ?? (() => {
  try { return execFileSync('python3', ['-c', 'import imageio_ffmpeg as i; print(i.get_ffmpeg_exe())']).toString().trim(); }
  catch { return 'ffmpeg'; }
})();

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2' };
function serve() {
  const server = createServer(async (req, res) => {
    const path = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!path.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(path);
      res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

async function openPage(port) {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--font-render-hinting=none'],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.goto(`http://127.0.0.1:${port}/scene.html`);
  const ok = await page.evaluate(() => window.ready);
  if (!ok) throw new Error(await page.evaluate(() => window.initError));
  return { browser, page };
}

const frame = (page, t, type = 'jpeg') =>
  page.evaluate((t) => window.seek(t), t).then(() => page.screenshot({ type, quality: type === 'jpeg' ? 94 : undefined, clip: { x: 0, y: 0, width: 1920, height: 1080 } }));

async function stills(port, times) {
  await mkdir(join(BUILD, 'stills'), { recursive: true });
  const { browser, page } = await openPage(port);
  for (const t of times) {
    const t0 = Date.now();
    await writeFile(join(BUILD, 'stills', `${String(t).padStart(6, '0')}.jpg`), await frame(page, t));
    console.log(`still ${t}s (${Date.now() - t0} ms)`);
  }
  await browser.close();
}

async function segment(port, index, first, last, out) {
  const { browser, page } = await openPage(port);
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-tune', 'grain', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((ok, fail) => ff.on('close', (c) => (c ? fail(new Error(`ffmpeg ${c}`)) : ok())));
  const t0 = Date.now();
  for (let f = first; f < last; f++) {
    const img = await frame(page, f / FPS);
    if (!ff.stdin.write(img)) await new Promise((ok) => ff.stdin.once('drain', ok));
    if ((f - first) % 48 === 0) {
      const rate = (f - first + 1) / ((Date.now() - t0) / 1000);
      console.log(`worker ${index}: frame ${f - first + 1}/${last - first} (${rate.toFixed(2)} fps)`);
    }
  }
  ff.stdin.end();
  await done;
  await browser.close();
}

async function main() {
  const server = await serve();
  const port = server.address().port;
  try {
    if (args.stills) {
      await stills(port, String(args.stills).split(',').map(Number));
      return;
    }
    const timeline = JSON.parse(await readFile(join(BUILD, 'timeline.json'), 'utf8'));
    const from = Number(args.from ?? 0), to = Number(args.to ?? timeline.duration);
    const first = Math.round(from * FPS), last = Math.round(to * FPS);
    const per = Math.ceil((last - first) / WORKERS);
    const segDir = join(BUILD, 'segments');
    await rm(segDir, { recursive: true, force: true });
    await mkdir(segDir, { recursive: true });
    const parts = [];
    for (let w = 0; w < WORKERS; w++) {
      const a = first + w * per, b = Math.min(last, a + per);
      if (a < b) parts.push({ w, a, b, out: join(segDir, `part${w}.mp4`) });
    }
    console.log(`rendering ${last - first} frames at ${FPS} fps with ${parts.length} workers`);
    await Promise.all(parts.map((p) => segment(port, p.w, p.a, p.b, p.out)));

    await writeFile(join(segDir, 'list.txt'), parts.map((p) => `file '${p.out}'`).join('\n'));
    const out = join(BUILD, args.out ?? (args.from || args.to ? 'preview.mp4' : 'anarchy.mp4'));
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(segDir, 'list.txt'),
      '-ss', String(from), '-t', String(to - from), '-i', join(BUILD, 'mix.wav'),
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
    console.log(`wrote ${out}`);
  } finally {
    server.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
