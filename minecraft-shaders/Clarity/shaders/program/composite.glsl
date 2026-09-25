// Pass 1: light shafts from the sun, screen-space and subtle.
#include "/lib/settings.glsl"

/*
const int colortex0Format = RGBA16F;
const bool colortex0Clear = true;
*/

varying vec2 texcoord;

#ifdef VSH
void main() {
    texcoord = gl_MultiTexCoord0.xy;
    gl_Position = ftransform();
}
#endif

#ifdef FSH
#include "/lib/common.glsl"
uniform sampler2D colortex0;
uniform sampler2D depthtex0;
uniform mat4 gbufferProjection;

void main() {
    vec3 col = texture2D(colortex0, texcoord).rgb;
    float depth = texture2D(depthtex0, texcoord).r;

    // Scrub NaN/Inf so one bad pixel can't spread through the bloom mips.
    if (!(dot(col, vec3(1.0)) < 1e30)) col = vec3(0.0);
    col = max(col, vec3(0.0));

#if defined NETHER
    // The Nether has no sky pass: give empty pixels the linear fog colour.
    if (depth >= 1.0) col = skyColor(vec3(0.0));
#endif

#if defined GODRAYS && defined OVERWORLD
    float e = sunElevation();
    float eyeSky = float(eyeBrightnessSmooth.y) / 240.0;
    float visibility = smoothstep(-0.02, 0.10, e) * (1.0 - rainStrength) * eyeSky * float(isEyeInWater == 0);
    if (visibility > 0.001 && sunPosition.z < 0.0) {
        vec4 sunClip = gbufferProjection * vec4(sunPosition, 1.0);
        vec2 sunUV = sunClip.xy / sunClip.w * 0.5 + 0.5;

        vec4 vp = gbufferProjectionInverse * vec4(texcoord * 2.0 - 1.0, 1.0, 1.0);
        vec3 viewDir = normalize(vp.xyz / vp.w);
        float cosSun = max(dot(viewDir, normalize(sunPosition)), 0.0);
        float falloff = pow(cosSun, 5.0);

        if (falloff > 0.002) {
            const int steps = 16;
            vec2 delta = (sunUV - texcoord) / float(steps);
            vec2 pos = texcoord + delta * ign(gl_FragCoord.xy);
            float acc = 0.0;
            for (int i = 0; i < steps; i++) {
                vec2 q = clamp(pos, 0.0, 1.0);
                acc += float(texture2D(depthtex0, q).r >= 1.0);
                pos += delta;
            }
            acc /= float(steps);
            vec3 tint = mix(vec3(1.0, 0.55, 0.25), vec3(1.0, 0.88, 0.72), smoothstep(0.05, 0.45, e));
            col += tint * acc * falloff * visibility * GODRAY_STRENGTH * 0.45;
        }
    }
#endif

    /* DRAWBUFFERS:0 */
    gl_FragData[0] = vec4(col, 1.0);
}
#endif
