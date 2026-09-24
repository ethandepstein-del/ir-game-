"""Synthesize the narration and lay it out on a timeline.

Reads script.json, speaks each line with a Piper neural voice, and writes:
  build/narration.wav  one mono track with every line placed at its time
  build/timeline.json  scene and line start/end times, read by the scene
"""

import io
import json
import subprocess
import sys
import tarfile
import urllib.request
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
BUILD = HERE / "build"
VOICE = "en-us-ryan-high"
VOICE_URL = f"https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-{VOICE}.tar.gz"
RATE = 22050
LINE_GAP = 0.62      # seconds between lines in a scene
SENTENCE_GAP = 0.42  # silence Piper leaves after each sentence inside a line
LENGTH_SCALE = 1.14  # >1 speaks slower: a calmer documentary pace


def voice_model() -> Path:
    model = HERE / "voices" / VOICE / f"{VOICE}.onnx"
    if not model.exists():
        print(f"downloading voice {VOICE}")
        model.parent.mkdir(parents=True, exist_ok=True)
        data = urllib.request.urlopen(VOICE_URL).read()
        tarfile.open(fileobj=io.BytesIO(data)).extractall(model.parent)
    return model


def speak(model: Path, text: str) -> np.ndarray:
    wav = subprocess.run(
        [sys.executable, "-m", "piper", "-m", str(model), "-f", "-",
         "--length-scale", str(LENGTH_SCALE), "--sentence-silence", str(SENTENCE_GAP),
         "--noise-scale", "0.6", "--noise-w-scale", "0.7"],
        input=text.encode(), capture_output=True, check=True,
    ).stdout
    with wave.open(io.BytesIO(wav)) as w:
        assert w.getframerate() == RATE, w.getframerate()
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    audio = pcm.astype(np.float32) / 32768
    # Trim the silence Piper pads around the line so our gaps are exact.
    loud = np.nonzero(np.abs(audio) > 0.01)[0]
    return audio[max(loud[0] - 400, 0): loud[-1] + 1600]


def main() -> None:
    BUILD.mkdir(exist_ok=True)
    script = json.loads((HERE / "script.json").read_text())
    model = voice_model()

    t = 0.0
    clips = []
    scenes = []
    for scene in script["scenes"]:
        start = t
        t += scene["lead"]
        lines = []
        for i, text in enumerate(scene["lines"]):
            if i:
                t += LINE_GAP
            audio = speak(model, text)
            dur = len(audio) / RATE
            print(f"{t:7.2f}  {dur:5.2f}s  {text}")
            clips.append((t, audio))
            lines.append({"text": text, "start": round(t, 3), "end": round(t + dur, 3)})
            t += dur
        t += scene.get("hold", 0) + scene["tail"]
        scenes.append({**{k: v for k, v in scene.items() if k != "lines"},
                       "start": round(start, 3), "end": round(t, 3), "lines": lines})

    total = t
    track = np.zeros(int(total * RATE) + RATE, dtype=np.float32)
    for at, audio in clips:
        i = int(at * RATE)
        track[i:i + len(audio)] += audio
    pcm = (np.clip(track, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(BUILD / "narration.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm.tobytes())

    timeline = {"title": script["title"], "subtitle": script["subtitle"],
                "duration": round(total, 3), "scenes": scenes}
    (BUILD / "timeline.json").write_text(json.dumps(timeline, indent=2))
    print(f"total {total:.1f}s")


if __name__ == "__main__":
    main()
