// Prepare pass (Iris; runs after the shadow pass, before any terrain):
// raymarches the volumetric clouds once per sky direction into colortex11.
//
// The march runs at 1/CLOUD_RES resolution into the lower-left corner of a
// full-size buffer (fragments outside that corner are discarded), so it
// does not depend on size.buffer / viewport-scaling behaviour.
// gbuffers_skybasic upsamples the corner with a 4-tap bicubic filter.
//
// colortex11: rgb = cloud light (premultiplied, HDR), a = cloud coverage.
// With CLOUD_TEMPORAL the march start is jittered each frame and blended
// with the reprojected previous result (sky directions only, so nothing on
// terrain can ghost).
/*
const int colortex11Format = RGBA16F;
const bool colortex11Clear = false;
*/
#include "/lib/settings.glsl"
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"

varying vec3 ambCol;    // per-frame constants, computed on the 4 quad vertices
varying vec3 lightCol;
varying vec3 lightDir;

#ifdef VSH
void main() {
    ambCol = ambientColor();
    lightCol = cloudLightColor();
    lightDir = cloudLightDir();
    gl_Position = ftransform();
}
#endif

#ifdef FSH
#if defined IS_IRIS && defined CLOUDS && defined VOLUMETRIC_CLOUDS && defined OVERWORLD
uniform sampler2D colortex11;
uniform int frameCounter;
uniform mat4 gbufferPreviousModelView;
uniform mat4 gbufferPreviousProjection;
uniform vec3 previousCameraPosition;

void main() {
    vec2 screen = vec2(viewWidth, viewHeight);
    vec2 lowSize = ceil(screen / float(CLOUD_RES));
    if (gl_FragCoord.x > lowSize.x || gl_FragCoord.y > lowSize.y) discard;

    vec2 uv = gl_FragCoord.xy / lowSize;
    vec3 viewDir = normalize(screenToView(uv, 1.0));
    vec3 dir = normalize(mat3(gbufferModelViewInverse) * viewDir);

#ifdef CLOUD_TEMPORAL
    float frame = float(frameCounter - (frameCounter / 1024) * 1024);
    float jitter = fract(ign(gl_FragCoord.xy) + frame * 0.618034);
#else
    float jitter = ign(gl_FragCoord.xy);
#endif

    vec4 cl = cloudOver(cloudsVolumetric(dir, ambCol, lightCol, lightDir, jitter),
                        cirrus(dir, ambCol, lightCol));

#ifdef CLOUD_TEMPORAL
    // Clouds are hundreds of blocks away: reproject by direction only.
    vec3 prevView = mat3(gbufferPreviousModelView) * dir;
    vec4 prevClip = gbufferPreviousProjection * vec4(prevView, 0.0);
    if (prevClip.w > 1e-4) {
        vec2 prevUv = prevClip.xy / prevClip.w * 0.5 + 0.5;
        if (prevUv.x > 0.0 && prevUv.x < 1.0 && prevUv.y > 0.0 && prevUv.y < 1.0) {
            vec2 texel = clamp(prevUv * lowSize, vec2(0.5), lowSize - 0.5) / screen;
            vec4 hist = texture2D(colortex11, texel);
            // Fast flight means real parallax on nearby clouds: trust history less.
            float moved = length(cameraPosition - previousCameraPosition);
            float w = 0.85 * (1.0 - smoothstep(0.5, 4.0, moved));
            bool valid = hist == hist && hist.a >= 0.0 && hist.a <= 1.0 && dot(hist.rgb, vec3(1.0)) < 6e4;
            if (valid) cl = mix(cl, hist, w);
        }
    }
#endif

    /* RENDERTARGETS: 11 */
    gl_FragData[0] = cl;
}
#else
// OptiFine / other dimensions / clouds off: nothing to do.
void main() {
    discard;
    /* RENDERTARGETS: 11 */
    gl_FragData[0] = vec4(0.0);
}
#endif
#endif
