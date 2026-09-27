"""Word timing for known lyric lines, from the separated vocal.

    python3 lyrics_timing.py vocals.wav lines.json lyrics.json ctc_model_dir [debug.json]

lines.json is a list of lines:
    {"id": str, "section": str, "text": str, "win": [start, end],
     "emph": [word index or word, ...],      # optional: punch words for the motion designer
     "say": str,                             # optional: how the text is sung, word for word, if the
                                             # printed form differs (numbers, initialisms, ...)
     "fix": {"word index": seconds}}         # optional: hand-checked onsets that override the aligner
Lines whose windows overlap are aligned together as one phrase group.

ctc_model_dir is a NeMo Conformer-CTC model from the sherpa-onnx asr-models release
(sherpa-onnx-nemo-ctc-en-conformer-medium: model.int8.onnx + tokens.txt), run with onnxruntime.

1. CTC forced alignment: the group's audio is scored by the CTC model (40 ms frames) and the
   known word sequence is Viterbi-aligned to it, which puts every word within a frame or two.
2. Onset refinement: each word start is moved to the nearest strong vocal onset (log-mel
   superflux plus band-energy rises, 5 ms hop) around the CTC time; a small dynamic program keeps
   the words in order and at least 50 ms apart.
3. Ends: a word ends where the next one starts, or earlier where the voice stops for a breath;
   a line's last word ends where the voice drops out (held notes run on).

The lyric text itself stays outside the repo.
"""
import json
import re
import sys

import librosa
import numpy as np
import onnxruntime as ort
import soundfile as sf

vocal_path, lines_path, out_path, ctc_dir = sys.argv[1:5]
debug_path = sys.argv[5] if len(sys.argv) > 5 else None
spec = json.load(open(lines_path))

SR = 16000
y, sr = sf.read(vocal_path, always_2d=True)
y16 = librosa.resample(y.mean(1), orig_sr=sr, target_sr=SR).astype(np.float32)

# ---------------------------------------------------------------- acoustic features, 5 ms hop
HOP = 80
FPS = SR / HOP
S = np.abs(librosa.stft(y16, n_fft=512, hop_length=HOP, center=True)) ** 2
freqs = librosa.fft_frequencies(sr=SR, n_fft=512)
mel = librosa.feature.melspectrogram(S=S, sr=SR, n_mels=64, fmin=50, fmax=7800)
logmel = np.log(mel + 1e-6 * mel.max())


def band_db(lo, hi):
    return 10 * np.log10(S[(freqs >= lo) & (freqs < hi)].sum(0) + 1e-10)


voice_db = band_db(100, 4000)   # vowels and voiced consonants
hf_db = band_db(3500, 8000)     # fricatives and bursts
level_db = band_db(80, 8000)
fric = band_db(2500, 8000) - band_db(100, 1000)  # > 0 dB: hiss dominates the voicing


def fricative_start(t, floor, max_back=0.3):
    """if a word's onset follows a hiss (s, sh, f, ch ...), move it back to where the hiss starts"""
    k = int((t + 0.03) * FPS)
    lo = int(max(floor, t - max_back) * FPS)
    loud = level_db[k - int(0.4 * FPS):k + int(0.4 * FPS)].max() - 35
    # the hiss may be followed by a short nasal or glide before the vowel ("sm", "sn", "sw")
    while k > max(lo, int((t - 0.1) * FPS)) and fric[k - 1] <= 0:
        k -= 1
    j = k
    while j > lo and fric[j - 1] > 0 and level_db[j - 1] > loud:
        j -= 1
    return j / FPS if (k - j) / FPS >= 0.04 else t

# superflux: positive log-mel change against a frequency-max-filtered frame 15 ms back
LAG = 3
ref = np.maximum(np.maximum(logmel, np.roll(logmel, 1, 0)), np.roll(logmel, -1, 0))
flux = np.zeros(logmel.shape[1])
flux[LAG:] = np.maximum(0, logmel[:, LAG:] - ref[:, :-LAG]).mean(0)
rise = np.zeros_like(flux)
for band in (voice_db, hf_db):
    d = np.zeros_like(band)
    d[LAG:] = np.maximum(0, band[LAG:] - band[:-LAG])
    rise += d / 10.0
novelty = np.convolve(flux + 0.5 * rise, np.hanning(5) / np.hanning(5).sum(), mode='same')


def silence_mask(a, b):
    """frames of [a, b) where the voice is off, relative to that stretch's own loudness"""
    i0, i1 = int(a * FPS), int(b * FPS)
    lv = level_db[i0:i1]
    return lv < np.percentile(lv, 95) - 28


# ---------------------------------------------------------------- CTC model
def kaldi_fbank(x, n_mels=80):
    """80-bin Kaldi fbank (povey window, 25/10 ms, no dither, snip_edges=False), as the model wants"""
    x = x.astype(np.float64) * 32768
    shift, flen, nfft = 160, 400, 512
    n = (len(x) + shift // 2) // shift
    pad = flen // 2 + shift
    xp = np.pad(x, (pad, pad + flen), mode='symmetric')
    starts = np.arange(n) * shift + shift // 2 - flen // 2 + pad
    fr = xp[starts[:, None] + np.arange(flen)]
    fr = fr - fr.mean(1, keepdims=True)
    fr = np.concatenate([fr[:, :1] * (1 - 0.97), fr[:, 1:] - 0.97 * fr[:, :-1]], 1)
    win = (0.5 - 0.5 * np.cos(2 * np.pi * np.arange(flen) / (flen - 1))) ** 0.85
    p = np.abs(np.fft.rfft(fr * win, nfft)) ** 2
    m = lambda f: 1127 * np.log(1 + f / 700)
    lo, hi = m(20), m(SR / 2)
    c = lo + (hi - lo) * np.arange(n_mels + 2) / (n_mels + 1)
    fm = m(np.arange(nfft // 2 + 1) * SR / nfft)
    fb = np.maximum(0, np.minimum((fm[None] - c[:-2, None]) / (c[1:-1, None] - c[:-2, None]),
                                  (c[2:, None] - fm[None]) / (c[2:, None] - c[1:-1, None])))
    fb[:, -1] = 0
    f = np.log(np.maximum(p @ fb.T, np.finfo(np.float32).eps))
    return ((f - f.mean(0)) / (f.std(0) + 1e-5)).astype(np.float32)


so = ort.SessionOptions()
so.intra_op_num_threads = 2
ctc = ort.InferenceSession(f'{ctc_dir}/model.int8.onnx', so, providers=['CPUExecutionProvider'])
pieces = {}
for ln in open(f'{ctc_dir}/tokens.txt', encoding='utf-8'):
    p, i = ln.split()
    pieces[p] = int(i)
BLANK = pieces['<blk>']
CTC_HOP = 0.04


def ctc_logprobs(a, b):
    f = kaldi_fbank(y16[int(a * SR):int(b * SR)])
    lp = ctc.run(None, {'audio_signal': f.T[None], 'length': np.array([len(f)], np.int64)})[0][0]
    return lp


ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen ' \
       'sixteen seventeen eighteen nineteen'.split()
TENS = 'x x twenty thirty forty fifty sixty seventy eighty ninety'.split()


def spoken(word):
    """printed word -> the words the CTC model should hear"""
    w = word.strip('.,!?;:"()')
    if w.isdigit() and int(w) < 100:
        n = int(w)
        return [ONES[n]] if n < 20 else [TENS[n // 10] + ('' if n % 10 == 0 else ' ' + ONES[n % 10])]
    if w.isupper() and 1 < len(w) <= 4:          # initialisms are sung letter by letter
        return [' '.join(w.lower())]
    return [re.sub(r"[^a-z']", '', w.lower().replace('’', "'"))]


def word_pieces(w):
    """fewest-pieces segmentation of one word into the model's sentencepiece vocabulary"""
    s = '▁' + w.replace("'", "'")
    n = len(s)
    best = [(0, 0, [])] + [None] * n
    for i in range(n):
        if best[i] is None:
            continue
        for j in range(i + 1, n + 1):
            p = s[i:j]
            if p in pieces:
                cand = (best[i][0] + 1, best[i][1] + pieces[p], best[i][2] + [pieces[p]])
                if best[j] is None or cand[:2] < best[j][:2]:
                    best[j] = cand
    if best[n] is None:     # characters the model does not know: drop them
        return word_pieces(re.sub(r"[^a-z]", '', w)) if re.sub(r"[^a-z]", '', w) != w else [pieces['<unk>']]
    return best[n][2]


def force_align(lp, toks):
    """CTC Viterbi alignment; returns the first and last frame of every token"""
    T = lp.shape[0]
    ext = [BLANK]
    for t in toks:
        ext += [t, BLANK]
    L = len(ext)
    NEG = -1e30
    D = np.full((T, L), NEG)
    bp = np.zeros((T, L), dtype=np.int8)
    D[0, 0] = lp[0, ext[0]]
    D[0, 1] = lp[0, ext[1]]
    for t in range(1, T):
        for s in range(L):
            c = [D[t - 1, s], D[t - 1, s - 1] if s >= 1 else NEG,
                 D[t - 1, s - 2] if s >= 2 and ext[s] != BLANK and ext[s] != ext[s - 2] else NEG]
            k = int(np.argmax(c))
            D[t, s] = c[k] + lp[t, ext[s]]
            bp[t, s] = k
    s = L - 1 if D[T - 1, L - 1] >= D[T - 1, L - 2] else L - 2
    path = [0] * T
    for t in range(T - 1, -1, -1):
        path[t] = s
        s -= int(bp[t, s])
    first, last = [None] * len(toks), [None] * len(toks)
    for t, s in enumerate(path):
        if s % 2 == 1:
            k = s // 2
            if first[k] is None:
                first[k] = t
            last[k] = t
    return first, last


# ---------------------------------------------------------------- onset refinement
def onset_candidates(a, b):
    """novelty peaks in [a, b]: (time of the rise, strength)"""
    i0, i1 = max(1, int(a * FPS)), min(len(novelty) - 1, int(b * FPS))
    seg = novelty[i0:i1]
    if len(seg) < 3:
        return []
    out = []
    for k in range(1, len(seg) - 1):
        if seg[k] >= seg[k - 1] and seg[k] > seg[k + 1] and seg[k] >= seg[max(0, k - 5):k + 6].max():
            # the onset is where the rise starts: walk back while the novelty keeps falling
            j = k
            while j > 0 and seg[j - 1] < seg[j] and seg[j - 1] > 0.35 * seg[k]:
                j -= 1
            out.append(((i0 + j) / FPS, float(seg[k])))
    return out


def refine(ctc_t, lo, hi, scale, prior_sd=0.06, early=0.03):
    """pick onsets for a run of words: each near its CTC time, in order, >= 50 ms apart"""
    cands = []
    for i, c in enumerate(ctc_t):
        cs = [(t, s) for t, s in onset_candidates(max(lo, c - 0.2), min(hi, c + 0.12))]
        opts = [(c, 0.0)]  # keeping the CTC time is always allowed, with no reward
        for t, s in cs:
            gain = min(s / scale, 3.0) * np.exp(-0.5 * ((t - (c - early)) / prior_sd) ** 2)
            opts.append((t, gain))
        cands.append(opts)
    # dynamic program over the candidate lists
    best = [[(g, -1) for (_, g) in cands[0]]]
    for i in range(1, len(cands)):
        row = []
        for t, g in cands[i]:
            prev = [(best[i - 1][k][0], k) for k, (tp, _) in enumerate(cands[i - 1]) if t >= tp + 0.05]
            if prev:
                v, k = max(prev)
                row.append((v + g, k))
            else:
                row.append((-1e9, 0))
        best.append(row)
    k = int(np.argmax([v for v, _ in best[-1]]))
    pick = [0] * len(cands)
    for i in range(len(cands) - 1, -1, -1):
        pick[i] = k
        k = best[i][k][1]
    return [cands[i][pick[i]][0] for i in range(len(cands))]


# ---------------------------------------------------------------- main
groups = []
for ln in spec:
    a, b = ln['win']
    if groups and a < groups[-1]['win'][1]:
        groups[-1]['lines'].append(ln)
        groups[-1]['win'][1] = max(groups[-1]['win'][1], b)
    else:
        groups.append({'win': [a, b], 'lines': [ln]})

result, debug = [], []
for g in groups:
    a, b = g['win']
    pa, pb = max(0.0, a - 0.3), min(len(y16) / SR, b + 0.3)
    lp = ctc_logprobs(pa, pb)
    words, toks, tok_word = [], [], []
    for li, ln in enumerate(g['lines']):
        printed = ln['text'].split()
        said = ln['say'].split() if ln.get('say') else printed
        if len(said) != len(printed):
            raise SystemExit(f"{ln.get('id')}: 'say' must have one entry per printed word")
        for wi, (w, s) in enumerate(zip(printed, said)):
            words.append((li, wi, w))
            for part in ' '.join(spoken(s)).split():
                for p in word_pieces(part):
                    toks.append(p)
                    tok_word.append(len(words) - 1)
    first, last = force_align(lp, toks)
    w_first, w_last = {}, {}
    for k, wi in enumerate(tok_word):
        w_first.setdefault(wi, first[k])
        w_last[wi] = last[k]
    ctc_t = [pa + w_first[i] * CTC_HOP for i in range(len(words))]
    ctc_e = [pa + (w_last[i] + 1) * CTC_HOP for i in range(len(words))]
    scale = np.percentile(novelty[int(a * FPS):int(b * FPS)], 90) + 1e-9
    t = refine(ctc_t, pa, pb, scale)
    for i, (_, _, w) in enumerate(words):
        if re.match(r"(?i)(s|z|f|th|ch|sh|j|c[eiy])", w):
            t[i] = max(fricative_start(t[i], t[i - 1] + 0.08 if i else pa), t[i - 1] + 0.05 if i else pa)
    for i, (li, wi, _) in enumerate(words):
        fix = g['lines'][li].get('fix', {})
        if str(wi) in fix:
            t[i] = float(fix[str(wi)])
    # ends: next onset, or the start of a breath (>= 80 ms of silence) before it
    sil = silence_mask(pa, pb)
    i0 = int(pa * FPS)

    def voice_stops(t0, t1, min_gap):
        k0, k1 = int(t0 * FPS) - i0, int(t1 * FPS) - i0
        run = 0
        for k in range(max(0, k0 + 8), min(len(sil), k1)):
            run = run + 1 if sil[k] else 0
            if run >= min_gap * FPS:
                return (k - run + 1 + i0) / FPS
        return None

    ends = []
    for i in range(len(words)):
        last_in_line = i + 1 == len(words) or words[i + 1][0] != words[i][0]
        nxt = t[i + 1] if i + 1 < len(words) else pb
        if last_in_line:
            limit = min(nxt, t[i] + 4.0)
            stop = voice_stops(max(t[i], ctc_e[i] - 0.2), limit, 0.12)
            ends.append(min(stop if stop is not None else limit, nxt - 0.01))
        else:
            stop = voice_stops(t[i], nxt, 0.08)
            ends.append(stop if stop is not None else nxt)
    for li, ln in enumerate(g['lines']):
        idx = [i for i, (l2, _, _) in enumerate(words) if l2 == li]
        emph = set()
        for e in ln.get('emph', []):
            if isinstance(e, int):
                emph.add(e)
            else:
                emph |= {k for k, i in enumerate(idx) if words[i][2].strip('.,!?') == e}
        ws = [{'w': words[i][2], 't': round(float(t[i]), 3), 'e': round(float(ends[i]), 3), 'emph': k in emph}
              for k, i in enumerate(idx)]
        out = {'id': ln.get('id'), 'section': ln.get('section'), 'text': ln['text'],
               'start': ws[0]['t'], 'end': ws[-1]['e'], 'words': ws}
        for key in ('kind',):
            if key in ln:
                out[key] = ln[key]
        result.append(out)
        debug.append({'id': ln.get('id'), 'ctc': [round(ctc_t[i], 3) for i in idx],
                      'ctc_end': [round(ctc_e[i], 3) for i in idx]})

json.dump({'lines': result}, open(out_path, 'w'), indent=1)
if debug_path:
    json.dump(debug, open(debug_path, 'w'), indent=1)
for ln in result:
    print(f"{ln['id'] or '':8s} {ln['start']:7.2f}-{ln['end']:7.2f}  {len(ln['words']):2d} words", file=sys.stderr)
