// Shadow map pass. Water is skipped so the sea floor stays lit; stained
// glass writes its colour for tinted shadows. With RT_GI the vertex stage
// also writes each terrain block into the voxel grid (Iris, GLSL 4.30).
#include "/lib/settings.glsl"

#if __VERSION__ >= 130
uniform sampler2D gtexture;
#define ALBEDO_TEX gtexture
#else
uniform sampler2D texture;
#define ALBEDO_TEX texture
#endif

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

#if defined RT_GI && defined OVERWORLD && __VERSION__ >= 420
#define VOXEL_WRITE
#include "/lib/voxel.glsl"
in vec3 at_midBlock;
layout(r32ui) uniform uimage3D voxelImg;

void voxelize(vec3 playerPos, vec2 lm) {
    vec3 offset = at_midBlock / 64.0;
    if (dot(offset, offset) < 0.01) return;          // entities: no block centre
    float id = mc_Entity.x;
    if (isId(id, ID_WATER) || isId(id, ID_PLANT) || isId(id, ID_PLANT_TOP)) return;

    vec3 g = playerToGrid(playerPos + offset);
    if (!insideGrid(g)) return;

    bool leaves = isId(id, ID_LEAVES);
    bool emit = isId(id, ID_EMISSIVE);
    bool emitSmall = isId(id, ID_EMISSIVE_SMALL);
    // Glass and other see-through blocks have a clear centre: skip them.
    // (Light sources are kept even when their centre texel is clear.)
    vec4 tex = texture2DLod(ALBEDO_TEX, mc_midTexCoord.xy, 0.0);
    if (!leaves && !emit && !emitSmall && tex.a < 0.9) return;

    vec3 albedo = texture2DLod(ALBEDO_TEX, mc_midTexCoord.xy, 4.0).rgb * gl_Color.rgb;
    if (emitSmall) albedo = max(albedo, texture2DLod(ALBEDO_TEX, mc_midTexCoord.xy, 2.0).rgb);
    uint material = emit ? MAT_EMIT : (emitSmall ? MAT_EMIT_SMALL : (leaves ? MAT_LEAVES : MAT_SOLID));
    imageAtomicMax(voxelImg, ivec3(floor(g)), packVoxel(albedo, material, lm.y, lm.x));
}
#endif

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
#ifdef VOXEL_WRITE
    voxelize(pp.xyz, lm);
#endif
    bool topVertex = gl_MultiTexCoord0.t < mc_midTexCoord.t;
    pp.xyz += waveVertex(pp.xyz + cameraPosition, mc_Entity.x, topVertex, lm.y);

    gl_Position = shadowProjection * (shadowModelView * pp);
    gl_Position.xyz = distortShadow(gl_Position.xyz);
    // Water never casts: drop it before rasterisation (voxelization is done).
    if (skip > 0.5) gl_Position = vec4(10.0, 10.0, 10.0, 1.0);
#endif
}
#endif

#ifdef FSH
void main() {
    if (skip > 0.5) discard;
    vec4 c = texture2D(ALBEDO_TEX, texcoord) * color;
    if (c.a < 0.1) discard;
    gl_FragData[0] = c;
}
#endif
