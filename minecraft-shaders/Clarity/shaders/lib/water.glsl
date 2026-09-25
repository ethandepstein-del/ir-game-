// Water surface shape and caustics, shared by gbuffers_water and composite.

// Layered swells with analytic gradients; returns a world-space normal.
vec3 waterNormal(vec2 p) {
    float t = frameTimeCounter;
    vec2 grad = vec2(0.0);
    vec2 d; float f, a, ph;
    d = normalize(vec2( 1.0,  0.35)); f = 0.55; a = 0.030; ph = dot(d, p) * f + t * 1.10; grad += d * f * a * cos(ph);
    d = normalize(vec2(-0.6,  1.0 )); f = 0.90; a = 0.020; ph = dot(d, p) * f + t * 1.45; grad += d * f * a * cos(ph);
    d = normalize(vec2( 0.2, -1.0 )); f = 1.70; a = 0.010; ph = dot(d, p) * f + t * 1.90; grad += d * f * a * cos(ph);
    d = normalize(vec2(-1.0, -0.4 )); f = 2.90; a = 0.006; ph = dot(d, p) * f + t * 2.60; grad += d * f * a * cos(ph);
    // Fine ripples from noise.
    vec2 q = p * 2.2 + vec2(t * 0.35, t * 0.22);
    float e = 0.05;
    float h0 = vnoise(q);
    grad += vec2(vnoise(q + vec2(e, 0.0)) - h0, vnoise(q + vec2(0.0, e)) - h0) / e * 0.012;
    return normalize(vec3(-grad.x, 1.0, -grad.y));
}

// Bright, sharp network of light lines on the floor under water.
float caustics(vec2 p) {
    float t = frameTimeCounter * 0.6;
    float c = 0.0;
    for (int i = 0; i < 2; i++) {
        vec2 q = p * (0.55 + float(i) * 0.37) + vec2(t, -t * 0.7) * (1.0 + float(i) * 0.4);
        float n = vnoise(q) * 0.65 + vnoise(q * 2.1 + 3.7) * 0.35;
        c += pow(1.0 - abs(n * 2.0 - 1.0), 7.0);
    }
    return c * 0.5;
}
