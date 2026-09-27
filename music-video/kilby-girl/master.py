"""Measurement-driven master for "Kilby Girl" (MIX 1 rev 1).

Chain (all 64-bit float, 44.1 kHz):
  1. 20 Hz high-pass (subsonic clean-up)
  2. Tonal EQ: +1 dB @ 60 Hz, -1.5 dB @ 200 Hz, +2.5 dB shelf @ 3 kHz, +1.5 dB shelf @ 11 kHz
  3. De-ess / cymbal control: 6-10 kHz band compressed only on spikes (zero-phase split)
  4. Stereo: side +1.5 dB above 300 Hz, lows kept mono
  5. Glue compressor: 1.5:1, 30 ms / 250 ms, sidechain high-passed at 150 Hz
  6. 4x-oversampled soft clipper at 0 dBFS to take the fastest drum transients
  7. Look-ahead true-peak limiter to a -1.0 dBTP ceiling at the loudness target (-11.5 LUFS default)
  8. TPDF dither to 24-bit and 16-bit

Usage: python3 master.py in.wav out_prefix [target_lufs] [clip_db] [--outro SEC ...]

Without --outro this is the v3 master, sample for sample. --outro SEC (v4: 223.5) crossfades,
over --outro-ramp seconds, into an outro treatment for the stabs and ring-out after the vocal:
the glue fades out, the 3 kHz shelf drops by 1.5 dB and the drive into the clipper/limiter by
3.5 dB, so the stabs stay unclipped and the ring-out decays as mixed. The makeup gain is still
solved on the plain chain, so the body before SEC is untouched and the integrated loudness
reads a little under the target (the outro is ~2.3 LU quieter than in v3).
"""
import argparse
import numpy as np
import numba
import pyloudnorm as pyln
import scipy.signal as ss
import soundfile as sf


def biquad(kind, f0, sr, gain_db=0.0, q=0.707):
    """RBJ cookbook biquads."""
    A = 10 ** (gain_db / 40)
    w = 2 * np.pi * f0 / sr
    cw, sw = np.cos(w), np.sin(w)
    alpha = sw / (2 * q)
    if kind == 'peak':
        b = [1 + alpha * A, -2 * cw, 1 - alpha * A]
        a = [1 + alpha / A, -2 * cw, 1 - alpha / A]
    elif kind == 'lowshelf':
        s = 2 * np.sqrt(A) * alpha
        b = [A * ((A + 1) - (A - 1) * cw + s), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - s)]
        a = [(A + 1) + (A - 1) * cw + s, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - s]
    elif kind == 'highshelf':
        s = 2 * np.sqrt(A) * alpha
        b = [A * ((A + 1) + (A - 1) * cw + s), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - s)]
        a = [(A + 1) - (A - 1) * cw + s, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - s]
    else:
        raise ValueError(kind)
    b, a = np.array(b), np.array(a)
    return b / a[0], a / a[0]


def tonal_eq(x, sr):
    y = ss.sosfilt(ss.butter(2, 20, 'highpass', fs=sr, output='sos'), x, axis=0)
    for kind, f0, g, q in [('peak', 60, 1.0, 0.8), ('peak', 200, -1.5, 1.0),
                           ('highshelf', 3000, 2.5, 0.55), ('highshelf', 11000, 1.5, 0.6)]:
        b, a = biquad(kind, f0, sr, g, q)
        y = ss.lfilter(b, a, y, axis=0)
    return y


@numba.njit(cache=True)
def env_follow(d, att, rel):
    out = np.empty_like(d)
    e = 0.0
    for i in range(d.shape[0]):
        v = d[i]
        c = att if v > e else rel
        e = c * e + (1 - c) * v
        out[i] = e
    return out


def coef(ms, sr):
    return np.exp(-1.0 / (ms * 1e-3 * sr))


def deess(x, sr, thresh_rel_db=12.0, ratio=2.0, max_gr=4.0):
    sos = ss.butter(3, [6000, 10000], 'bandpass', fs=sr, output='sos')
    band = ss.sosfiltfilt(sos, x, axis=0)  # zero-phase so x - k*band stays coherent
    lvl = np.mean(band ** 2)
    det = env_follow(np.mean(band ** 2, axis=1), coef(2, sr), coef(80, sr))
    over = 10 * np.log10(np.maximum(det, 1e-18) / lvl) - thresh_rel_db
    gr_db = np.minimum(np.where(over > 0, over * (1 - 1 / ratio), 0.0), max_gr)
    g = 10 ** (-gr_db / 20)
    print(f'  de-ess: max GR {gr_db.max():.1f} dB, active {100 * np.mean(gr_db > 0.5):.1f}% of the time')
    return x - band * (1 - g)[:, None]


def widen(x, sr, side_db=1.5, f0=300):
    m = (x[:, 0] + x[:, 1]) / 2
    s = (x[:, 0] - x[:, 1]) / 2
    s_hi = ss.sosfiltfilt(ss.butter(2, f0, 'highpass', fs=sr, output='sos'), s)
    s = s + (10 ** (side_db / 20) - 1) * s_hi
    return np.stack([m + s, m - s], axis=1)


def glue_gr(x, sr, thresh_db, ratio=1.5, knee=6.0):
    """Glue compressor gain reduction in dB, per sample."""
    sc = ss.sosfilt(ss.butter(2, 150, 'highpass', fs=sr, output='sos'), x, axis=0)
    p = np.mean(sc ** 2, axis=1)
    ms = env_follow(p, coef(30, sr), coef(250, sr))
    lvl = 10 * np.log10(np.maximum(ms, 1e-12))
    over = lvl - thresh_db
    return np.where(over <= -knee / 2, 0.0,
                    np.where(over >= knee / 2, over * (1 - 1 / ratio),
                             (1 - 1 / ratio) * (over + knee / 2) ** 2 / (2 * knee)))


def glue(x, sr, thresh_db, ratio=1.5, knee=6.0):
    gr = glue_gr(x, sr, thresh_db, ratio, knee)
    print(f'  glue: max GR {gr.max():.1f} dB, mean GR (loud parts) {gr[gr > 0.1].mean():.1f} dB')
    return x * (10 ** (-gr / 20))[:, None]


@numba.njit(cache=True)
def release_smooth(g, rel_fast, rel_slow):
    # instant attack (look-ahead already handled), two-stage release: fast recovery after
    # short peaks, slow when gain reduction is sustained (less pumping, less distortion)
    out = np.empty_like(g)
    fast = 1.0
    slow = 1.0
    for i in range(g.shape[0]):
        v = g[i]
        fast = v if v < fast else rel_fast * fast + (1 - rel_fast) * v
        slow = v if v < slow else rel_slow * slow + (1 - rel_slow) * v
        out[i] = 0.5 * (fast + slow)  # both stay <= v, so the blend never exceeds the needed gain
    return out


def soft_clip(x, level_db, knee_db=3.0, os=4):
    """Oversampled soft clipper: linear below level-knee, tanh into a hard ceiling at level."""
    c = 10 ** (level_db / 20)
    t = c * 10 ** (-knee_db / 20)
    up = ss.resample_poly(x, os, 1, axis=0)
    a = np.abs(up)
    y = np.where(a <= t, a, t + (c - t) * np.tanh((a - t) / (c - t)))
    shaved = 20 * np.log10(np.maximum(a, 1e-12) / np.maximum(y, 1e-12))
    per = shaved.max(axis=1).reshape(-1, os).max(axis=1)  # worst channel, per original sample
    worst = np.unique(np.flatnonzero(per > 2.0) // 44100)
    print(f'  clipper: max shave {shaved.max():.1f} dB, active {100 * np.mean(per > 0.1):.2f}% of samples, '
          f'>2 dB at seconds {worst.tolist()[:24]}')
    return ss.resample_poly(np.sign(up) * y, 1, os, axis=0)[: x.shape[0]]


def true_peak_per_sample(x, os=4):
    up = ss.resample_poly(x, os, 1, axis=0)
    a = np.max(np.abs(up), axis=1)
    return a.reshape(-1, os).max(axis=1)[: x.shape[0]]


def limit(x, sr, ceiling_db=-1.0, look_ms=1.5):
    ceil = 10 ** (ceiling_db / 20)
    L = int(look_ms * 1e-3 * sr)
    tp = true_peak_per_sample(x)
    need = np.minimum(1.0, ceil / np.maximum(tp, 1e-12))
    # min over the next L samples (so gain is already down when the peak arrives)
    ahead = np.lib.stride_tricks.sliding_window_view(np.r_[need, np.ones(L)], L + 1).min(axis=1)
    g = release_smooth(ahead, coef(40, sr), coef(400, sr))
    # box filter over the previous L samples keeps g <= need at every peak while smoothing the attack
    k = np.ones(L + 1) / (L + 1)
    g = np.convolve(np.r_[np.full(L, g[0]), g], k, mode='valid')
    gr = -20 * np.log10(g)
    print(f'  limiter: max GR {gr.max():.1f} dB, GR>1dB {100 * np.mean(gr > 1):.1f}% of the time, '
          f'mean GR while active {gr[gr > 0.05].mean():.2f} dB')
    return x * g[:, None]


def ramp(n, sr, t0, t1):
    """0 before t0, raised-cosine 0 -> 1 from t0 to t1, 1 after (per sample)."""
    u = np.clip((np.arange(n) / sr - t0) / (t1 - t0), 0.0, 1.0)
    return 0.5 - 0.5 * np.cos(np.pi * u)


def outro_master(y0, sr, gain_db, clip_db, a, drive_db=3.5, shelf_db=-1.5, glue_keep=0.0):
    """Same chain from the glue on, with the outro moves automated by a (0 = v3 master, 1 = outro).

    Once the vocal stops, the stabs are the hottest peaks in the song relative to their loudness,
    so the fixed drive made the clipper and limiter work hardest exactly where nothing masks them.
    In the outro: the glue fades out (it filled the stop-time gaps and swelled the ring-out),
    the 3 kHz shelf comes down (the mix is already brightest here), and the drive into the
    clipper/limiter drops so both sit nearly idle. With a == 0 every step is the v3 chain.
    """
    gr = glue_gr(y0, sr, thresh_db=-16.0) * (1 - a * (1 - glue_keep))
    y = y0 * (10 ** (-gr / 20))[:, None]
    b, c = biquad('highshelf', 3000, sr, shelf_db, 0.55)
    y = y + a[:, None] * (ss.lfilter(b, c, y, axis=0) - y)
    y = y * (10 ** ((gain_db - a * drive_db) / 20))[:, None]
    print('  outro pass:')
    return limit(soft_clip(y, clip_db), sr)


def tpdf(x, bits, rng):
    q = 2.0 ** (1 - bits)
    d = (rng.random(x.shape) - rng.random(x.shape)) * q
    return np.clip(np.round((x + d) / q) * q, -1, 1 - q)


def stats(label, x, sr, meter):
    I = meter.integrated_loudness(x)
    tp = 20 * np.log10(true_peak_per_sample(x).max())
    st = [meter.integrated_loudness(x[i:i + 3 * sr]) for i in range(0, len(x) - 3 * sr, sr)]
    st = np.array([v for v in st if v > -50])
    lra = np.percentile(st, 95) - np.percentile(st, 10)
    print(f'{label}: {I:6.2f} LUFS integrated | {tp:+.2f} dBTP | max short-term {st.max():.1f} LUFS | '
          f'LRA~{lra:.1f} LU | PLR {tp - I:.1f} dB')
    return I


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('target', nargs='?', type=float, default=-11.5)
    ap.add_argument('clip_db', nargs='?', type=float, default=0.0)
    ap.add_argument('--outro', type=float, metavar='SEC',
                    help='start of the outro treatment (Kilby Girl MIX 1 rev 1: 223.5); off by default')
    ap.add_argument('--outro-ramp', type=float, default=1.95, metavar='SEC', help='crossfade length (1.95)')
    ap.add_argument('--outro-drive', type=float, default=3.5, metavar='DB', help='less drive into clip/limit (3.5)')
    ap.add_argument('--outro-shelf', type=float, default=-1.5, metavar='DB', help='change to the 3 kHz shelf (-1.5)')
    ap.add_argument('--outro-glue', type=float, default=0.0, metavar='K', help='glue kept, 0..1 (0)')
    args = ap.parse_args()
    target, clip_db = args.target, args.clip_db
    x, sr = sf.read(args.src, always_2d=True, dtype='float64')
    meter = pyln.Meter(sr)
    stats('mix   ', x, sr, meter)

    y0 = tonal_eq(x, sr)
    y0 = deess(y0, sr)
    y0 = widen(y0, sr)
    # threshold sits just under the chorus level so only the loud sections get ~1 dB of glue
    y = glue(y0, sr, thresh_db=-16.0)

    # find the pre-limiter gain that lands the target after limiting (limiting costs a little loudness)
    gain_db = target - meter.integrated_loudness(y)
    for _ in range(3):
        z = limit(soft_clip(y * 10 ** (gain_db / 20), clip_db), sr)
        err = target - meter.integrated_loudness(z)
        if abs(err) < 0.05:
            break
        gain_db += err
    print(f'  makeup into limiter: {gain_db:+.2f} dB')
    if args.outro is not None:
        # the makeup gain stays the body's, so everything before the outro is the v3 master
        a = ramp(len(z), sr, args.outro, args.outro + args.outro_ramp)
        z2 = outro_master(y0, sr, gain_db, clip_db, a, args.outro_drive, args.outro_shelf, args.outro_glue)
        n0 = int(np.argmax(a > 0))
        z = np.concatenate([z[:n0], z2[n0:]])  # a == 0 before n0, so the splice is sample-exact
        print(f'  outro from {args.outro:.2f} s: drive -{args.outro_drive} dB, 3 kHz shelf '
              f'{args.outro_shelf:+} dB, glue x{args.outro_glue} over {args.outro_ramp} s')
    stats('master', z, sr, meter)

    rng = np.random.default_rng(7)
    sf.write(out + '_24bit.wav', tpdf(z, 24, rng), sr, subtype='PCM_24')
    sf.write(out + '_16bit.wav', tpdf(z, 16, rng), sr, subtype='PCM_16')


if __name__ == '__main__':
    main()
