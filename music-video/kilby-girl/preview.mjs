// Render stills or a contact sheet: node preview.mjs out.png t1 t2 ... [--scale 0.5] [--cols 2] [--look v3] [--smooth]
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { Painter, Press } from './lib/ink.mjs';
import { Clock } from './lib/util.mjs';
import { drawFrame } from './scenes.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const smooth = args.includes('--smooth');
if (smooth) args.splice(args.indexOf('--smooth'), 1);
const look = opt('--look'); // print look from lib/ink.mjs LOOKS, e.g. --look v3 for the old hard dots
const scale = +opt('--scale', 0.5), cols = +opt('--cols', 2), feat = opt('--features', process.env.FEATURES);
const [out, ...times] = args;
const W = Math.round(1920 * scale), H = Math.round(1080 * scale);
const clock = new Clock(JSON.parse(fs.readFileSync(feat, 'utf8')));
const press = new Press(W, H, scale, { smooth, ...(look ? { look } : {}) }), P = new Painter(W, H);
const rows = Math.ceil(times.length / cols);
const sheet = createCanvas(W * Math.min(cols, times.length), H * rows);
const sc = sheet.getContext('2d');
for (const [k, ts] of times.entries()) {
  const t = +ts;
  const t0 = Date.now();
  drawFrame(P, clock, t, scale);
  const rgb = press.composite(P);
  const img = sc.createImageData(W, H);
  for (let i = 0, j = 0; i < W * H; i++, j += 3) {
    img.data[i * 4] = rgb[j]; img.data[i * 4 + 1] = rgb[j + 1]; img.data[i * 4 + 2] = rgb[j + 2]; img.data[i * 4 + 3] = 255;
  }
  sc.putImageData(img, (k % cols) * W, Math.floor(k / cols) * H);
  sc.fillStyle = '#000'; sc.font = `${Math.round(22 * Math.max(scale, 0.5))}px sans-serif`;
  sc.fillText(`${t.toFixed(2)}s`, (k % cols) * W + 8, Math.floor(k / cols) * H + 26);
  process.stderr.write(`${t}s ${Date.now() - t0}ms\n`);
}
fs.writeFileSync(out, await sheet.encode('png'));
