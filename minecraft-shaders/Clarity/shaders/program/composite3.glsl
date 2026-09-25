// Pass 3: bloom from the mip chain, auto exposure, tonemap and grading.
#ifdef FSH
// texture2DLod in the fragment stage (B-spline bloom taps, lib/bloom.glsl).
#extension GL_ARB_shader_texture_lod : enable
#endif
#include "/lib/settings.glsl"

const bool colortex0MipmapEnabled = true;

varying vec2 texcoord;
varying float exposure;   // same for every pixel: metered once, in the VSH
varying float avgLum;

#ifdef VSH
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"
uniform sampler2D colortex0;
uniform sampler2D colortex6;
uniform sampler2D depthtex0;
uniform float frameTime;

void main() {
    texcoord = gl_MultiTexCoord0.xy;
    gl_Position = ftransform();

    // Log-average luminance of what is on screen, ignoring open sky so
    // looking up doesn't darken the ground you are fighting on.
    float logSum = 0.0;
    float wSum = 0.0;
    for (int x = 0; x < 6; x++) {
        for (int y = 0; y < 6; y++) {
            vec2 p = (vec2(float(x), float(y)) + 0.5) / 6.0;
            float sky = step(1.0, texture2DLod(depthtex0, p, 0.0).r);
            float w = (1.0 - 0.6 * length(p - 0.5)) * mix(1.0, 0.08, sky);
            logSum += log(luma(texture2DLod(colortex0, p, 6.0).rgb) + 1e-4) * w;
            wSum += w;
        }
    }
    avgLum = exp(logSum / wSum);

#ifdef AUTO_EXPOSURE
    float target = clamp(EXPOSURE_KEY / avgLum, EXPOSURE_MIN, EXPOSURE_MAX);
#if defined OVERWORLD
    // Nudge caves brighter still, using the game's own eye-light value.
    target *= mix(sqrt(CAVE_ADAPTATION), 1.0, float(eyeBrightnessSmooth.y) / 240.0);
#endif
    float prev = texture2DLod(colortex6, vec2(0.5), 0.0).r;
    float speed = target > prev ? 3.0 : 5.0;   // quick, but not a flicker
    exposure = (prev > 0.0 && prev < 100.0) ? mix(prev, target, 1.0 - exp(-frameTime * speed)) : target;
#else
    exposure = 1.0;
#if defined OVERWORLD
    float eyeSky = float(eyeBrightnessSmooth.y) / 240.0;
    exposure *= mix(CAVE_ADAPTATION, 1.0, eyeSky);
    exposure *= 1.0 + (1.0 - dayFactor()) * eyeSky * 1.4;
#else
    exposure *= 1.2;
#endif
#endif
}
#endif

#ifdef FSH
#include "/lib/common.glsl"
#define BLOOM_SAMPLING
#include "/lib/bloom.glsl"
uniform sampler2D colortex0;

// Narkowicz ACES fit: filmic, keeps highlights from clipping.
vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
    vec4 c0 = texture2D(colortex0, texcoord);
    vec3 col = c0.rgb;

#ifdef BLOOM
    // Five mip levels (1/4 to 1/64 res), each B-spline filtered, of the
    // bright-only light composite2 marked in alpha. The pixel gives up its
    // own bright part in exchange, so this is mix(col, bloom, BLOOM_STRENGTH)
    // restricted to light above BLOOM_THRESHOLD (identical at threshold 0).
    vec2 res = vec2(viewWidth, viewHeight);
    vec3 bloom = bloomLevel(colortex0, texcoord, 2.0, res) * 0.30
               + bloomLevel(colortex0, texcoord, 3.0, res) * 0.25
               + bloomLevel(colortex0, texcoord, 4.0, res) * 0.20
               + bloomLevel(colortex0, texcoord, 5.0, res) * 0.15
               + bloomLevel(colortex0, texcoord, 6.0, res) * 0.10;
    vec3 bright = col * clamp(c0.a / max(luma(col), 1e-6), 0.0, 1.0);
    col = max(col + (bloom - bright) * BLOOM_STRENGTH, vec3(0.0));
#endif

#ifdef NIGHT_SHIFT
    // Purkinje shift: dim parts of dim scenes drift to cooler, softer colour.
    // Weighted per pixel, so torches and lava keep their warmth.
    float night = (1.0 - smoothstep(0.015, 0.10, avgLum)) * 0.25
                * (1.0 - smoothstep(0.01, 0.15, luma(col)));
#endif
    col *= exposure * EXPOSURE * 0.85;

#ifdef NIGHT_SHIFT
    col = mix(col, luma(col) * vec3(0.72, 0.88, 1.20), night);
#endif

    col = aces(col);
    col = pow(col, vec3(1.0 / 2.2));

    float l = luma(col);
    col = mix(vec3(l), col, SATURATION);
    col = (col - 0.5) * CONTRAST + 0.5;

    /* DRAWBUFFERS:06 */
    gl_FragData[0] = vec4(clamp(col, 0.0, 1.0), 1.0);
    gl_FragData[1] = vec4(exposure, avgLum, 0.0, 1.0);
}
#endif
