# Kilby Girl — music video + master

Music video for The Bed Heads' cover of **"Kilby Girl"** (The Backseat Lovers), animated as a
three-ink risograph print (yellow, fluorescent pink, blue). Every shot is code: `seq/` holds the
shot list, one file per song section, driven by the song's beats, downbeats, drum hits, accents, the vocal envelope and
word-timed lyrics. The band (Noah, Brooks, Belle, Ethan) are drawn in `lib/band.mjs`.

The audio and video files are not in the repo.

## Pipeline

```sh
pip install numpy scipy soundfile librosa pyloudnorm numba onnxruntime sherpa-onnx
npm install && ./fetch-fonts.sh

# 1. master the mix (tonal EQ, de-ess, width, glue, soft clip, true-peak limiter)
python3 master.py mix.wav master -11.5 0.0 --outro 223.5          # -> master_24bit.wav

# 2. measure the song: beats, drum hits, accents, per-frame energy
python3 features.py master_24bit.wav features.json
python3 separate.py Kim_Vocal_2.onnx master_24bit.wav vocals.wav instrumental.wav
python3 beats.py features.json                                    # two-tempo beat + downbeat grid

# 3. lyrics: transcribe the vocal (Whisper via sherpa-onnx), then time every word
python3 lyrics_align.py vocals.wav sherpa-onnx-whisper-turbo draft.json
python3 lyrics_timing.py vocals.wav lines.json lyrics.json ctc_dir  # lines.json: corrected text + windows
python3 merge_features.py features.json features_v4.json --lyrics lyrics.json [--perf perf.json]
# merge lyrics.json into features.json under "lyrics", and the vocal envelope under "vocal"

# 4. check shots as stills, then render (frames are split across CPU cores)
FEATURES=features.json node preview.mjs out/sheet.png 12 45 70 130 --scale 0.4 --cols 2
node render.mjs --features features_v4.json --audio master_24bit.wav --out kilby_girl.mp4 --fps 60 --cache cache/
```

Models: `Kim_Vocal_2.onnx` from the UVR model repo and `sherpa-onnx-whisper-turbo` from the
sherpa-onnx `asr-models` release, both on GitHub. The lyric text is the song publisher's, so it is
not kept in this repo; `features.json` and the lyric files stay local.

`render.mjs` draws every frame (`--fps 60` for the final) and writes a near-lossless master; re-encode it
for delivery. `--range t0:t1` renders an excerpt; `--cache dir` keeps 2-second chunks so `--redo t0:t1`
re-renders only what changed. `SPEC.md` is the v4 plan.

## Layout

| File | What it does |
| --- | --- |
| `master.py` | Measurement-driven mastering chain, targets -11.5 LUFS / -1 dBTP; `--outro` eases it after the vocals stop |
| `features.py`, `beats.py` | Beat/downbeat grid, drum hits, accents and per-frame energy -> `features.json` |
| `separate.py` | MDX-Net vocal/instrumental split with onnxruntime (no torch) |
| `lyrics_align.py`, `lyrics_timing.py` | Transcribe sung lines, then put every word on a syllable onset |
| `lib/ink.mjs` | Riso compositor: density drums -> rotated halftone screens -> ink overprint on paper |
| `lib/band.mjs` | The four band members (rigs for standing players and the singing drummer) |
| `lib/lyrics.mjs` | Lyric typography: stamped words, letters on a wire, handwriting, typewriter captions, flyers |
| `lib/world.mjs`, `lib/people.mjs`, `lib/extras.mjs` | Scenery, the girl, crowd, photos, fireworks, the bedroom |
| `seq/*.mjs` | One file per section; `seq/timeline.mjs` joins them with beat-placed transitions |
| `lib/fx.mjs`, `lib/perf.mjs` | Hit-shaped rhythm, camera and transition helpers; per-hit performance queries for the band |
| `render.mjs` / `preview.mjs` | Parallel renderer / contact-sheet previews |

## Song map

| Time | Section | Shots and lyrics |
| --- | --- | --- |
| 0:00 | Intro | Title over the Wasatch, letters stamped on the beat |
| 0:12 | Verse 1 | The walk: words on the telephone wire, then the rain slams in |
| 0:19 | The ride | His car pulls up, the door springs open on the downbeat; streetlights pass every two beats |
| 0:28 | The fence | The next line pasted up as flyers; she raises her camera |
| 0:38 | Hook | Her camera roll: a photo per stab, the camera snaps to each; punch words slam; cuts to Noah |
| 1:01 | Break | A new angle every bar; the band plays the measured hits |
| 1:25 | Verse 2 | Close on her, flicking through her photos (all of Noah), then the zine pages |
| 1:58 | Lights out | One swinging bulb |
| 2:03 | Hook | A cut every bar; lines on the back wall, the pit floor and the crowd's phones |
| 2:27 | Breakdown | Darkroom: photos develop on each hit |
| 2:49 | Build | Tilt up through the lights; the comet becomes the first firework on the drop |
| 3:03 | Final | Fireworks on the hits, half-bar montage, the marquee cut every bar, crowd-surf, pit |
| 3:45 | Outro stops | Flash-frozen photos of the night |
| 3:58 | Ring-out | Walking home; end card |
