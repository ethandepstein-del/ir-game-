// Volumetric cloud preview: what gbuffers_skybasic shows when the Iris
// prepare pass is on (the march runs per pixel here, at full resolution).
//   python3 sky_times.py > tiles.json
//   node render.cjs clouds.glsl clouds.png 640 300 "$(cat tiles.json)"
// Optional per-tile uniforms: view (0 = panorama, 1 = 90 deg perspective
// looking at azimuth `yaw` degrees, pitch `pitch` degrees).
#include "/lib/settings.glsl"
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"
uniform vec2 tileOrigin;
uniform float exposure;
uniform float view;
uniform float yaw;
uniform float pitch;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
    vec2 uv = (gl_FragCoord.xy - tileOrigin) / vec2(viewWidth, viewHeight);
    vec3 dir;
    if (view < 0.5) {
        // Panorama: azimuth -180..180, elevation -12..80 deg
        float az = (uv.x - 0.5) * 2.0 * PI;
        float el = radians(mix(-12.0, 80.0, uv.y));
        dir = vec3(sin(az) * cos(el), sin(el), -cos(az) * cos(el));
    } else {
        vec2 ndc = (uv * 2.0 - 1.0) * vec2(viewWidth / viewHeight, 1.0) * 0.75;
        vec3 v = normalize(vec3(ndc, -1.0));
        float p = radians(pitch), y = radians(yaw);
        v = vec3(v.x, v.y * cos(p) - v.z * sin(p), v.y * sin(p) + v.z * cos(p));
        dir = normalize(vec3(v.x * cos(y) - v.z * sin(y), v.y, v.x * sin(y) + v.z * cos(y)));
    }
    vec3 amb = ambientColor();
    vec3 sky = atmosphere(dir) + stars(dir) + sunDisc(dir);
#ifdef VOLUMETRIC_CLOUDS
    // Average a few jittered marches, like the prepare pass's temporal blend.
    vec4 cv = vec4(0.0);
    for (int k = 0; k < 4; k++)
        cv += cloudsVolumetric(dir, amb, cloudLightColor(), cloudLightDir(), fract(ign(gl_FragCoord.xy) + float(k) * 0.618034)) * 0.25;
    vec4 cl = cloudOver(cv, cirrus(dir, amb, cloudLightColor()));
#else
    vec4 cl = clouds(dir, amb, directLightColor());
#endif
    vec3 col = sky * (1.0 - cl.a) + cl.rgb;
    col = aces(col * exposure * 0.85);
    gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}
