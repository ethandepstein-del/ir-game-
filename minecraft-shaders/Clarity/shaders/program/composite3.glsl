// Pass 3: bloom from the mip chain, auto exposure, tonemap and grading.
#include "/lib/settings.glsl"

const bool colortex0MipmapEnabled = true;

varying vec2 texcoord;

#ifdef VSH
void main() {
    texcoord = gl_MultiTexCoord0.xy;
    gl_Position = ftransform();
}
#endif

#ifdef FSH
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"
uniform sampler2D colortex0;
uniform sampler2D colortex6;
uniform float frameTime;

// On a fullscreen pass the base LOD is 0, so the bias selects the mip.
vec3 bloomTap(float lod) {
    vec2 px = exp2(lod) / vec2(viewWidth, viewHeight);
    vec3 c = texture2D(colortex0, texcoord + vec2( 0.5,  0.5) * px, lod).rgb
           + texture2D(colortex0, texcoord + vec2(-0.5,  0.5) * px, lod).rgb
           + texture2D(colortex0, texcoord + vec2( 0.5, -0.5) * px, lod).rgb
           + texture2D(colortex0, texcoord + vec2(-0.5, -0.5) * px, lod).rgb;
    return c * 0.25;
}

// Narkowicz ACES fit: filmic, keeps highlights from clipping.
vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
    vec3 col = texture2D(colortex0, texcoord).rgb;

#ifdef BLOOM
    vec3 bloom = bloomTap(2.0) * 0.30 + bloomTap(3.0) * 0.25 + bloomTap(4.0) * 0.20
               + bloomTap(5.0) * 0.15 + bloomTap(6.0) * 0.10;
    col = mix(col, bloom, BLOOM_STRENGTH);
#endif

    // Average scene luminance (log mean, centre weighted) from a small mip.
    float logSum = 0.0;
    float wSum = 0.0;
    for (int x = 0; x < 4; x++) {
        for (int y = 0; y < 4; y++) {
            vec2 p = (vec2(float(x), float(y)) + 0.5) / 4.0;
            float w = 1.0 - 0.5 * length(p - 0.5);
            logSum += log(luma(texture2D(colortex0, p, 7.0).rgb) + 1e-4) * w;
            wSum += w;
        }
    }
    float avgLum = exp(logSum / wSum);

#ifdef AUTO_EXPOSURE
    float target = clamp(0.30 / avgLum, 0.50, 2.40);
#if defined OVERWORLD
    // Nudge caves brighter still, using the game's own eye-light value.
    target *= mix(sqrt(CAVE_ADAPTATION), 1.0, float(eyeBrightnessSmooth.y) / 240.0);
#endif
    float prev = texture2D(colortex6, vec2(0.5)).r;
    float speed = target > prev ? 1.1 : 2.6;   // eyes adjust faster to bright
    float exposure = (prev > 0.0 && prev < 100.0) ? mix(prev, target, 1.0 - exp(-frameTime * speed)) : target;
#else
    float exposure = 1.0;
#if defined OVERWORLD
    float eyeSky = float(eyeBrightnessSmooth.y) / 240.0;
    exposure *= mix(CAVE_ADAPTATION, 1.0, eyeSky);
    exposure *= 1.0 + (1.0 - dayFactor()) * eyeSky * 1.4;
#else
    exposure *= 1.2;
#endif
#endif
    float stored = exposure;
    col *= exposure * EXPOSURE * 0.85;

    // Night vision (Purkinje shift): dim scenes drift to cool, softer colour.
    float night = (1.0 - smoothstep(0.015, 0.10, avgLum)) * 0.35;
    col = mix(col, luma(col) * vec3(0.72, 0.88, 1.20), night);

    col = aces(col);
    col = pow(col, vec3(1.0 / 2.2));

    float l = luma(col);
    col = mix(vec3(l), col, SATURATION);
    col = (col - 0.5) * CONTRAST + 0.5;

    /* DRAWBUFFERS:06 */
    gl_FragData[0] = vec4(clamp(col, 0.0, 1.0), 1.0);
    gl_FragData[1] = vec4(stored, avgLum, 0.0, 1.0);
}
#endif
