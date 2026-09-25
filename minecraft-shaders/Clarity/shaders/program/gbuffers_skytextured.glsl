// Moon (the sun is drawn procedurally) and the End sky texture.
#include "/lib/settings.glsl"
#include "/lib/common.glsl"

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
#if defined END
    vec3 col = toLinear(c.rgb) * 0.55;
#else
    vec3 col = toLinear(c.rgb) * 1.6 * (1.0 - rainStrength * 0.8) * vec3(0.85, 0.92, 1.10);
#endif
    /* DRAWBUFFERS:0 */
    gl_FragData[0] = vec4(col, c.a);
}
#endif
