"""Performance data for the band rigs -> perf.json (drum limbs, strums, bass notes, lip-sync visemes).

Two stages:

    # 1. drums / bass / other stems with the KUIELab MDX-Net ONNX models from the UVR model repo
    #    (github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/kuielab_a_drums.onnx,
    #    ..._bass.onnx, ..._other.onnx); numpy STFT + onnxruntime, no torch
    python3 perf.py stems models/ master_24bit.wav stems/ [mdx_model_data.json]

    # 2. events and envelopes (re-run whenever the lyrics change)
    python3 perf.py analyze --master master_24bit.wav --stems stems/ --vocals vocals.wav \
        --features features.json [--lyrics lyrics.json] --out perf.json

perf.json holds, in seconds and at 60 fps for the envelopes: drum hits per piece (kick, snare,
hat with openness, toms with pitch, crash, ride), drum fills, bass notes, acoustic and electric
strums with direction, rough chords, electric lead notes, Noah's mouth visemes (open / wide /
round), a smoothed energy curve and the song sections. lib/perf.mjs reads it for the renderer.

The lyric text is used only to pick a vowel shape per syllable; none of it is written out.
"""
import argparse
import hashlib
import json
import os
import re
import sys

import numpy as np

os.environ.setdefault('OMP_NUM_THREADS', '2')

SR = 44100
FPS = 60

# ====================================================================================== stems

# n_fft per KUIELab target (dim_f and dim_t are read from the ONNX input shape)
KUIELAB_NFFT = {'drums': 4096, 'bass': 16384, 'other': 8192, 'vocals': 6144}
MDX_HOP = 1024


def uvr_hash(path):
    """UVR's model id: md5 of the last 10 MB of the file (whole file if smaller)."""
    with open(path, 'rb') as f:
        try:
            f.seek(-10000 * 1024, 2)
        except OSError:
            f.seek(0)
        return hashlib.md5(f.read()).hexdigest()


class MDX:
    def __init__(self, model_path, n_fft, threads=2):
        import onnxruntime as ort
        opts = ort.SessionOptions()
        opts.log_severity_level = 3
        opts.intra_op_num_threads = threads
        opts.inter_op_num_threads = 1
        self.sess = ort.InferenceSession(model_path, sess_options=opts, providers=['CPUExecutionProvider'])
        shape = self.sess.get_inputs()[0].shape
        self.dim_f, self.dim_t = int(shape[2]), int(shape[3])
        self.n_fft = n_fft
        self.window = np.hanning(n_fft + 1)[:-1].astype(np.float32)  # periodic Hann

    def stft(self, x):
        n = self.n_fft
        xp = np.pad(x, ((0, 0), (n // 2, n // 2)), mode='reflect')
        frames = 1 + (xp.shape[1] - n) // MDX_HOP
        out = np.empty((x.shape[0], n // 2 + 1, frames), np.complex64)
        for c in range(x.shape[0]):
            idx = np.arange(n)[None, :] + MDX_HOP * np.arange(frames)[:, None]
            out[c] = np.fft.rfft(xp[c, idx] * self.window, axis=-1).T
        return out

    def istft(self, S, length):
        n = self.n_fft
        frames = S.shape[2]
        total = n + MDX_HOP * (frames - 1)
        out = np.zeros((S.shape[0], total))
        norm = np.zeros(total)
        w2 = self.window.astype(np.float64) ** 2
        for c in range(S.shape[0]):
            y = np.fft.irfft(S[c].T, n=n, axis=-1) * self.window
            for t in range(frames):
                out[c, t * MDX_HOP:t * MDX_HOP + n] += y[t]
        for t in range(frames):
            norm[t * MDX_HOP:t * MDX_HOP + n] += w2
        out /= np.maximum(norm, 1e-8)
        return out[:, n // 2:n // 2 + length]

    def run_chunk(self, chunk):
        S = self.stft(chunk)[:, :self.dim_f]
        spec = np.stack([S.real, S.imag], axis=1).reshape(1, 4, self.dim_f, -1).astype(np.float32)
        spec[:, :, :3, :] = 0
        pred = self.sess.run(None, {self.sess.get_inputs()[0].name: spec})[0][0].reshape(2, 2, self.dim_f, -1)
        P = np.zeros((2, self.n_fft // 2 + 1, pred.shape[-1]), np.complex64)
        P[:, :self.dim_f] = pred[:, 0] + 1j * pred[:, 1]
        return self.istft(P, chunk.shape[1])

    def demix(self, mix, overlap=0.5, label=''):
        trim = self.n_fft // 2
        chunk = MDX_HOP * (self.dim_t - 1)
        gen = chunk - 2 * trim
        pad = gen + trim - mix.shape[1] % gen
        m = np.concatenate([np.zeros((2, trim)), mix, np.zeros((2, pad))], axis=1)
        step = max(1, int((1 - overlap) * chunk))
        result = np.zeros_like(m)
        divider = np.zeros_like(m)
        starts = range(0, m.shape[1], step)
        for k, i in enumerate(starts):
            end = min(i + chunk, m.shape[1])
            part = m[:, i:end]
            if part.shape[1] < chunk:
                part = np.pad(part, ((0, 0), (0, chunk - part.shape[1])))
            w = np.hanning(end - i) + 1e-3
            result[:, i:end] += self.run_chunk(part)[:, :end - i] * w
            divider[:, i:end] += w
            print(f'\r  {label} chunk {k + 1}/{len(starts)}', end='', file=sys.stderr)
        print(file=sys.stderr)
        return (result / np.maximum(divider, 1e-8))[:, trim:trim + mix.shape[1]]


def cmd_stems(argv):
    import soundfile as sf
    models_dir, master, out_dir = argv[:3]
    table = json.load(open(argv[3])) if len(argv) > 3 else {}
    os.makedirs(out_dir, exist_ok=True)
    x, sr = sf.read(master, always_2d=True, dtype='float64')
    assert sr == SR, 'models expect 44.1 kHz'
    mix = x.T
    peak = np.abs(mix).max()
    for stem in ('drums', 'bass', 'other'):
        cands = [f'kuielab_a_{stem}.onnx', f'kuielab_b_{stem}.onnx']
        paths = [os.path.join(models_dir, c) for c in cands]
        path = next((p for p in paths if os.path.exists(p) and os.path.getsize(p) > 1e6), None)
        if path is None:
            print(f'{stem}: no model in {models_dir}', file=sys.stderr)
            continue
        info = table.get(uvr_hash(path), {})
        n_fft = info.get('mdx_n_fft_scale_set', KUIELAB_NFFT[stem])
        mdx = MDX(path, n_fft)
        print(f'{stem}: {os.path.basename(path)} n_fft={n_fft} dim_f={mdx.dim_f} dim_t={mdx.dim_t}', file=sys.stderr)
        y = mdx.demix(mix / peak * 0.9, label=stem) * peak / 0.9
        sf.write(os.path.join(out_dir, f'{stem}.wav'), y.T.astype(np.float32), sr, subtype='FLOAT')


# ====================================================================================== shared

EHOP = 64                 # envelope hop (1.45 ms) for onset timing
EFR = SR / EHOP


def load_mono(path, sr=SR):
    import soundfile as sf
    x, r = sf.read(path, always_2d=True, dtype='float32')
    assert r == sr, f'{path}: expected {sr} Hz'
    return x.mean(1)


def band_env(y, lo, hi, order=4, hop=EHOP):
    """zero-phase band-limited Hilbert envelope in dB, max-pooled to `hop` samples."""
    import scipy.fft as sfft
    import scipy.signal as ss
    if lo is None:
        sos = ss.butter(order, hi, 'low', fs=SR, output='sos')
    elif hi is None:
        sos = ss.butter(order, lo, 'high', fs=SR, output='sos')
    else:
        sos = ss.butter(order, [lo, hi], 'band', fs=SR, output='sos')
    z = ss.sosfiltfilt(sos, y).astype(np.float32)
    e = np.abs(ss.hilbert(z, N=sfft.next_fast_len(len(z)))[:len(z)]).astype(np.float32)
    m = len(e) // hop
    return 20 * np.log10(e[:m * hop].reshape(m, hop).max(1) + 1e-7)


def rise(e, back):
    """how far each frame sits above the minimum of the preceding `back` frames (dB)"""
    import scipy.ndimage as nd
    return e - nd.minimum_filter1d(e, back, origin=(back - 1) // 2)


def peak_after(e, i, n):
    seg = e[i:i + n]
    k = int(np.argmax(seg))
    return float(seg[k]), i + k


def attack_start(e, ip, drop=10.0, back=40):
    """walk back from a peak to where the envelope was `drop` dB lower: the attack's start"""
    lo = max(0, ip - back)
    seg = e[lo:ip + 1][::-1]
    below = np.flatnonzero(seg < e[ip] - drop)
    return ip - (below[0] - 1 if len(below) else len(seg) - 1)


def decay_time(e, ip, drop=15.0, cap=1.5):
    tail = e[ip:ip + int(cap * EFR)]
    below = np.flatnonzero(tail < e[ip] - drop)
    return (below[0] if len(below) else len(tail)) / EFR


def vel_map(levels, lo_db=30.0, gamma=1.0, ref=None):
    """dB peak levels -> 0..1: 1 at the loud reference (98th percentile), 0 at lo_db below it"""
    levels = np.asarray(levels, float)
    if not len(levels):
        return levels
    ref = np.percentile(levels, 98) if ref is None else ref
    return np.clip((levels - (ref - lo_db)) / lo_db, 0.05, 1.0) ** gamma


# ====================================================================================== drums

# bands (Hz) for the drum stem
DB = {'K': (35, 90), 'L': (90, 160), 'Sb': (160, 400), 'M': (400, 1000), 'Sc': (1000, 4000), 'H': (6000, None)}
KICK_SB_LEAK = -17.0       # typical level of a kick's 160-400 Hz band relative to its 35-90 Hz band


def drum_envelopes(y):
    return {k: band_env(y, lo, hi) for k, (lo, hi) in DB.items()}


def band_onsets(e, height, floor_db, min_gap=0.04, back=0.02, fwd=0.03):
    """frames where a band's envelope jumps `height` dB above its recent minimum and gets loud"""
    import scipy.signal as ss
    r = rise(e, int(back * EFR))
    p, _ = ss.find_peaks(r, height=height, distance=int(min_gap * EFR))
    lv = np.array([peak_after(e, i, int(fwd * EFR))[0] for i in p])
    return p[lv > floor_db] if len(p) else p


def onset_time(e, i, fwd=0.03, back=0.035, frac=0.3):
    """Precise onset near candidate frame i: take the peak in [i - 5 ms, i + fwd], the lowest point
    in the `back` seconds before it, and return the first frame after that low point where the
    envelope has made `frac` of its rise in dB. Works for sharp (hat) and slow (kick) attacks."""
    a = max(0, i - int(0.005 * EFR))
    ip = a + int(np.argmax(e[a:a + max(1, int(fwd * EFR))]))
    lo = max(0, ip - int(back * EFR))
    im = lo + int(np.argmin(e[lo:ip + 1]))
    thr = e[im] + frac * (e[ip] - e[im])
    return im + int(np.argmax(e[im:ip + 1] >= thr)), float(e[ip]), ip


def dedupe(hits, gap):
    """hits: lists [frame, level, ...] -> within `gap` s keep the loudest (at the earliest frame)"""
    hits = sorted(hits, key=lambda h: h[0])
    out = []
    for h in hits:
        if out and h[0] - out[-1][0] < gap * EFR:
            if h[1] > out[-1][1]:
                out[-1] = [out[-1][0]] + list(h[1:])
            continue
        out.append(list(h))
    return out


def decay_rate(e, ip, nxt, max_win=0.5):
    """seconds for the envelope to fall 15 dB after its peak, extrapolated from the dB slope up to
    the next hit in the same band, so a quickly re-struck cymbal still gets its own decay"""
    end = min(len(e), ip + int(max_win * EFR), nxt if nxt is not None else len(e))
    seg = e[ip:end]
    if len(seg) < 8:
        return 0.05
    below = np.flatnonzero(seg < e[ip] - 15)
    if len(below):
        return below[0] / EFR
    tt = np.arange(len(seg)) / EFR
    slope = np.polyfit(tt, seg, 1)[0]            # dB/s (negative while decaying)
    return float(np.clip(15 / max(-slope, 1e-3), len(seg) / EFR, 3.0))


def detect_drums(E):
    """Drum hits from the drum stem's band envelopes -> dict of lists of [frame, level, ...]."""
    ref = {k: float(np.percentile(e, 99.5)) for k, e in E.items()}
    R = {k: rise(e, int(0.02 * EFR)) for k, e in E.items()}
    LO = np.maximum(E['K'], E['L'])
    BODY = np.maximum(E['L'], E['Sb'])

    def lv(band, i, fwd):
        a = max(0, i - int(0.005 * EFR))
        return float(E[band][a:a + int(fwd * EFR)].max())

    def rise_at(band, i, win=0.015):
        return float(R[band][max(0, i - int(win * EFR)):i + int(win * EFR) + 1].max())

    # ---- kick: the 35-90 Hz band, which nothing else on the kit reaches
    kicks = []
    for i in band_onsets(E['K'], 12, ref['K'] - 24, min_gap=0.07, fwd=0.06):
        K, L = lv('K', i, 0.06), lv('L', i, 0.06)
        if L - K > 6:                          # far more 90-160 Hz than 35-90 Hz: a floor tom
            continue
        k, _, _ = onset_time(LO, i, fwd=0.06, back=0.05)
        kicks.append([k, K])
    kicks = dedupe(kicks, 0.06)
    kick_idx = np.array([k[0] for k in kicks], int)

    def kick_near(i, win=0.035):
        return len(kick_idx) and np.min(np.abs(kick_idx - i)) <= win * EFR

    # ---- snare and toms: body (160-400 Hz) beyond what a simultaneous kick leaks, plus the crack
    snares, toms = [], []
    cands = np.union1d(band_onsets(E['Sb'], 8, ref['Sb'] - 24, min_gap=0.05),
                       band_onsets(E['Sc'], 8, ref['Sc'] - 24, min_gap=0.05))
    cands = np.union1d(cands, band_onsets(E['L'], 8, ref['L'] - 20, min_gap=0.05))
    for i in cands:
        Sb, L, K = lv('Sb', i, 0.04), lv('L', i, 0.05), lv('K', i, 0.06)
        Sc, H = lv('Sc', i, 0.03), lv('H', i, 0.03)
        excess = Sb - (K + KICK_SB_LEAK)
        crack = rise_at('Sc', i)
        if excess >= 10 and Sb > ref['Sb'] - 24 and Sc - Sb >= -10 and crack >= 6 and Sc - H >= -14:
            k, _, _ = onset_time(E['Sc'], i, fwd=0.03)
            snares.append([k, Sb, Sc])
            continue
        body = max(L, Sb)
        if (not kick_near(i) and body > max(ref['L'], ref['Sb']) - 18 and Sc - body < -10
                and max(rise_at('L', i), rise_at('Sb', i)) >= 10):
            k, _, ip = onset_time(BODY, i, fwd=0.04)
            if decay_rate(BODY, ip, None, 0.3) > 0.1:
                toms.append([k, body, L - Sb])
    snares = dedupe(snares, 0.06)
    sn_idx = np.array([s[0] for s in snares], int)
    toms = [t for t in dedupe(toms, 0.07) if not len(sn_idx) or np.min(np.abs(sn_idx - t[0])) > 0.04 * EFR]

    # ---- cymbals: the 6 kHz+ band; loudness and decay (on a 15 ms smoothed envelope) type them
    import scipy.ndimage as nd
    Hs = nd.uniform_filter1d(E['H'], int(0.015 * EFR))
    cym = []
    hs = band_onsets(E['H'], 6, ref['H'] - 30, min_gap=0.05)
    for n, i in enumerate(hs):
        k, P, ip = onset_time(E['H'], i, fwd=0.03)
        nxt = hs[n + 1] if n + 1 < len(hs) else None
        j = min(ip + int(0.01 * EFR), len(Hs) - 1)
        cym.append([k, P, decay_rate(Hs, j, nxt), lv('Sc', i, 0.03)])
    cym = dedupe(cym, 0.045)
    return {'ref': ref, 'kicks': kicks, 'snares': snares, 'toms': toms, 'cym': cym}


# ====================================================================================== analyze


def main():
    if len(sys.argv) > 1 and sys.argv[1] == 'stems':
        return cmd_stems(sys.argv[2:])
    if len(sys.argv) > 1 and sys.argv[1] == 'analyze':
        return cmd_analyze(sys.argv[2:])
    print(__doc__, file=sys.stderr)
    sys.exit(2)


if __name__ == '__main__':
    main()
