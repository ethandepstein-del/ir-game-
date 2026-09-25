// Shadow map pass. Water is skipped so the sea floor stays lit;
// stained glass writes its colour for tinted shadows.
#include "/lib/settings.glsl"

varying vec2 texcoord;
varying vec4 color;
varying float skip;

#ifdef VSH
#include "/lib/common.glsl"
#include "/lib/waving.glsl"
#include "/lib/distort.glsl"

uniform mat4 shadowModelView;
uniform mat4 shadowModelViewInverse;
uniform mat4 shadowProjection;

attribute vec4 mc_Entity;
attribute vec4 mc_midTexCoord;

void main() {
#if defined NO_SHADOW
    texcoord = vec2(0.0);
    color = vec4(0.0);
    skip = 1.0;
    gl_Position = vec4(10.0, 10.0, 10.0, 1.0);
#else
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    color = gl_Color;
    skip = isId(mc_Entity.x, ID_WATER) ? 1.0 : 0.0;

    vec2 lm = clamp(((gl_TextureMatrix[1] * gl_MultiTexCoord1).xy - 0.03125) * 1.06667, 0.0, 1.0);
    vec4 pp = shadowModelViewInverse * (gl_ModelViewMatrix * gl_Vertex);
    bool topVertex = gl_MultiTexCoord0.t < mc_midTexCoord.t;
    pp.xyz += waveVertex(pp.xyz + cameraPosition, mc_Entity.x, topVertex, lm.y);

    gl_Position = shadowProjection * (shadowModelView * pp);
    gl_Position.xyz = distortShadow(gl_Position.xyz);
#endif
}
#endif

#ifdef FSH
uniform sampler2D texture;
void main() {
    if (skip > 0.5) discard;
    vec4 c = texture2D(texture, texcoord) * color;
    if (c.a < 0.1) discard;
    gl_FragData[0] = c;
}
#endif
