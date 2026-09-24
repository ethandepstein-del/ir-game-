// Shared helpers: easing, seeded randomness, glow sprites, sky, geography, post-processing.
import * as THREE from 'three';
import { geoStream } from 'd3-geo';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, x) => a + (b - a) * x;
export const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
export const ease = (u) => { u = clamp(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
// 0 → 1 over [a, a+fadeIn], back to 0 over [b-fadeOut, b].
export const window01 = (x, a, b, fadeIn = 0.6, fadeOut = fadeIn) => Math.min(smooth(a, a + fadeIn, x), 1 - smooth(b - fadeOut, b, x));
export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const lerpV = (a, b, u) => new THREE.Vector3().lerpVectors(a, b, u);

export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cheap smooth 2D noise from summed sines; deterministic and good enough for terrain.
export function terrainNoise(x, z, seed = 0) {
  return (
    Math.sin(x * 0.051 + seed) * Math.cos(z * 0.043 - seed * 0.7) * 1.0 +
    Math.sin(x * 0.117 + z * 0.093 + seed * 1.3) * 0.45 +
    Math.sin(x * 0.29 - z * 0.23 + seed * 2.1) * 0.18 +
    Math.cos(x * 0.61 + z * 0.53 + seed) * 0.07
  );
}

let glowTex;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

export function glow(color, size, intensity = 1) {
  const m = new THREE.SpriteMaterial({
    map: glowTexture(), color: new THREE.Color(color).multiplyScalar(intensity),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
  });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}

export function skyDome(top, horizon, bottom, glowDir, glowColor = '#000000') {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(top) }, hor: { value: new THREE.Color(horizon) },
      bot: { value: new THREE.Color(bottom) },
      gdir: { value: (glowDir || v3(0, 0, -1)).clone().normalize() }, gcol: { value: new THREE.Color(glowColor) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 top, hor, bot, gcol; uniform vec3 gdir; varying vec3 vP;
      void main(){
        float h = vP.y;
        vec3 c = h > 0.0 ? mix(hor, top, pow(clamp(h * 1.6, 0.0, 1.0), 0.55)) : mix(hor, bot, clamp(-h * 5.0, 0.0, 1.0));
        float g = max(dot(normalize(vP), gdir), 0.0);
        c += gcol * (pow(g, 8.0) * 0.6 + pow(g, 60.0) * 1.5);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

// Flat-shaded, displaced ground plane.
export function terrain(size, segs, height, color, seed, shape = () => 0) {
  const g = new THREE.PlaneGeometry(size, size, segs, segs).toNonIndexed();
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, terrainNoise(x, z, seed) * height + shape(x, z));
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true }));
}

// ---------- Geography ----------

// Run a GeoJSON object through a d3 projection (with its clipping) and collect
// the projected polygons as arrays of rings of [x, y].
export function projectPolygons(object, projection) {
  const polys = [];
  let poly = null, ring = null;
  const sink = projection.stream({
    polygonStart() { poly = []; },
    polygonEnd() { if (poly.length) polys.push(poly); poly = null; },
    lineStart() { ring = []; },
    lineEnd() { if (poly && ring.length > 2) poly.push(ring); ring = null; },
    point(x, y) { if (ring) ring.push([x, y]); },
    sphere() {},
  });
  geoStream(object, sink);
  return polys;
}

export function projectLines(object, projection) {
  const lines = [];
  let line = null;
  const sink = projection.stream({
    polygonStart() {}, polygonEnd() {},
    lineStart() { line = []; },
    lineEnd() { if (line.length > 1) lines.push(line); line = null; },
    point(x, y) { if (line) line.push([x, y]); },
    sphere() {},
  });
  geoStream(object, sink);
  return lines;
}

const ringArea = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return a / 2; };
const inside = (pt, r) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    if ((r[i][1] > pt[1]) !== (r[j][1] > pt[1]) && pt[0] < ((r[j][0] - r[i][0]) * (pt[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
  }
  return c;
};

// Projected polygons → THREE.Shapes. Map x stays x, projected y becomes world z
// once the extrusion is laid flat, so a shape's 2D y is -projected y.
export function polygonsToShapes(polys, minArea = 0.02) {
  const shapes = [];
  for (const rings of polys) {
    const flipped = rings.map((r) => r.map(([x, y]) => [x, -y]));
    const areas = flipped.map(ringArea);
    let big = 0;
    areas.forEach((a, i) => { if (Math.abs(a) > Math.abs(areas[big])) big = i; });
    const outerSign = Math.sign(areas[big]);
    const outers = [], holes = [];
    flipped.forEach((r, i) => {
      if (Math.abs(areas[i]) < minArea) return;
      (Math.sign(areas[i]) === outerSign ? outers : holes).push(r);
    });
    const made = outers.map((r) => ({ ring: r, shape: new THREE.Shape(r.map(([x, y]) => new THREE.Vector2(x, y))) }));
    for (const h of holes) {
      const owner = made.find((m) => inside(h[0], m.ring));
      if (owner) owner.shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    }
    shapes.push(...made.map((m) => m.shape));
  }
  return shapes;
}

export function extrudeShapes(shapes, depth, material) {
  const g = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  return new THREE.Mesh(g, material);
}

// Outline of shapes as a line set lying at height y.
export function shapeOutlines(shapes, y, material) {
  const pts = [];
  const add = (ps) => {
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i], b = ps[(i + 1) % ps.length];
      pts.push(a.x, y, -a.y, b.x, y, -b.y);
    }
  };
  for (const s of shapes) { add(s.getPoints()); s.holes.forEach((h) => add(h.getPoints())); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, material);
}

export function linesToSegments(lines, y, material) {
  const pts = [];
  for (const l of lines) for (let i = 0; i < l.length - 1; i++) pts.push(l[i][0], y, l[i][1], l[i + 1][0], y, l[i + 1][1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, material);
}

// ---------- Post-processing: bloom, tone mapping, grade, vignette, grain ----------

const quadVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export class Post {
  constructor(renderer, w, h) {
    this.r = renderer;
    const opts = { type: THREE.HalfFloatType, depthBuffer: true, samples: 4 };
    this.main = new THREE.WebGLRenderTarget(w, h, opts);
    const small = (d) => new THREE.WebGLRenderTarget(w / d, h / d, { type: THREE.HalfFloatType, depthBuffer: false });
    this.a4 = small(4); this.b4 = small(4); this.a8 = small(8); this.b8 = small(8);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);

    this.bright = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, threshold: { value: 1.0 } },
      vertexShader: quadVS,
      fragmentShader: `uniform sampler2D tex; uniform float threshold; varying vec2 vUv;
        void main(){ vec3 c = texture2D(tex, vUv).rgb; float l = max(c.r, max(c.g, c.b));
          gl_FragColor = vec4(c * smoothstep(threshold, threshold + 1.0, l), 1.0); }`,
    });
    this.blur = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2() } },
      vertexShader: quadVS,
      fragmentShader: `uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
        void main(){
          vec3 c = texture2D(tex, vUv).rgb * 0.2270270270;
          c += texture2D(tex, vUv + dir * 1.3846153846).rgb * 0.3162162162;
          c += texture2D(tex, vUv - dir * 1.3846153846).rgb * 0.3162162162;
          c += texture2D(tex, vUv + dir * 3.2307692308).rgb * 0.0702702703;
          c += texture2D(tex, vUv - dir * 3.2307692308).rgb * 0.0702702703;
          gl_FragColor = vec4(c, 1.0); }`,
    });
    this.final = new THREE.ShaderMaterial({
      uniforms: {
        tex: { value: this.main.texture }, b4: { value: this.a4.texture }, b8: { value: this.a8.texture },
        exposure: { value: 1 }, bloom: { value: 0.6 }, fade: { value: 1 }, seed: { value: 0 },
        vignette: { value: 0.9 }, grain: { value: 0.05 }, res: { value: new THREE.Vector2(w, h) },
        tint: { value: new THREE.Color(1, 1, 1) }, sat: { value: 0.85 },
      },
      vertexShader: quadVS,
      fragmentShader: `uniform sampler2D tex, b4, b8; uniform float exposure, bloom, fade, seed, vignette, grain, sat;
        uniform vec2 res; uniform vec3 tint; varying vec2 vUv;
        vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
        float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32 + seed); return fract(p.x * p.y); }
        void main(){
          vec2 d = (vUv - 0.5);
          // A whisper of chromatic aberration towards the edges.
          float ca = dot(d, d) * 0.004;
          vec3 c = vec3(texture2D(tex, vUv + d * ca).r, texture2D(tex, vUv).g, texture2D(tex, vUv - d * ca).b);
          c += (texture2D(b4, vUv).rgb * 0.6 + texture2D(b8, vUv).rgb * 0.8) * bloom;
          c = aces(c * exposure * tint);
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = mix(vec3(l), c, sat);
          // Cool the shadows, warm the highlights.
          c = mix(c, c * vec3(0.9, 1.0, 1.1), (1.0 - l) * 0.35);
          c = pow(c, vec3(1.0 / 2.2));
          float v = smoothstep(0.95, 0.25, length(d * vec2(1.0, 0.8)) * vignette);
          c *= mix(0.35, 1.0, v);
          c += (hash(vUv * res) - 0.5) * grain;
          gl_FragColor = vec4(c * fade, 1.0);
        }`,
    });
  }

  pass(material, target) {
    this.quad.material = material;
    this.r.setRenderTarget(target);
    this.r.render(this.scene, this.cam);
  }

  render(scene, camera, opts) {
    const r = this.r;
    r.setRenderTarget(this.main);
    r.render(scene, camera);

    this.bright.uniforms.tex.value = this.main.texture;
    this.bright.uniforms.threshold.value = opts.threshold ?? 0.9;
    this.pass(this.bright, this.a4);
    const blurTwice = (a, b, px) => {
      for (let i = 0; i < 2; i++) {
        this.blur.uniforms.tex.value = a.texture; this.blur.uniforms.dir.value.set((1 + i) / a.width, 0); this.pass(this.blur, b);
        this.blur.uniforms.tex.value = b.texture; this.blur.uniforms.dir.value.set(0, (1 + i) / a.height); this.pass(this.blur, a);
      }
    };
    blurTwice(this.a4, this.b4);
    this.blur.uniforms.tex.value = this.a4.texture; this.blur.uniforms.dir.value.set(0, 0); this.pass(this.blur, this.a8);
    blurTwice(this.a8, this.b8);

    const u = this.final.uniforms;
    u.exposure.value = opts.exposure ?? 1;
    u.bloom.value = opts.bloom ?? 0.6;
    u.fade.value = opts.fade ?? 1;
    u.seed.value = opts.seed ?? 0;
    u.sat.value = opts.sat ?? 0.85;
    u.tint.value.set(opts.tint ?? '#ffffff');
    this.pass(this.final, null);
  }
}
