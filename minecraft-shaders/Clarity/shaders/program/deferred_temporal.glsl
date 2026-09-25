// RT pass 2 (deferred1): upsample the raw trace to full resolution and
// accumulate it over time.
//   in : colortex12 raw trace (this frame, packed per block)
//        colortex8  slow history (last frame, after the first denoise pass)
//        colortex13 fast history + luma second moment (last frame)
//        colortex9  linear depth + normal (last frame)
//   out: colortex10 slow accumulation (rgb) + history length (a)
//        colortex13 fast accumulation (rgb) + luma second moment (a)
//        colortex9  linear depth (-1 = no RT) + view normal, this frame
// colortex8 is written by the first a-trous pass (history feedback and
// clamping), not here.
#include "/lib/settings.glsl"
#include "/lib/settings_rt.glsl"
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"

varying vec3 ambCol;

#ifdef VSH
void main() {
    gl_Position = ftransform();
    ambCol = ambientColor();
}
#endif

#ifdef FSH
#include "/lib/rt.glsl"

uniform sampler2D colortex1;
uniform sampler2D colortex2;
uniform sampler2D colortex8;
uniform sampler2D colortex9;
uniform sampler2D colortex12;
uniform sampler2D colortex13;
uniform sampler2D depthtex0;
uniform mat4 gbufferPreviousModelView;
uniform mat4 gbufferPreviousProjection;
uniform vec3 previousCameraPosition;
uniform int frameCounter;

void main() {
    ivec2 p = ivec2(gl_FragCoord.xy);
    float depth = texelFetch(depthtex0, p, 0).r;
    vec2 normalEnc = texelFetch(colortex1, p, 0).xy;
    bool valid = rtTraceable(texelFetch(colortex2, p, 0), depth);

    vec4 slowOut = vec4(0.0);
    vec4 fastOut = vec4(0.0);
    float linDepth = -1.0;

#if defined RT_GI && defined OVERWORLD
    if (valid) {
        ivec2 screen = rtScreenSize();
        vec2 uv = (vec2(p) + 0.5) / vec2(screen);
        vec3 viewPos = screenToView(uv, depth);
        linDepth = -viewPos.z;
        vec3 nView = decodeNormal(normalEnc);
        vec3 n = normalize(mat3(gbufferModelViewInverse) * nView);
        float lmSky = texelFetch(colortex1, p, 0).b;
        vec3 playerPos = (gbufferModelViewInverse * vec4(viewPos, 1.0)).xyz;

        // ---- this frame's sample
        vec3 cur = vec3(0.0);
        float curW = 0.0;
        if (RT_BLOCK_PIXELS == 1) {
            vec4 raw = texelFetch(colortex12, p, 0);
            if (raw.a > 0.5) { cur = raw.rgb; curW = 1.0; }
        } else {
            // Edge-aware upsample: gather the samples of the 3x3 blocks
            // around this pixel at the pixels they were actually traced
            // from, weighted by distance, normal and plane distance.
            int frame = frameCounter;
            ivec2 bp = p / RT_BLOCK;
            ivec2 lowSize = rtLowSize();
            vec3 sum = vec3(0.0);
            float wsum = 0.0;
            for (int j = -1; j <= 1; j++) {
                for (int i = -1; i <= 1; i++) {
                    ivec2 b = bp + ivec2(i, j);
                    if (any(lessThan(b, ivec2(0))) || any(greaterThanEqual(b, lowSize))) continue;
                    vec4 raw = texelFetch(colortex12, b, 0);
                    if (raw.a < 0.5) continue;
                    ivec2 P = b * RT_BLOCK + rtOffset(b, frame, int(raw.a + 0.5) - 1);
                    vec2 d = vec2(P - p);
                    float w = exp(-dot(d, d) * 0.6);   // sigma ~0.9 px: own sample dominates
                    vec3 nq = decodeNormal(texelFetch(colortex1, P, 0).xy);
                    w *= normalWeight(nView, nq, 16.0);
                    float zq = linearFromDepth(texelFetch(depthtex0, P, 0).r);
                    w *= planeWeight(nView, viewPos, viewFromLinear((vec2(P) + 0.5) / vec2(screen), zq), linDepth);
                    sum += raw.rgb * w;
                    wsum += w;
                }
            }
            if (wsum > 1e-4) { cur = sum / wsum; curW = 1.0; }
        }

        // Fade to the raster estimate near the edge of the voxel grid, and
        // use it outright where no sample landed on this surface.
        vec3 raster = ambCol * lmSky * lmSky * (0.78 + 0.22 * n.y);
        vec3 a = abs(playerPos);
        float edge = max(a.x, max(a.y, a.z));
        float inGrid = 1.0 - smoothstep(64.0 - 18.0, 64.0 - 4.0, edge);
        cur = mix(raster, curW > 0.0 ? cur : raster, inGrid);

        // ---- reprojection: bilinear over the four previous texels, each
        // tested against the expected depth and normal, so history never
        // blends in sky, entities or the other side of an edge.
        vec3 prevPlayer = playerPos + cameraPosition - previousCameraPosition;
        vec4 prevView = gbufferPreviousModelView * vec4(prevPlayer, 1.0);
        vec4 prevClip = gbufferPreviousProjection * prevView;
        vec2 prevUV = prevClip.xy / prevClip.w * 0.5 + 0.5;
        float expected = -prevView.z;
        vec3 prevNExpected = mat3(gbufferPreviousModelView) * n;
        // Neighbouring texels of a surface seen edge-on differ a lot in
        // depth: widen the tolerance with the viewing angle.
        float cosV = abs(dot(prevNExpected, normalize(prevView.xyz)));
        float tol = expected * 0.02 / max(cosV, 0.15) + 0.05;

        vec4 histSlow = vec4(0.0);
        vec4 histFast = vec4(0.0);
        float hw = 0.0;
        if (prevClip.w > 0.0 && all(greaterThan(prevUV, vec2(0.0))) && all(lessThan(prevUV, vec2(1.0)))) {
            vec2 pos = prevUV * vec2(screen) - 0.5;
            ivec2 base = ivec2(floor(pos));
            vec2 f = pos - vec2(base);
            for (int t = 0; t < 4; t++) {
                ivec2 o = ivec2(t & 1, t >> 1);
                ivec2 c = base + o;
                if (any(lessThan(c, ivec2(0))) || any(greaterThanEqual(c, screen))) continue;
                vec4 g = texelFetch(colortex9, c, 0);
                if (g.r <= 0.0) continue;
                if (abs(g.r - expected) > tol) continue;
                if (dot(decodeNormal(g.gb), prevNExpected) < 0.9) continue;
                float w = (o.x == 1 ? f.x : 1.0 - f.x) * (o.y == 1 ? f.y : 1.0 - f.y);
                histSlow += texelFetch(colortex8, c, 0) * w;
                histFast += texelFetch(colortex13, c, 0) * w;
                hw += w;
            }
        }

        float lc = luma(cur);
        float len = 1.0;
        vec3 slow = cur;
        vec3 fast = cur;
        float m2 = lc * lc;
        if (hw > 0.05) {
            histSlow /= hw;
            histFast /= hw;
            bool finite = !any(isnan(histSlow)) && !any(isinf(histSlow)) && !any(isnan(histFast)) && !any(isinf(histFast));
            if (finite && histSlow.a >= 1.0) {
                // No fresh sample this frame (upsample found nothing on this
                // surface): hold the history instead of mixing in raster.
                len = curW > 0.0 || inGrid < 1.0 ? min(histSlow.a + 1.0, float(RT_HISTORY)) : histSlow.a;
                float aSlow = curW > 0.0 || inGrid < 1.0 ? 1.0 / len : 0.0;
                float aFast = curW > 0.0 || inGrid < 1.0 ? 1.0 / min(len, RT_FAST_HISTORY) : 0.0;
                slow = mix(histSlow.rgb, cur, aSlow);
                fast = mix(histFast.rgb, cur, aFast);
                m2 = mix(histFast.a, lc * lc, aFast);
            }
        }
        slowOut = vec4(slow, len);
        fastOut = vec4(fast, m2);
    }
#endif

    /* RENDERTARGETS: 10,13,9 */
    gl_FragData[0] = slowOut;
    gl_FragData[1] = fastOut;
    gl_FragData[2] = vec4(valid ? linDepth : -1.0, normalEnc, 1.0);
}
#endif
