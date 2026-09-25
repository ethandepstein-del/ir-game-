// Bloom helpers shared by composite2 (bright-pass weight into colortex0.a)
// and composite3 (reads the automatic mip chain of colortex0).
#ifndef CLARITY_BLOOM
#define CLARITY_BLOOM
#include "/lib/settings_post.glsl"

// Share of a pixel's light that blooms, from its exposed luminance: zero
// below BLOOM_THRESHOLD/2, a quadratic knee up to BLOOM_THRESHOLD*1.5, then
// only the excess over the threshold (Unity/Karis-style soft knee).
// BLOOM_THRESHOLD 0 gives 1 everywhere: everything blooms, as it used to.
float bloomShare(float lum) {
    float t = BLOOM_THRESHOLD;
    float knee = max(t * 0.5, 1e-4);
    float soft = clamp(lum - t + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee);
    return clamp(max(soft, lum - t) / max(lum, 1e-5), 0.0, 1.0);
}

#ifdef BLOOM_SAMPLING   // defined by stages that enable texture2DLod
// Cubic B-spline filtered fetch of mip `lod` with 4 bilinear taps (GPU Gems 2,
// ch. 20). Smooth (C2) where bilinear is only C0, so bloom from a small light
// is round rather than a square/diamond. Needs an explicit LOD: the tap
// positions jump at texel edges, which would spike the implicit LOD, so the
// fragment stage enables GL_ARB_shader_texture_lod (see composite3).
vec4 textureBSpline(sampler2D tex, vec2 uv, float lod, vec2 screenSize) {
    vec2 size = max(floor(screenSize / exp2(lod)), vec2(1.0));   // GL mip size
    vec2 t = uv * size - 0.5;
    vec2 f = fract(t);
    vec2 i = t - f;
    vec2 f2 = f * f, f3 = f2 * f;
    vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
    vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
    vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
    vec2 w3 = f3 / 6.0;
    vec2 g0 = w0 + w1;
    vec2 g1 = w2 + w3;
    vec2 p0 = (i - 0.5 + w1 / g0) / size;   // texel-centre coordinates -> uv
    vec2 p1 = (i + 1.5 + w3 / g1) / size;
    return g0.y * (g0.x * texture2DLod(tex, vec2(p0.x, p0.y), lod) + g1.x * texture2DLod(tex, vec2(p1.x, p0.y), lod))
         + g1.y * (g0.x * texture2DLod(tex, vec2(p0.x, p1.y), lod) + g1.x * texture2DLod(tex, vec2(p1.x, p1.y), lod));
}

// One bloom level: the mip's colour scaled to the bright-only luminance that
// composite2 stored in alpha. (Alpha averages bright light per pixel before
// the mips are built, so a small torch still blooms at the coarse levels.)
vec3 bloomLevel(sampler2D tex, vec2 uv, float lod, vec2 screenSize) {
    vec4 c = textureBSpline(tex, uv, lod, screenSize);
    return max(c.rgb, vec3(0.0)) * clamp(c.a / max(dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)), 1e-6), 0.0, 1.0);
}
#endif
#endif
