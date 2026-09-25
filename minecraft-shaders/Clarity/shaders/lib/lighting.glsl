// Forward surface lighting. Requires common.glsl and atmosphere.glsl
// (and distort.glsl when shadows are enabled).

#if defined SHADOWS && defined OVERWORLD && !defined NO_SHADOW_LOOKUP
#define USE_SHADOWMAP
uniform sampler2DShadow shadowtex0;   // everything, hardware-filtered
uniform sampler2D shadowtex1;         // opaque only, raw depth
uniform sampler2D shadowcolor0;

vec2 vogelDisk(int i, int n, float phi) {
    float r = sqrt((float(i) + 0.5) / float(n));
    float theta = float(i) * 2.39996323 + phi;
    return r * vec2(cos(theta), sin(theta));
}

// shadowClip: undistorted shadow clip position. Returns rgb transmittance
// (stained glass tints it). Soft shadows harden where objects touch (PCSS).
vec3 sampleShadow(vec3 shadowClip) {
    vec3 p = distortShadow(shadowClip) * 0.5 + 0.5;
    if (p.x <= 0.0 || p.x >= 1.0 || p.y <= 0.0 || p.y >= 1.0 || p.z >= 1.0) return vec3(1.0);
    p.z -= 0.00005;

    float texel = 1.0 / float(shadowMapResolution);
    float phi = ign(gl_FragCoord.xy) * 6.2831853;
    float radius = 1.2 * texel;

#ifdef PCSS
    // How strongly the distortion magnifies the map around this point.
    float f = length(shadowClip.xy) * SHADOW_DISTORT + (1.0 - SHADOW_DISTORT);
    float uvPerBlock = (1.0 - SHADOW_DISTORT) / (f * f) * 0.5 / shadowDistance;

    float blockerSum = 0.0;
    float blockers = 0.0;
    for (int i = 0; i < 6; i++) {
        float d = texture2D(shadowtex1, p.xy + vogelDisk(i, 6, phi) * 14.0 * texel).r;
        if (d < p.z) { blockerSum += d; blockers += 1.0; }
    }
    if (blockers > 0.0) {
        // Depth gap in blocks (256-block shadow depth range, z scaled by 0.2).
        float gap = (p.z - blockerSum / blockers) * 1280.0;
        float penumbra = gap * 0.022 * uvPerBlock;
        radius = clamp(penumbra, 1.0 * texel, 14.0 * texel);
    }
#endif
    radius *= SHADOW_SOFTNESS;

    float s0 = 0.0;
    float s1 = 0.0;
    for (int i = 0; i < SHADOW_SAMPLES; i++) {
        vec2 q = p.xy + vogelDisk(i, SHADOW_SAMPLES, phi) * radius;
        s0 += shadow2D(shadowtex0, vec3(q, p.z)).x;
#ifdef COLORED_SHADOWS
        s1 += step(p.z, texture2D(shadowtex1, q).r);
#endif
    }
    s0 /= float(SHADOW_SAMPLES);
#ifdef COLORED_SHADOWS
    s1 /= float(SHADOW_SAMPLES);
    if (s1 > s0 + 0.01) {
        vec4 tint = texture2D(shadowcolor0, p.xy);
        vec3 glass = toLinear(tint.rgb) * (1.0 - tint.a * 0.5);
        return vec3(s0) + (s1 - s0) * glass;
    }
#endif
    return vec3(s0);
}
#endif

// Outputs of the last surfaceLight() call.
vec3 lastShadow = vec3(1.0);    // direct-light visibility (for speculars)
float lastAmbientRatio = 1.0;   // share of light that SSAO may darken

// Light arriving at a surface.
//  viewNormal : unit normal in view space
//  lm         : normalised lightmap (block, sky)
//  shadowClip : shadow-space position (ignored without shadow map)
//  playerPos  : position relative to the camera (world axes)
//  foliage    : thin geometry lit from both sides
//  amb, sunCol: ambientColor() and directLightColor(), usually from the VSH
vec3 surfaceLight(vec3 viewNormal, vec2 lm, vec3 shadowClip, vec3 playerPos, bool foliage, vec3 amb, vec3 sunCol) {
    vec3 up = normalize(upPosition);
    float skyLight = lm.y;
    float faceShade = 0.78 + 0.22 * dot(viewNormal, up);

#if defined TRACED_AMBIENT
    vec3 ambient = vec3(0.0);   // replaced by ray-traced sky light and bounce
#elif defined OVERWORLD
    vec3 ambient = amb * (skyLight * skyLight) * (foliage ? 0.92 : faceShade);
#else
    vec3 ambient = amb * (foliage ? 0.92 : faceShade);
#endif

    float bl = lm.x;
    vec3 block = blockLightColor() * (bl * bl * bl * 0.85 + bl * 0.08) * (1.0 + bl * bl * bl * bl);

    vec3 direct = vec3(0.0);
#if defined OVERWORLD
    vec3 L = normalize(shadowLightPosition);
    float NdotL = dot(viewNormal, L);
    float diffuse = foliage ? (0.55 + 0.20 * abs(NdotL)) : max(NdotL, 0.0);
#ifdef FOLIAGE_SSS
    if (foliage) diffuse *= 1.1;
#endif
    vec3 shadow = vec3(0.0);
    float skyShadow = smoothstep(0.80, 0.95, skyLight);
    if (diffuse > 0.0) {
        float playerDist = length(playerPos);
#ifdef USE_SHADOWMAP
        float fade = smoothstep(shadowDistance * 0.80, shadowDistance * 0.95, playerDist);
        vec3 mapped = fade < 1.0 ? sampleShadow(shadowClip) : vec3(1.0);
        // Sky light gates the map so the sun never leaks into sealed caves.
        shadow = mix(mapped * smoothstep(0.05, 0.40, skyLight), vec3(skyShadow), fade);
#else
        shadow = vec3(skyShadow);
#endif
        shadow *= cloudShadow(playerPos + cameraPosition, lightDirWorld());
    }
    lastShadow = shadow;
    direct = sunCol * diffuse * shadow;
#endif

    // Floor so unlit caves stay readable; strongest where there is no sky.
    vec3 floorLight = MIN_LIGHT * mix(4.0, 1.0, skyLight) * vec3(0.85, 0.93, 1.10);
    vec3 indirect = ambient + floorLight + nightVision * 0.45;
    vec3 light = indirect + block + direct;
    lastAmbientRatio = clamp(luma(indirect + block * 0.5) / max(luma(light), 1e-4), 0.0, 1.0);
    return light;
}
