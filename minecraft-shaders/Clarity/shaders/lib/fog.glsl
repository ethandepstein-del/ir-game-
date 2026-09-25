// Fog and underwater extinction, applied in composite by depth.
// Requires common.glsl and atmosphere.glsl.

vec3 waterScatterColor(vec3 tint, float skyLevel) {
    vec3 light = ambientColor() * (skyLevel * skyLevel) * 0.55 + directLightColor() * 0.04 * skyLevel + MIN_LIGHT * 2.0;
    return tint * light;
}

// Absorption per block for water, shaped by the biome tint.
vec3 waterAbsorption(vec3 tint) {
    return (vec3(0.26, 0.070, 0.045) + (1.0 - tint) * 0.05) / WATER_CLARITY;
}

// viewPos: point in view space. sky: nothing was hit (open sky).
vec3 applyFog(vec3 col, vec3 viewPos, bool sky) {
    float dist = length(viewPos);
    vec3 dirW = mat3(gbufferModelViewInverse) * (viewPos / max(dist, 1e-4));

    if (isEyeInWater == 1) {
        float eyeSky = float(eyeBrightnessSmooth.y) / 240.0;
        vec3 tint = vec3(0.10, 0.38, 0.55);
        vec3 ext = vec3(1.7, 0.95, 0.75) * (2.6 / UNDERWATER_VIEW);
        vec3 T = exp(-ext * (sky ? UNDERWATER_VIEW * 2.0 : dist));
        col = col * T + waterScatterColor(tint, eyeSky) * (1.0 - T);
    } else if (isEyeInWater == 2) {
        col = mix(col, vec3(1.2, 0.35, 0.05), clamp(dist / 2.5, 0.0, 1.0));
    } else if (isEyeInWater == 3) {
        col = mix(col, vec3(0.7, 0.8, 0.9), clamp(dist / 2.5, 0.0, 1.0));
    } else if (!sky) {
#if defined OVERWORLD
        // Height haze: thicker low down, at dawn and in rain.
        float avgY = cameraPosition.y + dirW.y * dist * 0.5;
        float density = 0.0010 * HAZE * (1.0 + rainStrength * 4.0 + sunsetFactor() * 1.5)
                      * exp(-max(avgY - 63.0, 0.0) / 90.0);
        float T = exp(-density * dist);
        vec3 fogCol = atmosphere(dirW);
        col = col * T + fogCol * (1.0 - T);
        // Border fog hides chunk edges and matches the horizon exactly.
        float border = smoothstep(far * FOG_START, far, length(dirW.xz * dist));
        col = mix(col, fogCol, border);
#elif defined NETHER
        float f = smoothstep(far * 0.25, far, dist) * 0.85;
        col = mix(col, atmosphere(dirW), f);
#else
        float f = smoothstep(far * 0.45, far, dist);
        col = mix(col, atmosphere(dirW), f);
#endif
    }

    if (blindness > 0.0) {
        float f = sky ? 1.0 : smoothstep(1.5, 5.0, dist);
        col = mix(col, vec3(0.0), f * blindness);
    }
    return col;
}
