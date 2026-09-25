// Sky dome, horizon, sunrise fan and stars. Everything but the stars is
// replaced by the analytic sky, so it matches the fog exactly.
#include "/lib/settings.glsl"
#include "/lib/common.glsl"

varying vec4 color;
varying float star;

#ifdef VSH
void main() {
    color = gl_Color;
    star = float(color.r == color.g && color.g == color.b && color.r > 0.0);
    gl_Position = ftransform();
}
#endif

#ifdef FSH
#ifdef MC_RENDER_STAGE_STARS
uniform int renderStage;
#endif

void main() {
    bool isStar = star > 0.5;
#ifdef MC_RENDER_STAGE_STARS
    isStar = renderStage == MC_RENDER_STAGE_STARS;
#endif

    vec3 col;
    float alpha = 1.0;
    if (isStar) {
        col = toLinear(color.rgb) * 1.6 * STAR_BRIGHTNESS * (1.0 - rainStrength);
        alpha = color.a;
    } else {
        vec4 ndc = vec4(gl_FragCoord.xy / vec2(viewWidth, viewHeight) * 2.0 - 1.0, 1.0, 1.0);
        vec4 vp = gbufferProjectionInverse * ndc;
        vec3 viewDir = normalize(vp.xyz / vp.w);
        col = skyColor(viewDir);
        if (isEyeInWater == 1) col = applyFog(col, viewDir * far, viewDir);
        if (blindness > 0.0) col *= 1.0 - blindness;
    }

    /* DRAWBUFFERS:0 */
    gl_FragData[0] = vec4(col, alpha);
}
#endif
