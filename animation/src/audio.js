// Procedural score and sound design. Every sound is synthesized with WebAudio nodes and
// scheduled against the same timeline as the picture. Works offline (render) and live (player).
import { T, BEAT, beat, rng, physics, ball2D, camFrame, W } from './core.js';
import { rampStart } from './worlds/chrome.js';
import { passBys, facetLandTimes } from './worlds/vortex.js';
import { endcardEvents } from './worlds/endcard.js';

const SR = 48000;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

function makeIR(ctx, dur, decay) {
  const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(2, n, ctx.sampleRate);
  const r = rng(4242);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / ctx.sampleRate;
      const white = r() * 2 - 1;
      lp += (white - lp) * (0.9 - 0.75 * Math.min(1, t / dur)); // darker tail
      d[i] = lp * Math.pow(1 - t / dur, decay) * (t < 0.012 ? t / 0.012 : 1);
    }
  }
  return buf;
}

function build(ctx, T0) {
  const at = (t) => T0 + t;
  const R = rng(777);

  // ---------------------------------------------------------------- buses
  const master = ctx.createGain(); master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.2;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
  const outG = ctx.createGain(); outG.gain.value = 1.22;
  // Final soft clipper (input ±1 maps across the curve): linear to 0.72, then a tanh knee to ~0.95.
  const clip = ctx.createWaveShaper();
  {
    const n = 4096, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1, ax = Math.abs(x);
      c[i] = Math.sign(x) * (ax < 0.72 ? ax : 0.72 + 0.23 * Math.tanh((ax - 0.72) / 0.23));
    }
    clip.curve = c; clip.oversample = '4x';
  }
  master.connect(comp); comp.connect(lim); lim.connect(outG); outG.connect(clip); clip.connect(ctx.destination);
  const verbIn = ctx.createGain();
  const verbHP = ctx.createBiquadFilter(); verbHP.type = 'highpass'; verbHP.frequency.value = 220;
  const conv = ctx.createConvolver(); conv.buffer = makeIR(ctx, 2.6, 2.4);
  const verbOut = ctx.createGain(); verbOut.gain.value = 0.55;
  verbIn.connect(verbHP); verbHP.connect(conv); conv.connect(verbOut); verbOut.connect(master);
  // Sidechained synth-bass bus for the chrome section
  const bassBus = ctx.createGain(); bassBus.gain.value = 1; bassBus.connect(master);

  const noiseBuf = (() => {
    const b = ctx.createBuffer(1, SR * 2, SR), d = b.getChannelData(0), r = rng(55);
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    return b;
  })();
  const chipNoiseBuf = (() => {
    const b = ctx.createBuffer(1, SR * 2, SR), d = b.getChannelData(0), r = rng(56);
    let v = 0;
    for (let i = 0; i < d.length; i++) { if (i % 24 === 0) v = r() < 0.5 ? -1 : 1; d[i] = v; }
    return b;
  })();
  const pulse = (duty) => {
    const n = 64, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    return ctx.createPeriodicWave(re, im);
  };
  const P25 = pulse(0.25), P125 = pulse(0.125);
  const shaper = (() => {
    const s = ctx.createWaveShaper(), n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * 2.5) / Math.tanh(2.5); }
    s.curve = c;
    return s;
  })();
  shaper.connect(master);

  function route(node, { gain = 1, pan = 0, verb = 0, dest = master } = {}) {
    const g = ctx.createGain(); g.gain.value = gain;
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(g); g.connect(p); p.connect(dest);
    if (verb) { const s = ctx.createGain(); s.gain.value = verb; p.connect(s); s.connect(verbIn); }
    return { g, p };
  }
  function envGain(t, a, dur, peak, curve = 'exp') {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at(t));
    g.gain.linearRampToValueAtTime(peak, at(t + a));
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, at(t + dur));
    else g.gain.linearRampToValueAtTime(0, at(t + dur));
    return g;
  }
  function osc(type, f, t, dur, { gain = 0.3, a = 0.004, f1 = null, glide = null, lin = false, pan = 0, verb = 0, dest, wave, detune = 0, curve = 'exp' } = {}) {
    const o = ctx.createOscillator();
    if (wave) o.setPeriodicWave(wave); else o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(f, at(t));
    if (f1) {
      const tg = at(t + (glide ?? dur));
      lin ? o.frequency.linearRampToValueAtTime(f1, tg) : o.frequency.exponentialRampToValueAtTime(f1, tg);
    }
    const g = envGain(t, a, dur, gain, curve);
    o.connect(g);
    route(g, { pan, verb, dest });
    o.start(at(t)); o.stop(at(t + dur + 0.05));
    return o;
  }
  function noise(t, dur, { type = 'bandpass', f = 1000, f1 = null, Q = 1, gain = 0.3, a = 0.002, pan = 0, pan1 = null, verb = 0, dest, buf, curve = 'exp' } = {}) {
    const s = ctx.createBufferSource();
    s.buffer = buf || noiseBuf; s.loop = true;
    const flt = ctx.createBiquadFilter();
    flt.type = type; flt.Q.value = Q;
    flt.frequency.setValueAtTime(f, at(t));
    if (f1) flt.frequency.exponentialRampToValueAtTime(f1, at(t + dur));
    const g = envGain(t, a, dur, gain, curve);
    s.connect(flt); flt.connect(g);
    const { p } = route(g, { pan, verb, dest });
    if (pan1 !== null) { p.pan.setValueAtTime(pan, at(t)); p.pan.linearRampToValueAtTime(pan1, at(t + dur)); }
    s.start(at(t), R() * 1.5); s.stop(at(t + dur + 0.05));
    return { s, flt, g };
  }

  // ---------------------------------------------------------------- instruments
  const kick = (t, gain = 0.8, f0 = 150, f1 = 44, dec = 0.34) => {
    osc('sine', f0, t, dec, { gain, a: 0.002, f1, glide: 0.07 });
    noise(t, 0.012, { type: 'highpass', f: 3000, gain: gain * 0.25 });
  };
  const snare = (t, gain = 0.4, pan = 0) => {
    noise(t, 0.2, { type: 'bandpass', f: 1900, Q: 0.7, gain, pan, verb: 0.25 });
    osc('triangle', 200, t, 0.09, { gain: gain * 0.6, f1: 150, pan });
  };
  const clap = (t, gain = 0.35, pan = 0) => {
    for (const d of [0, 0.011, 0.023]) noise(t + d, 0.02, { type: 'bandpass', f: 1300, Q: 1.3, gain, pan });
    noise(t + 0.03, 0.16, { type: 'bandpass', f: 1200, Q: 1.1, gain: gain * 0.8, pan, verb: 0.35 });
  };
  const hat = (t, gain = 0.08, open = false, pan = 0.2) => noise(t, open ? 0.18 : 0.035, { type: 'highpass', f: 7500, gain, pan });
  const woodTick = (t, gain = 0.2, f = 1700, pan = 0) => {
    osc('sine', f, t, 0.03, { gain, a: 0.001, pan });
    noise(t, 0.006, { type: 'bandpass', f: f * 1.6, Q: 3, gain: gain * 0.6, pan });
  };
  const pencilScratch = (t, dur, gain = 0.12, pan0 = 0, pan1 = 0, strokes = 0) => {
    const n = noise(t, dur, { type: 'bandpass', f: 4200, Q: 1.1, gain, a: 0.01, pan: pan0, pan1, curve: 'lin' });
    const body = noise(t, dur, { type: 'bandpass', f: 1400, Q: 2.5, gain: gain * 0.35, a: 0.01, pan: pan0, pan1, curve: 'lin' });
    // Grain of graphite on paper: jittery amplitude, optional stroke rhythm for hatching.
    const r = rng(Math.floor(t * 1000));
    for (const node of [n.g, body.g]) {
      const peak = node === n.g ? gain : gain * 0.35;
      node.gain.cancelScheduledValues(at(t));
      node.gain.setValueAtTime(0, at(t));
      for (let x = 0; x < dur; x += 0.012) {
        const strokeAmp = strokes ? Math.abs(Math.sin((x / dur) * Math.PI * strokes)) : 1;
        node.gain.linearRampToValueAtTime(peak * (0.35 + 0.65 * r()) * strokeAmp * Math.min(1, (dur - x) / 0.03), at(t + x));
      }
      node.gain.linearRampToValueAtTime(0, at(t + dur));
    }
  };
  const pencilTap = (t, gain = 0.3, pan = 0) => {
    noise(t, 0.012, { type: 'bandpass', f: 2600, Q: 2, gain, pan });
    osc('sine', 1100, t, 0.04, { gain: gain * 0.5, f1: 700, pan });
    osc('sine', 180, t, 0.08, { gain: gain * 0.5, f1: 90, pan });
  };
  const softThump = (t, gain = 0.4) => {
    osc('sine', 140, t, 0.22, { gain, f1: 55, glide: 0.1 });
    noise(t, 0.05, { type: 'lowpass', f: 900, gain: gain * 0.4 });
  };
  const boing = (t, gain = 0.4, dur = 0.62, base = 95) => {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(base, at(t)); o.frequency.exponentialRampToValueAtTime(base * 1.3, at(t + dur));
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 10;
    bp.frequency.setValueAtTime(420, at(t)); bp.frequency.exponentialRampToValueAtTime(1500, at(t + dur * 0.8));
    const lfo = ctx.createOscillator(); lfo.frequency.setValueAtTime(15, at(t)); lfo.frequency.exponentialRampToValueAtTime(5, at(t + dur));
    const depth = ctx.createGain(); depth.gain.setValueAtTime(650, at(t)); depth.gain.exponentialRampToValueAtTime(60, at(t + dur));
    lfo.connect(depth); depth.connect(bp.frequency);
    const g = envGain(t, 0.004, dur, gain);
    o.connect(bp); bp.connect(g); route(g, { verb: 0.15 });
    o.start(at(t)); o.stop(at(t + dur + 0.05)); lfo.start(at(t)); lfo.stop(at(t + dur + 0.05));
    // Spring "twang" layer with pitch vibrato
    const s = ctx.createOscillator(); s.type = 'sine';
    s.frequency.setValueAtTime(base * 2.6, at(t));
    const vib = ctx.createOscillator(); vib.frequency.value = 17;
    const vd = ctx.createGain(); vd.gain.setValueAtTime(70, at(t)); vd.gain.exponentialRampToValueAtTime(4, at(t + dur));
    vib.connect(vd); vd.connect(s.frequency);
    const sg = envGain(t, 0.003, dur * 0.8, gain * 0.5);
    s.connect(sg); route(sg, { verb: 0.1 });
    s.start(at(t)); s.stop(at(t + dur)); vib.start(at(t)); vib.stop(at(t + dur));
  };
  const slide = (t0, t1, f0, f1, gain = 0.08) => {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, at(t0)); o.frequency.exponentialRampToValueAtTime(f1, at(t1));
    const vib = ctx.createOscillator(); vib.frequency.value = 6;
    const vd = ctx.createGain(); vd.gain.value = f0 * 0.012;
    vib.connect(vd); vd.connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at(t0)); g.gain.linearRampToValueAtTime(gain, at(t0 + 0.03));
    g.gain.setValueAtTime(gain, at(t1 - 0.04)); g.gain.linearRampToValueAtTime(0, at(t1));
    o.connect(g); route(g, { verb: 0.2, pan: 0.15 });
    o.start(at(t0)); o.stop(at(t1 + 0.02)); vib.start(at(t0)); vib.stop(at(t1 + 0.02));
  };
  const xylo = (t, m, gain = 0.14, pan = 0) => {
    const f = mtof(m);
    osc('sine', f, t, 0.35, { gain, a: 0.002, pan, verb: 0.2 });
    osc('sine', f * 3.93, t, 0.06, { gain: gain * 0.4, a: 0.001, pan });
    noise(t, 0.008, { type: 'bandpass', f: f * 2, Q: 2, gain: gain * 0.5, pan });
  };
  const tri = (t, m, dur, gain = 0.3) => osc('triangle', mtof(m) * 1.03, t, dur, { gain, a: 0.004, f1: mtof(m), glide: 0.04 });
  const tamb = (t, gain = 0.07, pan = -0.3) => {
    noise(t, 0.09, { type: 'bandpass', f: 9000, Q: 4, gain, pan });
    noise(t, 0.05, { type: 'highpass', f: 6000, gain: gain * 0.7, pan });
  };
  const paperCrunch = (t, dur, gain = 0.2, n = 30, seed = 1, pan = 0) => {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const tt = t + Math.pow(r(), 1.6) * dur;
      noise(tt, 0.006 + r() * 0.02, { type: 'bandpass', f: 1500 + r() * 5000, Q: 1.5 + r() * 3, gain: gain * (0.3 + 0.7 * r()), pan: pan + (r() - 0.5) * 0.6 });
    }
  };
  const paperThump = (t, gain = 0.45) => {
    osc('sine', 120, t, 0.2, { gain, f1: 55, glide: 0.12 });
    noise(t, 0.09, { type: 'lowpass', f: 700, gain: gain * 0.5 });
  };
  const pop = (t, gain = 0.2, f0 = 1100, pan = 0) => osc('sine', f0, t, 0.08, { gain, a: 0.001, f1: 170, glide: 0.05, pan, verb: 0.1 });
  const kalimba = (t, m, gain = 0.13, pan = 0) => {
    const f = mtof(m);
    osc('sine', f, t, 0.7, { gain, a: 0.002, pan, verb: 0.3 });
    osc('sine', f * 5.4, t, 0.09, { gain: gain * 0.35, a: 0.001, pan });
    osc('triangle', f * 2, t, 0.18, { gain: gain * 0.25, a: 0.001, pan });
  };
  const shaker = (t, gain = 0.04, pan = 0.3) => noise(t, 0.035, { type: 'bandpass', f: 5200, Q: 0.9, gain, pan });
  // 8-bit: volume envelope stepped per 1/60s like a console APU
  const chip = (t, f, dur, { gain = 0.1, wave = P25, f1 = null, steps = null, pan = 0 } = {}) => {
    const o = ctx.createOscillator(); o.setPeriodicWave(wave);
    const g = ctx.createGain();
    o.frequency.setValueAtTime(f, at(t));
    if (steps) steps.forEach(([dt, ff]) => o.frequency.setValueAtTime(ff, at(t + dt)));
    else if (f1) { const n = Math.max(1, Math.floor(dur * 60)); for (let i = 1; i <= n; i++) o.frequency.setValueAtTime(f * (f1 / f) ** (i / n), at(t + i / 60)); }
    const n = Math.max(1, Math.floor(dur * 60));
    for (let i = 0; i <= n; i++) g.gain.setValueAtTime(gain * (1 - i / (n + 1)), at(t + i / 60));
    g.gain.setValueAtTime(0, at(t + dur));
    o.connect(g); route(g, { pan });
    o.start(at(t)); o.stop(at(t + dur + 0.02));
  };
  const chipNoise = (t, dur, gain = 0.08, rate = 1, pan = 0) => {
    const s = ctx.createBufferSource(); s.buffer = chipNoiseBuf; s.loop = true; s.playbackRate.value = rate;
    const g = ctx.createGain();
    const n = Math.max(1, Math.floor(dur * 60));
    for (let i = 0; i <= n; i++) g.gain.setValueAtTime(gain * (1 - i / (n + 1)), at(t + i / 60));
    g.gain.setValueAtTime(0, at(t + dur));
    s.connect(g); route(g, { pan });
    s.start(at(t), R()); s.stop(at(t + dur + 0.02));
  };
  const metal = (t, gain = 0.3, f = 440, pan = 0) => {
    const ratios = [1, 2.756, 5.404, 8.933, 13.34], amps = [1, 0.55, 0.35, 0.22, 0.12], decs = [1.4, 0.9, 0.55, 0.38, 0.26];
    ratios.forEach((k, i) => osc('sine', f * k, t, decs[i], { gain: gain * amps[i], a: 0.001, pan, verb: 0.35 }));
    noise(t, 0.015, { type: 'highpass', f: 2500, gain: gain * 0.6, pan });
  };
  const sub = (t, gain = 0.7, dur = 0.9, f0 = 70, f1 = 30) => {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, at(t)); o.frequency.exponentialRampToValueAtTime(f1, at(t + dur * 0.7));
    const g = envGain(t, 0.004, dur, gain);
    o.connect(g); g.connect(shaper);
    o.start(at(t)); o.stop(at(t + dur + 0.05));
  };
  const whoosh = (t, dur, gain = 0.2, f0 = 300, f1 = 3000, pan0 = -0.7, pan1 = 0.7) => {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.Q.value = 1.4;
    flt.frequency.setValueAtTime(f0, at(t)); flt.frequency.exponentialRampToValueAtTime(f1, at(t + dur * 0.6));
    flt.frequency.exponentialRampToValueAtTime(f0 * 1.5, at(t + dur));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at(t)); g.gain.linearRampToValueAtTime(gain, at(t + dur * 0.55)); g.gain.linearRampToValueAtTime(0, at(t + dur));
    s.connect(flt); flt.connect(g);
    const { p } = route(g, { verb: 0.2 });
    p.pan.setValueAtTime(pan0, at(t)); p.pan.linearRampToValueAtTime(pan1, at(t + dur));
    s.start(at(t), R()); s.stop(at(t + dur + 0.02));
  };
  const swell = (tEnd, dur, gain = 0.2, f0 = 800, f1 = 9000) => {
    const t = tEnd - dur;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const flt = ctx.createBiquadFilter(); flt.type = 'highpass';
    flt.frequency.setValueAtTime(f0, at(t)); flt.frequency.exponentialRampToValueAtTime(f1, at(tEnd));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at(t)); g.gain.exponentialRampToValueAtTime(gain, at(tEnd - 0.005)); g.gain.linearRampToValueAtTime(0, at(tEnd));
    s.connect(flt); flt.connect(g); route(g, { verb: 0.25 });
    s.start(at(t), R()); s.stop(at(tEnd + 0.02));
  };
  const bell = (t, f, gain = 0.1, dur = 0.8, pan = 0, verb = 0.4) => {
    const c = ctx.createOscillator(); c.type = 'sine'; c.frequency.value = f;
    const m = ctx.createOscillator(); m.type = 'sine'; m.frequency.value = f * 3.5;
    const mi = ctx.createGain(); mi.gain.setValueAtTime(f * 2.2, at(t)); mi.gain.exponentialRampToValueAtTime(f * 0.05, at(t + dur * 0.6));
    m.connect(mi); mi.connect(c.frequency);
    const g = envGain(t, 0.002, dur, gain);
    c.connect(g); route(g, { pan, verb });
    c.start(at(t)); c.stop(at(t + dur + 0.05)); m.start(at(t)); m.stop(at(t + dur + 0.05));
  };
  const cymbal = (t, gain = 0.2, dur = 1.4, pan = 0) => {
    noise(t, dur, { type: 'highpass', f: 5500, gain, pan, verb: 0.3 });
    noise(t, dur * 0.5, { type: 'bandpass', f: 3500, Q: 0.6, gain: gain * 0.5, pan });
  };
  const sawChord = (t, notes, dur, { gain = 0.05, cutoff = 3000, cutoff1 = 700, a = 0.005, verb = 0.45, detune = 9, hold = 0 } = {}) => {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(cutoff, at(t)); lp.frequency.exponentialRampToValueAtTime(cutoff1, at(t + dur * 0.7));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at(t)); g.gain.linearRampToValueAtTime(gain, at(t + a));
    if (hold) { g.gain.linearRampToValueAtTime(gain * 0.75, at(t + hold)); g.gain.linearRampToValueAtTime(0, at(t + dur)); }
    else g.gain.exponentialRampToValueAtTime(0.0001, at(t + dur));
    lp.connect(g); route(g, { verb });
    notes.forEach((m, i) => {
      for (const d of [-detune, detune]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = d + (i % 2 ? 3 : -3);
        o.connect(lp); o.start(at(t)); o.stop(at(t + dur + 0.05));
      }
    });
  };

  // ================================================================ SCORE
  // Driven by the simulation: every contact sounds at a level set by its impact speed, launchers
  // twang when their latch lets go and clank at their stop, and each world's groove runs on the
  // shared 160 bpm grid between its cuts.
  const P = physics();
  const [C1, C2, C3, C4] = P.cuts;
  const EV = P.events.filter((e) => e.t < T.SHATTER - 1e-3);
  const lvl = (sp, ref = 2800) => Math.min(1.3, Math.pow(sp / ref, 1.1));
  const grid = (a, b, step) => { const out = []; for (let k = Math.ceil((a - 0.5) / step - 1e-6); 0.5 + k * step < b - 1e-6; k++) out.push({ k, t: 0.5 + k * step }); return out; };
  const { P1, P2, P3 } = P.run.plates;
  const SWARM0 = T.BURST + 0.28;
  const tr = P.params.tRelease;

  // --- 1. Pencil test
  pencilScratch(0.03, 0.24, 0.24, -0.35, -0.2);
  pencilScratch(0.27, 0.1, 0.24, -0.3, -0.2, 6);
  pencilTap(tr, 0.5, -0.25);
  for (const { k, t } of grid(0.5, C1, BEAT)) woodTick(t, k % 4 === 0 ? 0.22 : 0.14, k % 4 === 0 ? 2100 : 1700, 0.45);
  whoosh(tr + 0.05, 0.35, 0.07, 600, 2400, -0.3, -0.1);
  swell(C1, 0.3, 0.05, 2000, 9000);

  // --- 2. Cel: latched coil spring
  boing(C1, 0.45);
  kick(C1, 0.8);
  cymbal(C1, 0.08, 0.5, 0.3);
  tamb(C1, 0.08);
  if (P1.releasedAt) osc('triangle', 180, P1.releasedAt, 0.12, { gain: 0.12, f1: 520 });
  if (P1.stoppedAt) { metal(P1.stoppedAt, 0.08, 980, 0.2); woodTick(P1.stoppedAt, 0.2, 600); }
  const celLand = EV.find((e) => e.surface === 'cel');
  let apex = C1, best = 1e9;
  for (let t = C1 + 0.05; t < celLand.t; t += 0.005) { const y = ball2D(t).cy; if (y < best) { best = y; apex = t; } }
  slide(C1 + 0.03, apex, 520, 1500, 0.06);
  slide(apex, celLand.t, 1500, 480, 0.06);
  for (const { k, t } of grid(C1, C2, BEAT)) { tri(t, [39, 43, 46, 43][k % 4], 0.3, 0.26); if (k % 2) clap(t, 0.26, -0.1); }
  for (const { t } of grid(C1, C2, BEAT / 2)) hat(t, 0.04);
  [75, 79, 82, 87].forEach((m, i) => xylo(celLand.t + 0.02 + i * BEAT / 4, m, 0.1, 0.3 - i * 0.1));
  [87, 82, 79, 75].forEach((m, i) => xylo(C2 - BEAT + i * BEAT / 4, m, 0.1, -0.1 + i * 0.1));

  // --- 3. Paper: accordion spring
  paperCrunch(C2, 0.2, 0.26, 36, 3);
  paperThump(C2, 0.55);
  [0, 0.08, 0.16].forEach((d, i) => pop(C2 + d + 0.02, 0.16, 1000 + i * 250, -0.4 + i * 0.4));
  if (P2.releasedAt) whoosh(P2.releasedAt, 0.14, 0.09, 700, 5000, 0, 0.2);
  if (P2.stoppedAt) noise(P2.stoppedAt, 0.03, { type: 'bandpass', f: 2200, Q: 2, gain: 0.18 });
  paperCrunch(C2 + 0.1, 0.9, 0.06, 40, 4, 0.1);
  for (const { k, t } of grid(C2, C3, BEAT / 2)) kalimba(t, [63, 70, 67, 70, 72, 70, 67, 65][((k % 8) + 8) % 8] + 12, 0.1, k % 2 ? 0.35 : -0.35);
  for (const { k, t } of grid(C2, C3, BEAT / 4)) shaker(t, k % 2 ? 0.035 : 0.02);
  for (const { t } of grid(C2 + 0.05, C3, BEAT)) paperThump(t, 0.24);

  // --- 4. 8-bit: spring block, bonus block, coins
  chip(C3, 200, 0.2, { gain: 0.09, f1: 820 });
  chipNoise(C3, 0.08, 0.1, 0.4);
  for (const { k, t } of grid(C3, C4, BEAT / 2)) chip(t, mtof([39, 51, 46, 51, 44, 56, 46, 58][((k % 8) + 8) % 8] - 12), BEAT / 2 - 0.02, { gain: 0.1, wave: P125 });
  for (const { t } of grid(C3, C4, BEAT / 2)) chipNoise(t + BEAT / 4, 0.04, 0.05, 2.5, 0.2);
  const arp = [63, 67, 70, 75, 79, 82, 87, 91];
  for (let i = 0; i < 12; i++) chip(C4 - 0.3 + i * 0.025, mtof(arp[i % 8] + (i >= 8 ? 12 : 0) - 12), 0.03, { gain: 0.06, wave: P25 });
  swell(C4, 0.55, 0.16, 1500, 12000);

  // --- Contacts, from the simulation
  // Pan each 2D contact to where it lands on screen.
  const panOf = (e) => {
    if (e.surface === 'chrome') return 0;
    const f = camFrame(e.t);
    return Math.max(-0.6, Math.min(0.6, ((e.x - f.x) * f.z) / (W / 2) * 0.8));
  };
  for (const e of EV) {
    const g = lvl(e.speed), pn = panOf(e);
    if (e.surface === 'pencil') { softThump(e.t, 0.75 * g); pencilTap(e.t, 0.35 * g, pn); }
    else if (e.surface === 'cel') { kick(e.t, 0.7 * g); woodTick(e.t, 0.3 * g, 760, pn); }
    else if (e.surface === 'paper') {
      paperThump(e.t, 0.5 * g); paperCrunch(e.t, 0.12, 0.13 * g, 14, Math.floor(e.t * 100), pn);
      pop(e.t + 0.04, 0.14 * g, 1300, -0.3); pop(e.t + 0.1, 0.14 * g, 1500, 0.3); pop(e.t + 0.15, 0.12 * g, 1700, 0.1);
    } else if (e.surface === 'pixel') { chipNoise(e.t, 0.1, 0.12 * g, 0.35, pn); chip(e.t, 220, 0.07, { gain: 0.07 * g, f1: 90, pan: pn }); }
    else if (e.surface === 'block') {
      chip(e.t, 140, 0.08, { gain: 0.12, wave: P25, f1: 70 }); chipNoise(e.t, 0.06, 0.1, 0.6);
      [0, 0.075, 0.15].forEach((d, i) => {
        chip(e.t + d, 1319, 0.05, { gain: 0.07, pan: -0.2 + i * 0.2 });
        chip(e.t + d + 0.05, 1976, 0.22, { gain: 0.07, pan: -0.2 + i * 0.2 });
      });
    } else if (e.surface === 'chrome') {
      // Big hits ring low; as the bounces shrink the ring rises: an accelerando into the lens.
      const gc = lvl(e.speed, 1900);
      if (e.speed > 700) { metal(e.t, 0.22 * gc, 330 + (1 - Math.min(1, gc)) * 200, 0); sub(e.t, 0.55 * gc, 0.5, 80, 40); }
      else if (e.speed > 80) metal(e.t, 0.1 * Math.max(0.35, gc), 700 + (1 - gc) * 900, 0.15);
    }
  }

  // --- 5. Chrome slope: groove until the slow-motion ramp, then the approach and the hit
  const R0 = rampStart();
  sub(C4, 0.9, 1.1, 75, 30);
  kick(C4, 0.9, 170, 40, 0.5);
  cymbal(C4, 0.18, 1.6, 0.2);
  whoosh(C4 + 0.06, 0.9, 0.12, 250, 2800, -0.8, 0.8);
  for (const { k, t } of grid(C4 + 0.1, R0, BEAT)) { kick(t, 0.62, 150, 42, 0.3); if (k % 2) clap(t, 0.2, 0.05); }
  for (const { k, t } of grid(C4 + 0.1, R0, BEAT / 4)) hat(t, k % 2 ? 0.045 : 0.02, false, 0.3);
  grid(C4 + 0.1, R0, BEAT / 2).forEach(({ k, t }) => {
    const m = [27, 27, 27, 27, 23, 23, 25, 25][Math.floor(k / 2) % 8];
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m + 12);
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = mtof(m);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(1600, at(t)); lp.frequency.exponentialRampToValueAtTime(220, at(t + 0.16));
    const g = envGain(t, 0.004, BEAT / 2 - 0.01, 0.12, 'lin');
    o.connect(lp); o2.connect(lp); lp.connect(g); route(g, { dest: bassBus });
    o.start(at(t)); o.stop(at(t + BEAT / 2)); o2.start(at(t)); o2.stop(at(t + BEAT / 2));
  });
  for (const { t } of grid(C4 + 0.1, R0, BEAT)) { bassBus.gain.setValueAtTime(0.2, at(t)); bassBus.gain.linearRampToValueAtTime(1, at(t + 0.16)); }
  // Rolling hiss rises as the ball skims toward the lens; riser and snare roll into the hit.
  noise(8.4, T.SHATTER - 8.4, { type: 'bandpass', f: 300, f1: 2400, Q: 1.2, gain: 0.07, a: 0.8, curve: 'lin' });
  swell(T.SHATTER, 0.9, 0.2, 500, 10000);
  sawChord(T.SHATTER - 0.9, [39, 46, 51], 0.88, { gain: 0.03, cutoff: 400, cutoff1: 6000, a: 0.85, verb: 0.3 });
  {
    let t = T.SHATTER - 0.9, i = 0;
    while (t < T.SHATTER - 0.04) {
      const u = (t - (T.SHATTER - 0.9)) / 0.86;
      snare(t, 0.07 + 0.2 * u, i % 2 ? 0.15 : -0.15);
      t += 0.1875 * Math.pow(1 - u, 1.6) + 0.026; i++;
    }
  }
  osc('sawtooth', 110, R0, T.SHATTER - R0, { gain: 0.08, f1: 28, a: 0.01, curve: 'lin' });
  swell(T.SHATTER, 0.2, 0.12, 3000, 14000);

  // --- 6. The lens breaks
  const r6 = rng(66);
  for (let i = 0; i < 70; i++) {
    const d = Math.abs(r6() + r6() - 1) * 0.35;
    osc('sine', 2500 + r6() * 7000, T.SHATTER + d, 0.05 + r6() * 0.35, { gain: 0.035 + r6() * 0.03, a: 0.001, pan: r6() * 2 - 1, verb: 0.4 });
  }
  noise(T.SHATTER, 0.7, { type: 'highpass', f: 2500, gain: 0.4, verb: 0.5 });
  noise(T.SHATTER, 0.25, { type: 'bandpass', f: 1200, Q: 0.7, gain: 0.3 });
  sub(T.SHATTER, 1.0, 1.4, 80, 26);
  kick(T.SHATTER, 0.9, 180, 38, 0.6);
  metal(T.SHATTER, 0.18, 262, 0);
  osc('sine', 55, 9.55, 1.4, { gain: 0.16, f1: 41, a: 0.05, curve: 'lin' });

  // --- 7. The tunnel: wind that circles the listener, a whoosh for every shard that flies past
  // the lens, and a tiny glass tink for every facet as it seats in the mirror ball.
  {
    const s0 = ctx.createBufferSource(); s0.buffer = noiseBuf; s0.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(220, at(9.65)); bp.frequency.exponentialRampToValueAtTime(1400, at(12.4));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at(9.65)); g.gain.linearRampToValueAtTime(0.09, at(10.2)); g.gain.linearRampToValueAtTime(0.05, at(11.6)); g.gain.linearRampToValueAtTime(0.12, at(12.45)); g.gain.linearRampToValueAtTime(0, at(12.5));
    const pn = ctx.createStereoPanner();
    const lfo = ctx.createOscillator(); lfo.frequency.setValueAtTime(0.7, at(9.65)); lfo.frequency.exponentialRampToValueAtTime(4, at(12.45));
    const ld = ctx.createGain(); ld.gain.value = 0.75;
    lfo.connect(ld); ld.connect(pn.pan);
    s0.connect(bp); bp.connect(g); g.connect(pn); pn.connect(master);
    const vs = ctx.createGain(); vs.gain.value = 0.3; pn.connect(vs); vs.connect(verbIn);
    s0.start(at(9.65)); s0.stop(at(12.55)); lfo.start(at(9.65)); lfo.stop(at(12.55));
  }
  for (const p of passBys()) {
    if (p.rho > 1.25 || p.alpha < 0.25) continue;
    const gn = 0.05 * (1.3 - p.rho) * p.alpha + 0.012;
    whoosh(p.t - 0.13, 0.26, gn, 900, 5200, p.pan * 0.4, p.pan);
  }
  const rt = rng(71);
  for (const t of facetLandTimes()) osc('sine', 3200 + rt() * 5200, t, 0.06 + rt() * 0.12, { gain: 0.009 + rt() * 0.008, a: 0.001, pan: rt() * 1.6 - 0.8, verb: 0.5 });
  // Gather: the beat returns on the downbeat, a bell arpeggio accelerates as the ball builds.
  kick(T.GATHER, 0.8, 160, 40, 0.5);
  sub(T.GATHER, 0.5, 1.2, 60, 34);
  sawChord(T.GATHER, [39, 46, 51, 55], 1.5, { gain: 0.03, cutoff: 500, cutoff1: 3200, a: 1.2, verb: 0.5, detune: 14 });
  {
    const pent = [0, 2, 4, 7, 9];
    let t = T.GATHER + 0.05, i = 0;
    while (t < T.BURST - 0.06) {
      const u = (t - T.GATHER) / (T.BURST - T.GATHER);
      bell(t, mtof(63 + pent[i % 5] + 12 * Math.floor(i / 5) % 36), 0.03 + 0.03 * u, 0.35, Math.sin(i * 2.1) * 0.7, 0.45);
      t += BEAT / 2 * Math.pow(1 - u, 1.3) + 0.03; i++;
    }
  }
  for (const k of [0, 1, 2, 3]) hat(T.GATHER + 0.75 + k * BEAT / 2, 0.03 + k * 0.01, false, 0.25);
  // Wind-back: the ball draws everything in before letting go.
  swell(T.BURST, 0.45, 0.22, 300, 12000);
  osc('sine', 38, T.BURST - 0.34, 0.34, { gain: 0.2, f1: 96, a: 0.02, curve: 'lin' });
  osc('sawtooth', 70, T.BURST - 0.34, 0.34, { gain: 0.04, f1: 280, a: 0.05, curve: 'lin' });

  // --- 8. Burst
  for (let i = 0; i < 90; i++) {
    const d = Math.abs(r6() + r6() - 1) * 0.5;
    osc('sine', 2200 + r6() * 8000, T.BURST + d, 0.05 + r6() * 0.4, { gain: 0.03 + r6() * 0.03, a: 0.001, pan: r6() * 2 - 1, verb: 0.45 });
  }
  kick(T.BURST, 1.0, 190, 36, 0.7);
  sub(T.BURST, 1.0, 1.6, 85, 26);
  noise(T.BURST, 0.5, { type: 'highpass', f: 2000, gain: 0.35, verb: 0.5 });
  cymbal(T.BURST, 0.22, 2.0, 0);
  sawChord(T.BURST, [39, 46, 51, 55, 58], 1.1, { gain: 0.045, cutoff: 6000, cutoff1: 400 });
  metal(T.BURST, 0.12, 330, 0);
  // The swarm: shimmering chimes rising into the slam
  const pent = [0, 2, 4, 7, 9];
  for (let i = 0; i < 46; i++) {
    const u = i / 45;
    const t = SWARM0 + Math.pow(u, 0.8) * (T.SLAM - 0.1 - SWARM0);
    const m = 75 + pent[i % 5] + 12 * Math.floor(u * 2.2);
    bell(t, mtof(m), 0.025 + 0.02 * u, 0.4, Math.sin(i * 2.3) * 0.8, 0.5);
  }
  whoosh(SWARM0, T.SLAM - SWARM0, 0.07, 400, 6000, 0.6, -0.6);
  swell(T.SLAM, 1.0, 0.2, 400, 12000);

  // --- 9. Slam
  kick(T.SLAM, 1.0, 190, 38, 0.6);
  sub(T.SLAM, 0.9, 1.6, 70, 28);
  noise(T.SLAM, 0.3, { type: 'bandpass', f: 2100, Q: 0.7, gain: 0.45, verb: 0.4 });
  cymbal(T.SLAM, 0.22, 2.2, 0);
  sawChord(T.SLAM, [39, 46, 51, 55, 58, 65], 1.9, { gain: 0.05, cutoff: 5000, cutoff1: 500 });
  for (let i = 0; i < 7; i++) woodTick(T.SLAM + 0.1 + i * 0.03, 0.035, 3200, -0.3 + i * 0.1);
  osc('sine', 2200, T.SLAM + 0.34, 0.7, { gain: 0.03, f1: 5200, a: 0.25, verb: 0.6, curve: 'lin', pan: -0.4 });
  noise(T.SLAM + 0.34, 0.62, { type: 'highpass', f: 7000, gain: 0.05, a: 0.3, pan: -0.5, pan1: 0.5, verb: 0.4, curve: 'lin' });

  // --- 10. The procession: every contact rings in the timbre of the ball that made it, pitched
  // by the letter (a pentatonic run up the word); the five balls half a beat apart make a canon.
  const { hits, merges } = endcardEvents();
  const run = [0, 2, 4, 7, 9, 12];
  const xPan = (x) => Math.max(-0.7, Math.min(0.7, ((x - W / 2) / (W / 2)) * 0.8));
  merges.forEach((m) => whoosh(m.t - 6 * BEAT - BEAT * 1.5, BEAT * 1.6, 0.05, 500, 3000, -0.8, -0.4));
  for (const h of hits) {
    const m = 75 + run[h.letter], pn = xPan(h.x);
    if (h.style === 'pencil') { pencilTap(h.t, 0.16, pn); osc('sine', mtof(m), h.t, 0.22, { gain: 0.06, a: 0.002, pan: pn, verb: 0.2 }); }
    else if (h.style === 'cel') { xylo(h.t, m, 0.085, pn); woodTick(h.t, 0.08, 900, pn); }
    else if (h.style === 'paper') { kalimba(h.t, m - 12, 0.1, pn); pop(h.t + 0.01, 0.06, 1200 + h.letter * 90, pn); }
    else if (h.style === 'pixel') chip(h.t, mtof(m), 0.09, { gain: 0.05, wave: P25, pan: pn });
    else { bell(h.t, mtof(m + 12), 0.04, 0.5, pn, 0.4); noise(h.t, 0.01, { type: 'highpass', f: 6000, gain: 0.05, pan: pn }); }
  }
  // Groove under it: kick on the beat, hats, and a plucked bass moving Eb, Cm, Ab, Bb.
  const bassAt = (t) => (t < 15.5 ? 39 : t < 16.25 ? 36 : t < 17.0 ? 44 : 46);
  for (const { k, t } of grid(T.PROC, T.PERIOD - 0.01, BEAT)) { kick(t, 0.5, 140, 44, 0.24); if (k % 2) clap(t, 0.1, 0.1); }
  for (const { k, t } of grid(T.PROC, T.PERIOD - 0.01, BEAT / 2)) {
    hat(t, k % 2 ? 0.035 : 0.018, false, 0.3);
    const b = bassAt(t) + (k % 2 ? 12 : 0);
    osc('triangle', mtof(b), t, BEAT / 2 - 0.02, { gain: 0.17, a: 0.003, pan: -0.1 });
  }
  sawChord(T.PROC, [51, 55, 58], 0.75, { gain: 0.012, cutoff: 1200, cutoff1: 700, a: 0.2, verb: 0.6 });
  sawChord(15.5, [48, 51, 55], 0.75, { gain: 0.012, cutoff: 1200, cutoff1: 700, a: 0.2, verb: 0.6 });
  sawChord(16.25, [48, 51, 56], 0.75, { gain: 0.012, cutoff: 1200, cutoff1: 700, a: 0.2, verb: 0.6 });
  sawChord(17.0, [50, 53, 58], 1.1, { gain: 0.014, cutoff: 1400, cutoff1: 800, a: 0.2, verb: 0.6 });
  // Each ball landing in the full stop: its world's own impact, and a note stacking up the chord.
  merges.forEach((m, i) => {
    const note = [63, 67, 70, 74, 77][i];
    if (m.style === 'pencil') { softThump(m.t, 0.22); pencilTap(m.t, 0.22, 0.3); }
    else if (m.style === 'cel') boing(m.t, 0.12, 0.22, 190);
    else if (m.style === 'paper') { paperCrunch(m.t, 0.05, 0.14, 8, 12, 0.3); pop(m.t, 0.1, 1400, 0.3); }
    else if (m.style === 'pixel') chip(m.t, 1568, 0.08, { gain: 0.07, pan: 0.3, steps: [[0.04, 2093]] });
    else metal(m.t, 0.1, 660, 0.3);
    kalimba(m.t + 0.005, note, 0.08, 0.3);
    sub(m.t, 0.25, 0.4, 70, 45);
  });
  // The full stop turns Claude orange: final bell, warm chord, a sparkle up and out.
  swell(T.PERIOD, 0.38, 0.12, 1500, 12000);
  kick(T.PERIOD, 0.7, 160, 40, 0.5);
  bell(T.PERIOD, mtof(87), 0.1, 1.6, 0.3, 0.6);
  bell(T.PERIOD, mtof(94), 0.04, 1.2, 0.3, 0.6);
  [75, 79, 82, 87, 91, 94].forEach((m, i) => bell(T.PERIOD + 0.06 + i * 0.045, mtof(m + 12), 0.018, 0.6, -0.4 + i * 0.16, 0.6));
  for (let i = 0; i < 7; i++) woodTick(T.PERIOD + 0.1 + i * 0.03, 0.03, 3600, -0.3 + i * 0.1);
  osc('sine', 2200, T.PERIOD + 0.42, 0.75, { gain: 0.025, f1: 5200, a: 0.25, verb: 0.6, curve: 'lin', pan: -0.4 });
  sawChord(T.PERIOD - 0.03, [39, 51, 55, 58, 62, 65], T.END - T.PERIOD + 0.02, { gain: 0.032, cutoff: 1800, cutoff1: 800, a: 0.25, verb: 0.6, detune: 12, hold: 1.5 });
  sub(T.PERIOD, 0.3, 1.4, 52, 38);

  return { outG };
}

export async function renderAudio() {
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * T.END), SR);
  build(ctx, 0);
  return ctx.startRendering();
}

export async function playAudio() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  await ctx.resume();
  const T0 = ctx.currentTime + 0.2;
  build(ctx, T0);
  return () => ctx.currentTime - T0 - (ctx.outputLatency || 0);
}

export function encodeWav(buf) {
  const n = buf.length, ch = buf.numberOfChannels, sr = buf.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  w(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const data = [];
  for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const v = Math.max(-1, Math.min(1, data[c][i]));
    out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    o += 2;
  }
  return new Uint8Array(out.buffer);
}
