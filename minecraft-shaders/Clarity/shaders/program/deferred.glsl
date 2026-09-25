// RT pass 1: trace diffuse rays through the voxel world for sky light,
// sunlight bounce and emissive surfaces, then accumulate over time.
//   out: colortex0  passthrough (keeps loaders that ignore RENDERTARGETS safe)
//        colortex10 GI (rgb) + history length (a)
//        colortex8  same, kept for next frame
//        colortex9  linear depth + view normal, kept for next frame
#include "/lib/settings.glsl"

varying vec2 texcoord;

#ifdef VSH
void main() {
    texcoord = gl_MultiTexCoord0.xy;
    gl_Position = ftransform();
}
#endif

#ifdef FSH
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"
#include "/lib/distort.glsl"

uniform sampler2D colortex0;
uniform sampler2D colortex1;
uniform sampler2D colortex2;
uniform sampler2D colortex8;
uniform sampler2D colortex9;
uniform sampler2D depthtex0;
uniform mat4 gbufferPreviousModelView;
uniform mat4 gbufferPreviousProjection;
uniform vec3 previousCameraPosition;
uniform int frameCounter;

#if defined RT_GI && defined OVERWORLD
uniform sampler2DShadow shadowtex0;
uniform mat4 shadowModelView;
uniform mat4 shadowProjection;

float shadowAt(vec3 playerPos) {
    vec3 sc = (shadowProjection * (shadowModelView * vec4(playerPos, 1.0))).xyz;
    vec3 p = distortShadow(sc) * 0.5 + 0.5;
    if (p.x <= 0.0 || p.x >= 1.0 || p.y <= 0.0 || p.y >= 1.0 || p.z >= 1.0) return 1.0;
    return shadow2D(shadowtex0, vec3(p.xy, p.z - 0.0003)).x;
}
#include "/lib/voxel.glsl"
#endif

void main() {
    float depth = texture2D(depthtex0, texcoord).r;
    vec4 mat = texture2D(colortex2, texcoord);
    // Skip sky, the hand, and entities (moving things keep raster ambient,
    // so they never show ghosting or 1-sample noise).
    bool valid = abs(mat.g - 0.5) < 0.1 && mat.r < 0.5 && mat.b < 0.5 && depth < 1.0;

    vec3 gi = vec3(0.0);
    float histLen = 0.0;
    vec3 viewPos = screenToView(texcoord, depth);
    float linDepth = -viewPos.z;
    vec2 normalEnc = texture2D(colortex1, texcoord).xy;

#if defined RT_GI && defined OVERWORLD
    if (valid) {
        vec4 data = texture2D(colortex1, texcoord);
        vec3 nView = decodeNormal(normalEnc);
        vec3 n = normalize(mat3(gbufferModelViewInverse) * nView);
        float lmSky = data.b;
        vec3 playerPos = (gbufferModelViewInverse * vec4(viewPos, 1.0)).xyz;

        vec3 amb = ambientColor();
        vec3 sunCol = directLightColor();
        vec3 L = lightDirWorld();
        float skyPrior = smoothstep(0.05, 0.60, lmSky);

        vec3 T = normalize(abs(n.y) < 0.99 ? cross(n, vec3(0.0, 1.0, 0.0)) : cross(n, vec3(1.0, 0.0, 0.0)));
        vec3 B = cross(n, T);
        vec3 origin = playerToGrid(playerPos + n * 0.05);
        float frame = float(frameCounter - (frameCounter / 256) * 256);

        vec3 traced = vec3(0.0);
        for (int r = 0; r < RT_RAYS; r++) {
            float n1 = ign(gl_FragCoord.xy + 5.588238 * frame + float(r) * 17.31);
            float n2 = ign(gl_FragCoord.yx + 3.141592 * frame + float(r) * 7.77 + 41.0);
            // Cosine-weighted hemisphere direction.
            float phi = n1 * 6.2831853;
            float s = sqrt(n2);
            vec3 dir = normalize(T * (cos(phi) * s) + B * (sin(phi) * s) + n * sqrt(max(1.0 - n2, 0.0)));

            vec3 hitPos, hitN;
            uint voxel;
            bool leftGrid;
            vec3 sampleL;
            if (traceVoxels(origin, dir, RT_DISTANCE, n1 + frame, hitPos, hitN, voxel, leftGrid)) {
                sampleL = voxelRadiance(voxel, hitPos, hitN, sunCol, amb, L);
            } else if (leftGrid) {
                // Ran off the voxel grid: fall back to the raster estimate.
                sampleL = amb * lmSky * lmSky;
            } else {
                // Open air for RT_DISTANCE: sky, trusting vanilla sky light so
                // rays in a deep cave don't find one.
                sampleL = atmosphere(dir) * 0.70 * skyPrior;
            }
            // Clamp single-sample outliers (bright emitters) to kill fireflies.
            traced += sampleL * min(1.0, 3.0 / max(luma(sampleL), 1e-3));
        }
        traced /= float(RT_RAYS);

        // Fade to the raster estimate near the edge of the voxel grid.
        vec3 a = abs(playerPos);
        float edge = max(a.x, max(a.y, a.z));
        float inGrid = 1.0 - smoothstep(float(VOXEL_RADIUS) - 18.0, float(VOXEL_RADIUS) - 4.0, edge);
        float faceShade = 0.78 + 0.22 * n.y;
        gi = mix(amb * lmSky * lmSky * faceShade, traced, inGrid);

        // Temporal accumulation with reprojection and a depth test.
        vec3 prevPlayer = playerPos + cameraPosition - previousCameraPosition;
        vec4 prevView = gbufferPreviousModelView * vec4(prevPlayer, 1.0);
        vec4 prevClip = gbufferPreviousProjection * prevView;
        vec2 prevUV = prevClip.xy / prevClip.w * 0.5 + 0.5;
        histLen = 1.0;
        if (prevUV.x > 0.0 && prevUV.x < 1.0 && prevUV.y > 0.0 && prevUV.y < 1.0) {
            vec4 prevData = texture2D(colortex9, prevUV);
            float expected = -prevView.z;
            vec3 prevN = decodeNormal(prevData.gb);
            vec3 prevNExpected = mat3(gbufferPreviousModelView) * n;
            if (abs(prevData.r - expected) < expected * 0.02 + 0.05 && dot(prevN, prevNExpected) > 0.9) {
                vec4 hist = texture2D(colortex8, prevUV);
                if (hist.a > 0.0 && dot(hist.rgb, vec3(1.0)) < 1e4) {
                    histLen = min(hist.a + 1.0, float(RT_HISTORY));
                    gi = mix(hist.rgb, gi, 1.0 / histLen);
                }
            }
        }
    }
#endif

    /* RENDERTARGETS: 0,10,8,9 */
    gl_FragData[0] = texture2D(colortex0, texcoord);
    gl_FragData[1] = vec4(gi, histLen);
    gl_FragData[2] = vec4(gi, histLen);
    gl_FragData[3] = vec4(valid ? linDepth : -1.0, normalEnc, 1.0);
}
#endif
