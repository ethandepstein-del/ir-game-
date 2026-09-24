// The sets. Each builder returns { scene, update(t, p) }, where every visual is a
// pure function of the time t and the params p, so any frame can be rendered alone.
import * as THREE from 'three';
import { geoConicConformal, geoEqualEarth, geoGraticule10, geoCentroid } from 'd3-geo';
import { feature } from 'topojson-client';
import {
  clamp, lerp, smooth, rng, v3, glow, skyDome, terrain, terrainNoise,
  projectPolygons, projectLines, polygonsToShapes, extrudeShapes, shapeOutlines, linesToSegments,
} from './lib.js';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });

// ---------------------------------------------------------------------------
// The sea of islands: every island is a house, every house a state.
// ---------------------------------------------------------------------------
export function buildSea() {
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color('#141c27');
  scene.fog = new THREE.FogExp2(fogColor, 0.0105);
  const moonDir = v3(-0.35, 0.2, -1).normalize();
  const sky = skyDome('#05080f', '#1d2a3a', '#0b1119', moonDir, '#3d4d66');
  scene.add(sky);

  const moon = glow('#dfe8ff', 90, 1.6);
  moon.position.copy(moonDir.clone().multiplyScalar(1200));
  scene.add(moon);
  const moonDisc = glow('#ffffff', 22, 5);
  moonDisc.position.copy(moon.position);
  scene.add(moonDisc);

  scene.add(new THREE.HemisphereLight('#2b3d57', '#06080c', 0.9));
  const moonLight = new THREE.DirectionalLight('#a9bce0', 1.6);
  moonLight.position.copy(moonDir.clone().multiplyScalar(100));
  scene.add(moonLight);

  // Ocean: a flat-shaded grid re-displaced every frame.
  const oceanGeo = new THREE.PlaneGeometry(520, 520, 130, 130).toNonIndexed();
  oceanGeo.rotateX(-Math.PI / 2);
  const base = oceanGeo.attributes.position.array.slice();
  const ocean = new THREE.Mesh(oceanGeo, std('#1a2a38', { roughness: 0.55, metalness: 0.1 }));
  scene.add(ocean);

  // Islands, scattered with a clear lane for the opening camera.
  const R = rng(11);
  const islands = [{ x: 0, z: 0, s: 4.2 }];
  while (islands.length < 46) {
    const x = (R() - 0.5) * 300, z = -R() * 260 + 40;
    const s = 2.2 + R() * 3.4;
    if (Math.abs(x) < 10 && z > -20) continue;
    if (islands.some((o) => Math.hypot(o.x - x, o.z - z) < o.s + s + 9)) continue;
    islands.push({ x, z, s });
  }
  const rock = std('#3b3a35'), sand = std('#6b6150');
  const wallMat = std('#cfbf9f'), roofMat = std('#5e3a2c');
  const windowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb25e').multiplyScalar(6), fog: false });
  const postGeo = new THREE.BoxGeometry(0.14, 1, 0.14);
  postGeo.translate(0, 0.5, 0);
  const POSTS = 22;
  const posts = new THREE.InstancedMesh(postGeo, std('#6e5a44'), islands.length * POSTS);
  scene.add(posts);
  const lighthouses = [];

  islands.forEach((isl, k) => {
    const g = new THREE.IcosahedronGeometry(isl.s, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const n = 1 + (Math.sin(p.getX(i) * 3.1 + k) + Math.cos(p.getZ(i) * 2.7 - k)) * 0.09;
      p.setXYZ(i, p.getX(i) * n, p.getY(i) * 0.34 * n, p.getZ(i) * n);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, k % 3 ? rock : sand);
    m.position.set(isl.x, -0.25, isl.z);
    m.rotation.y = R() * 6;
    scene.add(m);
    const top = isl.s * 0.34 - 0.3;
    isl.top = top;

    const house = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.0), wallMat);
    walls.position.y = 0.45;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.98, 0.7, 4), roofMat);
    roof.position.y = 1.25; roof.rotation.y = Math.PI / 4; roof.scale.z = 0.85;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.26), windowMat);
    win.position.set(0.18, 0.5, 0.505);
    const halo = glow('#ffae55', 2.6, 0.9);
    halo.position.set(0.18, 0.52, 0.8);
    house.add(walls, roof, win, halo);
    const rot = k === 0 ? 0.35 : R() * 6.28;
    house.rotation.y = rot;
    house.position.set(isl.x, top, isl.z);
    house.scale.setScalar(k === 0 ? 1.15 : 1);
    scene.add(house);
    isl.halo = halo; isl.win = win;
    isl.flicker = R() * 10;
    isl.wallDelay = k === 0 ? 0 : R() * 0.6;

    if (k === 7 || k === 19 || k === 31) {
      const lh = new THREE.Group();
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.75, 5, 8), std('#d9d2c3'));
      tower.position.y = 2.5;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.7, 8), std('#8a2e25'));
      band.position.y = 3.2;
      const lamp = glow('#fff1cf', 6, 2.2);
      lamp.position.y = 5.3;
      const beamGeo = new THREE.ConeGeometry(4, 42, 24, 1, true);
      beamGeo.translate(0, -21, 0);
      beamGeo.rotateZ(Math.PI / 2);
      const beam = new THREE.Mesh(beamGeo, new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        uniforms: { k: { value: 1 } },
        vertexShader: `varying float vX; varying float vD; varying float vF;
          void main(){
            vX = position.x / 42.0;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vD = -mv.z;
            vec3 n = normalize(normalMatrix * normal);
            vF = abs(dot(n, normalize(-mv.xyz)));
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `uniform float k; varying float vX; varying float vD; varying float vF;
          void main(){
            float a = pow(1.0 - clamp(vX, 0.0, 1.0), 2.4) * 0.16 * k * vF * smoothstep(6.0, 30.0, vD);
            gl_FragColor = vec4(vec3(1.0, 0.93, 0.78) * a, 1.0);
          }`,
      }));
      beam.position.y = 5.3;
      lh.add(tower, band, lamp, beam);
      lh.position.set(isl.x + isl.s * 0.4, top - 0.2, isl.z - isl.s * 0.3);
      scene.add(lh);
      lighthouses.push({ beam, phase: R() * 6.28 });
    }
  });

  const tmp = new THREE.Object3D();
  function update(t, p) {
    sky.position.copy(p.camera.position);
    const pos = oceanGeo.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      const x = base[i], z = base[i + 2];
      pos[i + 1] = 0.38 * Math.sin(x * 0.13 + t * 0.55) + 0.26 * Math.sin(z * 0.19 - t * 0.75 + x * 0.05) + 0.1 * Math.sin((x + z) * 0.47 + t * 1.2);
    }
    oceanGeo.attributes.position.needsUpdate = true;
    oceanGeo.computeVertexNormals();

    let n = 0;
    islands.forEach((isl, k) => {
      const flick = 0.85 + 0.15 * Math.sin(t * 7 + isl.flicker) * Math.sin(t * 2.3 + isl.flicker * 2);
      const lit = k === 0 ? 1 : p.lights ?? 1;
      isl.halo.material.opacity = flick * lit;
      isl.win.visible = lit > 0.05;
      const h = clamp((p.walls ?? 0) * 1.6 - isl.wallDelay) * 1.1;
      for (let j = 0; j < POSTS; j++) {
        const a = (j / POSTS) * Math.PI * 2;
        const gap = j === 0 ? 0 : 1; // a gate
        tmp.position.set(isl.x + Math.cos(a) * 1.55, isl.top - 0.05, isl.z + Math.sin(a) * 1.55);
        tmp.scale.set(1, Math.max(h * gap * (0.85 + 0.15 * Math.sin(j * 2.3)), 0.001), 1);
        tmp.updateMatrix();
        posts.setMatrixAt(n++, tmp.matrix);
      }
    });
    posts.instanceMatrix.needsUpdate = true;
    for (const lh of lighthouses) {
      lh.beam.rotation.y = t * 0.45 + lh.phase;
      lh.beam.material.uniforms.k.value = p.beams ?? 1;
    }
  }
  return { scene, update, hero: v3(0, islands[0].top + 0.8, 0) };
}

// ---------------------------------------------------------------------------
// Europe, 1648: a relief table of the continent.
// ---------------------------------------------------------------------------
export function buildEurope(countries, land) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#0f151c', 0.0048);
  const sky = skyDome('#070a10', '#18212c', '#0d1218');
  scene.add(sky);
  scene.add(new THREE.HemisphereLight('#3c4a60', '#0b0d10', 0.8));
  const sun = new THREE.DirectionalLight('#ffd3a1', 2.4);
  sun.position.set(-60, 50, -30);
  scene.add(sun);

  const proj = geoConicConformal().rotate([-10, 0]).center([0, 50]).parallels([40, 60]).scale(155).translate([0, 0])
    .clipExtent([[-130, -90], [130, 90]]);

  const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), std('#121c25', { roughness: 0.6, flatShading: false }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.05;
  scene.add(water);
  const grat = linesToSegments(projectLines(geoGraticule10(), proj), 0.02,
    new THREE.LineBasicMaterial({ color: '#40546a', transparent: true, opacity: 0.35 }));
  scene.add(grat);

  // Countries as separate slabs, so they can drift apart.
  const R = rng(3);
  const slabs = [];
  const edgeMat = new THREE.LineBasicMaterial({ color: '#efe1c0', transparent: true, opacity: 0.45 });
  for (const f of countries.features) {
    const [cx, cy] = proj(geoCentroid(f)) || [9999, 9999];
    if (Math.abs(cx) > 140 || Math.abs(cy) > 100) continue;
    const shapes = polygonsToShapes(projectPolygons(f, proj));
    if (!shapes.length) continue;
    const shade = 0.85 + R() * 0.25;
    const color = new THREE.Color('#8c8170').multiplyScalar(shade);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, emissive: '#000000' });
    const g = new THREE.Group();
    const slab = extrudeShapes(shapes, 1.1, mat);
    const edge = shapeOutlines(shapes, 1.12, edgeMat);
    g.add(slab, edge);
    scene.add(g);
    slabs.push({ g, mat, cx, cz: cy, lift: 0.4 + R() * 2.2, name: f.properties.name, delay: R() * 0.35 });
  }
  const germany = slabs.find((s) => s.name === 'Germany');

  // Embers of the Thirty Years' War over central Europe.
  const E = rng(8);
  const embers = [];
  for (let i = 0; i < 70; i++) {
    const s = glow(i % 3 ? '#ff7a2e' : '#ffc070', 1.2 + E() * 2.2, 1.4);
    const a = E() * 6.28, r = Math.sqrt(E()) * 16;
    const x = -2 + Math.cos(a) * r * 1.2, z = -1 + Math.sin(a) * r * 0.8;
    scene.add(s);
    embers.push({ s, x, z, ph: E() * 10, sp: 0.4 + E() * 0.8 });
  }
  const warGlow = glow('#ff5a1e', 48, 0.55);
  warGlow.position.set(-1, 2, -1);
  warGlow.material.depthTest = false;
  scene.add(warGlow);

  // An imperial crown that lifts away and dissolves.
  const crown = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: '#c9a44c', metalness: 0.8, roughness: 0.35, flatShading: true, transparent: true, emissive: '#3a2a08' });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.3, 2.2, 10, 1, true), gold);
  band.material.side = THREE.DoubleSide;
  crown.add(band);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.4, 4), gold);
    spike.position.set(Math.cos(a) * 4, 2.2, Math.sin(a) * 4);
    const pearl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), gold);
    pearl.position.set(Math.cos(a) * 4, 3.55, Math.sin(a) * 4);
    crown.add(spike, pearl);
  }
  const crownGlow = glow('#ffcf7a', 26, 0.6);
  crown.add(crownGlow);
  scene.add(crown);

  const munster = proj([7.63, 51.96]);
  const pin = glow('#fff0d0', 3.2, 3);
  pin.position.set(munster[0], 1.6, munster[1]);
  scene.add(pin);

  function update(t, p) {
    sky.position.copy(p.camera.position);
    const war = p.war ?? 0;
    for (const e of embers) {
      const cyc = ((t * e.sp * 0.25 + e.ph) % 1);
      e.s.position.set(e.x + Math.sin(t * 0.7 + e.ph) * 0.6, 1.4 + cyc * 7, e.z);
      e.s.material.opacity = war * Math.sin(cyc * Math.PI) * (0.6 + 0.4 * Math.sin(t * 9 + e.ph * 3));
    }
    warGlow.material.opacity = war * (0.75 + 0.25 * Math.sin(t * 5.3) * Math.sin(t * 3.1));
    if (germany) germany.mat.emissive.setRGB(0.35 * war * (0.8 + 0.2 * Math.sin(t * 6)), 0.08 * war, 0);

    const c = p.crown ?? 0, lift = p.crownLift ?? 0;
    crown.visible = c > 0.001;
    crown.position.set(-1, 9 + lift * 22 + Math.sin(t * 0.8) * 0.3, -2);
    crown.rotation.y = t * 0.12;
    crown.scale.setScalar(1 + lift * 0.15);
    gold.opacity = c * (1 - lift);
    crownGlow.material.opacity = c * (1 - lift) * 0.8;

    const split = p.split ?? 0;
    for (const s of slabs) {
      const u = smooth(s.delay, s.delay + 0.65, split);
      s.g.position.set(s.cx * 0.07 * u, s.lift * u, s.cz * 0.07 * u);
    }
    pin.material.opacity = p.pin ?? 0;
  }
  return { scene, update, munster: v3(munster[0], 1.6, munster[1]) };
}

// ---------------------------------------------------------------------------
// Two fortresses across a river: the security dilemma.
// ---------------------------------------------------------------------------
function fortress(R, stoneColor) {
  const g = new THREE.Group();
  const stone = std(stoneColor);
  const keep = new THREE.Mesh(new THREE.BoxGeometry(3.2, 5.5, 3.2), stone);
  keep.position.y = 2.75;
  keep.castShadow = keep.receiveShadow = true;
  g.add(keep);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 6.8, 7), stone);
    tower.position.set(Math.cos(a) * 2.2, 3.4, Math.sin(a) * 2.2);
    tower.castShadow = true;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.6, 7), std('#4a3128'));
    cap.position.set(tower.position.x, 7.6, tower.position.z);
    cap.castShadow = true;
    g.add(tower, cap);
  }
  const lantern = glow('#ffb35a', 5, 2.2);
  lantern.position.set(0, 6.2, 0);
  g.add(lantern);

  // Concentric rings of walls, raised one after another.
  const rings = [];
  [[9, 1.6], [15, 2.6], [21, 3.8]].forEach(([side, h], ri) => {
    const ring = new THREE.Group();
    const segs = [];
    for (let s = 0; s < 4; s++) {
      const wall = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(side, h, 0.8), stone);
      body.position.y = h / 2;
      body.castShadow = body.receiveShadow = true;
      wall.add(body);
      const n = Math.floor(side / 1.2);
      for (let k = 0; k < n; k++) {
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.85), stone);
        merlon.position.set(-side / 2 + 0.6 + k * (side - 1.2) / (n - 1), h + 0.25, 0);
        merlon.castShadow = true;
        wall.add(merlon);
      }
      const a = (s / 4) * Math.PI * 2;
      wall.position.set(Math.sin(a) * side / 2, 0, Math.cos(a) * side / 2);
      wall.rotation.y = a;
      ring.add(wall);
      segs.push(wall);
    }
    for (let c = 0; c < 4; c++) {
      const a = (c / 4) * Math.PI * 2 + Math.PI / 4;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, h * 1.35, 7), stone);
      t.position.set(Math.cos(a) * side / Math.SQRT2, h * 0.675, Math.sin(a) * side / Math.SQRT2);
      t.castShadow = true;
      ring.add(t);
    }
    g.add(ring);
    rings.push({ ring, delay: ri });
  });

  return {
    group: g,
    set(level, tension, t) {
      rings.forEach((r, i) => {
        const u = clamp(level - i);
        const e = u * u * (3 - 2 * u);
        r.ring.visible = e > 0.001;
        r.ring.scale.set(1, Math.max(e, 0.001), 1);
      });
      const warm = new THREE.Color('#ffb35a'), red = new THREE.Color('#ff3b1f');
      lantern.material.color.copy(warm.lerp(red, tension)).multiplyScalar(2.2 + tension * 1.5 * (0.7 + 0.3 * Math.sin(t * 6)));
    },
  };
}

export function buildForts() {
  const scene = new THREE.Scene();
  const fogCol = new THREE.Color('#4c4a4c');
  scene.fog = new THREE.FogExp2(fogCol, 0.0085);
  const sunDir = v3(0.6, 0.18, -1).normalize();
  const sky = skyDome('#1a2231', '#9a7462', '#3a3534', sunDir, '#ff9a5a');
  scene.add(sky);
  scene.add(new THREE.HemisphereLight('#6a7890', '#1c1a16', 0.8));
  const sun = new THREE.DirectionalLight('#ffb887', 3.2);
  sun.position.copy(sunDir.clone().multiplyScalar(120));
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 300 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  const river = (x, z) => -3.2 * Math.exp(-Math.pow((x - Math.sin(z * 0.04) * 4) / 5.5, 2));
  const ground = terrain(420, 150, 1.6, '#4a4b3a', 2, river);
  ground.receiveShadow = true;
  scene.add(ground);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(26, 420), std('#1d2b33', { roughness: 0.15, metalness: 0.4, flatShading: false }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = -1.6;
  scene.add(water);

  const R = rng(21);
  const A = fortress(R, '#9a9282'), B = fortress(R, '#8f8a80');
  const groundAt = (x, z) => terrainNoise(x, z, 2) * 1.6 + river(x, z);
  A.group.position.set(-24, groundAt(-24, 0) - 0.3, 0);
  B.group.position.set(24, groundAt(24, 0) - 0.3, 4);
  scene.add(A.group, B.group);

  const far = [];
  const spots = [[-80, -70], [70, -95], [-30, -140], [120, -40], [-130, -20], [20, -200], [150, -150], [-170, -120]];
  for (const [x, z] of spots) {
    const f = fortress(R, '#8a857c');
    f.group.position.set(x, groundAt(x, z) - 0.3, z);
    f.group.rotation.y = R() * 3;
    scene.add(f.group);
    far.push({ f, d: R() * 0.5 });
  }

  // A few hundred trees for scale.
  const treeGeo = new THREE.ConeGeometry(0.9, 3.2, 6);
  treeGeo.translate(0, 1.6, 0);
  const trees = new THREE.InstancedMesh(treeGeo, std('#27321f'), 420);
  trees.castShadow = true;
  const tmp = new THREE.Object3D();
  let n = 0;
  while (n < 420) {
    const x = (R() - 0.5) * 360, z = (R() - 0.5) * 360;
    if (Math.abs(x) < 9) continue;
    if (Math.hypot(x + 24, z) < 16 || Math.hypot(x - 24, z - 4) < 16) continue;
    if (spots.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 15)) continue;
    tmp.position.set(x, groundAt(x, z) - 0.2, z);
    tmp.scale.setScalar(0.7 + R() * 0.9);
    tmp.rotation.y = R() * 6;
    tmp.updateMatrix();
    trees.setMatrixAt(n++, tmp.matrix);
  }
  scene.add(trees);

  function update(t, p) {
    sky.position.copy(p.camera.position);
    A.set(p.wallsA ?? 0, p.tensionA ?? 0, t);
    B.set(p.wallsB ?? 0, p.tensionB ?? 0, t + 1);
    for (const { f, d } of far) f.set(clamp((p.farWalls ?? 0) * 3.4 - d * 3), p.farTension ?? 0, t + d * 10);
  }
  return { scene, update, A: A.group.position, B: B.group.position };
}

// ---------------------------------------------------------------------------
// The world table: five pillars of power and the coalitions between them.
// ---------------------------------------------------------------------------
export const POWERS = [
  { id: 'us', name: 'United States', at: [-98, 39], color: '#6f9fd8' },
  { id: 'eu', name: 'France', at: [2.3, 47], color: '#e6c56a' },
  { id: 'ru', name: 'Russia', at: [40, 56], color: '#d0655a' },
  { id: 'cn', name: 'China', at: [106, 34], color: '#df9a4c' },
  { id: 'in', name: 'India', at: [78.5, 22], color: '#63b893' },
];

export function buildWorld(countries) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#0d1219', 0.0052);
  const sky = skyDome('#06090e', '#141c26', '#0b1016');
  scene.add(sky);
  scene.add(new THREE.HemisphereLight('#3a4a62', '#0b0d10', 0.9));
  const sun = new THREE.DirectionalLight('#ffd9ad', 2.0);
  sun.position.set(-40, 60, 40);
  scene.add(sun);

  const proj = geoEqualEarth().fitExtent([[-80, -40], [80, 40]], { type: 'Sphere' });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), std('#101921', { roughness: 0.7, flatShading: false }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.05;
  scene.add(water);
  scene.add(linesToSegments(projectLines(geoGraticule10(), proj), 0.02,
    new THREE.LineBasicMaterial({ color: '#3a4c60', transparent: true, opacity: 0.3 })));

  const landMat = new THREE.MeshStandardMaterial({ color: '#716a5d', roughness: 0.9 });
  const edgeMat = new THREE.LineBasicMaterial({ color: '#d8ccb0', transparent: true, opacity: 0.28 });
  for (const f of countries.features) {
    if (f.properties.name === 'Antarctica') continue;
    const shapes = polygonsToShapes(projectPolygons(f, proj), 0.005);
    if (!shapes.length) continue;
    scene.add(extrudeShapes(shapes, 0.6, landMat), shapeOutlines(shapes, 0.62, edgeMat));
  }

  const pillars = POWERS.map((pw) => {
    const [x, z] = proj(pw.at);
    const mat = new THREE.MeshStandardMaterial({ color: pw.color, emissive: pw.color, emissiveIntensity: 0.6, roughness: 0.4 });
    const geo = new THREE.CylinderGeometry(1.1, 1.1, 1, 12);
    geo.translate(0, 0.5, 0);
    const col = new THREE.Mesh(geo, mat);
    col.position.set(x, 0.6, z);
    const base = glow(pw.color, 9, 1.2);
    base.position.set(x, 0.9, z);
    const tip = glow(pw.color, 6, 2);
    scene.add(col, base, tip);
    return { ...pw, x, z, col, mat, tip, base };
  });

  // Coalition arcs among the four powers that balance against the fifth.
  const links = [['us', 'ru'], ['ru', 'in'], ['ru', 'cn'], ['cn', 'in'], ['us', 'in']].map(([a, b], i) => {
    const pa = pillars.find((p) => p.id === a), pb = pillars.find((p) => p.id === b);
    const mid = v3((pa.x + pb.x) / 2, 0, (pa.z + pb.z) / 2);
    const d = Math.hypot(pa.x - pb.x, pa.z - pb.z);
    const curve = new THREE.QuadraticBezierCurve3(v3(pa.x, 0, pa.z), mid.setY(d * 0.18), v3(pb.x, 0, pb.z));
    const geo = new THREE.TubeGeometry(curve, 80, 0.22, 6, false);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fd4ff').multiplyScalar(2.2), transparent: true, fog: false });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    return { mesh, geo, mat, delay: i * 0.12, a: pa, b: pb };
  });

  function update(t, p) {
    sky.position.copy(p.camera.position);
    for (const pl of pillars) {
      const h = p.heights?.[pl.id] ?? 4;
      pl.col.scale.y = h;
      pl.tip.position.set(pl.x, 0.6 + h + 0.4, pl.z);
      const hot = p.hot === pl.id ? (p.heat ?? 0) : 0;
      pl.mat.emissiveIntensity = 0.5 + hot * (1.4 + 0.4 * Math.sin(t * 5));
      pl.tip.material.opacity = 0.8 + hot * 0.6;
      pl.base.material.opacity = 0.7 + hot;
    }
    for (const l of links) {
      const u = smooth(l.delay, l.delay + 0.5, p.links ?? 0);
      const count = l.geo.index.count;
      l.geo.setDrawRange(0, Math.floor((count * u) / 6) * 6);
      l.mat.opacity = (p.linkFade ?? 1) * (0.7 + 0.3 * Math.sin(t * 2 + l.delay * 10));
      l.mesh.visible = u > 0.001;
      // Keep arcs anchored to the pillar tops as they grow.
      const ha = (p.heights?.[l.a.id] ?? 4), hb = (p.heights?.[l.b.id] ?? 4);
      l.mesh.position.y = 0.6 + Math.min(ha, hb);
    }
  }
  return { scene, update, pillars, proj };
}

// ---------------------------------------------------------------------------
// Trinity, 1945: the desert at dawn and the first cloud.
// ---------------------------------------------------------------------------
export function buildTrinity() {
  const scene = new THREE.Scene();
  const fog = new THREE.FogExp2('#6a5a58', 0.0042);
  scene.fog = fog;
  const dawn = v3(0.8, 0.05, -1).normalize();
  const sky = skyDome('#101628', '#c08466', '#4b3a34', dawn, '#ff9e62');
  scene.add(sky);
  const hemi = new THREE.HemisphereLight('#6b7896', '#2a1d16', 0.8);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffb07a', 1.2);
  sun.position.copy(dawn.clone().multiplyScalar(100));
  scene.add(sun);

  const ground = terrain(900, 160, 1.2, '#7a6048', 5);
  scene.add(ground);
  // A ring of jagged mountains on the horizon.
  const R = rng(4);
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2 + R() * 0.05;
    const r = 330 + R() * 60;
    const h = 20 + R() * 45;
    const m = new THREE.Mesh(new THREE.ConeGeometry(18 + R() * 30, h, 5), std('#4b3a33'));
    m.position.set(Math.cos(a) * r, h / 2 - 3, Math.sin(a) * r - 120);
    m.rotation.y = R() * 3;
    scene.add(m);
  }

  // The cloud: a column and a boiling cap of faceted puffs.
  const ground0 = v3(0, 0, -170);
  const cloud = new THREE.Group();
  cloud.position.copy(ground0);
  scene.add(cloud);
  const puffMat = new THREE.MeshStandardMaterial({ color: '#7a6c62', emissive: '#ffd08a', emissiveIntensity: 4, roughness: 1, flatShading: true });
  const puffs = [];
  const C = rng(9);
  for (let i = 0; i < 80; i++) {
    const cap = i < 56;
    const a = C() * 6.28, r = cap ? 0.5 + C() * 0.6 : C() * 0.25;
    const y = cap ? 0.85 + (C() - 0.5) * 0.25 : C() * 0.8;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), puffMat);
    cloud.add(m);
    puffs.push({ m, a, r, y, s: cap ? 0.22 + C() * 0.2 : 0.12 + C() * 0.07, cap, ph: C() * 6 });
  }
  const skirt = new THREE.Mesh(new THREE.TorusGeometry(1, 0.35, 6, 18), puffMat);
  skirt.rotation.x = Math.PI / 2;
  cloud.add(skirt);
  const fireball = glow('#fff2c8', 1, 4);
  cloud.add(fireball);
  const flashLight = new THREE.PointLight('#ffe2a8', 0, 0, 1.2);
  flashLight.position.set(0, 30, 0);
  cloud.add(flashLight);

  const bgFog = new THREE.Color('#6a5a58'), hotFog = new THREE.Color('#d9a070');
  function update(t, p) {
    sky.position.copy(p.camera.position);
    const g = p.grow ?? 0; // 0 before the blast, then 0 → 1
    const flash = p.flash ?? 0;
    cloud.visible = g > 0;
    const H = 12 + 150 * Math.pow(g, 0.7), W = 10 + 70 * Math.pow(g, 0.6);
    for (const q of puffs) {
      const boil = 1 + 0.08 * Math.sin(t * 1.3 + q.ph);
      const a = q.a + t * 0.05 * (q.cap ? 1 : -1);
      if (q.cap) q.m.position.set(Math.cos(a) * q.r * W * 0.9, q.y * H, Math.sin(a) * q.r * W * 0.9);
      else q.m.position.set(Math.cos(a) * q.r * W * 0.25, q.y * H * 0.85, Math.sin(a) * q.r * W * 0.25);
      q.m.scale.setScalar(q.s * W * boil * (q.cap ? 1 : 0.9));
      q.m.rotation.set(q.ph + t * 0.1, q.ph * 2, 0);
    }
    skirt.position.y = H * 0.55;
    skirt.scale.setScalar(W * 0.35 * smooth(0.2, 0.7, g));
    skirt.visible = g > 0.2;
    const heat = Math.exp(-g * 9);
    puffMat.emissive.setRGB(1, 0.55 + heat * 0.35, 0.25 + heat * 0.5);
    puffMat.emissiveIntensity = 0.02 + heat * 4;
    fireball.position.y = H * 0.85;
    fireball.scale.setScalar(W * 2.5);
    fireball.material.opacity = heat;
    flashLight.intensity = flash * 40000 + heat * 2500;
    fog.color.copy(bgFog).lerp(hotFog, clamp(flash * 0.8 + heat * 0.4 * (g > 0 ? 1 : 0)));
  }
  return { scene, update, ground0 };
}

// ---------------------------------------------------------------------------
// The Doomsday Clock.
// ---------------------------------------------------------------------------
export function buildClock() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#07090c', 0.012);
  const sky = skyDome('#020305', '#0c1016', '#020304');
  scene.add(sky);
  scene.add(new THREE.HemisphereLight('#44506a', '#050505', 0.6));
  const key = new THREE.SpotLight('#ffe0bc', 3000, 0, 0.5, 0.6, 1.6);
  key.position.set(-30, 45, 60);
  scene.add(key);

  const face = new THREE.Group();
  scene.add(face);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 1.2, 60), new THREE.MeshStandardMaterial({ color: '#16191e', roughness: 0.55, metalness: 0.4 }));
  disc.rotation.x = Math.PI / 2;
  face.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(20.2, 0.5, 8, 80), new THREE.MeshStandardMaterial({ color: '#6c6558', roughness: 0.4, metalness: 0.8 }));
  face.add(rim);
  const bone = std('#d9d0bb');
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const major = i % 5 === 0;
    const m = new THREE.Mesh(new THREE.BoxGeometry(major ? 0.7 : 0.25, major ? 2.6 : 1.0, 0.3), i === 0 ? new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff4a2a').multiplyScalar(3) }) : bone);
    const r = major ? 17 : 17.8;
    m.position.set(Math.sin(a) * r, Math.cos(a) * r, 0.75);
    m.rotation.z = -a;
    face.add(m);
  }
  const midnightGlow = glow('#ff4a2a', 9, 1.5);
  midnightGlow.position.set(0, 17, 1.5);
  face.add(midnightGlow);

  const handMat = new THREE.MeshStandardMaterial({ color: '#e8e0cc', roughness: 0.5, metalness: 0.2 });
  const mkHand = (len, w) => {
    const g = new THREE.BoxGeometry(w, len, 0.35);
    g.translate(0, len / 2 - 1.2, 0);
    const pivot = new THREE.Group();
    pivot.add(new THREE.Mesh(g, handMat));
    pivot.position.z = 1.2;
    face.add(pivot);
    return pivot;
  };
  const hourHand = mkHand(11, 1.1), minuteHand = mkHand(16.5, 0.6);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.6, 16), handMat);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 1.5;
  face.add(hub);

  // Dust hanging in the light.
  const D = rng(5);
  const dust = [];
  for (let i = 0; i < 90; i++) {
    const s = glow('#ffe7c4', 0.25 + D() * 0.35, 0.8);
    scene.add(s);
    dust.push({ s, x: (D() - 0.5) * 70, y: (D() - 0.5) * 50, z: 5 + D() * 40, ph: D() * 6 });
  }

  function update(t, p) {
    sky.position.copy(p.camera.position);
    const minutes = p.minutes ?? 57; // minutes past eleven
    minuteHand.rotation.z = -(minutes / 60) * Math.PI * 2;
    hourHand.rotation.z = -((11 + minutes / 60) / 12) * Math.PI * 2;
    midnightGlow.material.opacity = 0.6 + 0.4 * Math.sin(t * 2);
    for (const d of dust) {
      d.s.position.set(d.x + Math.sin(t * 0.13 + d.ph) * 2, d.y + ((t * 0.3 + d.ph * 5) % 50) - 25, d.z);
      d.s.material.opacity = 0.5 + 0.5 * Math.sin(t * 0.7 + d.ph);
    }
  }
  return { scene, update };
}
