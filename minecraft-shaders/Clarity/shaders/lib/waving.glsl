// Gentle wind for plants and leaves. Kept small on purpose: it reads as
// "alive" without hiding blocks you want to click or look through.
#define ID_PLANT      10000.0
#define ID_LEAVES     10001.0
#define ID_PLANT_TOP  10002.0
#define ID_WATER      10008.0
#define ID_EMISSIVE   10010.0
#define ID_EMISSIVE_SMALL 10011.0

bool isId(float id, float target) { return abs(id - target) < 0.5; }

vec3 windOffset(vec3 worldPos, float amount) {
    float t = frameTimeCounter * WAVING_SPEED;
    float gust = sin(t * 0.55 + worldPos.x * 0.045 + worldPos.z * 0.035) * 0.35 + 0.75;
    vec3 o;
    o.x = sin(t * 1.9 + worldPos.x * 0.9 + worldPos.z * 0.4 + worldPos.y * 0.3);
    o.z = sin(t * 1.5 + worldPos.z * 0.8 - worldPos.x * 0.3 + 1.7);
    o.y = sin(t * 2.3 + worldPos.x + worldPos.z) * 0.2;
    return o * amount * gust * WAVING_AMOUNT * (1.0 + rainStrength * 0.8);
}

// Offset for a terrain vertex. topVertex: vertex is at the top of its texture.
vec3 waveVertex(vec3 worldPos, float id, bool topVertex, float skyLight) {
    float outdoors = smoothstep(0.35, 0.85, skyLight);
    if (outdoors <= 0.0) return vec3(0.0);
#ifdef WAVING_PLANTS
    if (isId(id, ID_PLANT) && topVertex) return windOffset(worldPos, 0.065) * outdoors;
    if (isId(id, ID_PLANT_TOP)) return windOffset(worldPos, topVertex ? 0.10 : 0.065) * outdoors;
#endif
#ifdef WAVING_LEAVES
    if (isId(id, ID_LEAVES)) return windOffset(worldPos, 0.028) * outdoors;
#endif
    return vec3(0.0);
}
