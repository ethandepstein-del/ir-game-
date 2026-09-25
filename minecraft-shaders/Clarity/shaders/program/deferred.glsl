// RT pass 1 (deferred): trace diffuse rays through the voxel world for sky
// light, sunlight bounce, torch-lit bounce and emissive surfaces.
// Runs after deferred.csh, whose dispatch makes Iris issue the memory
// barrier that publishes the shadow pass's voxel writes.
//
// With RT_RESOLUTION < 1 only one pixel per block traces, and the result is
// packed into the lower-left rtLowSize() texels; fragments outside that
// rectangle exit at once (whole warps, so the saving is real).
//   out: colortex12 raw radiance (rgb) + which pixel of the block traced
//        (a = 1 + fallback index, 0 = nothing traceable in the block)
//
// RT buffers (formats here so composite.glsl's block stays untouched):
//   colortex8  slow history: rgb + history length     (persistent)
//   colortex9  linear depth + view normal              (persistent)
//   colortex10 working GI: rgb + history length / variance
//   colortex12 raw trace, packed                       (transient)
//   colortex13 fast history: rgb + luma second moment  (persistent)
/*
const int colortex12Format = RGBA16F;
const bool colortex12Clear = false;
const int colortex13Format = RGBA16F;
const bool colortex13Clear = false;
*/
#include "/lib/settings.glsl"
#include "/lib/settings_rt.glsl"
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"

varying vec3 ambCol;     // raster sky ambient (what the tracer replaces)
varying vec3 sunCol;
varying vec3 lightDir;
varying vec3 skyScale;   // atmosphere() -> sky radiance, energy-matched to ambCol

#ifdef VSH
void main() {
    gl_Position = ftransform();
    ambCol = ambientColor();
    sunCol = directLightColor();
    lightDir = lightDirWorld();
    // An up-facing surface under open sky must get the same light traced as
    // it gets from the raster ambient, or switching RT on changes the
    // exposure of every outdoor scene. Estimate the cosine-weighted mean of
    // the sky over the upper hemisphere and scale escaped rays to match.
    vec3 avg = vec3(0.0);
    for (int i = 0; i < 16; i++) {
        float u = (float(i) + 0.5) / 16.0;
        float r = sqrt(u);
        float phi = float(i) * 2.39996323;
        avg += atmosphere(vec3(r * cos(phi), sqrt(1.0 - u), r * sin(phi)));
    }
    avg /= 16.0;
    skyScale = clamp(ambCol / max(avg, vec3(1e-4)), vec3(0.0), vec3(8.0));
}
#endif

#ifdef FSH
#include "/lib/distort.glsl"
#include "/lib/rt.glsl"

uniform sampler2D colortex1;
uniform sampler2D colortex2;
uniform sampler2D depthtex0;
uniform int frameCounter;

#if defined RT_GI && defined OVERWORLD
uniform sampler2DShadow shadowtex0;
uniform mat4 shadowModelView;
uniform mat4 shadowProjection;

float shadowAt(vec3 playerPos) {
    vec3 sc = (shadowProjection * (shadowModelView * vec4(playerPos, 1.0))).xyz;
    vec3 p = distortShadow(sc) * 0.5 + 0.5;
    if (p.x <= 0.0 || p.x >= 1.0 || p.y <= 0.0 || p.y >= 1.0 || p.z >= 1.0) return 1.0;
    return shadow2D(shadowtex0, vec3(p.xy, p.z - 0.0003)).x;
}
#include "/lib/voxel.glsl"

// HOOK (blue noise): when a blue-noise `noisetex` is available, define
// RT_BLUE_NOISE to use it as the per-pixel base instead of IGN + R2 dither.
// Two decorrelated channels (e.g. R and G of a 2-channel blue-noise
// texture) are needed; a single-channel texture would correlate the two
// sample dimensions.
#ifdef RT_BLUE_NOISE
uniform sampler2D noisetex;
#endif

// 2D sample for ray r on this frame. The spatial base (IGN for one
// dimension, the R2 dither for the other: different lattices, so the two
// are uncorrelated) is advanced along the R2 sequence each frame, so a
// pixel's samples over time are a low-discrepancy 2D set.
vec2 rtSample(ivec2 q, int frame, int r) {
#ifdef RT_BLUE_NOISE
    vec2 base = texelFetch(noisetex, q % textureSize(noisetex, 0), 0).rg;
#else
    vec2 base = vec2(ign(vec2(q)), fract(dot(vec2(q), vec2(0.7548776662, 0.5698402910))));
#endif
    float i = float((frame * RT_RAYS + r) & 4095);
    return fract(base + i * vec2(0.7548776662, 0.5698402910));
}
#endif

void main() {
    ivec2 q = ivec2(gl_FragCoord.xy);
    if (any(greaterThanEqual(q, rtLowSize()))) discard;
    vec4 result = vec4(0.0);

#if defined RT_GI && defined OVERWORLD
    ivec2 screen = rtScreenSize();
    int frame = frameCounter;

    // The pixel this block traces from; if it's sky, an entity or the
    // hand, fall back to the block's other pixels.
    ivec2 P = ivec2(-1);
    float depth = 1.0;
    int kSel = -1;
    for (int k = 0; k < RT_BLOCK_PIXELS; k++) {
        ivec2 c = q * RT_BLOCK + rtOffset(q, frame, k);
        if (any(greaterThanEqual(c, screen))) continue;
        float d = texelFetch(depthtex0, c, 0).r;
        if (rtTraceable(texelFetch(colortex2, c, 0), d)) { P = c; depth = d; kSel = k; break; }
    }

    if (kSel >= 0) {
        vec2 uv = (vec2(P) + 0.5) / vec2(screen);
        vec3 viewPos = screenToView(uv, depth);
        vec4 data = texelFetch(colortex1, P, 0);
        vec3 n = normalize(mat3(gbufferModelViewInverse) * decodeNormal(data.xy));
        float lmSky = data.b;
        vec3 playerPos = (gbufferModelViewInverse * vec4(viewPos, 1.0)).xyz;
        float skyPrior = smoothstep(0.05, 0.60, lmSky);

        vec3 T = normalize(abs(n.y) < 0.99 ? cross(n, vec3(0.0, 1.0, 0.0)) : cross(n, vec3(1.0, 0.0, 0.0)));
        vec3 B = cross(n, T);
        // Push off the surface by more in the distance, where depth is
        // less precise, so the ray never starts inside its own block.
        vec3 origin = playerToGrid(playerPos + n * (0.04 - viewPos.z * 0.0015));

        vec3 traced = vec3(0.0);
        for (int r = 0; r < RT_RAYS; r++) {
            vec2 u = rtSample(q, frame, r);
            // Cosine-weighted hemisphere direction.
            float phi = u.x * 6.2831853;
            float s = sqrt(u.y);
            vec3 dir = normalize(T * (cos(phi) * s) + B * (sin(phi) * s) + n * sqrt(max(1.0 - u.y, 0.0)));

            vec3 hitPos, hitN;
            uint voxel;
            bool leftGrid;
            vec3 sampleL;
            if (traceVoxels(origin, dir, RT_DISTANCE, u.x + float(frame & 255), hitPos, hitN, voxel, leftGrid)) {
                // Sky light at the hit can't exceed the origin's by more
                // than one level per block travelled (stops cave ceilings
                // and walls with a sunlit other side from glowing).
                float skyCap = lmSky + length(hitPos - origin) * 1.5 / 15.0;
                sampleL = voxelRadianceCapped(voxel, hitPos, hitN, sunCol, ambCol, lightDir, skyCap);
            } else if (leftGrid) {
                // Ran off the voxel grid: fall back to the raster estimate.
                sampleL = ambCol * lmSky * lmSky;
            } else {
                // Open air for RT_DISTANCE: sky, trusting vanilla sky light so
                // rays in a deep cave don't find one.
                sampleL = atmosphere(dir) * skyScale * skyPrior;
            }
            // Clamp single-sample outliers (bright emitters) to kill fireflies.
            traced += sampleL * min(1.0, 3.0 / max(luma(sampleL), 1e-3));
        }
        result = vec4(traced / float(RT_RAYS), float(kSel + 1));
    }
#endif

    /* RENDERTARGETS: 12 */
    gl_FragData[0] = result;
}
#endif
