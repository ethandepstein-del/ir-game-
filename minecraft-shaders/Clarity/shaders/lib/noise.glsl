// Screen-space noise for jittering and rotating sample patterns.
// Fragment stages only (uses a texture bias).
//
// The pack's noise texture (shaders.properties: texture.noise) is a tileable
// 128x128 blue-noise array made by tools/gen_bluenoise.cjs. Each channel is an
// independent pattern with uniform values, so separate effects take separate
// channels and their leftover noise does not line up:
//   r: shadow filter rotation (lighting.glsl)
//   g: volumetric light march offset (composite1)
//   b: reflection march offsets (composite1)
//   a: output dither (final)
// The noise is deliberately static: there is no TAA to average it over time,
// and noise that changed every frame would read as shimmer.
#ifndef CLARITY_NOISE
#define CLARITY_NOISE
#include "/lib/settings_post.glsl"

uniform sampler2D noisetex;
// OptiFine sizes its generated noise with this if texture.noise is missing.
const int noiseTextureResolution = 128;
#define BLUE_NOISE_RES 128.0

// Interleaved gradient noise (Jimenez 2014): the legacy pattern.
float ignNoise(vec2 p) {
    return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

// Golden-ratio offsets keep the four "channels" decorrelated.
vec4 ignNoise4(vec2 fragCoord) {
    return fract(ignNoise(fragCoord) + vec4(0.0, 0.38196601, 0.61803399, 0.23606798));
}

// Texel (0,0) of textures/bluenoise.png, printed by tools/gen_bluenoise.cjs.
// If a loader ignored texture.noise, noisetex holds its own white noise
// instead; that fails this check (odds of a false match ~1 in 4 billion)
// and we fall back to IGN rather than use a grainier pattern.
#define BLUE_NOISE_PROBE vec4(35.0, 241.0, 192.0, 116.0)

vec4 blueNoise(vec2 fragCoord) {
#if NOISE_PATTERN == 1
    // Same result for every pixel, so the branch is free.
    vec4 probe = texture2D(noisetex, vec2(0.5 / BLUE_NOISE_RES), -16.0) * 255.0;
    vec4 miss = step(0.5, abs(probe - BLUE_NOISE_PROBE));
    if (dot(miss, vec4(1.0)) > 0.0) return ignNoise4(fragCoord);
    // Texel centres, wrapped by hand so clamp or repeat wrap both work; the
    // big negative bias pins LOD 0 across the wrap seam even if the texture
    // were mipmapped.
    vec2 uv = (floor(mod(fragCoord, BLUE_NOISE_RES)) + 0.5) / BLUE_NOISE_RES;
    return texture2D(noisetex, uv, -16.0);
#else
    return ignNoise4(fragCoord);
#endif
}

// Uniform [0,1) -> triangular [-1,1]. As a dither, its noise power does not
// depend on the signal, so gradients show no "noise modulation" bands.
float triangularNoise(float u) {
    float o = u * 2.0 - 1.0;
    return sign(o) * (1.0 - sqrt(max(1.0 - abs(o), 0.0)));
}
#endif
