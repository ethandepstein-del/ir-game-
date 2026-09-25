// RT denoise: one edge-aware a-trous wavelet iteration (ATROUS_STEP px).
// Stops at depth and normal edges; blurs less once history has built up.
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
uniform sampler2D colortex1;
uniform sampler2D colortex10;
uniform sampler2D depthtex0;

float kernel(int i) { return i == 0 ? 0.375 : (i == 1 || i == -1 ? 0.25 : 0.0625); }

void main() {
    vec4 center = texture2D(colortex10, texcoord);
#if defined RT_GI && defined OVERWORLD
    float d = texture2D(depthtex0, texcoord).r;
    if (center.a > 0.0 && d < 1.0) {
        vec2 px = float(ATROUS_STEP) / vec2(viewWidth, viewHeight);
        float z0 = -screenToView(texcoord, d).z;
        vec3 n0 = decodeNormal(texture2D(colortex1, texcoord).xy);
        float l0 = luma(center.rgb);
        float lumaSigma = 0.5 + 4.0 / center.a;

        vec3 sum = vec3(0.0);
        float wsum = 0.0;
        for (int x = -2; x <= 2; x++) {
            for (int y = -2; y <= 2; y++) {
                vec2 q = texcoord + vec2(float(x), float(y)) * px;
                vec4 s = texture2D(colortex10, q);
                if (s.a <= 0.0) continue;
                float zq = -screenToView(q, texture2D(depthtex0, q).r).z;
                vec3 nq = decodeNormal(texture2D(colortex1, q).xy);
                float w = kernel(x) * kernel(y);
                w *= exp(-abs(zq - z0) / (z0 * 0.03 + 0.05));
                w *= pow(max(dot(nq, n0), 0.0), 32.0);
                w *= exp(-abs(luma(s.rgb) - l0) / (lumaSigma * (l0 + 0.05)));
                sum += s.rgb * w;
                wsum += w;
            }
        }
        center.rgb = sum / max(wsum, 1e-5);
    }
#endif
    /* RENDERTARGETS: 10 */
    gl_FragData[0] = center;
}
#endif
