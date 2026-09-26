// "Kilby Girl" (The Bed Heads): entry point for the renderer. The shot list lives in seq/: one
// file per sequence (see seq/songmap.mjs for who owns which part of the song) and
// seq/timeline.mjs, which joins them.
export { drawFrame, T } from './seq/timeline.mjs';
