// The whole sky: scattering, sun disc, stars and clouds. Vanilla's dome,
// sunrise fan and void all get the same colour, so layers never show;
// vanilla stars are dropped (the procedural ones replace them).
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

void main() {
    bool isStar = star > 0.5;
#ifdef MC_RENDER_STAGE_STARS
    isStar = renderStage == MC_RENDER_STAGE_STARS;
#endif
    if (isStar) discard;

    vec2 uv = gl_FragCoord.xy / vec2(viewWidth, viewHeight);
    vec3 viewDir = normalize(screenToView(uv, 1.0));
    vec3 dir = normalize(mat3(gbufferModelViewInverse) * viewDir);

    vec3 col = skyFull(dir, true, ambCol, sunCol);

    /* DRAWBUFFERS:0 */
    gl_FragData[0] = vec4(col, 1.0);
}
#endif
