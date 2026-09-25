// Ray-tracing options that belong to the RT passes only (RT_GI, RT_RAYS,
// RT_DISTANCE, RT_HISTORY and RT_GI_STRENGTH live in settings.glsl).
#if !defined INCLUDE_SETTINGS_RT
#define INCLUDE_SETTINGS_RT

// Share of pixels that fire rays each frame.
//   1.0 every pixel
//   0.7 checkerboard: half the pixels, alternating every frame
//   0.5 one pixel per 2x2 block, rotating through the block over 4 frames
// Pixels that don't trace are filled by an edge-aware (depth + normal)
// upsample, then temporal accumulation brings back full detail.
#define RT_RESOLUTION 1.0 // [0.5 0.7 1.0]

// Store the first denoise pass as next frame's history (SVGF). Less noise,
// slightly softer contact detail.
#define RT_HISTORY_FEEDBACK

// Clamp the history to what the current frame sees, so light changes
// (door opened, torch placed) show up in a few frames instead of the full
// Temporal Frames. Higher = more stable, slower to react.
#define RT_HISTORY_CLAMP 1.50 // [0.0 1.00 1.25 1.50 2.00 3.00]

// Denoiser strength: how many standard deviations of noise the edge
// stopping tolerates.
#define RT_DENOISE 4.0 // [2.0 3.0 4.0 6.0 8.0]

#endif
