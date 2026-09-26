# Kilby Girl — v4 spec

v4 rebuilds the video around one rainy night: Noah (drums and lead vocal) gives the Kilby Girl a
ride to his band's show at Kilby Court, spends the set trying to work her out, and finds out in
the darkroom that she was watching him the whole time. It keeps the three-ink riso look and the
beat-locked lyric typography, and it answers the client's v3 notes:

| Note | v4 answer |
| --- | --- |
| Punchier, faster, exactly on the beat | Cut every bar in hooks, every half bar in the loudest lines and the finale. All motion is hit-shaped (`lib/fx.mjs`), and cuts land on downbeats or measured hits. The band is driven by per-hit performance data (`perf.py`, `lib/perf.mjs`). |
| Confirm the lyrics online | Lines checked against published lyrics, missing lines added, every word re-timed. Lines carry stable ids (`v1_1`, `h1_2`, ...). |
| Noah looks nothing like him, too feminine | New Noah: a big, broad young man with short dark curls, a strong jaw and heavy brows. No blush or lip tint on any of the guys. |
| The master is rough at the end, where the vocals stop | Outro-only rework of the clip/limit stage; the rest of the master nulls against v3. |
| The dots get in the way (keep them) | Dots stay as texture in shading and backgrounds; faces, lyrics and hero shapes print clean. |

## Story and shot plan

The lyric text is the publisher's, so it is never written into this repo. Scenes pull words at
runtime with `LY.line(id).words`. Times are seconds; bars are about 1.45 s (166.7 BPM) until the
metric modulation at 183.59 s, then 1.78 s (134.7 BPM).

| Range | File (owner) | Plan |
| --- | --- | --- |
| 0–12.5 | `seq/intro.mjs` (S1) | The gig poster printing: three riso passes (yellow, pink, blue) on the bars, title letters stamped on beats, then push into the poster's night. |
| 12.5–38.7 | `seq/verse1.mjs` (S1) | Outside the venue, breath rising into words (v1_1). The rain slams in and his car pulls up (v1_2). Inside the car: wipers on every beat, her handwriting in the fogged window (v1_3). The drive, with streetlights passing on beats and words on road signs (v1_4). Arrival at Kilby Court, lights popping on per beat, her ID checked at the door. |
| 38.7–61.6 | `seq/hook1.mjs` (S2) | Inside the show, cutting every bar between the band and lyric vignettes: a whisper chain and a slammed "19", her ID card with a FAKE stamp, a nose-ring glint, the setlist, Noah singing, a detective corkboard with strings snapping on beats, sunglasses cool and crossed fingers. |
| 61.6–85.6 | `seq/break1.mjs` (S3) | Band showcase, driven by performance data: a hero moment per member, the kit from overhead, amps pumping. Her camera flash on Noah. |
| 85.6–123.0 | `seq/verse2.mjs` (S3) | After the show: the car hood over the city lights, her camera roll, his room, a lazy afternoon in time-lapse. Tension into hook 2. |
| 123.0–147.4 | `seq/hook2.mjs` (S2) | Hook 1's motifs escalated and faster, with full-frame kinetic type on the punch words, the pit and confetti. |
| 147.4–183.6 | `seq/bridge.mjs` (S4) | The darkroom: her photos develop on the hits, and they are all of him. Then the build: outside, the rocket climbing to the drop. |
| 183.6–225.5 | `seq/finale.mjs` (S4) | Fireworks on the drop; the finale set at half-bar cuts; she crowd-surfs; the pit; kinetic type for the final lines. |
| 225.5–247.5 | `seq/outro.mjs` (S4) | The night's photos land on the stabs. The ring-out: she looks back over her shoulder. The end card prints like the intro. |

`seq/stage.mjs` (S3) is Kilby Court's stage, band and crowd, shared by every show shot.
`seq/car.mjs` (S1) is Noah's car, shared by verse 1, verse 2 and the outro. The lead owns
`seq/common.mjs`, `seq/girl.mjs`, `seq/stills.mjs`, `seq/songmap.mjs` and `seq/timeline.mjs`.

## Conventions

**Shots.** A shot is `shot(P, S, opts)` drawing a full 1920x1080 frame. It must be a pure
function of `S`: no state across frames, and any frame renders alone. Sequence files export
`SHOTS = [[start, end, shot, opts?, transitionIn?], ...]` and optionally `FLASHES` (paper
flashes) and `NO_PUNCH` (ranges without the global downbeat punch). Shots draw with bleed
(about ±200 px), because cameras shake and whip. They must also render for about 0.6 s past
their end time, because a whip into the next shot draws the outgoing shot at later times.

**S** (built by `makeS` in `seq/common.mjs`):
- `t`
- `E` (arrangement energy)
- `bp` (beat position) and `barPos`
- `bf` (boil frame on the eighth notes)
- hit pulses `kick`, `snare`, `acc`, `crash`
- envelopes `high`, `rms` and `vocal`
- `perf`: drum limbs, strums, bass notes, visemes, fills, energy
- `t0`, `t1`, `lt`: shot start, end and local time

**Rhythm** (`lib/fx.mjs`). Use hit-shaped envelopes (`hit`, `antic`, `spring`, `pop`, `pump`),
not sines, for anything that moves on the music. For extra snap, hold poses on twos (`hold`).
Transitions (`whip`, `tear`, `iris`, `slam`, `wipe`) go in a shot's transitionIn and sit on
downbeats or on the end of a drum fill.

**Lyrics.**
- Every sung word appears on its sung time (`w.t`), and the word being sung is "hot" (`hot(w, t)`).
- Lines live in the world (smoke, fogged glass, signs, ID fields, index cards, walls, floors). Words marked `emph` get a kinetic slam.
- Keep words readable: on screen for at least 0.5 s, and at least 80 px tall for a primary lyric at 1080p.
- Keep them clear of faces, 80 px inside the frame edge, and in solid ink on paper or paper on solid ink.
- Pull text from `LY` at runtime and never hard-code lyric text.

**Look.**
- Three inks, as densities [yellow, pink, blue]; see `K` in `lib/world.mjs`.
- Flat shapes with one or two shading tones.
- Faces, lyrics and hero shapes print clean; dots live in shading, glows and backgrounds.
- Linework boils on the eighth notes (`bf`).

**Performance.** Frame draw time stays under about 250 ms at 1080p, so the 1080p60 final
(14,850 frames) renders in about an hour on 4 cores.

## Data

`$SP` is the session scratchpad; none of these files are committed.

| File | Made by |
| --- | --- |
| `$SP/v4/features.json` | `merge_features.py`: base features, plus `perf`, plus the v4 lyrics |
| `$SP/v4/perf/perf.json` | `perf.py` |
| `$SP/v4/lyrics/lyrics.json`, `.srt`, `.vtt` | `lyrics_timing.py` |
| `$SP/v4/audio/master_v4_24bit.wav` | `master.py` (outro rework) |

## Review loop

Drafts render at half resolution, per sequence and then whole. Four reviewers mark them up:
a director/editor (story, rhythm, cuts), an animator (acting, arcs, timing, sync), a typographer
(lyric legibility and craft) and an audio engineer (master and sync). Their notes go back to
the owners. The loop repeats until the reviews are down to nitpicks. The final render is
1920x1080 at 60 fps, plus a phone version under 30 MB.
