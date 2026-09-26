"""Beat and downbeat grid for the whole song, written into features.json.

Up to the final section the song sits at ~166 BPM and the tracked beats are tight, so they are kept;
each section's opening hit (where the whole band lands together) is its first downbeat. The final
section switches to four beats in the time of five (~134 BPM, 1.79 s bars); the band is on a click,
so it gets a uniform grid fitted to its accents, which fall every half bar.

    python3 beats.py features.json
"""
import json
import sys

import numpy as np

feat_path = sys.argv[1]
f = json.load(open(feat_path))
beats = np.array(f.get('beats_old', f['beats']))
acc = np.array(f['accents'])

SECTION_STARTS = [38.66, 61.59, 85.58, 123.03, 147.39, 169.56]
FINAL = 183.59

# ---- before the final section: tracked beats, downbeats counted from each section's first hit
pre = beats[beats < FINAL - 0.1]
starts = [pre[0]] + SECTION_STARTS
down = []
for k, s in enumerate(starts):
    e = starts[k + 1] if k + 1 < len(starts) else FINAL
    i0 = int(np.argmin(np.abs(pre - s)))
    seg = pre[i0:][pre[i0:] < e - 0.1]
    down += seg[::4].tolist()

# ---- final section: uniform grids fitted to accents. The finale's stabs land on beats 1 and 3
# from its first accent; the outro stops shift phase, so the outro gets its own grid.
def fit_grid(hits, spacing, anchor, lo, hi):
    k = np.round((hits - hits[0]) / spacing)
    step, _ = np.polyfit(k, hits, 1)
    beat = step / round(step / 0.4455)  # accents are 2 or 4 beats apart; recover the beat
    n_back = int(np.floor((anchor - lo) / beat))
    g = anchor - n_back * beat + beat * np.arange(0, int((hi - lo) / beat) + 2)
    return g[(g >= lo - 1e-6) & (g < hi)], beat


fin_hits = acc[(acc > 184.0) & (acc < 197)]
g1, beat = fit_grid(fin_hits, 0.894, fin_hits[0], FINAL, 225.3)
out_hits = acc[(acc > 231) & (acc < 237)]
g2, beat2 = fit_grid(out_hits, 1.78, out_hits[0], 225.3, f['duration'])
post = np.r_[FINAL, g1[g1 > FINAL + 0.2], g2]
post_down = np.r_[FINAL, g1[g1 >= fin_hits[0] - 1e-3][::4], g2[np.round((g2 - out_hits[0]) / beat2) % 4 == 0]]
f['beats_old'] = beats.round(3).tolist()
f['beats'] = np.r_[pre, post].round(3).tolist()
f['downbeats'] = np.r_[down, post_down].round(3).tolist()
f['tempo_final'] = round(60 / beat, 2)
json.dump(f, open(feat_path, 'w'))

acc_all = acc
on_beat = sum(np.min(np.abs(np.array(f['beats']) - a)) < 0.06 for a in acc_all)
on_down = sum(np.min(np.abs(np.array(f['downbeats']) - a)) < 0.06 for a in acc_all)
print(f'final section: {60 / beat:.2f} bpm, bar {4 * beat:.3f}s, first downbeat {post_down[0]:.3f}', file=sys.stderr)
print(f'{len(f["beats"])} beats, {len(f["downbeats"])} downbeats; accents on a beat {on_beat}/{len(acc_all)}, on a downbeat {on_down}', file=sys.stderr)
late = acc[acc > 225]
print('outro accents vs nearest downbeat (ms):', [round(1000 * (np.array(f['downbeats'])[np.argmin(np.abs(np.array(f['downbeats']) - a))] - a)) for a in late], file=sys.stderr)
