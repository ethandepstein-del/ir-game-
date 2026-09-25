// Renders post-processing / noise test shaders in headless Chromium (WebGL2).
//   NODE_PATH=$(npm root -g) node postfx.cjs test.glsl out.png <tileW> <tileH> '<json tiles>' [scene]
// Like render.cjs, but also binds:
//   noisetex  : Clarity/shaders/textures/bluenoise.png (nearest, repeat)
//   colortex0 : optional HDR test scene ("spots") at tile size, RGBA16F with a
//               2x2 box-filtered mip chain (what glGenerateMipmap produces)
// Prints, per tile, the RMS of (red - 0.5) in output units, so test shaders
// can write 0.5 + error * gain and get a number back; also the same after a
// Gaussian eye low-pass (EYE_SIGMA env, default 1 px).
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { chromium } = require('playwright');

const SH = path.join(__dirname, '..', '..', 'Clarity', 'shaders');
function expand(file) {
  const src = fs.readFileSync(file, 'utf8');
  return src.replace(/^\s*#include\s+"(\/[^"]+)"\s*$/mg, (_, p) => expand(path.join(SH, p)));
}

// Decode the 8-bit RGBA, filter-0 PNG the generator writes.
function readPNG(file) {
  const buf = fs.readFileSync(file);
  let off = 8, w = 0, h = 0; const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); }
    if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w * 4; x++) out.push(raw[y * (w * 4 + 1) + 1 + x]);
  return { w, h, data: out };
}

// Test scene for bloom (alpha: see below): dark ground, bright points and blobs, one row of
// single-pixel lights at every phase of the 64-px mip-6 grid.
function sceneSpots(W, H) {
  const d = new Float32Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const base = 0.02 + 0.10 * (y / H);            // dim scene
    let v = [base, base * 1.05, base * 1.15];
    if (y > H * 0.82) v = [0.9, 1.0, 1.2];         // bright-ish "sky" band (~ white after exposure)
    const cx = W * 0.75, cy = H * 0.35, r = Math.hypot(x - cx, y - cy);
    if (r < 10) v = [40, 30, 18];                    // sun-like disc
    d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = 1;
  }
  // Single pixels (torch-like points), shifted 1..8 px relative to the grid.
  for (let k = 0; k < 8; k++) {
    const x = 32 + k * 64 + k * 8, y = Math.floor(H * 0.35);
    if (x >= W) break;
    const i = (y * W + x) * 4; d[i] = 400; d[i + 1] = 260; d[i + 2] = 120;
  }
  // Alpha = bright-only luminance, as composite2 writes it (lib/bloom.glsl
  // bloomShare with exposure 1; threshold from BLOOM_T, default 1.0).
  const T = +(process.env.BLOOM_T || 1.0), K = Math.max(T * 0.5, 1e-4);
  for (let i = 0; i < W * H * 4; i += 4) {
    const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    let soft = Math.min(Math.max(l - T + K, 0), 2 * K); soft = soft * soft / (4 * K);
    d[i + 3] = l * Math.min(Math.max(Math.max(soft, l - T) / Math.max(l, 1e-5), 0), 1);
  }
  return d;
}
function mipChain(d, W, H) {
  const levels = [{ w: W, h: H, d }];
  while (levels[levels.length - 1].w > 1 || levels[levels.length - 1].h > 1) {
    const p = levels[levels.length - 1];
    const w = Math.max(1, p.w >> 1), h = Math.max(1, p.h >> 1), o = new Float32Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) {
      let s = 0, n = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const sx = Math.min(2 * x + dx, p.w - 1), sy = Math.min(2 * y + dy, p.h - 1);
        s += p.d[(sy * p.w + sx) * 4 + c]; n++;
      }
      o[(y * w + x) * 4 + c] = s / n;
    }
    levels.push({ w, h, d: o });
  }
  return levels.map(l => ({ w: l.w, h: l.h, d: Array.from(l.d) }));
}

(async () => {
  const [mainFile, out, W, H, tilesJson, scene] = process.argv.slice(2);
  const tiles = JSON.parse(tilesJson);
  // GLSL ES 3.00 with GLSL 1.20 spellings, so texture2DLod works in the FSH
  // (the pack gets it from GL_ARB_shader_texture_lod).
  const frag = '#version 300 es\nprecision highp float;\nout vec4 fragOut;\n#define gl_FragColor fragOut\n' +
    '#define texture2D texture\n#define texture2DLod textureLod\n#define varying in\n#define OVERWORLD\n#define FSH\n' +
    expand(mainFile).replace(/^\s*#extension.*$/mg, '');
  const noise = readPNG(path.join(SH, 'textures', 'bluenoise.png'));
  const mips = scene === 'spots' ? mipChain(sceneSpots(+W, +H), +W, +H) : null;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  await page.setContent('<canvas id=c></canvas>');
  const result = await page.evaluate(async ({ frag, W, H, tiles, noise, mips, eyeSigma }) => {
    const c = document.getElementById('c');
    const cols = Math.min(tiles.length, 2), rows = Math.ceil(tiles.length / cols);
    c.width = W * cols; c.height = H * rows;
    const gl = c.getContext('webgl2', { preserveDrawingBuffer: true });
    const vs = '#version 300 es\nin vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }';
    function sh(t, s) { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const nt = gl.createTexture(); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, nt);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, noise.w, noise.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(noise.data));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    const nl = gl.getUniformLocation(pr, 'noisetex'); if (nl) gl.uniform1i(nl, 1);
    if (mips) {
      const st = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st);
      mips.forEach((m, i) => gl.texImage2D(gl.TEXTURE_2D, i, gl.RGBA16F, m.w, m.h, 0, gl.RGBA, gl.FLOAT, new Float32Array(m.d)));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const cl = gl.getUniformLocation(pr, 'colortex0'); if (cl) gl.uniform1i(cl, 0);
    }
    const stats = [];
    tiles.forEach((u, i) => {
      const x = (i % cols) * W, y = (rows - 1 - Math.floor(i / cols)) * H;
      gl.viewport(x, y, W, H);
      const all = Object.assign({ viewWidth: W, viewHeight: H, tileOrigin: [x, y] }, u);
      for (const [k, v] of Object.entries(all)) {
        const l = gl.getUniformLocation(pr, k); if (!l) continue;
        if (Array.isArray(v)) [null, gl.uniform1fv, gl.uniform2fv, gl.uniform3fv, gl.uniform4fv][v.length].call(gl, l, v);
        else gl.uniform1f(l, v);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      const px = new Uint8Array(W * H * 4);
      gl.readPixels(x, y, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let s = 0; for (let j = 0; j < W * H; j++) { const e = px[j * 4] / 255 - 0.5; s += e * e; }
      // Same after a Gaussian "eye" low-pass (sigma eyeSigma px): what is left
      // of static noise once the viewer can no longer resolve single pixels.
      const e0 = new Float32Array(W * H), e1 = new Float32Array(W * H);
      for (let j = 0; j < W * H; j++) e0[j] = px[j * 4] / 255 - 0.5;
      const R = Math.ceil(eyeSigma * 3), k = [];
      for (let d = -R; d <= R; d++) k.push(Math.exp(-d * d / (2 * eyeSigma * eyeSigma)));
      const ks = k.reduce((a, b) => a + b, 0);
      for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
        let a = 0; for (let d = -R; d <= R; d++) a += k[d + R] * e0[yy * W + Math.min(W - 1, Math.max(0, xx + d))]; e1[yy * W + xx] = a / ks; }
      let s2 = 0, n2 = 0;
      for (let yy = R; yy < H - R; yy++) for (let xx = R; xx < W - R; xx++) {
        let a = 0; for (let d = -R; d <= R; d++) a += k[d + R] * e1[(yy + d) * W + xx]; a /= ks; s2 += a * a; n2++; }
      stats.push([Math.sqrt(s / (W * H)), Math.sqrt(s2 / n2)]);
    });
    return { url: c.toDataURL('image/png'), stats };
  }, { frag, W: +W, H: +H, tiles, noise, mips, eyeSigma: +(process.env.EYE_SIGMA || 1.0) });
  fs.writeFileSync(out, Buffer.from(result.url.split(',')[1], 'base64'));
  result.stats.forEach((s, i) => console.log(`tile ${i} ${tiles[i].label || ''}: rms(r-0.5) = ${s[0].toFixed(5)}  after eye blur = ${s[1].toFixed(5)}`));
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
