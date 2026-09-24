// Directs the film: shots, cameras and on-screen type, all driven by the
// narration timeline. window.seek(t) renders the frame at time t.
import * as THREE from 'three';
import { feature } from 'topojson-client';
import { clamp, smooth, ease, window01, v3 } from './lib.js';
import { Post } from './lib.js';
import { buildSea, buildEurope, buildForts, buildWorld, buildTrinity, buildClock } from './worlds.js';

const W = 1920, H = 1080;
const $ = (s) => document.querySelector(s);

async function json(url) { return (await fetch(url)).json(); }

async function init() {
  const [timeline, c50, c110] = await Promise.all([
    json('/build/timeline.json'),
    json('/node_modules/world-atlas/countries-50m.json'),
    json('/node_modules/world-atlas/countries-110m.json'),
  ]);
  await document.fonts.load('300 40px Cormorant');
  await document.fonts.load('italic 400 40px Cormorant');
  await document.fonts.load('500 40px Cormorant');
  await document.fonts.load('300 20px Inter');
  await document.fonts.load('400 20px Inter');
  await document.fonts.load('500 20px Inter');
  await document.fonts.ready;

  const renderer = new THREE.WebGLRenderer({ canvas: $('#c'), antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const post = new Post(renderer, W, H);
  const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 4000);

  // ---- Timeline lookups ----
  const S = (id) => timeline.scenes.find((s) => s.id === id);
  const L = (id, i) => S(id).lines[i];

  const worlds = {
    sea: buildSea(),
    europe: buildEurope(feature(c50, c50.objects.countries)),
    forts: buildForts(),
    world: buildWorld(feature(c110, c110.objects.countries)),
    trinity: buildTrinity(),
    clock: buildClock(),
  };

  // Keyframed camera: [{ t, pos, look }], eased between keys, with a slow handheld drift.
  const path = (keys, drift = 0.25) => (t) => {
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1].t) i++;
    const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
    const u = b.t === a.t ? 1 : ease((t - a.t) / (b.t - a.t));
    const pos = a.pos.clone().lerp(b.pos, u);
    const look = a.look.clone().lerp(b.look, u);
    pos.x += Math.sin(t * 0.31) * drift; pos.y += Math.sin(t * 0.23 + 1) * drift * 0.6;
    look.x += Math.sin(t * 0.19 + 2) * drift * 0.5;
    return { pos, look };
  };
  const K = (t, pos, look) => ({ t, pos: v3(...pos), look: v3(...look) });

  const open = S('open'), title = S('title'), wes = S('westphalia'), dil = S('dilemma');
  const bal = S('balance'), mid = S('midnight'), close = S('close'), end = S('end');

  // A chapter opens on black with its card, then the scene fades up.
  const chapterFade = (sc) => (t) => smooth(sc.start + sc.lead - 1.3, sc.start + sc.lead + 0.6, t);
  const blast = L('midnight', 0).end + 0.1;
  const clockCut = L('midnight', 2).start - 0.3;

  const shots = [
    {
      world: 'sea', start: open.start, end: title.end,
      fade: (t) => smooth(0, 3.0, t) * (1 - 0.72 * smooth(title.start - 0.5, title.start + 1.5, t)) * (1 - smooth(title.end - 1.0, title.end, t)),
      cam: path([
        K(0, [2.5, 1.5, 40], [0, 1.6, 0]),
        K(L('open', 3).start, [1.6, 2.3, 11.5], [0, 1.5, 0]),
        K(L('open', 3).end + 1.2, [0, 30, 34], [0, 0, -40]),
        K(title.end, [0, 38, 22], [0, 0, -70]),
      ], 0.15),
      params: (t) => ({ walls: smooth(L('open', 2).start - 0.5, L('open', 2).end + 2, t), lights: 1, beams: 1 }),
      look: { exposure: 1.15, bloom: 0.9, threshold: 0.8 },
    },
    {
      world: 'europe', start: wes.start, end: wes.end,
      fade: (t) => chapterFade(wes)(t) * (1 - 0.7 * window01(t, L('westphalia', 3).start + 3.2, wes.end + 5, 1.2)) * (1 - smooth(wes.end - 0.8, wes.end, t)),
      cam: path([
        K(wes.start, [-18, 66, 82], [-2, 0, -4]),
        K(wes.start + wes.lead, [-16, 60, 74], [-2, 0, -4]),
        K(L('westphalia', 2).start, [-7, 34, 42], [-1, 0, -3]),
        K(L('westphalia', 3).start + 1, [12, 92, 96], [0, 0, -12]),
        K(wes.end, [16, 100, 104], [0, 0, -14]),
      ], 0.3),
      params: (t) => ({
        war: window01(t, L('westphalia', 0).start - 0.5, L('westphalia', 1).start + 0.5, 1.5, 2),
        pin: window01(t, L('westphalia', 0).end - 2.4, L('westphalia', 3).start, 0.8),
        crown: window01(t, L('westphalia', 1).end - 0.8, L('westphalia', 2).end + 1, 1.2),
        crownLift: smooth(L('westphalia', 2).start + 0.4, L('westphalia', 2).start + 3.8, t),
        split: smooth(L('westphalia', 2).start + 2.6, L('westphalia', 3).start + 1.5, t),
      }),
      labels: [{ at: () => worlds.europe.munster, html: 'Münster<small>Osnabrück · Westphalia</small>', show: (t) => window01(t, L('westphalia', 0).end - 2, L('westphalia', 3).start, 0.8) }],
      look: { exposure: 1.1, bloom: 0.8, threshold: 0.85 },
    },
    {
      world: 'forts', start: dil.start, end: dil.end,
      fade: (t) => chapterFade(dil)(t) * (1 - smooth(dil.end - 0.8, dil.end, t)),
      cam: path([
        K(dil.start, [0, 34, 78], [0, 2, 0]),
        K(L('dilemma', 0).start, [-4, 24, 62], [0, 2, 0]),
        K(L('dilemma', 1).start + 0.4, [-40, 11, 30], [-24, 3, 0]),
        K(L('dilemma', 2).start + 0.4, [42, 9, 24], [-20, 4, 0]),
        K(L('dilemma', 3).start + 0.8, [2, 26, 56], [0, 2, 2]),
        K(L('dilemma', 4).start + 1, [-12, 12, 44], [2, 3, 2]),
        K(L('dilemma', 5).start, [-8, 16, 48], [2, 3, 0]),
        K(dil.end, [0, 78, 120], [0, 0, -50]),
      ], 0.3),
      params: (t) => {
        const l = (i) => L('dilemma', i);
        return {
          wallsA: smooth(l(1).start + 0.3, l(1).end + 0.3, t) + smooth(l(3).end - 0.6, l(4).start + 0.8, t) + smooth(l(5).start + 0.9, l(5).end + 0.3, t),
          wallsB: smooth(l(3).start, l(3).start + 2.4, t) * 2 + smooth(l(5).start, l(5).start + 1.6, t),
          tensionB: smooth(l(2).start, l(2).start + 2.5, t),
          tensionA: smooth(l(3).start + 2.6, l(3).end, t),
          farWalls: smooth(l(5).start + 0.4, dil.end, t),
          farTension: smooth(l(5).start + 1, dil.end, t),
        };
      },
      cite: { who: 'Robert Jervis', what: '“Cooperation Under the Security Dilemma,” <i>World Politics</i>, 1978', show: (t) => window01(t, L('dilemma', 4).start + 0.6, L('dilemma', 5).end + 0.2, 0.8) },
      look: { exposure: 1.05, bloom: 0.55, threshold: 1.0, sat: 0.8 },
    },
    {
      world: 'world', start: bal.start, end: bal.end,
      fade: (t) => chapterFade(bal)(t) * (1 - smooth(bal.end - 0.8, bal.end, t)),
      cam: path([
        K(bal.start, [0, 66, 88], [0, 0, -2]),
        K(L('balance', 0).start, [0, 62, 80], [0, 0, -2]),
        K(L('balance', 1).start + 1, [-12, 36, 42], [8, 4, -10]),
        K(L('balance', 3).start, [4, 40, 46], [12, 4, -10]),
        K(bal.end, [0, 80, 100], [2, 0, -6]),
      ], 0.3),
      params: (t) => {
        const l = (i) => L('balance', i);
        const rise = smooth(l(1).start, l(1).start + 2.8, t), settle = smooth(l(3).start + 1, l(3).start + 5, t);
        const others = 4 + 2.5 * smooth(l(1).start + 2.4, l(1).end + 1.5, t) * (1 - settle) + 1.5 * settle;
        return {
          hot: 'eu',
          heat: rise * (1 - settle),
          heights: { eu: 4 + 10 * rise - 8.5 * settle, us: others, ru: others, cn: others, in: others },
          links: smooth(l(1).start + 2.2, l(2).start + 1, t),
          linkFade: 1 - 0.6 * settle,
        };
      },
      labels: [{ at: () => { const p = worlds.world.pillars[1]; return v3(p.x, 0.6 + p.col.scale.y + 2.2, p.z); }, html: 'The rising power', show: (t) => window01(t, L('balance', 1).start + 1.2, L('balance', 2).start, 0.6) }],
      captions: [
        { place: 'The Napoleonic Wars', date: '1803 – 1815', show: (t) => window01(t, L('balance', 2).start - 0.2, L('balance', 2).start + 1.7, 0.4) },
        { place: 'The First World War', date: '1914 – 1918', show: (t) => window01(t, L('balance', 2).start + 1.8, L('balance', 3).start, 0.4) },
      ],
      cite: { who: 'Kenneth Waltz', what: '<i>Theory of International Politics</i>, 1979', show: (t) => window01(t, L('balance', 3).start + 0.6, bal.end - 0.4, 0.8) },
      look: { exposure: 1.1, bloom: 0.8, threshold: 0.85 },
    },
    {
      world: 'trinity', start: mid.start, end: clockCut,
      fade: (t) => chapterFade(mid)(t) * (1 - smooth(clockCut - 0.7, clockCut, t)),
      cam: path([
        K(mid.start, [0, 3.2, 130], [0, 22, -170]),
        K(blast, [0, 3.2, 118], [0, 24, -170]),
        K(clockCut, [6, 4.5, 96], [0, 95, -170]),
      ], 0.12),
      params: (t) => ({ grow: t < blast ? 0 : clamp((t - blast) / 11), flash: t < blast ? 0 : Math.exp(-(t - blast) * 2.2) }),
      exposure: (t) => 1 + (t < blast ? 0 : 5 * Math.exp(-(t - blast) * 2.5)),
      captions: [{ place: 'Trinity Site, New Mexico', date: '16 July 1945 · 5:29 a.m.', show: (t) => window01(t, blast + 1.6, clockCut - 0.2, 0.8) }],
      look: { exposure: 1.0, bloom: 1.0, threshold: 0.9, sat: 0.9 },
    },
    {
      world: 'clock', start: clockCut, end: mid.end,
      fade: (t) => smooth(clockCut, clockCut + 1.0, t) * (1 - smooth(mid.end - 0.9, mid.end, t)),
      cam: path([
        K(clockCut, [-16, -17, 40], [-3, 9, 0]),
        K(mid.end, [-7, -5, 25], [-1.5, 13, 0]),
      ], 0.15),
      params: (t) => {
        // The minute hand steps once a second, in time with the ticking.
        const u = t - clockCut, s = Math.floor(u), f = u - s;
        const step = s + smooth(0, 0.12, f);
        return { minutes: 57.2 + step * 0.075 };
      },
      cite: { who: 'Thomas Schelling', what: '<i>Arms and Influence</i>, 1966', show: (t) => window01(t, L('midnight', 2).start + 0.4, L('midnight', 2).end, 0.8) },
      captions: [{ place: 'The Doomsday Clock', date: 'Bulletin of the Atomic Scientists, since 1947', show: (t) => window01(t, L('midnight', 3).start - 0.2, mid.end - 0.4, 0.8) }],
      look: { exposure: 1.15, bloom: 0.8, threshold: 0.8 },
    },
    {
      world: 'sea', start: close.start, end: end.end,
      fade: (t) => smooth(close.start, close.start + 2.2, t) * (1 - 0.72 * smooth(end.start - 0.5, end.start + 1.5, t)) * (1 - smooth(end.end - 1.6, end.end, t)),
      cam: path([
        K(close.start, [-40, 52, 78], [0, 0, -40]),
        K(end.start, [18, 30, 48], [0, 0, -30]),
        K(end.end, [26, 26, 40], [0, 0, -34]),
      ], 0.2),
      params: () => ({ walls: 1, lights: 1, beams: 1 }),
      look: { exposure: 1.15, bloom: 0.9, threshold: 0.8 },
    },
  ];

  // ---- Type ----
  const subs = timeline.scenes.flatMap((s) => s.lines);
  const chapters = timeline.scenes.filter((s) => s.chapter);
  const el = { caption: $('#caption'), cite: $('#cite'), define: $('#define'), chapter: $('#chapter'), title: $('#title'), end: $('#end'), subs: $('#subs'), labels: $('#labels') };
  $('#title p').textContent = timeline.subtitle;
  const setOpacity = (e, o, rise = 0) => {
    e.style.opacity = o.toFixed(3);
    if (rise) e.style.translate = `0 ${((1 - o) * rise).toFixed(1)}px`;
  };

  function overlays(t, shot) {
    // Subtitles.
    const line = subs.find((l) => t >= l.start - 0.1 && t <= l.end + 0.4);
    if (line) { el.subs.textContent = line.text; setOpacity(el.subs, window01(t, line.start - 0.1, line.end + 0.4, 0.15, 0.25)); }
    else setOpacity(el.subs, 0);

    // Chapter cards.
    const ch = chapters.find((s) => t >= s.start && t < s.start + s.lead);
    if (ch) {
      el.chapter.querySelector('.num').textContent = ch.chapter;
      el.chapter.querySelector('.name').textContent = ch.chapterTitle;
      setOpacity(el.chapter, window01(t, ch.start + 0.35, ch.start + ch.lead - 0.3, 0.9, 0.8), 10);
    } else setOpacity(el.chapter, 0);

    setOpacity(el.title, window01(t, title.start + 0.5, title.end - 0.25, 1.4, 1.0), 12);
    setOpacity(el.end, window01(t, end.start + 0.6, end.end - 1.4, 1.4, 1.2), 12);
    setOpacity(el.define, shot.world === 'europe' ? window01(t, L('westphalia', 3).start + 3.3, wes.end - 0.5, 1.0, 0.8) : 0, 10);

    const cap = (shot.captions || []).find((c) => c.show(t) > 0);
    if (cap) {
      el.caption.querySelector('.place').textContent = cap.place;
      el.caption.querySelector('.date').textContent = cap.date;
      setOpacity(el.caption, cap.show(t), 6);
    } else setOpacity(el.caption, 0);

    const cite = shot.cite && shot.cite.show(t) > 0 ? shot.cite : null;
    if (cite) {
      el.cite.querySelector('.who').textContent = cite.who;
      el.cite.querySelector('.what').innerHTML = cite.what;
      setOpacity(el.cite, cite.show(t), 6);
    } else setOpacity(el.cite, 0);

    el.labels.innerHTML = '';
    for (const lb of shot.labels || []) {
      const o = lb.show(t);
      if (o <= 0) continue;
      const p = lb.at().clone().project(camera);
      const d = document.createElement('div');
      d.className = 'label';
      d.innerHTML = lb.html;
      d.style.left = `${((p.x + 1) / 2) * W}px`;
      d.style.top = `${((1 - p.y) / 2) * H}px`;
      d.style.opacity = o.toFixed(3);
      el.labels.appendChild(d);
    }
  }

  function seek(t) {
    const shot = shots.find((s) => t >= s.start && t < s.end) || shots[shots.length - 1];
    const world = worlds[shot.world];
    const { pos, look } = shot.cam(t);
    camera.position.copy(pos);
    camera.lookAt(look);
    camera.updateMatrixWorld();
    world.update(t, { ...shot.params(t), camera });
    const opts = { ...shot.look, fade: clamp(shot.fade(t)), seed: (t * 24) % 97 };
    if (shot.exposure) opts.exposure = (shot.look.exposure ?? 1) * shot.exposure(t);
    post.render(world.scene, camera, opts);
    overlays(t, shot);
  }

  window.duration = timeline.duration;
  window.seek = seek;
  seek(0);
}

window.ready = init().then(() => true, (e) => { console.error(e); window.initError = String(e.stack || e); return false; });
