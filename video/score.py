"""Synthesize an ambient score and mix it under the narration.

Slow minor-key pads, sparse felt-piano notes, low booms on the title and
chapter cards, a ticking clock in the nuclear chapter, all run through a
long synthetic reverb and ducked under the voice. Writes build/mix.wav.
"""

import json
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
BUILD = HERE / "build"
SR = 48000
rng = np.random.default_rng(7)


def hz(note: str) -> float:
    names = {"C": -9, "D": -7, "E": -5, "F": -4, "G": -2, "A": 0, "B": 2}
    n = names[note[0]] + (1 if "#" in note else -1 if note[1] == "b" else 0)
    octave = int(note[-1])
    return 440 * 2 ** ((n + 12 * (octave - 4)) / 12)


def read_wav(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path)) as w:
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
        return pcm.astype(np.float32) / 32768, w.getframerate()


def resample(x: np.ndarray, src: int, dst: int) -> np.ndarray:
    n = int(len(x) * dst / src)
    return np.interp(np.arange(n) * src / dst, np.arange(len(x)), x).astype(np.float32)


def env(n: int, attack: float, release: float) -> np.ndarray:
    e = np.ones(n, dtype=np.float32)
    a, r = int(attack * SR), int(release * SR)
    e[:a] = np.linspace(0, 1, a) ** 2
    if r:
        e[-r:] *= np.linspace(1, 0, r) ** 2
    return e


def pad(freqs: list[float], dur: float) -> np.ndarray:
    """A soft, slowly breathing chord: detuned sines with a few partials."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n, dtype=np.float32)
    for f in freqs:
        for detune in (-0.12, 0.0, 0.13):
            ph = rng.uniform(0, 2 * np.pi)
            ff = f * 2 ** (detune / 12)
            lfo = 1 + 0.25 * np.sin(2 * np.pi * rng.uniform(0.05, 0.12) * t + ph)
            for k, amp in ((1, 1.0), (2, 0.28), (3, 0.1)):
                out += (amp * lfo * np.sin(2 * np.pi * ff * k * t + ph * k)).astype(np.float32)
    return out / (len(freqs) * 6) * env(n, min(4.0, dur / 3), min(5.0, dur / 3))


def piano(f: float, dur: float = 5.0) -> np.ndarray:
    """A felt-piano-ish note: a soft hammer and inharmonic partials that die away."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n, dtype=np.float32)
    for k, amp in ((1, 1.0), (2, 0.42), (3, 0.16), (4, 0.08), (5, 0.04)):
        fk = f * k * (1 + 0.0004 * k * k)
        out += amp * np.exp(-t * (0.9 + 0.7 * k)) * np.sin(2 * np.pi * fk * t)
    hammer = rng.normal(0, 1, n) * np.exp(-t * 180) * 0.04
    return ((out + hammer) * np.minimum(t / 0.012, 1)).astype(np.float32) * 0.5


def boom(dur: float = 6.0) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 30 + 34 * np.exp(-t * 3)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 0.9)
    noise = rng.normal(0, 1, n)
    rumble = np.convolve(noise, np.ones(240) / 240, mode="same") * np.exp(-t * 1.4) * 2.5
    return ((body + rumble) * np.minimum(t / 0.02, 1)).astype(np.float32) * 0.9


def tick(strength: float = 1.0) -> np.ndarray:
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    click = rng.normal(0, 1, n) * np.exp(-t * 400)
    tone = np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 90) * 0.5
    return ((click + tone) * 0.18 * strength).astype(np.float32)


def reverb(x: np.ndarray, seconds: float = 4.5, wet: float = 0.45) -> np.ndarray:
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.normal(0, 1, n) * np.exp(-t * 6.9 / seconds)
    ir = np.convolve(ir, np.ones(6) / 6, mode="same")  # darken the tail
    ir[: int(0.02 * SR)] = 0
    ir /= np.sqrt(np.sum(ir ** 2))
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
    return ((1 - wet) * x + wet * y * 0.9).astype(np.float32)


def place(track: np.ndarray, clip: np.ndarray, at: float, gain: float = 1.0) -> None:
    i = int(at * SR)
    if i < 0:
        clip, i = clip[-i:], 0
    if i >= len(track):
        return
    j = min(len(track), i + len(clip))
    track[i:j] += clip[: j - i] * gain


# Chords per scene (low to high), and the piano motif that drifts above them.
CHORDS = {
    "open": [["D2", "A2", "F3"], ["Bb1", "F2", "D3"]],
    "title": [["D2", "A2", "D3", "F3"]],
    "westphalia": [["F2", "C3", "A3"], ["C2", "G2", "E3"], ["D2", "A2", "F3"], ["Bb1", "F2", "D3"]],
    "dilemma": [["D2", "A2", "F3"], ["E2", "Bb2", "G3"], ["D2", "A2", "F3"]],
    "balance": [["Bb1", "F2", "D3"], ["F2", "C3", "A3"], ["G2", "D3", "Bb3"], ["A1", "E2", "C#3"]],
    "midnight": [["D2", "Ab2", "F3"], ["D2", "A2", "F3"]],
    "close": [["Bb1", "F2", "D3"], ["F2", "C3", "A3"], ["C2", "G2", "E3"], ["D2", "A2", "F3"]],
    "end": [["D2", "A2", "D3", "F3"]],
}
MOTIF = ["A4", "F4", "D4", "E4", "F4", "C4", "D4", "A3"]


def main() -> None:
    timeline = json.loads((BUILD / "timeline.json").read_text())
    total = timeline["duration"] + 1.0
    n = int(total * SR)
    music = np.zeros(n, dtype=np.float32)
    hits = np.zeros(n, dtype=np.float32)

    motif_i = 0
    for scene in timeline["scenes"]:
        start, end = scene["start"], scene["end"]
        chords = CHORDS[scene["id"]]
        step = (end - start) / len(chords)
        for i, chord in enumerate(chords):
            # Overlap chords so they crossfade.
            place(music, pad([hz(c) for c in chord], step + 4), start + i * step - 1, 0.9)
        # Sparse piano: one note every few seconds, quiet in the nuclear chapter.
        if scene["id"] not in ("title", "midnight"):
            t = start + 1.5
            while t < end - 2:
                place(music, piano(hz(MOTIF[motif_i % len(MOTIF)])), t, 0.22)
                motif_i += 1
                t += 3.2 + (motif_i % 3) * 0.8
        if scene.get("chapter") or scene["id"] in ("title", "end"):
            place(hits, boom(), start + 0.25, 0.55)
        if scene["id"] == "midnight":
            # A clock ticking, getting slightly louder, stopping at the end.
            t = start + 4.0
            while t < end - 0.5:
                place(hits, tick(0.6 + 0.6 * (t - start) / (end - start)), t, 1.0)
                t += 1.0

    music = reverb(music, 5.0, 0.5)
    hits = reverb(hits, 3.5, 0.3)

    voice, vsr = read_wav(BUILD / "narration.wav")
    voice = resample(voice, vsr, SR)[:n]
    voice = np.pad(voice, (0, n - len(voice)))

    # Duck the music under the voice with a smoothed envelope follower.
    level = np.abs(voice)
    win = int(0.35 * SR)
    level = np.convolve(level, np.ones(win) / win, mode="same")
    duck = 1 - 0.45 * np.clip(level / 0.04, 0, 1)
    duck = np.convolve(duck, np.ones(win) / win, mode="same")

    bed = (music * 0.55 * duck + hits * 0.5)
    # Very gentle stereo: a short delay on one side of the bed only.
    d = int(0.011 * SR)
    left = bed + voice * 0.95
    right = np.concatenate([np.zeros(d, np.float32), bed[:-d]]) + voice * 0.95
    fade = env(n, 1.5, 3.0)
    stereo = np.stack([left * fade, right * fade], axis=1)
    stereo *= 0.89 / np.max(np.abs(stereo))

    with wave.open(str(BUILD / "mix.wav"), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((stereo * 32767).astype(np.int16).tobytes())
    print(f"mix.wav {total:.1f}s")


if __name__ == "__main__":
    main()
