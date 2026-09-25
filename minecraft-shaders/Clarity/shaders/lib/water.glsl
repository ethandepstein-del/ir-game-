// Water surface shape, rain ripples and caustics. Requires common.glsl.

vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

// Sum of exponential-sine waves: sharp crests, broad troughs. Each wave
// drags the sample point along its slope, which bunches smaller waves on
// the crests of larger ones, like real wind-driven water.
float waveHeight(vec2 p, int octaves) {
    float t = frameTimeCounter * WAVE_SPEED;
    float seed = 0.0;
    float freq = 0.50;
    float speed = 1.35;
    float weight = 1.0;
    float sum = 0.0;
    float sumW = 0.0;
    for (int i = 0; i < 16; i++) {
        if (i >= octaves) break;
        vec2 d = vec2(sin(seed), cos(seed));
        float x = dot(d, p) * freq + t * speed;
        float wave = exp(sin(x) - 1.0);
        float slope = -wave * cos(x);
        p += d * slope * weight * 0.38 / freq;
        sum += wave * weight;
        sumW += weight;
        weight *= 0.84;
        freq *= 1.20;
        speed *= 1.07;
        seed += 1232.399963;
    }
    return sum / sumW;
}

// Expanding rings where raindrops land (returns a slope to add).
vec2 rainRipples(vec2 p) {
    vec2 grad = vec2(0.0);
    float t = frameTimeCounter;
    for (int layer = 0; layer < 2; layer++) {
        vec2 q = p * (1.0 + float(layer) * 0.7) + float(layer) * 7.3;
        vec2 cell = floor(q);
        for (int x = -1; x <= 1; x++) {
            for (int y = -1; y <= 1; y++) {
                vec2 c = cell + vec2(float(x), float(y));
                vec2 h = hash22(c);
                float phase = fract(t * 0.9 + h.x);
                vec2 d = q - (c + h);
                float dist = length(d);
                float r = phase * 0.9;
                float ring = sin((dist - r) * 30.0) * smoothstep(0.18, 0.0, abs(dist - r)) * (1.0 - phase) * (1.0 - phase);
                grad += d / max(dist, 1e-3) * ring;
            }
        }
    }
    return grad * 0.35;
}

// World-space normal of the water surface at world XZ, seen from dist.
vec3 waterNormal(vec2 p, float dist) {
#ifdef WATER_WAVES
    // Fewer octaves and softer slopes far away keep distant water calm.
    int octaves = int(mix(14.0, 5.0, smoothstep(8.0, 72.0, dist)));
    float height = 0.42 * WAVE_HEIGHT * (1.0 + OVERCAST * 0.6) * mix(1.0, 0.45, smoothstep(16.0, 96.0, dist));
    const float e = 0.06;
    float h0 = waveHeight(p, octaves);
    float hx = waveHeight(p + vec2(e, 0.0), octaves);
    float hz = waveHeight(p + vec2(0.0, e), octaves);
    vec2 slope = vec2(hx - h0, hz - h0) / e * height;
#ifdef RAIN_RIPPLES
    if (RAIN > 0.01 && dist < 48.0) slope += rainRipples(p) * RAIN * (1.0 - dist / 48.0);
#endif
    return normalize(vec3(-slope.x, 1.0, -slope.y));
#else
    return vec3(0.0, 1.0, 0.0);
#endif
}

// Caustics: bright lines where the edges of animated Voronoi cells meet,
// the web pattern that sunlight focused by waves draws on the floor.
float caustics(vec2 p) {
    float t = frameTimeCounter * 0.55 * WAVE_SPEED;
    float c = 0.0;
    // Domain warp bends the cell edges into organic curves.
    p *= 0.62;
    p += vec2(vnoise(p * 0.7 + t * 0.2), vnoise(p * 0.7 - t * 0.2 + 5.2)) * 0.9;
    for (int layer = 0; layer < 2; layer++) {
        vec2 q = p * (1.0 + float(layer) * 0.45) + vec2(3.1, 1.7) * float(layer);
        vec2 i = floor(q);
        vec2 f = fract(q);
        float d1 = 8.0;
        float d2 = 8.0;
        for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
                vec2 g = vec2(float(x), float(y));
                vec2 o = 0.5 + 0.45 * sin(t * (1.0 + 0.3 * float(layer)) + 6.2831853 * hash22(i + g));
                float d = length(g + o - f);
                if (d < d1) { d2 = d1; d1 = d; }
                else if (d < d2) d2 = d;
            }
        }
        c += exp(-(d2 - d1) * 18.0);
    }
    return c * c * 0.45;
}
