// Sky, sun/moon light and clouds. All directions here are world-space
// unit vectors (player space: +Y is up). Requires common.glsl.

const vec3  BETA_R = vec3(0.16, 0.37, 0.90);   // Rayleigh, relative
const float BETA_M = 0.04;                      // Mie
const vec3  OZONE  = vec3(0.030, 0.085, 0.004); // absorbs orange/green: keeps twilight blue
const vec3  EXT_SUN = BETA_R * 0.45 + BETA_M + OZONE;

vec3 sunDirWorld() { return normalize(mat3(gbufferModelViewInverse) * sunPosition); }
vec3 lightDirWorld() { return normalize(mat3(gbufferModelViewInverse) * shadowLightPosition); }

float sunY() { return sunDirWorld().y; }
float dayFactor() { return smoothstep(-0.10, 0.25, sunY()); }
float sunsetFactor() {
    float s = clamp(1.0 - abs(sunY() - 0.04) / 0.30, 0.0, 1.0);
    return s * s;
}

// Relative air mass along a direction with elevation y (1 at zenith).
float airMass(float y) {
    y = max(y, 0.0);
    return 1.0 / (y + 0.1 * exp(-8.0 * y) + 0.02);
}

// Colour of sunlight after the atmosphere, white at noon.
vec3 sunTransmit(float y) {
    return exp(-EXT_SUN * max(airMass(y) - airMass(1.0), 0.0));
}

float phaseRayleigh(float c) { return 0.75 * (1.0 + c * c); }
// Henyey-Greenstein, scaled so its average over the sphere is 1.
float phaseHG(float c, float g) {
    float g2 = g * g;
    return (1.0 - g2) / pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5);
}

// Single-scattering-style sky lit by one source L with intensity E.
vec3 scatter(vec3 dir, vec3 L, float E) {
    float yv = max(dir.y, 0.0);
    float mv = airMass(yv);
    float c = dot(dir, L);
    // Light scattered high in the sky has crossed less air: redden it less.
    float ms = airMass(L.y) * (1.0 - 0.55 * yv);
    vec3 lightCol = exp(-EXT_SUN * max(ms - airMass(1.0), 0.0));
    // Ozone along the view path deepens the zenith at dusk.
    lightCol *= exp(-OZONE * mv * 0.25);
    vec3 ray = (1.0 - exp(-BETA_R * mv)) * phaseRayleigh(c);
    vec3 mie = vec3(1.0 - exp(-BETA_M * mv)) * phaseHG(c, 0.76) * 0.16;
    return (ray + mie) * lightCol * E;
}

float sunSkyIntensity() {
    float y = sunY();
    return 1.85 * smoothstep(-0.16, 0.02, y) * (0.40 + 0.60 * smoothstep(0.0, 0.35, y));
}
float moonSkyIntensity() {
    return 0.045 * NIGHT_BRIGHTNESS * smoothstep(-0.16, 0.05, -sunY());
}

// Clear-sky radiance (no sun disc, stars or clouds), linear HDR.
vec3 atmosphere(vec3 dir) {
#if defined OVERWORLD
    vec3 sun = sunDirWorld();
    vec3 sky = scatter(dir, sun, sunSkyIntensity());
    sky += scatter(dir, -sun, moonSkyIntensity()) * vec3(0.50, 0.68, 1.10);
    sky += vec3(0.0020, 0.0032, 0.0065) * NIGHT_BRIGHTNESS;   // airglow floor

    // Below the horizon: fade toward a darker, ground-lit tone.
    float below = smoothstep(0.0, 0.25, -dir.y);
    sky *= mix(1.0, 0.30, below);

    // Overcast.
    sky = mix(sky, vec3(luma(sky)) * vec3(0.52, 0.55, 0.60), rainStrength * 0.85);
    return sky;
#elif defined NETHER
    return toLinear(fogColor) * 0.9;
#else
    return vec3(0.030, 0.022, 0.045);
#endif
}

// Direct light on surfaces (sun by day, moon by night).
vec3 directLightColor() {
#if defined OVERWORLD
    float y = sunY();
    vec3 sunL  = sunTransmit(y) * 3.1 * smoothstep(0.0, 0.07, y);
    vec3 moonL = vec3(0.50, 0.66, 1.00) * 0.17 * NIGHT_BRIGHTNESS * smoothstep(0.0, 0.07, -y);
    vec3 c = y > 0.0 ? sunL : moonL;
    return c * (1.0 - rainStrength * 0.82) * SUN_BRIGHTNESS;
#else
    return vec3(0.0);
#endif
}

// Sky-dome ambient light for surfaces, derived from the sky itself.
vec3 ambientColor() {
#if defined OVERWORLD
    vec3 sun = sunDirWorld();
    vec3 side = length(sun.xz) > 1e-3 ? normalize(vec3(sun.z, 0.0, -sun.x)) : vec3(1.0, 0.0, 0.0);
    vec3 a = (atmosphere(vec3(0.0, 1.0, 0.0)) * 0.45 + atmosphere(side) * 0.35) * 0.70;
    a += vec3(0.34, 0.44, 0.78) * 0.035 * NIGHT_BRIGHTNESS;
    return a * AMBIENT_BRIGHTNESS;
#elif defined NETHER
    return vec3(0.60, 0.36, 0.26) * 0.55 * AMBIENT_BRIGHTNESS;
#else
    return vec3(0.46, 0.40, 0.62) * 0.60 * AMBIENT_BRIGHTNESS;
#endif
}

vec3 blockLightColor() {
    return vec3(BLOCKLIGHT_R, BLOCKLIGHT_G, BLOCKLIGHT_B) * 1.6 * BLOCKLIGHT_BRIGHTNESS;
}

// ------------------------------------------------------------------ clouds
float cloudCoverage() { return clamp(CLOUD_COVERAGE + rainStrength * 0.30, 0.0, 1.0); }

float cloudNoise(vec2 p, int octaves) {
    float n = 0.0;
    float a = 0.5;
    float norm = 0.0;
    for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
        n += a * vnoise(p);
        norm += a;
        p = mat2(0.8, -0.6, 0.6, 0.8) * p * 2.07 + vec2(17.13, 3.71);
        a *= 0.5;
    }
    return n / norm;
}

// Cumulus density (0..1) at a world XZ position on the cloud layer.
float cloudDensity(vec2 xz, int octaves) {
    vec2 wind = vec2(1.0, 0.35) * frameTimeCounter * 2.5;
    float n = cloudNoise((xz + wind) / 560.0, octaves);
    float threshold = mix(0.66, 0.40, cloudCoverage());
    return smoothstep(threshold, threshold + 0.16, n);
}

// Fraction of direct light that gets through the clouds to a world point.
float cloudShadow(vec3 worldPos, vec3 L) {
#if defined CLOUDS && defined CLOUD_SHADOWS && defined OVERWORLD
    if (L.y < 0.03) return 1.0;
    float t = (CLOUD_HEIGHT - worldPos.y) / L.y;
    if (t < 0.0) return 1.0;
    float d = cloudDensity(worldPos.xz + L.xz * t, 3);
    return 1.0 - d * CLOUD_SHADOW_STRENGTH * CLOUD_OPACITY;
#else
    return 1.0;
#endif
}

// Clouds seen along dir from the camera. rgb = premultiplied colour, a = coverage.
// amb/sunCol are ambientColor()/directLightColor(), hoisted by the caller.
vec4 clouds(vec3 dir, vec3 amb, vec3 sunCol) {
#if defined CLOUDS && defined OVERWORLD
    vec4 result = vec4(0.0);
    float eyeY = cameraPosition.y;
    if (abs(dir.y) < 0.002) return result;
    float t = (CLOUD_HEIGHT - eyeY) / dir.y;
    if (t <= 0.0) return result;

    vec2 xz = cameraPosition.xz + dir.xz * t;
    float d = cloudDensity(xz, 5);

    vec3 L = lightDirWorld();
    float fade = exp(-t * 0.00011) * smoothstep(0.0, 0.10, abs(dir.y));

    if (d > 0.002) {
        // Light marching toward the source across the layer.
        vec2 lxz = L.xz / max(length(L.xz), 0.2);
        float od = d * 0.7 / max(L.y, 0.2);
        od += cloudDensity(xz + lxz * 45.0, 3) * 0.55;
        od += cloudDensity(xz + lxz * 110.0, 3) * 0.35;
        // Single scattering plus a soft multiple-scattering term.
        float t1 = exp(-od * 1.2);
        float t2 = exp(-od * 0.3) * 0.45;
        float powder = 1.0 - exp(-d * 4.0);
        float c = dot(dir, L);
        float phase = mix(phaseHG(c, 0.55), phaseHG(c, -0.20), 0.40);
        vec3 col = sunCol * (t1 * phase + t2 * 0.8) * (0.5 + 0.5 * powder) * 0.9
                 + amb * (1.0 - 0.35 * d);
        // Aerial perspective toward the horizon.
        col = mix(col, atmosphere(dir), 1.0 - exp(-t * 0.00022));
        float a = smoothstep(0.0, 0.6, d) * CLOUD_OPACITY * fade;
        result = vec4(col * a, a);
    }

    // High, thin cirrus above the cumulus.
    float tc = (CLOUD_HEIGHT + 650.0 - eyeY) / dir.y;
    if (tc > 0.0) {
        vec2 wind = vec2(1.0, 0.2) * frameTimeCounter * 4.0;
        vec2 p = (cameraPosition.xz + dir.xz * tc + wind) / vec2(1400.0, 520.0);
        float ci = smoothstep(0.58, 0.88, cloudNoise(p, 4)) * 0.22 * CLOUD_OPACITY;
        ci *= exp(-tc * 0.00008) * smoothstep(0.0, 0.15, dir.y) * (1.0 - rainStrength * 0.5);
        vec3 ccol = sunCol * 0.45 * (0.6 + 0.4 * phaseHG(dot(dir, L), 0.6)) + amb * 1.1;
        result.rgb += ccol * ci * (1.0 - result.a);
        result.a += ci * (1.0 - result.a);
    }
    return result;
#else
    return vec4(0.0);
#endif
}

// ------------------------------------------------------------------ stars / sun
vec3 stars(vec3 dir) {
#if defined OVERWORLD
    float vis = (1.0 - dayFactor()) * (1.0 - rainStrength) * smoothstep(-0.02, 0.12, dir.y);
    if (vis <= 0.0) return vec3(0.0);
    // A frame fixed to the celestial sphere, so stars turn with the sun.
    vec3 s = sunDirWorld();
    float r = radians(sunPathRotation);
    vec3 a1 = vec3(0.0, sin(r), cos(r));
    vec3 a2 = vec3(0.0, -sin(r), cos(r));
    vec3 axis = abs(dot(a1, s)) < abs(dot(a2, s)) ? a1 : a2;
    vec3 b = cross(axis, s);
    vec3 p = vec3(dot(dir, s), dot(dir, axis), dot(dir, b)) * 240.0;

    vec3 cell = floor(p);
    vec3 f = fract(p) - 0.5;
    float h = hash13(cell);
    if (h < 0.9960) return vec3(0.0);
    float bright = (h - 0.9960) / 0.0040;
    float shape = smoothstep(0.30, 0.0, length(f));
    float twinkle = 0.75 + 0.25 * sin(frameTimeCounter * (1.5 + bright * 4.0) + h * 400.0);
    vec3 tint = mix(vec3(0.70, 0.80, 1.00), vec3(1.00, 0.88, 0.72), fract(h * 713.0));
    return tint * shape * twinkle * (0.15 + bright * 0.55) * vis * STAR_BRIGHTNESS;
#else
    return vec3(0.0);
#endif
}

vec3 sunDisc(vec3 dir) {
#if defined OVERWORLD
    vec3 s = sunDirWorld();
    float ang = acos(clamp(dot(dir, s), -1.0, 1.0));
    float r = 0.0145 * SUN_SIZE;
    if (ang > r * 1.2) return vec3(0.0);
    float x = clamp(ang / r, 0.0, 1.0);
    float limb = sqrt(max(1.0 - x * x, 0.0)) * 0.6 + 0.4;
    float edge = 1.0 - smoothstep(0.92, 1.08, ang / r);
    float horizon = smoothstep(-0.02, 0.02, dir.y);
    return sunTransmit(s.y) * 40.0 * limb * edge * horizon * (1.0 - rainStrength);
#else
    return vec3(0.0);
#endif
}

// Everything visible in the open sky along dir.
vec3 skyFull(vec3 dir, bool withSun, vec3 amb, vec3 sunCol) {
    vec3 sky = atmosphere(dir) + stars(dir);
    if (withSun) sky += sunDisc(dir);
    vec4 cl = clouds(dir, amb, sunCol);
    return sky * (1.0 - cl.a) + cl.rgb;
}
