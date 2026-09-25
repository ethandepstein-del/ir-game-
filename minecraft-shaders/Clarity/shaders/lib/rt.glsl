// Shared helpers for the RT denoise chain (deferred to deferred5).
// Requires settings.glsl, settings_rt.glsl and common.glsl.
#if !defined INCLUDE_RT
#define INCLUDE_RT

// Reduced-rate tracing: the screen is cut into blocks of RT_BLOCK pixels
// and each block traces from one pixel per frame. The trace pass writes one
// texel per block, packed into the lower-left corner of colortex12, so
// whole warps either trace or exit (a scattered pattern would leave most
// lanes of every warp idle and save nothing).
const ivec2 RT_BLOCK = RT_RESOLUTION < 0.6 ? ivec2(2, 2) : (RT_RESOLUTION < 0.85 ? ivec2(2, 1) : ivec2(1, 1));
const int RT_BLOCK_PIXELS = RT_BLOCK.x * RT_BLOCK.y;

// Short history for the fast accumulator (moments and the clamp box).
const float RT_FAST_HISTORY = clamp(float(RT_HISTORY) / 4.0, 2.0, 3.0);

ivec2 rtScreenSize() { return ivec2(int(viewWidth + 0.5), int(viewHeight + 0.5)); }
ivec2 rtLowSize() { return (rtScreenSize() + RT_BLOCK - 1) / RT_BLOCK; }

// Pixel inside block b that traces on this frame; k = 1..3 are the
// fallbacks tried when that pixel can't trace (sky, entity, hand).
ivec2 rtOffset(ivec2 b, int frame, int k) {
    if (RT_BLOCK_PIXELS == 4) {
        // (0,0) (1,1) (1,0) (0,1): diagonal first, so two frames already
        // cover the block evenly.
        int i = (frame + k) & 3;
        return ivec2((i == 1 || i == 2) ? 1 : 0, (i == 1 || i == 3) ? 1 : 0);
    }
    if (RT_BLOCK_PIXELS == 2) return ivec2((b.y + frame + k) & 1, 0);   // checkerboard
    return ivec2(0);
}

// Opaque, non-moving, non-hand geometry: the only pixels that get RT.
bool rtTraceable(vec4 mat, float depth) {
    return abs(mat.g - 0.5) < 0.1 && mat.r < 0.5 && mat.b < 0.5 && depth < 1.0;
}

// View-space position from linear depth (symmetric perspective projection).
vec3 viewFromLinear(vec2 uv, float z) {
    return vec3((uv * 2.0 - 1.0) * z / vec2(gbufferProjection[0][0], gbufferProjection[1][1]), -z);
}
float linearFromDepth(float depth) {
    // Same as -screenToView(uv, depth).z, without the uv dependence.
    vec4 p = gbufferProjectionInverse * vec4(0.0, 0.0, depth * 2.0 - 1.0, 1.0);
    return -p.z / p.w;
}

// Geometry similarity used by the upsample, the clamp box and the filter.
float normalWeight(vec3 a, vec3 b, float power) {
    return pow(max(dot(a, b), 0.0), power);
}
float planeWeight(vec3 n0, vec3 P0, vec3 Pq, float z0) {
    return exp(-abs(dot(n0, Pq - P0)) / (0.05 + 0.01 * z0));
}

vec3 rgbToYCoCg(vec3 c) {
    return vec3(0.25 * c.r + 0.5 * c.g + 0.25 * c.b, 0.5 * (c.r - c.b), -0.25 * c.r + 0.5 * c.g - 0.25 * c.b);
}
vec3 yCoCgToRgb(vec3 c) {
    return vec3(c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z);
}

// Pull x toward the box centre until it's inside the box (variance clipping).
vec3 clipToBox(vec3 center, vec3 extent, vec3 x) {
    vec3 v = x - center;
    vec3 a = abs(v) / max(extent, vec3(1e-5));
    float m = max(a.x, max(a.y, a.z));
    return m > 1.0 ? center + v / m : x;
}

#endif
