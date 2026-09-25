// Voxel world for ray tracing. The shadow pass writes every terrain block
// within VOXEL_RADIUS of the camera into a 3D image (rgb = albedo,
// a = material); the lighting passes march rays through it.
// Requires common.glsl.

#define VOXEL_RADIUS 64
#define VOXEL_SIZE 128

#define VOXEL_SOLID    1.00
#define VOXEL_EMISSIVE 0.60
#define VOXEL_LEAVES   0.30

// Camera-relative player position -> voxel grid position (continuous).
vec3 playerToGrid(vec3 playerPos) {
    return playerPos + fract(cameraPosition) + float(VOXEL_RADIUS);
}
vec3 gridToPlayer(vec3 gridPos) {
    return gridPos - fract(cameraPosition) - float(VOXEL_RADIUS);
}
bool insideGrid(vec3 g) {
    return all(greaterThanEqual(g, vec3(0.0))) && all(lessThan(g, vec3(float(VOXEL_SIZE))));
}

#ifndef VOXEL_WRITE
uniform sampler3D voxelSampler;

vec4 readVoxel(vec3 cell) {
    return texture3D(voxelSampler, (cell + 0.5) / float(VOXEL_SIZE));
}

// Grid-space DDA. Returns true on a hit; hitPos is the entry point and
// hitNormal the face that was crossed.
bool traceVoxels(vec3 origin, vec3 dir, float maxDist, float noise,
                 out vec3 hitPos, out vec3 hitNormal, out vec4 voxel) {
    hitPos = origin;
    hitNormal = vec3(0.0);
    voxel = vec4(0.0);
    vec3 cell = floor(origin);
    vec3 stepDir = sign(dir);
    vec3 invDir = 1.0 / max(abs(dir), vec3(1e-5));
    vec3 tMax = (stepDir * (cell - origin) + stepDir * 0.5 + 0.5) * invDir;
    float t = 0.0;

    for (int i = 0; i < 96; i++) {
        vec3 axis;
        if (tMax.x < tMax.y && tMax.x < tMax.z) axis = vec3(1.0, 0.0, 0.0);
        else if (tMax.y < tMax.z) axis = vec3(0.0, 1.0, 0.0);
        else axis = vec3(0.0, 0.0, 1.0);

        t = dot(tMax, axis);
        if (t > maxDist) return false;
        cell += stepDir * axis;
        tMax += invDir * axis;
        if (!insideGrid(cell)) return false;

        vec4 v = readVoxel(cell);
        if (v.a > 0.1) {
            // Leaves let some rays through, so canopies are dappled.
            if (v.a < 0.45 && hash13(cell + noise * 17.0) < 0.45) continue;
            hitPos = origin + dir * t;
            hitNormal = -stepDir * axis;
            voxel = v;
            return true;
        }
    }
    return false;
}
#endif

#ifndef VOXEL_WRITE
// Light leaving a voxel face that a ray hit. Needs shadowAt(playerPos)
// declared before this file is included.
vec3 voxelRadiance(vec4 voxel, vec3 gridHit, vec3 n, vec3 sunCol, vec3 amb, vec3 L) {
    vec3 albedo = toLinear(voxel.rgb);
    if (abs(voxel.a - VOXEL_EMISSIVE) < 0.1) return albedo * 4.0 * EMISSIVE_STRENGTH;
    vec3 p = gridToPlayer(gridHit + n * 0.05);
    float sun = max(dot(n, L), 0.0);
    if (sun > 0.0) sun *= shadowAt(p) * cloudShadow(p + cameraPosition, L);
    return albedo * (sunCol * sun + amb * 0.25);
}
#endif
