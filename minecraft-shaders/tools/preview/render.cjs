// Renders shader-pack library code in headless Chromium (WebGL1) to PNG.
// usage: node render.cjs sky.glsl out.png <tileW> <tileH> '<json array of uniform sets>'
// Needs playwright (npm i -g playwright). Tiles are laid out two per row.
const path = require('path');
const { chromium } = require('playwright');
const fs = require('fs');

const SH = path.join(__dirname, '..', '..', 'Clarity', 'shaders');

function expand(file) {
  let src = fs.readFileSync(file, 'utf8');
  return src.replace(/^\s*#include\s+"(\/[^"]+)"\s*$/mg, (_, p) => expand(path.join(SH, p)));
}

(async () => {
  const [mainFile, out, W, H, tilesJson] = process.argv.slice(2);
  const tiles = JSON.parse(tilesJson);
  let body = expand(mainFile);
  const frag = `precision highp float;\n#define OVERWORLD\n` + body;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  await page.setContent('<canvas id=c></canvas>');
  const result = await page.evaluate(async ({ frag, W, H, tiles }) => {
    const c = document.getElementById('c');
    const cols = Math.min(tiles.length, 2), rows = Math.ceil(tiles.length / cols);
    c.width = W * cols; c.height = H * rows;
    const gl = c.getContext('webgl', { preserveDrawingBuffer: true });
    const vs = 'attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }';
    function sh(t, s) { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const I = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
    tiles.forEach((u, i) => {
      const x = (i % cols) * W, y = (rows - 1 - Math.floor(i / cols)) * H;
      gl.viewport(x, y, W, H);
      const all = Object.assign({ gbufferModelViewInverse: I, gbufferModelView: I, upPosition: [0,100,0], cameraPosition: [0,70,0], viewWidth: W, viewHeight: H, tileOrigin: [x, y], far: 256 }, u);
      for (const [k, v] of Object.entries(all)) {
        const l = gl.getUniformLocation(pr, k); if (!l) continue;
        if (Array.isArray(v)) {
          if (v.length === 16) gl.uniformMatrix4fv(l, false, v);
          else if (k === 'eyeBrightnessSmooth') gl.uniform2iv(l, v);
          else [null, gl.uniform1fv, gl.uniform2fv, gl.uniform3fv, gl.uniform4fv][v.length].call(gl, l, v);
        } else if (['isEyeInWater'].includes(k)) gl.uniform1i(l, v); else gl.uniform1f(l, v);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    });
    return c.toDataURL('image/png');
  }, { frag, W: +W, H: +H, tiles });
  fs.writeFileSync(out, Buffer.from(result.split(',')[1], 'base64'));
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
