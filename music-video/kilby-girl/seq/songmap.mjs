// Song map: section boundaries (seconds, on downbeats) and which sequence file owns each range.
// Sequence files own every cut inside their range; the boundaries here only move by agreement.

export const T = {
  intro: 0, verse1: 12.48, hook1: 38.66, brk1: 61.59, verse2: 85.58, brk: 118.67, hook2: 123.03,
  bridge: 147.39, build: 169.56, final: 183.59, outro: 225.52, ringout: 238.31, endCard: 241.86, end: 247.52,
  // v3 names still used inside sequences
  titleEnd: 12.48, walkClose: 18.3, walkNight: 22.65, fence: 28.46, fenceClose: 31.36, bust: 35.74, stops: 38.66,
  noahC: 67.42, brooksC: 73.2, belleC: 78.99, ethanC: 81.95, v2b: 91.39, v2c: 95.77, zine: 101.56,
  h2b: 125.92, h2c: 128.84, h2d: 131.77, h2e: 134.66, h2f: 137.58, h2g: 140.5, h2h: 143.4,
  darkroom: 147.39, buildUp: 176.5, montage: 186.83, finale: 197.49, surf: 209.08, pitEnd: 219.78,
};

// [start, end, sequence file]
export const SECTIONS = [
  [T.intro, T.verse1, 'intro'],
  [T.verse1, T.hook1, 'verse1'],
  [T.hook1, T.brk1, 'hook1'],
  [T.brk1, T.verse2, 'break1'],
  [T.verse2, T.hook2, 'verse2'],
  [T.hook2, T.bridge, 'hook2'],
  [T.bridge, T.final, 'bridge'],
  [T.final, T.outro, 'finale'],
  [T.outro, T.end + 1, 'outro'],
];

// coarse arrangement energy, for motion amplitude (use S.perf.energy(t) for the measured curve)
const ENERGY = [[0, 0.25], [T.hook1, 0.55], [T.brk1, 1], [T.verse2, 0.35], [T.brk, 0], [T.hook2, 1], [T.bridge, 0.3], [T.build, 0.6], [T.final, 1], [T.outro, 0.6], [T.ringout, 0.15]];
export const energyAt = (t) => ENERGY.filter(([a]) => t >= a).pop()[1];
