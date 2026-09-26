"""Lyric timing from the separated vocal: sung lines, their words, and a time for every word.

1. Find sung phrases from the vocal stem's energy, and group them into lines.
2. Transcribe each line with Whisper (sherpa-onnx, large-v3-turbo int8).
3. Put each word on a vocal onset inside its line, weighting by syllable count.

The output is kept out of the repo (the lyrics belong to the song's publisher).

    python3 lyrics_align.py vocals.wav whisper_dir out.json [overrides.txt]

overrides.txt (optional): one corrected line of text per detected line, same order; blank keeps
Whisper's text.
"""
import json
import re
import sys

import librosa
import numpy as np
import scipy.signal as ss
import sherpa_onnx
import soundfile as sf

vocal_path, model_dir, out_path = sys.argv[1:4]
overrides = open(sys.argv[4]).read().split('\n') if len(sys.argv) > 4 else None

y, sr = sf.read(vocal_path, always_2d=True)
y = y.mean(1)
y16 = librosa.resample(y, orig_sr=sr, target_sr=16000).astype(np.float32)

# ---- sung phrases from energy (hysteresis), in 10 ms frames
hop = 160
rms = librosa.feature.rms(y=y16, frame_length=640, hop_length=hop)[0]
db = 20 * np.log10(rms + 1e-9)
ref = np.percentile(db, 97)
on_thr, off_thr = ref - 24, ref - 32
active = np.zeros_like(db, dtype=bool)
state = False
for i, v in enumerate(db):
    state = v > on_thr if not state else v > off_thr
    active[i] = state
fps = 16000 / hop
edges = np.flatnonzero(np.diff(np.r_[0, active.astype(int), 0]))
segs = [(a / fps, b / fps) for a, b in zip(edges[::2], edges[1::2])]
# merge short gaps (breaths inside a phrase), drop blips
merged = []
for a, b in segs:
    if merged and a - merged[-1][1] < 0.28:
        merged[-1] = (merged[-1][0], b)
    else:
        merged.append((a, b))
phrases = [(a, b) for a, b in merged if b - a > 0.25]

# ---- lines: split long phrases at their deepest breath dips so each sung line gets its own timing
smooth_db = np.convolve(db, np.ones(9) / 9, mode='same')


def split(a, b, max_len=4.2):
    if b - a <= max_len:
        return [(a, b)]
    i0, i1 = int((a + 0.8) * fps), int((b - 0.8) * fps)
    if i1 <= i0:
        return [(a, b)]
    k = i0 + int(np.argmin(smooth_db[i0:i1]))
    if smooth_db[k] > on_thr + 4:  # no real dip: keep it whole
        return [(a, b)]
    return split(a, k / fps, max_len) + split(k / fps, b, max_len)


lines = [seg for a, b in phrases for seg in split(a, b)]
print(f'{len(phrases)} phrases -> {len(lines)} lines', file=sys.stderr)

# ---- transcription
rec = sherpa_onnx.OfflineRecognizer.from_whisper(
    encoder=f'{model_dir}/turbo-encoder.int8.onnx',
    decoder=f'{model_dir}/turbo-decoder.int8.onnx',
    tokens=f'{model_dir}/turbo-tokens.txt',
    language='en', task='transcribe', num_threads=4, tail_paddings=800,
)


def transcribe(a, b):
    pad = 0.25
    seg = y16[max(0, int((a - pad) * 16000)):int((b + pad) * 16000)]
    s = rec.create_stream()
    s.accept_waveform(16000, seg)
    rec.decode_stream(s)
    return s.result.text.strip()


# ---- vocal onsets (syllable starts) for word placement
oenv = librosa.onset.onset_strength(y=y16, sr=16000, hop_length=hop)
onsets = librosa.onset.onset_detect(onset_envelope=oenv, sr=16000, hop_length=hop, backtrack=True, units='time', delta=0.04, wait=6)


def syllables(word):
    w = re.sub(r'[^a-z]', '', word.lower())
    if not w:
        return 1
    n = len(re.findall(r'[aeiouy]+', w))
    if w.endswith('e') and n > 1 and not w.endswith(('le', 'ee')):
        n -= 1
    return max(1, n)


BAD = re.compile(r'^[\s*\[\(]*(music|humming|applause|silence|instrumental)[\s*\]\)]*$', re.I)
out = []
for k, (a, b) in enumerate(lines):
    text = transcribe(a, b)
    if overrides and k < len(overrides) and overrides[k].strip():
        text = overrides[k].strip()
    text = re.sub(r'\s+', ' ', text).strip()
    if not text or re.fullmatch(r'[\W_]*', text) or BAD.match(text):
        continue
    words = text.split(' ')
    syl = np.array([syllables(w) for w in words], dtype=float)
    # candidate word starts: onsets inside the line, plus the line start
    cand = np.unique(np.r_[a, onsets[(onsets >= a - 0.05) & (onsets < b - 0.1)]])
    # ideal starts from syllable-weighted positions, snapped to the nearest unused onset nearby
    ideal = a + (b - a) * np.r_[0, np.cumsum(syl)[:-1]] / syl.sum()
    starts, used = [], set()
    for t in ideal:
        j = int(np.argmin(np.abs(cand - t)))
        if abs(cand[j] - t) < 0.22 and j not in used and (not starts or cand[j] > starts[-1] + 0.06):
            used.add(j)
            starts.append(float(cand[j]))
        else:
            starts.append(float(max(t, starts[-1] + 0.06) if starts else t))
    ends = starts[1:] + [b]
    out.append({
        'start': round(a, 3), 'end': round(b, 3), 'text': text,
        'words': [{'w': w, 't': round(s, 3), 'e': round(e, 3)} for w, s, e in zip(words, starts, ends)],
    })
    print(f'{a:7.2f}-{b:7.2f}  {len(words):2d} words', file=sys.stderr)

json.dump({'lines': out, 'phrases': [[round(a, 3), round(b, 3)] for a, b in phrases]}, open(out_path, 'w'), indent=1)
print(f'wrote {len(out)} lines', file=sys.stderr)
