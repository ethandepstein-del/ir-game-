// Pass 1: SSAO resolve, water, fog and volumetric light.
//   in : colortex0 scene, colortex1/2 surface data, colortex3/4 water data,
//        colortex5 raw AO
//   out: colortex0 scene, colortex5 volumetric light (blurred in composite2;
//        alpha = view depth for its edge-stopping)
#include "/lib/settings.glsl"

varying vec2 texcoord;
varying vec3 ambCol;   // per-frame constants hoisted to the vertex stage
varying vec3 sunCol;
varying vec3 lightW;

#ifdef VSH
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"
void main() {
    texcoord = gl_MultiTexCoord0.xy;
    ambCol = ambientColor();
    sunCol = directLightColor();
    lightW = lightDirWorld();
    gl_Position = ftransform();
}
#endif

#ifdef FSH
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"
#include "/lib/distort.glsl"
#include "/lib/water.glsl"
#include "/lib/fog.glsl"
#include "/lib/noise.glsl"

uniform sampler2D colortex0;
uniform sampler2D colortex1;
uniform sampler2D colortex2;
uniform sampler2D colortex3;
uniform sampler2D colortex4;
uniform sampler2D colortex5;
uniform sampler2D depthtex0;
uniform sampler2D depthtex1;
#if defined OVERWORLD && defined SHADOWS
uniform sampler2DShadow shadowtex0;
uniform mat4 shadowModelView;
uniform mat4 shadowProjection;
#endif

// Hard shadow-map test at a player-space position (1 = lit).
float shadowAt(vec3 playerPos) {
#if defined OVERWORLD && defined SHADOWS
    vec3 sc = (shadowProjection * (shadowModelView * vec4(playerPos, 1.0))).xyz;
    vec3 p = distortShadow(sc) * 0.5 + 0.5;
    if (p.x <= 0.0 || p.x >= 1.0 || p.y <= 0.0 || p.y >= 1.0 || p.z >= 1.0) return 1.0;
    return shadow2D(shadowtex0, vec3(p.xy, p.z - 0.0002)).x;
#else
    return 1.0;
#endif
}

#if defined RT_GI && defined RT_REFLECTIONS && defined OVERWORLD
#include "/lib/voxel.glsl"
#define RT_WATER_REFLECTIONS
#endif

// 3x3 depth-aware blur of the raw AO from composite.
float resolveAO(vec2 uv) {
    vec2 px = 1.0 / vec2(viewWidth, viewHeight);
    float centerZ = texture2D(colortex5, uv).g;
    float sum = 0.0;
    float wsum = 0.0;
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            vec2 q = uv + vec2(float(x), float(y)) * px * 1.5;
            vec2 s = texture2D(colortex5, q).rg;
            float w = 1.0 / (1.0 + abs(s.g - centerZ) * 8.0);
            sum += s.r * w;
            wsum += w;
        }
    }
    return sum / wsum;
}

// Screen-space reflection against opaque geometry.
vec4 traceReflection(vec3 viewPos, vec3 R) {
    float stepLen = 0.5 + length(viewPos) * 0.025;
    vec3 stepV = R * stepLen;
    vec3 pos = viewPos + stepV * (0.5 + blueNoise(gl_FragCoord.xy).b * 0.5);
    for (int i = 0; i < 28; i++) {
        vec3 s = viewToScreen(pos);
        if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0 || s.z > 1.0 || pos.z > -0.05) return vec4(0.0);
        float sd = texture2D(depthtex1, s.xy).r;
        if (s.z > sd) {
            // Refine between the last two steps.
            vec3 a = pos - stepV;
            vec3 b = pos;
            for (int j = 0; j < 5; j++) {
                vec3 m = (a + b) * 0.5;
                vec3 sm = viewToScreen(m);
                if (sm.z > texture2D(depthtex1, sm.xy).r) b = m; else a = m;
            }
            vec3 hit = viewToScreen(b);
            float hd = texture2D(depthtex1, hit.xy).r;
            if (hd >= 1.0) return vec4(0.0);
            vec3 hitView = screenToView(hit.xy, hd);
            // Too far behind the surface: the ray passed behind a thin
            // object (trunk, pillar). Keep marching instead of giving up.
            if (abs(hitView.z - b.z) <= length(stepV) * 1.5 + 0.5) {
                vec2 edge = smoothstep(0.0, 0.08, hit.xy) * smoothstep(0.0, 0.08, 1.0 - hit.xy);
                float reach = 1.0 - smoothstep(20.0, 28.0, float(i));
                vec3 c = applyFog(texture2D(colortex0, hit.xy).rgb, hitView, false, ambCol, sunCol);
                return vec4(c, edge.x * edge.y * reach);
            }
        }
        pos += stepV;
        stepV *= 1.15;
    }
    return vec4(0.0);
}

vec3 shadeWater(vec3 sceneCol, vec2 uv, float d0, vec4 wData, vec3 tint) {
    vec3 nW = decodeNormal(wData.xy);
    float levels = floor((wData.z - 0.25) / 0.5 * 255.0 + 0.5);
    float skyLevel = floor(levels / 16.0) / 15.0;
    vec3 n = normalize(mat3(gbufferModelView) * nW);
    vec3 viewPos0 = screenToView(uv, d0);
    vec3 V = normalize(viewPos0);
    bool below = isEyeInWater == 1;
    tint = toLinear(tint);

    // Refraction: offset by the wave slope, but never onto things in front.
    vec2 refrUV = uv;
#ifdef WATER_REFRACTION
    {
        // Bend the view ray at the surface (air->water or water->air) and
        // see where it lands a short way in.
        float d1c = texture2D(depthtex1, uv).r;
        float thick = d1c < 1.0 ? distance(viewPos0, screenToView(uv, d1c)) : 16.0;
        vec3 Rr = refract(V, n, below ? 1.333 : 0.75);
        if (dot(Rr, Rr) < 1e-4) Rr = V;
        vec2 cand = clamp(viewToScreen(viewPos0 + Rr * min(thick, 3.0) * 0.6).xy, 0.001, 0.999);
        if (texture2D(depthtex1, cand).r > d0) refrUV = cand;
    }
#endif
    vec3 behind = texture2D(colortex0, refrUV).rgb;
    float d1 = texture2D(depthtex1, refrUV).r;
    vec3 viewPos1 = screenToView(refrUV, d1);
    float thickness = d1 < 1.0 ? distance(viewPos0, viewPos1) : 96.0;

    vec3 col;
    vec3 sun = sunCol;
    vec3 L = lightW;
    vec3 surfPlayer = (gbufferModelViewInverse * vec4(viewPos0, 1.0)).xyz;
    float surfShadow = shadowAt(surfPlayer + (gbufferModelViewInverse * vec4(n, 0.0)).xyz * 0.1)
                     * cloudShadow(surfPlayer + cameraPosition, L) * smoothstep(0.6, 0.95, skyLevel);

    if (!below) {
#ifdef CAUSTICS
        if (d1 < 1.0) {
            vec3 floorPlayer = (gbufferModelViewInverse * vec4(viewPos1, 1.0)).xyz;
            vec3 floorW = floorPlayer + cameraPosition;
            float depthBelow = max(surfPlayer.y - floorPlayer.y, 0.0);
            float c = caustics(floorW.xz + L.xz / max(L.y, 0.2) * depthBelow);
            float lit = shadowAt(floorPlayer + vec3(0.0, 0.1, 0.0)) * surfShadow;
            // Centred on the pattern's mean: focuses light, doesn't add it.
            behind *= 1.0 + (c - 0.35) * 1.8 * lit * exp(-depthBelow * 0.12) * smoothstep(0.0, 1.0, depthBelow) * luma(sun) / 3.0;
        }
#endif
        vec3 absorb = waterAbsorption(tint);
        if (d1 < 1.0) {
            // Light reaching the floor already crossed the water above it.
            float floorDepth = max(surfPlayer.y - (gbufferModelViewInverse * vec4(viewPos1, 1.0)).y, 0.0);
            behind *= exp(-absorb * floorDepth);
        }
        vec3 T = exp(-absorb * thickness);
        vec3 scatterCol = waterScatterColor(tint, skyLevel, ambCol, sun) + tint * sun * 0.03 * surfShadow;
        col = behind * T + scatterCol * (1.0 - T);

#ifdef WATER_SSS
        // Sunlight shining through the thin tops of waves toward the viewer.
        vec3 Vw = mat3(gbufferModelViewInverse) * V;
        float crest = clamp((1.0 - nW.y) * 14.0, 0.0, 1.0);
        col += vec3(0.10, 0.75, 0.60) * tint * 4.0 * sun * surfShadow * crest
             * pow(max(dot(Vw, L), 0.0), 3.0) * 0.5;
#endif

#ifdef WATER_FOAM
        // Foam where the water gets shallow against the shore.
        if (d1 < 1.0) {
            vec3 floorPlayerF = (gbufferModelViewInverse * vec4(viewPos1, 1.0)).xyz;
            float shallow = max(surfPlayer.y - floorPlayerF.y, 0.0);
            vec2 fp = surfPlayer.xz + cameraPosition.xz;
            float t = frameTimeCounter * 0.35 * WAVE_SPEED;
            float pattern = vnoise(fp * 1.7 + vec2(t, -t * 0.6)) * 0.6 + vnoise(fp * 4.3 - vec2(t * 0.8, t)) * 0.4;
            float foam = (1.0 - smoothstep(0.05, 0.75, shallow)) * smoothstep(0.35, 0.65, pattern + (0.4 - shallow * 0.5));
            vec3 foamLight = ambCol * skyLevel * skyLevel + sun * surfShadow * max(L.y, 0.0) + MIN_LIGHT * 2.0;
            col = mix(col, foamLight * 0.75, foam * 0.75);
        }
#endif
    } else {
        col = behind;
    }

    // Reflection.
    float cosT = clamp(dot(-V, n), 0.0, 1.0);
    float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
    vec3 reflection;
    vec3 specular = vec3(0.0);
    if (below) {
        // Total internal reflection outside Snell's window.
        F = mix(F, 1.0, 1.0 - smoothstep(0.62, 0.70, cosT));
        reflection = waterScatterColor(vec3(0.10, 0.38, 0.55), float(eyeBrightnessSmooth.y) / 240.0, ambCol, sun);
    } else {
        vec3 R = reflect(V, n);
        vec3 Rw = mat3(gbufferModelViewInverse) * R;
        Rw.y = max(Rw.y, 0.0);
        reflection = skyFull(normalize(Rw + vec3(0.0, 0.001, 0.0)), false, ambCol, sun) * smoothstep(0.2, 0.8, skyLevel)
                   + ambCol * 0.05;
        vec4 hit = vec4(0.0);
#ifdef SSR
        hit = traceReflection(viewPos0, R);
#endif
#ifdef RT_WATER_REFLECTIONS
        // Off-screen reflections: trace the voxel world where SSR can't see.
        // Skip rays that head up into open sky: the sky fallback is right there.
        vec3 Rt = normalize(mat3(gbufferModelViewInverse) * R);
        if (hit.a < 0.99 && (Rt.y < 0.35 || skyLevel < 0.95)) {
            vec3 origin = playerToGrid(surfPlayer + nW * 0.1);
            vec3 hp, hn;
            uint vox;
            bool leftGrid;
            if (insideGrid(origin) && traceVoxels(origin, Rt, 24.0, blueNoise(gl_FragCoord.xy).b, hp, hn, vox, leftGrid)) {
                vec3 hitPlayer = gridToPlayer(hp);
                vec3 rc = voxelRadiance(vox, hp, hn, sun, ambCol, L);
                rc = applyFog(rc, (gbufferModelView * vec4(hitPlayer, 1.0)).xyz, false, ambCol, sun);
                reflection = rc;
            }
        }
#endif
        reflection = mix(reflection, hit.rgb, hit.a);
        // Sun glint (GGX, very smooth).
        vec3 Vw = mat3(gbufferModelViewInverse) * V;
        vec3 H = normalize(L - Vw);
        float NdotH = max(dot(nW, H), 0.0);
        float NdotL = max(dot(nW, L), 0.0);
        float NdotV = max(dot(nW, -Vw), 1e-3);
        // Rougher with distance: tiny far-off facets would only sparkle.
        float a2 = 0.0025 + 0.02 * smoothstep(8.0, 96.0, length(viewPos0));
        float D = a2 / (PI * pow(NdotH * NdotH * (a2 - 1.0) + 1.0, 2.0));
        float Fh = 0.02 + 0.98 * pow(1.0 - max(dot(-Vw, H), 0.0), 5.0);
        specular = sun * D * Fh * NdotL / (4.0 * NdotL * NdotV + 1e-3) * 4.0 * surfShadow;
    }
    return mix(col, reflection, F) + specular;
}

// Sun shafts traced through the shadow map.
vec3 volumetricLight(vec3 viewPos, bool sky) {
#if defined VOLUMETRIC_LIGHT && defined OVERWORLD && defined SHADOWS
    vec3 dirView = normalize(viewPos);
    vec3 dirW = mat3(gbufferModelViewInverse) * dirView;
    float maxDist = min(sky ? 1e5 : length(viewPos), shadowDistance);
    bool underwater = isEyeInWater == 1;
    if (underwater) maxDist = min(maxDist, UNDERWATER_VIEW);
    // Extinction along the ray, so far shafts fade like the haze does.
    vec3 sigma = underwater ? waterAbsorption(vec3(0.10, 0.38, 0.55)) * (32.0 / UNDERWATER_VIEW)
                            : vec3(0.0006 * HAZE * (1.0 + OVERCAST * 1.5));
    vec3 sun = sunCol;
    if (luma(sun) < 1e-4) return vec3(0.0);

    vec3 startS = (shadowProjection * (shadowModelView * vec4(0.0, 0.0, 0.0, 1.0))).xyz;
    vec3 endS = (shadowProjection * (shadowModelView * vec4(dirW * maxDist, 1.0))).xyz;
    // Static blue noise: composite2's Gaussian removes it almost completely.
    float jitter = blueNoise(gl_FragCoord.xy).g;
    vec3 acc = vec3(0.0);
    for (int i = 0; i < VL_STEPS; i++) {
        float t = (float(i) + jitter) / float(VL_STEPS);
        vec3 p = distortShadow(mix(startS, endS, t)) * 0.5 + 0.5;
        float lit = shadow2D(shadowtex0, vec3(p.xy, p.z - 0.0002)).x;
        float h = cameraPosition.y + dirW.y * maxDist * t;
        acc += lit * exp(-max(h - 62.0, 0.0) / 70.0) * exp(-sigma * maxDist * t);
    }
    acc *= maxDist / float(VL_STEPS);

    float c = dot(dirW, lightW);
    float eyeSky = float(eyeBrightnessSmooth.y) / 240.0;
    if (underwater) {
        float phase = mix(phaseHG(c, 0.5), 1.0, 0.3);
        return sun * vec3(0.10, 0.38, 0.55) * phase * acc * 0.0045 * VL_STRENGTH * (0.3 + 0.7 * eyeSky);
    }
    float phase = mix(phaseHG(c, 0.45), 1.0, 0.25);
    float density = 0.0011 * VL_STRENGTH * (0.35 + sunsetFactor() * 0.6 + OVERCAST * 0.4);
    return sun * phase * acc * density * (0.15 + 0.85 * eyeSky);
#else
    return vec3(0.0);
#endif
}

void main() {
    vec3 col = texture2D(colortex0, texcoord).rgb;
    float d0 = texture2D(depthtex0, texcoord).r;
    float d1 = texture2D(depthtex1, texcoord).r;
    vec4 mat = texture2D(colortex2, texcoord);
    bool opaqueData = abs(mat.g - 0.5) < 0.1;
    bool hand = opaqueData && mat.r > 0.5;

    // Scrub NaN/Inf so one bad pixel can't spread through the bloom mips.
    if (!(dot(col, vec3(1.0)) < 1e30)) col = vec3(0.0);
    col = max(col, vec3(0.0));

#if defined SSAO && !(defined RT_GI && defined OVERWORLD)
    if (opaqueData && !hand && d1 < 1.0) {
        float ambientShare = texture2D(colortex1, texcoord).b;
        col *= mix(1.0, resolveAO(texcoord), ambientShare);
    }
#endif

#if defined NETHER
    if (d0 >= 1.0) col = atmosphere(vec3(0.0, 1.0, 0.0));
#endif

#if defined CAUSTICS && defined OVERWORLD
    // Looking around underwater: caustics play over sunlit surfaces.
    if (isEyeInWater == 1 && opaqueData && !hand && d0 < 1.0 && texture2D(colortex3, texcoord).z < 0.2) {
        vec3 vp = screenToView(texcoord, d0);
        vec3 pp = (gbufferModelViewInverse * vec4(vp, 1.0)).xyz;
        vec3 L = lightW;
        vec3 nW = mat3(gbufferModelViewInverse) * decodeNormal(texture2D(colortex1, texcoord).xy);
        float lit = shadowAt(pp + nW * 0.1) * cloudShadow(pp + cameraPosition, L) * max(dot(nW, L), 0.0);
        float depthBelow = max(cameraPosition.y - (pp.y + cameraPosition.y), 0.0) + 1.0;
        float c = caustics(pp.xz + cameraPosition.xz + L.xz / max(L.y, 0.2) * depthBelow);
        col *= 1.0 + c * 1.4 * lit * luma(sunCol) / 3.0 * (float(eyeBrightnessSmooth.y) / 240.0);
    }
#endif

    vec4 wData = texture2D(colortex3, texcoord);
    bool water = wData.z > 0.2 && wData.z < 0.8 && d0 < 1.0 && !hand;
    if (water) col = shadeWater(col, texcoord, d0, wData, texture2D(colortex4, texcoord).rgb);

    vec3 viewPos = screenToView(texcoord, d0 >= 1.0 ? 1.0 : d0);
    bool sky = d0 >= 1.0;
    if (!hand) col = applyFog(col, viewPos, sky, ambCol, sunCol);

    vec3 vl = hand ? vec3(0.0) : volumetricLight(viewPos, sky);
    // Never let shafts wash out what is behind them (players against a sunset).
    vl = min(vl, vec3(0.25 * luma(col) + 0.05));

    /* DRAWBUFFERS:05 */
    gl_FragData[0] = vec4(col, 1.0);
    gl_FragData[1] = vec4(vl, -viewPos.z);
}
#endif
