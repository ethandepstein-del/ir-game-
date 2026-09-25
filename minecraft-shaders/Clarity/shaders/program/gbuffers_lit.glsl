// Opaque and cutout geometry: terrain, entities, block entities, hand.
// Variants: TERRAIN, ENTITIES, BLOCK, HAND (none = generic lit).
// Writes: colortex0 lit HDR colour (unfogged; fog is a composite pass),
//         colortex1 view normal + ambient share (for SSAO),
//         colortex2 material flags,
//         colortex7 albedo (for ray-traced indirect light).
#include "/lib/settings.glsl"
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"

#if defined HAND
#define NO_SHADOW_LOOKUP
#endif
#if defined RT_GI && defined OVERWORLD && !defined HAND && !defined ENTITIES
#define TRACED_AMBIENT
#endif

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
#if defined SHADOWS && defined OVERWORLD && !defined HAND
uniform mat4 shadowModelView;
uniform mat4 shadowProjection;
#endif

attribute vec4 mc_Entity;
attribute vec4 mc_midTexCoord;

void main() {
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    lmcoord  = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
    lmcoord  = clamp((lmcoord - 0.03125) * 1.06667, 0.0, 1.0);
    color    = gl_Color;
    normal   = safeNormal(gl_NormalMatrix * gl_Normal);
    matId    = 0.0;
    ambCol   = ambientColor();
    sunCol   = directLightColor();

    vec4 viewPos = gl_ModelViewMatrix * gl_Vertex;
    gl_Position = ftransform();

#if defined HAND
    playerPos = viewPos.xyz;
    shadowPos = vec3(0.0);
#else
    vec4 pp = gbufferModelViewInverse * viewPos;

#if defined TERRAIN
    matId = mc_Entity.x;
    bool topVertex = gl_MultiTexCoord0.t < mc_midTexCoord.t;
    vec3 offset = waveVertex(pp.xyz + cameraPosition, matId, topVertex, lmcoord.y);
    if (dot(offset, offset) > 0.0) {
        pp.xyz += offset;
        gl_Position = gl_ProjectionMatrix * (gbufferModelView * pp);
    }
    if (isId(matId, ID_PLANT) || isId(matId, ID_PLANT_TOP) || isId(matId, ID_LEAVES)) matId = 1.0;
    else if (isId(matId, ID_EMISSIVE) || isId(matId, ID_EMISSIVE_SMALL)) matId = 2.0;
    else matId = 0.0;
#endif
    playerPos = pp.xyz;

#if defined SHADOWS && defined OVERWORLD
    // Normal-offset bias, growing with distance as shadow texels do.
    vec3 worldNormal = mat3(gbufferModelViewInverse) * normal;
    if (matId > 0.5 && matId < 1.5) worldNormal = mat3(gbufferModelViewInverse) * normalize(shadowLightPosition);
    float dist = length(pp.xyz);
    vec3 biased = pp.xyz + worldNormal * (0.030 + dist * 0.0030) * (2048.0 / float(shadowMapResolution) * 0.5 + 0.5);
    shadowPos = (shadowProjection * (shadowModelView * vec4(biased, 1.0))).xyz;
#else
    shadowPos = vec3(0.0);
#endif
#endif
}

#endif // VSH

#ifdef FSH ////////////////////////////////////////////////////////////////

#if defined SHADOWS && defined OVERWORLD && !defined HAND
#include "/lib/distort.glsl"
#endif
#include "/lib/lighting.glsl"

uniform sampler2D texture;
#if defined ENTITIES
uniform vec4 entityColor;
#endif

void main() {
    vec4 albedo = texture2D(texture, texcoord) * color;
    if (albedo.a < 0.1) discard;
#if defined ENTITIES
    // Keep the red hurt flash and creeper white flash intact.
    albedo.rgb = mix(albedo.rgb, entityColor.rgb, entityColor.a);
#endif

    vec3 base = toLinear(albedo.rgb);
    bool foliage = matId > 0.5 && matId < 1.5;
    vec3 n = safeNormal(normal);
    if (!gl_FrontFacing && foliage) n = -n;

#if defined HAND
    vec3 light = surfaceLight(n, lmcoord, vec3(0.0), vec3(0.0), false, ambCol, sunCol);
#else
    vec3 light = surfaceLight(n, lmcoord, shadowPos, playerPos, foliage, ambCol, sunCol);
#endif

#if defined TERRAIN && defined WET_SURFACES && defined OVERWORLD
    // Rain: surfaces darken and up-facing ones gather reflective puddles.
    vec3 reflection = vec3(0.0);
    if (wetness > 0.01) {
        vec3 worldPos = playerPos + cameraPosition;
        vec3 nW = mat3(gbufferModelViewInverse) * n;
        float outside = smoothstep(0.88, 0.97, lmcoord.y);
        float wet = wetness * outside * (foliage ? 0.3 : 1.0);
        float puddle = smoothstep(0.52, 0.72, vnoise(worldPos.xz * 0.30) * 0.7 + vnoise(worldPos.xz * 1.1) * 0.3);
        puddle *= step(0.9, nW.y) * wet;
        base *= 1.0 - 0.28 * wet - 0.20 * puddle;
        if (puddle > 0.01) {
            vec3 V = normalize(playerPos);
            vec3 R = reflect(V, vec3(0.0, 1.0, 0.0));
            float F = 0.02 + 0.98 * pow(1.0 - clamp(-V.y, 0.0, 1.0), 5.0);
            reflection = atmosphere(R) * F * puddle * 0.9;
        }
    }
#endif

    vec3 col = base * light;

#if defined TERRAIN
    if (matId > 1.5) {
        // Emissive blocks: only the bright parts of the texture glow.
        float l = luma(base);
        col += base * smoothstep(0.15, 0.7, l) * 3.0 * EMISSIVE_STRENGTH;
    }
#if defined WET_SURFACES && defined OVERWORLD
    col += reflection;
#endif
#endif

    float handFlag = 0.0;
#if defined HAND
    handFlag = 1.0;
#endif
    float noTraceFlag = 0.0;   // moving things are lit by raster ambient in RT
#if defined ENTITIES
    noTraceFlag = 1.0;
#endif

#if defined TRACED_AMBIENT
    float dataB = lmcoord.y;   // sky light: the tracer's prior for escaped rays
#else
    float dataB = lastAmbientRatio;
#endif

    /* DRAWBUFFERS:0127 */
    gl_FragData[0] = vec4(col, albedo.a);
    gl_FragData[1] = vec4(encodeNormal(n), dataB, 1.0);
    gl_FragData[2] = vec4(handFlag, 0.5, noTraceFlag, 1.0);
    gl_FragData[3] = vec4(pow(base, vec3(1.0 / 2.2)), 1.0);
}

#endif // FSH
