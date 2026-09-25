// Forward lighting shared by terrain, entities, hand and translucents.
// Requires common.glsl (and distort.glsl when SHADOWS is on).

#if defined SHADOWS && defined OVERWORLD && !defined NO_SHADOW_LOOKUP
#define USE_SHADOWMAP
uniform sampler2DShadow shadowtex0;
#ifdef COLORED_SHADOWS
uniform sampler2DShadow shadowtex1;
uniform sampler2D shadowcolor0;
#endif

vec2 vogelDisk(int i, int n, float phi) {
    float r = sqrt((float(i) + 0.5) / float(n));
    float theta = float(i) * 2.39996323 + phi;
    return r * vec2(cos(theta), sin(theta));
}

// shadowClip: undistorted shadow clip-space position of the fragment.
// Returns light transmittance (rgb so stained glass can tint it).
vec3 sampleShadow(vec3 shadowClip) {
    vec3 p = distortShadow(shadowClip) * 0.5 + 0.5;
    if (p.x <= 0.0 || p.x >= 1.0 || p.y <= 0.0 || p.y >= 1.0 || p.z >= 1.0) return vec3(1.0);
    p.z -= 0.00008;

    float phi = ign(gl_FragCoord.xy) * 6.2831853;
    float radius = SHADOW_SOFTNESS * 1.6 / float(shadowMapResolution);
    float s0 = 0.0;
#ifdef COLORED_SHADOWS
    float s1 = 0.0;
#endif
    for (int i = 0; i < SHADOW_SAMPLES; i++) {
        vec3 q = vec3(p.xy + vogelDisk(i, SHADOW_SAMPLES, phi) * radius, p.z);
        s0 += shadow2D(shadowtex0, q).x;
#ifdef COLORED_SHADOWS
        s1 += shadow2D(shadowtex1, q).x;
#endif
    }
    s0 /= float(SHADOW_SAMPLES);
#ifdef COLORED_SHADOWS
    s1 /= float(SHADOW_SAMPLES);
    if (s1 > s0 + 0.001) {
        vec4 tint = texture2D(shadowcolor0, p.xy);
        vec3 glass = toLinear(tint.rgb) * (1.0 - tint.a * 0.5);
        return vec3(s0) + (s1 - s0) * glass;
    }
#endif
    return vec3(s0);
}
#endif

// Direct-light visibility from the last surfaceLight() call (for speculars).
vec3 lastShadow = vec3(1.0);

// Light arriving at a surface.
//  viewNormal : unit normal in view space
//  lm         : normalised lightmap (block, sky)
//  shadowClip : shadow-space position (ignored without shadow map)
//  playerDist : distance from the camera, to fade shadows at their edge
//  foliage    : thin geometry lit from both sides
vec3 surfaceLight(vec3 viewNormal, vec2 lm, vec3 shadowClip, float playerDist, bool foliage) {
    vec3 up = normalize(upPosition);
    float skyLight = lm.y;

    // Sky ambient, with soft vanilla-style face shading so block shapes
    // stay readable in shade.
    float faceShade = 0.78 + 0.22 * dot(viewNormal, up);
    vec3 ambient = ambientColor() * (skyLight * skyLight) * (foliage ? 0.92 : faceShade);
#if !defined OVERWORLD
    ambient = ambientColor() * (foliage ? 0.92 : faceShade);
#endif

    // Block light: steep falloff that keeps torch pools warm and defined.
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
    vec3 shadow = vec3(1.0);
    // Cheap outdoor estimate beyond (and blended into) the shadow map.
    float skyShadow = smoothstep(0.80, 0.95, skyLight);
    if (diffuse > 0.0) {
#ifdef USE_SHADOWMAP
        float fade = smoothstep(shadowDistance * 0.80, shadowDistance * 0.95, playerDist);
        vec3 mapped = fade < 1.0 ? sampleShadow(shadowClip) : vec3(1.0);
        // Sky light gates the map so sun never leaks into sealed caves.
        shadow = mix(mapped * smoothstep(0.05, 0.40, skyLight), vec3(skyShadow), fade);
#else
        shadow = vec3(skyShadow);
#endif
    }
    lastShadow = shadow;
    direct = directLightColor() * diffuse * shadow;
#endif

    // Floor so unlit caves stay readable; strongest where there is no sky.
    vec3 floorLight = MIN_LIGHT * mix(4.0, 1.0, skyLight) * vec3(0.85, 0.93, 1.10);
    vec3 light = ambient + block + direct + floorLight;
    light += nightVision * 0.45;
    return light;
}
