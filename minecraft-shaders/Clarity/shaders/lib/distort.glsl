// Shadow-map distortion: spends more texels near the player.
// Must be identical in the shadow pass and in every lookup.
vec3 distortShadow(vec3 p) {
    float f = length(p.xy) * SHADOW_DISTORT + (1.0 - SHADOW_DISTORT);
    return vec3(p.xy / f, p.z * 0.2);
}
