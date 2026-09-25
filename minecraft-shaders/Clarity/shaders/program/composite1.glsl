// Pass 1: SSAO resolve, water, fog and volumetric light.
//   in : colortex0 scene, colortex1/2 surface data, colortex3/4 water data,
//        colortex5 raw AO
//   out: colortex0 scene, colortex5 volumetric light (blurred in composite2)
#include "/lib/settings.glsl"

varying vec2 texcoord;

#ifdef VSH
void main() {
    texcoord = gl_MultiTexCoord0.xy;
    gl_Position = ftransform();
}
#endif

#ifdef FSH
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"
#include "/lib/distort.glsl"
#include "/lib/water.glsl"
#include "/lib/fog.glsl"

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
    vec3 pos = viewPos + stepV * (0.5 + ign(gl_FragCoord.xy) * 0.5);
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
            if (abs(hitView.z - b.z) > length(stepV) * 1.5 + 0.5) return vec4(0.0);
            vec2 edge = smoothstep(0.0, 0.08, hit.xy) * smoothstep(0.0, 0.08, 1.0 - hit.xy);
            vec3 c = applyFog(texture2D(colortex0, hit.xy).rgb, hitView, false);
            return vec4(c, edge.x * edge.y);
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
        float d1c = texture2D(depthtex1, uv).r;
        float thick = d1c < 1.0 ? distance(viewPos0, screenToView(uv, d1c)) : 16.0;
        vec2 offset = nW.xz * vec2(viewHeight / viewWidth, 1.0) * 0.35 * clamp(thick / 4.0, 0.0, 1.0) / (1.0 + length(viewPos0) * 0.08);
        vec2 cand = clamp(uv + offset, 0.001, 0.999);
        if (texture2D(depthtex1, cand).r > d0) refrUV = cand;
    }
#endif
    vec3 behind = texture2D(colortex0, refrUV).rgb;
    float d1 = texture2D(depthtex1, refrUV).r;
    vec3 viewPos1 = screenToView(refrUV, d1);
    float thickness = d1 < 1.0 ? distance(viewPos0, viewPos1) : 96.0;

    vec3 col;
    vec3 sun = directLightColor();
    vec3 L = lightDirWorld();
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
            behind *= 1.0 + c * 1.6 * lit * exp(-depthBelow * 0.12) * smoothstep(0.0, 1.0, depthBelow) * luma(sun) / 3.0;
        }
#endif
        vec3 T = exp(-waterAbsorption(tint) * thickness);
        vec3 scatterCol = waterScatterColor(tint, skyLevel) + tint * sun * 0.03 * surfShadow;
        col = behind * T + scatterCol * (1.0 - T);
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
        reflection = waterScatterColor(vec3(0.10, 0.38, 0.55), float(eyeBrightnessSmooth.y) / 240.0);
    } else {
        vec3 R = reflect(V, n);
        vec3 Rw = mat3(gbufferModelViewInverse) * R;
        Rw.y = max(Rw.y, 0.0);
        reflection = skyFull(normalize(Rw + vec3(0.0, 0.001, 0.0)), false) * smoothstep(0.2, 0.8, skyLevel)
                   + ambientColor() * 0.05;
#ifdef SSR
        vec4 hit = traceReflection(viewPos0, R);
        reflection = mix(reflection, hit.rgb, hit.a);
#endif
        // Sun glint (GGX, very smooth).
        vec3 H = normalize(L - mat3(gbufferModelViewInverse) * V);
        float NdotH = max(dot(nW, H), 0.0);
        float a2 = 0.0025;
        float D = a2 / (PI * pow(NdotH * NdotH * (a2 - 1.0) + 1.0, 2.0));
        specular = sun * D * 0.02 * surfShadow * step(0.0, L.y);
    }
    return mix(col, reflection, F) + specular;
}

// Sun shafts traced through the shadow map.
vec3 volumetricLight(vec3 viewPos, bool sky) {
#if defined VOLUMETRIC_LIGHT && defined OVERWORLD && defined SHADOWS
    vec3 dirView = normalize(viewPos);
    vec3 dirW = mat3(gbufferModelViewInverse) * dirView;
    float maxDist = min(sky ? 1e5 : length(viewPos), shadowDistance);
    vec3 sun = directLightColor();
    if (luma(sun) < 1e-4) return vec3(0.0);

    vec3 startS = (shadowProjection * (shadowModelView * vec4(0.0, 0.0, 0.0, 1.0))).xyz;
    vec3 endS = (shadowProjection * (shadowModelView * vec4(dirW * maxDist, 1.0))).xyz;
    float jitter = ign(gl_FragCoord.xy);
    float acc = 0.0;
    for (int i = 0; i < VL_STEPS; i++) {
        float t = (float(i) + jitter) / float(VL_STEPS);
        vec3 p = distortShadow(mix(startS, endS, t)) * 0.5 + 0.5;
        float lit = shadow2D(shadowtex0, vec3(p.xy, p.z - 0.0002)).x;
        float h = cameraPosition.y + dirW.y * maxDist * t;
        acc += lit * exp(-max(h - 62.0, 0.0) / 70.0);
    }
    acc *= maxDist / float(VL_STEPS);

    float c = dot(dirW, lightDirWorld());
    float eyeSky = float(eyeBrightnessSmooth.y) / 240.0;
    if (isEyeInWater == 1) {
        float phase = mix(phaseHG(c, 0.5), 1.0, 0.3);
        return sun * vec3(0.10, 0.38, 0.55) * phase * acc * 0.0045 * VL_STRENGTH * (0.3 + 0.7 * eyeSky);
    }
    float phase = mix(phaseHG(c, 0.62), 1.0, 0.25);
    float density = 0.0011 * VL_STRENGTH * (0.35 + sunsetFactor() * 1.4 + rainStrength * 0.4);
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

#if defined SSAO
    if (opaqueData && !hand && d1 < 1.0) {
        float ambientShare = texture2D(colortex1, texcoord).b;
        col *= mix(1.0, resolveAO(texcoord), ambientShare);
    }
#endif

#if defined NETHER
    if (d0 >= 1.0) col = atmosphere(vec3(0.0, 1.0, 0.0));
#endif

    vec4 wData = texture2D(colortex3, texcoord);
    bool water = wData.z > 0.2 && wData.z < 0.8 && d0 < 1.0 && !hand;
    if (water) col = shadeWater(col, texcoord, d0, wData, texture2D(colortex4, texcoord).rgb);

    vec3 viewPos = screenToView(texcoord, d0 >= 1.0 ? 1.0 : d0);
    bool sky = d0 >= 1.0;
    if (!hand) col = applyFog(col, viewPos, sky);

    vec3 vl = hand ? vec3(0.0) : volumetricLight(viewPos, sky);

    /* DRAWBUFFERS:05 */
    gl_FragData[0] = vec4(col, 1.0);
    gl_FragData[1] = vec4(vl, 1.0);
}
#endif
