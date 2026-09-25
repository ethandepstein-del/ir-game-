// Final pass: FXAA edge smoothing, light sharpening, dither to 8 bit.
#include "/lib/settings.glsl"

varying vec2 texcoord;

#ifdef VSH
void main() {
    texcoord = gl_MultiTexCoord0.xy;
    gl_Position = ftransform();
}
#endif

#ifdef FSH
#include "/lib/noise.glsl"
uniform sampler2D colortex0;
uniform float viewWidth;
uniform float viewHeight;

float lumaOf(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

vec3 fxaa(vec2 uv, vec2 px, vec3 rgbM) {
    vec3 rgbNW = texture2D(colortex0, uv + vec2(-1.0, -1.0) * px).rgb;
    vec3 rgbNE = texture2D(colortex0, uv + vec2( 1.0, -1.0) * px).rgb;
    vec3 rgbSW = texture2D(colortex0, uv + vec2(-1.0,  1.0) * px).rgb;
    vec3 rgbSE = texture2D(colortex0, uv + vec2( 1.0,  1.0) * px).rgb;
    float lNW = lumaOf(rgbNW), lNE = lumaOf(rgbNE), lSW = lumaOf(rgbSW), lSE = lumaOf(rgbSE);
    float lM = lumaOf(rgbM);
    float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
    float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));

    // Leave low-contrast texture detail alone: only smooth real edges.
    if (lMax - lMin < max(0.05, lMax * 0.15)) return rgbM;

    vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
    float reduce = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
    float rcpMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + reduce);
    dir = clamp(dir * rcpMin, -8.0, 8.0) * px;

    vec3 rgbA = 0.5 * (texture2D(colortex0, uv + dir * (1.0 / 3.0 - 0.5)).rgb
                     + texture2D(colortex0, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
    vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(colortex0, uv - dir * 0.5).rgb
                                   + texture2D(colortex0, uv + dir * 0.5).rgb);
    float lB = lumaOf(rgbB);
    return (lB < lMin || lB > lMax) ? rgbA : rgbB;
}

void main() {
    vec2 px = 1.0 / vec2(viewWidth, viewHeight);
    vec3 m = texture2D(colortex0, texcoord).rgb;
    vec3 col = m;

    vec3 n = texture2D(colortex0, texcoord + vec2(0.0, -px.y)).rgb;
    vec3 s = texture2D(colortex0, texcoord + vec2(0.0,  px.y)).rgb;
    vec3 e = texture2D(colortex0, texcoord + vec2( px.x, 0.0)).rgb;
    vec3 w = texture2D(colortex0, texcoord + vec2(-px.x, 0.0)).rgb;

#ifdef FXAA
    col = fxaa(texcoord, px, m);
#endif

    // Contrast-limited sharpen: restores texture crispness after TAA-free AA.
    vec3 lo = min(m, min(min(n, s), min(e, w)));
    vec3 hi = max(m, max(max(n, s), max(e, w)));
    vec3 sharpened = col + (col - (n + s + e + w) * 0.25) * SHARPEN;
    col = clamp(sharpened, lo, hi);

    // Dither to 8 bit hides banding in the sky gradient. Triangular blue
    // noise: +-1 step, even grain, no signal-dependent noise.
    col += triangularNoise(blueNoise(gl_FragCoord.xy).a) / 255.0;

    gl_FragColor = vec4(col, 1.0);
}
#endif
