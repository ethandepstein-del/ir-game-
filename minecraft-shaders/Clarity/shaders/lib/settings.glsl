/*
 * Clarity shader settings.
 * Every "#define NAME value // [..]" line here shows up in the in-game
 * shader options menu (OptiFine and Iris both read this file).
 * Defaults are tuned for an RTX 5080 class GPU at a locked 120 fps.
 */

// ---------------------------------------------------------------- shadows
const int   shadowMapResolution = 2048; // [1024 1536 2048 3072 4096]
const float shadowDistance      = 128.0; // [64.0 80.0 96.0 112.0 128.0 160.0 192.0 256.0]
const float shadowDistanceRenderMul = 1.0;
const float sunPathRotation     = -25.0; // [-40.0 -35.0 -30.0 -25.0 -20.0 -15.0 -10.0 0.0 10.0 20.0 30.0]
const bool  shadowHardwareFiltering0 = true;
const float ambientOcclusionLevel = 0.65; // [0.0 0.25 0.5 0.65 0.75 1.0]
// Light-at-eye smoothing (caves, underwater): vanilla default is 10 s.
const float eyeBrightnessHalflife = 1.0;

#define SHADOWS
#define PCSS
#define COLORED_SHADOWS
#define SHADOW_SOFTNESS 1.0 // [0.5 0.75 1.0 1.5 2.0 3.0]
#define SHADOW_SAMPLES 8 // [4 8 12 16 24]
#define SHADOW_DISTORT 0.85
#define ENTITY_SHADOWS

// ---------------------------------------------------------------- lighting
#define SUN_BRIGHTNESS 1.00 // [0.60 0.70 0.80 0.90 1.00 1.10 1.20 1.30 1.50]
#define AMBIENT_BRIGHTNESS 1.00 // [0.60 0.70 0.80 0.90 1.00 1.10 1.20 1.30 1.50]
#define BLOCKLIGHT_BRIGHTNESS 1.00 // [0.60 0.70 0.80 0.90 1.00 1.10 1.20 1.30 1.50]
#define BLOCKLIGHT_R 1.00 // [0.80 0.90 1.00]
#define BLOCKLIGHT_G 0.62 // [0.50 0.55 0.62 0.70 0.80 0.90 1.00]
#define BLOCKLIGHT_B 0.34 // [0.20 0.27 0.34 0.45 0.60 0.80 1.00]
#define MIN_LIGHT 0.030 // [0.0 0.010 0.020 0.030 0.040 0.060 0.080]
#define NIGHT_BRIGHTNESS 1.00 // [0.50 0.75 1.00 1.25 1.50 2.00]
#define EMISSIVE_STRENGTH 1.00 // [0.0 0.50 0.75 1.00 1.50 2.00]
#define FOLIAGE_SSS
#define SSAO
#define SSAO_STRENGTH 1.00 // [0.50 0.75 1.00 1.25 1.50]
#define WET_SURFACES

// ---------------------------------------------------------------- world
#define WAVING_PLANTS
#define WAVING_LEAVES
#define WAVING_SPEED 1.00 // [0.50 0.75 1.00 1.25 1.50]
#define WAVING_AMOUNT 1.00 // [0.25 0.50 0.75 1.00 1.25 1.50]

// ---------------------------------------------------------------- water
#define WATER_WAVES
#define WATER_REFRACTION
#define SSR
#define CAUSTICS
#define WATER_CLARITY 1.00 // [0.50 0.75 1.00 1.25 1.50 2.00 3.00]
#define WATER_TEXTURE 0.25 // [0.0 0.15 0.25 0.35 0.50 0.75 1.00]
#define WAVE_HEIGHT 1.00 // [0.25 0.50 0.75 1.00 1.25 1.50 2.00]
#define WAVE_SPEED 1.00 // [0.50 0.75 1.00 1.25 1.50]
#define WATER_FOAM
#define RAIN_RIPPLES
#define WATER_SSS
#define UNDERWATER_VIEW 48.0 // [16.0 24.0 32.0 48.0 64.0 96.0]

// ---------------------------------------------------------------- atmosphere
#define FOG_START 0.70 // [0.40 0.50 0.60 0.70 0.80 0.90]
#define HAZE 1.00 // [0.0 0.50 1.00 1.50 2.00]
#define RAIN_OPACITY 0.55 // [0.20 0.35 0.55 0.75 1.00]
#define CLOUDS
#define CLOUD_SHADOWS
#define CLOUD_SHADOW_STRENGTH 0.45 // [0.20 0.30 0.45 0.60 0.75]
#define CLOUD_COVERAGE 0.50 // [0.25 0.35 0.45 0.50 0.55 0.65 0.75]
#define CLOUD_OPACITY 0.90 // [0.0 0.40 0.60 0.80 0.90 1.00]
#define CLOUD_HEIGHT 240.0 // [192.0 220.0 240.0 280.0 320.0 400.0]
#define STAR_BRIGHTNESS 1.00 // [0.0 0.50 1.00 1.50 2.00]
#define SUN_SIZE 1.00 // [0.50 0.75 1.00 1.50 2.00]
#define VOLUMETRIC_LIGHT
#define VL_STRENGTH 1.00 // [0.25 0.50 0.75 1.00 1.50 2.00]
#define VL_STEPS 10 // [8 10 12 16 24]

// ---------------------------------------------------------------- camera / post
#define AUTO_EXPOSURE
#define NIGHT_SHIFT
#define EXPOSURE 1.00 // [0.60 0.70 0.80 0.90 1.00 1.10 1.20 1.30 1.50]
#define CAVE_ADAPTATION 1.80 // [1.00 1.40 1.80 2.20 2.60]
#define SATURATION 1.06 // [0.80 0.90 1.00 1.03 1.06 1.10 1.15 1.20 1.30]
#define CONTRAST 1.00 // [0.90 0.95 1.00 1.05 1.10]
#define BLOOM
#define BLOOM_STRENGTH 0.06 // [0.02 0.04 0.06 0.08 0.12 0.16]
#define FXAA
#define SHARPEN 0.25 // [0.0 0.15 0.25 0.40 0.60]

// ---------------------------------------------------------------- ray tracing (Iris, 1.18+)
//#define RT_GI
#define RT_RAYS 1 // [1 2]
#define RT_DISTANCE 32.0 // [16.0 24.0 32.0 48.0 64.0]
#define RT_HISTORY 10 // [4 6 8 10 12 16 24 32]
#define RT_GI_STRENGTH 1.00 // [0.50 0.75 1.00 1.25 1.50 2.00]
#define RT_REFLECTIONS
