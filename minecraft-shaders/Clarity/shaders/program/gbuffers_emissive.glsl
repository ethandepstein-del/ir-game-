// Self-lit overlays: enchantment glint, spider/enderman eyes, beacon beams.
#include "/lib/settings.glsl"
#ifndef GLOW_BOOST
#define GLOW_BOOST 1.0
#endif

varying vec2 texcoord;
varying vec4 color;

#ifdef VSH
void main() {
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    color = gl_Color;
    gl_Position = ftransform();
}
#endif

#ifdef FSH
uniform sampler2D texture;
void main() {
    vec4 c = texture2D(texture, texcoord) * color;
    /* DRAWBUFFERS:0 */
    gl_FragData[0] = vec4(pow(c.rgb, vec3(2.2)) * GLOW_BOOST, c.a);
}
#endif
