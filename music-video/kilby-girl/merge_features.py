"""Assemble the renderer's features.json from its parts.

    python3 merge_features.py base_features.json out.json [--perf perf.json] [--lyrics lyrics.json]

base_features.json comes from features.py + beats.py (+ the vocal envelope). perf.json (perf.py)
lands under "perf"; a lyrics file ({"lines": [...]}, lyrics_timing.py) replaces "lyrics".
Missing optional parts are skipped, so the output always renders.
"""
import json
import os
import sys


def main():
    args = sys.argv[1:]
    opt = {}
    for k in ('--perf', '--lyrics'):
        if k in args:
            i = args.index(k)
            opt[k] = args[i + 1]
            del args[i:i + 2]
    base, out = args
    f = json.load(open(base))
    if opt.get('--perf') and os.path.exists(opt['--perf']):
        f['perf'] = json.load(open(opt['--perf']))
        print('perf:', ', '.join(k for k in f['perf'] if k not in ('fps', 'duration')))
    if opt.get('--lyrics') and os.path.exists(opt['--lyrics']):
        ly = json.load(open(opt['--lyrics']))
        f['lyrics'] = {'lines': ly['lines']}
        print('lyrics:', len(ly['lines']), 'lines')
    with open(out, 'w') as fh:
        json.dump(f, fh, separators=(',', ':'))
    print('wrote', out)


if __name__ == '__main__':
    main()
