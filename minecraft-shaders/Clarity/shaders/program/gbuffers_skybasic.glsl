// The whole sky: scattering, sun disc, stars and clouds. Vanilla's dome,
// sunrise fan and void all get the same colour, so layers never show;
// vanilla stars are dropped (the procedural ones replace them).
// On Iris with VOLUMETRIC_CLOUDS the clouds come from the prepare pass
// (colortex11) instead of being computed here for every sky layer.
#include "/lib/settings.glsl"
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"

varying vec4 color;
varying float star;
varying vec3 ambCol;   // per-frame constants, computed on the few sky vertices
varying vec3 sunCol;

#ifdef VSH
void main() {
    color = gl_Color;
    ambCol = ambientColor();
    sunCol = directLightColor();
    star = float(color.r == color.g && color.g == color.b && color.r > 0.0);
    gl_Position = ftransform();
}
#endif

#ifdef FSH
#ifdef MC_RENDER_STAGE_STARS
uniform int renderStage;
#endif

#if defined IS_IRIS && defined CLOUDS && defined VOLUMETRIC_CLOUDS && defined OVERWORLD
// Volumetric clouds were marched by the prepare pass (prepare_clouds.glsl)
// into the lower-left 1/CLOUD_RES corner of colortex11: upsample them here.
uniform sampler2D colortex11;
uniform int frameCounter;

// True when the prepare pass ran this frame (see prepare_clouds.glsl).
bool volumetricCloudsLive() {
    vec2 screen = vec2(viewWidth, viewHeight);
    vec2 lowSize = ceil(screen / float(CLOUD_RES));
    vec4 m = texture2D(colortex11, vec2(lowSize.x + 1.5, 0.5) / screen);
    float frame = float(frameCounter - (frameCounter / 4096) * 4096);
    return m.x < -0.5 && abs(m.y - frame) < 0.5;
}

vec4 cloudTexel(vec2 p, vec2 lowSize, vec2 screen) {
    return texture2D(colortex11, clamp(p, vec2(0.5), lowSize - 0.5) / screen);
}

vec4 volumetricClouds(vec2 uv) {
    vec2 screen = vec2(viewWidth, viewHeight);
    vec2 lowSize = ceil(screen / float(CLOUD_RES));
#if CLOUD_RES == 1
    return cloudTexel(uv * lowSize, lowSize, screen);
#else
    // Cubic B-spline from 4 bilinear taps: smooth, no blocky upsampling.
    vec2 p = uv * lowSize - 0.5;
    vec2 i = floor(p);
    vec2 f = p - i;
    vec2 f2 = f * f, f3 = f2 * f;
    vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
    vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
    vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
    vec2 w3 = f3 / 6.0;
    vec2 g0 = w0 + w1, g1 = w2 + w3;
    vec2 h0 = i - 0.5 + w1 / g0;   // texel centres sit at +0.5
    vec2 h1 = i + 1.5 + w3 / g1;
    return g0.y * (g0.x * cloudTexel(vec2(h0.x, h0.y), lowSize, screen) + g1.x * cloudTexel(vec2(h1.x, h0.y), lowSize, screen))
         + g1.y * (g0.x * cloudTexel(vec2(h0.x, h1.y), lowSize, screen) + g1.x * cloudTexel(vec2(h1.x, h1.y), lowSize, screen));
#endif
}
#endif

void main() {
    bool isStar = star > 0.5;
#ifdef MC_RENDER_STAGE_STARS
    isStar = renderStage == MC_RENDER_STAGE_STARS;
#endif
    if (isStar) discard;

    vec2 uv = gl_FragCoord.xy / vec2(viewWidth, viewHeight);
    vec3 viewDir = normalize(screenToView(uv, 1.0));
    vec3 dir = normalize(mat3(gbufferModelViewInverse) * viewDir);

#if defined IS_IRIS && defined CLOUDS && defined VOLUMETRIC_CLOUDS && defined OVERWORLD
    vec3 col;
    if (volumetricCloudsLive()) {
        vec3 sky = atmosphere(dir) + stars(dir) + sunDisc(dir);
        vec4 cl = volumetricClouds(uv);
        col = sky * (1.0 - cl.a) + cl.rgb;
    } else {
        col = skyFull(dir, true, ambCol, sunCol);   // flat clouds fallback
    }
#else
    vec3 col = skyFull(dir, true, ambCol, sunCol);
#endif

    /* DRAWBUFFERS:0 */
    gl_FragData[0] = vec4(col, 1.0);
}
#endif
