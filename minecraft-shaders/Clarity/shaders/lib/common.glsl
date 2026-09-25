// Shared uniforms and helpers for every gbuffers program.
// Dimension is selected by the stub that includes the program:
// OVERWORLD, NETHER or END.

uniform vec3 sunPosition;
uniform vec3 upPosition;
uniform vec3 shadowLightPosition;
uniform vec3 cameraPosition;
uniform vec3 fogColor;
uniform mat4 gbufferModelView;
uniform mat4 gbufferModelViewInverse;
uniform mat4 gbufferProjectionInverse;
uniform float rainStrength;
uniform float nightVision;
uniform float blindness;
uniform float far;
uniform float frameTimeCounter;
uniform float viewWidth;
uniform float viewHeight;
uniform int isEyeInWater;
uniform ivec2 eyeBrightnessSmooth;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
vec3 saturate3(vec3 c) { return clamp(c, 0.0, 1.0); }

// Some geometry (clouds, a few entities) ships zero normals; normalizing
// those gives NaN, which bloom would then smear across the screen.
vec3 safeNormal(vec3 n) {
    return dot(n, n) > 1e-8 ? normalize(n) : normalize(upPosition);
}

float sunElevation() {
    return dot(normalize(sunPosition), normalize(upPosition));
}

// 1 at full day, 0 at night; soft through twilight.
float dayFactor() { return smoothstep(-0.10, 0.25, sunElevation()); }

// Peaks when the sun sits on the horizon.
float sunsetFactor() {
    float e = sunElevation();
    float s = clamp(1.0 - abs(e - 0.04) / 0.32, 0.0, 1.0);
    return s * s;
}

// Colour of the direct light (sun or moon) in linear HDR.
vec3 directLightColor() {
#if defined OVERWORLD
    float e = sunElevation();
    vec3 sunDay = vec3(1.00, 0.93, 0.84) * 3.1;
    vec3 sunSet = vec3(1.00, 0.52, 0.24) * 2.3;
    vec3 moon   = vec3(0.52, 0.66, 1.00) * 0.18 * NIGHT_BRIGHTNESS;
    vec3 c = e > 0.0 ? mix(sunSet, sunDay, smoothstep(0.02, 0.38, e)) : moon;
    // Fade to zero while the light source crosses the horizon so the
    // sun -> moon swap of the shadow light never pops.
    c *= smoothstep(0.0, 0.07, abs(e));
    c *= 1.0 - rainStrength * 0.82;
    return c * SUN_BRIGHTNESS;
#else
    return vec3(0.0);
#endif
}

// Colour of the sky-dome ambient light.
vec3 ambientColor() {
#if defined OVERWORLD
    vec3 day    = vec3(0.50, 0.66, 1.00) * 1.00;
    vec3 sunset = vec3(0.70, 0.55, 0.52) * 0.60;
    vec3 night  = vec3(0.34, 0.44, 0.78) * 0.075 * NIGHT_BRIGHTNESS;
    vec3 c = mix(night, day, dayFactor());
    c = mix(c, sunset, sunsetFactor() * 0.55);
    c = mix(c, vec3(luma(c)) * 0.85, rainStrength * 0.65);
    return c * AMBIENT_BRIGHTNESS;
#elif defined NETHER
    return vec3(0.60, 0.36, 0.26) * 0.55 * AMBIENT_BRIGHTNESS;
#else
    return vec3(0.46, 0.40, 0.62) * 0.60 * AMBIENT_BRIGHTNESS;
#endif
}

vec3 blockLightColor() {
    return vec3(BLOCKLIGHT_R, BLOCKLIGHT_G, BLOCKLIGHT_B) * 1.6 * BLOCKLIGHT_BRIGHTNESS;
}

// Analytic sky in linear HDR. viewDir is a unit vector in view space.
vec3 skyColor(vec3 viewDir) {
#if defined OVERWORLD
    vec3 up  = normalize(upPosition);
    vec3 sun = normalize(sunPosition);
    float y = dot(viewDir, up);
    float cosSun = dot(viewDir, sun);
    float day = dayFactor();
    float sunset = sunsetFactor();

    float horizon = exp(-max(y, 0.0) * 4.0);
    vec3 zenithDay  = vec3(0.20, 0.42, 0.95) * 1.25;
    vec3 horizonDay = vec3(0.62, 0.78, 1.00) * 1.45;
    vec3 zenithNight  = vec3(0.010, 0.017, 0.045) * NIGHT_BRIGHTNESS;
    vec3 horizonNight = vec3(0.030, 0.045, 0.085) * NIGHT_BRIGHTNESS;

    vec3 zenith = mix(zenithNight, zenithDay, day);
    vec3 hor    = mix(horizonNight, horizonDay, day);

    // Sunset: warm band that is strongest toward the sun.
    float towardSun = cosSun * 0.5 + 0.5;
    vec3 sunsetHor = mix(vec3(0.85, 0.42, 0.40), vec3(1.25, 0.55, 0.20), towardSun * towardSun) * 1.5;
    hor    = mix(hor, sunsetHor, sunset);
    zenith = mix(zenith, vec3(0.20, 0.26, 0.55), sunset * 0.6);

    vec3 sky = mix(zenith, hor, horizon);
    // Below the horizon: keep the horizon colour but let it darken a bit.
    sky *= mix(1.0, 0.55, clamp(-y * 2.5, 0.0, 1.0));

    // Sun and moon glow.
    float cs = max(cosSun, 0.0);
    float glow = pow(cs, 8.0) * 0.35 + pow(cs, 90.0) * 1.2;
    sky += glow * mix(vec3(1.0, 0.55, 0.25), vec3(1.0, 0.90, 0.75), smoothstep(0.05, 0.4, sunElevation()))
         * clamp(day + sunset, 0.0, 1.0);
    float cm = max(-cosSun, 0.0);
    sky += pow(cm, 16.0) * vec3(0.10, 0.13, 0.20) * 0.35 * (1.0 - day);

    // Rain greys the sky.
    sky = mix(sky, vec3(luma(sky)) * 0.62, rainStrength * 0.85);
    return sky;
#elif defined NETHER
    return toLinear(fogColor) * 0.9;
#else
    return vec3(0.030, 0.022, 0.045);
#endif
}

// Applies distance fog. playerPos is the fragment relative to the camera,
// viewDir is the unit view-space direction toward it.
vec3 applyFog(vec3 color, vec3 playerPos, vec3 viewDir) {
    float dist = length(playerPos);

    if (isEyeInWater == 1) {
        vec3 waterFog = vec3(0.035, 0.20, 0.28) * (ambientColor() * 0.9 + 0.02 + directLightColor() * 0.06);
        float eyeSky = float(eyeBrightnessSmooth.y) / 240.0;
        waterFog *= 0.35 + 0.65 * eyeSky;
        float f = 1.0 - exp(-dist * 2.5 / UNDERWATER_VIEW);
        color = mix(color, waterFog, f);
    } else if (isEyeInWater == 2) {
        color = mix(color, vec3(1.2, 0.35, 0.05), clamp(dist / 2.5, 0.0, 1.0));
    } else if (isEyeInWater == 3) {
        color = mix(color, vec3(0.7, 0.8, 0.9), clamp(dist / 2.5, 0.0, 1.0));
    } else {
#if defined OVERWORLD
        // Border fog hides chunk edges, a faint haze adds depth.
        float border = smoothstep(far * FOG_START, far, length(playerPos.xz));
        float haze = (1.0 - exp(-dist * (0.0012 + rainStrength * 0.006))) * 0.6;
        float f = clamp(max(border, haze), 0.0, 1.0);
        color = mix(color, skyColor(viewDir), f);
#elif defined NETHER
        float f = smoothstep(far * 0.25, far, dist) * 0.85;
        color = mix(color, skyColor(viewDir), f);
#else
        float f = smoothstep(far * 0.45, far, dist);
        color = mix(color, skyColor(viewDir), f);
#endif
    }

    if (blindness > 0.0) {
        float f = smoothstep(1.5, 5.0, dist) * blindness;
        color = mix(color, vec3(0.0), f);
    }
    return color;
}

// Interleaved gradient noise, used to rotate sample kernels.
float ign(vec2 p) {
    return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}
