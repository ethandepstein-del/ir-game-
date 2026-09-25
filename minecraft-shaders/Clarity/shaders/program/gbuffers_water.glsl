// Translucent terrain. Water is not drawn here: it writes its surface
// data and the composite pass renders it (refraction, absorption,
// reflections, caustics). Glass, ice, slime etc. are lit and blended.
//   colortex3: world wave normal (oct), packed light levels
//   colortex4: water tint
// Blending uses each target's own alpha, so alpha 1 overwrites the data
// targets and alpha 0 leaves the scene colour untouched.
#include "/lib/settings.glsl"
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"

varying vec2 texcoord;
varying vec2 lmcoord;
varying vec4 color;
varying vec3 normal;
varying vec3 playerPos;
varying vec3 shadowPos;
varying vec3 ambCol;
varying vec3 sunCol;
varying float matId;

#ifdef VSH ////////////////////////////////////////////////////////////////

#include "/lib/waving.glsl"
#if defined SHADOWS && defined OVERWORLD
uniform mat4 shadowModelView;
uniform mat4 shadowProjection;
#endif

attribute vec4 mc_Entity;

void main() {
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    lmcoord  = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
    lmcoord  = clamp((lmcoord - 0.03125) * 1.06667, 0.0, 1.0);
    color    = gl_Color;
    normal   = safeNormal(gl_NormalMatrix * gl_Normal);
    matId    = isId(mc_Entity.x, ID_WATER) ? 1.0 : 0.0;
    ambCol   = ambientColor();
    sunCol   = directLightColor();

    vec4 pp = gbufferModelViewInverse * (gl_ModelViewMatrix * gl_Vertex);
    playerPos = pp.xyz;
    gl_Position = ftransform();

#if defined SHADOWS && defined OVERWORLD
    vec3 worldNormal = mat3(gbufferModelViewInverse) * normal;
    float dist = length(pp.xyz);
    vec3 biased = pp.xyz + worldNormal * (0.030 + dist * 0.0030);
    shadowPos = (shadowProjection * (shadowModelView * vec4(biased, 1.0))).xyz;
#else
    shadowPos = vec3(0.0);
#endif
}

#endif // VSH

#ifdef FSH ////////////////////////////////////////////////////////////////

#if defined SHADOWS && defined OVERWORLD
#include "/lib/distort.glsl"
#endif
#include "/lib/lighting.glsl"
#include "/lib/water.glsl"

uniform sampler2D texture;

void main() {
    vec4 albedo = texture2D(texture, texcoord) * color;

    if (matId > 0.5) {
        vec3 nW = mat3(gbufferModelViewInverse) * safeNormal(normal);
#ifdef WATER_WAVES
        if (nW.y > 0.9) nW = waterNormal((playerPos + cameraPosition).xz, length(playerPos));
#endif
        // Face the camera, so the surface seen from below is lit correctly.
        if (dot(nW, playerPos) > 0.0) nW = -nW;

        // Texture detail is kept subtle: blend toward the tile's average.
        vec4 blurred = texture2D(texture, texcoord, 4.0) * color;
        vec3 tint = mix(blurred.rgb, albedo.rgb, WATER_TEXTURE);

        float levels = floor(lmcoord.y * 15.0 + 0.5) * 16.0 + floor(lmcoord.x * 15.0 + 0.5);

        /* DRAWBUFFERS:034 */
        gl_FragData[0] = vec4(0.0);
        gl_FragData[1] = vec4(encodeNormal(nW), 0.25 + 0.5 * levels / 255.0, 1.0);
        gl_FragData[2] = vec4(tint, 1.0);
        return;
    }

    if (albedo.a < 0.02) discard;
    vec3 n = safeNormal(normal);
    vec3 col = toLinear(albedo.rgb) * surfaceLight(n, lmcoord, shadowPos, playerPos, false, ambCol, sunCol);

    // Glass gets a faint sky reflection so panes read as glass.
    vec3 V = normalize(playerPos);
    vec3 nW = mat3(gbufferModelViewInverse) * n;
    float F = 0.04 + 0.96 * pow(1.0 - abs(dot(V, nW)), 5.0);
    vec3 R = reflect(V, nW);
    col = mix(col, atmosphere(R) * lmcoord.y * lmcoord.y, F * 0.6);

    gl_FragData[0] = vec4(col, max(albedo.a, F * 0.5));
    gl_FragData[1] = vec4(0.0);
    gl_FragData[2] = vec4(0.0);
}

#endif // FSH
