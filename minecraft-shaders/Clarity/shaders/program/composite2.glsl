// Pass 2: denoise the jittered volumetric light and add it to the scene.
// Also marks, in colortex0 alpha, how much of each pixel's light blooms, so
// composite3's mip chain averages bright light only.
//   in : colortex0 scene, colortex5 volumetric light (a = view depth),
//        colortex6 last frame's exposure
//   out: colortex0 scene (a = bright-only luminance)
#include "/lib/settings.glsl"
#include "/lib/settings_post.glsl"

varying vec2 texcoord;

#ifdef VSH
void main() {
    texcoord = gl_MultiTexCoord0.xy;
    gl_Position = ftransform();
}
#endif

#ifdef FSH
#include "/lib/bloom.glsl"
uniform sampler2D colortex0;
uniform sampler2D colortex5;
uniform sampler2D colortex6;
uniform float viewWidth;
uniform float viewHeight;

// Gaussian matched to the blue-noise march offsets: blue noise has almost
// no energy below ~1/4 cycle per pixel, which a Gaussian of this width
// removes cleanly (a box filter's side lobes let some through).
#if VL_BLUR_RADIUS == 1
#define VL_SIGMA 0.85
#elif VL_BLUR_RADIUS == 2
#define VL_SIGMA 1.4
#else
#define VL_SIGMA 1.7
#endif

void main() {
    vec3 col = texture2D(colortex0, texcoord).rgb;
#if defined VOLUMETRIC_LIGHT && defined OVERWORLD
    vec2 px = 1.0 / vec2(viewWidth, viewHeight);
    // composite1 stores view depth next to the light: one fetch per tap.
    float z0 = texture2D(colortex5, texcoord).a;
    vec3 sum = vec3(0.0);
    float wsum = 0.0;
    for (int x = -VL_BLUR_RADIUS; x <= VL_BLUR_RADIUS; x++) {
        for (int y = -VL_BLUR_RADIUS; y <= VL_BLUR_RADIUS; y++) {
            float r2 = float(x * x + y * y);
            // Rounded footprint: skip the far corners (little weight).
            if (r2 > float(VL_BLUR_RADIUS * VL_BLUR_RADIUS + VL_BLUR_RADIUS + 1)) continue;
            vec4 s = texture2D(colortex5, texcoord + vec2(float(x), float(y)) * px);
            float w = exp(-r2 / (2.0 * VL_SIGMA * VL_SIGMA))
                    / (1.0 + abs(s.a - z0) / max(z0, 1.0) * 20.0);
            sum += s.rgb * w;
            wsum += w;
        }
    }
    col += sum / wsum;
#endif

    float bright = 1.0;
#ifdef BLOOM
    // Share of this pixel that blooms, judged after exposure (last frame's,
    // from composite3) so the threshold means the same by day and in caves.
    float expo = texture2D(colortex6, vec2(0.5)).r;
    if (!(expo > 0.0 && expo < 100.0)) expo = 1.0;
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    bright = lum * bloomShare(lum * expo * EXPOSURE * 0.85);
#endif

    /* DRAWBUFFERS:0 */
    gl_FragData[0] = vec4(col, bright);
}
#endif
