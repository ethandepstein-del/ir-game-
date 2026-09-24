/**
 * Every sound in the game is synthesised here with the Web Audio API. No samples are loaded.
 * Signal chain: voices → (dry) master bus + (send) convolution reverb → compressor → destination.
 */

type Pan = number; // -1 (left) .. 1 (right)

interface Settings {
  volume: number;
  muted: boolean;
  ambient: boolean;
}

const KEY = 'anarchy/audio/v1';

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { volume: 0.7, muted: false, ambient: true, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { volume: 0.7, muted: false, ambient: true };
}

const semis = (n: number) => Math.pow(2, n / 12);
const NOTE = (name: string) => {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name)!;
  const base = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1] as 'C'];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 440 * semis(base + acc + (Number(m[3]) - 4) * 12);
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private bus!: GainNode;
  private verb!: ConvolverNode;
  private verbSend!: GainNode;
  private noise!: AudioBuffer;
  private ambientNodes: { stop: () => void } | null = null;
  private last: Record<string, number> = {};
  private listeners = new Set<() => void>();
  settings: Settings = loadSettings();

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.settings));
    } catch {
      // ignore
    }
    this.listeners.forEach((f) => f());
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      this.master = ctx.createGain();
      this.master.gain.value = this.effectiveVolume();
      this.master.connect(comp).connect(ctx.destination);
      this.bus = ctx.createGain();
      this.bus.connect(this.master);
      this.verb = ctx.createConvolver();
      this.verb.buffer = this.impulse(2.8, 2.4);
      this.verbSend = ctx.createGain();
      this.verbSend.gain.value = 0.9;
      this.verbSend.connect(this.verb).connect(this.master);
      this.noise = this.makeNoise(2);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.settings.ambient && !this.ambientNodes && !this.settings.muted) this.startAmbient();
  }

  private effectiveVolume() {
    return this.settings.muted ? 0 : this.settings.volume * 0.9;
  }

  setVolume(v: number) {
    this.settings.volume = v;
    this.applyVolume();
  }
  setMuted(m: boolean) {
    this.settings.muted = m;
    this.applyVolume();
    if (m) this.stopAmbient();
    else if (this.settings.ambient) this.startAmbient();
  }
  setAmbient(on: boolean) {
    this.settings.ambient = on;
    if (on && !this.settings.muted) this.startAmbient();
    else this.stopAmbient();
    this.emit();
  }
  private applyVolume() {
    if (this.ctx) this.master.gain.setTargetAtTime(this.effectiveVolume(), this.ctx.currentTime, 0.05);
    this.emit();
  }

  // ---------- building blocks ----------

  private makeNoise(seconds: number) {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  /** A voice output: panner → bus, with an optional reverb send. */
  private out(pan: Pan = 0, wet = 0.2): AudioNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(this.bus);
    if (wet > 0) {
      const s = ctx.createGain();
      s.gain.value = wet;
      g.connect(s).connect(this.verbSend);
    }
    return g;
  }

  private env(param: AudioParam, t: number, a: number, peak: number, d: number, sustain = 0.0001, release = 0) {
    param.cancelScheduledValues(t);
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + a);
    param.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
    if (release) param.exponentialRampToValueAtTime(0.0001, t + a + d + release);
  }

  private tone(type: OscillatorType, f0: number, t: number, dur: number, gain: number, dest: AudioNode, f1?: number, attack = 0.005) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    this.env(g.gain, t, attack, gain, dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
    return o;
  }

  private burst(
    t: number,
    dur: number,
    gain: number,
    dest: AudioNode,
    filter: { type: BiquadFilterType; f0: number; f1?: number; q?: number },
    attack = 0.002,
  ) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bf = ctx.createBiquadFilter();
    bf.type = filter.type;
    bf.frequency.setValueAtTime(filter.f0, t);
    if (filter.f1) bf.frequency.exponentialRampToValueAtTime(filter.f1, t + dur);
    bf.Q.value = filter.q ?? 0.8;
    const g = ctx.createGain();
    this.env(g.gain, t, attack, gain, dur);
    src.connect(bf).connect(g).connect(dest);
    const offset = Math.random() * 1.5;
    src.start(t, offset);
    src.stop(t + attack + dur + 0.05);
  }

  /** Brass-like voice: detuned saws through an enveloped low-pass, with delayed vibrato. */
  private brass(freq: number, t: number, dur: number, gain: number, dest: AudioNode, bright = 1) {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(freq * 1.2, t);
    lp.frequency.exponentialRampToValueAtTime(freq * 7 * bright, t + 0.05);
    lp.frequency.exponentialRampToValueAtTime(freq * 3.2 * bright, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.035);
    g.gain.setTargetAtTime(gain * 0.72, t + 0.05, 0.12);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.09);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vibGain = ctx.createGain();
    vibGain.gain.setValueAtTime(0, t);
    vibGain.gain.linearRampToValueAtTime(freq * 0.004, t + 0.25);
    vib.connect(vibGain);
    for (const cents of [-7, 0, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq * Math.pow(2, cents / 1200);
      vibGain.connect(o.frequency);
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.6);
    }
    vib.start(t);
    vib.stop(t + dur + 0.6);
    lp.connect(g).connect(dest);
  }

  /** Inharmonic additive bell or gong. */
  private bell(freq: number, t: number, gain: number, dest: AudioNode, ratios = [1, 2.76, 5.4, 8.93], decay = 2.2) {
    ratios.forEach((r, i) => {
      this.tone('sine', freq * r, t, decay / (1 + i * 0.6), gain / (1 + i * 0.9), dest, undefined, 0.002);
    });
  }

  private timpani(t: number, gain: number, dest: AudioNode, f = 88) {
    this.tone('sine', f * 1.15, t, 0.9, gain, dest, f, 0.003);
    this.tone('sine', f * 1.5 * 1.1, t, 0.5, gain * 0.35, dest, f * 1.5, 0.003);
    this.burst(t, 0.12, gain * 0.5, dest, { type: 'lowpass', f0: 900, f1: 200 });
  }

  private ready(name?: string, throttleMs = 0): number | null {
    if (!this.ctx || this.settings.muted) return null;
    if (name && throttleMs) {
      const now = performance.now();
      if (now - (this.last[name] ?? 0) < throttleMs) return null;
      this.last[name] = now;
    }
    return this.ctx.currentTime + 0.01;
  }

  // ---------- UI ----------

  click() {
    const t = this.ready('click', 30);
    if (t === null) return;
    const o = this.out(0, 0.05);
    this.burst(t, 0.012, 0.25, o, { type: 'highpass', f0: 3500 });
    this.tone('sine', 1900, t, 0.03, 0.12, o, 1500);
  }

  hover() {
    const t = this.ready('hover', 45);
    if (t === null) return;
    this.tone('sine', 2600, t, 0.018, 0.035, this.out(0, 0));
  }

  select(pan: Pan = 0) {
    const t = this.ready('select', 40);
    if (t === null) return;
    const o = this.out(pan, 0.1);
    this.tone('triangle', 880, t, 0.06, 0.16, o);
    this.tone('triangle', 1320, t + 0.055, 0.09, 0.14, o);
  }

  deny() {
    const t = this.ready('deny', 80);
    if (t === null) return;
    const o = this.out(0, 0.05);
    const lp = this.ctx!.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    lp.connect(o);
    this.tone('square', 150, t, 0.09, 0.18, lp);
    this.tone('square', 118, t + 0.1, 0.12, 0.18, lp);
  }

  // ---------- war ----------

  deploy(pan: Pan = 0, big = false) {
    const t = this.ready('deploy', 50);
    if (t === null) return;
    const o = this.out(pan, 0.12);
    const pitch = 0.9 + Math.random() * 0.2;
    this.tone('sine', 150 * pitch, t, 0.22, big ? 0.75 : 0.55, o, 48);
    this.burst(t, 0.07, 0.35, o, { type: 'lowpass', f0: 1400, f1: 300 });
    // Metallic clank: FM pair.
    const ctx = this.ctx!;
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const mg = ctx.createGain();
    car.frequency.value = 410 * pitch;
    mod.frequency.value = 410 * pitch * 2.87;
    mg.gain.setValueAtTime(900, t);
    mg.gain.exponentialRampToValueAtTime(10, t + 0.25);
    mod.connect(mg).connect(car.frequency);
    const g = ctx.createGain();
    this.env(g.gain, t + 0.01, 0.002, 0.09, 0.28);
    car.connect(g).connect(o);
    car.start(t);
    mod.start(t);
    car.stop(t + 0.4);
    mod.stop(t + 0.4);
  }

  dice(pan: Pan = 0) {
    const t = this.ready('dice', 120);
    if (t === null) return;
    const o = this.out(pan, 0.08);
    let at = t;
    const hits = 7 + Math.floor(Math.random() * 3);
    for (let i = 0; i < hits; i++) {
      const gap = 0.025 + Math.pow(i / hits, 2) * 0.09 + Math.random() * 0.02;
      at += gap;
      const f = 1800 + Math.random() * 2600;
      this.burst(at, 0.012, 0.35 - i * 0.02, o, { type: 'bandpass', f0: f, q: 4 });
      this.tone('sine', f / 3, at, 0.02, 0.05, o);
    }
    this.burst(at + 0.07, 0.02, 0.4, o, { type: 'bandpass', f0: 2400, q: 3 });
  }

  cannon(pan: Pan = 0, size = 1, delay = 0) {
    const t0 = this.ready();
    if (t0 === null) return;
    const t = t0 + delay;
    const o = this.out(pan, 0.35);
    this.tone('sine', 78, t, 0.55 * size, 0.9 * size, o, 26, 0.003);
    this.burst(t, 0.7 * size, 0.75 * size, o, { type: 'lowpass', f0: 4200, f1: 140 }, 0.001);
    for (let i = 0; i < 5; i++) {
      this.burst(t + 0.05 + Math.random() * 0.35, 0.03, 0.12 * size, o, { type: 'bandpass', f0: 1200 + Math.random() * 3000, q: 2 });
    }
  }

  volley(pan: Pan = 0, n = 4) {
    const t = this.ready('volley', 60);
    if (t === null) return;
    const o = this.out(pan, 0.25);
    for (let i = 0; i < n; i++) {
      const at = t + i * (0.045 + Math.random() * 0.04);
      this.burst(at, 0.03, 0.4, o, { type: 'highpass', f0: 700 + Math.random() * 500 });
      this.tone('sine', 160, at, 0.05, 0.25, o, 60);
    }
  }

  conquest(pan: Pan = 0) {
    const t = this.ready('conquest', 150);
    if (t === null) return;
    const o = this.out(pan * 0.5, 0.3);
    const root = NOTE('D4');
    this.brass(root, t, 0.16, 0.12, o);
    this.brass(root * semis(4), t, 0.16, 0.1, o);
    this.brass(root, t + 0.18, 0.5, 0.12, o, 1.2);
    this.brass(root * semis(4), t + 0.18, 0.5, 0.1, o, 1.2);
    this.brass(root * semis(7), t + 0.18, 0.5, 0.1, o, 1.2);
    this.brass(root * 2, t + 0.18, 0.5, 0.07, o, 1.2);
    for (let i = 0; i < 5; i++) this.burst(t + i * 0.035, 0.05, 0.12, o, { type: 'bandpass', f0: 2200, q: 0.9 });
    this.timpani(t + 0.18, 0.5, o, 73);
  }

  lost(pan: Pan = 0) {
    const t = this.ready('lost', 200);
    if (t === null) return;
    const o = this.out(pan * 0.5, 0.35);
    const root = NOTE('A2');
    this.brass(root, t, 0.7, 0.13, o, 0.6);
    this.brass(root * semis(3), t, 0.7, 0.1, o, 0.6);
    this.brass(root * semis(6), t + 0.05, 0.65, 0.07, o, 0.6);
    this.timpani(t, 0.6, o, 55);
  }

  march(pan: Pan = 0) {
    const t = this.ready('march', 100);
    if (t === null) return;
    const o = this.out(pan, 0.1);
    for (let i = 0; i < 4; i++) {
      this.burst(t + i * 0.11, 0.05, 0.14, o, { type: 'lowpass', f0: 500 });
      this.tone('sine', 95, t + i * 0.11, 0.06, 0.18, o, 60);
    }
  }

  // ---------- geopolitics ----------

  clockTick(minutes: number) {
    const t = this.ready('clock', 300);
    if (t === null) return;
    const o = this.out(0, 0.3);
    const tock = (at: number, f: number) => {
      this.tone('sine', f, at, 0.06, 0.4, o);
      this.burst(at, 0.02, 0.2, o, { type: 'bandpass', f0: f * 2.2, q: 6 });
    };
    tock(t, 1250);
    tock(t + 0.36, 930);
    tock(t + 0.72, 1250);
    if (minutes <= 3) this.klaxon(t + 1.0, minutes <= 1 ? 4 : 2);
  }

  klaxon(at?: number, reps = 2) {
    const t = at ?? this.ready('klaxon', 600);
    if (t === null || !this.ctx) return;
    const o = this.out(0, 0.25);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.7;
    bp.connect(o);
    for (let i = 0; i < reps; i++) {
      this.tone('sawtooth', 520, t + i * 0.5, 0.22, 0.2, bp, undefined, 0.02);
      this.tone('sawtooth', 392, t + i * 0.5 + 0.25, 0.22, 0.2, bp, undefined, 0.02);
    }
  }

  relief() {
    const t = this.ready('relief', 400);
    if (t === null) return;
    const o = this.out(0, 0.5);
    this.bell(NOTE('G5'), t, 0.12, o, [1, 2.0, 3.01], 1.6);
    this.bell(NOTE('D6'), t + 0.12, 0.08, o, [1, 2.0, 3.01], 1.4);
  }

  card() {
    const t = this.ready('card', 150);
    if (t === null) return;
    const o = this.out(0, 0.35);
    this.burst(t, 0.45, 0.35, o, { type: 'bandpass', f0: 350, f1: 3200, q: 1.4 }, 0.12);
    ['E6', 'G#6', 'B6', 'E7'].forEach((n, i) => this.tone('sine', NOTE(n), t + 0.12 + i * 0.05, 0.4, 0.05, o));
  }

  pact() {
    const t = this.ready('pact', 300);
    if (t === null) return;
    const o = this.out(0, 0.6);
    this.bell(NOTE('C5'), t, 0.2, o);
    this.bell(NOTE('G5'), t + 0.22, 0.15, o);
  }

  rejected() {
    const t = this.ready('rejected', 300);
    if (t === null) return;
    const o = this.out(0, 0.2);
    const lp = this.ctx!.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 450;
    lp.connect(o);
    this.tone('square', 110, t, 0.18, 0.22, lp);
    this.tone('square', 98, t + 0.2, 0.3, 0.22, lp);
  }

  betrayal() {
    const t = this.ready('betrayal', 400);
    if (t === null) return;
    const o = this.out(0, 0.5);
    this.burst(t, 0.08, 0.5, o, { type: 'highpass', f0: 4500 });
    [3120, 4410, 5730, 7900].forEach((f) => this.tone('sine', f, t, 0.35, 0.05, o));
    this.brass(NOTE('C3'), t + 0.05, 0.6, 0.1, o, 0.8);
    this.brass(NOTE('F#3'), t + 0.05, 0.6, 0.1, o, 0.8);
  }

  coalition() {
    const t = this.ready('coalition', 1500);
    if (t === null || !this.ctx) return;
    const ctx = this.ctx;
    const o = this.out(0, 0.6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(160, t);
    lp.frequency.exponentialRampToValueAtTime(1400, t + 1.6);
    lp.frequency.exponentialRampToValueAtTime(300, t + 3.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 1.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
    lp.connect(g).connect(o);
    for (const f of [55, 55 * 1.498, 110, 110 * 1.189]) {
      for (const c of [-9, 8]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = f * Math.pow(2, c / 1200);
        osc.connect(lp);
        osc.start(t);
        osc.stop(t + 3.5);
      }
    }
    this.timpani(t + 1.35, 0.8, o, 62);
    this.timpani(t + 1.6, 0.6, o, 62);
  }

  gong() {
    const t = this.ready('gong', 1000);
    if (t === null) return;
    const o = this.out(0, 0.7);
    this.burst(t, 0.15, 0.3, o, { type: 'lowpass', f0: 2500, f1: 300 });
    this.bell(98, t, 0.35, o, [1, 1.48, 1.93, 2.52, 3.1, 4.2], 4.5);
  }

  teletype() {
    const t = this.ready('teletype', 800);
    if (t === null) return;
    const o = this.out(0.2, 0.12);
    for (let i = 0; i < 18; i++) {
      const at = t + i * 0.034 + Math.random() * 0.012;
      this.burst(at, 0.01, 0.25, o, { type: 'bandpass', f0: 3000 + Math.random() * 1500, q: 5 });
      this.tone('square', 190, at, 0.008, 0.03, o);
    }
    this.bell(NOTE('A6'), t + 0.7, 0.08, o, [1, 2.4], 0.8);
  }

  ping(mine: boolean) {
    const t = this.ready('ping', 250);
    if (t === null || !this.ctx) return;
    const ctx = this.ctx;
    const o = this.out(0, 0.15);
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.28;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const dry = ctx.createGain();
    dry.connect(o);
    dry.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(o);
    const f = mine ? 1480 : 740;
    this.tone('sine', f, t, mine ? 0.7 : 0.35, mine ? 0.22 : 0.08, dry, f * 0.985, 0.004);
    if (mine) this.tone('sine', f * 2, t, 0.25, 0.04, dry);
    setTimeout(() => {
      try {
        dry.disconnect();
      } catch {
        // already gone
      }
    }, 2500);
  }

  capitalFalls(pan: Pan = 0) {
    this.cannon(pan, 1.6);
    this.cannon(pan, 1.1, 0.25);
    const t = this.ready('capital', 500);
    if (t === null) return;
    const o = this.out(0, 0.6);
    this.brass(NOTE('D3'), t + 0.2, 1.2, 0.12, o, 0.7);
    this.brass(NOTE('F3'), t + 0.2, 1.2, 0.1, o, 0.7);
    this.brass(NOTE('A3'), t + 0.2, 1.2, 0.08, o, 0.7);
  }

  nuclear() {
    const t = this.ready('nuclear', 3000);
    if (t === null || !this.ctx) return;
    const ctx = this.ctx;
    const o = this.out(0, 0.8);
    // Rising siren.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    lp.connect(o);
    this.tone('sawtooth', 180, t, 1.5, 0.18, lp, 900, 0.3);
    // Detonation: sub, roar, distortion.
    const boom = t + 1.6;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 3.5);
    }
    shaper.curve = curve;
    const g = ctx.createGain();
    g.gain.value = 0.9;
    shaper.connect(g).connect(o);
    this.tone('sine', 55, boom, 3.5, 1, shaper, 22, 0.01);
    this.burst(boom, 5, 1, shaper, { type: 'lowpass', f0: 2600, f1: 60 }, 0.01);
    this.burst(boom + 0.4, 4.5, 0.5, o, { type: 'lowpass', f0: 300, f1: 40 }, 0.8);
  }

  victory() {
    const t = this.ready('victory', 3000);
    if (t === null) return;
    const o = this.out(0, 0.45);
    const seq: [string, number, number][] = [
      ['G4', 0, 0.16],
      ['C5', 0.18, 0.16],
      ['E5', 0.36, 0.16],
      ['G5', 0.54, 0.55],
      ['E5', 1.12, 0.16],
      ['G5', 1.3, 0.16],
      ['C6', 1.48, 1.3],
    ];
    for (const [n, at, d] of seq) {
      this.brass(NOTE(n), t + at, d, 0.13, o, 1.3);
      this.brass(NOTE(n) / 2, t + at, d, 0.08, o, 0.9);
    }
    [0.54, 1.48].forEach((at) => this.timpani(t + at, 0.7, o, 65));
    this.burst(t + 1.48, 2.2, 0.18, o, { type: 'highpass', f0: 6000 }, 0.005);
    ['C4', 'E4', 'G4'].forEach((n) => this.brass(NOTE(n), t + 1.48, 1.3, 0.07, o, 0.8));
  }

  defeat() {
    const t = this.ready('defeat', 3000);
    if (t === null) return;
    const o = this.out(0, 0.5);
    const seq: [string, number, number][] = [
      ['E4', 0, 0.45],
      ['D4', 0.5, 0.45],
      ['C4', 1.0, 0.45],
      ['B3', 1.5, 1.6],
    ];
    for (const [n, at, d] of seq) {
      this.brass(NOTE(n), t + at, d, 0.1, o, 0.55);
      this.brass(NOTE(n) * semis(-9), t + at, d, 0.07, o, 0.5);
    }
    this.timpani(t + 1.5, 0.6, o, 49);
  }

  // ---------- ambience ----------

  private startAmbient() {
    if (!this.ctx || this.ambientNodes) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 4);
    g.connect(this.bus);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    lp.Q.value = 3;
    lp.connect(g);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();
    const oscs = [41.2, 41.2 * 1.5, 61.7, 82.4].flatMap((f) =>
      [-6, 5].map((c) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f * Math.pow(2, c / 1200);
        o.connect(lp);
        o.start();
        return o;
      }),
    );
    // Distant radio chatter every few seconds.
    let alive = true;
    const chatter = () => {
      if (!alive || !this.ctx) return;
      const now = this.ctx.currentTime;
      const o = this.out(Math.random() * 1.6 - 0.8, 0.6);
      const bursts = 3 + Math.floor(Math.random() * 6);
      for (let i = 0; i < bursts; i++) {
        this.burst(now + i * 0.09 + Math.random() * 0.05, 0.06 + Math.random() * 0.08, 0.025, o, { type: 'bandpass', f0: 1100 + Math.random() * 900, q: 6 });
      }
      setTimeout(chatter, 5000 + Math.random() * 9000);
    };
    const first = setTimeout(chatter, 3000);
    this.ambientNodes = {
      stop: () => {
        alive = false;
        clearTimeout(first);
        const now = ctx.currentTime;
        g.gain.setTargetAtTime(0.0001, now, 0.4);
        setTimeout(() => {
          oscs.forEach((o) => o.stop());
          lfo.stop();
          g.disconnect();
        }, 2000);
      },
    };
  }

  private stopAmbient() {
    this.ambientNodes?.stop();
    this.ambientNodes = null;
  }
}

export const sfx = new SoundEngine();
