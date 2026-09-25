// Opaque and cutout geometry: terrain, entities, block entities, hand.
// Variants: TERRAIN, ENTITIES, BLOCK, HAND (none = generic lit).
#include "/lib/settings.glsl"
#include "/lib/common.glsl"

#if defined HAND
#define NO_SHADOW_LOOKUP
#endif

varying vec2 texcoord;
varying vec2 lmcoord;
varying vec4 color;
varying vec3 normal;
varying vec3 playerPos;
varying vec3 shadowPos;
varying float matId;

#ifdef VSH ////////////////////////////////////////////////////////////////

#include "/lib/waving.glsl"
#if defined SHADOWS && defined OVERWORLD && !defined HAND
#include "/lib/distort.glsl"
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
    // Foliage: treat as lit from both sides.
    if (isId(matId, ID_PLANT) || isId(matId, ID_PLANT_TOP) || isId(matId, ID_LEAVES)) matId = 1.0;
    else if (isId(matId, ID_EMISSIVE)) matId = 2.0;
    else matId = 0.0;
#endif
    playerPos = pp.xyz;

#if defined SHADOWS && defined OVERWORLD
    // Normal-offset bias, growing with distance as shadow texels do.
    vec3 worldNormal = mat3(gbufferModelViewInverse) * normal;
    if (matId > 0.5 && matId < 1.5) worldNormal = mat3(gbufferModelViewInverse) * normalize(shadowLightPosition);
    float dist = length(pp.xyz);
    vec3 biased = pp.xyz + worldNormal * (0.035 + dist * 0.0035) * (2048.0 / float(shadowMapResolution) * 0.5 + 0.5);
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
    // The hand has no shadow-map position: it follows the light at the player.
    vec3 light = surfaceLight(n, lmcoord, vec3(0.0), 0.0, false);
#else
    vec3 light = surfaceLight(n, lmcoord, shadowPos, length(playerPos), foliage);
#endif

    vec3 col = base * light;

#if defined TERRAIN
    if (matId > 1.5) {
        // Emissive blocks: only the bright parts of the texture glow.
        float l = luma(base);
        col += base * smoothstep(0.15, 0.7, l) * 3.0 * EMISSIVE_STRENGTH;
    }
#endif

#if !defined HAND
    vec3 viewPos = (gbufferModelView * vec4(playerPos, 1.0)).xyz;
    col = applyFog(col, playerPos, normalize(viewPos));
#endif

    /* DRAWBUFFERS:0 */
    gl_FragData[0] = vec4(col, albedo.a);
}

#endif // FSH
