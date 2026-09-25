// Particles, rain/snow, the block-breaking overlay and other simple
// textured geometry. Variants: WEATHER, DAMAGED (none = particles).
#include "/lib/settings.glsl"
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"
#define NO_SHADOW_LOOKUP

varying vec2 texcoord;
varying vec2 lmcoord;
varying vec4 color;
varying vec3 playerPos;
varying vec3 ambCol;
varying vec3 sunCol;

#ifdef VSH ////////////////////////////////////////////////////////////////
void main() {
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    lmcoord  = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
    lmcoord  = clamp((lmcoord - 0.03125) * 1.06667, 0.0, 1.0);
    color    = gl_Color;
    ambCol   = ambientColor();
    sunCol   = directLightColor();
    playerPos = (gbufferModelViewInverse * (gl_ModelViewMatrix * gl_Vertex)).xyz;
    gl_Position = ftransform();
}
#endif

#ifdef FSH ////////////////////////////////////////////////////////////////
#include "/lib/lighting.glsl"
uniform sampler2D texture;

void main() {
    vec4 albedo = texture2D(texture, texcoord) * color;

#if defined DAMAGED
    // Vanilla multiplies this overlay into the scene: keep it untouched.
    /* DRAWBUFFERS:0 */
    gl_FragData[0] = albedo;
#else
    if (albedo.a < 0.02) discard;
    vec3 light = surfaceLight(normalize(upPosition), lmcoord, vec3(0.0), playerPos, true, ambCol, sunCol);
    vec3 col = toLinear(albedo.rgb) * light;
#if defined WEATHER
    albedo.a *= RAIN_OPACITY;
#endif
    /* DRAWBUFFERS:0 */
    gl_FragData[0] = vec4(col, albedo.a);
#endif
}
#endif
