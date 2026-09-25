# Ball Test

A 15-second animation built entirely from code: no stock footage, no samples, no textures. It's the classic first exercise every animator does, a bouncing ball. The ball changes art style every time it lands on a new surface, and each new style ripples out from the point of contact.

## Physics

One deterministic rigid-body simulation (`src/physics.js`) drives the ball through every world, stepped at 4800 Hz:

- **Gravity** at 9.81 m/s² for a 24 cm ball (700 px per metre).
- **Soft contact:** a spring–damper whose stiffness and damping come from each surface's coefficient of restitution. Squash depth and contact time fall out of the impact speed, so small bounces squash less.
- **Coulomb friction** at the contact patch couples slip to spin. The ball picks up a real roll on its first bounce, and painted stripes, a turning construction cross or engraved grooves make that roll visible in every style.
- **Air drag** (quadratic) and a **damped shape-vibration mode** that rings after each contact.
- **Energy only comes from visible machines:** a pencil tap, a latched coil spring in a trap door, an accordion paper spring, a game spring block, and gravity on the chrome world's 4.5° slope. Bounces otherwise decay as restitution says they must.
- **A solver** tunes each launcher's spring (scan and bisection) so the key impacts land on the 160 bpm grid: 2.000 s, 2.750 s, 4.250 s and 5.1875 s.

| Time | World | What happens |
|---|---|---|
| 0.0–2.0 | **Pencil test** | A pencil draws the ball on animation paper and taps it at the solved release time. Two decaying bounces follow, with onion skins, a timing chart and the simulated path planned in blue. |
| 2.0–3.3 | **Cel cartoon** | The ball lands on a latched coil spring in a trap door. The latch lets go, the spring fires ("BOING!") and rings at its stop. Trees lean and ring when the ground takes a hit. |
| 3.3–4.8 | **Cut paper** | An accordion-folded paper spring pops the ball up. Pop-up flowers and confetti follow. |
| 4.8–5.8 | **8-bit** | A spring block launches the ball into a bonus block, which pays out three coins. |
| 5.8–9.5 | **3D chrome** | A ray-traced steel boule on a glossy slope: bounces shorten and quicken as gravity feeds it speed. The camera was placed exactly where the ball would be, and the ball hits the lens in slow motion. |
| 9.5–15.0 | **Finale** | The lens cracks and about 900 shards swarm into "Claude". The ball comes back as the full stop and flickers through every style on its last bounces. |

The soundtrack is synthesized with WebAudio and driven by the same simulation: each contact sounds at a level set by its impact speed, launchers twang and clank, and the chrome bounces ring higher as they shrink. Each world's groove runs on the shared 160 bpm grid.

The master is rendered at 120 fps with sub-frame motion blur; the 60 fps version is derived from it.

## Files

- `index.html`: the player; open it through any static server and press play.
- `out/ball-test.html`: a single self-contained file (code and fonts inlined) that plays anywhere.
- `out/ball-test-120fps.mp4`: the 1920×1080 120 fps master with audio.
- `out/ball-test.mp4`: the 60 fps version (pairs of 120 fps frames blended).
- `src/physics.js`: the ball simulation, launchers and beat solver.
- `src/core.js`: timing grid, easing, camera framing, shake.
- `src/worlds/*.js`: one module per style.
- `src/audio.js`: the score and sound design.
- `render.mjs`: headless Chromium renderer (parallel workers, motion blur by sub-frame accumulation) plus ffmpeg mux.

## Commands

```bash
npm install
npm run render                  # 120 fps frames + audio → out/ball-test.mp4 (ffmpeg from $FFMPEG or imageio-ffmpeg)
npm run stills -- 2.0,6.5,11    # PNG stills at given times → .stills/
npm run audio                   # soundtrack only → out/ball-test.wav
npm run build                   # single-file player → out/ball-test.html
```

Every frame is a pure function of time, so any frame can be rendered in any order. That's what lets the renderer split the work across processes.
