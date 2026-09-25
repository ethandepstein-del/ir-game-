// Vanilla cloud geometry, relit to match the sky and softened.
#include "/lib/settings.glsl"
#include "/lib/common.glsl"

varying vec2 texcoord;
varying vec4 color;
varying vec3 playerPos;
varying vec3 normal;

#ifdef VSH
void main() {
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    color = gl_Color;
    normal = safeNormal(gl_NormalMatrix * gl_Normal);
    playerPos = (gbufferModelViewInverse * (gl_ModelViewMatrix * gl_Vertex)).xyz;
    gl_Position = ftransform();
}
#endif

#ifdef FSH
uniform sampler2D texture;
void main() {
    vec4 c = texture2D(texture, texcoord) * color;
    if (c.a < 0.02) discard;
    vec3 viewPos = (gbufferModelView * vec4(playerPos, 1.0)).xyz;
    vec3 viewDir = normalize(viewPos);

    vec3 n = safeNormal(normal);
    float sunSide = max(dot(n, normalize(shadowLightPosition)), 0.0);
    vec3 light = ambientColor() * 1.35 + directLightColor() * (0.30 + 0.25 * sunSide);
    vec3 col = vec3(luma(c.rgb)) * light;

    float d = length(playerPos.xz);
    float fade = smoothstep(far * 0.9, far * 2.6 + 96.0, d);
    col = mix(col, skyColor(viewDir), fade * 0.85);

    float alpha = c.a * CLOUD_OPACITY * (1.0 - fade * 0.6);
    /* DRAWBUFFERS:0 */
    gl_FragData[0] = vec4(col, alpha);
}
#endif
