// Procedural score and sound design. Every sound is synthesized with WebAudio nodes and
// scheduled against the same timeline as the picture. Works offline (render) and live (player).
import { T, BEAT, beat, rng } from './core.js';

const SR = 48000, LEN = 15;
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
  const outG = ctx.createGain(); outG.gain.value = 1.35;
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
  // --- 1. Pencil test (0 – 2.0)
  pencilScratch(0.06, 0.36, 0.24, -0.35, -0.2);
  pencilScratch(0.42, 0.16, 0.24, -0.3, -0.2, 7);
  pencilTap(0.76, 0.5, -0.25);
  for (let k = 0; k < 4; k++) woodTick(beat(k), k === 0 ? 0.24 : 0.16, k === 0 ? 2100 : 1700, 0.45);
  whoosh(0.8, 0.45, 0.09, 600, 2400, -0.3, -0.1);
  softThump(beat(2), 0.7);
  pencilTap(beat(2), 0.3, -0.15);
  pencilScratch(beat(2) + 0.08, 0.14, 0.12, -0.5, -0.5);
  whoosh(1.3, 0.6, 0.04, 500, 1800, -0.1, 0.1);
  swell(T.CEL, 0.35, 0.05, 2000, 9000);

  // --- 2. Cel cartoon (2.0 – 3.5)
  boing(T.CEL, 0.42);
  kick(T.CEL, 0.8);
  cymbal(T.CEL, 0.08, 0.5, 0.3);
  tamb(T.CEL, 0.08);
  slide(T.CEL + 0.02, beat(5), 520, 1500, 0.06);
  slide(beat(5), beat(6), 1500, 480, 0.06);
  [39, 43, 46, 43].forEach((m, i) => tri(beat(4 + i), m, 0.3, 0.26));
  clap(beat(5), 0.28, -0.1); clap(beat(7), 0.28, -0.1);
  for (let i = 0; i < 8; i++) hat(T.CEL + i * BEAT / 2, i % 2 ? 0.05 : 0.03);
  kick(beat(6), 0.6);
  woodTick(beat(6), 0.3, 760, 0);
  [75, 79, 82, 87].forEach((m, i) => xylo(beat(6) + 0.02 + i * BEAT / 4, m, 0.1, 0.3 - i * 0.1));
  [87, 82, 79, 75].forEach((m, i) => xylo(beat(7) + i * BEAT / 4, m, 0.1, -0.1 + i * 0.1));

  // --- 3. Cut paper (3.5 – 5.0)
  paperCrunch(T.PAPER, 0.22, 0.26, 36, 3);
  paperThump(T.PAPER, 0.55);
  [0, 0.08, 0.16].forEach((d, i) => pop(T.PAPER + d + 0.02, 0.16, 1000 + i * 250, -0.4 + i * 0.4));
  paperCrunch(T.PAPER + 0.1, 0.9, 0.06, 40, 4, 0.1);
  [63, 70, 67, 70, 72, 70, 67, 65].forEach((m, i) => kalimba(T.PAPER + i * BEAT / 2, m + 12, 0.1, i % 2 ? 0.35 : -0.35));
  for (let k = 8; k < 12; k++) paperThump(beat(k), k === 8 ? 0 : 0.28);
  for (let i = 0; i < 16; i++) shaker(T.PAPER + i * BEAT / 4, i % 2 ? 0.035 : 0.02);
  paperThump(beat(10), 0.4);
  paperCrunch(beat(10), 0.12, 0.12, 14, 5);
  pop(beat(10) + 0.04, 0.14, 1300, -0.3); pop(beat(10) + 0.1, 0.14, 1500, 0.3);

  // --- 4. 8-bit (5.0 – 6.5)
  chipNoise(T.PIXEL, 0.1, 0.12, 0.35);
  chip(T.PIXEL, 280, 0.16, { gain: 0.09, f1: 900 });
  const bassLine = [39, 51, 46, 51, 44, 56, 46, 58];
  bassLine.forEach((m, i) => chip(T.PIXEL + i * BEAT / 2, mtof(m - 12), BEAT / 2 - 0.02, { gain: 0.1, wave: P125 }));
  for (let i = 0; i < 8; i++) chipNoise(T.PIXEL + i * BEAT / 2 + BEAT / 4, 0.04, 0.05, 2.5, 0.2);
  chip(beat(13), 140, 0.08, { gain: 0.12, wave: P25, f1: 70 });
  chipNoise(beat(13), 0.06, 0.1, 0.6);
  [0, 0.075, 0.15].forEach((d, i) => {
    chip(beat(13) + d, 1319, 0.05, { gain: 0.07, pan: -0.2 + i * 0.2 });
    chip(beat(13) + d + 0.05, 1976, 0.22, { gain: 0.07, pan: -0.2 + i * 0.2 });
  });
  chipNoise(beat(14), 0.08, 0.1, 0.35);
  chip(beat(14), 320, 0.12, { gain: 0.07, f1: 800 });
  // Warp into 3D: fast rising arpeggio + reverse cymbal
  const arp = [63, 67, 70, 75, 79, 82, 87, 91];
  for (let i = 0; i < 12; i++) chip(6.2 + i * 0.025, mtof(arp[i % 8] + (i >= 8 ? 12 : 0) - 12), 0.03, { gain: 0.06, wave: P25 });
  swell(T.CHROME, 0.6, 0.16, 1500, 12000);

  // --- 5. Chrome (6.5 – 9.5)
  sub(T.CHROME, 0.9, 1.1, 75, 30);
  kick(T.CHROME, 0.9, 170, 40, 0.5);
  metal(T.CHROME, 0.26, 330, 0);
  cymbal(T.CHROME, 0.18, 1.6, 0.2);
  whoosh(6.56, 0.8, 0.13, 250, 2800, -0.8, 0.8);
  for (let k = 17; k < 24; k++) kick(beat(k), 0.7, 150, 42, 0.3);
  for (const k of [17, 19, 21, 23]) clap(beat(k), 0.22, 0.05);
  for (let i = 0; i < 22; i++) hat(T.CHROME + BEAT + i * BEAT / 4, i % 2 ? 0.045 : 0.02, false, 0.3);
  // Sidechained saw bass on 8ths
  const bassNotes = [27, 27, 27, 27, 27, 27, 27, 27, 23, 23, 23, 23, 25, 25];
  bassNotes.forEach((m, i) => {
    const t = T.CHROME + BEAT + i * BEAT / 2;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m + 12);
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = mtof(m);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(1600, at(t)); lp.frequency.exponentialRampToValueAtTime(220, at(t + 0.16));
    const g = envGain(t, 0.004, BEAT / 2 - 0.01, 0.13, 'lin');
    o.connect(lp); o2.connect(lp); lp.connect(g); route(g, { dest: bassBus });
    o.start(at(t)); o.stop(at(t + BEAT / 2)); o2.start(at(t)); o2.stop(at(t + BEAT / 2));
  });
  for (let k = 17; k < 24; k++) {
    bassBus.gain.setValueAtTime(0.2, at(beat(k)));
    bassBus.gain.linearRampToValueAtTime(1, at(beat(k) + 0.16));
  }
  [[7.25, 392], [8.0, 440], [8.75, 523]].forEach(([t, f], i) => {
    metal(t, 0.2, f, i % 2 ? 0.3 : -0.3);
    sub(t, 0.35, 0.5, 80, 40);
  });
  whoosh(7.3, 0.7, 0.07, 300, 2000, 0.6, -0.4);
  // Riser + accelerating snare roll into the shatter
  swell(9.5, 0.75, 0.22, 500, 10000);
  sawChord(8.75, [39, 46, 51], 0.72, { gain: 0.03, cutoff: 400, cutoff1: 6000, a: 0.7, verb: 0.3 });
  {
    let t = 8.75, i = 0;
    while (t < 9.46) {
      const u = (t - 8.75) / 0.71;
      snare(t, 0.08 + 0.2 * u, (i % 2 ? 0.15 : -0.15));
      t += 0.1875 * Math.pow(1 - u, 1.6) + 0.028;
      i++;
    }
  }
  osc('sawtooth', 110, 9.18, 0.32, { gain: 0.08, f1: 28, a: 0.01, curve: 'lin' });
  paperCrunch(9.27, 0.23, 0.07, 30, 9);
  swell(9.5, 0.2, 0.12, 3000, 14000);

  // --- 6. Shatter → title
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
  // Slow-motion drone, then the gather: shimmering chimes rising into the slam
  osc('sine', 55, 9.55, 0.7, { gain: 0.18, f1: 41, a: 0.05, curve: 'lin' });
  const pent = [0, 2, 4, 7, 9];
  for (let i = 0; i < 46; i++) {
    const u = i / 45;
    const t = 9.86 + Math.pow(u, 0.8) * 1.1;
    const m = 75 + pent[i % 5] + 12 * Math.floor(u * 2.2);
    bell(t, mtof(m), 0.025 + 0.02 * u, 0.4, Math.sin(i * 2.3) * 0.8, 0.5);
  }
  whoosh(9.95, 1.05, 0.07, 400, 6000, 0.6, -0.6);
  swell(T.SLAM, 1.0, 0.2, 400, 12000);
  // Slam
  kick(T.SLAM, 1.0, 190, 38, 0.6);
  sub(T.SLAM, 0.9, 1.6, 70, 28);
  noise(T.SLAM, 0.3, { type: 'bandpass', f: 2100, Q: 0.7, gain: 0.45, verb: 0.4 });
  cymbal(T.SLAM, 0.22, 2.2, 0);
  sawChord(T.SLAM, [39, 46, 51, 55, 58, 65], 1.9, { gain: 0.05, cutoff: 5000, cutoff1: 500 });
  for (let i = 0; i < 7; i++) woodTick(T.SLAM + 0.1 + i * 0.03, 0.035, 3200, -0.3 + i * 0.1);
  // Light sweep shimmer
  osc('sine', 2200, 11.34, 0.7, { gain: 0.03, f1: 5200, a: 0.25, verb: 0.6, curve: 'lin', pan: -0.4 });
  noise(11.34, 0.62, { type: 'highpass', f: 7000, gain: 0.05, a: 0.3, pan: -0.5, pan1: 0.5, verb: 0.4, curve: 'lin' });
  // Quiet bed between the slam and the full stop, so the pause breathes instead of dropping out
  sawChord(11.4, [39, 46, 51, 58], 1.3, { gain: 0.014, cutoff: 900, cutoff1: 500, a: 0.9, verb: 0.7, detune: 14 });
  // The full stop: falls, then each bounce sounds like one of the worlds
  osc('sine', 1600, T.PERIOD - 0.39, 0.39, { gain: 0.035, f1: 520, a: 0.02, curve: 'lin' });
  softThump(T.PERIOD, 0.2); pencilTap(T.PERIOD, 0.24, 0.3);
  boing(T.PERIOD + 0.25, 0.14, 0.2, 190);
  paperCrunch(T.PERIOD + 0.39, 0.05, 0.14, 8, 12, 0.3); pop(T.PERIOD + 0.39, 0.1, 1400, 0.3);
  chip(T.PERIOD + 0.48, 1568, 0.06, { gain: 0.07, pan: 0.3 });
  bell(T.PERIOD + 0.54, mtof(87), 0.1, 1.4, 0.3, 0.6);
  bell(T.PERIOD + 0.54, mtof(94), 0.04, 1.0, 0.3, 0.6);
  // Warm pad under the end card
  sawChord(T.PERIOD - 0.05, [39, 51, 55, 58, 62, 65], T.END - T.PERIOD + 0.02, { gain: 0.03, cutoff: 1400, cutoff1: 800, a: 0.5, verb: 0.6, detune: 12, hold: 1.7 });
  sub(T.PERIOD, 0.1, 1.2, 52, 38);

  return { outG };
}

export async function renderAudio() {
  const ctx = new OfflineAudioContext(2, SR * LEN, SR);
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
