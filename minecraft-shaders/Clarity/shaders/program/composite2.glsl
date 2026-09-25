// Pass 2: smooth the dithered volumetric light and add it to the scene.
#include "/lib/settings.glsl"

varying vec2 texcoord;

#ifdef VSH
void main() {
    texcoord = gl_MultiTexCoord0.xy;
    gl_Position = ftransform();
}
#endif

#ifdef FSH
uniform sampler2D colortex0;
uniform sampler2D colortex5;
uniform sampler2D depthtex0;
uniform float viewWidth;
uniform float viewHeight;
uniform float near;
uniform float far;

float linearZ(float d) { return 2.0 * near * far / (far + near - (d * 2.0 - 1.0) * (far - near)); }

void main() {
    vec3 col = texture2D(colortex0, texcoord).rgb;
#if defined VOLUMETRIC_LIGHT && defined OVERWORLD
    vec2 px = 1.0 / vec2(viewWidth, viewHeight);
    float z0 = linearZ(texture2D(depthtex0, texcoord).r);
    vec3 sum = vec3(0.0);
    float wsum = 0.0;
    for (int x = -2; x <= 2; x++) {
        for (int y = -2; y <= 2; y++) {
            vec2 q = texcoord + vec2(float(x), float(y)) * px;
            float z = linearZ(texture2D(depthtex0, q).r);
            float w = 1.0 / (1.0 + abs(z - z0) / max(z0, 1.0) * 20.0);
            sum += texture2D(colortex5, q).rgb * w;
            wsum += w;
        }
    }
    col += sum / wsum;
#endif
    /* DRAWBUFFERS:0 */
    gl_FragData[0] = vec4(col, 1.0);
}
#endif
