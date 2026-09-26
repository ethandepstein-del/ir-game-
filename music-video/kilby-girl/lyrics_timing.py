"""Word timing for known lyric lines, from the separated vocal.

Input is a JSON list of lines, each {"text": ..., "win": [start, end]}: the line's words and the
stretch of vocal it lives in (several consecutive lines may share one window). Words are placed on
syllable onsets found in the vocal stem: every syllable is matched to a distinct onset, in order,
by a small dynamic program that stays close to an even spread and interpolates where no onset fits.

    python3 lyrics_timing.py vocals.wav lines.json lyrics.json

The lyric text itself stays outside the repo.
"""
import json
import re
import sys

import librosa
import numpy as np
import soundfile as sf

vocal_path, lines_path, out_path = sys.argv[1:4]
spec = json.load(open(lines_path))

y, sr = sf.read(vocal_path, always_2d=True)
y16 = librosa.resample(y.mean(1), orig_sr=sr, target_sr=16000).astype(np.float32)
hop = 160
fps = 16000 / hop
oenv = librosa.onset.onset_strength(y=y16, sr=16000, hop_length=hop)
onsets = librosa.onset.onset_detect(onset_envelope=oenv, sr=16000, hop_length=hop, backtrack=True, units='time', delta=0.03, wait=5)
rms = librosa.feature.rms(y=y16, frame_length=640, hop_length=hop)[0]
db = 20 * np.log10(rms + 1e-9)
voiced_thr = np.percentile(db, 97) - 30


def syllables(word):
    w = re.sub(r'[^a-z]', '', word.lower())
    if not w:
        return 0
    if w.isdigit():
        return 2
    n = len(re.findall(r'[aeiouy]+', w))
    if w.endswith('e') and n > 1 and not w.endswith(('le', 'ee')):
        n -= 1
    return max(1, n)


def tighten(a, b):
    """trim a window to where the voice is actually sounding"""
    i0, i1 = int(a * fps), int(b * fps)
    act = np.flatnonzero(db[i0:i1] > voiced_thr)
    if len(act) == 0:
        return a, b
    return a + act[0] / fps, a + (act[-1] + 1) / fps


def align(ideal, cand, skip_cost=0.09):
    """monotonic assignment of ideal times to distinct candidate onsets (or interpolation)"""
    S, J = len(ideal), len(cand)
    INF = 1e9
    D = np.full((S + 1, J + 1), INF)
    back = np.zeros((S + 1, J + 1), dtype=int)  # 0 = match, 1 = skip syllable, 2 = skip onset
    D[0, :] = 0
    for i in range(1, S + 1):
        D[i, 0] = D[i - 1, 0] + skip_cost
        back[i, 0] = 1
        for j in range(1, J + 1):
            m = D[i - 1, j - 1] + (cand[j - 1] - ideal[i - 1]) ** 2
            s1 = D[i - 1, j] + skip_cost
            s2 = D[i, j - 1]
            k = int(np.argmin([m, s1, s2]))
            D[i, j] = (m, s1, s2)[k]
            back[i, j] = k
    out = [None] * S
    i, j = S, int(np.argmin(D[S]))
    while i > 0:
        k = back[i, j] if j > 0 else 1
        if k == 0:
            out[i - 1] = cand[j - 1]
            i, j = i - 1, j - 1
        elif k == 1:
            i -= 1
        else:
            j -= 1
    # interpolate unmatched syllables between their matched neighbours
    t = np.array([np.nan if v is None else v for v in out], dtype=float)
    idx = np.arange(S)
    good = ~np.isnan(t)
    if good.sum() == 0:
        return ideal
    t[~good] = np.interp(idx[~good], idx[good], t[good]) if good.sum() > 1 else ideal[~good] + (t[good][0] - ideal[good][0])
    return np.maximum.accumulate(t)


# group consecutive lines that share a window
groups = []
for ln in spec:
    if groups and groups[-1]['win'] == ln['win']:
        groups[-1]['lines'].append(ln['text'])
    else:
        groups.append({'win': ln['win'], 'lines': [ln['text']]})

result = []
for g in groups:
    a, b = tighten(*g['win'])
    words = [(li, w) for li, text in enumerate(g['lines']) for w in text.split()]
    syl = []
    for wi, (_, w) in enumerate(words):
        syl += [wi] * max(1, syllables(w))
    S = len(syl)
    # sung lines hold their last syllable: give it extra weight in the even spread
    weights = np.ones(S)
    for li in range(len(g['lines'])):
        last = max(i for i, wi in enumerate(syl) if words[wi][0] == li)
        weights[last] = 2.2
    ideal = a + (b - a) * np.r_[0, np.cumsum(weights)[:-1]] / weights.sum()
    cand = onsets[(onsets >= a - 0.08) & (onsets < b - 0.05)]
    t = align(ideal, cand)
    wstart = {}
    for si, wi in enumerate(syl):
        wstart.setdefault(wi, t[si])
    for li, text in enumerate(g['lines']):
        idx = [wi for wi, (l2, _) in enumerate(words) if l2 == li]
        ws = []
        for k, wi in enumerate(idx):
            nxt = wstart[idx[k + 1]] if k + 1 < len(idx) else None
            ws.append({'w': words[wi][1], 't': round(float(wstart[wi]), 3)})
        result.append({'text': text, 'words': ws})

# line ends: the next line's start, capped by where the voice stops
for k, ln in enumerate(result):
    for i, w in enumerate(ln['words']):
        w['e'] = ln['words'][i + 1]['t'] if i + 1 < len(ln['words']) else None
    ln['start'] = ln['words'][0]['t']
for k, ln in enumerate(result):
    nxt = result[k + 1]['start'] if k + 1 < len(result) else ln['start'] + 4
    # the held last word ends when the voice drops or the next line begins
    i0 = int(ln['words'][-1]['t'] * fps)
    i1 = int(min(nxt, ln['words'][-1]['t'] + 3.5) * fps)
    act = np.flatnonzero(db[i0:i1] > voiced_thr)
    end = ln['words'][-1]['t'] + ((act[-1] + 1) / fps if len(act) else 0.5)
    ln['end'] = round(float(min(end, nxt)), 3)
    ln['words'][-1]['e'] = ln['end']

json.dump({'lines': result}, open(out_path, 'w'), indent=1)
for ln in result:
    print(f"{ln['start']:7.2f}-{ln['end']:7.2f}  {len(ln['words']):2d} words", file=sys.stderr)
