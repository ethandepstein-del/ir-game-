// Preview: a small desert scene (sand terraces, terracotta mesa, water)
// lit with the pack's real lighting, fog, sky and tonemap code, so tone,
// contrast and haze can be tuned against in-game screenshots.
#define NO_SHADOW_LOOKUP
#include "/lib/settings.glsl"
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"
#include "/lib/lighting.glsl"
#include "/lib/fog.glsl"
uniform vec2 tileOrigin;
uniform float avgLumGuess;

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

// Boxes: min, max, albedo (sRGB)
const int NB = 9;
void box(int i, out vec3 bmin, out vec3 bmax, out vec3 alb) {
    vec3 sand = vec3(0.86, 0.82, 0.66), terra = vec3(0.62, 0.30, 0.20), stone = vec3(0.50, 0.50, 0.50);
    if (i == 0) { bmin = vec3(-400.0, 0.0, -400.0); bmax = vec3(400.0, 64.0, 400.0); alb = sand; }
    else if (i == 1) { bmin = vec3(-6.0, 64.0, -40.0); bmax = vec3(40.0, 67.0, -8.0); alb = sand; }
    else if (i == 2) { bmin = vec3(0.0, 67.0, -40.0); bmax = vec3(40.0, 70.0, -18.0); alb = sand; }
    else if (i == 3) { bmin = vec3(8.0, 70.0, -40.0); bmax = vec3(40.0, 73.0, -26.0); alb = sand; }
    else if (i == 4) { bmin = vec3(40.0, 64.0, -190.0); bmax = vec3(150.0, 130.0, -90.0); alb = terra; }
    else if (i == 5) { bmin = vec3(60.0, 130.0, -180.0); bmax = vec3(120.0, 150.0, -120.0); alb = terra; }
    else if (i == 6) { bmin = vec3(-60.0, 64.0, -120.0); bmax = vec3(-20.0, 72.0, -90.0); alb = stone; }
    else if (i == 7) { bmin = vec3(3.0, 67.0, -14.0); bmax = vec3(4.0, 70.0, -13.0); alb = vec3(0.35, 0.55, 0.25); } // cactus
    else { bmin = vec3(-18.0, 64.0, -60.0); bmax = vec3(-14.0, 71.0, -56.0); alb = sand; }
}

bool hitBox(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax, out float t, out vec3 n) {
    vec3 inv = 1.0 / rd;
    vec3 t0 = (bmin - ro) * inv, t1 = (bmax - ro) * inv;
    vec3 tn = min(t0, t1), tf = max(t0, t1);
    float tN = max(max(tn.x, tn.y), tn.z), tF = min(min(tf.x, tf.y), tf.z);
    if (tN > tF || tF < 0.0 || tN < 0.0) return false;
    t = tN;
    n = tN == tn.x ? vec3(-sign(rd.x), 0.0, 0.0) : (tN == tn.y ? vec3(0.0, -sign(rd.y), 0.0) : vec3(0.0, 0.0, -sign(rd.z)));
    return true;
}

bool trace(vec3 ro, vec3 rd, out float tBest, out vec3 nBest, out vec3 albBest, out bool water) {
    tBest = 1e9; water = false;
    for (int i = 0; i < NB; i++) {
        vec3 a, b, c; box(i, a, b, c);
        float t; vec3 n;
        if (hitBox(ro, rd, a, b, t, n) && t < tBest) { tBest = t; nBest = n; albBest = c; }
    }
    // Water: a lake at y = 63.9 for x < -25
    if (rd.y < 0.0) {
        float tw = (63.9 - ro.y) / rd.y;
        vec3 pw = ro + rd * tw;
        if (pw.x < -25.0 && tw < tBest) { tBest = tw; nBest = vec3(0.0, 1.0, 0.0); water = true; albBest = vec3(0.0); }
    }
    return tBest < 1e8;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - tileOrigin) / vec2(viewWidth, viewHeight);
    vec2 ndc = uv * 2.0 - 1.0;
    vec3 ro = vec3(0.0, 80.0, 30.0);
    vec3 rd = normalize(vec3(ndc.x * 1.3, ndc.y * 0.73 - 0.28, -1.0));
    vec3 L = lightDirWorld();
    vec3 amb = ambientColor();
    vec3 sun = directLightColor();

    float t; vec3 n, alb; bool water;
    vec3 col;
    if (!trace(ro, rd, t, n, alb, water)) {
        col = skyFull(rd, true, amb, sun);
    } else {
        vec3 p = ro + rd * t;
        if (water) {
            vec3 tint = pow(vec3(0.25, 0.46, 0.89), vec3(2.2));
            float F = 0.02 + 0.98 * pow(1.0 - clamp(-rd.y, 0.0, 1.0), 5.0);
            vec3 deep = waterScatterColor(tint, 1.0, amb, sun);
            col = mix(deep, skyFull(reflect(rd, n), false, amb, sun), F);
        } else {
            vec3 base = pow(alb, vec3(2.2));
            float ts; vec3 ns, as; bool ws;
            bool shadowed = trace(p + n * 0.01, L, ts, ns, as, ws) && !ws;
            vec3 light = surfaceLight(n, vec2(0.0, 1.0), vec3(0.0), p - ro, false, amb, sun);
            if (shadowed) light -= sun * max(dot(n, L), 0.0) * lastShadow;
            col = base * light;
        }
        col = applyFog(col, p - ro, false, amb, sun);
    }
    // composite3-style exposure and tonemap
    float target = clamp(EXPOSURE_KEY / avgLumGuess, EXPOSURE_MIN, EXPOSURE_MAX);
    col *= target * EXPOSURE * 0.85;
    col = aces(col);
    col = pow(col, vec3(1.0 / 2.2));
    col = mix(vec3(luma(col)), col, SATURATION);
    col = (col - 0.5) * CONTRAST + 0.5;
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
