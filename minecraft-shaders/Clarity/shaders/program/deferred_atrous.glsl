// RT denoise: one edge-aware a-trous wavelet iteration (ATROUS_STEP px).
// Stops at geometry edges (plane distance + normals) and at lighting edges;
// blurs less once temporal history has built up.
#include "/lib/settings.glsl"

varying vec2 texcoord;

#ifdef VSH
void main() {
    texcoord = gl_MultiTexCoord0.xy;
    gl_Position = ftransform();
}
#endif

#ifdef FSH
#include "/lib/common.glsl"
uniform sampler2D colortex0;
uniform sampler2D colortex9;    // linear depth + view normal (from deferred)
uniform sampler2D colortex10;

float kernel(int i) { return i == 0 ? 0.375 : (i == 1 || i == -1 ? 0.25 : 0.0625); }

// View-space position from linear depth (symmetric perspective projection).
vec3 viewFromLinear(vec2 uv, float z) {
    return vec3((uv * 2.0 - 1.0) * z / vec2(gbufferProjection[0][0], gbufferProjection[1][1]), -z);
}

void main() {
    vec4 center = texture2D(colortex10, texcoord);
#if defined RT_GI && defined OVERWORLD
    vec4 d0 = texture2D(colortex9, texcoord);
    if (center.a > 0.0 && d0.r > 0.0) {
        vec2 px = float(ATROUS_STEP) / vec2(viewWidth, viewHeight);
        float z0 = d0.r;
        vec3 n0 = decodeNormal(d0.gb);
        vec3 P0 = viewFromLinear(texcoord, z0);
        float l0 = luma(center.rgb);
        float lumaSigma = 0.5 + 4.0 / center.a;
        float planeSigma = 0.05 + 0.01 * z0;

        vec3 sum = vec3(0.0);
        float wsum = 0.0;
        for (int x = -2; x <= 2; x++) {
            for (int y = -2; y <= 2; y++) {
                vec2 q = texcoord + vec2(float(x), float(y)) * px;
                vec4 s = texture2D(colortex10, q);
                vec4 dq = texture2D(colortex9, q);
                if (s.a <= 0.0 || dq.r <= 0.0) continue;
                vec3 nq = decodeNormal(dq.gb);
                float nd = max(dot(nq, n0), 0.0);
                nd *= nd; nd *= nd; nd *= nd; nd *= nd; nd *= nd;   // pow 32
                float w = kernel(x) * kernel(y) * nd;
                // Distance from the neighbour to this pixel's plane: floors
                // seen at a grazing angle still blur along their surface.
                w *= exp(-abs(dot(n0, viewFromLinear(q, dq.r) - P0)) / planeSigma);
                w *= exp(-abs(luma(s.rgb) - l0) / (lumaSigma * (l0 + 0.05)));
                sum += s.rgb * w;
                wsum += w;
            }
        }
        center.rgb = sum / max(wsum, 1e-5);
    }
#endif
    /* RENDERTARGETS: 0,10 */
    gl_FragData[0] = texture2D(colortex0, texcoord);
    gl_FragData[1] = center;
}
#endif
