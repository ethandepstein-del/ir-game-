// Cloud options. Included from atmosphere.glsl; the option syntax is the
// same as settings.glsl so OptiFine and Iris both list these in the menu.
#ifndef CLARITY_CLOUD_SETTINGS
#define CLARITY_CLOUD_SETTINGS 1

// Raymarched 3D cumulus (Iris only: marched once per frame in the prepare
// pass at reduced resolution). Off, or on OptiFine, the flat layer is used.
#define VOLUMETRIC_CLOUDS
// Resolution divisor of the cloud march: 1 = full, 2 = half, 4 = quarter.
#define CLOUD_RES 2 // [1 2 3 4]
// Samples along each view ray through the cloud slab.
#define CLOUD_STEPS 24 // [12 16 20 24 32 40 48 64]
// Samples toward the sun from each view sample (self-shadowing).
#define CLOUD_LIGHT_STEPS 4 // [2 3 4 5 6 8]
// Blend each frame's jittered march with the last few (sky only, no ghosting on terrain).
#define CLOUD_TEMPORAL
// Height of the cumulus slab, starting 50 blocks under CLOUD_HEIGHT.
#define CLOUD_THICKNESS 130.0 // [80.0 100.0 130.0 160.0 200.0]
#define CLOUD_DENSITY 1.00 // [0.50 0.75 1.00 1.25 1.50 2.00]
#define CLOUD_SPEED 1.00 // [0.0 0.50 1.00 1.50 2.00 3.00]
// How far out the march reaches (blocks); farther clouds melt into the haze anyway.
#define CLOUD_DISTANCE 7000.0 // [3000.0 5000.0 7000.0 10000.0]

#endif
