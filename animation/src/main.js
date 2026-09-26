// Frame compositor: picks the world for a time, renders it (with optional motion-blur
// accumulation), then applies global post. Exposed as window.BT for the renderer and player.
import { W, H, T, WORLDS, worldAt, clamp, ease, syncTimeline, camFrame, physics, FLOOR } from './core.js';
import { makeCanvas, loadFonts, initPost } from './fx.js';
import pencil from './worlds/pencil.js';
import cel from './worlds/cel.js';
import paper from './worlds/paper.js';
import pixel from './worlds/pixel.js';
import chrome from './worlds/chrome.js';
import finale from './worlds/finale.js';
import { renderAudio, playAudio, encodeWav } from './audio.js';

const worlds = { pencil, cel, paper, pixel, chrome, finale };

let out, octx, scratch, sctx, wipeA, wipeB;
const WIPE = 0.16;
const RIM = { cel: '255,209,102', paper: '255,246,232', pixel: '41,173,255', chrome: '255,196,140' };

async function init(canvas, { fontBase = 'fonts/' } = {}) {
  out = canvas;
  out.width = W; out.height = H;
  octx = out.getContext('2d');
  scratch = makeCanvas();
  sctx = scratch.getContext('2d');
  await loadFonts(fontBase);
  syncTimeline();
  wipeA = scratch; wipeB = makeCanvas();
  initPost();
  for (const w of Object.values(worlds)) if (w.init) await w.init();
}

function drawScene(ctx, t) {
  const w = worldAt(t);
  ctx.save();
  worlds[w.id].draw(ctx, t, w);
  ctx.restore();
}

// The cut in progress, if any: the new world grows out of the contact point.
function wipeAt(t) {
  for (let i = 1; i < 5; i++) {
    const w = WORLDS[i];
    if (t >= w.t0 && t < w.t0 + WIPE) {
      const ev = physics().events.find((e) => e.cut === w.id);
      const cam = camFrame(w.t0);
      const ox = (ev.x - cam.x) * cam.z + W / 2, oy = (FLOOR - cam.y) * cam.z + H / 2;
      return { from: WORLDS[i - 1], to: w, u: (t - w.t0) / WIPE, ox, oy };
    }
  }
  return null;
}

function drawWipe(ctx, t, wp) {
  const a = wipeA.getContext('2d'), b = wipeB.getContext('2d');
  a.save(); worlds[wp.from.id].draw(a, t, wp.from); a.restore();
  b.save(); worlds[wp.to.id].draw(b, t, wp.to); b.restore();
  ctx.drawImage(wipeA, 0, 0);
  const far = Math.hypot(Math.max(wp.ox, W - wp.ox), Math.max(wp.oy, H - wp.oy));
  const r = Math.max(1, ease.outCubic(wp.u) * far * 1.02);
  ctx.save();
  ctx.beginPath(); ctx.arc(wp.ox, wp.oy, r, 0, Math.PI * 2); ctx.clip();
  ctx.drawImage(wipeB, 0, 0);
  ctx.restore();
  // Glowing rim on the expanding edge.
  const col = RIM[wp.to.id] || '255,255,255';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [lw, al] of [[46, 0.18], [18, 0.4], [5, 0.9]]) {
    ctx.strokeStyle = `rgba(${col},${al * (1 - wp.u) ** 0.7})`;
    ctx.lineWidth = lw * (1 - wp.u * 0.5);
    ctx.beginPath(); ctx.arc(wp.ox, wp.oy, r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// Motion blur: average N sub-frame renders across the shutter interval, never straddling a cut.
function renderFrame(t, { motionBlur = true, fps = 60 } = {}) {
  const w = worldAt(t);
  const mod = worlds[w.id];
  const wp = wipeAt(t);
  const sh = motionBlur && mod.shutter ? mod.shutter(t) : null;
  if (wp) {
    drawWipe(octx, t, wp);
  } else if (!sh || sh.samples <= 1) {
    drawScene(octx, t);
  } else {
    const span = (sh.angle / 360) / fps;
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
