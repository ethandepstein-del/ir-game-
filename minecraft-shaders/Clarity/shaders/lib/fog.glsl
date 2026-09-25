// Fog and underwater extinction, applied in composite by depth.
// Requires common.glsl and atmosphere.glsl.

// amb/sun: ambientColor()/directLightColor(), hoisted by the caller.
vec3 waterScatterColor(vec3 tint, float skyLevel, vec3 amb, vec3 sun) {
    vec3 light = amb * (skyLevel * skyLevel) * 0.55 + sun * 0.04 * skyLevel + MIN_LIGHT * 2.0;
    return tint * light;
}

// Absorption per block for water, shaped by the biome tint.
vec3 waterAbsorption(vec3 tint) {
    return (vec3(0.20, 0.060, 0.042) + (1.0 - tint) * 0.05) / WATER_CLARITY;
}

// viewPos: point in view space. sky: nothing was hit (open sky).
vec3 applyFog(vec3 col, vec3 viewPos, bool sky, vec3 amb, vec3 sun) {
    float dist = length(viewPos);
    vec3 dirW = mat3(gbufferModelViewInverse) * (viewPos / max(dist, 1e-4));

    if (isEyeInWater == 1) {
        float eyeSky = float(eyeBrightnessSmooth.y) / 240.0;
        vec3 tint = vec3(0.10, 0.38, 0.55);
        // Same water as seen from above, stretched to the chosen view range.
        vec3 ext = waterAbsorption(tint) * (32.0 / UNDERWATER_VIEW);
        vec3 T = exp(-ext * (sky ? UNDERWATER_VIEW * 2.0 : dist));
        col = col * T + waterScatterColor(tint, eyeSky, amb, sun) * (1.0 - T);
    } else if (isEyeInWater == 2) {
        col = mix(col, vec3(1.2, 0.35, 0.05), clamp(dist / 2.5, 0.0, 1.0));
    } else if (isEyeInWater == 3) {
        col = mix(col, vec3(0.7, 0.8, 0.9), clamp(dist / 2.5, 0.0, 1.0));
    } else if (!sky) {
#if defined OVERWORLD
        // Height haze: thicker low down, at dawn and in rain.
        float avgY = cameraPosition.y + dirW.y * dist * 0.5;
        float density = 0.0005 * HAZE * (1.0 + rainStrength * 4.0 + sunsetFactor() * 0.8)
                      * exp(-max(avgY - 63.0, 0.0) / 90.0);
        // No sky-coloured haze inside caves.
        density *= smoothstep(0.1, 0.6, float(eyeBrightnessSmooth.y) / 240.0);
        float T = exp(-density * dist);
        // Horizon colour for anything below it: no dark band at the world edge.
        // Sky colour a little above the horizon: bluer, less milky haze, and
        // no dark band at the world edge.
        vec3 fogCol = atmosphere(normalize(vec3(dirW.x, max(dirW.y, 0.06), dirW.z)));
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
