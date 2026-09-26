"""Vocal / instrumental split with an MDX-Net ONNX model (numpy + onnxruntime, no torch).

Mirrors the inference in audio-separator's MDXSeparator: chunked STFT -> model -> ISTFT with
Hann-windowed overlap-add. Defaults are for Kim_Vocal_2.onnx from the UVR model repo:
  https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/Kim_Vocal_2.onnx

    python3 separate.py Kim_Vocal_2.onnx master.wav vocals.wav instrumental.wav
"""
import sys

import numpy as np
import onnxruntime as ort
import soundfile as sf

N_FFT, HOP, DIM_F, DIM_T, COMPENSATE = 7680, 1024, 3072, 256, 1.009
WINDOW = np.hanning(N_FFT + 1)[:-1]  # periodic Hann, as torch.hann_window(periodic=True)


def stft(x):
    """x: (channels, samples) -> (channels, bins, frames), torch.stft(center=True) semantics."""
    pad = N_FFT // 2
    xp = np.pad(x, ((0, 0), (pad, pad)), mode='reflect')
    frames = 1 + (xp.shape[1] - N_FFT) // HOP
    idx = np.arange(N_FFT)[None, :] + HOP * np.arange(frames)[:, None]
    return np.fft.rfft(xp[:, idx] * WINDOW, axis=-1).transpose(0, 2, 1)


def istft(S, length):
    """S: (channels, bins, frames) -> (channels, length)."""
    frames = S.shape[2]
    y = np.fft.irfft(S.transpose(0, 2, 1), n=N_FFT, axis=-1) * WINDOW
    out = np.zeros((S.shape[0], N_FFT + HOP * (frames - 1)))
    norm = np.zeros(N_FFT + HOP * (frames - 1))
    for t in range(frames):
        out[:, t * HOP:t * HOP + N_FFT] += y[:, t]
        norm[t * HOP:t * HOP + N_FFT] += WINDOW ** 2
    out /= np.maximum(norm, 1e-8)
    return out[:, N_FFT // 2:N_FFT // 2 + length]


def run_chunk(sess, chunk):
    S = stft(chunk)[:, :DIM_F]  # (2, 3072, 256)
    spec = np.stack([S.real, S.imag], axis=1).reshape(1, 4, DIM_F, -1).astype(np.float32)
    spec[:, :, :3, :] = 0
    pred = sess.run(None, {'input': spec})[0][0].reshape(2, 2, DIM_F, -1)
    P = np.zeros((2, N_FFT // 2 + 1, pred.shape[-1]), dtype=np.complex128)
    P[:, :DIM_F] = pred[:, 0] + 1j * pred[:, 1]
    return istft(P, chunk.shape[1])


def demix(sess, mix, overlap=0.25):
    trim = N_FFT // 2
    chunk = HOP * (DIM_T - 1)
    gen = chunk - 2 * trim
    pad = gen + trim - mix.shape[1] % gen
    m = np.concatenate([np.zeros((2, trim)), mix, np.zeros((2, pad))], axis=1)
    step = int((1 - overlap) * chunk)
    result = np.zeros_like(m)
    divider = np.zeros_like(m)
    starts = range(0, m.shape[1], step)
    for n, i in enumerate(starts):
        end = min(i + chunk, m.shape[1])
        part = m[:, i:end]
        if part.shape[1] < chunk:
            part = np.pad(part, ((0, 0), (0, chunk - part.shape[1])))
        w = np.hanning(end - i)
        out = run_chunk(sess, part)[:, :end - i] * w
        result[:, i:end] += out
        divider[:, i:end] += w
        print(f'\r  chunk {n + 1}/{len(starts)}', end='', file=sys.stderr)
    print(file=sys.stderr)
    return (result / np.maximum(divider, 1e-8))[:, trim:trim + mix.shape[1]]


def main():
    model, src, vocals_out, inst_out = sys.argv[1:5]
    x, sr = sf.read(src, always_2d=True, dtype='float64')
    assert sr == 44100, 'model expects 44.1 kHz'
    mix = x.T
    peak = np.abs(mix).max()
    opts = ort.SessionOptions()
    opts.log_severity_level = 3
    sess = ort.InferenceSession(model, sess_options=opts, providers=['CPUExecutionProvider'])
    voc = demix(sess, mix / peak * 0.9) * peak / 0.9
    sf.write(vocals_out, voc.T, sr, subtype='FLOAT')
    sf.write(inst_out, (mix - voc * COMPENSATE).T, sr, subtype='FLOAT')


if __name__ == '__main__':
    main()
