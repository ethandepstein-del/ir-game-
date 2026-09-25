# Clarity: a Minecraft shader pack

A shader pack that looks good without getting in the way of play. It's tuned so an RTX 5080 holds a locked 120 fps on Lunar Client with room to spare. It works on both of Lunar's shader paths:

- **1.8.9 / 1.12** (OptiFine shaders)
- **1.16 to 1.21+** (Sodium + Iris shaders)

## What it looks like

- **Sun and moon shadows:** soft, filtered shadows, sharp near you and softer farther away. Sunlight through stained glass casts coloured shadows.
- **Analytic sky:** blue days, warm sunsets and cool blue nights. The distance fog uses the same sky colour, so the horizon blends in with no visible seam.
- **Water:** clear and lightly tinted, with gentle waves, sky reflections that grow at shallow angles (Fresnel), and a sun glint that shadows block.
- **Warm torch light:** torches and lanterns throw warm pools of light, and bright blocks (glowstone, lava, lanterns, froglights) glow softly.
- **Wind:** grass, flowers, crops and leaves sway gently. Plants stay still indoors and underground.
- **Light shafts and bloom:** subtle god rays at sunrise and sunset, and a light filmic bloom.
- **Filmic tonemap (ACES), FXAA and contrast-limited sharpening:** no ghosting, because there is no TAA.

## What it deliberately leaves out, for gameplay

- No motion blur, depth of field, vignette, chromatic aberration or lens flares.
- **Caves are never pitch black.** A minimum-light floor applies where there is no sky light, and exposure rises when you go underground. You can still see cave walls and mobs, and the mood stays.
- **Nights stay readable:** moonlight is blue and fairly bright.
- **Clear underwater view:** about 48 blocks, and the vanilla underwater overlay is off.
- **Rain is lighter** (55% opacity), and fog only starts near your render distance.
- The block outline, hurt flash, creeper flash, night vision and blindness all behave as in vanilla.
- A **Competitive** profile turns off wind, light shafts and bloom for PvP.

## Install on Lunar Client

1. Download `dist/Clarity.zip` from this folder.
2. Launch Lunar and open a world.
   - **1.8.9:** Options → Video Settings → Shaders.
   - **Modern versions:** Lunar settings → Shaders (Iris). Enable shader support if Lunar asks.
3. Click **Shaders Folder** and drop `Clarity.zip` into it. Don't unzip it.
4. Select **Clarity**. The default profile, **RTX 5080 (120 fps)**, is already selected.

Go to **Shader Options** to adjust anything. Every setting has a readable name, and the menu is split into Lighting, Shadows, Wind, Water, Sky & Fog and Camera.

## Settings for a locked 120 fps

Minecraft is almost always limited by the CPU, not the GPU. A 5080 runs this pack's GPU work in a few milliseconds, so these settings matter most:

| Setting | Value |
| --- | --- |
| Max framerate (Lunar / Video Settings) | **120**, or your monitor's refresh rate if higher |
| VSync | **Off** (cap the frame rate instead) |
| Render distance | **12 to 16 chunks** (1.8.9: 12) |
| Simulation distance (modern) | 8 to 10 |
| Clouds | Fancy |
| Mipmap levels | 4 |
| Fast Render (OptiFine 1.8.9) | Off (it doesn't work with shaders) |
| RAM allocated in the Lunar launcher | 4 GB for 1.8.9, 6 to 8 GB for modern versions |
| NVIDIA Control Panel → Power management | Prefer maximum performance |
| NVIDIA Control Panel → Low latency mode | On |

Shadows cost CPU as well as GPU, because the world is drawn a second time from the sun's view. If you ever drop below 120 fps in heavy areas, lower **Shadow Distance** (112 → 96) first. Next, switch to the **Balanced** profile. The **Cinematic** profile (4096 shadows, 192 blocks) is for screenshots.

## Profiles

| Profile | Shadows | Extras |
| --- | --- | --- |
| Competitive | 1536 px, 80 blocks, 4 samples | No wind, rays, bloom or coloured shadows. Brighter caves. |
| Balanced | 2048 px, 96 blocks | Everything on |
| **RTX 5080 (default)** | 2048 px, 112 blocks, 8 samples | Everything on |
| Cinematic | 4096 px, 192 blocks, 16 samples | Everything on |

## Layout

```
Clarity/shaders/
  lib/settings.glsl      every user option (this is what the menu reads)
  lib/common.glsl        uniforms, day/night colours, sky model, fog
  lib/lighting.glsl      shadow filtering and the surface lighting model
  lib/waving.glsl        wind
  lib/distort.glsl       shadow-map distortion
  program/*.glsl         the actual programs (each has VSH and FSH halves)
  *.vsh / *.fsh          generated stubs: overworld
  world-1/ world1/       generated stubs: Nether / End
  block.properties       which blocks sway, glow or are water
  shaders.properties     menu layout, profiles, pipeline flags
  lang/en_US.lang        option names
tools/build.py           regenerates stubs, validates, zips
```

After editing, run:

```bash
python3 tools/build.py --check   # compiles all 126 stages with glslangValidator, then zips
```

Rendering is forward: each surface is lit and fogged as it is drawn, into one HDR buffer. There are only three screen passes after that: `composite` (light shafts), `composite1` (bloom from the mip chain, exposure, tonemap, grade) and `final` (FXAA, sharpen, dither). The pipeline stays short on purpose, which keeps frame times steady.
