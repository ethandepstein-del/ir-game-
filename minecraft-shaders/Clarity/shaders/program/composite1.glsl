// Pass 2: bloom from the mip chain, exposure, tonemap and grading.
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
uniform sampler2D colortex0;

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

    float exposure = EXPOSURE;
#if defined OVERWORLD
    // Stand-in for eye adaptation: brighten caves and nights so they stay
    // playable, using the game's smoothed light-at-eye value.
    float eyeSky = float(eyeBrightnessSmooth.y) / 240.0;
    exposure *= mix(CAVE_ADAPTATION, 1.0, eyeSky);
    exposure *= 1.0 + (1.0 - dayFactor()) * eyeSky * 1.4;
#elif defined NETHER
    exposure *= 1.25;
#else
    exposure *= 1.15;
#endif
    col *= exposure * 0.85;

    col = aces(col);
    col = pow(col, vec3(1.0 / 2.2));

    float l = luma(col);
    col = mix(vec3(l), col, SATURATION);
    col = (col - 0.5) * CONTRAST + 0.5;

    /* DRAWBUFFERS:0 */
    gl_FragData[0] = vec4(clamp(col, 0.0, 1.0), 1.0);
}
#endif
