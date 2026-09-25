// Particles, rain/snow, the block-breaking overlay and other simple
// textured geometry. Variants: WEATHER, DAMAGED (none = particles).
#include "/lib/settings.glsl"
#include "/lib/common.glsl"
#define NO_SHADOW_LOOKUP

varying vec2 texcoord;
varying vec2 lmcoord;
varying vec4 color;
varying vec3 playerPos;

#ifdef VSH ////////////////////////////////////////////////////////////////
void main() {
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    lmcoord  = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
    lmcoord  = clamp((lmcoord - 0.03125) * 1.06667, 0.0, 1.0);
    color    = gl_Color;
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
    vec3 viewUp = normalize(upPosition);
    vec3 light = surfaceLight(viewUp, lmcoord, vec3(0.0), 0.0, true);
    vec3 col = toLinear(albedo.rgb) * light;
#if defined WEATHER
    albedo.a *= RAIN_OPACITY;
#endif
    vec3 viewPos = (gbufferModelView * vec4(playerPos, 1.0)).xyz;
    col = applyFog(col, playerPos, normalize(viewPos));
    /* DRAWBUFFERS:0 */
    gl_FragData[0] = vec4(col, albedo.a);
#endif
}
#endif
