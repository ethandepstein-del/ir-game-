// Preview: open water rendered with the pack's wave, sky and caustic code.
// mode 0 = ocean view, 1 = top-down close-up, 2 = caustics on sand.
#include "/lib/settings.glsl"
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"
#include "/lib/water.glsl"
uniform vec2 tileOrigin;
uniform float exposure;
uniform float mode;
uniform float yaw;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
    vec2 uv = (gl_FragCoord.xy - tileOrigin) / vec2(viewWidth, viewHeight);
    vec3 col;
    vec3 L = lightDirWorld();
    vec3 sun = directLightColor();
    vec3 tint = pow(vec3(0.25, 0.46, 0.89), vec3(2.2));
    if (mode < 0.5) {
        vec2 ndc = uv * 2.0 - 1.0;
        vec3 d = normalize(vec3(ndc.x * 1.2, ndc.y * 0.56 - 0.12, -1.0));
        float cy = cos(yaw), sy = sin(yaw);
        d = vec3(cy * d.x - sy * d.z, d.y, sy * d.x + cy * d.z);
        if (d.y >= 0.0) { col = skyFull(d, true); }
        else {
            float t = 4.0 / -d.y;
            vec3 p = vec3(0.0, 4.0, 0.0) + d * t;
            vec3 n = waterNormal(p.xz, t);
            float cosT = clamp(dot(-d, n), 0.0, 1.0);
            float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
            vec3 R = reflect(d, n); R.y = max(R.y, 0.0);
            vec3 refl = skyFull(normalize(R + vec3(0.0, 0.001, 0.0)), false);
            vec3 deep = tint * (ambientColor() * 0.55 + sun * 0.04);
            vec3 H = normalize(L - d);
            float NdotH = max(dot(n, H), 0.0);
            float a2 = 0.0025;
            float D = a2 / (PI * pow(NdotH * NdotH * (a2 - 1.0) + 1.0, 2.0));
            float crest = clamp((1.0 - n.y) * 14.0, 0.0, 1.0);
            vec3 sss = vec3(0.10, 0.75, 0.60) * tint * 4.0 * sun * crest * pow(max(dot(d, L), 0.0), 3.0) * 0.5;
            col = mix(deep + sss, refl, F) + sun * D * 0.02;
            col = mix(col, atmosphere(d), 1.0 - exp(-t * 0.004));
        }
    } else if (mode < 1.5) {
        vec2 p = uv * vec2(viewWidth / viewHeight, 1.0) * 6.0;
        vec3 n = waterNormal(p, 4.0);
        vec3 d = normalize(vec3(0.0, -1.0, -0.35));
        float F = 0.02 + 0.98 * pow(1.0 - clamp(dot(-d, n), 0.0, 1.0), 5.0);
        vec3 R = reflect(d, n); R.y = max(R.y, 0.0);
        vec3 floorCol = pow(vec3(0.86, 0.82, 0.62), vec3(2.2)) * (sun + ambientColor()) * exp(-vec3(0.26, 0.07, 0.045) * 2.5);
        col = mix(floorCol, skyFull(normalize(R + 0.001), false), F);
        // Shade by slope so the wave and ripple shapes are visible.
        col = (n * 0.5 + 0.5) * 0.7;
        col = pow(col, vec3(2.2)) * 1.6;
    } else {
        vec2 p = uv * vec2(viewWidth / viewHeight, 1.0) * 10.0;
        float c = caustics(p);
        vec3 sand = pow(vec3(0.86, 0.82, 0.62), vec3(2.2)) * (sun * 0.6 + ambientColor());
        col = sand * (1.0 + c * 1.6) * exp(-vec3(0.26, 0.07, 0.045) * 3.0) + tint * 0.1;
    }
    col = aces(col * exposure * 0.85);
    gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}
