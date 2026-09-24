# Anarchy: a short documentary

A 2 minute 43 second animated mini-documentary in the style of Fern: low-poly 3D sets, fog, slow camera moves, chapter cards, location captions and a calm narrator. It explains the idea behind the game: the international system as anarchy.

| | Chapter | Set |
|---|---|---|
| Cold open | | A night sea of island houses, each one fencing itself in |
| I | No One Above | A relief map of Europe in 1648: the Thirty Years' War, Westphalia, the emperor's crown lifting away, states drifting apart |
| II | The Dilemma | Two fortresses across a river raising walls in turn (Jervis, 1978) |
| III | The Balance | Five great-power pillars on a world map; one rises and the rest link up against it (Waltz, 1979) |
| IV | Midnight | Trinity at dawn, then the Doomsday Clock (Schelling, 1966) |
| Close | | Back to the sea, lighthouses sweeping, and the end card |

## Build

```bash
cd video
npm install
pip install piper-tts numpy imageio-ffmpeg
npm run build      # narration → score and mix → frames → build/anarchy.mp4
```

The steps can also be run separately:

- `python3 narrate.py` speaks `script.json` with the Piper voice `en-us-ryan-high` (downloaded on first run) and writes `build/narration.wav` and `build/timeline.json`. Every cut, caption and animation is timed from this timeline, so you can edit the script and the film re-times itself.
- `python3 score.py` synthesizes the ambient score (pads, felt piano, booms on the cards, a ticking clock), ducks it under the voice, and writes `build/mix.wav`.
- `node render.mjs` renders `scene.html` frame by frame in headless Chromium (SwiftShader WebGL) and encodes 1080p24 H.264 with ffmpeg. Options: `--stills 12,40,90` writes single frames to `build/stills/`, `--from 30 --to 45` renders a preview section, `--workers N` sets the number of parallel browsers.

Every frame is a pure function of time (`window.seek(t)` in `src/main.js`), so workers render separate ranges and the segments are joined afterwards. The sets are in `src/worlds.js`, the bloom, tone mapping, grade and grain pass in `src/lib.js`, and the on-screen type in `src/overlay.css`. The maps come from Natural Earth via `world-atlas`.
