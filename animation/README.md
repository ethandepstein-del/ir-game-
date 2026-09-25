# Ball Test

A 15-second animation built entirely from code: no stock footage, no samples, no textures. It's the classic first exercise every animator does, a bouncing ball, and the ball lands in a different art style on every bounce. Each cut is hidden inside the impact frame.

| Time | World | What happens |
|---|---|---|
| 0.0–2.0 | **Pencil test** | A pencil draws the ball on animation paper (peg holes, field guide, timing chart), taps it into motion. On 24s with a boiling line, onion skins, a "squash!" note. Camera starts close and pulls back. |
| 2.0–3.5 | **Cel cartoon** | 1950s palette, sunburst sky, ink outlines, cel shading, smear frames on the takeoff, dust puffs, kinetic "BOING!". |
| 3.5–5.0 | **Cut paper** | Stop-motion diorama on 12s: layered paper with real drop shadows, shallow depth of field, a paper ball on a brass split pin, pop-up flowers, confetti. |
| 5.0–6.5 | **8-bit** | 240×135 in a 16-colour palette, hard-pixel upscale and a CRT pass. The ball headbutts a bonus block for three coins. |
| 6.5–9.5 | **3D chrome** | An analytic ray tracer in a WebGL2 shader: chrome ellipsoid (true squash & stretch), lacquer floor, studio softboxes, shockwave rings, sparks, a camera that swings from the 2D side view into 3D. Speed ramp into slow motion as cracks glow. |
| 9.5–15.0 | **Finale** | Impact frames, ~900 tumbling chrome shards swarm into the word "Claude", slam into type, light sweep. The ball drops in as the full stop and flickers through every style on its last little bounces. |

Everything runs on one 160 bpm grid, so every cut lands on a beat. The soundtrack is synthesized with WebAudio from oscillators, filtered noise and a generated reverb impulse. Each world has its own sound palette: pencil scratches and a metronome, a jaw-harp boing and slide whistle, paper crunches and kalimba, pulse-wave chiptune, struck-steel hits and a sidechained synth bass, a glass shatter, a chord hit. The mix goes through a compressor, a limiter and a soft clipper.

## Files

- `index.html`: the player; open it through any static server and press play.
- `out/ball-test.html`: a single self-contained file (code and fonts inlined) that plays anywhere.
- `out/ball-test.mp4`: the rendered 1920×1080 60fps video with audio.
- `src/core.js`: timing grid, easing, the shared ball physics (one gravity, squash & stretch), camera shake.
- `src/worlds/*.js`: one module per style.
- `src/audio.js`: the score and sound design.
- `render.mjs`: headless Chromium renderer (parallel workers, motion blur by sub-frame accumulation) plus ffmpeg mux.

## Commands

```bash
npm install
npm run render                  # frames + audio → out/ball-test.mp4 (ffmpeg from $FFMPEG or imageio-ffmpeg)
npm run stills -- 2.0,6.5,11    # PNG stills at given times → .stills/
npm run audio                   # soundtrack only → out/ball-test.wav
npm run build                   # single-file player → out/ball-test.html
```

Every frame is a pure function of time, so any frame can be rendered in any order. That's what lets the renderer split the work across processes.
