// Options for the noise and post-processing passes (blue noise, VL denoise,
// bloom). Kept apart from settings.glsl; included by the files that use it.
#ifndef CLARITY_SETTINGS_POST
#define CLARITY_SETTINGS_POST

// 0 = interleaved gradient noise (old), 1 = blue-noise texture.
// Blue noise is static per pixel (no TAA here, so nothing may crawl): it
// just has no low-frequency blotches, so blurs and the eye remove it.
#define NOISE_PATTERN 1 // [0 1]

// Volumetric light denoise radius in pixels (composite2), depth-aware
// Gaussian. 3 = 45 taps, 2 = 21 taps, 1 = 9 taps (one fetch per tap; the old
// 5x5 blur took 50). 3 removes the most noise, 2 is cheaper and crisper.
#define VL_BLUR_RADIUS 3 // [1 2 3]

// Bloom only takes light above this (after exposure, 1.0 ~ white), with a
// soft knee below it. 0 = everything blooms, the old look.
#define BLOOM_THRESHOLD 1.00 // [0.0 0.50 0.75 1.00 1.50 2.00 3.00]

#endif
