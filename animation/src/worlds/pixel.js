// World 4: 8-bit. Rendered at 240×135 in a 16-colour palette and scaled up with hard pixels,
// then given a CRT pass. The ball headbutts a bonus block and three coins pop out.
import { W, H, T, R, FLOOR, CAM_Z, CAM_CY, camFrame, physics, eventsOn, clamp, lerp, invLerp, ease, rng, shake, ball2D, TAU } from '../core.js';
import { plateY } from '../physics.js';
import { makeCanvas } from '../fx.js';

const LW = 240, LH = 135, PX = 8;
let K = CAM_Z / PX;
const PAL = ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
  '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'];
let HIT = 0, LAND = 0;
let lo, lg, big, bg2;

const FONT = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111',
  S: '111100111001111', C: '111100100100111', O: '111101101101111', R: '110101110101101', E: '111100110100111',
  W: '101101101111101', L: '100100100100111', D: '110101101101110', '-': '000000111000000', '+': '000010111010000',
  x: '000101010101000', ' ': '000000000000000', '!': '010010010000010',
};
function text(g, s, x, y, col, shadow = 0) {
  if (shadow !== null) drawText(g, s, x + 1, y + 1, PAL[shadow]);
  drawText(g, s, x, y, PAL[col]);
}
function drawText(g, s, x, y, fill) {
  g.fillStyle = fill;
  [...s].forEach((ch, i) => {
    const f = FONT[ch] || FONT[' '];
    for (let k = 0; k < 15; k++) if (f[k] === '1') g.fillRect(x + i * 4 + (k % 3), y + Math.floor(k / 3), 1, 1);
  });
}
const px = (g, x, y, c, w = 1, h = 1) => { g.fillStyle = PAL[c]; g.fillRect(Math.round(x), Math.round(y), w, h); };

function groundTile(g, x, y) {
  px(g, x, y, 4, 16, 16);
  px(g, x, y, 15, 16, 1); px(g, x, y, 15, 1, 16);
  px(g, x, y + 15, 2, 16, 1); px(g, x + 15, y, 2, 1, 16);
  px(g, x + 4, y + 5, 2, 5, 1); px(g, x + 9, y + 10, 2, 4, 1); px(g, x + 3, y + 11, 15, 2, 1);
}
function brick(g, x, y) {
  px(g, x, y, 4, 16, 16);
  px(g, x, y, 15, 16, 1);
  for (let r = 0; r < 4; r++) {
    px(g, x, y + r * 4 + 3, 0, 16, 1);
    const o = r % 2 ? 4 : 0;
    px(g, x + o + 3, y + r * 4, 0, 1, 3);
    px(g, x + o + 11, y + r * 4, 0, 1, 3);
  }
}
function bonus(g, x, y, used, t) {
  px(g, x, y, 0, 16, 16);
  if (used) {
    px(g, x + 1, y + 1, 4, 14, 14);
    px(g, x + 1, y + 1, 15, 14, 1);
  } else {
    const flash = Math.floor(t * 6) % 3 === 0;
    px(g, x + 1, y + 1, flash ? 10 : 9, 14, 14);
    px(g, x + 1, y + 1, 10, 14, 1); px(g, x + 1, y + 1, 10, 1, 14);
    px(g, x + 1, y + 14, 4, 14, 1); px(g, x + 14, y + 1, 4, 1, 14);
    // "!" glyph
    px(g, x + 7, y + 3, 7, 2, 6); px(g, x + 7, y + 11, 7, 2, 2);
    px(g, x + 9, y + 4, 4, 1, 5); px(g, x + 9, y + 12, 4, 1, 1);
  }
  for (const [rx, ry] of [[2, 2], [13, 2], [2, 13], [13, 13]]) px(g, x + rx, y + ry, 0);
}
function cloud(g, x, y) {
  const rows = ['..77777.....', '.7777777.777', '777777777777', '667777777766', '.6666666666.'];
  rows.forEach((r, j) => [...r].forEach((c, i) => { if (c !== '.') px(g, x + i * 2, y + j * 2, Number(c), 2, 2); }));
}
function coin(g, x, y, t) {
  const phase = Math.floor(t * 16) % 4;
  const w = [10, 6, 2, 6][phase];
  x = Math.round(x); y = Math.round(y);
  px(g, x - w / 2, y - 6, 0, w, 12);
  px(g, x - w / 2 - 1, y - 4, 0, w + 2, 8);
  if (w > 2) {
    px(g, x - w / 2, y - 5, 9, w, 10);
    px(g, x - w / 2 + 1, y - 5, 10, w - 2, 1); px(g, x - w / 2, y - 4, 10, 1, 7);
    px(g, x - 1, y - 3, 7, 1, 5);
    if (w > 6) px(g, x + 1, y - 3, 4, 1, 5);
  } else px(g, x - 1, y - 5, 10, 2, 10);
}

// Rasterised ball sprite with squash/stretch: outline, dithered terminator, highlight.
function ballSprite(g, cx, cy, b) {
  const rx = R * K * b.along, ry = R * K * b.across;
  const ca = Math.cos(b.angle), sa = Math.sin(b.angle);
  const ext = Math.ceil(Math.max(rx, ry)) + 2;
  const inside = (x, y) => {
    const dx = x - cx, dy = y - cy;
    const u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry;
    return u * u + v * v <= 1;
  };
  const ix = Math.round(cx), iy = Math.round(cy);
  for (let y = iy - ext; y <= iy + ext; y++) {
    for (let x = ix - ext; x <= ix + ext; x++) {
      const X = x + 0.5, Y = y + 0.5;
      if (!inside(X, Y)) continue;
      const edge = !inside(X + 1, Y) || !inside(X - 1, Y) || !inside(X, Y + 1) || !inside(X, Y - 1);
      if (edge) { px(g, x, y, 0); continue; }
      const nx = (X - cx) / (R * K), ny = (Y - cy) / (R * K);
      const l = -nx * 0.6 - ny * 0.75 + 0.15; // light from the top-left
      let c = 8;
      // Stripe band in the ball's own frame, so the spin reads.
      const lx = nx * Math.cos(-b.spin) - ny * Math.sin(-b.spin), ly = nx * Math.sin(-b.spin) + ny * Math.cos(-b.spin);
      const stripe = Math.abs(ly) < 0.2;
      if (l < -0.35) c = 2;
      else if (l < -0.1) c = (x + y) % 2 ? 2 : 8; // dither band
      else if (l > 0.62) c = 7;
      else if (l > 0.45) c = 14;
      if (stripe && Math.abs(ly) > 0.07) c = l < -0.2 ? 6 : 7;
      void lx;
      px(g, x, y, c);
    }
  }
}

export default {
  async init() {
    lo = makeCanvas(LW, LH);
    lg = lo.getContext('2d');
    big = makeCanvas(W, H);
    bg2 = makeCanvas(W, H);
  },
  shutter: () => ({ samples: 1, angle: 0 }),
  draw(g, t) {
    HIT = eventsOn('block')[0].t;
    LAND = eventsOn('pixel')[0].t;
    const b = ball2D(t);
    const sk = shake(t, 3);
    const fr = camFrame(t);
    K = fr.z / PX;
    const cx = Math.round(fr.x * K) + Math.round(sk.x);
    const cy = Math.round(fr.y * K) + Math.round(sk.y);
    const toL = (wx, wy) => [wx * K - cx + LW / 2, wy * K - cy + LH / 2];
    const [, floorL] = toL(0, FLOOR);
    const fl = Math.round(floorL);
    lg.imageSmoothingEnabled = false;

    // Sky with a dithered horizon band
    px(lg, 0, 0, 12, LW, LH);
    for (let y = fl - 26; y < fl; y++) for (let x = 0; x < LW; x++) {
      const k = (y - (fl - 26)) / 26;
      if ((x + y) % 2 === 0 && k > 0.4 || (x % 2 === 0 && y % 2 === 0 && k > 0.1)) px(lg, x, y, 6);
    }
    // Clouds (parallax)
    for (const [x0, y0] of [[20, 14], [120, 26], [210, 10], [300, 22]]) {
      const x = ((x0 - cx * 0.3) % 340 + 340) % 340 - 40;
      cloud(lg, x, y0);
    }
    // Hills (parallax 0.5), stepped sine silhouettes
    for (let x = 0; x < LW; x++) {
      const wx = x + cx * 0.5;
      const h = Math.round(18 + 12 * Math.sin(wx * 0.035) + 6 * Math.sin(wx * 0.09 + 1));
      const top = fl - h;
      px(lg, x, top, 11, 1, 2);
      px(lg, x, top + 2, 3, 1, h);
      if ((Math.floor(wx) % 9) < 2 && h > 16) px(lg, x, top + 5, 11, 1, 2);
    }
    // Ground tiles
    const tile0 = Math.floor((cx - LW / 2) / 16) * 16;
    for (let wx = tile0; wx < cx + LW / 2 + 16; wx += 16) {
      const sx = wx - cx + LW / 2;
      groundTile(lg, sx, fl);
      groundTile(lg, sx, fl + 16);
      px(lg, sx, fl, 11, 16, 2); px(lg, sx, fl + 2, 3, 16, 1);
      if ((wx / 16) % 3 === 0) { px(lg, sx + 3, fl - 1, 11, 1, 1); px(lg, sx + 11, fl - 1, 11, 1, 1); }
    }
    // Floating blocks: brick, bonus, brick, centred on the hit point
    const blk = physics().run.block;
    const hitX = blk.x * K - cx + LW / 2;
    const blockBottom = Math.round(blk.y * K - cy + LH / 2);
    const dHit = t - HIT;
    const bump = dHit >= 0 && dHit < 0.14 ? Math.round(Math.sin((dHit / 0.14) * Math.PI) * 4) : 0;
    const bx0 = Math.round(hitX - 8);
    // Spring block under the landing spot: coil stretches with the simulated plate.
    {
      const pl = physics().run.plates.P3;
      const sx = Math.round(pl.x * K - cx + LW / 2);
      const top = Math.round(plateY(2, t) * K - cy + LH / 2);
      const base = fl;
      const hgt = Math.max(2, base - top - 3);
      for (let yy = 0; yy < hgt; yy++) {
        const phase = Math.floor((yy / hgt) * 8) % 2;
        px(lg, sx - 7 + phase * 2, top + 3 + yy, 0, 12, 1);
        px(lg, sx - 6 + phase * 2, top + 3 + yy, 6, 10, 1);
      }
      px(lg, sx - 12, top, 0, 24, 4);
      px(lg, sx - 11, top + 1, 8, 22, 2);
      px(lg, sx - 11, top + 1, 14, 22, 1);
    }
    // Coins pop out of the block after the hit
    let coins = 0;
    [0, 0.075, 0.15].forEach((dl, i) => {
      const d = dHit - dl;
      if (d < 0) return;
      coins++;
      if (d > 0.5) return;
      const y = blockBottom - 16 - 10 - (160 * d - 420 * d * d);
      coin(lg, hitX + (i - 1) * 5, y, t + i * 0.1);
      if (d > 0.3) {
        const s = d - 0.3;
        text(lg, '+100', Math.round(hitX - 8 + (i - 1) * 6), Math.round(blockBottom - 44 - s * 60 - i * 7), 7, 0);
      }
    });
    brick(lg, bx0 - 16, blockBottom - 16);
    bonus(lg, bx0, blockBottom - 16 - bump, dHit >= 0, t);
    brick(lg, bx0 + 16, blockBottom - 16);
    // Hit sparks
    if (dHit >= 0 && dHit < 0.2) {
      const s = Math.round(dHit * 60);
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 0.2], [1, 0.2]]) px(lg, hitX + dx * (10 + s), blockBottom - 8 + dy * (6 + s), 10, 2, 2);
    }
    // Ball shadow (dithered)
    const [bxL, byL] = toL(b.x, b.y);
    const [bcx] = toL(b.cx, b.cy);
    const hN = clamp(b.h / 500);
    const sw = Math.round(R * K * (1.1 - 0.5 * hN));
    for (let x = -sw; x <= sw; x++) if ((x + fl) % 2 === 0) px(lg, bcx + x, fl, 3, 1, 1);
    // Landing dust
    for (const ti of [T.PIXEL, LAND]) {
      const d = t - ti;
      if (d < 0 || d > 0.25) continue;
      const f = Math.floor(d / 0.0625);
      const ix = ball2D(ti).cx * K - cx + LW / 2;
      for (const side of [-1, 1]) {
        const dx = ix + side * (14 + f * 5);
        px(lg, dx - 2, fl - 3 - f, 7, 4 - Math.min(3, f), 3 - Math.min(2, f));
        px(lg, dx + side * 4, fl - 2 - f * 2, 6, 2, 2);
      }
    }
    ballSprite(lg, bxL, byL, b);
    // HUD
    const score = String(coins * 100).padStart(6, '0');
    text(lg, 'SCORE', 8, 6, 7, 0);
    text(lg, score, 8, 13, 7, 0);
    coin(lg, 12, 27, 0.02);
    text(lg, 'x' + String(coins).padStart(2, '0'), 20, 25, 7, 0);
    text(lg, 'WORLD', 190, 6, 7, 0);
    text(lg, '4-4', 198, 13, 7, 0);

    // Upscale with hard pixels
    const bgc = big.getContext('2d');
    bgc.imageSmoothingEnabled = false;
    bgc.drawImage(lo, 0, 0, W, H);
    g.drawImage(big, 0, 0);
    // CRT: glow, scanlines, aperture mask, vignette
    const gg = bg2.getContext('2d');
    gg.clearRect(0, 0, W, H);
    gg.filter = 'blur(10px) brightness(1.1)';
    gg.drawImage(lo, 0, 0, W, H);
    gg.filter = 'none';
    g.save();
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.28;
    g.drawImage(bg2, 0, 0);
    g.restore();
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = PX - 2; y < H; y += PX) g.fillRect(0, y, W, 2);
    g.fillStyle = 'rgba(0,0,0,0.06)';
    for (let x = 0; x < W; x += 3) g.fillRect(x, 0, 1, H);
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.55, W / 2, H / 2, H * 1.0);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
  },
};
