// RT denoise: one edge-aware a-trous wavelet iteration (ATROUS_STEP px),
// SVGF style. Edge stopping uses plane distance, normals and luminance; the
// luminance tolerance comes from the estimated noise (variance), so noisy
// pixels blur more and converged ones keep their detail.
//
// First iteration (ATROUS_STEP 1, deferred2) also:
//   - estimates variance: temporal (luma moments from the fast history,
//     divided by the history length) once history has built up, spatial
//     (3x3) right after a disocclusion;
//   - clamps the result to the current frame's neighbourhood (YCoCg box
//     from the fast history), and where the history misses the
//     neighbourhood mean by more than its noise explains (lighting changed:
//     door opened, torch placed) pulls it to that mean and shortens it, so
//     the change shows within a few frames;
//   - writes next frame's history to colortex8 (the filtered result with
//     RT_HISTORY_FEEDBACK, else the clamped unfiltered accumulation).
//   in : colortex10 slow accumulation + history length, colortex13 fast
//        history + second moment, colortex9 depth + normal
//   out: colortex10 filtered rgb + variance, colortex8 history + length
// Later iterations: colortex10 rgb + variance in and out.
#include "/lib/settings.glsl"
#include "/lib/settings_rt.glsl"

#ifdef VSH
void main() {
    gl_Position = ftransform();
}
#endif

#ifdef FSH
#include "/lib/common.glsl"
#include "/lib/rt.glsl"
uniform sampler2D colortex9;    // linear depth + view normal (from deferred1)
uniform sampler2D colortex10;
#if ATROUS_STEP == 1
uniform sampler2D colortex13;
#endif

float kernel(int i) { return i == 0 ? 0.375 : (i == 1 || i == -1 ? 0.25 : 0.0625); }

void main() {
    ivec2 p = ivec2(gl_FragCoord.xy);
    vec4 center = texelFetch(colortex10, p, 0);
    vec4 outColor = vec4(0.0);
#if ATROUS_STEP == 1
    vec4 outHistory = vec4(0.0);
#endif

#if defined RT_GI && defined OVERWORLD
    vec4 d0 = texelFetch(colortex9, p, 0);
    if (d0.r > 0.0) {
        ivec2 screen = rtScreenSize();
        float z0 = d0.r;
        vec3 n0 = decodeNormal(d0.gb);
        vec3 P0 = viewFromLinear((vec2(p) + 0.5) / vec2(screen), z0);
        float l0 = luma(center.rgb);

#if ATROUS_STEP == 1
        // ---- variance and clamp box from a 3x3 neighbourhood. With
        // reduced-rate tracing the taps are one block apart, so they come
        // from different traced samples.
        float len0 = max(center.a, 1.0);
        float varT = 0.0, sm1 = 0.0, sm2 = 0.0, kw = 0.0;
        vec3 bm1 = vec3(0.0), bm2 = vec3(0.0);
        float bw = 0.0;
        for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
                ivec2 c = p + ivec2(i, j) * RT_BLOCK;
                if (any(lessThan(c, ivec2(0))) || any(greaterThanEqual(c, screen))) continue;
                vec4 g = texelFetch(colortex9, c, 0);
                if (g.r <= 0.0) continue;
                float wg = normalWeight(n0, decodeNormal(g.gb), 8.0)
                         * planeWeight(n0, P0, viewFromLinear((vec2(c) + 0.5) / vec2(screen), g.r), z0);
                vec4 s = texelFetch(colortex10, c, 0);
                vec4 f = texelFetch(colortex13, c, 0);
                float k = (i == 0 ? 2.0 : 1.0) * (j == 0 ? 2.0 : 1.0) * wg;   // 3x3 binomial
                float lf = luma(f.rgb);
                varT += k * max(f.a - lf * lf, 0.0) / max(s.a, 1.0);
                float ls = luma(s.rgb);
                sm1 += k * ls;
                sm2 += k * ls * ls;
                kw += k;
                vec3 y = rgbToYCoCg(f.rgb);
                bm1 += wg * y;
                bm2 += wg * y * y;
                bw += wg;
            }
        }
        varT /= max(kw, 1e-5);
        float varS = max(sm2 / max(kw, 1e-5) - (sm1 * sm1) / max(kw * kw, 1e-10), 0.0);
        // Right after a disocclusion the moments hold one sample: use the
        // spatial estimate, then hand over to the temporal one.
        float var0 = mix(varS, varT, smoothstep(1.0, 4.0, len0));
#else
        float var0 = max(center.a, 0.0);
#endif

        // ---- 5x5 a-trous
        float sigmaL = RT_DENOISE * sqrt(var0) + 1e-3;
        vec3 sum = vec3(0.0);
        float wsum = 0.0;
        float vsum = 0.0;
        for (int y = -2; y <= 2; y++) {
            for (int x = -2; x <= 2; x++) {
                ivec2 c = p + ivec2(x, y) * ATROUS_STEP;
                if (any(lessThan(c, ivec2(0))) || any(greaterThanEqual(c, screen))) continue;
                vec4 dq = texelFetch(colortex9, c, 0);
                if (dq.r <= 0.0) continue;
                vec4 s = texelFetch(colortex10, c, 0);
                float w = kernel(x) * kernel(y);
                w *= normalWeight(n0, decodeNormal(dq.gb), 32.0);
                // Distance from the neighbour to this pixel's plane: floors
                // seen at a grazing angle still blur along their surface.
                w *= planeWeight(n0, P0, viewFromLinear((vec2(c) + 0.5) / vec2(screen), dq.r), z0);
                w *= exp(-abs(luma(s.rgb) - l0) / sigmaL);
                sum += s.rgb * w;
                wsum += w;
#if ATROUS_STEP == 1
                vsum += w * w * var0;   // neighbours' variance isn't known yet
#else
                vsum += w * w * max(s.a, 0.0);
#endif
            }
        }
        // The centre always contributes (w = kernel(0)^2 > 0), so wsum > 0.
        vec3 filtered = sum / wsum;
        float varOut = vsum / (wsum * wsum);

#if ATROUS_STEP == 1
        // ---- history clamp against the fast history's neighbourhood
        float lenOut = len0;
#ifdef RT_HISTORY_FEEDBACK
        vec3 hist = filtered;
#else
        vec3 hist = center.rgb;
#endif
        if (RT_HISTORY_CLAMP > 0.0 && bw > 2.5) {
            vec3 mean = bm1 / bw;
            vec3 sd = sqrt(max(bm2 / bw - mean * mean, vec3(0.0)));
            vec3 ext = sd * RT_HISTORY_CLAMP + vec3(0.02 * mean.x + 0.002);
            vec3 fy = clipToBox(mean, ext, rgbToYCoCg(filtered));
            vec3 hy = rgbToYCoCg(hist);
            // Anti-lag: the box above is wide (the fast history is only a
            // few samples deep), so also test the history against the
            // neighbourhood MEAN, whose noise is sd / sqrt(taps). A clear
            // miss means the lighting changed: pull toward the mean and
            // restart from the fast history length.
            float z = abs(hy.x - mean.x) / (RT_HISTORY_CLAMP * 1.33 * sd.x / sqrt(bw) + 0.1 * mean.x + 0.002);
            float changed = smoothstep(0.5, 1.5, z);
            hy = mix(clipToBox(mean, ext, hy), mean, changed);
            fy = mix(fy, mean, changed);
            lenOut = mix(len0, min(len0, RT_FAST_HISTORY), changed);
            filtered = max(yCoCgToRgb(fy), vec3(0.0));
            hist = max(yCoCgToRgb(hy), vec3(0.0));
        }
        outHistory = vec4(hist, lenOut);
#endif
        outColor = vec4(filtered, varOut);
    }
#endif

    // The RENDERTARGETS directive is in the wrapper (deferred_atrous_first
    // / deferred_atrous_wide), so each program carries exactly one.
    gl_FragData[0] = outColor;
#if ATROUS_STEP == 1
    gl_FragData[1] = outHistory;
#endif
}
#endif
