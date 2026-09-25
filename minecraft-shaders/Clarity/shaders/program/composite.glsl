// Pass 0: screen-space ambient occlusion (raw, blurred in composite1).
#include "/lib/settings.glsl"

/*
const int colortex0Format = RGBA16F;
const int colortex1Format = RGBA16;
const int colortex2Format = RGBA8;
const int colortex3Format = RGBA16F;
const int colortex4Format = RGBA8;
const int colortex5Format = RGBA16F;
const int colortex6Format = RGBA16F;
const bool colortex6Clear = false;
const int colortex7Format = RGBA8;
const int colortex8Format = RGBA16F;
const bool colortex8Clear = false;
const int colortex9Format = RGBA16F;
const bool colortex9Clear = false;
const int colortex10Format = RGBA16F;
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
uniform sampler2D colortex1;
uniform sampler2D colortex2;
uniform sampler2D depthtex1;

void main() {
    float ao = 1.0;
    float depth = texture2D(depthtex1, texcoord).r;
    vec3 P = screenToView(texcoord, depth);

#if defined SSAO && !(defined RT_GI && defined OVERWORLD)
    vec4 mat = texture2D(colortex2, texcoord);
    bool valid = abs(mat.g - 0.5) < 0.1 && mat.r < 0.5 && depth < 1.0;
    if (valid) {
        vec3 N = decodeNormal(texture2D(colortex1, texcoord).xy);
        float phi = ign(gl_FragCoord.xy) * 6.2831853;
        vec3 T = normalize(abs(N.y) < 0.99 ? cross(N, vec3(0.0, 1.0, 0.0)) : cross(N, vec3(1.0, 0.0, 0.0)));
        vec3 B = cross(N, T);
        const float radius = 0.85;
        float occ = 0.0;
        for (int i = 0; i < 8; i++) {
            float r = sqrt((float(i) + 0.5) / 8.0);
            float th = float(i) * 2.39996323 + phi;
            vec2 disk = r * vec2(cos(th), sin(th));
            float h = sqrt(max(1.0 - r * r, 0.0));
            float scale = mix(0.25, 1.0, float(i) / 7.0);
            vec3 S = P + (T * disk.x + B * disk.y + N * (h + 0.1)) * radius * scale;
            vec3 s = viewToScreen(S);
            if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) continue;
            float sceneZ = screenToView(s.xy, texture2D(depthtex1, s.xy).r).z;
            float range = smoothstep(0.0, 1.0, radius / max(abs(P.z - sceneZ), 1e-3));
            occ += (sceneZ >= S.z + 0.02 ? 1.0 : 0.0) * range;
        }
        ao = 1.0 - occ / 8.0;
        ao = pow(ao, 1.6 * SSAO_STRENGTH);
    }
#endif

    /* DRAWBUFFERS:5 */
    gl_FragData[0] = vec4(ao, -P.z, 0.0, 1.0);
}
#endif
