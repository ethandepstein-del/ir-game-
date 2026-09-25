// Translucent terrain: water, stained glass, ice, slime, honey...
// Water stays clear enough to see mobs, ores and the bottom.
#include "/lib/settings.glsl"
#include "/lib/common.glsl"

varying vec2 texcoord;
varying vec2 lmcoord;
varying vec4 color;
varying vec3 normal;
varying vec3 playerPos;
varying vec3 shadowPos;
varying float matId;

#ifdef VSH ////////////////////////////////////////////////////////////////

#include "/lib/waving.glsl"
#if defined SHADOWS && defined OVERWORLD
#include "/lib/distort.glsl"
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

    vec4 viewPos = gl_ModelViewMatrix * gl_Vertex;
    vec4 pp = gbufferModelViewInverse * viewPos;
    playerPos = pp.xyz;
    gl_Position = ftransform();

#if defined SHADOWS && defined OVERWORLD
    vec3 worldNormal = mat3(gbufferModelViewInverse) * normal;
    float dist = length(pp.xyz);
    vec3 biased = pp.xyz + worldNormal * (0.035 + dist * 0.0035);
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

uniform sampler2D texture;

// Height of a few layered sine swells, and its analytic gradient.
vec3 waterNormal(vec2 p) {
    float t = frameTimeCounter;
    vec2 grad = vec2(0.0);
    vec2 d; float f, a, ph;
    d = normalize(vec2( 1.0,  0.35)); f = 0.55; a = 0.030; ph = dot(d, p) * f + t * 1.10; grad += d * f * a * cos(ph);
    d = normalize(vec2(-0.6,  1.0 )); f = 0.90; a = 0.020; ph = dot(d, p) * f + t * 1.45; grad += d * f * a * cos(ph);
    d = normalize(vec2( 0.2, -1.0 )); f = 1.70; a = 0.010; ph = dot(d, p) * f + t * 1.90; grad += d * f * a * cos(ph);
    d = normalize(vec2(-1.0, -0.4 )); f = 2.90; a = 0.006; ph = dot(d, p) * f + t * 2.60; grad += d * f * a * cos(ph);
    return normalize(vec3(-grad.x, 1.0, -grad.y));
}

void main() {
    vec4 albedo = texture2D(texture, texcoord) * color;
    vec3 viewPos = (gbufferModelView * vec4(playerPos, 1.0)).xyz;
    vec3 viewDir = normalize(viewPos);
    vec3 n = safeNormal(normal);
    float dist = length(playerPos);
    vec3 col;
    float alpha;

    if (matId > 0.5) {
        // Soften the busy vanilla texture toward its average colour.
        vec4 blurred = texture2D(texture, texcoord, 4.0) * color;
        vec3 base = toLinear(mix(blurred.rgb, albedo.rgb, WATER_TEXTURE));

        vec3 worldNormal = mat3(gbufferModelViewInverse) * n;
#ifdef WATER_WAVES
        if (worldNormal.y > 0.9) {
            vec3 wn = waterNormal((playerPos + cameraPosition).xz);
            n = normalize(mat3(gbufferModelView) * wn);
        }
#endif
        if (!gl_FrontFacing) n = -n;

        vec3 light = surfaceLight(n, lmcoord, shadowPos, dist, false);
        col = base * light;
        alpha = WATER_OPACITY;

#ifdef WATER_REFLECTIONS
        if (isEyeInWater == 0) {
            float cosTheta = clamp(dot(-viewDir, n), 0.0, 1.0);
            float fresnel = 0.02 + 0.98 * pow(1.0 - cosTheta, 5.0);
            vec3 R = reflect(viewDir, n);
            float skyVis = lmcoord.y * lmcoord.y;
            vec3 reflection = skyColor(R) * skyVis + ambientColor() * 0.05;

#if defined OVERWORLD
            // Sun or moon glint, shadowed like everything else.
            vec3 L = normalize(shadowLightPosition);
            float spec = pow(max(dot(R, L), 0.0), 220.0) * 4.0;
            vec3 glint = directLightColor() * spec * lastShadow;
#else
            vec3 glint = vec3(0.0);
#endif
            float newAlpha = mix(alpha, 1.0, fresnel);
            col = (mix(col * alpha, reflection, fresnel) + glint) / newAlpha;
            alpha = newAlpha;
        }
#endif
    } else {
        if (albedo.a < 0.02) discard;
        vec3 base = toLinear(albedo.rgb);
        col = base * surfaceLight(n, lmcoord, shadowPos, dist, false);
        alpha = albedo.a;
    }

    col = applyFog(col, playerPos, viewDir);

    /* DRAWBUFFERS:0 */
    gl_FragData[0] = vec4(col, alpha);
}

#endif // FSH
