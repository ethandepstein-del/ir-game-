// Voxel world for ray tracing (GLSL 4.30 programs only). The shadow pass
// writes every terrain block within VOXEL_RADIUS of the camera into a
// 3D R32UI image. Each face writes a packed value with imageAtomicMax, so
// the result is deterministic: the face with the most sky light wins
// (a grass block reads as its green top), then block light, then colour.
//   bits 28-31 sky light (0-15), 24-27 block light (0-15),
//        21-23 material, 0-20 albedo RGB7 (gamma)
// Requires common.glsl (and atmosphere.glsl for the radiance helpers).

#define VOXEL_RADIUS 64
#define VOXEL_SIZE 128

#define MAT_SOLID      1u
#define MAT_LEAVES     2u
#define MAT_EMIT       3u   // full light blocks: glowstone, lava, lanterns...
#define MAT_EMIT_SMALL 4u   // torches, candles, end rods: partial coverage

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

uint packVoxel(vec3 albedo, uint material, float sky, float block) {
    uvec3 c = uvec3(clamp(albedo, 0.0, 1.0) * 127.0 + 0.5);
    uint s = uint(clamp(sky, 0.0, 1.0) * 15.0 + 0.5);
    uint b = uint(clamp(block, 0.0, 1.0) * 15.0 + 0.5);
    return (s << 28u) | (b << 24u) | (material << 21u) | (c.r << 14u) | (c.g << 7u) | c.b;
}
uint voxelMaterial(uint v) { return (v >> 21u) & 7u; }
float voxelSky(uint v) { return float(v >> 28u) / 15.0; }
float voxelBlock(uint v) { return float((v >> 24u) & 15u) / 15.0; }
vec3 voxelAlbedo(uint v) {
    return vec3(float((v >> 14u) & 127u), float((v >> 7u) & 127u), float(v & 127u)) / 127.0;
}

#ifndef VOXEL_WRITE
uniform usampler3D voxelSampler;

// Grid-space DDA. Returns true on a hit (hitPos = entry point, hitNormal =
// face crossed). leftGrid reports a ray that ran off the voxel grid, as
// opposed to one that reached maxDist in open air.
bool traceVoxels(vec3 origin, vec3 dir, float maxDist, float noise,
                 out vec3 hitPos, out vec3 hitNormal, out uint voxel, out bool leftGrid) {
    hitPos = origin;
    hitNormal = vec3(0.0);
    voxel = 0u;
    leftGrid = false;
    vec3 cell = floor(origin);
    vec3 stepDir = sign(dir);
    vec3 invDir = 1.0 / max(abs(dir), vec3(1e-5));
    vec3 tMax = (stepDir * (cell - origin) + stepDir * 0.5 + 0.5) * invDir;
    int maxSteps = int(maxDist * 1.8) + 4;

    for (int i = 0; i < 128; i++) {
        if (i >= maxSteps) break;
        vec3 axis;
        if (tMax.x < tMax.y && tMax.x < tMax.z) axis = vec3(1.0, 0.0, 0.0);
        else if (tMax.y < tMax.z) axis = vec3(0.0, 1.0, 0.0);
        else axis = vec3(0.0, 0.0, 1.0);

        float t = dot(tMax, axis);
        if (t > maxDist) return false;
        cell += stepDir * axis;
        tMax += invDir * axis;
        if (!insideGrid(cell)) { leftGrid = true; return false; }

        uint v = texelFetch(voxelSampler, ivec3(cell), 0).r;
        uint m = voxelMaterial(v);
        if (m != 0u) {
            float h = hash13(cell + noise * 17.0);
            // Leaves and small lights only cover part of their cell.
            if (m == MAT_LEAVES && h < 0.45) continue;
            if (m == MAT_EMIT_SMALL && h < 0.70) continue;
            hitPos = origin + dir * t;
            hitNormal = -stepDir * axis;
            voxel = v;
            return true;
        }
    }
    return false;
}

// Light leaving a voxel face that a ray hit. Needs shadowAt(playerPos)
// declared before this file is included.
// skyCap limits the voxel's sky light: a voxel stores the sky light of its
// brightest face, so the underside of a one-block cave ceiling would read
// as open sky. Vanilla sky light drops one level per block, so the face a
// ray reached through air can't be much brighter than the ray's origin.
vec3 voxelRadianceCapped(uint v, vec3 gridHit, vec3 n, vec3 sunCol, vec3 amb, vec3 L, float skyCap) {
    vec3 albedo = toLinear(voxelAlbedo(v));
    uint m = voxelMaterial(v);
    if (m == MAT_EMIT || m == MAT_EMIT_SMALL) return albedo * 4.0 * EMISSIVE_STRENGTH;
    vec3 p = gridToPlayer(gridHit + n * 0.05);
    float sun = max(dot(n, L), 0.0);
    if (sun > 0.0) sun *= shadowAt(p) * cloudShadow(p + cameraPosition, L);
    float sky = min(voxelSky(v), skyCap);
    // Torch-lit surfaces bounce their block light too (same curve as the
    // raster block light in lighting.glsl).
    float bl = voxelBlock(v);
    vec3 block = blockLightColor() * (bl * bl * bl * 0.85 + bl * 0.08) * (1.0 + bl * bl * bl * bl);
    return albedo * (sunCol * sun + amb * (sky * sky) * (0.78 + 0.22 * n.y) + block + MIN_LIGHT);
}
vec3 voxelRadiance(uint v, vec3 gridHit, vec3 n, vec3 sunCol, vec3 amb, vec3 L) {
    return voxelRadianceCapped(v, gridHit, n, sunCol, amb, L, 1.0);
}
#endif
