"""Extract per-frame audio features that drive the animation -> features.json"""
import json
import sys
import numpy as np
import librosa
import scipy.signal as ss
import soundfile as sf

FPS = 24
path, out = sys.argv[1], sys.argv[2]
x, sr = sf.read(path, always_2d=True)
y = x.mean(1).astype(np.float32)
dur = len(y) / sr
n = int(np.ceil(dur * FPS))
hop = 256
t_env = np.arange(0, len(y) // hop + 1) * hop / sr


def at_frames(v, t):
    return np.interp(np.arange(n) / FPS, t, v)


def norm(v, lo=5, hi=99.5):
    a, b = np.percentile(v, lo), np.percentile(v, hi)
    return np.clip((v - a) / (b - a + 1e-12), 0, 1)


S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop)) ** 2
freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)


def band(lo, hi):
    m = (freqs >= lo) & (freqs < hi)
    return 10 * np.log10(S[m].sum(0) + 1e-10)


def onset(lo, hi):
    e = band(lo, hi)
    d = np.maximum(0, np.diff(e, prepend=e[0]))
    return ss.lfilter([1], [1, -0.5], d)  # tiny smear so single-frame spikes are caught at 24 fps


tt = t_env[: S.shape[1]]
loud = band(20, 16000)
low, mid, high = band(30, 150), band(150, 2000), band(4000, 14000)
kick_on, snare_on, hat_on = onset(35, 120), onset(1500, 6000), onset(7000, 14000)
full_on = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)[: len(tt)]


def peaks(v, thr_pct, min_gap):
    thr = np.percentile(v, thr_pct)
    p, _ = ss.find_peaks(v, height=thr, distance=int(min_gap * sr / hop))
    return tt[p]


kicks = peaks(kick_on, 93, 0.14)
snares = peaks(snare_on, 94, 0.14)
# accents: big broadband onsets that follow a quieter moment (stop-time stabs, section hits)
e_s = ss.lfilter([1], [1, -0.97], 10 ** (loud / 10)) * 0.03
pre = np.r_[np.zeros(40), 10 * np.log10(e_s[:-40] + 1e-12)]
acc_score = full_on * np.clip((10 * np.log10(e_s + 1e-12) - pre) / 6, 0, 3)
accents = peaks(acc_score, 99.3, 0.25)

beats = json.load(open(sys.argv[3]))['beats'] if len(sys.argv) > 3 else librosa.beat.beat_track(
    y=y, sr=sr, hop_length=512, units='time')[1].tolist()

feat = {
    'fps': FPS, 'duration': dur, 'frames': n,
    'rms': np.round(at_frames(norm(loud), tt), 3).tolist(),
    'low': np.round(at_frames(norm(low), tt), 3).tolist(),
    'mid': np.round(at_frames(norm(mid), tt), 3).tolist(),
    'high': np.round(at_frames(norm(high), tt), 3).tolist(),
    'onset': np.round(at_frames(norm(full_on, 50, 99.8), tt), 3).tolist(),
    'beats': np.round(beats, 3).tolist(),
    'kicks': np.round(kicks, 3).tolist(),
    'snares': np.round(snares, 3).tolist(),
    'accents': np.round(accents, 3).tolist(),
}
json.dump(feat, open(out, 'w'))
print(f'{n} frames, {len(beats)} beats, {len(kicks)} kicks, {len(snares)} snares, {len(accents)} accents')
print('accents:', ' '.join(f'{a:.2f}' for a in accents))
