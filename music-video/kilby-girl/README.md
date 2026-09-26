# Kilby Girl — music video + master

Music video for The Bed Heads' cover of **"Kilby Girl"** (The Backseat Lovers), animated as a
three-ink risograph print (yellow, fluorescent pink, blue). Every shot is code: `scenes.mjs` is the
shot list, driven by the song's beats, downbeats, drum hits, accents, the vocal envelope and
word-timed lyrics. The band (Noah, Brooks, Belle, Ethan) are drawn in `lib/band.mjs`.

The audio and video files are not in the repo.

## Pipeline

```sh
pip install numpy scipy soundfile librosa pyloudnorm numba onnxruntime sherpa-onnx
npm install && ./fetch-fonts.sh

# 1. master the mix (tonal EQ, de-ess, width, glue, soft clip, true-peak limiter)
python3 master.py mix.wav master                                  # -> master_24bit.wav

# 2. measure the song: beats, drum hits, accents, per-frame energy
python3 features.py master_24bit.wav features.json
python3 separate.py Kim_Vocal_2.onnx master_24bit.wav vocals.wav instrumental.wav
python3 beats.py features.json                                    # two-tempo beat + downbeat grid

# 3. lyrics: transcribe the vocal (Whisper via sherpa-onnx), then time every word
python3 lyrics_align.py vocals.wav sherpa-onnx-whisper-turbo draft.json
python3 lyrics_timing.py vocals.wav lines.json lyrics.json         # lines.json: corrected text + windows
# merge lyrics.json into features.json under "lyrics", and the vocal envelope under "vocal"

# 4. check shots as stills, then render (frames are split across CPU cores)
FEATURES=features.json node preview.mjs out/sheet.png 12 45 70 130 --scale 0.4 --cols 2
node render.mjs --features features.json --audio master_24bit.wav --out kilby_girl.mp4
```

Models: `Kim_Vocal_2.onnx` from the UVR model repo and `sherpa-onnx-whisper-turbo` from the
sherpa-onnx `asr-models` release, both on GitHub. The lyric text is the song publisher's, so it is
not kept in this repo; `features.json` and the lyric files stay local.

`render.mjs` draws every frame at 30 fps and writes a near-lossless master; re-encode it for delivery.

## Layout

| File | What it does |
| --- | --- |
| `master.py` | Measurement-driven mastering chain, targets -11.5 LUFS / -1 dBTP |
| `features.py`, `beats.py` | Beat/downbeat grid, drum hits, accents and per-frame energy -> `features.json` |
| `separate.py` | MDX-Net vocal/instrumental split with onnxruntime (no torch) |
| `lyrics_align.py`, `lyrics_timing.py` | Transcribe sung lines, then put every word on a syllable onset |
| `lib/ink.mjs` | Riso compositor: density drums -> rotated halftone screens -> ink overprint on paper |
| `lib/band.mjs` | The four band members (rigs for standing players and the singing drummer) |
| `lib/lyrics.mjs` | Lyric typography: stamped words, letters on a wire, handwriting, typewriter captions, flyers |
| `lib/world.mjs`, `lib/people.mjs`, `lib/extras.mjs` | Scenery, the girl, crowd, photos, fireworks, the bedroom |
| `scenes.mjs` | Song map and shot list |
| `render.mjs` / `preview.mjs` | Parallel renderer / contact-sheet previews |

## Song map

| Time | Section | Shots and lyrics |
| --- | --- | --- |
| 0:00 | Intro | Title over the Wasatch, letters stamped on the beat |
| 0:12 | Verse 1 | Walk to the show: words hang on the telephone wire, stamp in the rain, chalk the sidewalk, then paste up as flyers |
| 0:38 | Hook | One camera flash per stab; each photo captioned in marker with the words sung over it |
| 1:01 | Break | The band, one close-up each |
| 1:25 | Verse 2 | Close-ups, then zine panels with typewritten captions |
| 1:58 | Lights out | One swinging bulb |
| 2:03 | Hook | Two-bar cuts; lines on the back wall, the pit floor and the crowd's phones |
| 2:27 | Breakdown | Darkroom: photos develop on each hit |
| 2:49 | Build | Tilt up through the lights; the comet becomes the first firework on the drop |
| 3:03 | Final | Fireworks on the hits, half-bar montage, marquee, crowd-surf, pit |
| 3:45 | Outro stops | Flash-frozen photos of the night |
| 3:58 | Ring-out | Walking home; end card |
