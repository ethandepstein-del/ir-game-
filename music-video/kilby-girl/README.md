# Kilby Girl — music video + master

Music video for **"Kilby Girl" by The Bed Heads**, animated as a three-ink risograph print
(yellow, fluorescent pink, blue) and drawn "on twos" (12 drawings a second). Every shot is
code: `scenes.mjs` is the shot list, driven by beats, kicks, snares and accents measured from
the song.

The audio and video files are not in the repo.

## Pipeline

```sh
pip install numpy scipy soundfile librosa pyloudnorm numba
npm install && ./fetch-fonts.sh

# 1. master the mix (tonal EQ, de-ess, width, glue, soft clip, true-peak limiter)
python3 master.py mix.wav master            # -> master_24bit.wav, master_16bit.wav

# 2. measure the song: beats, drum hits, accents, per-frame energy
python3 features.py master_24bit.wav features.json

# 3. check shots as stills, then render (frames are split across CPU cores)
FEATURES=features.json node preview.mjs out/sheet.png 12 45 70 130 --scale 0.4 --cols 2
node render.mjs --features features.json --audio master_24bit.wav --out kilby_girl.mp4
```

`render.mjs` writes a near-lossless master (CRF 14, about 700 MB); re-encode it for delivery.

## Layout

| File | What it does |
| --- | --- |
| `master.py` | Measurement-driven mastering chain, targets -11.5 LUFS / -1 dBTP |
| `features.py` | Beat grid, kick/snare/accent times and per-frame energy -> `features.json` |
| `lib/ink.mjs` | Riso compositor: density drums -> rotated halftone screens -> ink overprint on paper |
| `lib/world.mjs`, `lib/people.mjs`, `lib/extras.mjs` | Scenery, characters, photos, confetti, type |
| `scenes.mjs` | Song map and shot list |
| `render.mjs` / `preview.mjs` | Parallel renderer / contact-sheet previews |

## Song map

| Time | Section | Shots |
| --- | --- | --- |
| 0:00 | Intro | Title over the Wasatch, letters stamped on the beat |
| 0:12 | Verse 1 | She walks to the show; flyer fence, "SLAP!" |
| 0:38 | Stop-time | One camera flash per stab; photos pile up, then zoom into the last one |
| 1:01 | Chorus 1 | The band under string lights; drums; the crowd |
| 1:25 | Verse 2 | Close-ups in the bokeh, then zine panels |
| 1:58 | Break | Lights out, one swinging bulb |
| 2:03 | Chorus 2 | Two-bar cuts: stage, circle pit, crowd, confetti |
| 2:27 | Breakdown | Darkroom: photos develop on each hit |
| 2:49 | Build | Tilt up through the lights; comet rides the riser |
| 3:03 | Final | Fireworks, hit montage, marquee, crowd-surf, pit |
| 3:45 | Outro stops | Flash-frozen photos of the night |
| 3:57 | Ring-out | Walking home; end card |
