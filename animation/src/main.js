// Frame compositor: picks the world for a time, renders it (with optional motion-blur
// accumulation), then applies global post. Exposed as window.BT for the renderer and player.
import { W, H, T, worldAt, clamp } from './core.js';
import { makeCanvas, loadFonts } from './fx.js';
import pencil from './worlds/pencil.js';
import cel from './worlds/cel.js';
import paper from './worlds/paper.js';
import pixel from './worlds/pixel.js';
import chrome from './worlds/chrome.js';
import finale from './worlds/finale.js';
import { renderAudio, playAudio, encodeWav } from './audio.js';

const worlds = { pencil, cel, paper, pixel, chrome, finale };

let out, octx, scratch, sctx;

async function init(canvas, { fontBase = 'fonts/' } = {}) {
  out = canvas;
  out.width = W; out.height = H;
  octx = out.getContext('2d');
  scratch = makeCanvas();
  sctx = scratch.getContext('2d');
  await loadFonts(fontBase);
  for (const w of Object.values(worlds)) if (w.init) await w.init();
}

function drawScene(ctx, t) {
  const w = worldAt(t);
  ctx.save();
  worlds[w.id].draw(ctx, t, w);
  ctx.restore();
}

// Motion blur: average N sub-frame renders across the shutter interval, never straddling a cut.
function renderFrame(t, { motionBlur = true } = {}) {
  const w = worldAt(t);
  const mod = worlds[w.id];
  const sh = motionBlur && mod.shutter ? mod.shutter(t) : null;
  if (!sh || sh.samples <= 1) {
    drawScene(octx, t);
  } else {
    const span = (sh.angle / 360) / 60;
    for (let i = 0; i < sh.samples; i++) {
      let ts = t + (i / (sh.samples - 1) - 0.5) * span;
      ts = clamp(ts, w.t0, w.t1 - 1e-4);
      drawScene(sctx, ts);
      octx.save();
      octx.globalAlpha = 1 / (i + 1);
      octx.drawImage(scratch, 0, 0);
      octx.restore();
    }
  }
  if (mod.post) {
    octx.save();
    mod.post(octx, t, out);
    octx.restore();
  }
  globalPost(octx, t);
}

function globalPost(ctx, t) {
  // Soft white pop on each style cut (the cut is hidden inside the impact).
  for (const tc of [T.CEL, T.PAPER, T.PIXEL]) {
    const d = t - tc;
    if (d >= 0 && d < 0.12) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255,255,255,${0.45 * Math.exp(-d / 0.028)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
  if (t > T.END - 0.35) {
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${clamp((t - (T.END - 0.35)) / 0.33) ** 2})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

async function audioWavBase64() {
  const buf = await renderAudio();
  const bytes = encodeWav(buf);
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(bin);
}

window.BT = { init, renderFrame, audioWavBase64, playAudio, W, H, T };
