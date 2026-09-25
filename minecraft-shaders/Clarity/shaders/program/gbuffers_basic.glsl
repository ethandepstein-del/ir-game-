// Untextured geometry: the block selection outline, leads, debug lines.
// Left crisp and unfogged close up so the outline is always readable.
#include "/lib/settings.glsl"
#include "/lib/common.glsl"

varying vec4 color;

#ifdef VSH
void main() {
    color = gl_Color;
    gl_Position = ftransform();
}
#endif

#ifdef FSH
void main() {
    /* DRAWBUFFERS:0 */
    gl_FragData[0] = vec4(toLinear(color.rgb), color.a);
}
#endif
