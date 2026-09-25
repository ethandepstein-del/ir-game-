// RT final (deferred5): add the denoised indirect light (times surface
// albedo) to the scene. colortex9.r > 0 marks pixels the RT chain covered.
#include "/lib/settings.glsl"

varying vec2 texcoord;

#ifdef VSH
void main() {
    texcoord = gl_MultiTexCoord0.xy;
    gl_Position = ftransform();
}
#endif

#ifdef FSH
uniform sampler2D colortex0;
uniform sampler2D colortex2;
uniform sampler2D colortex7;
uniform sampler2D colortex9;
uniform sampler2D colortex10;
uniform sampler2D depthtex0;

void main() {
    vec3 col = texture2D(colortex0, texcoord).rgb;
#if defined RT_GI && defined OVERWORLD
    vec4 gi = texture2D(colortex10, texcoord);
    vec4 mat = texture2D(colortex2, texcoord);
    if (texture2D(colortex9, texcoord).r > 0.0 && abs(mat.g - 0.5) < 0.1 && mat.r < 0.5 && mat.b < 0.5 && texture2D(depthtex0, texcoord).r < 1.0) {
        vec3 albedo = pow(texture2D(colortex7, texcoord).rgb, vec3(2.2));
        col += albedo * max(gi.rgb, vec3(0.0)) * RT_GI_STRENGTH;
    }
#endif
    /* DRAWBUFFERS:0 */
    gl_FragData[0] = vec4(col, 1.0);
}
#endif
