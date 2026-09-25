#include "/lib/settings.glsl"
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"
uniform vec2 tileOrigin;
uniform float exposure;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
    vec2 uv = (gl_FragCoord.xy - tileOrigin) / vec2(viewWidth, viewHeight);
    // Panorama: azimuth -180..180, elevation -12..80 deg
    float az = (uv.x - 0.5) * 2.0 * PI;
    float el = radians(mix(-12.0, 80.0, uv.y));
    vec3 dir = vec3(sin(az) * cos(el), sin(el), -cos(az) * cos(el));
    vec3 col = skyFull(dir, true);
    col = aces(col * exposure * 0.85);
    gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}
