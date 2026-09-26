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
    // Floor the elevation a little above the horizon: the horizon reads as
    // clear blue-white rather than milky, and fog (which uses the same
    // function) meets the sky with no seam.
    float yv = max(dir.y, 0.035);
    float mv = airMass(yv);
    float c = dot(dir, L);
    // Light scattered high in the sky has crossed less air: redden it less.
    float ms = airMass(L.y) * (1.0 - 0.75 * yv);
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
    sky = mix(sky, vec3(luma(sky)) * vec3(0.52, 0.55, 0.60), OVERCAST * 0.85);
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
    return c * (1.0 - OVERCAST * 0.82) * SUN_BRIGHTNESS;
#else
    return vec3(0.0);
#endif
}

// Sky-dome ambient light for surfaces, derived from the sky itself.
vec3 ambientColor() {
#if defined OVERWORLD
    vec3 sun = sunDirWorld();
    vec3 side = length(sun.xz) > 1e-3 ? normalize(vec3(sun.z, 0.0, -sun.x)) : vec3(1.0, 0.0, 0.0);
    vec3 a = (atmosphere(vec3(0.0, 1.0, 0.0)) * 0.45 + atmosphere(side) * 0.35) * 0.55;
    a += vec3(0.34, 0.44, 0.78) * 0.035 * NIGHT_BRIGHTNESS;
    // Blue hour: once the sun is down the ground is lit by the blue zenith,
    // not the orange horizon, so shade dusk toward cool light.
    float y = sun.y;
    float blueHour = smoothstep(0.06, -0.04, y) * smoothstep(-0.30, -0.06, y);
    a = mix(a, vec3(luma(a)) * vec3(0.55, 0.75, 1.35), blueHour * 0.6) + vec3(0.05, 0.08, 0.16) * 0.35 * blueHour;
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
// One cloud field drives everything. A 2D "weather" map says where clouds
// are and how tall they grow; a 3D noise field carves it inside a slab from
// CLOUD_HEIGHT-50 up CLOUD_THICKNESS blocks. The volumetric march (Iris
// prepare pass), the flat fallback layer (OptiFine, water reflections) and
// the cloud shadows on terrain all read the same weather map, so they agree.
#include "/lib/settings_clouds.glsl"

const float CLOUD_BASE  = CLOUD_HEIGHT - 50.0;
const float CLOUD_TOP   = CLOUD_HEIGHT - 50.0 + CLOUD_THICKNESS;
// Parabolic planet (R = 60000 blocks): the slab falls away toward the
// horizon, so clouds reach it instead of stretching to infinity.
const float CLOUD_CURVE = 1.0 / 120000.0;
const float CLOUD_SIGMA = 0.15 * CLOUD_DENSITY;   // extinction per block at density 1

float cloudCoverage() { return clamp(CLOUD_COVERAGE + OVERCAST * 0.30, 0.0, 1.0); }

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

float vnoise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    float a = hash13(i);
    float b = hash13(i + vec3(1.0, 0.0, 0.0));
    float c = hash13(i + vec3(0.0, 1.0, 0.0));
    float d = hash13(i + vec3(1.0, 1.0, 0.0));
    float e = hash13(i + vec3(0.0, 0.0, 1.0));
    float g = hash13(i + vec3(1.0, 0.0, 1.0));
    float h = hash13(i + vec3(0.0, 1.0, 1.0));
    float k = hash13(i + vec3(1.0, 1.0, 1.0));
    return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y),
               mix(mix(e, g, u.x), mix(h, k, u.x), u.y), u.z);
}

vec2 cloudWind() { return vec2(1.0, 0.35) * frameTimeCounter * 2.5 * CLOUD_SPEED; }

// Weather map (0..1) at a world XZ position: 0 = clear sky, 1 = cloud core.
float cloudWeather(vec2 xz, int octaves) {
    float n = cloudNoise((xz + cloudWind()) / 400.0, octaves);
    float threshold = mix(0.62, 0.30, cloudCoverage());
    return smoothstep(threshold, threshold + 0.22, n);
}

// Cumulus density (0..1) at a world position with slab height fraction h
// (0 = base, 1 = top) and weather w. detail adds the fine erosion octave.
float cloudDensity3D(vec3 wp, float h, float w, bool detail) {
    // Denser weather grows taller towers; flat base, rounded top.
    float top = mix(0.45, 1.0, w);
    float shape = w * smoothstep(0.0, 0.07, h) * (1.0 - smoothstep(top * 0.45, top, h));
    if (shape <= 0.0) return 0.0;
    vec2 wind = cloudWind();
    vec3 q = (wp + vec3(wind.x, -frameTimeCounter * 0.4 * CLOUD_SPEED, wind.y)) / 72.0;
    float n = vnoise3(q) * 0.62 + vnoise3(q * 2.61 + 7.3) * 0.38;
    n = smoothstep(0.18, 0.78, n);
    float d = shape + n - 1.0;
    if (detail && d > 0.0 && d < 0.45) {
        // Wispy underside, billowy top.
        float dn = vnoise3(q * 6.3 + 3.7);
        dn = mix(1.0 - dn, dn, clamp(h * 3.0, 0.0, 1.0));
        d -= (1.0 - dn) * 0.26;
    }
    return clamp(d * 2.2, 0.0, 1.0);
}

// Fraction of direct light that gets through the clouds to a world point.
// A 2D projection of the same field: the weather map where the ray to the
// light crosses CLOUD_HEIGHT (the dense lower part of the slab).
float cloudShadow(vec3 worldPos, vec3 L) {
#if defined CLOUDS && defined CLOUD_SHADOWS && defined OVERWORLD
    if (L.y < 0.03) return 1.0;
    float t = (CLOUD_HEIGHT - worldPos.y) / L.y;
    if (t < 0.0) return 1.0;
    vec2 xz = worldPos.xz + L.xz * t;
    // One small 2D octave stands in for the 3D erosion at the cloud edges.
    float w = cloudWeather(xz, 3) + (vnoise((xz + cloudWind()) / 70.0) - 0.5) * 0.25;
    float d = smoothstep(0.20, 0.60, w);
    return 1.0 - d * CLOUD_SHADOW_STRENGTH * CLOUD_OPACITY;
#else
    return 1.0;
#endif
}

// Light that reaches the clouds: like directLightColor(), but the slab
// still catches the sun a little after it has set on the ground.
vec3 cloudLightDir() {
    vec3 s = sunDirWorld();
    return s.y > -0.07 ? s : -s;
}
vec3 cloudLightColor() {
#if defined OVERWORLD
    float y = sunY();
    vec3 sunL  = sunTransmit(y + 0.02) * 3.1 * smoothstep(-0.07, 0.05, y);
    vec3 moonL = vec3(0.50, 0.66, 1.00) * 0.17 * NIGHT_BRIGHTNESS * smoothstep(0.0, 0.07, -y);
    vec3 c = y > -0.07 ? sunL : moonL;
    return c * (1.0 - OVERCAST * 0.82) * SUN_BRIGHTNESS;
#else
    return vec3(0.0);
#endif
}

// Roots of a t^2 + b t + c = 0 (a > 0), sorted; (-1,-1) if none.
vec2 cloudRoots(float a, float b, float c) {
    float disc = b * b - 4.0 * a * c;
    if (disc < 0.0) return vec2(-1.0);
    float q = -0.5 * (b + (b >= 0.0 ? 1.0 : -1.0) * sqrt(disc));
    float t1 = q / a;
    float t2 = abs(q) > 1e-9 ? c / q : t1;
    return vec2(min(t1, t2), max(t1, t2));
}

// Dual-lobe phase: forward silver lining plus a little back-scatter.
float cloudPhase(float c, float k) {
    return mix(phaseHG(c, 0.72 * k), phaseHG(c, -0.25 * k), 0.30);
}

// Raymarched cumulus along dir. rgb = premultiplied colour, a = coverage.
// L/lightCol from cloudLightDir()/cloudLightColor(), amb from ambientColor().
vec4 cloudsVolumetric(vec3 dir, vec3 amb, vec3 lightCol, vec3 L, float jitter) {
#if defined CLOUDS && defined OVERWORLD
    // Height along the ray: h(t) = h0 + mu t + a t^2.
    float h0 = cameraPosition.y;
    float mu = dir.y;
    float a = max(CLOUD_CURVE * (1.0 - mu * mu), 1e-9);
    vec2 rb = cloudRoots(a, mu, h0 - CLOUD_BASE);
    vec2 rt = cloudRoots(a, mu, h0 - CLOUD_TOP);
    float tIn, tOut;
    if (h0 < CLOUD_BASE) {
        tIn = rb.y; tOut = rt.y;
    } else if (h0 < CLOUD_TOP) {
        tIn = 0.0; tOut = rt.y;
        if (rb.x > 0.0) tOut = min(tOut, rb.x);
    } else {
        if (rt.x <= 0.0) return vec4(0.0);
        tIn = rt.x; tOut = rb.x > 0.0 ? rb.x : rt.y;
    }
    if (tIn > CLOUD_DISTANCE || tOut <= tIn) return vec4(0.0);
    tOut = min(tOut, min(tIn + 1700.0, CLOUD_DISTANCE));

    float dt = (tOut - tIn) / float(CLOUD_STEPS);
    float c = dot(dir, L);
    float p0 = cloudPhase(c, 1.0), p1 = cloudPhase(c, 0.5), p2 = cloudPhase(c, 0.25);
    // Light-march step lengths double; together they span ~220 blocks.
    float ls0 = 220.0 / (exp2(float(CLOUD_LIGHT_STEPS)) - 1.0);
    vec3 origin = vec3(cameraPosition.x, 0.0, cameraPosition.z);

    float T = 1.0;
    vec3 S = vec3(0.0);
    float tSum = 0.0, wSum = 0.0;
    for (int i = 0; i < CLOUD_STEPS; i++) {
        float t = tIn + (float(i) + jitter) * dt;
        vec3 p = origin + dir * t;
        p.y = h0 + mu * t + a * t * t;
        float h = (p.y - CLOUD_BASE) / CLOUD_THICKNESS;
        float w = cloudWeather(p.xz, 3);
        if (w <= 0.0) continue;
        float d = cloudDensity3D(p, h, w, true);
        if (d <= 0.0) continue;
        float sigma = d * CLOUD_SIGMA;

        // Optical depth toward the light.
        float od = 0.0;
        float ls = ls0;
        float lt = 0.0;
        for (int j = 0; j < CLOUD_LIGHT_STEPS; j++) {
            vec3 lp = p + L * (lt + ls * 0.5);
            float lh = (lp.y - CLOUD_BASE) / CLOUD_THICKNESS;
            if (lh > 1.0) break;
            float lw = cloudWeather(lp.xz, 3);
            od += cloudDensity3D(lp, lh, lw, false) * ls;
            lt += ls;
            ls *= 2.0;
        }
        od *= CLOUD_SIGMA;

        // Beer-Lambert with a multiple-scattering tail (Wrenninge octaves).
        float lum = p0 * exp(-od) + p1 * exp(-od * 0.35) * 0.45 + p2 * exp(-od * 0.12) * 0.22;
        // Powder: thin fringes facing away from the light scatter less.
        float powder = 1.0 - exp(-sigma * 45.0);
        lum *= mix(1.0, powder, 0.55 - 0.45 * c);
        // Tops see the whole sky, bases mostly the darker ground.
        vec3 ambL = amb * (0.35 + 0.95 * clamp(h, 0.0, 1.0)) * (1.0 - 0.25 * d);
        vec3 radiance = lightCol * lum * 0.85 + ambL;

        float st = exp(-sigma * dt);
        float wgt = T * (1.0 - st);
        S += radiance * wgt;
        tSum += t * wgt;
        wSum += wgt;
        T *= st;
        if (T < 0.01) break;
    }
    float alpha = 1.0 - T;
    if (alpha <= 0.001) return vec4(0.0);
    // Aerial perspective: distant clouds melt into the horizon haze.
    float tMean = tSum / max(wSum, 1e-5);
    float haze = 1.0 - exp(-tMean * 0.00032);
    S = mix(S, atmosphere(dir) * alpha, haze);
    // The slab seen edge-on far out is undersampled: let it thin away.
    float far = smoothstep(2800.0, 5200.0, tMean);
    S *= 1.0 - far;
    alpha *= 1.0 - far;
    if (h0 < CLOUD_BASE) alpha *= smoothstep(-0.06, 0.0, mu);
    return vec4(S, alpha) * CLOUD_OPACITY;
#else
    return vec4(0.0);
#endif
}

// High, thin cirrus far above the cumulus. rgb premultiplied, a = coverage.
vec4 cirrus(vec3 dir, vec3 amb, vec3 sunCol) {
#if defined CLOUDS && defined OVERWORLD
    if (dir.y < 0.002) return vec4(0.0);
    float tc = (CLOUD_HEIGHT + 650.0 - cameraPosition.y) / dir.y;
    if (tc <= 0.0) return vec4(0.0);
    vec2 wind = vec2(1.0, 0.2) * frameTimeCounter * 4.0 * CLOUD_SPEED;
    vec2 p = (cameraPosition.xz + dir.xz * tc + wind) / vec2(1400.0, 520.0);
    float ci = smoothstep(0.58, 0.88, cloudNoise(p, 4)) * 0.22 * CLOUD_OPACITY;
    ci *= exp(-tc * 0.00008) * smoothstep(0.0, 0.15, dir.y) * (1.0 - OVERCAST * 0.5);
    vec3 ccol = sunCol * 0.45 * (0.6 + 0.4 * phaseHG(dot(dir, lightDirWorld()), 0.6)) + amb * 1.1;
    return vec4(ccol * ci, ci);
#else
    return vec4(0.0);
#endif
}

// Cheap flat cumulus on the CLOUD_HEIGHT plane from the same weather map:
// the OptiFine path, and what water reflections see.
vec4 cumulusFlat(vec3 dir, vec3 amb, vec3 sunCol) {
#if defined CLOUDS && defined OVERWORLD
    if (abs(dir.y) < 0.002) return vec4(0.0);
    float t = (CLOUD_HEIGHT - cameraPosition.y) / dir.y;
    if (t <= 0.0) return vec4(0.0);

    vec2 xz = cameraPosition.xz + dir.xz * t;
    float d = cloudWeather(xz, 5);
    if (d <= 0.002) return vec4(0.0);

    vec3 L = lightDirWorld();
    float fade = exp(-t * 0.00011) * smoothstep(0.0, 0.10, abs(dir.y));
    // Light marching toward the source across the layer.
    vec2 lxz = L.xz / max(length(L.xz), 0.2);
    float od = d * 0.7 / max(L.y, 0.2);
    od += cloudWeather(xz + lxz * 45.0, 3) * 0.55;
    od += cloudWeather(xz + lxz * 110.0, 3) * 0.35;
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
    return vec4(col * a, a);
#else
    return vec4(0.0);
#endif
}

// Front cloud layer composited over the back one (both premultiplied).
vec4 cloudOver(vec4 front, vec4 back) {
    return vec4(front.rgb + back.rgb * (1.0 - front.a), front.a + back.a * (1.0 - front.a));
}

// Flat clouds seen along dir. rgb = premultiplied colour, a = coverage.
// amb/sunCol are ambientColor()/directLightColor(), hoisted by the caller.
vec4 clouds(vec3 dir, vec3 amb, vec3 sunCol) {
    return cloudOver(cumulusFlat(dir, amb, sunCol), cirrus(dir, amb, sunCol));
}

// ------------------------------------------------------------------ stars / sun
vec3 stars(vec3 dir) {
#if defined OVERWORLD
    float vis = (1.0 - dayFactor()) * (1.0 - OVERCAST) * smoothstep(-0.02, 0.12, dir.y);
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
    return sunTransmit(s.y) * 40.0 * limb * edge * horizon * (1.0 - OVERCAST);
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
